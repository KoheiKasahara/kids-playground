import fs from 'node:fs'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { afterEach, expect, test } from 'vitest'

const require = createRequire(import.meta.url)
const workboxRequire = createRequire(require.resolve('workbox-build'))
const { glob } = workboxRequire('glob')
const eslintRequire = createRequire(require.resolve('eslint'))
const { Minimatch } = eslintRequire('minimatch')
const offThreadRequire = createRequire(workboxRequire.resolve('@trickfilm400/rollup-plugin-off-main-thread'))
const ejsRequire = createRequire(offThreadRequire.resolve('ejs'))
const jakeRequire = createRequire(ejsRequire.resolve('jake'))
const filelistRequire = createRequire(jakeRequire.resolve('filelist'))
const filelistMinimatch = filelistRequire('minimatch')
let directory
afterEach(async () => {
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})

test('limits adversarial pattern preprocessing (CVE-2026-118764)', () => {
  const pattern = ['root', ...Array(12).fill('**/../segment'), '*.js'].join('/')
  const matcher = new Minimatch(pattern, { optimizationLevel: 2, braceExpandMax: 8 })
  expect(matcher.globParts.length).toBeLessThanOrEqual(8)
})

test('aborting a walk prevents further directory reads (CVE-2026-118773)', async () => {
  directory = await mkdtemp(join(tmpdir(), 'glob-abort-'))
  await mkdir(join(directory, 'nested', 'deeper'), { recursive: true })
  await writeFile(join(directory, 'nested', 'deeper', 'asset.js'), 'asset')
  const controller = new AbortController()
  const reason = new Error('cancel traversal')
  let reads = 0
  const instrumentedFs = {
    ...fs,
    readdir(path, options, callback) {
      reads++
      fs.readdir(path, options, (error, entries) => {
        controller.abort(reason)
        callback(error, entries)
      })
    },
  }
  await expect(glob('**/*', { cwd: directory, fs: instrumentedFs, signal: controller.signal })).rejects.toBe(reason)
  // Allow callbacks from any incorrectly continued walk to finish.
  await new Promise(resolve => setTimeout(resolve, 50))
  expect(reads).toBe(1)
})

test('retains the match API consumed by FileList in the EJS build dependency', () => {
  const files = ['src/main.ts', 'src/component.test.ts', 'src/styles.css']
  expect(filelistMinimatch.match(files, '**/*.ts')).toEqual(['src/main.ts', 'src/component.test.ts'])
  expect(filelistMinimatch.match(files, '!**/*.test.ts')).toEqual(['src/main.ts', 'src/styles.css'])
})
