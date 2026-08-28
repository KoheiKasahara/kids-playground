import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './app/App'
import { redirectLegacyHashUrl } from './app/legacyHashRedirect'
import './styles/global.css'

// ゲームごとに固有URL(/games/<game-id>)を持たせ、検索エンジンにインデックスさせるため
// BrowserRouterを使う。GitHub Pagesは静的ホスティングでサーバー側ルーティングを持たないが、
// ビルド時にゲームごとの静的HTML（src/build/staticRoutePages.ts）と404.htmlフォールバックを
// 生成することで、直接アクセスやリロードが404にならないようにしている。
// 旧HashRouter時代のブックマーク（#/games/...）はredirectLegacyHashUrlでパス型URLへ書き換える。
redirectLegacyHashUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
