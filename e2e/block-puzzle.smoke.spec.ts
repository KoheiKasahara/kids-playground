import { expect, test } from '@playwright/test'

test('メニューからブロックパズルを開き、じゆうに ならべるでパーツを盤面へ置ける', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const gameLink = page.getByRole('link', { name: 'ブロックパズル', exact: true })
  await expect(gameLink).toBeVisible()
  await gameLink.click()

  await expect(page).toHaveURL(/\/games\/block-puzzle\/?$/)
  await expect(page.getByRole('heading', { name: 'ブロックパズル', exact: true })).toBeVisible()

  // モードえらびから「じゆうに ならべる」へ入る。
  await page.getByRole('button', { name: 'じゆうに ならべる を えらぶ' }).click()
  await expect(page.getByRole('heading', { name: 'じゆうに ならべる', exact: true })).toBeVisible()

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

test('おちてくる ブロックで、ばしょをえらんで おとせる', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  // Select the L piece: its first cell is not its leftmost cell.
  await page.addInitScript(() => {
    Math.random = () => 0.8
  })
  await page.goto('/games/block-puzzle', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'おちてくる ブロック を えらぶ' }).click()
  await expect(page.getByRole('heading', { name: /おちてくる ブロック/ })).toBeVisible()

  // スマホ縦（390×844）で、盤面・操作・はやさが横スクロールなしに収まっていること。
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

  // 置きたい列をえらぶと着地予定が見え、おとすと積まれる。
  await page.getByRole('button', { name: /^よこ1 に うごかす/ }).click()
  const ghost = page.getByTestId('falling-ghost')
  const expectedCells = ['0,11', '1,11', '2,10', '2,11']
  await expect(ghost).toHaveAttribute('data-shape-id', 'l')
  await expect.poll(async () => (await ghost.getAttribute('data-cells'))?.split(' ').sort()).toEqual(expectedCells)

  await page.getByRole('button', { name: 'おとす' }).click()
  await expect(page.getByTestId('falling-settled')).toHaveCount(1)
  await expect.poll(async () => (
    await page.getByTestId('falling-settled').getAttribute('data-cells')
  )?.split(' ').sort()).toEqual(expectedCells)

  expect(pageErrors).toEqual([])
})
