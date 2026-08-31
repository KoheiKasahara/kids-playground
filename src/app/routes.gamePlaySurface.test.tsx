// GamePlaySurface（長押しメニュー・文字選択抑制、Issue #166）が
// 「実プレイ画面だけ」に適用され、開始画面・むずかしさ選択・結果画面・ホーム・リダイレクトには
// 適用されていないことを、routes配列の構造から機械的に検証する。
//
// earth-globe/planet-globe/rail-builderなどThree.js/Rapierを使う重いゲームを含む全ルートを
// 対象にできるよう、ここでは実際に描画(render)はせず、routes.tsxが組み立てたReact要素の
// 型(element.type)だけを見る。実際のDOM描画による検証は、下のrouting.test.tsxに合わせた
// 記述スタイルのdescribeブロックで代表ルートについて行う。
import { describe, expect, test } from 'vitest'
import { Navigate, type RouteObject } from 'react-router-dom'
import { routes } from './routes'
import GamePlaySurface from '../components/GamePlaySurface'

// 選択画面とプレイ画面が同一route内で切り替わるゲームは、routeでは包まずコンポーネント内で
// 条件付きに適用しているため、route構造の機械チェックからは除外し、専用テストに委ねる
// （FlagRollPuzzlePlay.test.tsx / DominoFlagPlay.test.tsx 側の状態別テストを参照）。
const CONDITIONALLY_WRAPPED_PATHS = new Set(['/games/domino-flag', '/games/flag-roll-puzzle'])

function elementType(element: RouteObject['element']): unknown {
  if (element === null || element === undefined || typeof element !== 'object') return undefined
  return (element as { type?: unknown }).type
}

// 実プレイ画面のURL（このIssueで包む対象）。「.../play」で終わるルートに加え、
// 単一routeでプレイまで完結するゲームを明示的に含める。
// ただし旧URL互換のNavigateリダイレクト（例: /games/flag-quiz/play → .../hard/play）は
// 「/play」で終わっていてもリダイレクトそのものであり実プレイ画面ではないため除外する。
function isPlayRoutePath(route: RouteObject & { path: string }): boolean {
  if (CONDITIONALLY_WRAPPED_PATHS.has(route.path)) return false
  if (elementType(route.element) === Navigate) return false
  if (route.path.endsWith('/play')) return true
  return ['/games/earth-globe', '/games/planet-globe', '/games/rail-builder', '/games/piano-play'].includes(route.path)
}

function elementTypeIsGamePlaySurface(element: RouteObject['element']): boolean {
  return elementType(element) === GamePlaySurface
}

describe('routes.tsx: GamePlaySurfaceの適用範囲(Issue #166)', () => {
  const pathedRoutes = routes.filter((route): route is RouteObject & { path: string } => typeof route.path === 'string')

  test('全ルートが少なくとも1つ以上存在する(前提の健全性チェック)', () => {
    expect(pathedRoutes.length).toBeGreaterThan(50)
  })

  test.each(pathedRoutes.filter((route) => isPlayRoutePath(route)))(
    '実プレイルート $path はGamePlaySurfaceで包まれている',
    (route) => {
      expect(elementTypeIsGamePlaySurface(route.element)).toBe(true)
    },
  )

  test.each(pathedRoutes.filter((route) => !isPlayRoutePath(route)))(
    'プレイ以外のルート $path はGamePlaySurfaceで包まれていない',
    (route) => {
      expect(elementTypeIsGamePlaySurface(route.element)).toBe(false)
    },
  )
})
