import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import AnimalBathPlay from './AnimalBathPlay'
import App from '../../app/App'
import { PATCHES } from './bath'

class TestPointerEvent extends MouseEvent {
  pointerId: number
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init)
    this.pointerId = init.pointerId ?? 1
  }
}

beforeEach(() => {
  vi.stubGlobal('PointerEvent', TestPointerEvent)
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

function openBath() {
  render(<MemoryRouter><AnimalBathPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: 'いぬを あらう' }))
  const board = screen.getByRole('button', { name: 'いぬを せっけんで なでる' })
  // A tall SVG viewport has letterboxing above and below its square viewBox.
  vi.spyOn(board.querySelector('svg')!, 'getBoundingClientRect').mockReturnValue({
    x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 600, width: 400, height: 600, toJSON: () => ({}),
  })
  return board
}

function tapPatch(board: HTMLElement, index: number) {
  const patch = PATCHES[index]
  fireEvent.pointerDown(board, { pointerId: 1, clientX: patch.x, clientY: patch.y + 100, button: 0 })
  fireEvent.pointerUp(board, { pointerId: 1 })
  fireEvent.click(board, { detail: 1 })
}

describe('どうぶつのおふろ', () => {
  test('taps complete soap → shower → towel and another animal starts clean progress', () => {
    const board = openBath()
    expect(screen.getByRole('button', { name: 'おと' })).toHaveAttribute('aria-pressed', 'false')
    for (let step = 0; step < 3; step++) {
      for (let index = 0; index < PATCHES.length; index++) tapPatch(board, index)
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '9')
      if (step === 0) fireEvent.click(screen.getByRole('button', { name: /シャワーで ながそう/ }))
      if (step === 1) fireEvent.click(screen.getByRole('button', { name: /タオルで ふこう/ }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('ぴかぴか！ ありがとう！')
    fireEvent.click(screen.getByRole('button', { name: /ほかの こも あらう/ }))
    fireEvent.click(screen.getByRole('button', { name: 'うさぎを あらう' }))
    expect(screen.getByRole('heading', { name: 'うさぎの おふろ' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('button', { name: 'うさぎを せっけんで なでる' })).toBeInTheDocument()
  })

  test('cancel/lost capture ends strokes, ignores other fingers, and allows the next gesture', () => {
    const board = openBath()
    fireEvent.pointerDown(board, { pointerId: 1, button: 0, clientX: 60, clientY: 315 })
    fireEvent.pointerMove(board, { pointerId: 2, clientX: 340, clientY: 315 })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 340, clientY: 315 })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    fireEvent.pointerCancel(board, { pointerId: 1 })
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 200, clientY: 223 })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
    tapPatch(board, 1)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    fireEvent.pointerDown(board, { pointerId: 1, button: 0, clientX: 200, clientY: 223 })
    fireEvent.lostPointerCapture(board, { pointerId: 1 })
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 200, clientY: 395 })
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4')
    tapPatch(board, 7)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5')
  })

  test('keyboard alone can finish all steps and focus follows the next action', async () => {
    const user = userEvent.setup()
    const board = openBath()
    board.focus()
    for (let step = 0; step < 3; step++) {
      for (let count = 0; count < 9; count++) await user.keyboard(' ')
      const next = screen.getByRole('button', { name: step === 0 ? /シャワーで ながそう/ : step === 1 ? /タオルで ふこう/ : /ほかの こも あらう/ })
      expect(next).toHaveFocus()
      await user.keyboard('{Enter}')
      if (step < 2) expect(board).toHaveFocus()
    }
    expect(screen.getByRole('heading', { name: 'だれを あらう？' })).toBeInTheDocument()
  })

  test('home entry, intro hiding, exiting mid-bath, replay, and direct URL work', async () => {
    const view = render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('link', { name: 'どうぶつのおふろ' }))
    expect(await screen.findByRole('heading', { name: 'だれを あらう？' })).toBeInTheDocument()
    expect(screen.getByText('あらいたい どうぶつを タップしてね')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'くまを あらう' }))
    expect(screen.queryByText('あらいたい どうぶつを タップしてね')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'くまを せっけんで なでる' }))
    fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
    expect(screen.getByText('あらいたい どうぶつを タップしてね')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'くまを あらう' }))
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
    fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
    fireEvent.click(screen.getByRole('button', { name: /もどる/ }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    view.unmount()
    render(<MemoryRouter initialEntries={['/games/animal-bath']}><App /></MemoryRouter>)
    expect(await screen.findByRole('heading', { name: 'どうぶつのおふろ' })).toBeInTheDocument()
  })
})
