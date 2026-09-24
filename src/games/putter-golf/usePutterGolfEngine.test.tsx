import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GOLF_COURSES } from './golfCourses'
import { aimPose, viewHeading } from './golfCamera'
import type { GolfEvent } from './golfWorld'
import { aimFromDrag, usePutterGolfEngine, type EngineEvent, type GolfCamera, type GolfFeedback } from './usePutterGolfEngine'

const mocks = vi.hoisted(() => ({ initialize: vi.fn<() => Promise<void>>(), createScene: vi.fn(), createWorld: vi.fn() }))
vi.mock('../../physics/rapierLoader', () => ({ initializeRapier: mocks.initialize }))
vi.mock('./golfScene', () => ({ createGolfScene: mocks.createScene }))
vi.mock('./golfWorld', () => ({ createGolfWorld: mocks.createWorld }))

let frame: FrameRequestCallback | undefined
let clock = 0
function runFrames(count: number, stepMs = 50) {
  act(() => { for (let i = 0; i < count; i++) { clock += stepMs; frame?.(clock) } })
}
function fakeWorld() {
  let events: GolfEvent[] = []
  const state = { phase: 'ready' as 'ready' | 'rolling' | 'holed' | 'out', position: { x: 0, y: 0.15, z: 4.5 } }
  return {
    state,
    queue(event: GolfEvent) { events.push(event) },
    get phase() { return state.phase },
    time: 0,
    restPosition: state.position,
    ball: () => ({ position: { ...state.position }, rotation: { x: 0, y: 0, z: 0, w: 1 }, velocity: { x: 0, y: 0, z: 0 } }),
    motion: () => ({ windmills: [], gates: [], critters: [] }),
    step: vi.fn(),
    consumeEvents: () => { const next = events; events = []; return next },
    shoot: vi.fn((_direction: { x: number; z: number }, power: number) => {
      if (state.phase !== 'ready') return false
      state.phase = 'rolling'
      events.push({ kind: 'shot', power, position: state.position })
      return true
    }),
    placeBall: vi.fn((point: { x: number; z: number }) => { state.phase = 'ready'; state.position = { x: point.x, y: 0.15, z: point.z }; return state.position }),
    returnToRest: vi.fn(() => { state.phase = 'ready'; return state.position }),
    aimPath: vi.fn(() => [{ x: 0, y: 0.15, z: 4.5 }, { x: 0, y: 0.15, z: 1 }]),
    suggestShot: vi.fn(() => ({ direction: { x: 0, z: -1 }, power: 0.63, target: { x: 0, z: -4.1 } })),
    dispose: vi.fn(),
  }
}
type FakeWorld = ReturnType<typeof fakeWorld>

beforeEach(() => {
  clock = 0
  mocks.initialize.mockReset().mockResolvedValue()
  mocks.createScene.mockReset().mockImplementation((host: HTMLDivElement) => {
    const canvas = document.createElement('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 400, right: 400, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })
    canvas.setPointerCapture = vi.fn()
    canvas.releasePointerCapture = vi.fn()
    host.appendChild(canvas)
    return {
      renderer: { domElement: canvas },
      camera: {},
      aspect: 1,
      pickGround: vi.fn(() => ({ x: 3, z: 4.5 })),
      setHole: vi.fn(), setBallStyle: vi.fn(), syncBall: vi.fn(), syncGadgets: vi.fn(), setFlagLifted: vi.fn(),
      setAim: vi.fn(), swingClub: vi.fn(), setHint: vi.fn(), pulseBumper: vi.fn(), effect: vi.fn(), setCamera: vi.fn(),
      resize: vi.fn(), render: vi.fn(),
      stats: () => ({ calls: 31, triangles: 9000 }),
      dispose: vi.fn(() => canvas.remove()),
    }
  })
  mocks.createWorld.mockReset().mockImplementation(fakeWorld)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frame = callback; return 1 })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); frame = undefined })

type Props = { holeIndex?: number; active?: boolean; attempt?: number; camera?: GolfCamera }
function setup(initial: Props = {}) {
  const harness = { status: [] as string[], feedback: [] as GolfFeedback[], events: [] as EngineEvent[] } as {
    status: string[]; feedback: GolfFeedback[]; events: EngineEvent[]; host: HTMLDivElement; engine: ReturnType<typeof usePutterGolfEngine>
  }
  function Screen({ holeIndex = 0, active = true, attempt = 0, camera = 'ball' }: Props) {
    const engine = usePutterGolfEngine({
      course: GOLF_COURSES[0]!, holeIndex, attempt, ballStyle: 'white', bigCup: false, camera, active, reducedMotion: true,
      onStatus: status => harness.status.push(status), onFeedback: feedback => harness.feedback.push(feedback), onEvent: event => harness.events.push(event),
    })
    harness.engine = engine
    return <div ref={element => { harness.host = element as HTMLDivElement; engine.registerContainer(element) }} />
  }
  const view = render(<Screen {...initial} />)
  return { ...harness, get engine() { return harness.engine }, get host() { return harness.host }, rerender: (props: Props) => view.rerender(<Screen {...props} />), unmount: view.unmount }
}
const world = (index = 0) => mocks.createWorld.mock.results[index]!.value as FakeWorld
const scene = () => mocks.createScene.mock.results[0]!.value

