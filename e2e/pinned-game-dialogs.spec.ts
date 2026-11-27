import { expect, test, type Locator } from '@playwright/test'

async function expectInView(button: Locator) {
  await expect(button).toBeInViewport({ ratio: 1 })
  await expect.poll(() => button.evaluate(el => {
    const r = el.getBoundingClientRect()
    return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2))
  })).toBe(true)
}

async function expectPinned(dialog: Locator, last: Locator) {
  const close = dialog.getByRole('button', { name: 'とじる', exact: true })
  await expectInView(close)
  const before = await close.boundingBox()
  await last.scrollIntoViewIfNeeded()
  await expect(last).toBeInViewport({ ratio: 1 })
  await expectInView(close)
  expect(await close.boundingBox()).toEqual(before)
}

for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }]) {
  test.describe(`${viewport.width}×${viewport.height} のダイアログ`, () => {
    test.use({ viewport, reducedMotion: 'reduce' })

    test('3Dどうぶつえんの地図と図鑑の操作ボタンはスクロールで隠れない', async ({ page }) => {
      await page.goto('/games/zoo-3d')
      await page.getByRole('button', { name: /ちずを ひらく/ }).tap()
      const dialog = page.getByRole('dialog')
      const close = dialog.getByRole('button', { name: 'とじる', exact: true })
      await expect(dialog.locator('[aria-current="location"]')).toBeFocused()
      await expectPinned(dialog, dialog.getByRole('button', { name: /どうぶつレースじょう/ }))
      await close.tap()
      await expect(dialog).toHaveCount(0)

      await page.getByRole('button', { name: /^ずかん（/ }).tap()
      const animals = dialog.getByRole('button', { name: /。スタンプ/ })
      await expectPinned(dialog, animals.last())
      await animals.last().tap()
      const back = dialog.getByRole('button', { name: 'もどる', exact: true })
      await expectInView(back)
      await expectInView(close)
      await back.tap()
      await expect(dialog).toHaveAccessibleName('どうぶつ ずかん')
      await page.keyboard.press('Escape')
      await expect(dialog).toHaveCount(0)
    })

    test('回転寿司のたからものは全件見られて閉じるボタンが隠れない', async ({ page }) => {
      await page.goto('/games/kaiten-sushi')
      await page.getByRole('button', { name: /たからもの/ }).tap()
      const dialog = page.getByRole('dialog', { name: /たからもの/ })
      const close = dialog.getByRole('button', { name: 'とじる', exact: true })
      const prizes = dialog.getByRole('listitem')
      // Opening the collection focuses Close. Scroll back to the first prize as well.
      await expect(close).toBeFocused()
      await prizes.first().scrollIntoViewIfNeeded()
      await expect(prizes.first()).toBeInViewport({ ratio: 1 })
      await expectPinned(dialog, prizes.last())
      await close.tap()
      await expect(dialog).toHaveCount(0)
    })
  })
}
