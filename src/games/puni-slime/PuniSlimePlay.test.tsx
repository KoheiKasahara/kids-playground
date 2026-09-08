import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PuniSlimePlay from './PuniSlimePlay'

let frame: FrameRequestCallback
beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())
function renderGame() { return render(<MemoryRouter><PuniSlimePlay /></MemoryRouter>) }
function advance() { act(() => { for (let i = 0; i < 120; i++) frame(i * 1000 / 60) }) }
describe('PuniSlimePlay', () => {
  it('opens ready to play and offers color/feel choices without resetting the body', () => {
    const { container } = renderGame()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    advance()
    const body = container.querySelector('svg > path')!
    const shape = body.getAttribute('d')
    fireEvent.click(screen.getByRole('button', { name: 'ももいろ' }))
    expect(screen.getByRole('button', { name: 'ももいろ' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: '🟢 ぷるぷる' }))
    expect(screen.getByRole('button', { name: '🟢 ぷるぷる' })).toHaveAttribute('aria-pressed', 'true')
    expect(body.getAttribute('d')).toBe(shape)
  })
  it('captures two fingers and clears interrupted gestures on blur, cancel and reset', () => {
    vi.stubGlobal('PointerEvent', class extends MouseEvent {
      pointerId: number
      constructor(type: string, init: PointerEventInit) { super(type, init); this.pointerId = init.pointerId ?? 0 }
    })
    vi.stubGlobal('DOMPoint', class {
      constructor(public x: number, public y: number) {}
      matrixTransform() { return this }
    })
    const { container } = renderGame()
    const svg = screen.getByRole('img', { name: 'ひっぱって あそべる スライム' })
    const captures = new Set<number>()
    Object.assign(svg, {
      getScreenCTM: () => ({ inverse: () => ({}) }),
      setPointerCapture: vi.fn((id: number) => captures.add(id)),
      hasPointerCapture: (id: number) => captures.has(id),
      releasePointerCapture: vi.fn((id: number) => captures.delete(id)),
    })
    fireEvent.pointerDown(svg, { pointerId: 1, clientX: 440, clientY: 265, button: 0 })
    fireEvent.pointerDown(svg, { pointerId: 2, clientX: 160, clientY: 265, button: 0 })
    expect([...captures]).toEqual([1, 2])
    fireEvent.pointerDown(svg, { pointerId: 3, clientX: 300, clientY: 265, button: 0 })
    expect(captures.size).toBe(2)
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 540, clientY: 80 })
    const initial = container.querySelector('svg > path')!.getAttribute('d')
    advance()
    expect(container.querySelector('svg > path')!.getAttribute('d')).not.toBe(initial)
    fireEvent.pointerCancel(svg, { pointerId: 1 })
    expect([...captures]).toEqual([2])
    fireEvent.blur(window)
    expect(captures.size).toBe(0)
    fireEvent.click(screen.getByRole('button', { name: /もとにもどす/ }))
    fireEvent.pointerDown(svg, { pointerId: 4, clientX: 300, clientY: 265, button: 0 })
    expect(captures.has(4)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /もとにもどす/ }))
    expect(captures.size).toBe(0)
  })
  it('buttons deform, drop and restore the slime, and unmount cancels animation', () => {
    const { container, unmount } = renderGame()
    const body = container.querySelector('svg > path')!
    const original = body.getAttribute('d')
    fireEvent.click(screen.getByRole('button', { name: /ぺったん/ }))
    act(() => frame(0))
    expect(body.getAttribute('d')).not.toBe(original)
    fireEvent.click(screen.getByRole('button', { name: /ぽとん/ }))
    expect(screen.getByText('ぽとん！ おちると どうなるかな？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /もとにもどす/ }))
    act(() => frame(0))
    expect(body.getAttribute('d')).toBe(original)
    unmount()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
