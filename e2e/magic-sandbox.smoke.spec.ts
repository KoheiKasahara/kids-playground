import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
  test(`すなばの昼夜切替と夜のお絵かき ${viewport.width}x${viewport.height}`, async ({ page }, testInfo) => {
    const portrait = viewport.height > viewport.width
    await page.setViewportSize(viewport)
    const errors = capturePageErrors(page)
    await page.goto('/games/magic-sandbox')
    await page.getByRole('button', { name: 'あそぶ！' }).click()
    const toggle = page.getByRole('button', { name: 'よる', exact: true })
    const knob = toggle.locator('i')
    const canvas = page.getByLabel(/^すなば。/)
    const materials = page.getByRole('group', { name: 'そざい' })
    if (portrait) {
      // 縦画面では素材といきものを横スクロールの帯にまとめ、続きがあることを示す。
      await expect(page.getByText('↔ よこに うごくよ')).toBeVisible()
      expect(await materials.evaluate(strip => strip.scrollWidth - strip.clientWidth)).toBeGreaterThan(40)
    }
    await page.getByRole('button', { name: 'カニを ふやす（0/2）' }).click()
    await page.getByRole('button', { name: 'カニを ふやす（1/2）' }).click()
    await page.getByRole('button', { name: 'カメを ふやす（0/1）' }).click()
    await page.getByRole('button', { name: 'ちょうちょを ふやす（0/1）' }).click()
    await expect(page.getByRole('button', { name: 'ちょうちょを ふやす（1/1）' })).toBeDisabled()
    const dayKnob = (await knob.boundingBox())!.x
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(async () => (await knob.boundingBox())!.x).toBeGreaterThan(dayKnob + 20)
    await expect(canvas).toHaveCSS('filter', 'brightness(0.94)')
    await page.getByRole('button', { name: /とめる/ }).click()
    await page.getByRole('button', { name: 'みず', exact: true }).click()
    const paintedPixels = () => canvas.evaluate((element: HTMLCanvasElement) => {
      const pixels = element.getContext('2d')!.getImageData(0, 0, element.width, element.height).data
      let count = 0
      for (let i = 3; i < pixels.length; i += 4) if (pixels[i]) count++
      return count
    })
    const before = await paintedPixels()
    await canvas.click({ position: { x: 100, y: 50 } })
    expect(await paintedPixels()).toBeGreaterThan(before)
    await page.screenshot({ path: testInfo.outputPath('night.png') })
    const box = await toggle.boundingBox()
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    // 丸ボタンではなく、左右に動くトグルだと見た目でわかる横長の形。
    expect(box!.width).toBeGreaterThan(box!.height)
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-pressed', 'false')
    await expect.poll(async () => (await knob.boundingBox())!.x).toBe(dayKnob)
    await expect(canvas).toHaveCSS('filter', 'none')
    await expect(page.getByRole('button', { name: 'みず', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'カメを ふやす（1/1）' })).toBeDisabled()
    if (portrait) {
      // 帯を端までスクロールすると、最後のいきものまで届く。
      await materials.evaluate(strip => strip.scrollTo({ left: strip.scrollWidth }))
      const strip = (await materials.boundingBox())!, last = (await page.getByRole('button', { name: 'ちょうちょを ふやす（1/1）' }).boundingBox())!
      expect(last.x + last.width).toBeLessThanOrEqual(strip.x + strip.width + 1)
    }
    await page.screenshot({ path: testInfo.outputPath('day.png') })
    expect(errors).toEqual([])
  })
}
