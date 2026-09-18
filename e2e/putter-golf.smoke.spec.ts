import { expect, test, type Locator, type Page } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'
import { findCourse, type CourseId } from '../src/games/putter-golf/golfCourses'
import { powerForDistance, rollingDecel } from '../src/games/putter-golf/golfPhysics'

const DRAG_DEAD_ZONE = 14

function watchShaderErrors(page: Page, errors: string[]) {
  page.on('console', message => {
    if (message.type() === 'error' && /THREE.WebGLProgram|VALIDATE_STATUS|shader error/i.test(message.text())) errors.push(message.text())
  })
}

/**
 * 画面を下へひっぱって はなすと、ボールのうしろから いまの おすすめの向きへ打てる。
 * ボタンの「ヒント」が無くなった分、カップまでの まっすぐな きょりから ここで
 * うつ強さを見つもる（曲がり道やしかけは考えないので、何回か うちなおすこともある）。
 */
async function dragTowardCup(page: Page, scene: Locator, courseId: CourseId, holeIndex: number) {
  const course = findCourse(courseId)!
  const hole = course.holes[holeIndex]!
  const box = (await scene.boundingBox())!
  const ballX = Number(await scene.getAttribute('data-ball-x'))
  const ballZ = Number(await scene.getAttribute('data-ball-z'))
  const distance = Math.hypot(hole.cup.x - ballX, hole.cup.z - ballZ) + 0.4
  const power = Math.min(1, powerForDistance(distance, rollingDecel('green', course.gravity, course.rollingScale)))
  const fullPowerPx = Math.min(230, Math.max(110, Math.min(box.width, box.height) * 0.34))
  const travel = DRAG_DEAD_ZONE + power * (fullPowerPx - DRAG_DEAD_ZONE) + 6
  const startY = box.y + Math.max(box.height * 0.3, box.height / 2 - travel / 2)
  const endY = Math.min(box.y + box.height * 0.9, startY + travel)
  const x = box.x + box.width / 2
  await page.mouse.move(x, startY)
  await page.mouse.down()
  await page.mouse.move(x, startY + (endY - startY) / 2, { steps: 3 })
  await page.mouse.move(x, endY, { steps: 3 })
  await page.mouse.up()
}

async function playHole(page: Page, courseId: CourseId, holeIndex: number) {
  const scene = page.getByTestId('golf-scene')
  for (let shot = 0; shot < 12; shot++) {
    await expect.poll(() => scene.getAttribute('data-phase'), { timeout: 30_000 }).toMatch(/^(ready|holed)$/)
    if (await scene.getAttribute('data-phase') === 'holed') break
    const strokes = Number(await scene.getAttribute('data-strokes'))
    await dragTowardCup(page, scene, courseId, holeIndex)
    await expect.poll(async () => Number(await scene.getAttribute('data-strokes'))).toBe(strokes + 1)
  }
  await expect(page.getByRole('region', { name: 'カップイン', exact: true })).toBeVisible({ timeout: 10_000 })
}

