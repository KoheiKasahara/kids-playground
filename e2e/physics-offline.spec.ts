import { expect, test } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

test('Rapier WASM is precached within the asset limit and initializes physics after an offline reload', async ({ page, context }) => {
  test.setTimeout(120_000)
  const errors = capturePageErrors(page)
  await page.goto('/')
  await page.evaluate(() => navigator.serviceWorker.ready)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  const wasm = await page.evaluate(async () => {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      const request = (await cache.keys()).find(entry => /\/assets\/rapier3d-[a-f0-9]+\.wasm/.test(entry.url))
      if (!request) continue
      const response = await cache.match(request)
      if (response) return { url: request.url, bytes: (await response.arrayBuffer()).byteLength }
    }
    return null
  })
  expect(wasm).not.toBeNull()
  expect(wasm!.bytes).toBeGreaterThan(1024 * 1024)
  expect(wasm!.bytes).toBeLessThanOrEqual(3 * 1024 * 1024)

  // A full navigation resets the module/init cache. WASM must load from the
  // Service Worker, rather than an already initialized online Rapier instance.
  await context.setOffline(true)
  await page.goto('/games/crane-game')
  await page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click()
  await page.getByRole('button', { name: 'あそぶ！', exact: true }).click()
  const scene = page.getByTestId('crane-scene')
  await expect(scene).toHaveAttribute('data-ready', 'true')
  const parked = await scene.getAttribute('data-claw-x')
  await page.getByRole('button', { name: 'よこに うごかす', exact: true }).click()
  await expect.poll(() => scene.getAttribute('data-claw-x')).not.toBe(parked)
  await page.getByRole('button', { name: 'よこに うごくのを とめる', exact: true }).click()
  await page.getByRole('button', { name: 'つかむ', exact: true }).click()
  await expect(scene).not.toHaveAttribute('data-phase', 'idle')
  await expect(scene).toHaveAttribute('data-phase', 'idle', { timeout: 30_000 })
  expect(errors).toEqual([])
})

test.describe('WASM fetch recovery', () => {
  test.use({ serviceWorkers: 'block' })

  test('a failed WASM request can be retried without reloading the game page', async ({ page }) => {
    const errors = capturePageErrors(page)
    let requests = 0
    await page.route('**/rapier3d-*.wasm', route => {
      requests++
      return requests === 1
        ? route.fulfill({ status: 503, body: 'temporary WASM download failure' })
        : route.continue()
    })
    await page.goto('/games/marble-course')
    await expect(page.getByText('じゅんびを やりなおそう', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'もういちど', exact: true }).click()
    const roll = page.getByRole('button', { name: /ビーだま ころがす！/ })
    await expect(roll).toBeEnabled()
    await roll.click()
    await expect(page.getByRole('button', { name: 'つくるに もどる', exact: true })).toBeVisible()
    expect(requests).toBe(2)
    expect(errors).toEqual([])
  })
})
