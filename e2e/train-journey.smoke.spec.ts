import { expect, test, type Page } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

async function depart(page: Page) {
  await page.goto('/games/train-journey')
  await page.getByRole('button', { name: 'しゅっぱつ！', exact: true }).click()
  await expect(page.locator('canvas')).toHaveCount(1)
}

test('three trains, both point controls, temporary boost, pause and cameras work in portrait and landscape', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  page.on('console', m => { if (m.type() === 'error' && /THREE.WebGLProgram|shader error/i.test(m.text())) errors.push(m.text()) })
  await page.goto('/')
  await page.getByRole('link', { name: 'でんしゃの たび', exact: true }).click()
  const start = page.getByRole('button', { name: 'しゅっぱつ！', exact: true })
  await expect(start).toBeEnabled({ timeout: 20_000 })
  const scene = page.getByTestId('journey-scene')
  for (const [name, id] of [['きかんしゃ', 'steam'], ['かもつれっしゃ', 'cargo'], ['しんかんせん', 'bullet']]) {
    await page.getByRole('button', { name: `${name}を えらぶ`, exact: true }).click()
    await expect(page.getByRole('button', { name: `${name}を えらぶ`, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(scene).toHaveAttribute('data-train', id)
    await expect(page.locator('canvas')).toHaveCount(1)
  }
  await start.click()
  const initial = await scene.getAttribute('data-distance')
  await page.getByRole('button', { name: 'かそく！', exact: true }).click()
  await expect(page.getByRole('button', { name: 'かそく！', exact: true })).toHaveAttribute('data-active', 'true')
  await expect.poll(() => scene.getAttribute('data-distance')).not.toBe(initial)
  await expect.poll(async () => Number(await scene.getAttribute('data-speed'))).toBeGreaterThan(5)
  await expect(page.getByRole('button', { name: 'かそく！', exact: true })).toHaveAttribute('data-active', 'false', { timeout: 12_000 })
  await page.getByRole('button', { name: 'ポイントを きりかえる', exact: true }).click()
  await expect(page.getByRole('complementary')).toHaveAccessibleName('コースマップ。つぎは トンネル')
  await page.getByRole('button', { name: 'ぜんたい', exact: true }).click()
  await page.getByRole('button', { name: 'コースの ポイントを きりかえる', exact: true }).click()
  await expect(page.getByRole('complementary')).toHaveAccessibleName('コースマップ。つぎは はし')
  await page.getByRole('button', { name: 'とまる', exact: true }).click()
  await expect(page.getByRole('button', { name: 'はしる', exact: true })).toBeVisible()
  // Allow one queued animation callback before observing the paused distance.
  await page.waitForTimeout(250)
  const stopped = await scene.getAttribute('data-distance')
  await page.waitForTimeout(450)
  expect(await scene.getAttribute('data-distance')).toBe(stopped)
  await page.getByRole('button', { name: 'ふえを ならす', exact: true }).click()
  await page.screenshot({ path: 'test-results/train-journey-portrait.png' })
  for (const viewport of [{ width: 844, height: 390 }, { width: 667, height: 375 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport)
    await expect(page.getByRole('button', { name: 'かそく！', exact: true })).toBeInViewport()
    await expect(page.getByRole('button', { name: 'ポイントを きりかえる', exact: true })).toBeInViewport()
    const bounds = await scene.boundingBox()
    expect(bounds!.height).toBeGreaterThan(200)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const buttons = await page.getByRole('region', { name: 'でんしゃの そうさ' }).getByRole('button').evaluateAll(elements => elements.map(e => ({ width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height })))
    expect(buttons.every(b => b.width >= 44 && b.height >= 44)).toBe(true)
  }
  await page.setViewportSize({ width: 844, height: 390 })
  await page.screenshot({ path: 'test-results/train-journey-landscape.png' })
  await page.getByRole('button', { name: 'はしる', exact: true }).click()
  await expect.poll(() => scene.getAttribute('data-distance')).not.toBe(stopped)
  await page.getByRole('button', { name: 'でんしゃを えらびなおす', exact: true }).click()
  await expect(page.getByRole('button', { name: 'しんかんせんを えらぶ', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(Number(await scene.getAttribute('data-draw-calls'))).toBeLessThan(65)
  expect(Number(await scene.getAttribute('data-triangles'))).toBeLessThan(150_000)
  expect(errors).toEqual([])
})

test('asset failure offers a clean retry and WebGL context restoration recovers', async ({ page }) => {
  test.setTimeout(60_000)
  await page.route('**/models/train-journey/train-electric-bullet-a.glb', route => route.fulfill({ status: 503, body: 'unavailable' }))
  await page.goto('/games/train-journey')
  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('button', { name: 'しゅっぱつ！', exact: true })).toBeDisabled()
  await page.unroute('**/models/train-journey/train-electric-bullet-a.glb')
  await page.getByRole('button', { name: 'もういちど', exact: true }).click()
  await expect(page.getByRole('button', { name: 'しゅっぱつ！', exact: true })).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.evaluate(() => {
    const extension = document.querySelector('canvas')!.getContext('webgl2')!.getExtension('WEBGL_lose_context')!
    Object.defineProperty(window, '__restoreJourneyContext', { value: () => extension.restoreContext() })
    extension.loseContext()
  })
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __restoreJourneyContext: () => void }).__restoreJourneyContext())
  await expect(page.getByRole('button', { name: 'しゅっぱつ！', exact: true })).toBeEnabled({ timeout: 20_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
})

test('WebGL initialization failure can be retried and leaving the game removes its canvas', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext
    Object.defineProperty(window, '__restoreJourneyInit', { value: () => { HTMLCanvasElement.prototype.getContext = original } })
    HTMLCanvasElement.prototype.getContext = function (...args: Parameters<typeof original>) {
      if (String(args[0]).startsWith('webgl')) return null
      return original.apply(this, args)
    } as typeof original
  })
  await page.goto('/games/train-journey')
  await expect(page.getByRole('alert')).toBeVisible()
  await page.evaluate(() => (window as unknown as { __restoreJourneyInit: () => void }).__restoreJourneyInit())
  await page.getByRole('button', { name: 'もういちど', exact: true }).click()
  await page.getByRole('button', { name: 'しゅっぱつ！', exact: true }).click()
  await page.getByRole('button', { name: /もどる/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('reduced motion retains an overview camera while the train still travels', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await depart(page)
  await expect(page.getByRole('button', { name: 'ぜんたい', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'かそく！', exact: true }).click()
  await expect.poll(async () => Number(await page.getByTestId('journey-scene').getAttribute('data-speed'))).toBeGreaterThan(1)
})
