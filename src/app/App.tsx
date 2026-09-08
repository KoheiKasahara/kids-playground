import { useEffect } from 'react'
import GameRouteBoundary from './GameRouteBoundary'
import { useLocation, useRoutes } from 'react-router-dom'
import { routes } from './routes'
import GameIntro from '../components/GameIntro'
import GameIntroProvider from '../components/GameIntroProvider'
import PwaStatus from '../pwa/PwaStatus'
import ScrollManager from './ScrollManager'
import SeoManager from '../seo/SeoManager'
import { installBrowserPageZoomSuppression } from './preventBrowserPageZoom'
import GameBackButton from '../components/GameBackButton'

const SELF_MANAGED_GAME_BACK_PATHS = new Set([
  '/games/draw-goal',
  '/games/animal-bath',
  '/games/bento-builder',
  '/games/block-puzzle',
  '/games/car-builder',
  '/games/car-road-builder',
  '/games/car-road-builder/play',
  '/games/color-paint-puzzle',
  '/games/domino-flag',
  '/games/flag-roll-maze',
  '/games/flag-roll-maze/play',
  '/games/koma-battle',
  '/games/magic-sandbox',
  '/games/piano-play',
  '/games/planet-globe',
  '/games/puni-slime',
  '/games/pukupuka-rescue',
  '/games/rail-builder',
  '/games/snowball-roll',
  '/games/tsumiki-bowling',
])

export default function App() {
  const element = useRoutes(routes)
  const { pathname } = useLocation()
  const normalizedPathname =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname

  // ブラウザのページピンチズームをサイト全体で止める（Issue #166）。
  // ゲーム機能としてのピンチ操作とは別系統のイベントを止めているだけなので、
  // 各ゲームのジェスチャー処理には影響しない（詳細はpreventBrowserPageZoom.tsのコメントを参照）。
  useEffect(() => installBrowserPageZoomSuppression(), [])

  return (
    <>
      <ScrollManager />
      <SeoManager />
      {/* 画面内状態をひとつ戻すゲームは、同じ共通部品へ onClick を渡して自前で表示する。 */}
      {normalizedPathname.startsWith('/games/') &&
        !SELF_MANAGED_GAME_BACK_PATHS.has(normalizedPathname) && <GameBackButton />}
      {/* ゲームと説明を同じSuspenseで待ち、説明だけを先行表示しない。 */}
      <GameRouteBoundary>
        <GameIntroProvider>
          {element}
          <GameIntro />
        </GameIntroProvider>
      </GameRouteBoundary>
      <PwaStatus />
    </>
  )
}
