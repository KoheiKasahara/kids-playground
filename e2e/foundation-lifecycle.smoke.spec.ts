import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('保存不可でも狭い縦画面で結果と記録を確認して再挑戦できる', async ({ page }) => {
  const errors = capturePageErrors(page)
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (key === 'pyoko-touch-progress-v1') throw new DOMException('full', 'QuotaExceededError')
      original.call(this, key, value)
    }
  })
  await page.clock.install()
  await page.goto('/games/pyoko-touch')
  await page.getByRole('button', { name: 'やさしい ゆっくり でてくる', exact: true }).click()
  await page.clock.runFor(30_000)
  await expect(page.getByText(/きろくを ほぞんできませんでした/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'もういちど', exact: true })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/foundation-storage-portrait.png' })
  await page.getByRole('button', { name: 'むずかしさをかえる', exact: true }).click()
  await expect(page.getByRole('img', { name: 'クリアずみ ほし 1こ', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'やさしい ゆっくり でてくる', exact: true }).click()
  await expect(page.getByText('のこり 30びょう', { exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
