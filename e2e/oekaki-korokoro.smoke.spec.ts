import { expect, test, type Page } from '@playwright/test'

const drawing = (page: Page) => page.getByLabel('おえかきの かみ。ゆびや マウスで なぞってね')
const pixels = (page: Page) => drawing(page).evaluate(el => (el as HTMLCanvasElement).toDataURL())

async function stroke(page: Page, y = .45) {
  const box = (await drawing(page).boundingBox())!
  await page.mouse.move(box.x + box.width * .15, box.y + box.height * y)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .85, box.y + box.height * y, { steps: 35 })
  await page.mouse.up()
}

test('home → drawing → pattern/color → undo → paper → guarded clear → PNG → home', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/')
  await page.getByRole('link', { name: 'おえかきコロコロ', exact: true }).click()
  await expect(drawing(page)).toBeVisible()
  const blank = await pixels(page)
  await stroke(page)
  const first = await pixels(page)
  expect(first).not.toBe(blank)
  await page.getByRole('button', { name: 'ほし', exact: true }).click()
  await page.getByRole('button', { name: 'あお', exact: true }).click()
  await expect(page.getByRole('button', { name: 'あお', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await stroke(page, .7)
  expect(await pixels(page)).not.toBe(first)
  await page.getByRole('button', { name: '1かい もどす' }).click()
  expect(await pixels(page)).toBe(first)
  await expect(page.getByRole('button', { name: '1かい もどす' })).toBeDisabled()
  await page.getByRole('button', { name: 'よぞら', exact: true }).click()
  expect(await pixels(page)).toBe(first)
  await page.getByRole('button', { name: 'ぜんぶ けす' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('button', { name: 'まだ かく' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await pixels(page)).toBe(first)
  await page.getByRole('button', { name: 'ぜんぶ けす' }).click()
  await page.getByRole('button', { name: 'けす', exact: true }).click()
  expect(await pixels(page)).toBe(blank)
  await page.getByRole('button', { name: '1かい もどす' }).click()
  expect(await pixels(page)).toBe(first)
  // Inspect the actual exported PNG, including opaque paper and ink.
  await page.evaluate(() => {
    document.addEventListener('click', e => {
      const target = e.target
      if (target instanceof HTMLAnchorElement && target.download) document.documentElement.dataset.savedPng = target.href
    })
  })
  const downloading = page.waitForEvent('download')
  await page.getByRole('button', { name: 'できた！', exact: true }).click()
  const download = await downloading
  expect(download.suggestedFilename()).toBe('oekaki-korokoro.png')
  expect(await download.failure()).toBeNull()
  const exported = await page.evaluate(async () => {
    const img = new Image()
    img.src = document.documentElement.dataset.savedPng!
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.width; canvas.height = img.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    return { width: img.width, height: img.height, corner: [...ctx.getImageData(0, 0, 1, 1).data], center: [...ctx.getImageData(144, 324, 1, 1).data] }
  })
  expect(exported.width).toBe(960)
  expect(exported.height).toBe(720)
  expect(exported.corner).toEqual([38, 54, 87, 255])
  expect(exported.center).not.toEqual(exported.corner)
  await expect(page.getByRole('dialog', { name: 'できた！' })).toBeVisible()
  await page.getByRole('button', { name: 'もっと かく' }).click()
  await page.getByRole('link', { name: '← もどる' }).click()
  await expect(page).toHaveURL(/\/$/)
  expect(errors).toEqual([])
})

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 1280, height: 800 }]) {
  test(`usable paper and controls at ${viewport.width}×${viewport.height}; resize preserves artwork`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/games/oekaki-korokoro')
    await expect(drawing(page)).toBeVisible()
    for (const control of await page.locator('main button, main a').all()) {
      const box = (await control.boundingBox())!
      expect(box.width).toBeGreaterThanOrEqual(44)
      expect(box.height).toBeGreaterThanOrEqual(44)
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    }
    const box = (await drawing(page).boundingBox())!
    expect(box.width).toBeGreaterThan(200)
    expect(box.height).toBeGreaterThan(150)
    await stroke(page)
    const before = await pixels(page)
    await page.screenshot({ path: `test-results/oekaki-${viewport.width}x${viewport.height}.png` })
    await page.setViewportSize({ width: viewport.height, height: viewport.width })
    await expect(drawing(page)).toBeVisible()
    expect(await pixels(page)).toBe(before)
    await page.getByRole('button', { name: '1かい もどす' }).click()
    expect(await pixels(page)).not.toBe(before)
  })
}

test('real touch drag does not scroll; extra finger/cancel and pointer capture remain usable', async ({ page, context }) => {
  await page.goto('/games/oekaki-korokoro')
  await expect(drawing(page)).toBeVisible()
  const blank = await pixels(page)
  const box = (await drawing(page).boundingBox())!
  const client = await context.newCDPSession(page)
  const x = box.x + box.width * .3
  const y = box.y + box.height * .3
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 0 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + 70, y: y + 60, id: 0 }] })
  const oneFinger = await pixels(page)
  expect(oneFinger).not.toBe(blank)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x + 70, y: y + 60, id: 0 }, { x: x + 110, y, id: 1 }] })
  await client.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
  expect(await page.evaluate(() => window.scrollY)).toBe(0)
  await page.getByRole('button', { name: '1かい もどす' }).click()
  expect(await pixels(page)).toBe(blank)
  // Capture finishes outside the canvas and never leaves a stuck gesture.
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(1, 1, { steps: 5 })
  await page.mouse.up()
  await page.getByRole('button', { name: '1かい もどす' }).click()
  expect(await pixels(page)).toBe(blank)
  await page.touchscreen.tap(x, y)
  expect(await pixels(page)).not.toBe(blank)
})

