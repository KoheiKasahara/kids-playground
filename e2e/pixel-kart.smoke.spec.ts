import { expect, test, type Locator, type Page } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

const COURSE_NAMES = ['はなさく もり', 'ゆうやけ ビーチ', 'きらめく どうくつ', 'ほしぞらの おしろ'] as const
const STICK_NAME = 'ハンドル（左右の矢印キーでも操作）'

async function startRace(page: Page, course: string = COURSE_NAMES[0]) {
  await page.getByRole('button', { name: `${course}で あそぶ`, exact: true }).click()
  const race = page.getByRole('region', { name: `${course}の レース`, exact: true })
  await expect(race).toHaveAttribute('data-phase', 'racing')
  await expect.poll(async () => Number(await race.getAttribute('data-distance'))).toBeGreaterThan(20)
  return race
}

async function expectInsideViewport(locator: Locator, page: Page) {
  await expect(locator).toBeVisible()
  const box = await locator.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1)
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport!.height + 1)
}

test.describe('ドットカートのデスクトップ操作', () => {
  test.use({ viewport: { width: 1280, height: 720 }, isMobile: false, hasTouch: false })

  test('自動で走り、矢印・A/D・スペースで操作でき、一時停止でハンドルを離す', async ({ page }) => {
    const errors = capturePageErrors(page)
    await page.goto('/games/pixel-kart')
    const race = await startRace(page)
    const stick = page.getByRole('slider', { name: STICK_NAME })
    await expectInsideViewport(stick, page)
    await expect(page.getByRole('heading', { name: 'このゲームについて' })).toHaveCount(0)

    await page.keyboard.down('ArrowRight')
    await expect.poll(async () => Number(await race.getAttribute('data-lane'))).toBeGreaterThan(35)
    await page.getByRole('button', { name: 'ひとやすみ', exact: true }).click()
    const pause = page.getByRole('dialog', { name: 'ひとやすみ', exact: true })
    await expect(pause).toBeVisible()
    // The HUD is sampled every 80 ms. Observe two samples before checking a stopped race.
    await page.waitForTimeout(180)
    const pausedDistance = await race.getAttribute('data-distance')
    const pausedLane = Number(await race.getAttribute('data-lane'))
    await page.waitForTimeout(400)
    await expect(race).toHaveAttribute('data-distance', pausedDistance!)
    await page.getByRole('button', { name: '▶ つづける', exact: true }).click()
    await expect(pause).toHaveCount(0)
    // ArrowRight remains physically held: resuming must clear the old key-down input.
    await expect.poll(async () => Number(await race.getAttribute('data-lane'))).toBeLessThan(pausedLane - 12)
    await page.keyboard.up('ArrowRight')
    await page.keyboard.down('d')
    await expect.poll(async () => Number(await race.getAttribute('data-lane'))).toBeGreaterThan(35)
    await page.keyboard.up('d')
    await page.keyboard.down('a')
    await expect.poll(async () => Number(await race.getAttribute('data-lane'))).toBeLessThan(-20)
    await page.keyboard.up('a')

    const item = page.getByRole('button', { name: /を つかう$/ })
    await expect(item).toBeEnabled()
    await stick.focus()
    await page.keyboard.press('Space')
    await expect(page.getByRole('button', { name: 'アイテムを まってね', exact: true })).toBeDisabled()
    expect(errors).toEqual([])
  })

  test('初期オンの補助・音設定を切り替えると再読込後も保存される', async ({ page }) => {
    const errors = capturePageErrors(page)
    await page.goto('/games/pixel-kart')
    await page.getByRole('button', { name: /せってい/ }).click()
    const assist = page.getByRole('switch', { name: /^みちから はみださない/ })
    const sound = page.getByRole('switch', { name: /^おんがくと おと/ })
    await expect(assist).toBeChecked()
    await expect(sound).toBeChecked()
    await assist.click()
    await sound.click()
    await expect(assist).not.toBeChecked()
    await expect(sound).not.toBeChecked()
    await page.reload()
    await page.getByRole('button', { name: /せってい/ }).click()
    await expect(assist).not.toBeChecked()
    await expect(sound).not.toBeChecked()
    await assist.click()
    await page.getByRole('button', { name: 'これで あそぶ', exact: true }).click()
    await startRace(page)
    await page.getByRole('button', { name: 'ひとやすみ', exact: true }).click()
    await expect(assist).toBeChecked()
    await expect(sound).not.toBeChecked()
    expect(errors).toEqual([])
  })

  test('4つのコースを選んで走り、戻って別のコースを始められる', async ({ page }) => {
    const errors = capturePageErrors(page)
    await page.goto('/games/pixel-kart')
    for (const course of COURSE_NAMES) {
      await startRace(page, course)
      await expect(page.locator('svg[aria-label="コースマップ"]')).toBeVisible()
      await expect(page.locator('canvas')).toHaveCount(1)
      await expect(page.getByRole('alert')).toHaveCount(0)
      await page.locator('[data-game-back-button]').click()
      await expect(page.getByRole('button', { name: `${course}で あそぶ`, exact: true })).toBeVisible()
    }
    await page.locator('[data-game-back-button]').click()
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })

  test('操作しなくても2周してゴールでき、もう一度・次のコースとクリア記録が使える', async ({ page }) => {
    test.setTimeout(180_000)
    const errors = capturePageErrors(page)
    await page.goto('/games/pixel-kart')
    const race = await startRace(page)
    const result = page.getByRole('dialog', { name: 'レースの けっか', exact: true })
    // This first finish uses real animation frames and no steering or item input.
    await expect(result).toBeVisible({ timeout: 65_000 })
    await expect(race).toHaveAttribute('data-phase', 'finished')
    await expect(result.getByText('2しゅう はしれたね', { exact: true })).toBeVisible()

    // Keep the real completion proof above; advance normal browser frames for the replay.
    await page.clock.install()
    await result.getByRole('button', { name: 'もういちど', exact: true }).click()
    await expect(race).toHaveAttribute('data-phase', 'countdown')
    await expect(race).toHaveAttribute('data-distance', '0')
    for (let elapsed = 0; elapsed < 60_000 && !await result.isVisible(); elapsed += 10_000) {
      await page.clock.runFor(10_000)
    }
    await expect(result).toBeVisible()
    await result.getByRole('button', { name: 'つぎの コース →', exact: true }).click()
    const nextRace = page.getByRole('region', { name: `${COURSE_NAMES[1]}の レース`, exact: true })
    await expect(nextRace).toHaveAttribute('data-phase', 'countdown')
    await page.locator('[data-game-back-button]').click()
    const clearedCourse = page.getByRole('button', { name: `${COURSE_NAMES[0]}で あそぶ`, exact: true })
    await expect(clearedCourse.getByLabel('クリアずみ', { exact: true })).toBeVisible()
    await page.reload()
    await expect(clearedCourse.getByLabel('クリアずみ', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
  })
})

test.describe('ドットカートのタッチ操作と横画面', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true })

  for (const viewport of [{ width: 844, height: 390 }, { width: 568, height: 320 }]) {
    test(`${viewport.width}×${viewport.height}で全コースと操作ボタンが画面内に収まる`, async ({ page }) => {
      const errors = capturePageErrors(page)
      await page.setViewportSize(viewport)
      await page.goto('/games/pixel-kart')
      await expect(page.getByRole('heading', { name: 'ドットカート', exact: true })).toBeVisible()
      for (const course of COURSE_NAMES) {
        const button = page.getByRole('button', { name: `${course}で あそぶ`, exact: true })
        await expectInsideViewport(button, page)
        expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44)
      }
      await expectInsideViewport(page.locator('[data-game-back-button]'), page)
      await expectInsideViewport(page.getByRole('button', { name: /せってい/ }), page)
      await startRace(page)
      await expectInsideViewport(page.getByRole('slider', { name: STICK_NAME }), page)
      await expectInsideViewport(page.getByRole('button', { name: 'アイテムを まってね', exact: true }), page)
      await expectInsideViewport(page.getByRole('button', { name: 'ひとやすみ', exact: true }), page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width + 1)
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1)
      expect(errors).toEqual([])
    })
  }

  test('ハンドルを押したまま別の指でアイテムを使い、指を離すとハンドルが戻る', async ({ page }) => {
    const errors = capturePageErrors(page)
    await page.goto('/games/pixel-kart')
    const race = await startRace(page)
    const stick = page.getByRole('slider', { name: STICK_NAME })
    const item = page.getByRole('button', { name: /を つかう$/ })
    await expect(item).toBeEnabled()
    const stickBox = (await stick.boundingBox())!
    const itemBox = (await item.boundingBox())!
    const steeringTouch = { id: 11, x: stickBox.x + stickBox.width * .84, y: stickBox.y + stickBox.height / 2 }
    const itemTouch = { id: 22, x: itemBox.x + itemBox.width / 2, y: itemBox.y + itemBox.height / 2 }
    const session = await page.context().newCDPSession(page)
    let touching = false
    try {
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [steeringTouch] })
      touching = true
      await expect(stick).toHaveAttribute('aria-valuenow', '100')
      const firstLane = Number(await race.getAttribute('data-lane'))
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [steeringTouch, itemTouch] })
      await expect(page.getByRole('button', { name: 'アイテムを まってね', exact: true })).toBeDisabled()
      await expect(stick).toHaveAttribute('aria-valuenow', '100')
      await expect.poll(async () => Number(await race.getAttribute('data-lane'))).toBeGreaterThan(firstLane + 10)
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
      touching = false
      await expect(stick).toHaveAttribute('aria-valuenow', '0')
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
    } finally {
      if (touching) await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
      await session.detach()
    }
    expect(errors).toEqual([])
  })

  test('縦向きは回転案内を表示し、レース中の回転では止まって横向きで再開できる', async ({ page }) => {
    const errors = capturePageErrors(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/games/pixel-kart')
    const guide = page.getByRole('region', { name: '横向きであそぶ案内', exact: true })
    await expect(guide).toBeVisible()
    await expect(guide.getByRole('heading', { name: 'ドットカート', exact: true })).toBeVisible()
    await expectInsideViewport(guide.locator('[data-game-back-button]'), page)
    await expect(page.getByRole('button', { name: `${COURSE_NAMES[0]}で あそぶ`, exact: true })).toHaveCount(0)
    await page.setViewportSize({ width: 844, height: 390 })
    const race = await startRace(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(guide).toBeVisible()
    await page.waitForTimeout(180)
    // The race is hidden from accessibility while rotated, so inspect its DOM state directly.
    const hiddenRace = page.locator('section[data-phase]')
    const distance = await hiddenRace.getAttribute('data-distance')
    await page.waitForTimeout(400)
    await expect(hiddenRace).toHaveAttribute('data-distance', distance!)
    await page.setViewportSize({ width: 844, height: 390 })
    await expect(page.getByRole('dialog', { name: 'ひとやすみ', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '▶ つづける', exact: true }).click()
    await expect.poll(async () => Number(await race.getAttribute('data-distance'))).toBeGreaterThan(Number(distance) + 20)
    expect(errors).toEqual([])
  })
})
