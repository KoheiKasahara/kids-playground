import { Suspense, useEffect } from 'react'
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
      {/*
       * ゲーム本体（element、一部はroutes.tsxでReact.lazy）とGameIntroを同じSuspense境界に
       * 同居させる（Issue #298）。lazyルートのチャンクが未解決の間はこの境界ごとfallback={null}
       * になるため、GameIntroだけが先に描画されてゲーム本体が存在しない中間状態が起きない。
       * チャンク解決後は両方が同一コミットで一緒に現れ、従来どおりゲーム下部にGameIntroが並ぶ。
       *
       * GameIntroはここ1箇所だけでマウントする（17個の各ゲームコンポーネントには手を入れない）。
       * 自分でゲームルートURLかどうかを判定して、該当しなければ何も描画しない
       * （詳細はsrc/components/GameIntro.tsxのコメントを参照）。静的importのルート（Suspenseが
       * 実際にサスペンドしない）では、このSuspenseは何もしないラッパーとして振る舞う。
       */}
      <Suspense fallback={null}>
        {element}
        <GameIntro />
      </Suspense>
      <PwaStatus />
    </>
  )
}
