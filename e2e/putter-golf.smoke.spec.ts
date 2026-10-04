import { writeFile } from 'node:fs/promises'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'
import { findCourse, type CourseId } from '../src/games/putter-golf/golfCourses'
import { powerForDistance, rollingDecel } from '../src/games/putter-golf/golfPhysics'

const DRAG_DEAD_ZONE = 14
const MEADOW = findCourse('meadow')!

// テスト全体の時間切れでも、最後にどのホール・何打目で止まったかを小さく残す。
test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status === testInfo.expectedStatus || page.isClosed()) return
  const state = await page.getByTestId('golf-scene').evaluate(element => ({ ...(element as HTMLElement).dataset }), undefined, { timeout: 1_000 }).catch(() => null)
  const path = testInfo.outputPath('golf-failure-state.json')
  await writeFile(path, JSON.stringify({ test: testInfo.title, state }, null, 2))
  await testInfo.attach('golf-scene-state', { path, contentType: 'application/json' })
})

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
  await expect(scene, `${courseId}-${holeIndex + 1}: 前の打球が止まるかカップインする`).toHaveAttribute('data-phase', /^(ready|holed)$/, { timeout: 30_000 })
  for (let shot = 0; shot < 12; shot++) {
    if (await scene.getAttribute('data-phase') === 'holed') break
    const strokes = Number(await scene.getAttribute('data-strokes'))
    await test.step(`${courseId}-${holeIndex + 1}: ${strokes + 1}打目をひっぱって打つ`, async () => {
      await dragTowardCup(page, scene, courseId, holeIndex)
      await expect(scene).toHaveAttribute('data-strokes', String(strokes + 1))
      await expect(scene, `${strokes + 1}打目が止まるかカップインする`).toHaveAttribute('data-phase', /^(ready|holed)$/, { timeout: 30_000 })
    })
  }
  await expect(page.getByRole('region', { name: 'カップイン', exact: true })).toBeVisible({ timeout: 10_000 })
  return Number(await scene.getAttribute('data-strokes'))
}

// コースごとの景色の作り直しは、実打で全ホールを回るシナリオと独立させる。
// WebGL の再構築時間を、同じラウンドの打球待ち時間に積み重ねない。
test('コースを選ぶと景色が切り替わり、描画量が上限に収まる', async ({ page }) => {
  const errors = capturePageErrors(page)
  watchShaderErrors(page, errors)
  await page.goto('/games/putter-golf')
  await expect(page.getByRole('button', { name: 'スタート！', exact: true })).toBeEnabled({ timeout: 20_000 })
  const scene = page.getByTestId('golf-scene')
  for (const [name, hole] of [['うみべ', 'beach-1'], ['おつきさま', 'moon-1'], ['もり', 'forest-1'], ['くだりざか', 'downhill-1'], ['かわべ', 'river-1'], ['たにま', 'canyon-1'], ['こうじょう', 'factory-1'], ['そらのしま', 'sky-1'], ['はらっぱ', 'meadow-1']]) {
    await test.step(`${name}コースの景色を読み込む`, async () => {
      const choice = page.getByRole('button', { name: `${name}コースを えらぶ`, exact: true })
      await choice.click()
      await expect(choice).toHaveAttribute('aria-pressed', 'true')
      await expect(scene).toHaveAttribute('data-hole', hole)
      // 景色の多い ひろいコースでも、描画の重さを増やしすぎない。
      await expect.poll(async () => Number(await scene.getAttribute('data-triangles'))).toBeLessThan(150_000)
    })
  }
  expect(errors).toEqual([])
})

