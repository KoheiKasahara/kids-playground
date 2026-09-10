import { expect, test } from '@playwright/test'

for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test(`draw-goal portrait ${viewport.width}: draw, goal, next, back without scrolling`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/games/draw-goal')
    await page.getByRole('button', { name: '1 みぎへ コロコロ' }).click()
    const board = page.getByLabel('せんを かく ばしょ')
    await expect(board).toBeVisible()
    await expect(page.getByRole('heading', { name: 'このゲームについて' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'もどる', exact: true })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(viewport.height + 1)
    for (const button of await page.locator('main button').all()) {
      const rect = (await button.boundingBox())!
      expect(rect.height).toBeGreaterThanOrEqual(44)
      expect(rect.width).toBeGreaterThanOrEqual(44)
      expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1)
    }
    const box = (await board.boundingBox())!
    await page.mouse.move(box.x + box.width * 55 / 400, box.y + box.height * 175 / 600)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width * 285 / 400, box.y + box.height * 520 / 600, { steps: 25 })
    await page.mouse.up()
    await expect(page.getByRole('heading', { name: '🎉 ゴール！' })).toHaveCount(0)
    await page.getByRole('button', { name: '▶ スタート' }).click()
    await expect(page.getByRole('heading', { name: '🎉 ゴール！' })).toBeVisible({ timeout: 10000 })
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await page.getByRole('button', { name: 'つぎへ →' }).click()
    await expect(page.getByText('2 / 10')).toBeVisible()
    await page.getByRole('button', { name: 'もどる', exact: true }).click()
    await expect(page.getByRole('button', { name: '10 さいごの ぼうけん' })).toBeVisible()
    await page.getByRole('button', { name: 'もどる', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム' })).toBeVisible()
  })
}
