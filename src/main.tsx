import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './app/App'
import './styles/global.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* GitHub Pages は静的ホスティングでサーバー側ルーティングが無いため HashRouter を使う */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