function pointer(type: string, x: number, y: number) {
  return Object.assign(new Event(type, { bubbles: true, cancelable: true }), { pointerId: 7, button: 0, clientX: x, clientY: y })
}

it('ひっぱる量と向き: 下へ引くと前へ、左へ引くと右へ飛ぶ。小さい動きはうたない', () => {
  expect(aimFromDrag(4, 6, { x: 0, z: -1 }, 200)).toBeNull()
  const forward = aimFromDrag(0, 120, { x: 0, z: -1 }, 200)!
  expect(forward.direction.x).toBeCloseTo(0)
  expect(forward.direction.z).toBeCloseTo(-1)
  expect(forward.power).toBeCloseTo((120 - 14) / (200 - 14))
  expect(aimFromDrag(-100, 0, { x: 0, z: -1 }, 200)!.direction.x).toBeCloseTo(1)
  expect(aimFromDrag(0, 900, { x: 1, z: 0 }, 200)!).toEqual({ direction: { x: 1, z: 0 }, power: 1 })
})

it('見た目と世界を1つずつ作ってホールを読み込み、ぬけるときに解放する', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  expect(mocks.createScene).toHaveBeenCalledOnce()
  expect(mocks.createWorld).toHaveBeenCalledOnce()
  expect(scene().setHole).toHaveBeenCalledWith(GOLF_COURSES[0], GOLF_COURSES[0]!.holes[0], expect.anything(), 1)
  runFrames(3)
  expect(world().step).toHaveBeenCalled()
  expect(scene().render).toHaveBeenCalled()
  expect(scene().setAim).toHaveBeenCalledWith(expect.objectContaining({ power: 0.5 }))
  expect(app.host.dataset.hole).toBe('meadow-1')
  expect(app.host.dataset.phase).toBe('ready')
  expect(app.host.dataset.drawCalls).toBe('31')
  app.unmount()
  expect(world().dispose).toHaveBeenCalledOnce()
  expect(scene().dispose).toHaveBeenCalledOnce()
  expect(document.querySelectorAll('canvas')).toHaveLength(0)
})

it('「うつ！」はおすすめの向きと、えらんだ強さでうち、打った数を数える', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.setPower(0.85))
  act(() => app.engine.shoot())
  expect(world().shoot).toHaveBeenCalledWith({ x: 0, z: -1 }, 0.85)
  runFrames(3)
  expect(app.events.map(event => event.kind)).toContain('shot')
  expect(scene().swingClub).toHaveBeenCalledOnce()
  expect(app.host.dataset.strokes).toBe('1')
  expect(app.feedback.at(-1)).toMatchObject({ phase: 'rolling', strokes: 1 })
})

it('打ち終わったら、ボールの後ろから カップの ほうを 見るよう カメラを置き直す', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  runFrames(2)
  const next = { direction: { x: 1, z: 0 }, power: 0.5, target: { x: 3, z: 4.5 } }
  world().suggestShot.mockReturnValueOnce(next)
  world().state.phase = 'ready'
  world().queue({ kind: 'rest', position: world().state.position })

  runFrames(1)

  const ball = world().state.position
  const pose = aimPose(ball, viewHeading(ball, GOLF_COURSES[0]!.holes[0]!.cup, next.direction), 1)
  // カメラとボールの距離もわたす。手前の景色だけを消すために使う。
  expect(scene().setCamera).toHaveBeenLastCalledWith(pose, Math.hypot(pose.position.x - ball.x, pose.position.y - ball.y, pose.position.z - ball.z))
})

it('ホールぜんたいを見るときは、景色を消さない', async () => {
  const app = setup({ camera: 'overview' })
  await waitFor(() => expect(app.status).toContain('ready'))
  runFrames(2)
  expect(scene().setCamera).toHaveBeenLastCalledWith(expect.anything(), 0)
})

it('えらぶ画面の間は、うてない', async () => {
  const app = setup({ active: false })
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.shoot())
  expect(world().shoot).not.toHaveBeenCalled()
})

