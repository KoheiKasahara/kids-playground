import { expect, test } from '@playwright/test'
import { GAME_CATALOG } from '../src/games/gameCatalog'
import { boxesOverlap, visibleTextBox } from './support/layout'
import { capturePageErrors } from './support/runtimeErrors'

const LANDSCAPE_VIEWPORTS = [
  { width: 844, height: 390 },
  { width: 852, height: 393 },
  { width: 915, height: 412 },
] as const

for (const viewport of LANDSCAPE_VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height} の横画面`, () => {
    test.use({ viewport })

    for (const game of GAME_CATALOG) {
      test(`${game.title}の初期画面を操作できる [${game.slug}]`, async ({ page }) => {
        test.setTimeout(60_000)
        const pageErrors = capturePageErrors(page)

        await page.goto('/', { waitUntil: 'domcontentloaded' })
        const gameLink = page.getByRole('link', { name: game.title, exact: true })
        await expect(gameLink).toBeVisible()
        await gameLink.click()

        await expect(page).toHaveURL(new RegExp(`/games/${game.slug}/?$`))
        // 3D地球儀などの大きな遅延chunkも、経過時間ではなく実際の初期表示を待つ。
        await expect(page.getByRole('heading', { name: game.title, exact: true })).toBeVisible({ timeout: 15_000 })

        const backButton = page.locator('[data-game-back-button]')
        await expect(backButton).toBeVisible()
        await expect(backButton).toBeInViewport()
        const backButtonBox = await backButton.boundingBox()
        expect(backButtonBox?.width).toBeGreaterThanOrEqual(44)
        expect(backButtonBox?.height).toBeGreaterThanOrEqual(44)

        // サーキットレースは背景の3Dシーン上に独立して載るため、タイトルとの
        // 矩形上の重なりを許容する。それ以外は文字を隠さないことを保証する。
        if (game.slug !== 'circuit-racing') {
          const headingBox = await visibleTextBox(page.getByRole('heading', { name: game.title, exact: true }))
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
        expect(pageErrors, `${game.title} (${game.slug}) の横画面初期表示でruntime errorが発生`).toEqual([])

        // 回転後に古い寸法が残らないことを確認してから、必須操作を実際に使う。
        await page.setViewportSize({ width: viewport.height, height: viewport.width })
        await page.setViewportSize(viewport)
        await expect(backButton).toBeInViewport()
        await backButton.click()
        await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
      })
    }
  })
}
