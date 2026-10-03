import { useEffect, useLayoutEffect } from 'react'
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
import { findGameIdByPathname, recordRecentGameVisit } from '../pages/gameShelfStore'
import { setActiveSoundGame } from '../audio/sound'

const SELF_MANAGED_GAME_BACK_PATHS = new Set([
  '/games/forest-delivery',
  '/games/draw-goal',
  '/games/animal-bath',
  '/games/bento-builder',
  '/games/block-puzzle',
  '/games/car-builder',
  '/games/car-road-builder',
  '/games/car-road-builder/play',
  '/games/color-paint-puzzle',
  '/games/crane-game',
  '/games/domino-flag',
  '/games/dot-adventure',
  '/games/dot-zoo',
  '/games/dot-aquarium',
  '/games/dot-run',
  '/games/jishaku-pitatto',
  '/games/pixel-kart',
  '/games/tsumiki-3d',
  '/games/flag-pinball',
  '/games/flag-roll-maze',
  '/games/flag-roll-maze/play',
  '/games/flag-roll-puzzle',
  '/games/hoshi-tsunagi',
  '/games/koma-battle',
  '/games/magic-sandbox',
  '/games/marble-course',
  '/games/mato-ate',
  '/games/oekaki-korokoro',
  '/games/onaji-pon',
  '/games/origami-play',
  '/games/piano-play',
  '/games/planet-globe',
  '/games/puni-slime',
  '/games/rhythm-pon',
  '/games/pukupuka-rescue',
  '/games/putter-golf',
  '/games/pyoko-touch',
  '/games/rail-builder',
  '/games/robo-kuzushi',
  '/games/snowball-roll',
  '/games/shabon-pachin',
  '/games/shinkeisuijaku',
  '/games/water-wheel-maze',
  '/games/treasure-dig',
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

  // 遊んでいるゲームの音量補正を共通の出口へ反映する（どのゲームも同じくらいの大きさにそろえる）。
  // 子の画面がマウント時の useEffect で鳴らす音にも間に合うよう、layout effect で先に切り替える。
  useLayoutEffect(() => setActiveSoundGame(findGameIdByPathname(normalizedPathname)), [normalizedPathname])

  // ゲームのURLを開いたら、ホームの「さいきん あそんだ」の先頭へ置く（Issue #598）。
  useEffect(() => recordRecentGameVisit(normalizedPathname), [normalizedPathname])

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
      <PwaStatus pathname={normalizedPathname} />
    </>
  )
}
