import { expect, test } from '@playwright/test'

test('メニューからブロックパズルを開き、パーツを盤面へ置ける', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const gameLink = page.getByRole('link', { name: 'ブロックパズル', exact: true })
  await expect(gameLink).toBeVisible()
  await gameLink.click()

  await expect(page).toHaveURL(/\/games\/block-puzzle\/?$/)
  await expect(page.getByRole('heading', { name: 'ブロックパズル', exact: true })).toBeVisible()

  // スマホ縦（390×844）で盤面もパーツ一覧も横スクロールなしに収まっていること。
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

  // 形を選んでタップすると、そのマスにブロックが置かれる。
  await page.getByRole('button', { name: 'しかく を えらぶ' }).click()
  await page.getByRole('button', { name: /^よこ2 たて2 / }).click()
  await expect(page.getByRole('button', { name: 'よこ2 たて2 しかく' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'よこ3 たて3 しかく' })).toBeVisible()

  // 未処理の例外は pageerror として通知される。
  expect(pageErrors).toEqual([])
})
