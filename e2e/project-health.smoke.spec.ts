import { expect, test } from '@playwright/test'
import { GAME_CATALOG } from '../src/games/gameCatalog'

function history() {
  const now = new Date()
  return { updatedAt: now.toISOString(), entries: [{
    date: now.toISOString().slice(0, 10), recordedAt: now.toISOString(),
    games: GAME_CATALOG.length, unitTests: 6050, unitTestsPassed: 6050,
    e2eSmokePassed: 250, e2eSmokeTotal: 250, e2eSmokeFlaky: 0, e2eSmokeSkipped: 0,
    bundleKb: 8260, initialJsGzipKb: 132.5, initialCssGzipKb: 5.8, precacheKb: 15000, precacheEntries: 380,
    lighthousePerformance: 88, accessibility: 100, vulnerabilities: 0,
    vulnerabilitiesCritical: 0, vulnerabilitiesHigh: 0, vulnerabilitiesModerate: 0, vulnerabilitiesLow: 0, vulnerabilitiesInfo: 0,
    nightly: 'success', deploy: 'success',
  }] }
}

for (const width of [390, 1280]) {
  test(`健康状態を日本語で表示し画面幅${width}pxに収める`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    await page.route('**/project-health/history.json', (route) => route.fulfill({ json: history() }))
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/project-health/')
    await expect(page).toHaveTitle('プロジェクトの健康状態 | Kids Playground')
    await expect(page.getByRole('heading', { name: 'プロジェクトの健康状態' })).toBeVisible()
    await expect(page.getByText('確認が必要です', { exact: true })).toBeVisible()
    await expect(page.getByRole('article', { name: '依存関係の脆弱性' })).toContainText('0件')
    await expect(page.getByRole('article', { name: '単体・画面テスト' })).toContainText('6050 / 6050')
    await expect(page.getByRole('article', { name: '初期読込のJS' })).toContainText('132.5 KB')
    const catalog = page.getByRole('region', { name: '公開中のアプリ' })
    await expect(catalog.getByText(String(GAME_CATALOG.length), { exact: true })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `test-results/project-health-${width}.png`, fullPage: true })
    expect(errors).toEqual([])
  })
}

test('本番の旧形式の履歴は互換表示し、新しい計測値をゼロとして表示しない', async ({ page }) => {
  const old = history()
  const { date, recordedAt, games, unitTests, bundleKb, vulnerabilities, nightly, deploy } = old.entries[0]
  await page.route('**/project-health/history.json', (route) => route.fulfill({ json: {
    entries: [{ date, recordedAt, games, unitTests, bundleKb, vulnerabilities, nightly, deploy }],
  } }))
  await page.goto('/project-health/')
  await expect(page.getByText('判定に必要なデータが不足しています')).toBeVisible()
  await expect(page.getByRole('article', { name: '初期読込のJS' })).toContainText('未計測')
  await expect(page.getByRole('article', { name: '単体・画面テスト' })).toContainText('? / 6050')
})

test('履歴取得エラーでもアプリ構成と再読み込みの案内を表示する', async ({ page }) => {
  await page.route('**/project-health/history.json', (route) => route.fulfill({ status: 503 }))
  await page.goto('/project-health/')
  await expect(page.getByRole('alert')).toContainText('計測データを取得できませんでした')
  await expect(page.getByRole('button', { name: '再読み込み' })).toBeVisible()
  await expect(page.getByRole('region', { name: '公開中のアプリ' })).toBeVisible()
})