it('みぎへ むけると、うしろから見て右（+x）へ向きがかわる', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => { app.engine.turn(1); app.engine.turn(1) })
  act(() => app.engine.shoot())
  const [direction] = world().shoot.mock.calls[0]!
  expect(direction.x).toBeGreaterThan(0.15)
  expect(direction.z).toBeLessThan(-0.9)
})

it('画面をひっぱって はなすとうち、軽いタップはその場所をねらう', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  runFrames(2)
  const canvas = document.querySelector('canvas')!
  act(() => { canvas.dispatchEvent(pointer('pointerdown', 200, 200)); canvas.dispatchEvent(pointer('pointerup', 203, 202)) })
  expect(scene().pickGround).toHaveBeenCalled()
  expect(app.events.map(event => event.kind)).toContain('aimed')
  expect(world().shoot).not.toHaveBeenCalled()
  // カメラがねらった向きのうしろへ回ってから、ひっぱる。
  runFrames(2)
  act(() => {
    canvas.dispatchEvent(pointer('pointerdown', 200, 150))
    canvas.dispatchEvent(pointer('pointermove', 200, 260))
  })
  expect(app.feedback.at(-1)?.aiming).toBe(true)
  act(() => { canvas.dispatchEvent(pointer('pointerup', 200, 260)) })
  const [direction, power] = world().shoot.mock.calls[0]!
  // タップでねらった x=+3 の向きから、下へ引いた向き（カメラの前）へ変わっている。
  expect(direction.x).toBeGreaterThan(0.5)
  expect(power).toBeGreaterThan(0.5)
})

it('ヒントはおすすめの向きと強さに合わせ、ねらう点を見せる。おたすけはカップの近くへ置く', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.hint())
  runFrames(1)
  expect(scene().setHint).toHaveBeenLastCalledWith({ x: 0, z: -4.1 })
  act(() => app.engine.shoot())
  expect(world().shoot).toHaveBeenLastCalledWith({ x: 0, z: -1 }, 0.63)
  world().state.phase = 'ready'
  act(() => app.engine.assist())
  const [spot] = world().placeBall.mock.calls[0]!
  const cup = GOLF_COURSES[0]!.holes[0]!.cup
  expect(Math.hypot(spot.x - cup.x, spot.z - cup.z)).toBeLessThan(1.3)
  expect(app.events.map(event => event.kind)).toEqual(expect.arrayContaining(['hint', 'assisted']))
})

it('水に落ちたら しばらくして元の場所へ戻す', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  act(() => app.engine.shoot())
  world().state.phase = 'out'
  world().queue({ kind: 'splash', position: { x: 0, y: -0.5, z: 0 } })
  runFrames(4)
  expect(scene().effect).toHaveBeenCalledWith('splash', expect.anything())
  expect(world().returnToRest).not.toHaveBeenCalled()
  runFrames(30)
  expect(world().returnToRest).toHaveBeenCalledOnce()
  expect(app.events.at(-1)).toEqual({ kind: 'returned' })
})

it('つぎのホールへ進むと、前の世界を解放して新しいホールを作る', async () => {
  const app = setup()
  await waitFor(() => expect(app.status).toContain('ready'))
  app.rerender({ holeIndex: 1 })
  expect(world(0).dispose).toHaveBeenCalledOnce()
  expect(mocks.createWorld).toHaveBeenCalledTimes(2)
  expect(scene().setHole).toHaveBeenLastCalledWith(GOLF_COURSES[0], GOLF_COURSES[0]!.holes[1], expect.anything(), 2)
  app.rerender({ holeIndex: 1, attempt: 1 })
  expect(mocks.createWorld).toHaveBeenCalledTimes(3)
})

it('物理の読み込みに失敗しても、もういちどで作り直せる', async () => {
  mocks.initialize.mockRejectedValueOnce(new Error('wasm'))
  const app = setup()
  await waitFor(() => expect(app.status).toContain('error'))
  expect(mocks.createWorld).not.toHaveBeenCalled()
  act(() => app.engine.retry())
  await waitFor(() => expect(mocks.createWorld).toHaveBeenCalledOnce())
  expect(scene().dispose).toHaveBeenCalledOnce()
})

it('ぬけたあとに読み込みが終わっても、新しい世界を作らない', async () => {
  let resolve!: () => void
  mocks.initialize.mockImplementationOnce(() => new Promise<void>(done => { resolve = done }))
  const app = setup()
  app.unmount()
  await act(async () => { resolve(); await Promise.resolve() })
  expect(mocks.createWorld).not.toHaveBeenCalled()
})
