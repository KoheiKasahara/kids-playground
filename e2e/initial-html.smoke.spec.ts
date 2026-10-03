import { expect, test } from '@playwright/test'
import { GAME_CATALOG, gameRoutePath } from '../src/games/gameCatalog'
import { absoluteUrl } from '../src/seo/siteMeta'

test('built documents contain visible body, links and canonical without JavaScript', async ({ browser, request, baseURL }) => {
  const sitemap = await (await request.get('/sitemap.xml')).text()
  for (const pathname of ['/', ...GAME_CATALOG.map((entry) => gameRoutePath(entry.slug))]) {
    const response = await request.get(pathname)
    expect(response.status()).toBe(200)
    const html = await response.text()
    expect(html).toContain('<main id="initial-page"')
    expect(html.match(/<link\s+rel="canonical"/g)).toHaveLength(1)
    expect(html).toContain(`href="${absoluteUrl(pathname)}"`)
    expect(sitemap).toContain(`<loc>${absoluteUrl(pathname)}</loc>`)
    if (pathname !== '/') {
      expect(await (await request.get(`${pathname}.html`)).text()).toBe(html)
      expect(await (await request.get(`${pathname}/`)).text()).toBe(html)
    }
  }
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL })
  const page = await context.newPage()
  await page.goto('/')
  await expect(page.getByRole('main')).toBeVisible()
  await expect(page.getByRole('link')).toHaveCount(GAME_CATALOG.length)
  await page.getByRole('link', { name: GAME_CATALOG[0].title, exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(GAME_CATALOG[0].title)
  await expect(page.getByRole('main')).toContainText(GAME_CATALOG[0].seo.description)
  await expect(page.getByRole('link', { name: 'ほかのゲームを みる' })).toHaveAttribute('href', '/')
  await context.close()
})

test('initial content survives delayed JavaScript and is replaced by the live route', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/assets/*.js', async (route) => { await gate; await route.continue() })
  await page.goto('/games/rail-builder', { waitUntil: 'commit' })
  await expect(page.locator('#initial-page')).toBeVisible()
  await expect(page.getByRole('link', { name: 'ほかのゲームを みる' })).toHaveCount(1)
  release()
  await expect(page.locator('#initial-page')).toHaveCount(0)
  await expect(page.locator('#root')).not.toHaveAttribute('inert', '')
  await expect(page.getByRole('heading', { name: 'このゲームについて' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'ほかのゲームを みる' })).toHaveCount(1)
})
