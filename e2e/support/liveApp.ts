import { expect, type Page } from '@playwright/test'

/** 静的な初期HTMLだけの表示を、Reactアプリの起動成功として扱わない。 */
export async function expectLiveApp(page: Page) {
  const app = page.locator('#root')
  await expect(page.locator('#initial-page')).toHaveCount(0)
  await expect(app).not.toHaveAttribute('inert', '')
  await expect(app).not.toHaveAttribute('aria-hidden', 'true')
  return app
}
