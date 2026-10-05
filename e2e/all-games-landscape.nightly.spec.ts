import { expect, test } from '@playwright/test'
import { GAME_CATALOG } from '../src/games/gameCatalog'
import { boxesOverlap, visibleTextBox } from './support/layout'
import { capturePageErrors } from './support/runtimeErrors'
import { expectLiveApp } from './support/liveApp'

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
        const app = await expectLiveApp(page)
        const gameLink = app.getByRole('link', { name: game.title, exact: true })
        await expect(gameLink).toBeVisible()
        await gameLink.click()

        await expect(page).toHaveURL(new RegExp(`/games/${game.slug}/?$`))
        await expectLiveApp(page)
        // 3D地球儀などの大きな遅延chunkも、経過時間ではなく実際の初期表示を待つ。
        const heading = app.getByRole('heading', { name: game.title, exact: true })
        const orientationGuide = page.getByRole('region', { name: '横向きであそぶ案内', exact: true })
        if (game.slug === 'pixel-kart') await expect(orientationGuide).toHaveCount(0)
        await expect(heading).toBeVisible({ timeout: 15_000 })

        // ドットカートの縦画面案内にも戻るボタンがある。横画面で使うヘッダーを明示し、
        // 回転中に2つのボタンが存在しても別の導線を選ばない。
        const backButton = page.locator(game.slug === 'pixel-kart'
          ? 'header [data-game-back-button]'
          : '[data-game-back-button]')
        await expect(backButton).toBeVisible()
        await expect(backButton).toBeInViewport()
        const backButtonBox = await backButton.boundingBox()
        expect(backButtonBox?.width).toBeGreaterThanOrEqual(44)
        expect(backButtonBox?.height).toBeGreaterThanOrEqual(44)

        // サーキットレースは背景の3Dシーン上に独立して載るため、タイトルとの
        // 矩形上の重なりを許容する。それ以外は文字を隠さないことを保証する。
        if (game.slug !== 'circuit-racing') {
          const headingBox = await visibleTextBox(heading)
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
        await expect.poll(() => page.evaluate(() => window.matchMedia('(orientation: portrait)').matches)).toBe(true)
        if (game.slug === 'pixel-kart') await expect(orientationGuide).toBeVisible()
        await page.setViewportSize(viewport)
        await expect.poll(() => page.evaluate(() => window.matchMedia('(orientation: landscape)').matches)).toBe(true)
        if (game.slug === 'pixel-kart') await expect(orientationGuide).toHaveCount(0)
        await expect(backButton).toBeVisible()
        await expect(backButton).toBeInViewport()
        await backButton.click()
        await expect(app.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
        expect(pageErrors, `${game.title} (${game.slug}) の回転・退出でruntime errorが発生`).toEqual([])
      })
    }
  })
}
