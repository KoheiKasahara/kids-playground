import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import FallingDrawingPlay from './FallingDrawingPlay'
import * as physics from './fallingDrawingWorld'

let frames: Map<number, FrameRequestCallback>
let clock = 0
beforeEach(() => {
  frames = new Map()
  clock = 0
  let id = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++id, callback); return id }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id) }))
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true }
  })
  vi.spyOn(physics, 'createDrawingWorld')
  const ctx = new Proxy({}, { get: () => () => {}, set: () => true })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 960, height: 720 } as DOMRect)
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) Reflect.deleteProperty(HTMLCanvasElement.prototype, method)
})

function open() {
  const result = render(<StrictMode><FallingDrawingPlay active /></StrictMode>)
  const canvas = screen.getByLabelText(/^かいて ころがす。/)
  const world = vi.mocked(physics.createDrawingWorld).mock.results.at(-1)!.value as physics.DrawingWorld
  return { ...result, canvas, world }
}
function draw(canvas: HTMLElement) {
  fireEvent.pointerDown(canvas, { clientX: 400, clientY: 200, pointerId: 1, button: 0 })
  fireEvent.pointerMove(canvas, { clientX: 600, clientY: 220, pointerId: 1 })
  fireEvent.pointerUp(canvas, { clientX: 640, clientY: 240, pointerId: 1 })
}
function advance(count: number) {
  act(() => {
    for (let i = 0; i < count; i++) {
      const callbacks = [...frames.values()]
      frames.clear()
      clock += 1000 / 60
      callbacks.forEach(callback => callback(clock))
    }
  })
}

test('draw on release, undo, place a ball, score and drain back to play', () => {
  const { canvas, world } = open()
  fireEvent.click(screen.getByRole('button', { name: 'あお' }))
  draw(canvas)
  expect(world.items).toHaveLength(2)
  expect(world.items[1].color).toBe('#408dcc')
  fireEvent.click(screen.getByRole('button', { name: '1かい もどす' }))
  expect(world.items).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'ボールを おく' }))
  fireEvent.pointerDown(canvas, { clientX: 730, clientY: 100, button: 0 })
  expect(world.items).toHaveLength(1)
  fireEvent.pointerUp(canvas, { clientX: 730, clientY: 100 })
  advance(120)
  expect(screen.getByRole('status')).toHaveTextContent('はいった！ 1')
  fireEvent.click(screen.getByRole('button', { name: 'ぜんぶ おとす' }))
  expect(screen.getByRole('button', { name: 'ぜんぶ おとす' })).toBeDisabled()
  advance(240)
  expect(world.items).toHaveLength(1)
  expect(screen.getByRole('button', { name: 'ぜんぶ おとす' })).toBeEnabled()
})

test('extra fingers, cancel, capture loss, resize and blur never create stray objects or stick the pointer', () => {
  const { canvas, world } = open()
  for (const termination of ['pointerCancel', 'lostPointerCapture', 'resize', 'blur'] as const) {
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1, button: 0 })
    fireEvent.pointerDown(canvas, { clientX: 500, clientY: 500, pointerId: 2, isPrimary: false, button: 0 })
    fireEvent.pointerUp(canvas, { clientX: 500, clientY: 500, pointerId: 2, isPrimary: false })
    if (termination === 'resize' || termination === 'blur') fireEvent(window, new Event(termination))
    else fireEvent[termination](canvas, { pointerId: 1 })
    fireEvent.pointerUp(canvas, { clientX: 100, clientY: 100, pointerId: 1 })
    expect(world.items).toHaveLength(1)
  }
  draw(canvas)
  expect(world.items).toHaveLength(2)
})

test('mode changes pause animation and keep objects; StrictMode and exit release engines and RAF', () => {
  const { canvas, world, rerender, unmount } = open()
  const first = vi.mocked(physics.createDrawingWorld).mock.results[0].value as physics.DrawingWorld
  expect(first.items).toHaveLength(0)
  draw(canvas)
  expect(frames.size).toBe(1)
  rerender(<StrictMode><FallingDrawingPlay active={false} /></StrictMode>)
  expect(frames.size).toBe(0)
  expect(world.items).toHaveLength(2)
  rerender(<StrictMode><FallingDrawingPlay active /></StrictMode>)
  expect(frames.size).toBe(1)
  unmount()
  expect(frames.size).toBe(0)
  expect(world.items).toHaveLength(0)
})
