import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test.use({ viewport: { width: 844, height: 390 } })

test('横向きピアノで鍵盤を押して離せる [piano-play]', async ({ page }) => {
  const errors = capturePageErrors(page)
  await page.goto('/games/piano-play')
  const key = page.getByRole('button', { name: 'ド C4', exact: true })
  await expect(key).toBeVisible()
  // 押下中の表示も確認するため、実タッチの開始/終了を分ける。
  const box = await key.boundingBox()
  if (!box) throw new Error('鍵盤の位置が取得できません')
  const session = await page.context().newCDPSession(page)
  const touchPoints = [{ x: box.x + box.width / 2, y: box.y + box.height * 0.8 }]
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints })
  await expect(key).toHaveAttribute('aria-pressed', 'true')
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect(key).toHaveAttribute('aria-pressed', 'false')
  await session.detach()
  await page.locator('[data-game-back-button]').click()
  await expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
