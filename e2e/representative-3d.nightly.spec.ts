import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('3Dレースを操作して退出し、新しいengineで再入場できる [circuit-racing]', async ({ page }) => {
  const errors = capturePageErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'サーキットレース', exact: true }).click()
  const begin = page.getByRole('button', { name: 'レースを はじめる', exact: true })
  // モデル・WebGL初期化を示す実際のready状態を待つ。経過秒や順位には依存しない。
  await expect(begin).toBeEnabled({ timeout: 15_000 })
  await begin.click()
  await page.getByRole('button', { name: 'みちばた', exact: true }).click()
  await expect(page.getByRole('button', { name: 'みちばた', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.getByRole('button', { name: /えらびなおす/ }).click()
  await page.locator('[data-game-back-button]').click()
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.getByRole('link', { name: 'サーキットレース', exact: true }).click()
  await expect(begin).toBeEnabled({ timeout: 15_000 })
  await begin.click()
  await expect(page.getByRole('region', { name: 'レースの そうさ', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('つくった車を走らせ、つくりかえ画面へ戻って入り直せる [car-builder]', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = capturePageErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: '3Dクルマづくり', exact: true }).click()
  await page.getByRole('button', { name: 'カラーを えらぶ', exact: true }).click()
  await page.getByRole('button', { name: 'みどり', exact: true }).click()
  await page.getByRole('button', { name: 'カテゴリ一覧へ もどる', exact: true }).click()
  await page.getByRole('button', { name: 'つくった くるまを はしらせる', exact: true }).click()

  // モデル・WebGL初期化を示す実際のready状態を待つ。周回数や経過秒には依存しない。
  const boost = page.getByRole('button', { name: /かそく/ })
  await expect(boost).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  const driving = await page.locator('canvas').screenshot()
  await expect.poll(
    async () => (await page.locator('canvas').screenshot()).equals(driving),
    { timeout: 30_000 },
  ).toBe(false)
  await boost.click()
  await page.getByRole('button', { name: /みちばた/ }).click()
  await expect(page.getByRole('button', { name: /みちばた/ })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: /ぜんたい/ }).click()
  await expect(page.getByRole('button', { name: /ぜんたい/ })).toHaveAttribute('aria-pressed', 'true')

  // つくりかえ画面へ戻ると、選んだ色を保ったまま3Dシーンは1つだけになる。
  await page.getByRole('button', { name: 'クルマづくりへ もどる', exact: true }).click()
  await expect(page.getByRole('application', { name: '3Dの くるま。ゆびで まわせるよ' })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.getByRole('button', { name: 'カラーを えらぶ', exact: true }).click()
  await expect(page.getByRole('button', { name: 'みどり', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'カテゴリ一覧へ もどる', exact: true }).click()

  await page.getByRole('button', { name: 'つくった くるまを はしらせる', exact: true }).click()
  await expect(page.getByRole('region', { name: 'はしらせる そうさ', exact: true })).toBeVisible()
  await expect(boost).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})

test('クレーンゲームでアームを動かして一巡し、描画予算を守る [crane-game]', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') })
  await page.goto('/')
  await page.getByRole('link', { name: 'クレーンゲーム', exact: true }).click()
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  await page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click()
  // 遊ばない初期台を待たず、選んだ台のWebGLとRapierのready状態を待つ。
  await expect(begin).toBeEnabled({ timeout: 20_000 })
  await begin.click()
  const scene = page.getByTestId('crane-scene')
  await expect.poll(() => scene.getAttribute('data-ready'), { timeout: 20_000 }).toBe('true')
  // 初期化後は観測する区間だけ全RAFを進める。遅いsoftware WebGLの背景描画で
  // 操作・読み取りが詰まらないようにし、物理・描画そのものは省略しない。
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'))
  const readAfterFrames = async (attribute: string) => {
    await page.clock.runFor(100)
    return scene.getAttribute(attribute)
  }
  const parked = await scene.getAttribute('data-claw-x')
  await page.getByRole('button', { name: 'よこに うごかす', exact: true }).click()
  await expect.poll(() => readAfterFrames('data-claw-x'), { intervals: [0] }).not.toBe(parked)
  await page.getByRole('button', { name: 'よこに うごくのを とめる', exact: true }).click()
  await page.getByRole('button', { name: 'つかむ', exact: true }).click()
  await expect.poll(() => readAfterFrames('data-phase'), { intervals: [0] }).not.toBe('idle')
  // 降ろす・つかむ・運ぶ・放すまで一巡し、穴の上へ戻ってくる。
  await expect.poll(() => readAfterFrames('data-phase'), { timeout: 30_000, intervals: [0] }).toBe('idle')
  expect(Number(await scene.getAttribute('data-claw-x'))).toBeCloseTo(-0.46, 2)
  await page.getByRole('button', { name: 'よこから みる', exact: true }).click()
  await expect.poll(() => readAfterFrames('data-view'), { intervals: [0] }).toBe('side')
  await expect(page.locator('canvas')).toHaveCount(1)
  const renderBudget = await scene.evaluate(element => ({
    calls: Number(element.getAttribute('data-draw-calls')),
    triangles: Number(element.getAttribute('data-triangles')),
  }))
  expect(renderBudget.calls).toBeLessThan(90)
  expect(renderBudget.triangles).toBeLessThan(120_000)
  await page.clock.resume()
  expect(errors).toEqual([])
})

test('クレーンゲームを実際の戻る操作で退出し、同じページで再入場できる [crane-game]', async ({ page }) => {
  // 長いアームの一巡・描画予算とは別の時間枠で、WebGLのcleanupと再初期化を確認する。
  // page.goto/reloadで分断するとリークを見逃すため、ホームへの退出から再入場まで同じpageを使う。
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await page.goto('/')
  const gameLink = page.getByRole('link', { name: 'クレーンゲーム', exact: true })
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  const scene = page.getByTestId('crane-scene')
  const backButton = page.locator('header [data-game-back-button]')
  const move = page.getByRole('button', { name: 'よこに うごかす', exact: true })

  await gameLink.click()
  await page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click()
  await expect(begin).toBeEnabled({ timeout: 20_000 })
  await begin.click()
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(move).toBeEnabled()
  const parked = await scene.getAttribute('data-claw-x')
  await move.click()
  await expect.poll(() => scene.getAttribute('data-claw-x')).not.toBe(parked)

  // 動作中のシーンから、ユーザーと同じclickで選択画面→ホームへ戻る。
  await backButton.click()
  await expect(begin).toBeVisible()
  await backButton.click()
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)

  await gameLink.click()
  await expect(begin).toBeEnabled({ timeout: 20_000 })
  await begin.click()
  await expect(page.getByRole('region', { name: 'クレーンの そうさ', exact: true })).toBeVisible()
  await expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  await expect(move).toBeEnabled()
  const restarted = await scene.getAttribute('data-claw-x')
  await move.click()
  await expect.poll(() => scene.getAttribute('data-claw-x')).not.toBe(restarted)
  expect(errors).toEqual([])
})
