import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('車を選んで走行・加速・カメラ変更・選び直しができる', async ({ page }) => {
  const errors = capturePageErrors(page)
  await page.goto('/games/circuit-racing')
  await expect(page.getByRole('heading', { name: 'サーキットレース', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '3だい', exact: true }).click()
  const thirdCar = page.getByRole('region', { name: '3だいめの くるま', exact: true })
  await thirdCar.getByRole('button', { name: 'スポーツカーを えらぶ', exact: true }).click()
  await thirdCar.getByRole('button', { name: 'きいろ', exact: true }).click()
  await expect(page.getByText('くるまを よみこんでいるよ', { exact: true })).toBeHidden()
  await expect(page.getByRole('alert')).toHaveCount(0)
  await page.getByRole('button', { name: 'レースを はじめる', exact: true }).click()
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveCount(1)
  const moving = await canvas.screenshot()
  await expect.poll(async () => (await canvas.screenshot()).equals(moving)).toBe(false)
  await page.getByRole('button', { name: '3だいめ', exact: true }).click()
  await page.getByRole('button', { name: '3だいめを かそく', exact: true }).click()
  await expect(page.getByRole('button', { name: '3だいめを かそく', exact: true })).toHaveAttribute('data-active', 'true')
  const boosted = await canvas.screenshot()
  await expect.poll(async () => (await canvas.screenshot()).equals(boosted)).toBe(false)
  await expect(page.getByRole('button', { name: 'やすむ', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'みちばた', exact: true }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(boosted)).toBe(false)
  await page.getByRole('button', { name: 'じゆうに みる', exact: true }).click()
  const free = await canvas.screenshot()
  await page.getByRole('button', { name: 'カメラを ちかく', exact: true }).click()
  await expect.poll(async () => (await canvas.screenshot()).equals(free)).toBe(false)
  await page.getByRole('button', { name: /えらびなおす/ }).click()
  await expect(thirdCar.getByRole('button', { name: 'きいろ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(thirdCar.getByRole('button', { name: 'スポーツカーを えらぶ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(errors).toEqual([])
})

test('モデル取得失敗から再試行で復帰できる', async ({ page }) => {
  await page.route('**/models/car-builder/sports-car.glb', route => route.fulfill({ status: 503, body: 'unavailable' }))
  await page.goto('/games/circuit-racing')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeDisabled()
  await page.unroute('**/models/car-builder/sports-car.glb')
  await page.getByRole('button', { name: 'もういちど', exact: true }).click()
  await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeEnabled()
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('WebGL初期化失敗後もレンダラーを作り直せる', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(window, '__restoreRaceContext', {
      value: () => { HTMLCanvasElement.prototype.getContext = original },
    })
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('/games/circuit-racing')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => {
    (window as unknown as { __restoreRaceContext: () => void }).__restoreRaceContext()
  })
  await page.getByRole('button', { name: 'もういちど', exact: true }).click()
  await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeEnabled()
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('全コースの描画を切り替え、WebGL復帰後も走れる', async ({ page }) => {
  const errors = capturePageErrors(page)
  // Shader compile failures can leave only part of the scene blank without a pageerror.
  page.on('console', message => {
    if (message.type() === 'error' && /THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) {
      errors.push(message.text())
    }
  })
  await page.goto('/games/circuit-racing')
  await page.getByRole('button', { name: '3だい', exact: true }).click()
  for (const course of ['くねくねカーブ', 'びゅんびゅんオーバル', 'ぐるっとヘアピン', 'シティコース', 'うみぞいコース', 'みんなのサーキット']) {
    await page.getByRole('button', { name: course, exact: true }).click()
    await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeEnabled()
    await expect(page.locator('canvas')).toHaveCount(1)
    await expect(page.getByRole('alert')).toHaveCount(0)
  }
  await page.getByRole('button', { name: '2だい', exact: true }).click()
  await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeEnabled()
  await page.evaluate(() => {
    const extension = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    Object.defineProperty(window, '__restoreLiveRaceContext', { value: () => extension.restoreContext() })
    extension.loseContext()
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __restoreLiveRaceContext: () => void }).__restoreLiveRaceContext())
  await expect(page.getByRole('button', { name: 'レースを はじめる', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: 'レースを はじめる', exact: true }).click()
  const canvas = page.locator('canvas')
  const first = await canvas.screenshot()
  await expect.poll(async () => (await canvas.screenshot()).equals(first)).toBe(false)
  expect(errors).toEqual([])
})
