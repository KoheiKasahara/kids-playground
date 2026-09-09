import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import MagicSandboxPlay from './MagicSandboxPlay'
import { Sandbox } from './sandboxSimulation'

let frames: Map<number, FrameRequestCallback>
let nextFrame: number
beforeEach(() => {
  frames = new Map(); nextFrame = 0
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData: vi.fn(),
  } as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value: function (this: HTMLDialogElement) { this.open = true } })
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal') })
function frame(time: number) {
  act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time)) })
}
function start() {
  render(<MemoryRouter><MagicSandboxPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'あそぶ！' }))
}
it('starts, selects materials, places with keyboard, pauses, clears and returns; reopening has one loop', () => {
  const paint = vi.spyOn(Sandbox.prototype, 'paint'), step = vi.spyOn(Sandbox.prototype, 'step'), clear = vi.spyOn(Sandbox.prototype, 'clear')
  start()
  const canvas = screen.getByLabelText(/^すなば。/)
  fireEvent.click(screen.getByRole('button', { name: 'みず' }))
  fireEvent.keyDown(canvas, { key: 'ArrowRight' })
  fireEvent.keyDown(canvas, { key: ' ' })
  expect(paint).toHaveBeenLastCalledWith({ x: 77, y: 30 }, 2, 3)
  frame(100)
  expect(step).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /とめる/ }))
  step.mockClear(); frame(200)
  expect(step).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
  expect(screen.getByRole('dialog')).toBeVisible()
  clear.mockClear()
  fireEvent.click(screen.getByRole('button', { name: 'まだ あそぶ' }))
  expect(clear).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
  fireEvent.click(screen.getByRole('dialog').querySelectorAll('button')[1])
  expect(clear).toHaveBeenCalledOnce()
  fireEvent.click(screen.getByRole('button', { name: /ゆらす/ }))
  frame(300)
  expect(step).toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
  expect(screen.getByRole('button', { name: 'あそぶ！' })).toBeVisible()
  expect(frames.size).toBe(0)
  fireEvent.click(screen.getByRole('button', { name: 'あそぶ！' }))
  expect(frames.size).toBe(1)
  cleanup()
  expect(frames.size).toBe(0)
})
it('releases a held pour on cancel, outside move, blur, rotation, and hidden tab', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const paint = vi.spyOn(Sandbox.prototype, 'paint')
  start()
  const canvas = screen.getByLabelText(/^すなば。/)
  Object.assign(canvas, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 144, bottom: 176, width: 144, height: 176 } as DOMRect)
  const begin = () => { fireEvent.pointerDown(canvas, { clientX: 50, clientY: 30, button: 0 }); expect(paint).toHaveBeenCalled(); paint.mockClear() }
  const stopped = (time: number) => { frame(time); expect(paint).not.toHaveBeenCalled() }
  begin(); fireEvent.pointerCancel(canvas); stopped(100)
  begin(); fireEvent.pointerMove(canvas, { clientX: 200, clientY: 30 }); stopped(200)
  begin(); fireEvent(window, new Event('blur')); stopped(300)
  begin(); fireEvent(window, new Event('resize')); stopped(400)
  begin()
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
  fireEvent(document, new Event('visibilitychange'))
  expect(frames.size).toBe(0)
  expect(paint).not.toHaveBeenCalled()
})

it('adds two crabs without changing the brush, pauses them and resets the button after clearing', () => {
  const add = vi.spyOn(Sandbox.prototype, 'addCrab')
  start()
  fireEvent.click(screen.getByRole('button', { name: 'カニを ふやす（0/2）' }))
  fireEvent.click(screen.getByRole('button', { name: 'カニを ふやす（1/2）' }))
  expect(screen.getByRole('button', { name: 'カニを ふやす（2/2）' })).toBeDisabled()
  expect(add).toHaveBeenCalledTimes(2)
  expect(screen.getByRole('button', { name: 'すな' })).toHaveAttribute('aria-pressed', 'true')
  const world = add.mock.instances[0] as Sandbox
  fireEvent.click(screen.getByRole('button', { name: /とめる/ }))
  const snapshot = JSON.stringify(world.crabs)
  frame(100); frame(200)
  expect(JSON.stringify(world.crabs)).toBe(snapshot)
  fireEvent.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
  fireEvent.click(screen.getByRole('dialog').querySelectorAll('button')[1])
  expect(world.crabs).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'カニを ふやす（0/2）' })).toBeEnabled()
})

it('reacts to a crab tap without starting a material stream', () => {
  vi.stubGlobal('PointerEvent', MouseEvent)
  const add = vi.spyOn(Sandbox.prototype, 'addCrab')
  const paint = vi.spyOn(Sandbox.prototype, 'paint')
  start()
  fireEvent.click(screen.getByRole('button', { name: 'カニを ふやす（0/2）' }))
  const crab = (add.mock.instances[0] as Sandbox).crabs[0]
  const canvas = screen.getByLabelText(/^すなば。/)
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 144, bottom: 176, width: 144, height: 176 } as DOMRect)
  fireEvent.pointerDown(canvas, { clientX: crab.x, clientY: crab.y - 4, button: 0 })
  expect(crab.wave).toBe(90)
  frame(100)
  expect(paint).not.toHaveBeenCalled()
})
