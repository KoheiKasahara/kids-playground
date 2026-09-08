import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import OekakiKorokoroPlay from './OekakiKorokoroPlay'
import { drawStamps } from './rollerDrawing'

vi.mock('./rollerDrawing', () => ({ drawPaper: vi.fn(), drawStamps: vi.fn() }))

vi.mock('./FallingDrawingPlay', () => ({ default: () => null }))

const ctx = { clearRect: vi.fn(), drawImage: vi.fn() }
beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as ReturnType<HTMLCanvasElement['getContext']>)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 960, height: 720, right: 960, bottom: 720, toJSON() {} })
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true }
  })
  HTMLCanvasElement.prototype.setPointerCapture = vi.fn()
  HTMLCanvasElement.prototype.hasPointerCapture = vi.fn(() => false)
  HTMLCanvasElement.prototype.releasePointerCapture = vi.fn()
  HTMLDialogElement.prototype.showModal = vi.fn(function(this: HTMLDialogElement) { this.open = true })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  for (const method of ['setPointerCapture', 'hasPointerCapture', 'releasePointerCapture']) Reflect.deleteProperty(HTMLCanvasElement.prototype, method)
})

function open() {
  render(<MemoryRouter><OekakiKorokoroPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: '🌸 もようで おえかき' }))
  return screen.getByLabelText('おえかきの かみ。ゆびや マウスで なぞってね')
}
function tap(canvas: HTMLElement) {
  fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200, pointerId: 1, button: 0 })
  fireEvent.pointerUp(canvas, { clientX: 200, clientY: 200, pointerId: 1 })
}

describe('おえかきコロコロのあそび', () => {
  test('selected motif/color paints a tap; a single undo restores the previous blank picture', async () => {
    const user = userEvent.setup()
    const canvas = open()
    expect(screen.getByRole('button', { name: '1かい もどす' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'ほし' }))
    await user.click(screen.getByRole('button', { name: 'あお' }))
    tap(canvas)
    expect(drawStamps).toHaveBeenLastCalledWith(ctx, [{ x: 200, y: 200, angle: 0 }], expect.objectContaining({ id: 'star' }), '#408dcc')
    expect(screen.getByRole('button', { name: 'ほし' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: '1かい もどす' }))
    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, 960, 720)
    expect(screen.getByRole('button', { name: 'ぜんぶ けす' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '1かい もどす' })).toBeDisabled()
  })
  test('clearing requires confirmation, cancel preserves ink, confirmed clear is recoverable', async () => {
    const user = userEvent.setup()
    tap(open())
    await user.click(screen.getByRole('button', { name: 'ぜんぶ けす' }))
    await user.click(screen.getByRole('button', { name: 'まだ かく' }))
    expect(ctx.clearRect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'ぜんぶ けす' }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(ctx.clearRect).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: '1かい もどす' }))
    expect(screen.getByRole('button', { name: 'ぜんぶ けす' })).toBeEnabled()
  })
  test('ignores secondary pointers and terminates canceled gestures without connecting the next stroke', () => {
    const canvas = open()
    fireEvent.pointerDown(canvas, { clientX: 100, clientY: 100, pointerId: 1 })
    fireEvent.pointerDown(canvas, { clientX: 300, clientY: 300, pointerId: 2, isPrimary: false })
    fireEvent.pointerMove(canvas, { clientX: 400, clientY: 400, pointerId: 2, isPrimary: false })
    expect(drawStamps).not.toHaveBeenCalled()
    fireEvent.pointerCancel(canvas, { pointerId: 1 })
    expect(drawStamps).toHaveBeenLastCalledWith(ctx, [{ x: 100, y: 100, angle: 0 }], expect.anything(), expect.anything())
    tap(canvas)
    expect(drawStamps).toHaveBeenLastCalledWith(ctx, [{ x: 200, y: 200, angle: 0 }], expect.anything(), expect.anything())
  })
  test('paper changes preserve ink; done celebrates without exporting and returns to drawing', async () => {
    const user = userEvent.setup()
    tap(open())
    await user.click(screen.getByRole('button', { name: 'そら' }))
    expect(ctx.clearRect).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'できた！' }))
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    expect(HTMLCanvasElement.prototype.toDataURL).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'できた！' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もっと かく' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ぜんぶ けす' })).toBeEnabled()
  })
  test('switching toys preserves the existing artwork and undo', async () => {
    const user = userEvent.setup()
    tap(open())
    await user.click(screen.getByRole('button', { name: '✏️ かいて ころがす' }))
    await user.click(screen.getByRole('button', { name: '🌸 もようで おえかき' }))
    expect(ctx.clearRect).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '1かい もどす' })).toBeEnabled()
  })
})
