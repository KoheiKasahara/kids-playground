import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('メニューからこっきコロコロパズルの初期画面を開ける', async ({ page }) => {
  const pageErrors = capturePageErrors(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()

  const puzzleLink = page.getByRole('link', { name: 'こっきコロコロパズル', exact: true })
  await expect(puzzleLink).toBeVisible()
  await puzzleLink.click()

  await expect(page).toHaveURL(/\/games\/flag-roll-puzzle\/?$/)
  await expect(page.getByRole('heading', { name: 'こっきコロコロパズル', exact: true })).toBeVisible()

  // 未処理の例外は pageerror として通知される。console warning/error は対象にせず、
  // 意図的な警告でテストが過剰に不安定にならないようにする。
  expect(pageErrors).toEqual([])
})
