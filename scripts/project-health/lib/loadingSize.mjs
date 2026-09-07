import { readFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

// Viteのstatic imports/cssだけを辿る。dynamicImportsは遊ぶ時の取得なので含めない。
export function measureLoadingSize(distDir) {
  const manifest = JSON.parse(readFileSync(join(distDir, '.vite/manifest.json'), 'utf8'))
  const entry = Object.keys(manifest).find((key) => manifest[key].isEntry && manifest[key].src === 'index.html')
  if (!entry) throw new Error('Main entry is missing from Vite manifest')
  const visited = new Set()
  const files = new Set()
  function visit(key) {
    if (visited.has(key)) return
    visited.add(key)
    const chunk = manifest[key]
    if (!chunk) throw new Error(`Missing static chunk: ${key}`)
    files.add(chunk.file)
    for (const css of chunk.css ?? []) files.add(css)
    for (const dependency of chunk.imports ?? []) visit(dependency)
  }
  visit(entry)

  const base = resolve(distDir)
  function readAsset(file) {
    const target = resolve(base, file)
    const path = relative(base, target)
    if (isAbsolute(path) || path === '..' || path.startsWith('../')) throw new Error('Asset outside dist')
    return readFileSync(target)
  }
  const initial = { js: { raw: 0, gzip: 0 }, css: { raw: 0, gzip: 0 } }
  for (const file of files) {
    const kind = file.endsWith('.js') ? 'js' : file.endsWith('.css') ? 'css' : null
    if (!kind) continue
    const bytes = readAsset(file)
    initial[kind].raw += bytes.length
    initial[kind].gzip += gzipSync(bytes).length
  }

  const precacheManifest = JSON.parse(readFileSync(join(distDir, '.vite/precache.json'), 'utf8'))
  const entries = [...new Map(precacheManifest.map((entry) => [entry.url, entry])).values()]
    .map(({ url }) => ({ url, bytes: readAsset(url).length }))
    .sort((a, b) => b.bytes - a.bytes || a.url.localeCompare(b.url))
  return {
    initial,
    precache: { count: entries.length, bytes: entries.reduce((sum, entry) => sum + entry.bytes, 0), largest: entries.slice(0, 10) },
  }
}

export function renderLoadingSizeMarkdown(metrics) {
  if (!metrics) return '\n### 初期読込・PWA容量\n\n計測なし（ビルド成果物が不足）。\n'
  const kib = (bytes) => (bytes / 1024).toFixed(1)
  return `\n### 初期読込・PWA容量\n\n| 対象 | raw KiB | gzip換算 KiB |\n| --- | ---: | ---: |\n`
    + `| 初期JS（静的依存を含む） | ${kib(metrics.initial.js.raw)} | ${kib(metrics.initial.js.gzip)} |\n`
    + `| 初期CSS | ${kib(metrics.initial.css.raw)} | ${kib(metrics.initial.css.gzip)} |\n`
    + `| PWA precache（${metrics.precache.count}件） | ${kib(metrics.precache.bytes)} | — |\n\n`
    + 'gzipはファイルごとのローカル換算。precacheはURL重複を除いた件数・容量で、初期JS実行量とは別です。\n\n'
    + '| precache上位ファイル | KiB |\n| --- | ---: |\n'
    + metrics.precache.largest.map(({ url, bytes }) => `| ${url} | ${kib(bytes)} |`).join('\n') + '\n'
}
