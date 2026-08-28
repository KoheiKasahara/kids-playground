import { describe, expect, test } from 'vitest'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import { HOME_SEO, buildGameSeo, resolvePageSeo } from './pageSeo'
import { SITE_NAME, SITE_ORIGIN } from './siteMeta'

describe('resolvePageSeo（ゲームごと）', () => {
  test.each(GAME_CATALOG)('$slug のcanonicalUrlがゲームルートへ正規化される', (game) => {
    const seo = resolvePageSeo(gameRoutePath(game.slug))
    expect(seo.canonicalUrl).toBe(`${SITE_ORIGIN}/games/${game.slug}`)
  })

  test.each(GAME_CATALOG)('$slug のtitleがサイト名で終わる', (game) => {
    const seo = resolvePageSeo(gameRoutePath(game.slug))
    expect(seo.title.endsWith(` - ${SITE_NAME}`)).toBe(true)
  })

  test.each(GAME_CATALOG)('$slug のtitleにゲームのtitleが含まれる', (game) => {
    const seo = resolvePageSeo(gameRoutePath(game.slug))
    expect(seo.title).toContain(game.title)
  })

  test.each(GAME_CATALOG)('$slug のdescriptionが40〜120文字', (game) => {
    const seo = resolvePageSeo(gameRoutePath(game.slug))
    expect(seo.description.length).toBeGreaterThanOrEqual(40)
    expect(seo.description.length).toBeLessThanOrEqual(120)
  })
})

describe('文言の重複チェック', () => {
  test('全ゲームのtitleが互いに重複しない', () => {
    const titles = GAME_CATALOG.map((game) => buildGameSeo(game).title)
    expect(new Set(titles).size).toBe(titles.length)
  })

  test('全ゲームのdescriptionが互いに重複しない', () => {
    const descriptions = GAME_CATALOG.map((game) => buildGameSeo(game).description)
    expect(new Set(descriptions).size).toBe(descriptions.length)
  })
})

describe('網羅性', () => {
  test('GAME_CATALOGの件数とSEO定義を持つ件数が一致する', () => {
    const withSeo = GAME_CATALOG.filter((game) => game.seo.headline !== '' && game.seo.description !== '')
    expect(withSeo).toHaveLength(GAME_CATALOG.length)
  })
})

describe('resolvePageSeo（サブパス・末尾スラッシュ）', () => {
  test('むずかしさ選択・プレイ・結果などのサブパスはゲームルートのSEOへ解決される', () => {
    const gameRoot = resolvePageSeo('/games/planet-globe')
    expect(resolvePageSeo('/games/planet-globe/play')).toEqual(gameRoot)
  })

  test('さんすうクイズの深いサブパス（/add/hard/play）もゲームルートのSEOへ解決される', () => {
    const gameRoot = resolvePageSeo('/games/math-quiz')
    expect(resolvePageSeo('/games/math-quiz/add/hard/play')).toEqual(gameRoot)
  })

  test('末尾スラッシュがあっても同じ結果になる', () => {
    expect(resolvePageSeo('/games/rail-builder/')).toEqual(resolvePageSeo('/games/rail-builder'))
  })
})

describe('resolvePageSeo（未知パス・トップ）', () => {
  test('未知のゲームslugはHOME_SEOへ解決される', () => {
    expect(resolvePageSeo('/games/does-not-exist')).toEqual(HOME_SEO)
  })

  test('games配下にすら一致しない未知パスはHOME_SEOへ解決される', () => {
    expect(resolvePageSeo('/nope')).toEqual(HOME_SEO)
  })

  test('/ はHOME_SEOへ解決される', () => {
    expect(resolvePageSeo('/')).toEqual(HOME_SEO)
  })

  test('HOME_SEOのcanonicalUrlはサイトのトップURL', () => {
    expect(HOME_SEO.canonicalUrl).toBe('https://kids.kasapg.com/')
  })
})
