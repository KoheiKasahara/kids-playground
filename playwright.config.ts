import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  // 3D/WebGL の初期化は共有 CI の負荷で大きく揺れるため、既定の 30 秒に
  // 成否を寄せない。各 assertion も Playwright 既定の 5 秒より余裕を持たせる。
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium-mobile',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
