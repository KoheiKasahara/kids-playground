import { describe, expect, test } from 'vitest'
import { matchRoutes } from 'react-router-dom'
import { GAME_CATALOG, findGameBySlug, gameRoutePath } from './gameCatalog'
import { routes } from '../app/routes'

describe('gameCatalog', () => {
  test('カタログは17件ある', () => {
    expect(GAME_CATALOG).toHaveLength(17)
  })

  test('slug がすべて一意（重複なし）', () => {
    const slugs = GAME_CATALOG.map((game) => game.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  test('slug がすべて小文字kebab-caseで id === slug', () => {
    const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/
    for (const game of GAME_CATALOG) {
      expect(game.slug).toMatch(kebabCase)
      expect(game.id).toBe(game.slug)
    }
  })

  test('findGameBySlug が正しく引ける', () => {
    expect(findGameBySlug('prefecture-quiz')).toEqual(
      expect.objectContaining({ id: 'prefecture-quiz', title: '都道府県クイズ' }),
    )
  })

  test('findGameBySlug は未知slugで undefined を返す', () => {
    expect(findGameBySlug('does-not-exist')).toBeUndefined()
  })

  test('全ゲームにrouteが存在する', () => {
    for (const game of GAME_CATALOG) {
      const pagePath = gameRoutePath(game.slug)
      const matches = matchRoutes(routes, pagePath)
      expect(matches).not.toBeNull()
      const lastMatch = matches![matches!.length - 1]
      // '*' の catch-all にフォールバックしていないことを確認する。
      expect(lastMatch.route.path).toBe(pagePath)
    }
  })

  // 逆方向の不変条件: routes.tsx に /games/<game-id> のエントリールートが追加されたのに
  // gameCatalog.ts への登録を忘れると、そのゲームは静的ページが生成されずGitHub Pagesで
  // 404になる（Issue #258が防ごうとしている失敗そのもの）が、他のテストは緑のままになる。
  // routes.tsx 側から見て、対応するカタログ登録が必ずあることを保証する。
  test('routesの各ゲームエントリー(/games/<game-id>)がgameCatalogに登録されている', () => {
    const gameEntryPathPattern = /^\/games\/[^/:*]+$/
    const gameEntryPaths = routes
      .map((route) => route.path)
      .filter((routePath): routePath is string => typeof routePath === 'string')
      .filter((routePath) => gameEntryPathPattern.test(routePath))

    expect(gameEntryPaths.length).toBeGreaterThan(0)

    for (const routePath of gameEntryPaths) {
      const slug = routePath.replace('/games/', '')
      expect(findGameBySlug(slug), `route ${routePath} に対応する gameCatalog エントリーがありません`).toBeDefined()
    }
  })
})
