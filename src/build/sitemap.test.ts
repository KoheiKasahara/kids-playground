// sitemap.xmlがcanonical URL（src/seo/pageSeo.ts）と食い違わないことを検証する。
// GAME_CATALOGを全件ループして検証することで、ゲームを追加したのに
// sitemapへの反映（＝pageSeo経由のURL取得）が漏れる事態を検知できるようにしている。

import { describe, expect, test } from 'vitest'
import { GAME_CATALOG } from '../games/gameCatalog'
import { HOME_SEO, buildGameSeo, resolvePageSeo } from '../seo/pageSeo'
import { SITE_ORIGIN } from '../seo/siteMeta'
import { buildSitemapXml, collectSitemapUrls } from './sitemap'

function extractLocs(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  return Array.from(doc.querySelectorAll('url > loc')).map((node) => node.textContent ?? '')
}

describe('buildSitemapXml / collectSitemapUrls', () => {
  test('妥当なXMLで、ルート要素がurlset（sitemaps.org 0.9 xmlns）である', () => {
    const xml = buildSitemapXml()
    const doc = new DOMParser().parseFromString(xml, 'application/xml')
    expect(doc.querySelector('parsererror')).toBeNull()
    expect(doc.documentElement.tagName).toBe('urlset')
    expect(doc.documentElement.getAttribute('xmlns')).toBe('http://www.sitemaps.org/schemas/sitemap/0.9')
  })

  test('トップURLを含む', () => {
    const locs = extractLocs(buildSitemapXml())
    expect(locs).toContain(HOME_SEO.canonicalUrl)
  })

  test('GAME_CATALOGの全ゲームについて、そのゲームのcanonicalUrlを含む（更新漏れ検知）', () => {
    const locs = extractLocs(buildSitemapXml())
    for (const entry of GAME_CATALOG) {
      expect(locs).toContain(buildGameSeo(entry).canonicalUrl)
    }
  })

  test('件数がGAME_CATALOG.length + 1（トップ）と一致し、重複が無い', () => {
    const locs = extractLocs(buildSitemapXml())
    expect(locs).toHaveLength(GAME_CATALOG.length + 1)
    expect(new Set(locs).size).toBe(locs.length)
  })

  test('各locはresolvePageSeoで解決したcanonicalUrlと完全一致する（sitemapに載るURLは必ずそのページのcanonical本人）', () => {
    const locs = extractLocs(buildSitemapXml())
    for (const loc of locs) {
      const pathname = new URL(loc).pathname
      expect(resolvePageSeo(pathname).canonicalUrl).toBe(loc)
    }
  })

  test('不要なURLが混入していない（http/www/#/.html/クエリ/末尾スラッシュ）', () => {
    const locs = extractLocs(buildSitemapXml())
    for (const loc of locs) {
      expect(loc.startsWith(`${SITE_ORIGIN}/`) || loc === `${SITE_ORIGIN}/`).toBe(true)
      expect(loc).not.toContain('#')
      expect(loc).not.toContain('.html')
      expect(loc).not.toContain('?')
      if (loc !== `${SITE_ORIGIN}/`) {
        expect(loc.endsWith('/')).toBe(false)
      }
    }
  })

  test('未知のslugは含まれない', () => {
    const locs = extractLocs(buildSitemapXml())
    expect(locs).not.toContain(`${SITE_ORIGIN}/games/does-not-exist`)
  })

  test('collectSitemapUrls()の結果がそのままbuildSitemapXmlの既定値として使われる', () => {
    expect(extractLocs(buildSitemapXml())).toEqual(collectSitemapUrls())
  })

  test('<loc>の値はXMLエスケープされる', () => {
    const xml = buildSitemapXml(['https://example.com/?a=1&b=2'])
    expect(xml).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>')
  })
})
