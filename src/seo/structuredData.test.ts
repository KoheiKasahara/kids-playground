// buildHomeStructuredData / buildGameStructuredData / serializeJsonLd を検証する。
// ここで守りたいのは「捏造データを絶対に混ぜない」「</script>で埋め込みが壊れない」
// 「ページごとに正しいグラフに切り替わる」の3点。

import { describe, expect, test } from 'vitest'
import { GAME_CATALOG, GAME_CATEGORIES } from '../games/gameCatalog'
import { buildGameSeo, HOME_SEO } from './pageSeo'
import { SITE_NAME } from './siteMeta'
import {
  buildGameStructuredData,
  buildHomeStructuredData,
  serializeJsonLd,
  WEBSITE_NODE_ID,
  type JsonLdNode,
} from './structuredData'

/** グラフのすべてのノードを再帰的に歩き、末端の値が「壊れた値」でないことを確認するためのヘルパー。 */
function collectLeafValues(value: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(value)) {
    for (const item of value) collectLeafValues(item, out)
    return out
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) collectLeafValues(v, out)
    return out
  }
  out.push(value)
  return out
}

describe('serializeJsonLd', () => {
  test('ホームのグラフはJSON.parseできる', () => {
    const json = serializeJsonLd(buildHomeStructuredData())
    expect(() => JSON.parse(json)).not.toThrow()
  })

  test.each(GAME_CATALOG)('$slug のグラフはJSON.parseできる', (entry) => {
    const seo = buildGameSeo(entry)
    const json = serializeJsonLd(seo.jsonLd)
    expect(() => JSON.parse(json)).not.toThrow()
  })

  test('出力に生の < > & が含まれない（</script>による埋め込み崩壊を防ぐ）', () => {
    for (const entry of GAME_CATALOG) {
      const json = serializeJsonLd(buildGameSeo(entry).jsonLd)
      expect(json).not.toMatch(/[<>&]/)
    }
    const homeJson = serializeJsonLd(buildHomeStructuredData())
    expect(homeJson).not.toMatch(/[<>&]/)
  })
})

describe('buildHomeStructuredData', () => {
  test('WebSiteノード1つだけを持つ', () => {
    const doc = buildHomeStructuredData()
    expect(doc['@graph']).toHaveLength(1)
    const [website] = doc['@graph']
    expect(website?.['@type']).toBe('WebSite')
    expect(website?.url).toBe(HOME_SEO.canonicalUrl)
    expect(website?.name).toBe(SITE_NAME)
    expect(website?.description).toBe(HOME_SEO.description)
    expect(website?.['@id']).toBe(WEBSITE_NODE_ID)
  })

  test('SearchAction（potentialAction）を持たない', () => {
    const [website] = buildHomeStructuredData()['@graph']
    expect(website).not.toHaveProperty('potentialAction')
  })
})

