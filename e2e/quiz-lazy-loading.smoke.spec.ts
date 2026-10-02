import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

const playPaths = [
  '/games/flag-quiz/flag-to-name/easy/play',
  '/games/flag-quiz/panel-flag/easy/play',
  '/games/working-vehicle-quiz/photo-to-name/easy/play',
  '/games/prefecture-quiz/shape-to-name/play',
  '/games/prefecture-quiz/puzzle/kanto/play',
]

test.describe('クイズの遅延読み込み', () => {
  test.use({ serviceWorkers: 'block' })

  test('ホームの初期表示ではゲームのプレイ用チャンクを取得しない', async ({ page }) => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
    expect(requests.filter((url) => /\/assets\/(FlagQuizPlay|PanelFlagQuizPlay|WorkingVehicleQuizPlay|PrefectureQuizPlay|PrefecturePuzzlePlay)-/.test(url))).toEqual([])
  })

  for (const path of playPaths) {
    test(`直接アクセスでプレイ画面を表示できる: ${path}`, async ({ page }) => {
      const errors = capturePageErrors(page)
      await page.goto(path)
      await expect(page).toHaveURL(path)
      await expect(page.getByRole('main')).toBeVisible()
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
      await expect(page.getByText('よみこみちゅう…', { exact: true })).toHaveCount(0)
      expect(errors).toEqual([])
    })
  }
})

test('保存済みのクイズは遅延読み込み後もオフラインで開ける', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }))
    }
  })
  await context.setOffline(true)
  for (const path of playPaths) {
    await page.goto(path)
    await expect(page).toHaveURL(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  }
})