test('ひっぱって打ち、はらっぱの全4ホールを回ってスコアカードと再挑戦まで進める', async ({ page }) => {
  test.setTimeout(180_000)
  const errors = capturePageErrors(page)
  watchShaderErrors(page, errors)
  await page.goto('/')
  await page.getByRole('link', { name: 'パターゴルフ', exact: true }).click()
  const start = page.getByRole('button', { name: 'スタート！', exact: true })
  await expect(start).toBeEnabled({ timeout: 20_000 })
  const scene = page.getByTestId('golf-scene')
  await expect(scene).toHaveAttribute('data-hole', MEADOW.holes[0]!.id)
  await page.getByRole('button', { name: 'きいろの ボール', exact: true }).click()
  await start.click()
  await expect(page.getByRole('region', { name: 'ゴルフの そうさ', exact: true })).toBeVisible()
  await expect(scene).toHaveAttribute('data-camera', 'ball')

  // ← → で ねらう むき（＝カメラの むき）が かわる。うつ前の ティーで たしかめる。
  await expect(scene).toHaveAttribute('data-phase', 'ready')
  const aimed = Number(await scene.getAttribute('data-aim-x'))
  await page.getByRole('button', { name: 'むきを ひだりへ かえる', exact: true }).click()
  await expect.poll(async () => Number(await scene.getAttribute('data-aim-x'))).toBeLessThan(aimed)
  const turned = Number(await scene.getAttribute('data-aim-x'))
  await page.getByRole('button', { name: 'むきを みぎへ かえる', exact: true }).click()
  await expect.poll(async () => Number(await scene.getAttribute('data-aim-x'))).toBeGreaterThan(turned)

  // 画面を下へひっぱって はなすと、前へ打てる。
  const startZ = Number(await scene.getAttribute('data-ball-z'))
  await dragTowardCup(page, scene, 'meadow', 0)
  await expect(scene).toHaveAttribute('data-strokes', '1')
  await expect.poll(async () => Number(await scene.getAttribute('data-ball-z')), { timeout: 10_000 }).toBeLessThan(startZ - 0.5)

  await page.getByRole('button', { name: 'ホール ぜんたいを みる', exact: true }).click()
  await expect(scene).toHaveAttribute('data-camera', 'overview')
  await page.getByRole('button', { name: 'ボールを みる', exact: true }).click()

  const strokesByHole: number[] = []
  for (const [index, hole] of MEADOW.holes.entries()) {
    await test.step(`${hole.id}をカップインして次へ進む`, async () => {
      const strokes = await playHole(page, 'meadow', index)
      expect(strokes).toBeGreaterThan(0)
      strokesByHole.push(strokes)
      await page.screenshot({ path: `test-results/putter-golf-hole${index + 1}.png` })
      const next = MEADOW.holes[index + 1]
      if (next) {
        await page.getByRole('button', { name: 'つぎの ホールへ ▶', exact: true }).click()
        await expect(scene).toHaveAttribute('data-hole', next.id)
        await expect(page.getByLabel('うった かず 0')).toBeVisible()
      } else {
        await page.getByRole('button', { name: 'けっかを みる ▶', exact: true }).click()
      }
    })
  }
  const card = page.getByRole('region', { name: 'けっか', exact: true })
  await expect(card.getByText(/はらっぱコース クリア/)).toBeVisible()
  await expect(card.getByRole('row')).toHaveCount(MEADOW.holes.length + 1)
  for (const [index, hole] of MEADOW.holes.entries()) {
    const row = card.getByRole('row').filter({ has: page.getByRole('rowheader', { name: `${index + 1} ${hole.name}`, exact: true }) })
    await expect(row.getByRole('cell').first()).toHaveText(String(strokesByHole[index]))
  }
  expect(Number(await scene.getAttribute('data-draw-calls'))).toBeLessThan(80)
  expect(Number(await scene.getAttribute('data-triangles'))).toBeLessThan(150_000)
  await card.getByRole('button', { name: 'コースを えらぶ', exact: true }).click()
  await expect(page.getByText(/さいこう \d+\/12 ★/)).toBeVisible()
  // 保存済みの結果から同じコースをもう一度始めても、ホールと打数は新しいラウンドになる。
  await start.click()
  await expect(scene).toHaveAttribute('data-hole', MEADOW.holes[0]!.id)
  await expect(scene).toHaveAttribute('data-phase', 'ready')
  await expect(scene).toHaveAttribute('data-strokes', '0')
  await expect(card).toBeHidden()
  await expect(page.getByLabel('うった かず 0')).toBeVisible()
  expect(errors).toEqual([])
})

test('縦・横どちらでも主な操作が画面に入り、横にはみ出さない', async ({ page }) => {
  test.setTimeout(90_000)
  await page.goto('/games/putter-golf')
  await page.getByRole('button', { name: 'スタート！', exact: true }).click({ timeout: 20_000 })
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 667, height: 375 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    for (const name of ['むきを ひだりへ かえる', 'ボールを みる', 'ホール ぜんたいを みる', 'この ホールを やりなおす', 'むきを みぎへ かえる']) await expect(page.getByRole('button', { name, exact: true })).toBeInViewport()
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
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: Parameters<typeof original>) {
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
