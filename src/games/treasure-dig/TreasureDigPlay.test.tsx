import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import TreasureDigPlay from './TreasureDigPlay'
import { STAGES } from './stages'
import { Cell, TreasureWorld } from './treasureWorld'

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
beforeEach(() => {
  frames = new Map(); nextFrame = 0
  localStorage.clear()
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: vi.fn(),
  } as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(
    { x: 0, y: 0, left: 0, top: 0, width: 240, height: 320, right: 240, bottom: 320, toJSON() {} })
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear()
  for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) Reflect.deleteProperty(HTMLCanvasElement.prototype, method)
})
function frame(time: number) {
  act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)) })
}
function openStage(name: RegExp) {
  const step = vi.spyOn(TreasureWorld.prototype, 'step')
  render(<MemoryRouter><TreasureDigPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name }))
  frame(100)
  return { step, world: step.mock.instances[0] as TreasureWorld }
}
const canvas = () => screen.getByLabelText(/^たからやま。/)

test('ステージを えらんで ほると、ばんめんが かわり、とめると すすまない', () => {
  const { step, world } = openStage(/^1 はじめての あな/)
  expect(screen.getByText('1 / 10')).toBeVisible()
  expect(screen.getByText('💎 0 / 24')).toBeVisible()
  const carved = () => world.cells.filter(cell => cell === Cell.Empty).length

  // なぞると そのぶん あなが ひろがる。
  const before = carved()
  fireEvent.pointerDown(canvas(), { clientX: 120, clientY: 90, pointerId: 1, button: 0, isPrimary: true })
  fireEvent.pointerMove(canvas(), { clientX: 140, clientY: 95, pointerId: 1 })
  fireEvent.pointerUp(canvas(), { clientX: 140, clientY: 95, pointerId: 1 })
  expect(carved()).toBeGreaterThan(before)

  // とめている あいだは シミュレーションが すすまない。
  fireEvent.click(screen.getByRole('button', { name: /とめる/ }))
  step.mockClear()
  frame(200)
  expect(step).not.toHaveBeenCalled()
  expect(screen.getByRole('status')).toHaveTextContent('とまっているよ')
  fireEvent.click(screen.getByRole('button', { name: /うごかす/ }))
  frame(300)
  expect(step).toHaveBeenCalled()
})

test('どうぐと ふとさを えらべ、いしは おいてから ほりなおせる', () => {
  const { world } = openStage(/^5 すべりだいを つくろう/)
  expect(screen.getByRole('button', { name: 'ほる' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'いし' }))
  expect(screen.getByRole('button', { name: 'いし' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'ほる' })).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: '⬤ ふとく' }))
  expect(screen.getByRole('button', { name: '⬤ ふとく' })).toHaveAttribute('aria-pressed', 'true')

  // キーボードでも どうぐを つかえる。
  fireEvent.keyDown(canvas(), { key: 'ArrowDown' })
  fireEvent.keyDown(canvas(), { key: ' ' })
  expect(world.cells.filter(cell => cell === Cell.Stone).length).toBeGreaterThan(0)
  fireEvent.click(screen.getByRole('button', { name: 'ほる' }))
  fireEvent.keyDown(canvas(), { key: ' ' })
  expect(world.cells.filter(cell => cell === Cell.Stone).length).toBe(0)
})

test('あつめきると クリアが出て、きろくが のこり、つぎの ステージへ すすめる', () => {
  const { world } = openStage(/^1 はじめての あな/)
  act(() => { world.collected = STAGES[0].need })
  frame(200)
  expect(screen.getByRole('heading', { name: 'たからを あつめた！' })).toBeVisible()
  expect(screen.getByText('💎 24 / 24')).toBeVisible()
  expect(localStorage.getItem('treasure-dig-progress-v1')).toContain(STAGES[0].id)

  fireEvent.click(screen.getByRole('button', { name: 'つぎへ →' }))
  expect(screen.getByText('2 / 10')).toBeVisible()
  expect(screen.getByText(STAGES[1].name)).toBeVisible()

  // もどると ステージ一覧に クリアの しるしが つく。
  fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
  expect(screen.getByRole('button', { name: `1 ${STAGES[0].name} クリア` })).toBeVisible()
  expect(frames.size).toBe(0)
})

test('たからが たりなくなったら やりなおしを すすめ、おすと さいしょから はじまる', () => {
  const { world } = openStage(/^4 あなに きをつけて/)
  act(() => { world.gems = 0; world.lost = world.total })
  frame(200)
  expect(screen.getByRole('status')).toHaveTextContent('たからが たりないよ')
  fireEvent.click(screen.getByRole('button', { name: /さいしょから やってみる/ }))
  expect(world.gems).toBe(world.total)
  expect(world.lost).toBe(0)
  frame(300)
  expect(screen.queryByRole('button', { name: /さいしょから やってみる/ })).toBeNull()
})

test('すなが とまったら、つぎの ひとほりを うながす', () => {
  openStage(/^1 はじめての あな/)
  fireEvent.click(screen.getByRole('button', { name: 'いし' }))
  // そらの ところへ いしを おく（つぶは うごかないまま、どうぐを つかった ことになる）。
  for (let i = 0; i < 8; i++) fireEvent.keyDown(canvas(), { key: 'ArrowUp' })
  fireEvent.keyDown(canvas(), { key: ' ' })
  for (let i = 1; i <= 150; i++) frame(100 + i * 40)
  expect(screen.getByRole('status')).toHaveTextContent('すなが とまったよ')
})

test('ステージ一覧には 10めんと あそびかたが ならぶ', () => {
  render(<MemoryRouter><TreasureDigPlay /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'ざくざく たからほり' })).toBeVisible()
  expect(screen.getAllByRole('button', { name: /^\d+ / })).toHaveLength(STAGES.length)
  expect(screen.getByText('⛏️ ほる')).toBeVisible()
  expect(frames.size).toBe(0)
})
