/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { staticRoutePages } from './src/build/staticRoutePages'
import { sitemapFile } from './src/build/sitemap'

// カスタムドメイン（https://kids.kasapg.com/）直下で公開するため base は常に '/'。
const base = '/'

const plugins = [
  react(),
  VitePWA({
    // 'autoUpdate' だと新しいSWが有効化された瞬間に自動で window.location.reload() が
    // 走ってしまい、クイズの途中でも進行が消えてしまう。
    // 'prompt' にして、更新は PwaStatus のトースト経由でユーザーが
    // 「こうしんする」を押したときだけ反映されるようにする。
    registerType: 'prompt',
    injectRegister: null,
    includeAssets: ['favicon.svg'],
    manifest: {
      id: base,
      name: 'こどもミニゲーム',
      short_name: 'ミニゲーム',
      description: '子ども向けのミニゲーム集',
      lang: 'ja',
      display: 'standalone',
      categories: ['games', 'education'],
      theme_color: '#4C6EF5',
      background_color: '#FFFDF7',
      start_url: base,
      scope: base,
      icons: [
        {
          src: 'icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: 'icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    workbox: {
      // Rapierのwasmはbase64でrapier.mjsへ埋め込まれており、約2.24MiBあります。
      // この構造上これ以上の圧縮が難しいため、理由を明示して3MiBへ引き上げます。
      maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,mp3,webmanifest}'],
      navigateFallback: `${base}index.html`,
      cleanupOutdatedCaches: true,
      clientsClaim: true,
    },
  }),
  // VitePWAのcloseBundleより後に実行し、ここで生成する複製ページがprecache対象に
  // 二重で含まれないようにする（ナビゲーションはSWのnavigateFallbackが担う）。
  staticRoutePages(),
  sitemapFile(),
]

// Vitest の `test.projects` は各要素が独立した設定として扱われ、ルートの
// plugins / setupFiles / alias / globals を自動継承しない。`extends: true` に
// 頼ると setupFiles 等が読み込まれず大量のテストが失敗する既知の問題があるため
// （Issue #434 調査で47ファイル失敗を確認済み）、ここで一元管理した値を
// 各 project へ明示的に渡す。
const testSetupFiles = ['./src/test/setup.ts']
const testAlias = {
  'virtual:pwa-register/react': fileURLToPath(new URL('./src/test/pwaRegisterStub.ts', import.meta.url)),
}

// document / window / canvas 等の DOM API に依存するため jsdom が必要な `.test.ts`。
// `.test.tsx` は原則 React Testing Library の render を使うため dom project 側に
// 含めるが、逆に `.test.ts` は原則 DOM 非依存なので、ここに明示したファイルだけ
// 例外的に dom project 側へ回す。
// 一覧は `npx vitest run --exclude "**/*.test.tsx" --environment=node` を実際に
// 実行し、失敗したファイルから機械的に洗い出したもの（Issue #434 Phase1で最新
// main に対して再検証済み）。
const domDependentTestTsFiles = [
  'src/app/preventBrowserPageZoom.test.ts',
  'src/build/sitemap.test.ts',
  'src/components/flag-ball/flagPanelBall.test.ts',
  'src/games/earth-globe/data/worldFeatures.test.ts',
  'src/games/earth-globe/three/rotationControls.test.ts',
  'src/games/earth-globe/useReducedMotion.test.ts',
  'src/games/flag-pinball/themeStore.test.ts',
  'src/games/flag-roll-puzzle/useBoardScale.test.ts',
  'src/games/piano-play/pianoAudio.test.ts',
  'src/games/planet-globe/three/overviewVisual.test.ts',
  'src/games/planet-globe/three/planetRing.test.ts',
  'src/games/planet-globe/three/planetSurface.test.ts',
  'src/games/planet-globe/three/sunVisual.test.ts',
  'src/seo/applyDocumentSeo.test.ts',
  'src/speech/speechEngine.test.ts',
  'src/speech/speechSettingsStore.test.ts',
  'src/utils/quizSound.test.ts',
]

// 逆に `.test.tsx` の中で、render を行わずロジック（純粋関数・route定義の形など）
// だけを検証していて DOM に触れないと確認できたファイル。node で実行する。
const domIndependentTestTsxFiles = [
  'src/app/routes.gamePlaySurface.test.tsx',
  'src/games/world-travel-quiz/map/WorldTravelMap.test.tsx',
]

// 長距離の物理シミュレーション等、1テストあたり数秒級の重いテスト。
// Phase 1 では通常CI（`npm test` / `test:quick` 以外の既存フロー）から外さず、
// 将来の Fast CI / Nightly 分離（Issue #434）に備えて分類だけ用意しておく。
// 分類基準: 1テストあたり2秒を超える完走シミュレーションのみを対象にし、
// 件数が多いだけの通常ユニットテスト（komaWorld.test.ts 等）は含めない。
const slowTestFiles = [
  'src/games/domino-flag/dominoChain.test.ts',
  'src/games/domino-flag/dominoBigChain.test.ts',
  'src/games/domino-flag/dominoLongChain.test.ts',
  'src/games/domino-flag/dominoSeesawChain.test.ts',
  'src/games/domino-flag/dominoBall.test.ts',
  'src/games/flag-roll-adventure/adventureSimulation.test.ts',
]

export default defineConfig({
  base,
  plugins,
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          environment: 'node',
          globals: true,
          setupFiles: testSetupFiles,
          alias: testAlias,
          include: ['src/**/*.test.ts', ...domIndependentTestTsxFiles],
          exclude: [...domDependentTestTsFiles, ...slowTestFiles],
        },
      },
      {
        plugins,
        test: {
          name: 'dom',
          environment: 'jsdom',
          globals: true,
          setupFiles: testSetupFiles,
          alias: testAlias,
          include: ['src/**/*.test.tsx', ...domDependentTestTsFiles],
          exclude: domIndependentTestTsxFiles,
        },
      },
      {
        plugins,
        test: {
          name: 'slow',
          environment: 'node',
          globals: true,
          setupFiles: testSetupFiles,
          alias: testAlias,
          include: slowTestFiles,
        },
      },
    ],
  },
})
