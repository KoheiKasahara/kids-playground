import { expect, test, type Locator } from '@playwright/test'
import { boxesOverlap, visibleTextBox, type LayoutBox } from './support/layout'
import { capturePageErrors } from './support/runtimeErrors'

// 初期画面は all-games-landscape で見る。ここでは遊ぶ画面へ進んでから重なる横画面の不具合を押さえる。
const LANDSCAPE_VIEWPORTS = [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
] as const

async function boxesOf(locator: Locator): Promise<LayoutBox[]> {
  const boxes = await Promise.all((await locator.all()).map((item) => item.boundingBox()))
  return boxes.filter((box): box is LayoutBox => box !== null)
}

function expectNoOverlap(groupA: LayoutBox[], groupB: LayoutBox[], message: string) {
  expect(groupA.length, message).toBeGreaterThan(0)
  expect(groupB.length, message).toBeGreaterThan(0)
  for (const a of groupA) {
    for (const b of groupB) expect(boxesOverlap(a, b), `${message}: ${JSON.stringify(a)} / ${JSON.stringify(b)}`).toBe(false)
  }
}

for (const viewport of LANDSCAPE_VIEWPORTS) {
  test.describe(`${viewport.width}x${viewport.height} の横画面であそぶ`, () => {
    test.use({ viewport })

    test('めいろの「もどる」がタイトルに重ならない [flag-roll-maze]', async ({ page }) => {
      const pageErrors = capturePageErrors(page)
      await page.goto('/games/flag-roll-maze')
      await page.getByRole('button', { name: 'にほん', exact: true }).click()
      await page.getByRole('button', { name: 'つぎへ', exact: true }).click()
      await page.getByRole('button', { name: 'スタート！', exact: true }).click()

      const heading = page.getByRole('heading', { name: 'こっきころころめいろ', exact: true })
      await expect(heading).toBeVisible({ timeout: 15_000 })
      const backButton = page.locator('[data-game-back-button]')
      await expect(backButton).toBeInViewport()
      expectNoOverlap(
        await boxesOf(backButton),
        [await visibleTextBox(heading)].filter((box): box is LayoutBox => box !== null),
        'めいろの「もどる」がタイトルに重なっています',
      )
      expect(pageErrors).toEqual([])
    })

    test('すしの ボタンが えらぶ ばしょに重ならない [kaiten-sushi]', async ({ page }) => {
      const pageErrors = capturePageErrors(page)
      await page.goto('/games/kaiten-sushi')
      await page.getByRole('button', { name: /おすしを つくる/ }).click()

      const options = page.getByRole('tabpanel').getByRole('button')
      await expect(options.first()).toBeVisible()
      const actions = page.getByRole('button', { name: /おまかせ|つぎ:|できあがり/ })
      expectNoOverlap(await boxesOf(options), await boxesOf(actions), 'すしの ボタンが えらぶ ばしょに重なっています')
      expect(pageErrors).toEqual([])
    })

    test('コマの ばしょが ぜんぶ見えて タイプえらびに重ならない [koma-battle]', async ({ page }) => {
      const pageErrors = capturePageErrors(page)
      await page.goto('/games/koma-battle')

      const fields = page.getByRole('group', { name: 'フィールドをえらぶ', exact: true }).getByRole('button')
      await expect(fields.first()).toBeVisible()
      for (const field of await fields.all()) await expect(field).toBeInViewport({ ratio: 1 })
      const typeButtons = page.getByRole('button', { name: /(あか|あお)コマ (バランス|アタック|スタミナ|ディフェンス)/ })
      expectNoOverlap(await boxesOf(fields), await boxesOf(typeButtons), 'コマの ばしょが タイプえらびに重なっています')
      expect(pageErrors).toEqual([])
    })
  })
}
