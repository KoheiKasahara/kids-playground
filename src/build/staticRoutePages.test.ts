import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { applyCanonicalUrl, applyPageSeoToHtml, findMissingCanonicalTags, findMissingSeoTags } from './staticRoutePages'
import { buildGameSeo } from '../seo/pageSeo'
import { findGameBySlug } from '../games/gameCatalog'

const BASE_HTML = `<!doctype html>
<html lang="ja">
  <head>
    <title>こどもミニゲーム｜無料で遊べる幼児向けクイズ・知育ゲーム</title>
    <meta name="description" content="幼児向け無料ミニゲーム集の説明文" />
    <link rel="canonical" href="https://kids.kasapg.com/" />
    <meta property="og:title" content="こどもミニゲーム" />
    <meta property="og:url" content="https://kids.kasapg.com/" />
    <meta property="og:image" content="https://kids.kasapg.com/icons/icon-512.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

describe('applyCanonicalUrl', () => {
  test('canonical と og:url を差し替える', () => {
    const result = applyCanonicalUrl(BASE_HTML, 'https://kids.kasapg.com/games/flag-pinball')
    expect(result).toContain('<link rel="canonical" href="https://kids.kasapg.com/games/flag-pinball" />')
    expect(result).toContain('<meta property="og:url" content="https://kids.kasapg.com/games/flag-pinball" />')
  })

  test('title / description / og:image は変わらない', () => {
    const result = applyCanonicalUrl(BASE_HTML, 'https://kids.kasapg.com/games/flag-pinball')
    expect(result).toContain('<title>こどもミニゲーム｜無料で遊べる幼児向けクイズ・知育ゲーム</title>')
    expect(result).toContain('<meta name="description" content="幼児向け無料ミニゲーム集の説明文" />')
    expect(result).toContain('<meta property="og:title" content="こどもミニゲーム" />')
    expect(result).toContain('<meta property="og:image" content="https://kids.kasapg.com/icons/icon-512.png" />')
  })

  test('canonical / og:url タグが無いHTMLでも壊れない', () => {
    const html = '<html><head><title>タイトル</title></head><body></body></html>'
    expect(() => applyCanonicalUrl(html, 'https://kids.kasapg.com/games/flag-pinball')).not.toThrow()
    expect(applyCanonicalUrl(html, 'https://kids.kasapg.com/games/flag-pinball')).toBe(html)
  })
})

describe('findMissingCanonicalTags', () => {
  test('両方のタグが揃っていれば空配列を返す', () => {
    expect(findMissingCanonicalTags(BASE_HTML)).toEqual([])
  })

  test('canonicalタグが無ければそれを名指しする', () => {
    const html = BASE_HTML.replace('<link rel="canonical" href="https://kids.kasapg.com/" />', '')
    expect(findMissingCanonicalTags(html)).toEqual(['<link rel="canonical">'])
  })

  test('og:urlタグが無ければそれを名指しする', () => {
    const html = BASE_HTML.replace('<meta property="og:url" content="https://kids.kasapg.com/" />', '')
    expect(findMissingCanonicalTags(html)).toEqual(['<meta property="og:url">'])
  })

  test('属性順序が変わって一致しなくなった場合も検出する', () => {
    // href属性とrel属性の順序が入れ替わると、既存の正規表現にはマッチしなくなる。
    const html = BASE_HTML.replace(
      '<link rel="canonical" href="https://kids.kasapg.com/" />',
      '<link href="https://kids.kasapg.com/" rel="canonical" />',
    )
    expect(findMissingCanonicalTags(html)).toEqual(['<link rel="canonical">'])
  })

  test('両方無ければ両方を名指しする', () => {
    const html = '<html><head><title>タイトル</title></head><body></body></html>'
    expect(findMissingCanonicalTags(html)).toEqual(['<link rel="canonical">', '<meta property="og:url">'])
  })
})

// 実際の index.html に対して、ビルド時と同じロジック（applyPageSeoToHtml /
// findMissingSeoTags）が正しく動くことを確認する。index.htmlの書式（属性の改行など）と
// staticRoutePages.ts側の正規表現が一致しなくなった場合に、このテストが最初に気づける。
const INDEX_HTML_PATH = path.resolve(__dirname, '../../index.html')
const REAL_INDEX_HTML = readFileSync(INDEX_HTML_PATH, 'utf-8')

describe('applyPageSeoToHtml（実際のindex.htmlに対して）', () => {
  const planetGlobe = findGameBySlug('planet-globe')
  if (!planetGlobe) {
    throw new Error('planet-globe が gameCatalog に見つかりません')
  }
  const seo = buildGameSeo(planetGlobe)

  test('title / description / canonical / og:* / twitter:* を書き換えられる', () => {
    const result = applyPageSeoToHtml(REAL_INDEX_HTML, seo)

    expect(result).toContain(`<title>${seo.title}</title>`)
    expect(result).toContain(`name="description"\n      content="${seo.description}"`)
    expect(result).toContain(`<link rel="canonical" href="${seo.canonicalUrl}" />`)
    expect(result).toContain(`<meta property="og:title" content="${seo.title}" />`)
    expect(result).toContain(`property="og:description"\n      content="${seo.description}"`)
    expect(result).toContain(`<meta property="og:url" content="${seo.canonicalUrl}" />`)
    expect(result).toContain(`<meta property="og:type" content="${seo.ogType}" />`)
    expect(result).toContain(`<meta property="og:image" content="${seo.ogImageUrl}" />`)
    expect(result).toContain(`<meta name="twitter:title" content="${seo.title}" />`)
    expect(result).toContain(`name="twitter:description"\n      content="${seo.description}"`)
  })

  test('書き換え後、対象タグはそれぞれ1個しか無い', () => {
    const result = applyPageSeoToHtml(REAL_INDEX_HTML, seo)

    expect(result.match(/<title>/g)).toHaveLength(1)
    expect(result.match(/<meta\s+name="description"/g)).toHaveLength(1)
    expect(result.match(/<link\s+rel="canonical"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+property="og:title"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+property="og:description"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+property="og:url"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+property="og:type"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+property="og:image"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+name="twitter:title"/g)).toHaveLength(1)
    expect(result.match(/<meta\s+name="twitter:description"/g)).toHaveLength(1)
  })
})

describe('findMissingSeoTags（実際のindex.htmlに対して）', () => {
  test('index.htmlの書式と正規表現が一致しており、欠けているタグが無い', () => {
    expect(findMissingSeoTags(REAL_INDEX_HTML)).toEqual([])
  })
})

// JSON-LDはindex.html自体には存在せず、applyPageSeoToHtmlが</head>の直前へ挿入する。
// dist/index.htmlの2回書き換え（staticRoutePages.tsのcloseBundle参照）を安全にするため、
// 「挿入したあと、その出力へさらに別ページのSEOを適用しても1個のまま中身が切り替わる」
// ことも合わせて確認する。
describe('applyPageSeoToHtml（JSON-LD）', () => {
  const planetGlobe = findGameBySlug('planet-globe')
  if (!planetGlobe) {
    throw new Error('planet-globe が gameCatalog に見つかりません')
  }
  const seo = buildGameSeo(planetGlobe)

  test('ld+jsonのscriptがちょうど1個できて、中身がそのゲームのcanonicalと一致する', () => {
    const result = applyPageSeoToHtml(REAL_INDEX_HTML, seo)
    const matches = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    expect(matches).toHaveLength(1)

    const inline = result.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    expect(inline).not.toBeNull()
    const parsed = JSON.parse(inline![1]!)
    const webApp = parsed['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication')
    expect(webApp.url).toBe(seo.canonicalUrl)
  })

  test('2回連続で適用しても（出力を入力に戻しても）scriptは1個のまま、2回目のデータに切り替わる', () => {
    const firstPassHtml = applyPageSeoToHtml(REAL_INDEX_HTML, seo)

    const railBuilder = findGameBySlug('rail-builder')
    if (!railBuilder) {
      throw new Error('rail-builder が gameCatalog に見つかりません')
    }
    const secondSeo = buildGameSeo(railBuilder)
    const secondPassHtml = applyPageSeoToHtml(firstPassHtml, secondSeo)

    const matches = secondPassHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
    expect(matches).toHaveLength(1)

    const inline = secondPassHtml.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)
    const parsed = JSON.parse(inline![1]!)
    const webApp = parsed['@graph'].find((node: { '@type': string }) => node['@type'] === 'WebApplication')
    expect(webApp.url).toBe(secondSeo.canonicalUrl)
  })

  test('</head>もld+jsonのscriptも無いHTMLは変更されない（例外を投げない）', () => {
    // title/meta/canonicalなど、他のタグ置換の対象になりうるものを一切含まないHTMLで検証する
    // （それらのタグを含めると、JSON-LDとは無関係にそちらの置換で内容が変わってしまうため）。
    const html = '<html><body></body></html>'
    expect(() => applyPageSeoToHtml(html, seo)).not.toThrow()
    expect(applyPageSeoToHtml(html, seo)).toBe(html)
  })
})
