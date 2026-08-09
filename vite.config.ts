/// <reference types="vitest/config" />
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
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'こどもミニゲーム',
        short_name: 'ミニゲーム',
        description: '子ども向けのミニゲーム集',
        lang: 'ja',
        display: 'standalone',
        theme_color: '#4C6EF5',
        background_color: '#FFFDF7',
        start_url: base,
        scope: base,
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
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
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
