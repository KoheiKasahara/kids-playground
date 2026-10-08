// Temporary diagnostic branch only. No page.clock, forced clicks or outcome mocks.
import { expect, test, type Locator } from '@playwright/test'
import { capturePageErrors } from './support/runtimeErrors'

let started = 0
let timeline: { action: string; atMs: number; durationMs: number; ok: boolean }[] = []
async function action<T>(name: string, operation: () => Promise<T>): Promise<T> {
  const start = Date.now()
  let ok = false
  try { const result = await operation(); ok = true; return result }
  finally { timeline.push({ action: name, atMs: start - started, durationMs: Date.now() - start, ok }) }
}
test.beforeEach(() => { started = Date.now(); timeline = [] })
test.afterEach(async ({ page }, info) => {
  let timer: ReturnType<typeof setTimeout> | undefined
  const data = await Promise.race([
    page.evaluate(() => {
      const records = (window as typeof window & { __craneNativeDiagnostics?: Record<string, unknown>[] }).__craneNativeDiagnostics ?? []
      const rounded = (value: unknown): unknown => typeof value === 'number' ? Math.round(value * 10) / 10 : value
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, hidden: document.hidden },
        canvas: [...document.querySelectorAll('canvas')].map(c => ({ width: c.width, height: c.height, cssWidth: c.clientWidth, cssHeight: c.clientHeight })),
        scene: document.querySelector<HTMLElement>('[data-testid="crane-scene"]')?.dataset,
        engines: records.map(record => {
          const { intervals, phases, ...rest } = record
          const sorted = [...intervals as number[]].sort((a, b) => a - b)
          const percentile = (p: number) => rounded(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0)
          return {
            ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, rounded(value)])),
            rafIntervalMs: { samples: sorted.length, p50: percentile(0.5), p95: percentile(0.95), max: percentile(1) },
            phases: (phases as Record<string, unknown>[]).map(phase => Object.fromEntries(Object.entries(phase).map(([k, v]) => [k, rounded(v)]))),
          }
        }),
      }
    }).catch(error => ({ diagnosticReadError: String(error).slice(0, 120) })),
    new Promise(resolve => { timer = setTimeout(() => resolve({ diagnosticReadError: '10s capture deadline' }), 10_000) }),
  ])
  if (timer) clearTimeout(timer)
  console.log('CRANE_DIAGNOSTIC ' + JSON.stringify({ project: info.project.name, browser: page.context().browser()?.version(), node: process.version, test: info.title, status: info.status, testTimeoutMs: info.timeout, timeline, data }))
})


