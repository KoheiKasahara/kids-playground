import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DrawGoalPlay from './DrawGoalPlay'
import { STAGES } from './stages'
import { playCorrectSound } from '../../utils/quizSound'

vi.mock('../../utils/quizSound', () => ({ primeAudio: vi.fn(), playCorrectSound: vi.fn() }))
let frame: FrameRequestCallback
let time: number
beforeEach(() => {
  time = 0
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true }
  })
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, toJSON() {} })
  SVGElement.prototype.setPointerCapture = vi.fn()
  SVGElement.prototype.hasPointerCapture = vi.fn(() => false)
  SVGElement.prototype.releasePointerCapture = vi.fn()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) Reflect.deleteProperty(SVGElement.prototype, method)
})
function open() {
  render(<MemoryRouter><DrawGoalPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '1 みぎへ コロコロ' }))
  return screen.getByLabelText('せんを かく ばしょ')
}
function advance(n = 600) {
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame(time) } })
}
function draw(svg: HTMLElement) {
  fireEvent.pointerDown(svg, { clientX: 55, clientY: 175 })
  fireEvent.pointerMove(svg, { clientX: 285, clientY: 520 })
  fireEvent.pointerUp(svg, { clientX: 285, clientY: 520 })
}
describe('draw goal play', () => {
  test('draw → start → physical goal → next; back returns one level', () => {
    const svg = open()
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
    draw(svg)
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeEnabled()
    // The road alone never launches the ball: more roads can be drawn before start.
    const ball = svg.querySelector('g')!
    advance(1)
    const parked = ball.getAttribute('transform')
    advance(120)
    expect(ball.getAttribute('transform')).toBe(parked)
    expect(screen.getByText('▶ スタートを おそう！')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '▶ スタート' }))
    advance()
    expect(screen.getByRole('heading', { name: '🎉 ゴール！' })).toBeInTheDocument()
    expect(playCorrectSound).toHaveBeenCalledOnce()
    // The celebration waits for the ball to come to rest on the floor of the cup.
    const [, y] = ball.getAttribute('transform')!.match(/translate\((-?[\d.]+) (-?[\d.]+)\)/)!.slice(1).map(Number)
    expect(y).toBeGreaterThan(STAGES[0].goal.y + 40)
    advance()
    expect(playCorrectSound).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ →' }))
    expect(screen.getByText('2 / 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '6 だんだん みち' })).toBeInTheDocument()
    expect(screen.queryByLabelText('せんを かく ばしょ')).not.toBeInTheDocument()
  })
  test('drawing pauses the ball; secondary/canceled/resize gestures create no road', () => {
    const svg = open()
    fireEvent.click(screen.getByRole('button', { name: '▶ スタート' }))
    advance(2)
    const ball = svg.querySelector('g')!
    const position = ball.getAttribute('transform')
    fireEvent.pointerDown(svg, { clientX: 55, clientY: 175 })
    fireEvent.pointerMove(svg, { clientX: 285, clientY: 520, pointerId: 2, isPrimary: false })
    advance(120)
    expect(ball.getAttribute('transform')).toBe(position)
    fireEvent.pointerCancel(svg)
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeDisabled()
    fireEvent.pointerDown(svg, { clientX: 55, clientY: 175 })
    fireEvent.pointerMove(svg, { clientX: 285, clientY: 520 })
    fireEvent(window, new Event('resize'))
    fireEvent.pointerUp(svg, { clientX: 285, clientY: 520 })
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeDisabled()
  })
  test('replay keeps roads, undo and restart remove them; unmount cancels animation', () => {
    const svg = open()
    draw(svg)
    fireEvent.click(screen.getByRole('button', { name: '▶ スタート' }))
    expect(screen.getByRole('button', { name: '▶ もういちど' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeEnabled()
    fireEvent.click(screen.getByRole('button', { name: '↶ 1ぽん もどす' }))
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeDisabled()
    draw(svg)
    fireEvent.click(screen.getByRole('button', { name: '↻ やりなおし' }))
    expect(screen.getByRole('button', { name: '↶ 1ぽん もどす' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })
})