test('curved trails use every motif; sustained drawing stays responsive', async ({ page }, testInfo) => {
  await page.goto('/games/oekaki-korokoro')
  await expect(drawing(page)).toBeVisible()
  await page.getByRole('button', { name: 'そら', exact: true }).click()
  const timings: number[] = []
  for (const [row, [motif, color]] of [['おはな', 'ももいろ'], ['ほし', 'オレンジ'], ['あしあと', 'みどり'], ['ハート', 'むらさき'], ['しましま', 'あお']].entries()) {
    await page.getByRole('button', { name: motif, exact: true }).click()
    await page.getByRole('button', { name: color, exact: true }).click()
    const box = (await drawing(page).boundingBox())!
    const baseY = box.y + box.height * (.16 + row * .16)
    await page.mouse.move(box.x + box.width * .1, baseY)
    await page.mouse.down()
    // Keep a real active/captured pointer, then stress its event handler with a
    // dense, smooth path. Timings are evidence, not a machine-dependent CI gate.
    const samples = await drawing(page).evaluate((canvas, { box, baseY }) => {
      const durations: number[] = []
      for (let i = 1; i <= 400; i++) {
        const t = i / 400
        const start = performance.now()
        canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, isPrimary: true, buttons: 1, clientX: box.x + box.width * (.1 + t * .8), clientY: baseY + Math.sin(t * Math.PI * 3) * box.height * .055 }))
        durations.push(performance.now() - start)
      }
      return durations
    }, { box, baseY })
    timings.push(...samples)
    await page.mouse.move(box.x + box.width * .9, baseY)
    await page.mouse.up()
  }
  await page.screenshot({ path: 'test-results/oekaki-artwork.png' })
  timings.sort((a, b) => a - b)
  await testInfo.attach('drawing-event-timings', { body: JSON.stringify({ samples: timings.length, p95Milliseconds: timings[Math.floor(timings.length * .95)], maxMilliseconds: timings.at(-1) }), contentType: 'application/json' })
  await expect(page.getByRole('button', { name: '1かい もどす' })).toBeEnabled()
})