async function readySnapshot(scene: Locator) {
  let snapshot = { ready: null as string | null, canvas: 0, x: null as string | null }
  await expect.poll(async () => {
    snapshot = await scene.evaluate(element => ({ ready: element.getAttribute('data-ready'), canvas: document.querySelectorAll('canvas').length, x: element.getAttribute('data-claw-x') }))
    return snapshot
  }, { timeout: 20_000 }).toMatchObject({ ready: 'true', canvas: 1, x: expect.any(String) })
  return snapshot.x!
}
async function freshSideSnapshot(scene: Locator) {
  return scene.evaluate(element => new Promise<{ view: string | null; canvas: number; calls: string | null; triangles: string | null; sideRendersBefore: number; sideRendersAfter: number }>((resolve, reject) => {
    const diagnostic = (window as typeof window & { __craneNativeDiagnostics?: { renderedViews: { side: number } }[] }).__craneNativeDiagnostics?.at(-1)
    const sideRendersBefore = diagnostic?.renderedViews.side ?? 0
    let publications = 0
    const observer = new MutationObserver(records => {
      if (!records.some(record => record.attributeName === 'data-view') || element.getAttribute('data-view') !== 'side') return
      if (++publications < 2) return
      observer.disconnect()
      clearTimeout(timer)
      resolve({ view: element.getAttribute('data-view'), canvas: document.querySelectorAll('canvas').length, calls: element.getAttribute('data-draw-calls'), triangles: element.getAttribute('data-triangles'), sideRendersBefore, sideRendersAfter: diagnostic?.renderedViews.side ?? 0 })
    })
    const timer = setTimeout(() => { observer.disconnect(); reject(new Error('No two fresh side publications within20s')) }, 20_000)
    observer.observe(element, { attributes: true, attributeFilter: ['data-view'] })
  }))
}
test('native baseline cycle and post-grab side budget', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await action('goto', () => page.goto('/'))
  await action('open', () => page.getByRole('link', { name: 'クレーンゲーム', exact: true }).click())
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  const scene = page.getByTestId('crane-scene')
  await action('capsule', () => page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click())
  await action('begin enabled', () => expect(begin).toBeEnabled({ timeout: 20_000 }))
  await action('begin', () => begin.click())
  await action('ready', () => expect.poll(() => scene.getAttribute('data-ready'), { timeout: 20_000 }).toBe('true'))
  const parked = await action('parked', () => scene.getAttribute('data-claw-x'))
  await action('move click', () => page.getByRole('button', { name: 'よこに うごかす', exact: true }).click())
  await action('movement', () => expect.poll(() => scene.getAttribute('data-claw-x')).not.toBe(parked))
  await action('stop click', () => page.getByRole('button', { name: 'よこに うごくのを とめる', exact: true }).click())
  await action('grab click', () => page.getByRole('button', { name: 'つかむ', exact: true }).click())
  await action('nonidle', () => expect.poll(() => scene.getAttribute('data-phase')).not.toBe('idle'))
  await action('idle30', () => expect.poll(() => scene.getAttribute('data-phase'), { timeout: 30_000 }).toBe('idle'))
  expect(Number(await action('home', () => scene.getAttribute('data-claw-x')))).toBeCloseTo(-0.46, 2)
  await action('side click', () => page.getByRole('button', { name: 'よこから みる', exact: true }).click())
  await action('side attr', () => expect(scene).toHaveAttribute('data-view', 'side'))
  await action('canvas count', () => expect(page.locator('canvas')).toHaveCount(1))
  const raw = await action('budget snapshot', () => scene.evaluate(element => ({ calls: element.getAttribute('data-draw-calls'), triangles: element.getAttribute('data-triangles') })))
  expect(raw.calls).not.toBeNull()
  expect(raw.triangles).not.toBeNull()
  for (const value of [Number(raw.calls), Number(raw.triangles)]) {
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThan(0)
  }
  expect(Number(raw.calls)).toBeLessThan(90)
  expect(Number(raw.triangles)).toBeLessThan(120_000)
  expect(errors).toEqual([])
})

test('native baseline same-page live cleanup and reentry', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await action('goto', () => page.goto('/'))
  const gameLink = page.getByRole('link', { name: 'クレーンゲーム', exact: true })
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  const scene = page.getByTestId('crane-scene')
  const back = page.locator('header [data-game-back-button]')
  const move = page.getByRole('button', { name: 'よこに うごかす', exact: true })
  await action('open1', () => gameLink.click())
  await action('capsule', () => page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click())
  for (const entry of [1, 2]) {
    await action(`enabled${entry}`, () => expect(begin).toBeEnabled({ timeout: 20_000 }))
    await action(`begin${entry}`, () => begin.click())
    if (entry === 2) await action('controls visible2', () => expect(page.getByRole('region', { name: 'クレーンの そうさ', exact: true })).toBeVisible())
    await action(`ready${entry}`, () => expect(scene).toHaveAttribute('data-ready', 'true', { timeout: 20_000 }))
    await action(`canvas${entry}`, () => expect(page.locator('canvas')).toHaveCount(1))
    await action(`move enabled${entry}`, () => expect(move).toBeEnabled())
    const parked = await action(`parked${entry}`, () => scene.getAttribute('data-claw-x'))
    await action(`move${entry}`, () => move.click())
    await action(`movement${entry}`, () => expect.poll(() => scene.getAttribute('data-claw-x')).not.toBe(parked))
    if (entry === 1) {
      await action('back to select', () => back.click())
      await action('selection visible', () => expect(begin).toBeVisible())
      await action('back home', () => back.click())
      await action('home visible', () => expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible())
      await action('canvas removed', () => expect(page.locator('canvas')).toHaveCount(0))
      await action('open2', () => gameLink.click())
    }
  }
  expect(errors).toEqual([])
})

