import { afterEach, describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { prepareDiagnostics, selectDiagnostics } from './prepare-diagnostics.mjs'

const temporaryDirectories = []
afterEach(async () => { await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))) })
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
    await add(cwd, 'outside.md', 'do not follow')
    await symlink(path.join(cwd, 'outside.md'), path.join(cwd, 'test-results/failure/test-failed-2.png'))
    const result = await prepareDiagnostics(cwd)
    expect(result.files).toHaveLength(4)
    expect(await readFile(path.join(cwd, 'e2e-diagnostics/test-results/failure/trace.zip'), 'utf8')).toBe('complete trace')
    expect(await readFile(path.join(cwd, 'test-results/failure/trace.zip'), 'utf8')).toBe('complete trace')
    expect(JSON.parse(await readFile(path.join(cwd, 'e2e-diagnostics/manifest.json'), 'utf8')).files).toHaveLength(4)
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
