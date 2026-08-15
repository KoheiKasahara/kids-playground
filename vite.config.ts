/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages ではリポジトリ名がパスに含まれるため、
// GITHUB_PAGES=true のときだけ base を '/kids-playground/' に切り替える。
const base = process.env.GITHUB_PAGES === 'true' ? '/kids-playground/' : '/'

export default defineConfig({
  base,
  plugins: [
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
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,ico,webmanifest}'],
        navigateFallback: `${base}index.html`,
        cleanupOutdatedCaches: true,
        clientsClaim: true,
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    alias: {
      'virtual:pwa-register/react': fileURLToPath(
        new URL('./src/test/pwaRegisterStub.ts', import.meta.url),
      ),
    },
  },
})