describe('buildGameStructuredData', () => {
  test('pageSeo経由ではなく直接呼んでも同じ形のグラフを組み立てられる', () => {
    const entry = GAME_CATALOG[0]!
    const urls = { url: 'https://kids.kasapg.com/games/flag-quiz', imageUrl: 'https://kids.kasapg.com/icons/icon-512.png' }
    const doc = buildGameStructuredData(entry, urls)
    expect(doc['@graph']).toHaveLength(3)
    const webApp = doc['@graph'][1] as JsonLdNode
    expect(webApp.url).toBe(urls.url)
    expect(webApp.image).toBe(urls.imageUrl)
  })

  test.each(GAME_CATALOG)('$slug: WebSite / WebApplication / BreadcrumbList の順で3ノード', (entry) => {
    const seo = buildGameSeo(entry)
    const graph = seo.jsonLd['@graph']
    expect(graph).toHaveLength(3)
    expect(graph[0]?.['@type']).toBe('WebSite')
    expect(graph[1]?.['@type']).toBe('WebApplication')
    expect(graph[2]?.['@type']).toBe('BreadcrumbList')
  })

  test.each(GAME_CATALOG)('$slug: WebApplicationノードの内容がPageSeo/カタログと一致する', (entry) => {
    const seo = buildGameSeo(entry)
    const webApp = seo.jsonLd['@graph'][1] as JsonLdNode
    expect(webApp.url).toBe(seo.canonicalUrl)
    expect(webApp.name).toBe(entry.title)
    expect(webApp.description).toBe(entry.seo.description)
    expect(webApp.description).toBe(seo.description)
    expect(webApp.image).toBe(seo.ogImageUrl)
    expect(webApp.applicationCategory).toBe(GAME_CATEGORIES[entry.category].applicationCategory)
    expect(webApp.isPartOf).toEqual({ '@id': WEBSITE_NODE_ID })
    expect(webApp.isAccessibleForFree).toBe(true)
    expect(webApp.operatingSystem).toBe('Any')
    expect(webApp.browserRequirements).toBe('Requires JavaScript')
    expect(webApp.inLanguage).toBe('ja')
  })

  test.each(GAME_CATALOG)('$slug: 評価・価格・作者などの捏造しうる項目を一切持たない', (entry) => {
    const webApp = buildGameSeo(entry).jsonLd['@graph'][1] as JsonLdNode
    for (const forbiddenKey of ['aggregateRating', 'review', 'offers', 'author', 'publisher', 'datePublished']) {
      expect(webApp).not.toHaveProperty(forbiddenKey)
    }
  })

  test.each(GAME_CATALOG)('$slug: BreadcrumbListは2階層（ホーム→ゲーム）', (entry) => {
    const seo = buildGameSeo(entry)
    const breadcrumb = seo.jsonLd['@graph'][2] as JsonLdNode
    const items = breadcrumb.itemListElement as JsonLdNode[]
    expect(items).toHaveLength(2)
    expect(items[0]).toEqual({ '@type': 'ListItem', position: 1, name: SITE_NAME, item: HOME_SEO.canonicalUrl })
    expect(items[1]).toEqual({ '@type': 'ListItem', position: 2, name: entry.title, item: seo.canonicalUrl })
  })

  test.each(GAME_CATALOG)('$slug: グラフ内で @id が重複しない', (entry) => {
    const graph = buildGameSeo(entry).jsonLd['@graph']
    const ids = graph.map((node) => node['@id']).filter((id): id is string => typeof id === 'string')
    expect(new Set(ids).size).toBe(ids.length)
  })

  test.each(GAME_CATALOG)('$slug: グラフ内のどのノードにも undefined/null/空文字が現れない', (entry) => {
    const graph = buildGameSeo(entry).jsonLd['@graph']
    for (const value of collectLeafValues(graph)) {
      expect(value).not.toBeUndefined()
      expect(value).not.toBeNull()
      if (typeof value === 'string') {
        expect(value.length).toBeGreaterThan(0)
      } else {
        expect(['number', 'boolean'].includes(typeof value)).toBe(true)
      }
    }
  })

  test('ホームのグラフにもundefined/null/空文字が現れない', () => {
    for (const value of collectLeafValues(buildHomeStructuredData()['@graph'])) {
      expect(value).not.toBeUndefined()
      expect(value).not.toBeNull()
      if (typeof value === 'string') {
        expect(value.length).toBeGreaterThan(0)
      } else {
        expect(['number', 'boolean'].includes(typeof value)).toBe(true)
      }
    }
  })

  test('異なるゲームは異なる @id / name / url / description を持つ（ページ切り替わりの確認）', () => {
    const planetGlobe = GAME_CATALOG.find((entry) => entry.slug === 'planet-globe')
    const railBuilder = GAME_CATALOG.find((entry) => entry.slug === 'rail-builder')
    expect(planetGlobe).toBeDefined()
    expect(railBuilder).toBeDefined()

    const a = buildGameSeo(planetGlobe!).jsonLd['@graph'][1] as JsonLdNode
    const b = buildGameSeo(railBuilder!).jsonLd['@graph'][1] as JsonLdNode

    expect(a['@id']).not.toBe(b['@id'])
    expect(a.name).not.toBe(b.name)
    expect(a.url).not.toBe(b.url)
    expect(a.description).not.toBe(b.description)
  })
})
