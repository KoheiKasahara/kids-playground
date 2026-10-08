import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { EMPTY_PAINT } from './paint'
import { createLump } from './pottery'
import { createRokuroScene, type RokuroView } from './rokuroScene'
import { TARGETS } from './targets'

const mock = vi.hoisted(() => ({ render: vi.fn(), dispose: vi.fn(), disconnect: vi.fn(), environmentDispose: vi.fn() }))
vi.mock('three', async importOriginal => {
  const real = await importOriginal<typeof import('three')>()
  return {
    ...real,
    WebGLRenderer: class {
      domElement = document.createElement('canvas')
      shadowMap = { enabled: false, type: 0 }
      outputColorSpace = ''
      setClearColor() {}
      setPixelRatio() {}
      setSize() {}
      render = mock.render
      dispose = mock.dispose
    },
    PMREMGenerator: class {
      fromScene() { return { texture: new real.Texture(), dispose: mock.environmentDispose } }
      dispose() {}
    },
  }
})
vi.mock('./sounds', () => ({ playPaintSound: vi.fn(), playSculptSound: vi.fn() }))

let frames: Map<number, FrameRequestCallback>
let serial = 0
let now = 0
beforeEach(() => {
  vi.clearAllMocks()
  frames = new Map()
  now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.stubGlobal('requestAnimationFrame', vi.fn((fn: FrameRequestCallback) => { frames.set(++serial, fn); return serial }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect = mock.disconnect })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

function runFrames(count: number) {
  for (let i = 0; i < count; i++) {
    now += 16
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach(fn => fn(now))
  }
}

const baseView: RokuroView = { phase: 'shape', profile: createLump(), paint: EMPTY_PAINT, brush: null, brushColor: 'red', target: null, kind: 'cup', cursor: null }

function setup(view: Partial<RokuroView> = {}) {
  const host = document.createElement('div')
  document.body.append(host)
  const callbacks = { status: vi.fn(), profile: vi.fn(), stroke: vi.fn() }
  const scene = createRokuroScene(host, { ...baseView, ...view }, callbacks)
  return { host, callbacks, scene }
}

/** jsdom の host は 0×0 なので、clientX/Y = 0.5 が がめんの まんなかに なる。 */
function press(host: HTMLElement, type: 'pointerdown' | 'pointermove' | 'pointerup', x = 0.5, y = 0.5) {
  const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true, cancelable: true })
  Object.assign(event, { pointerId: 1, isPrimary: true })
  host.dispatchEvent(event)
}

test('じゅんびが できたら ready を しらせ、ろくろが まわる あいだ かきつづける', () => {
  const { callbacks, scene } = setup()
  expect(callbacks.status).toHaveBeenLastCalledWith('ready')
  runFrames(3)
  expect(mock.render).toHaveBeenCalledTimes(3)
  expect(frames.size).toBe(1)
  scene.dispose()
})

test('ゆびで おして はなすと、ほそく なった かたちを わたす', () => {
  const { host, callbacks, scene } = setup()
  press(host, 'pointerdown')
  runFrames(20)
  expect(callbacks.profile).not.toHaveBeenCalled()
  press(host, 'pointerup')
  expect(callbacks.profile).toHaveBeenCalledOnce()
  const profile = callbacks.profile.mock.calls[0]![0]
  expect(profile.height).toBe(createLump().height)
  expect(Math.min(...profile.radii)).toBeLessThan(0.8)
  // React から もどってきた おなじ かたちでは アニメーションしなおさない。
  scene.sync({ ...baseView, profile })
  scene.dispose()
})

test('ふでを もって さわると、まわる うつわに せんが のこる', () => {
  const { host, callbacks, scene } = setup({ phase: 'paint', brush: 'thick', brushColor: 'blue' })
  press(host, 'pointerdown')
  runFrames(30)
  press(host, 'pointerup')
  expect(callbacks.stroke).toHaveBeenCalledOnce()
  const stroke = callbacks.stroke.mock.calls[0]![0]
  expect(stroke).toMatchObject({ color: 'blue', brush: 'thick' })
  expect(stroke.points.length).toBeGreaterThan(5)
  for (const [u, v] of stroke.points) {
    expect(u).toBeGreaterThanOrEqual(0)
    expect(u).toBeLessThan(1)
    expect(v).toBeGreaterThan(0.3)
    expect(v).toBeLessThan(1)
  }
  scene.dispose()
})

test('ぜんぶ ぬる モード・かま・できあがりでは さわっても かわらない', () => {
  for (const phase of ['paint', 'bake', 'done'] as const) {
    const { host, callbacks, scene } = setup({ phase })
    press(host, 'pointerdown')
    runFrames(10)
    press(host, 'pointerup')
    expect(callbacks.profile).not.toHaveBeenCalled()
    expect(callbacks.stroke).not.toHaveBeenCalled()
    scene.dispose()
  }
})

test('かまで やいて できあがりまで、おだい・かざりを きりかえても こわれない', () => {
  const { scene } = setup({ target: TARGETS[4]!.profile })
  runFrames(2)
  scene.sync({ ...baseView, phase: 'paint', target: TARGETS[4]!.profile, paint: { base: 'pink', strokes: [] } })
  scene.sync({ ...baseView, phase: 'bake', paint: { base: 'pink', strokes: [] } })
  runFrames(200)
  for (const kind of ['vase', 'cup', 'bowl', 'plate', 'jar'] as const) {
    const target = TARGETS.find(entry => entry.kind === kind)!
    scene.sync({ ...baseView, phase: 'done', kind, profile: target.profile, paint: { base: 'pink', strokes: [] } })
    runFrames(5)
  }
  expect(scene.capture()).toBeNull()
  scene.sync({ ...baseView, phase: 'shape' })
  runFrames(2)
  scene.dispose()
})

test('とじると canvas・observer・RAF・WebGL を のこさない', () => {
  const { host, callbacks, scene } = setup()
  expect(host.querySelectorAll('canvas')).toHaveLength(1)
  scene.dispose()
  expect(host.querySelector('canvas')).toBeNull()
  expect(frames.size).toBe(0)
  expect(mock.disconnect).toHaveBeenCalledOnce()
  expect(mock.dispose).toHaveBeenCalledOnce()
  expect(mock.environmentDispose).toHaveBeenCalledOnce()
  press(host, 'pointerdown')
  press(host, 'pointerup')
  expect(callbacks.profile).not.toHaveBeenCalled()
})

test('WebGL の コンテキストが きえたら エラーを しらせて かくのを やめる', () => {
  const { host, callbacks, scene } = setup()
  host.querySelector('canvas')!.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(callbacks.status).toHaveBeenLastCalledWith('error')
  expect(frames.size).toBe(0)
  runFrames(3)
  expect(mock.render).not.toHaveBeenCalled()
  scene.dispose()
})
