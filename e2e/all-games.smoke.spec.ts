import { expect, test } from '@playwright/test'
import { GAME_CATALOG } from '../src/games/gameCatalog'
import { capturePageErrors } from './support/runtimeErrors'

/**
 * Nightly-only route smoke coverage.
 *
 * GAME_CATALOG is also the source for the Home cards, so adding a new game to
 * the app automatically adds it to this sweep. The test deliberately stops
 * at the game's root screen: gameplay behavior belongs to unit/DOM tests or
 * focused E2E tests, not to this cross-app availability check.
 */
for (const game of GAME_CATALOG) {
  test(`メニューから${game.title}の初期画面を開ける [${game.slug}]`, async ({ page }) => {
    const pageErrors = capturePageErrors(page)

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()

    const gameLink = page.getByRole('link', { name: game.title, exact: true })
    await expect(gameLink).toBeVisible()
    await gameLink.click()

    await expect(page).toHaveURL(new RegExp(`/games/${game.slug}/?$`))
    await expect(page.getByRole('heading', { name: game.title, exact: true })).toBeVisible()

    // `pageerror` covers uncaught exceptions. Harmless console warnings are
    // intentionally ignored so routine browser/library warnings do not flake Nightly.
    expect(pageErrors, `${game.title} (${game.slug}) の初期表示でruntime errorが発生`).toEqual([])
  })
}
