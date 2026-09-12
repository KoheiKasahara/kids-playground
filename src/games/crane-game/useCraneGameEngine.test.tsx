import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CRANE_MACHINES } from './craneMachines'
import { CLAW_TOP, HOME } from './craneRig'
import { useCraneGameEngine, type CraneAction, type CraneFeedback } from './useCraneGameEngine'
import type { CraneEvent } from './craneWorld'

const mocks = vi.hoisted(() => ({ initialize: vi.fn<() => Promise<void>>(), createScene: vi.fn(), createWorld: vi.fn() }))
vi.mock('../../physics/rapierLoader', () => ({ initializeRapier: mocks.initialize }))
vi.mock('./craneScene', () => ({ createCraneScene: mocks.createScene }))
vi.mock('./craneWorld', () => ({ createCraneWorld: mocks.createWorld }))

let frame: FrameRequestCallback | undefined
let clock = 0
/** 1フレームあたり最大0.1秒ぶんの物理が進む。dtが乗るのは2フレーム目以降。 */
function runFrames(count: number, stepMs = 100) {
  act(() => { for (let i = 0; i < count; i++) { clock += stepMs; frame?.(clock) } })
}
beforeEach(() => {
  clock = 0
  mocks.initialize.mockReset().mockResolvedValue()
  mocks.createScene.mockReset().mockImplementation((host: HTMLDivElement) => {
    const canvas = document.createElement('canvas')
    host.appendChild(canvas)
    return {
      renderer: { domElement: canvas },
      camera: {},
      view: 'front',
      setView: vi.fn(),
      resize: vi.fn(),
      pick: vi.fn(() => ({ x: 0.2, z: -0.1 })),
      syncClaw: vi.fn(),
      syncPrizes: vi.fn(),
      burst: vi.fn(),
      dust: vi.fn(),
      render: vi.fn(),
      stats: () => ({ calls: 42, triangles: 1000 }),
      dispose: vi.fn(() => canvas.remove()),
    }
  })
  mocks.createWorld.mockReset().mockImplementation(() => ({
    ready: true,
    remaining: 14,
    collected: 0,
    holding: null,
    blockedByPrize: false,
    clawPose: () => ({ position: { x: 0, y: CLAW_TOP, z: 0 }, fingers: [] }),
    prizes: () => [],
    consumeEvents: vi.fn<() => CraneEvent[]>(() => []),
    refill: vi.fn(),
    step: vi.fn(),
    dispose: vi.fn(),
  }))
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); frame = undefined })

type Harness = {
  engine: ReturnType<typeof useCraneGameEngine>
  host: HTMLDivElement
  feedback: CraneFeedback[]
  actions: CraneAction[]
  status: string[]
  rerenderWith: (options: { round?: number; view?: 'front' | 'side' }) => void
}

function setup(): Harness {
  const harness = { feedback: [] as CraneFeedback[], actions: [] as CraneAction[], status: [] as string[] } as Harness
  function Screen({ round = 0, view = 'front' as 'front' | 'side' }) {
    const engine = useCraneGameEngine({
      machine: CRANE_MACHINES[0]!,
      round,
      view,
      reducedMotion: false,
      onStatus: status => harness.status.push(status),
      onFeedback: feedback => harness.feedback.push(feedback),
      onEvent: () => {},
      onAction: action => harness.actions.push(action),
    })
    harness.engine = engine
    return <div data-testid="host" ref={element => { harness.host = element as HTMLDivElement; engine.registerContainer(element) }} />
  }
  const view = render(<Screen />)
  harness.rerenderWith = options => view.rerender(<Screen {...options} />)
  Object.assign(harness, { unmount: view.unmount })
  return Object.assign(harness, { unmount: view.unmount })
}

it('世界と見た目を1つずつ持ち、抜けるときに解放する', async () => {
  const app = setup() as Harness & { unmount: () => void }
  await waitFor(() => expect(app.status).toContain('ready'))
  expect(mocks.createScene).toHaveBeenCalledOnce()
  expect(mocks.createWorld).toHaveBeenCalledOnce()
  const scene = mocks.createScene.mock.results[0]!.value
  const world = mocks.createWorld.mock.results[0]!.value
  runFrames(2)
  expect(world.step).toHaveBeenCalled()
  expect(scene.syncPrizes).toHaveBeenCalled()
  expect(scene.render).toHaveBeenCalled()
  app.unmount()
  expect(world.dispose).toHaveBeenCalledOnce()
  expect(scene.dispose).toHaveBeenCalledOnce()
  expect(window.cancelAnimationFrame).toHaveBeenCalled()
  expect(document.querySelectorAll('canvas')).toHaveLength(0)
})

