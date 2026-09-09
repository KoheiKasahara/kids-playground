import { expect, test } from '@playwright/test'
import { GAME_CATALOG } from '../src/games/gameCatalog'
import { boxesOverlap, visibleTextBox } from './support/layout'
import { capturePageErrors } from './support/runtimeErrors'

const PORTRAIT_VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 393, height: 852 },
] as const

for (const viewport of PORTRAIT_VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height} の縦画面`, () => {
    test.use({ viewport })

    for (const game of GAME_CATALOG) {
      test(`${game.title}の戻るボタンがラベルを隠さない [${game.slug}]`, async ({ page }) => {
        test.setTimeout(60_000)
        const pageErrors = capturePageErrors(page)

        await page.goto(`/games/${game.slug}`, { waitUntil: 'domcontentloaded' })

        const heading = page.getByRole('heading', { name: game.title, exact: true })
        const backButton = page.locator('[data-game-back-button]')
        await expect(heading).toBeVisible({ timeout: 15_000 })
        await expect(backButton).toBeVisible()
        await expect(backButton).toBeInViewport()

        const [backButtonBox, headingBox] = await Promise.all([
          backButton.boundingBox(),
          visibleTextBox(heading),
        ])
        expect(backButtonBox?.width).toBeGreaterThanOrEqual(44)
        expect(backButtonBox?.height).toBeGreaterThanOrEqual(44)

        if (game.slug !== 'circuit-racing') {
          expect(
            !boxesOverlap(backButtonBox, headingBox),
            `${game.title} (${game.slug}) のタイトルに戻るボタンが重なっています`,
          ).toBe(true)
        }

        const documentWidth = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }))
        expect(documentWidth.scrollWidth).toBeLessThanOrEqual(documentWidth.clientWidth + 1)
        expect(pageErrors, `${game.title} (${game.slug}) の縦画面初期表示でruntime errorが発生`).toEqual([])
      })
    }
  })
}
