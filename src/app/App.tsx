import { useRoutes } from 'react-router-dom'
import { routes } from './routes'
import GameIntro from '../components/GameIntro'
import PwaStatus from '../pwa/PwaStatus'
import ScrollManager from './ScrollManager'
import SeoManager from '../seo/SeoManager'

export default function App() {
  const element = useRoutes(routes)
  return (
    <>
      <ScrollManager />
      <SeoManager />
      {element}
      {/*
       * GameIntroはここ1箇所だけでマウントする（17個の各ゲームコンポーネントには手を入れない）。
       * 自分でゲームルートURLかどうかを判定して、該当しなければ何も描画しない
       * （詳細はsrc/components/GameIntro.tsxのコメントを参照）。
       */}
      <GameIntro />
      <PwaStatus />
    </>
  )
}
