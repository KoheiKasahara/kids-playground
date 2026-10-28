import { expect, test } from '@playwright/test'
import { waitForOfflineReady, servePwaUpdateFixture } from './support/pwa'
import { capturePageErrors } from './support/runtimeErrors'
import { expectLiveApp } from './support/liveApp'

test('未訪問の3Dゲームをオフラインで開きGLBとWASMを使って遊べる', async ({ page, context }) => {
  test.setTimeout(120_000)
  const errors = capturePageErrors(page)
  await page.goto('/')
  await waitForOfflineReady(page)
  await context.setOffline(true)

  const model = page.waitForResponse(response => response.url().endsWith('.glb'))
  await page.goto('/games/circuit-racing')
  expect((await model).fromServiceWorker()).toBe(true)
  const start = page.getByRole('button', { name: 'レースを はじめる', exact: true })
  await expect(start).toBeEnabled()
  await start.click()
  await page.getByRole('button', { name: 'みちばた', exact: true }).click()
  await expect(page.getByRole('button', { name: 'みちばた', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('alert')).toHaveCount(0)

  const wasm = page.waitForResponse(response => response.url().endsWith('.wasm'))
  await page.goto('/games/tsumiki-3d')
  await page.getByRole('button', { name: '▶ あそぶ', exact: true }).click()
  const wasmResponse = await wasm
  expect(wasmResponse.ok()).toBe(true)
  expect(wasmResponse.fromServiceWorker()).toBe(true)
  await expect(page.getByText('つみきを ならべて いるよ…', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('alert')).toHaveCount(0)
  const mat = page.getByRole('application', { name: /^つみきの マット/ })
  await mat.press('Enter')
  await expect(page.getByLabel('つみき 1こ', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('未訪問の画像クイズとピアノ音源をオフラインで読み込める', async ({ page, context }) => {
  const errors = capturePageErrors(page)
  await page.goto('/')
  await waitForOfflineReady(page)
  await context.setOffline(true)
  await page.goto('/games/working-vehicle-quiz/photo-to-name/easy/play')
  await expectLiveApp(page)
  await expect.poll(() => page.locator('#root img').evaluateAll(images =>
    images.length > 0 && images.every(image => (image as HTMLImageElement).naturalWidth > 0),
  )).toBe(true)

  await page.setViewportSize({ width: 844, height: 390 })
  const sample = page.waitForResponse(response => /\/audio\/.*\.mp3$/.test(response.url()))
  await page.goto('/games/piano-play')
  const sampleResponse = await sample
  expect(sampleResponse.ok()).toBe(true)
  expect(sampleResponse.fromServiceWorker()).toBe(true)
  // 合成音へのフォールバックだけで成功にしない。保存済みMP3がデコード可能であることも確認する。
  expect(await page.evaluate(async url => {
    const audio = new AudioContext()
    try {
      const bytes = await (await fetch(url)).arrayBuffer()
      return (await audio.decodeAudioData(bytes)).duration
    } finally { await audio.close() }
  }, sampleResponse.url())).toBeGreaterThan(0)
  const key = page.getByRole('button', { name: 'ド C4', exact: true })
  await key.press('Enter')
  await expect(page.getByRole('region', { name: '自由演奏' })).toBeVisible()
  expect(errors).toEqual([])
})

test('実SWの更新はプレイの進行を保ち、ホームでの明示操作まで待機する', async ({ page }) => {
  const fixture = await servePwaUpdateFixture()
  try {
    const errors = capturePageErrors(page)
    await page.goto(fixture.url)
    await waitForOfflineReady(page)
    await page.getByRole('link', { name: 'しゃぼんだま パチン', exact: true }).click()
    await page.getByRole('button', { name: 'いろ おなじ いろを わろう', exact: true }).click()
    // 最初に現れる泡は必ずお題の泡。動くボタンなので安定待ちをせず実タッチを送る。
    const bubble = page.getByRole('button', { name: /の しゃぼんだま$/ }).first()
    await expect(bubble).toBeVisible()
    await bubble.tap({ force: true })
    const progress = page.getByLabel('1こ わった（ぜんぶで 10こ）', { exact: true })
    await expect(progress).toBeVisible()
    fixture.update()
    await page.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting?.state)).toBe('installed')
    await expect(page.getByRole('button', { name: 'こうしんする' })).toHaveCount(0)
    await expect(progress).toBeVisible()
    await page.locator('header [data-game-back-button]').click()
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
    const update = page.getByRole('button', { name: 'こうしんする', exact: true })
    await expect(update).toBeVisible()
    await Promise.all([page.waitForEvent('load'), update.click()])
    await expectLiveApp(page)
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
    await expect.poll(() => page.evaluate(async () => (await navigator.serviceWorker.ready).waiting === null)).toBe(true)
    expect(errors).toEqual([])
  } finally { await fixture.close() }
})

test('別タブが更新してもプレイを維持し、後から明示操作で最新画面へ切り替えられる', async ({ page, context }) => {
  const fixture = await servePwaUpdateFixture()
  const other = await context.newPage()
  try {
    const errors = capturePageErrors(page)
    await page.goto(fixture.url)
    await waitForOfflineReady(page)
    // SWが既存の再訪問ページ（ライブラリのisUpdate=true）も保護する。
    await page.reload()
    await page.bringToFront()
    await page.getByRole('link', { name: 'しゃぼんだま パチン', exact: true }).click()
    await page.getByRole('button', { name: 'いろ おなじ いろを わろう', exact: true }).click()
    const bubble = page.getByRole('button', { name: /の しゃぼんだま$/ }).first()
    await expect(bubble).toBeVisible()
    await bubble.tap({ force: true })
    const progress = page.getByLabel('1こ わった（ぜんぶで 10こ）', { exact: true })
    await expect(progress).toBeVisible()

    await other.goto(fixture.url)
    await waitForOfflineReady(other)
    fixture.update()
    await other.evaluate(async () => { await (await navigator.serviceWorker.ready).update() })
    const update = other.getByRole('button', { name: 'こうしんする', exact: true })
    await expect(update).toBeVisible()
    const switched = page.evaluate(() => new Promise<void>(resolve => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
    }))
    await Promise.all([switched, other.waitForEvent('load'), update.click()])
    await page.bringToFront()
    await expect(progress).toBeVisible()
    await expect(page).toHaveURL(/\/games\/shabon-pachin$/)
    await page.locator('header [data-game-back-button]').click()
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: 'こうしんする', exact: true }).click()])
    await expectLiveApp(page)
    expect(errors).toEqual([])
  } finally { await other.close(); await fixture.close() }
})
