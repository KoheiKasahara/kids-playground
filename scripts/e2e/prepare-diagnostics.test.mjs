import { afterEach, describe, expect, it, vi } from 'vitest'
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareDiagnostics, selectDiagnostics } from './prepare-diagnostics.mjs'

vi.mock('node:fs/promises', async importOriginal => {
  const actual = await importOriginal()
  return { ...actual, readdir: vi.fn(actual.readdir) }
})

const temporaryDirectories = []
afterEach(async () => {
  vi.mocked(readdir).mockReset()
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})
async function workspace() {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'e2e-diagnostics-'))
  temporaryDirectories.push(directory)
  return directory
}
async function add(cwd, file, content) {
  await mkdir(path.dirname(path.join(cwd, file)), { recursive: true })
  await writeFile(path.join(cwd, file), content)
}

describe('bounded failure diagnostics', () => {
  it('keeps text and failure screenshots before complete traces, and accounts for manifest/header bytes', () => {
    const result = selectDiagnostics([
      { path: 'test-results/a/trace.zip', bytes: 30_000 },
      { path: 'test-results/b/trace.zip', bytes: 2_000 },
      { path: 'test-results/a/test-failed-1.png', bytes: 1_000 },
      { path: 'test-results/a/error-context.md', bytes: 100 },
    ], 10_000)
    expect(result.files.filter(file => file.status === 'saved').map(file => file.path)).toEqual([
      'test-results/a/error-context.md', 'test-results/a/test-failed-1.png', 'test-results/b/trace.zip',
    ])
    expect(result.files.find(file => file.path === 'test-results/a/trace.zip').status).toBe('omitted-size-budget')
    expect(result.savedBytes + Buffer.byteLength(`${JSON.stringify(result, null, 2)}\n`) + result.archiveHeadroomBytes).toBeLessThanOrEqual(result.maxBytes)
  })

  it('copies both failure attempts without altering originals or admitting successful screenshots/symlinks', async () => {
    const cwd = await workspace()
    await add(cwd, 'test-results/failure/error-context.md', 'first failure')
    await add(cwd, 'test-results/failure/trace.zip', 'complete trace')
    await add(cwd, 'test-results/failure/golf-failure-state.json', '{"hole":4}')
    await add(cwd, 'test-results-repeat/failure/test-failed-1.png', 'failure png')
    await add(cwd, 'test-results/passed/success.png', 'do not upload')
    await add(cwd, 'outside/trace.zip', 'do not follow')
    const linkedDirectory = path.join(cwd, 'test-results/failure/linked-output')
    // Junctions exercise real link traversal on Windows without administrator or
    // Developer Mode privileges. POSIX uses a directory symlink for the same case.
    await symlink(path.join(cwd, 'outside'), linkedDirectory, process.platform === 'win32' ? 'junction' : 'dir')
    expect((await lstat(linkedDirectory)).isSymbolicLink()).toBe(true)
    expect(await readFile(path.join(linkedDirectory, 'trace.zip'), 'utf8')).toBe('do not follow')
    const result = await prepareDiagnostics(cwd)
    expect(result.files).toHaveLength(4)
    expect(await readFile(path.join(cwd, 'e2e-diagnostics/test-results/failure/trace.zip'), 'utf8')).toBe('complete trace')
    expect(await readFile(path.join(cwd, 'test-results/failure/trace.zip'), 'utf8')).toBe('complete trace')
    expect(JSON.parse(await readFile(path.join(cwd, 'e2e-diagnostics/manifest.json'), 'utf8')).files).toHaveLength(4)
    expect(await readFile(path.join(cwd, 'outside/trace.zip'), 'utf8')).toBe('do not follow')
  })

  it('excludes file-link entries even when their name matches a failure screenshot', async () => {
    const cwd = await workspace()
    await add(cwd, 'test-results/error-context.md', 'keep')
    await add(cwd, 'test-results/test-failed-9.png', 'do not copy')
    const actual = await vi.importActual('node:fs/promises')
    // Only the link's Dirent metadata is simulated: stat/copy and the other
    // entries use real files. Accidentally collecting the link would copy the
    // sentinel and fail the assertions, on every OS without elevated privileges.
    vi.mocked(readdir).mockImplementationOnce(async (...args) => {
      const entries = await actual.readdir(...args)
      return entries.map(entry => entry.name === 'test-failed-9.png'
        ? { name: entry.name, isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false }
        : entry)
    })
    const result = await prepareDiagnostics(cwd)
    expect(result.files.map(file => file.path)).toEqual(['test-results/error-context.md'])
    expect(await readdir(path.join(cwd, 'e2e-diagnostics/test-results'))).toEqual(['error-context.md'])
    expect(await readFile(path.join(cwd, 'test-results/test-failed-9.png'), 'utf8')).toBe('do not copy')
  })

  it('leaves no upload directory when tests produce no failures, including stale staging from a prior run', async () => {
    const cwd = await workspace()
    await add(cwd, 'test-results/passed/success.png', 'ok')
    await add(cwd, 'e2e-diagnostics/stale.txt', 'old generated staging')
    expect(await prepareDiagnostics(cwd)).toBeNull()
    expect(await readdir(cwd)).not.toContain('e2e-diagnostics')
    expect(await readFile(path.join(cwd, 'test-results/passed/success.png'), 'utf8')).toBe('ok')
  })
})
