import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('3Dレースを操作して退出し、新しいengineで再入場できる [circuit-racing]', async ({ page }) => {
  const errors = capturePageErrors(page)
  await page.goto('/')
  await page.getByRole('link', { name: 'サーキットレース', exact: true }).click()
  const begin = page.getByRole('button', { name: 'レースを はじめる', exact: true })
  // モデル・WebGL初期化を示す実際のready状態を待つ。経過秒や順位には依存しない。
  await expect(begin).toBeEnabled({ timeout: 15_000 })
  await begin.click()
  await page.getByRole('button', { name: 'みちばた', exact: true }).click()
  await expect(page.getByRole('button', { name: 'みちばた', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('canvas')).toHaveCount(1)
  await page.getByRole('button', { name: /えらびなおす/ }).click()
  await page.locator('[data-game-back-button]').click()
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(0)
  await page.getByRole('link', { name: 'サーキットレース', exact: true }).click()
  await expect(begin).toBeEnabled({ timeout: 15_000 })
  await begin.click()
  await expect(page.getByRole('region', { name: 'レースの そうさ', exact: true })).toBeVisible()
  await expect(page.locator('canvas')).toHaveCount(1)
  expect(errors).toEqual([])
})
