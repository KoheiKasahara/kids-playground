import { useEffect } from 'react'
import GameRouteBoundary from './GameRouteBoundary'
import { useRoutes } from 'react-router-dom'
import { routes } from './routes'
import GameIntro from '../components/GameIntro'
import PwaStatus from '../pwa/PwaStatus'
import ScrollManager from './ScrollManager'
import SeoManager from '../seo/SeoManager'
import { installBrowserPageZoomSuppression } from './preventBrowserPageZoom'

export default function App() {
  const element = useRoutes(routes)

  // ブラウザのページピンチズームをサイト全体で止める（Issue #166）。
  // ゲーム機能としてのピンチ操作とは別系統のイベントを止めているだけなので、
  // 各ゲームのジェスチャー処理には影響しない（詳細はpreventBrowserPageZoom.tsのコメントを参照）。
  useEffect(() => installBrowserPageZoomSuppression(), [])

  return (
    <>
      <ScrollManager />
      <SeoManager />
      {/* ゲームと説明を同じSuspenseで待ち、説明だけを先行表示しない。 */}
      <GameRouteBoundary>
        {element}
        <GameIntro />
      </GameRouteBoundary>
      <PwaStatus />
    </>
  )
}
