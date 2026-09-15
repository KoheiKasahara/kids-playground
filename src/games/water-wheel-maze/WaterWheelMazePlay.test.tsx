import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import WaterWheelMazePlay from './WaterWheelMazePlay'
import { STAGES } from './stages'
import { WaterMaze } from './waterMaze'

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
let now: number

/** えがく ための 2D context。うけた 命令は すてて、呼べること だけを 保証する。 */
function stubContext() {
  const gradient = { addColorStop: () => {} }
  return new Proxy({} as Record<string, unknown>, {
    get: (_target, key) =>
      key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {},
    set: () => true,
  }) as unknown as CanvasRenderingContext2D
}

beforeEach(() => {
  frames = new Map(); nextFrame = 0; now = 0
  localStorage.clear()
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    stubContext() as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, width: 240, height: 360, right: 240, bottom: 360, toJSON() {} })
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear()
  for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) {
    Reflect.deleteProperty(HTMLCanvasElement.prototype, method)
  }
})

function frame(count = 1) {
  for (let step = 0; step < count; step++) {
    now += 20
    act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(now)) })
  }
}
/** じょうけんが そろうまで こまを すすめる。 */
function frameUntil(done: () => boolean, limit = 1500) {
  for (let step = 0; step < limit && !done(); step++) frame()
  return done()
}

function openStage(name: RegExp) {
  // step は 毎こま よばれるので、ここから ばんめんの 本体を うけとる。
  const step = vi.spyOn(WaterMaze.prototype, 'step')
  render(<MemoryRouter><WaterWheelMazePlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name }))
  frame()
  return { step, maze: step.mock.instances[0] as WaterMaze }
}
const canvas = () => screen.getByLabelText(/^まるい めいろ。/)
const meter = () => screen.getByRole('progressbar')

test('ステージを えらぶと めいろが ひらき、まわさなければ 水は おちない', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  expect(screen.getByText('1 / 6')).toBeVisible()
  expect(meter()).toHaveAttribute('aria-label', 'かんらんしゃに のった どうぶつ 0 / 6')
  expect(screen.getByRole('status')).toHaveTextContent(STAGES[0].hint)

  frame(150)
  expect(maze.caught).toBe(0)
  expect(maze.rotation).toBe(0)
})

test('ゆびで なぞると 円盤が まわり、はなすと とまる', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  // 盤の まんなかは (120, 104)。その まわりを ぐるりと なぞる。
  fireEvent.pointerDown(canvas(), { clientX: 200, clientY: 104, pointerId: 1, button: 0, isPrimary: true })
  fireEvent.pointerMove(canvas(), { clientX: 190, clientY: 150, pointerId: 1 })
  frame(6)
  expect(maze.rotation).toBeGreaterThan(0)

  const held = maze.rotation
  fireEvent.pointerUp(canvas(), { clientX: 190, clientY: 150, pointerId: 1 })
  fireEvent.pointerMove(canvas(), { clientX: 120, clientY: 220, pointerId: 1 })
  frame(6)
  expect(maze.rotation).toBe(held)
})

test('まんなかを つまんでも 円盤は あばれない', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  // 240x360 に うつした 盤の まんなかは (120, 104)。その すぐ そばを つまむ。
  fireEvent.pointerDown(canvas(), { clientX: 123, clientY: 107, pointerId: 1, button: 0, isPrimary: true })
  fireEvent.pointerMove(canvas(), { clientX: 117, clientY: 101, pointerId: 1 })
  frame(4)
  expect(maze.rotation).toBe(0)
})

test('やじるしキーでも 左右に まわせる', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  fireEvent.keyDown(canvas(), { key: 'ArrowRight' })
  frame(2)
  const right = maze.rotation
  expect(right).toBeGreaterThan(0)
  fireEvent.keyDown(canvas(), { key: 'ArrowLeft' })
  fireEvent.keyDown(canvas(), { key: 'ArrowLeft' })
  frame(2)
  expect(maze.rotation).not.toBe(right)
})

test('ボタンは おしっぱなしで まわり つづけ、はなすと とまる', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  const right = screen.getByRole('button', { name: 'みぎへ まわす' })
  fireEvent.pointerDown(right)
  frame(10)
  const spinning = maze.rotation
  expect(spinning).toBeGreaterThan(0)
  frame(10)
  expect(maze.rotation).not.toBe(spinning)

  fireEvent.pointerUp(right)
  frame(5)
  const stopped = maze.rotation
  frame(10)
  expect(maze.rotation).toBe(stopped)
})

test('まわし つづけると みずが とどき、かんらんしゃが まわって クリアする', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  const right = screen.getByRole('button', { name: 'みぎへ まわす' })
  fireEvent.pointerDown(right)
  expect(frameUntil(() => maze.caught >= STAGES[0].need)).toBe(true)
  fireEvent.pointerUp(right)

  expect(meter()).toHaveAttribute('aria-label', 'かんらんしゃに のった どうぶつ 6 / 6')
  // ゴールしても すぐには 止めない。のこりの みずを とどけられる。
  expect(screen.getByRole('status')).toHaveTextContent('ぜんいん のれたよ')

  expect(frameUntil(() => screen.queryByRole('heading', { name: 'かんらんしゃが まわった！' }) !== null)).toBe(true)
  expect(JSON.parse(localStorage.getItem('water-wheel-maze-progress-v1') ?? '{}')).toHaveProperty(STAGES[0].id)
  expect(screen.getByRole('button', { name: 'つぎへ →' })).toBeVisible()
})

test('もういちど で はじめから やりなおせる', () => {
  const { maze } = openStage(/^1 はじめての みずみち/)
  const right = screen.getByRole('button', { name: 'みぎへ まわす' })
  fireEvent.pointerDown(right)
  expect(frameUntil(() => maze.caught > 0, 600)).toBe(true)
  fireEvent.pointerUp(right)

  fireEvent.click(screen.getAllByRole('button', { name: /もういちど/ })[0])
  frame()
  expect(maze.caught).toBe(0)
  expect(maze.rotation).toBe(0)
  expect(maze.remaining).toBe(maze.total)
  expect(meter()).toHaveAttribute('aria-label', 'かんらんしゃに のった どうぶつ 0 / 6')
})

test('ステージ / もどる で えらぶ画面に もどる', () => {
  openStage(/^2 かべが ふえた/)
  fireEvent.click(screen.getByRole('button', { name: /ステージを えらぶ/ }))
  expect(screen.getByRole('heading', { name: 'ぐるぐる すいしゃ' })).toBeVisible()

  fireEvent.click(screen.getByRole('button', { name: /^2 かべが ふえた/ }))
  frame()
  fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
  expect(screen.getByRole('heading', { name: 'ぐるぐる すいしゃ' })).toBeVisible()
})

test('ばんめんを ひらけない ときは その ことを つたえる', () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  render(<MemoryRouter><WaterWheelMazePlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: /^1 はじめての みずみち/ }))
  expect(screen.getByRole('status')).toHaveTextContent('ばんめんを ひらけなかったよ')
})
