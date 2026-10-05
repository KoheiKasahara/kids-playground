import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

export const DIAGNOSTICS_BUDGET_BYTES = 25 * 1024 * 1024
const MANIFEST = 'manifest.json'

function priority(file) {
  if (file.endsWith('/error-context.md') || file.endsWith('/golf-failure-state.json')) return 0
  if (/\/test-failed-\d+\.png$/.test(file)) return 1
  return 2
}

/** Keep complete files; an omitted trace must remain visible in the manifest. */
export function selectDiagnostics(candidates, maxBytes = DIAGNOSTICS_BUDGET_BYTES) {
  // Leave room for ZIP headers/compression overhead, in addition to the manifest itself.
  const archiveHeadroomBytes = Math.min(1024 * 1024, Math.floor(maxBytes / 10))
  const files = [...candidates]
    .sort((a, b) => priority(a.path) - priority(b.path) || a.bytes - b.bytes || a.path.localeCompare(b.path))
    .map(file => ({ ...file, status: 'omitted-size-budget' }))
  const manifest = { maxBytes, archiveHeadroomBytes, sourceBytes: files.reduce((sum, file) => sum + file.bytes, 0), savedBytes: 0, files }
  const manifestSize = () => Buffer.byteLength(`${JSON.stringify(manifest, null, 2)}\n`)
  for (const file of files) {
    file.status = 'saved'
    manifest.savedBytes += file.bytes
    if (manifest.savedBytes + manifestSize() > maxBytes - archiveHeadroomBytes) {
      file.status = 'omitted-size-budget'
      manifest.savedBytes -= file.bytes
    }
  }
  if (manifestSize() > maxBytes - archiveHeadroomBytes) throw new Error('Diagnostic manifest exceeds size budget')
  return manifest
}

export async function prepareDiagnostics(cwd = process.cwd(), maxBytes = DIAGNOSTICS_BUDGET_BYTES) {
  const candidates = []
  async function visit(directory) {
    let entries
    try { entries = await readdir(directory, { withFileTypes: true }) } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name)
      if (entry.isDirectory()) await visit(absolute)
      // Do not follow symlinks or include screenshots captured on successful tests.
      if (!entry.isFile() || !/^(trace\.zip|error-context\.md|golf-failure-state\.json|test-failed-\d+\.png)$/.test(entry.name)) continue
      candidates.push({ path: path.relative(cwd, absolute).split(path.sep).join('/'), bytes: (await stat(absolute)).size })
    }
  }
  for (const directory of ['test-results', 'test-results-repeat']) await visit(path.join(cwd, directory))
  const output = path.join(cwd, 'e2e-diagnostics')
  // Only replace generated staging files. The original test results remain intact.
  await rm(output, { recursive: true, force: true })
  if (!candidates.length) return null
  const manifest = selectDiagnostics(candidates, maxBytes)
  await mkdir(output, { recursive: true })
  for (const file of manifest.files.filter(file => file.status === 'saved')) {
    const destination = path.join(output, file.path)
    await mkdir(path.dirname(destination), { recursive: true })
    await cp(path.join(cwd, file.path), destination)
  }
  await writeFile(path.join(output, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const maxBytes = Number(process.env.E2E_DIAGNOSTICS_MAX_BYTES ?? DIAGNOSTICS_BUDGET_BYTES)
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024 || maxBytes > DIAGNOSTICS_BUDGET_BYTES) throw new Error('Diagnostic budget must be between 1 KiB and 25 MiB')
  const result = await prepareDiagnostics(process.cwd(), maxBytes)
  if (!result) console.log('No failure diagnostics to upload.')
  else {
    console.log(`Failure diagnostics: ${result.savedBytes} bytes retained from ${result.sourceBytes}; upload budget ${result.maxBytes} bytes.`)
    for (const file of result.files.filter(file => file.status !== 'saved')) console.log(`Omitted by size budget: ${file.path} (${file.bytes} bytes); recorded in manifest.json.`)
  }
}