test('native batched cycle and post-grab side budget', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await action('goto', () => page.goto('/'))
  await action('open', () => page.getByRole('link', { name: 'クレーンゲーム', exact: true }).click())
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  const scene = page.getByTestId('crane-scene')
  await action('capsule', () => page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click())
  await action('begin', () => begin.click({ timeout: 20_000 }))
  const parked = await action('ready+canvas+parked', () => readySnapshot(scene))
  await action('move click', () => page.getByRole('button', { name: 'よこに うごかす', exact: true }).click())
  await action('movement', () => expect(scene).not.toHaveAttribute('data-claw-x', parked!))
  await action('stop click', () => page.getByRole('button', { name: 'よこに うごくのを とめる', exact: true }).click())
  await action('grab click', () => page.getByRole('button', { name: 'つかむ', exact: true }).click())
  await action('nonidle', () => expect(scene).not.toHaveAttribute('data-phase', 'idle'))
  let settled = { phase: null as string | null, x: null as string | null }
  await action('idle30+home snapshot', () => expect.poll(async () => {
    settled = await scene.evaluate(element => ({ phase: element.getAttribute('data-phase'), x: element.getAttribute('data-claw-x') }))
    return settled.phase
  }, { timeout: 30_000 }).toBe('idle'))
  expect(Number(settled.x)).toBeCloseTo(-0.46, 2)
  await action('side click', () => page.getByRole('button', { name: 'よこから みる', exact: true }).click())
  const raw = await action('fresh side+canvas+budget', () => freshSideSnapshot(scene))
  expect(raw.view).toBe('side')
  expect(raw.canvas).toBe(1)
  expect(raw.sideRendersAfter).toBeGreaterThan(raw.sideRendersBefore)
  expect(raw.calls).not.toBeNull()
  expect(raw.triangles).not.toBeNull()
  for (const value of [Number(raw.calls), Number(raw.triangles)]) {
    expect(Number.isFinite(value)).toBe(true)
    expect(value).toBeGreaterThan(0)
  }
  expect(Number(raw.calls)).toBeLessThan(90)
  expect(Number(raw.triangles)).toBeLessThan(120_000)
  expect(errors).toEqual([])
})

test('native batched same-page live cleanup and reentry', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = capturePageErrors(page)
  await action('goto', () => page.goto('/'))
  const gameLink = page.getByRole('link', { name: 'クレーンゲーム', exact: true })
  const begin = page.getByRole('button', { name: 'あそぶ！', exact: true })
  const scene = page.getByTestId('crane-scene')
  const back = page.locator('header [data-game-back-button]')
  const move = page.getByRole('button', { name: 'よこに うごかす', exact: true })
  await action('open1', () => gameLink.click())
  await action('capsule', () => page.getByRole('button', { name: 'カプセルの きかいを えらぶ', exact: true }).click())
  for (const entry of [1, 2]) {
    await action(`begin${entry}`, () => begin.click({ timeout: 20_000 }))
    if (entry === 2) await action('controls visible2', () => expect(page.getByRole('region', { name: 'クレーンの そうさ', exact: true })).toBeVisible())
    const parked = await action(`ready+canvas+parked${entry}`, () => readySnapshot(scene))
    await action(`move${entry}`, () => move.click({ timeout: 20_000 }))
    await action(`movement${entry}`, () => expect(scene).not.toHaveAttribute('data-claw-x', parked!))
    if (entry === 1) {
      await action('back to select', () => back.click())
      await action('selection visible', () => expect(begin).toBeVisible())
      await action('back home', () => back.click())
      await action('home visible', () => expect(page.getByRole('heading', { name: 'こどもミニゲーム', exact: true })).toBeVisible())
      await action('canvas removed', () => expect(page.locator('canvas')).toHaveCount(0))
      await action('open2', () => gameLink.click())
    }
  }
  expect(errors).toEqual([])
})