test('コースを選んで ひっぱって打ち、3ホールを回ってスコアカードまで進める', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = capturePageErrors(page)
  watchShaderErrors(page, errors)
  await page.goto('/')
  await page.getByRole('link', { name: 'パターゴルフ', exact: true }).click()
  const start = page.getByRole('button', { name: 'スタート！', exact: true })
  await expect(start).toBeEnabled({ timeout: 20_000 })
  const scene = page.getByTestId('golf-scene')
  for (const [name, hole] of [['うみべ', 'beach-1'], ['おつきさま', 'moon-1'], ['はらっぱ', 'meadow-1']]) {
    await page.getByRole('button', { name: `${name}コースを えらぶ`, exact: true }).click()
    await expect(scene).toHaveAttribute('data-hole', hole)
  }
  await page.getByRole('button', { name: 'きいろの ボール', exact: true }).click()
  await start.click()
  await expect(page.getByRole('region', { name: 'ゴルフの そうさ', exact: true })).toBeVisible()
  await expect(scene).toHaveAttribute('data-camera', 'ball')

  // 画面を下へひっぱって はなすと、前へ打てる。
  await expect(scene).toHaveAttribute('data-phase', 'ready')
  const startZ = Number(await scene.getAttribute('data-ball-z'))
  await dragTowardCup(page, scene, 'meadow', 0)
  await expect(scene).toHaveAttribute('data-strokes', '1')
  await expect.poll(async () => Number(await scene.getAttribute('data-ball-z')), { timeout: 10_000 }).toBeLessThan(startZ - 0.5)

  await page.getByRole('button', { name: 'ホール ぜんたいを みる', exact: true }).click()
  await expect(scene).toHaveAttribute('data-camera', 'overview')
  await page.getByRole('button', { name: 'ボールを みる', exact: true }).click()

  for (const [index, next] of [[1, 'meadow-2'], [2, 'meadow-3'], [3, 'meadow-4'], [4, null]] as const) {
    await playHole(page, 'meadow', index - 1)
    await page.screenshot({ path: `test-results/putter-golf-hole${index}.png` })
    if (next) {
      await page.getByRole('button', { name: 'つぎの ホールへ ▶', exact: true }).click()
      await expect(scene).toHaveAttribute('data-hole', next)
      await expect(page.getByLabel('うった かず 0')).toBeVisible()
    } else {
      await page.getByRole('button', { name: 'けっかを みる ▶', exact: true }).click()
    }
  }
  const card = page.getByRole('region', { name: 'けっか', exact: true })
  await expect(card.getByText(/はらっぱコース クリア/)).toBeVisible()
  await expect(card.getByRole('row')).toHaveCount(5)
  expect(Number(await scene.getAttribute('data-draw-calls'))).toBeLessThan(80)
  expect(Number(await scene.getAttribute('data-triangles'))).toBeLessThan(150_000)
  await card.getByRole('button', { name: 'コースを えらぶ', exact: true }).click()
  await expect(page.getByText(/さいこう \d+\/12 ★/)).toBeVisible()
  expect(errors).toEqual([])
})

test('縦・横どちらでも主な操作が画面に入り、横にはみ出さない', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/games/putter-golf')
  await page.getByRole('button', { name: 'スタート！', exact: true }).click({ timeout: 20_000 })
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    for (const name of ['ボールを みる', 'ホール ぜんたいを みる', 'この ホールを やりなおす']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport()
    expect((await page.getByTestId('golf-scene').boundingBox())!.height).toBeGreaterThan(180)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const buttons = await page.getByRole('region', { name: 'ゴルフの そうさ' }).getByRole('button').evaluateAll(elements => elements.map(element => element.getBoundingClientRect()))
    expect(buttons.every(button => button.width >= 44 && button.height >= 44)).toBe(true)
  }
  await page.screenshot({ path: 'test-results/putter-golf-small.png' })
})

test('WebGLの初期化に失敗しても作り直せて、退出するとcanvasを残さない', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(window, '__restoreGolfInit', { value: () => { HTMLCanvasElement.prototype.getContext = original } })
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('/games/putter-golf')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'スタート！', exact: true })).toBeDisabled()
  await page.evaluate(() => (window as unknown as { __restoreGolfInit: () => void }).__restoreGolfInit())
  await page.getByRole('button', { name: 'もういちど', exact: true }).click()
  await expect(page.getByRole('button', { name: 'スタート！', exact: true })).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.evaluate(() => {
    const extension = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    Object.defineProperty(window, '__restoreGolfContext', { value: () => extension.restoreContext() })
    extension.loseContext()
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __restoreGolfContext: () => void }).__restoreGolfContext())
  await expect(page.getByRole('button', { name: 'スタート！', exact: true })).toBeEnabled({ timeout: 20_000 })
  await page.locator('[data-game-back-button]').click()
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('動きを減らす設定でも、はじめからボールの後ろで打てる', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/games/putter-golf')
  await page.getByRole('button', { name: 'スタート！', exact: true }).click({ timeout: 20_000 })
  const scene = page.getByTestId('golf-scene')
  await expect(scene).toHaveAttribute('data-phase', 'ready')
  await dragTowardCup(page, scene, 'meadow', 0)
  await expect(scene).toHaveAttribute('data-strokes', '1')
})
