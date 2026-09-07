import { beforeEach, expect, test, vi } from 'vitest'

const init = vi.hoisted(() => vi.fn())
vi.mock('@dimforge/rapier3d-compat', () => ({ default: { init } }))
beforeEach(() => { vi.resetModules(); init.mockReset() })

test('同時のゲーム入場と再入場で初期化を共有する', async () => {
  init.mockResolvedValue(undefined)
  const { initializeRapier } = await import('./rapierLoader')
  const first = initializeRapier()
  expect(initializeRapier()).toBe(first)
  await first
  await initializeRapier()
  expect(init).toHaveBeenCalledTimes(1)
})

test('失敗を呼び出し側へ通知し次の入場で再試行する', async () => {
  init.mockRejectedValueOnce(new Error('wasm')).mockResolvedValue(undefined)
  const { initializeRapier } = await import('./rapierLoader')
  await expect(initializeRapier()).rejects.toThrow('wasm')
  await expect(initializeRapier()).resolves.toBeUndefined()
  expect(init).toHaveBeenCalledTimes(2)
})