it('アームの状態を画面と data 属性へ知らせる', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  runFrames(3)
  expect(app.feedback.at(-1)).toMatchObject({ phase: 'idle', ready: true, remaining: 14, collected: 0, holding: false })
  expect(app.host.dataset.phase).toBe('idle')
  expect(app.host.dataset.remaining).toBe('14')
  expect(app.host.dataset.clawY).toBe(CLAW_TOP.toFixed(3))
  expect(app.host.dataset.drawCalls).toBe('42')
})

it('よこボタンでアームが動き出し、もう一度おすと止まる', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.move('x'))
  expect(app.actions).toContain('motor')
  runFrames(4)
  expect(Number(app.host.dataset.clawX)).toBeGreaterThan(HOME.x)
  act(() => app.engine.move('x'))
  expect(app.actions.at(-1)).toBe('stop')
})

it('つかむ動作は順番どおりに進み、終わると穴の上へ戻る', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.move('x'))
  runFrames(6)
  act(() => app.engine.move('x'))
  act(() => app.engine.grab())
  runFrames(3)
  expect(app.host.dataset.phase).not.toBe('idle')
  runFrames(90)
  expect(app.actions).toEqual(expect.arrayContaining(['bottom', 'grip', 'lifted', 'arrived', 'release', 'done']))
  expect(app.host.dataset.phase).toBe('idle')
  expect(Number(app.host.dataset.clawX)).toBeCloseTo(HOME.x, 3)
})

it('ケースをタップするとその場所へアームが向かう', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  const canvas = document.querySelector('canvas')!
  act(() => {
    canvas.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 1, button: 0, clientX: 10, clientY: 10 }))
    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 1, button: 0, clientX: 12, clientY: 11 }))
  })
  expect(mocks.createScene.mock.results[0]!.value.pick).toHaveBeenCalled()
  runFrames(40)
  expect(Number(app.host.dataset.clawX)).toBeCloseTo(0.2, 2)
  expect(Number(app.host.dataset.clawZ)).toBeCloseTo(-0.1, 2)
})

it('なぞった操作では行き先を変えない', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  const canvas = document.querySelector('canvas')!
  act(() => {
    canvas.dispatchEvent(Object.assign(new Event('pointerdown', { bubbles: true }), { pointerId: 2, button: 0, clientX: 10, clientY: 10 }))
    window.dispatchEvent(Object.assign(new Event('pointerup'), { pointerId: 2, button: 0, clientX: 90, clientY: 70 }))
  })
  expect(mocks.createScene.mock.results[0]!.value.pick).not.toHaveBeenCalled()
})

it('ならべ直しと見る向きの切り替えを世界と見た目へ伝える', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  const world = mocks.createWorld.mock.results[0]!.value
  const scene = mocks.createScene.mock.results[0]!.value
  app.rerenderWith({ round: 1 })
  expect(world.refill).toHaveBeenCalledWith(1)
  app.rerenderWith({ round: 1, view: 'side' })
  expect(scene.setView).toHaveBeenCalledWith('side')
})

it('読み込みに失敗しても、もういちどで作り直せる', async () => {
  mocks.initialize.mockRejectedValueOnce(new Error('wasm'))
  const app = setup()
  await waitFor(() => expect(app.status).toContain('error'))
  expect(mocks.createWorld).not.toHaveBeenCalled()
  act(() => app.engine.retry())
  await waitFor(() => expect(mocks.createWorld).toHaveBeenCalledOnce())
  expect(mocks.createScene.mock.results[0]!.value.dispose).toHaveBeenCalledOnce()
})

it('退出したあとに読み込みが終わっても、新しい世界を作らない', async () => {
  let resolve!: () => void
  mocks.initialize.mockImplementationOnce(() => new Promise<void>(done => { resolve = done }))
  const app = setup() as Harness & { unmount: () => void }
  app.unmount()
  await act(async () => { resolve(); await Promise.resolve() })
  expect(mocks.createWorld).not.toHaveBeenCalled()
})
