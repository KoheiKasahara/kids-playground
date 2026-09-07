import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test } from 'vitest'
import { measureLoadingSize, renderLoadingSizeMarkdown } from './loadingSize.mjs'

let dir
function fixture() {
  dir = mkdtempSync(join(tmpdir(), 'loading-size-'))
  mkdirSync(join(dir, '.vite'))
  const manifest = {
    'index.html': { src: 'index.html', isEntry: true, file: 'main.js', imports: ['shared'], css: ['main.css'], dynamicImports: ['game'] },
    shared: { file: 'shared.js', imports: ['shared'], css: ['main.css'] },
    game: { file: 'game.js', css: ['game.css'] },
    dashboard: { src: 'src/project-health/index.html', isEntry: true, file: 'dashboard.js' },
  }
  writeFileSync(join(dir, '.vite/manifest.json'), JSON.stringify(manifest))
  for (const [file, size] of Object.entries({ 'main.js': 100, 'shared.js': 40, 'main.css': 20, 'game.js': 500, 'game.css': 80, 'dashboard.js': 900, 'picture.webp': 1000 })) {
    writeFileSync(join(dir, file), 'x'.repeat(size))
  }
  writeFileSync(join(dir, '.vite/precache.json'), JSON.stringify(['main.js', 'shared.js', 'main.css', 'game.js', 'game.css', 'picture.webp', 'picture.webp'].map((url) => ({ url, revision: 'v1' }))))
}
afterEach(() => { if (dir) rmSync(dir, { recursive: true, force: true }); dir = undefined })

test('初期静的依存は重複なし、動的ゲームとDashboardを除外しprecacheは別集計', () => {
  fixture()
  const result = measureLoadingSize(dir)
  expect(result.initial.js.raw).toBe(140)
  expect(result.initial.css.raw).toBe(20)
  expect(result.initial.js.gzip).toBeGreaterThan(0)
  expect(result.precache.count).toBe(6)
  expect(result.precache.bytes).toBe(1740)
  expect(result.precache.largest[0]).toEqual({ url: 'picture.webp', bytes: 1000 })
  expect(renderLoadingSizeMarkdown(result)).toContain('PWA precache（6件）')
})

test('欠けた成果物を0 bytesの成功として報告しない', () => {
  fixture()
  rmSync(join(dir, 'shared.js'))
  expect(() => measureLoadingSize(dir)).toThrow()
  expect(renderLoadingSizeMarkdown(null)).toContain('計測なし')
})
