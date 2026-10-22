import { describe, expect, test } from 'vitest'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'
import {
  LEGACY_BACK_BUTTON_GAME_SLUGS,
  LEGACY_BACK_BUTTON_PATHS,
  showsAppGameBackButton,
} from './appGameBackButton'

describe('showsAppGameBackButton', () => {
  test.each([
    // ヘッダーへ未移行の既存ゲームは、入口も深い画面も App の共通ボタンを使う。
    ['/games/flag-quiz', true],
    ['/games/flag-quiz/name-to-flag/easy/play', true],
    ['/games/math-quiz', true],
    ['/games/math-quiz/add/easy/result', true],
    ['/games/color-mix-quiz', true],
    ['/games/color-mix-quiz/play', true],
    ['/games/prefecture-quiz/puzzle/kanto/play', true],
    ['/games/world-travel-quiz/europe/flag/result', true],
    ['/games/flag-roll-adventure', true],
    ['/games/flag-roll-adventure/goal', true],
    ['/games/circuit-racing', true],
    // こっきピンボールは選択画面だけ自前のヘッダーへ置いている。
    ['/games/flag-pinball', false],
    ['/games/flag-pinball/play', true],
    ['/games/flag-pinball/result', true],
    // 自前のヘッダーへ置いたゲームは、複数画面あっても共通ボタンを重ねない。
    ['/games/house-builder', false],
    ['/games/tsumiki-bowling', false],
    ['/games/car-road-builder', false],
    ['/games/car-road-builder/play', false],
    ['/games/flag-roll-maze', false],
    ['/games/flag-roll-maze/play', false],
    // ルートは大文字・小文字を区別せずに一致するため、判定も同じにする。
    ['/games/Flag-Quiz', true],
    ['/games/Flag-Pinball', false],
    ['/games/Flag-Pinball/Play', true],
    ['/games/House-Builder', false],
    // ゲーム以外の画面。
    ['/', false],
    ['/games', false],
  ])('%s → %s', (pathname, expected) => {
    expect(showsAppGameBackButton(pathname)).toBe(expected)
  })
})

describe('ゲームカタログとの整合', () => {
  test('共通ボタンを使う既存画面は、カタログにあるゲームのものだけ', () => {
    const catalogSlugs = new Set(GAME_CATALOG.map((game) => game.slug))
    expect([...LEGACY_BACK_BUTTON_GAME_SLUGS].filter((slug) => !catalogSlugs.has(slug))).toEqual([])
    expect(
      [...LEGACY_BACK_BUTTON_PATHS].filter(
        (path) => !GAME_CATALOG.some((game) => path.startsWith(`${gameRoutePath(game.slug)}/`)),
      ),
    ).toEqual([])
  })

  test('カタログの各ゲームの入口では、未移行の既存ゲームだけが共通ボタンを使う', () => {
    const shown = GAME_CATALOG.filter((game) => showsAppGameBackButton(gameRoutePath(game.slug)))
    expect(shown.map((game) => game.slug)).toEqual(
      GAME_CATALOG.map((game) => game.slug).filter((slug) => LEGACY_BACK_BUTTON_GAME_SLUGS.has(slug)),
    )
  })
})
