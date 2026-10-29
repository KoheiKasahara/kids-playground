import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import App from '../../app/App'
import JellyMergePlay from './JellyMergePlay'
import { playJellySound } from './sounds'

vi.mock('./sounds', () => ({ playJellySound: vi.fn() }))
vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1)
  class TestPointerEvent extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerId = init.pointerId ?? 1
      this.isPrimary = init.isPrimary ?? true
    }
  }
  vi.stubGlobal('PointerEvent', TestPointerEvent)
})
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.clearAllMocks() })

function setup() {
  const view = render(<StrictMode><MemoryRouter><JellyMergePlay /></MemoryRouter></StrictMode>)
  const board = screen.getByTestId('jelly-board')
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 500, top: 0, bottom: 600, width: 500, height: 600, x: 0, y: 0, toJSON: () => ({}) })
  Object.assign(board, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
  return { ...view, board }
}
const touch = (x: number, pointerId = 1) => ({ clientX: x, clientY: 250, pointerId, button: 0, isPrimary: true })
const finish = () => act(() => { vi.runAllTimers() })

test('drag previews without dropping, release drops once, animates a chain, and undo restores queue and score', () => {
  const consoleError = vi.spyOn(console, 'error')
  const { board } = setup()
  fireEvent.pointerDown(board, touch(50))
  expect(screen.getByTestId('jelly-preview').style.getPropertyValue('--col')).toBe('0')
  fireEvent.pointerMove(board, touch(250))
  expect(screen.getByTestId('jelly-preview').style.getPropertyValue('--col')).toBe('2')
  expect(board).toHaveAttribute('data-turn', '0')
  fireEvent.pointerUp(board, touch(250))
  expect(board).toHaveAttribute('data-busy', 'true')
  expect(screen.queryByTestId('jelly-preview')).not.toBeInTheDocument()
  fireEvent.pointerUp(board, touch(250))
  fireEvent.pointerDown(board, touch(250))
  fireEvent.pointerUp(board, touch(250))
  for (let step = 0; step < 60 && board.getAttribute('data-busy') === 'true'; step++) {
    act(() => { vi.advanceTimersToNextTimer() })
  }
  expect(board).toHaveAttribute('data-busy', 'false')
  expect(board).toHaveAttribute('data-turn', '1')
  expect(playJellySound).toHaveBeenCalledWith('merge', expect.any(Number))
  expect(screen.queryByLabelText('てんすう 0')).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(board).toHaveAttribute('data-turn', '0')
  expect(screen.getByLabelText('てんすう 0')).toBeInTheDocument()
  expect(screen.getByLabelText('つぎは 2、1')).toBeInTheDocument()
  expect(consoleError).not.toHaveBeenCalled()
})

test('tap works without drag; synthetic follow-up click does not drop a second jelly', () => {
  const { board } = setup()
  fireEvent.pointerDown(board, touch(50))
  fireEvent.pointerUp(board, touch(50))
  fireEvent.click(screen.getByRole('button', { name: /^1れつめ/ }), { detail: 1 })
  finish()
  expect(board).toHaveAttribute('data-turn', '1')
})

test('secondary fingers, canceled/lost captures, outside release, resize and blur never drop', () => {
  const { board } = setup()
  fireEvent.pointerDown(board, touch(50))
  fireEvent.pointerDown(board, { ...touch(450, 2), isPrimary: false })
  fireEvent.pointerUp(board, { ...touch(450, 2), isPrimary: false })
  expect(board).toHaveAttribute('data-busy', 'false')
  fireEvent.pointerCancel(board, touch(50))
  fireEvent.pointerUp(board, touch(50))
  for (const event of ['lostPointerCapture', 'resize', 'blur', 'outside'] as const) {
    fireEvent.pointerDown(board, touch(50))
    if (event === 'lostPointerCapture') fireEvent.lostPointerCapture(board, touch(50))
    else if (event === 'outside') fireEvent.pointerMove(board, touch(-50))
    else fireEvent(window, new Event(event))
    fireEvent.pointerUp(board, touch(event === 'outside' ? -50 : 50))
    fireEvent.focus(window)
  }
  finish()
  expect(board).toHaveAttribute('data-turn', '0')
  expect(playJellySound).not.toHaveBeenCalled()
})

test('arrow keys and Enter/Space provide the same game without visible movement buttons', async () => {
  vi.useRealTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: true }))
  const user = userEvent.setup()
  const { board } = setup()
  act(() => screen.getByRole('button', { name: /^2れつめ/ }).focus())
  await user.keyboard('{ArrowRight}{Enter}')
  await waitFor(() => expect(board).toHaveAttribute('data-turn', '1'))
  await user.keyboard(' ')
  await waitFor(() => expect(board).toHaveAttribute('data-turn', '2'))
  expect(screen.queryByRole('button', { name: 'ここに おとす' })).not.toBeInTheDocument()
})

test('animation pauses offscreen, resumes, and unmount clears timers and restores sound', () => {
  const { board, unmount } = setup()
  fireEvent.click(screen.getByRole('button', { name: 'おと' }))
  expect(isSoundEnabled()).toBe(false)
  fireEvent.pointerDown(board, touch(250))
  fireEvent.pointerUp(board, touch(250))
  fireEvent.blur(window)
  finish()
  expect(board).toHaveAttribute('data-turn', '0')
  fireEvent.focus(window)
  finish()
  expect(board).toHaveAttribute('data-turn', '1')
  fireEvent.pointerDown(board, touch(50))
  fireEvent.pointerUp(board, touch(50))
  unmount()
  const calls = vi.mocked(playJellySound).mock.calls.length
  finish()
  expect(playJellySound).toHaveBeenCalledTimes(calls)
  expect(vi.getTimerCount()).toBe(0)
  expect(isSoundEnabled()).toBe(true)
  setup()
  expect(screen.getByTestId('jelly-board')).toHaveAttribute('data-turn', '0')
})

test('stack full → undo → full → replay completes the loop', () => {
  const { board } = setup()
  for (let i = 0; i < 25 && !screen.queryByRole('region', { name: 'けっか' }); i++) {
    fireEvent.pointerDown(board, touch(350))
    fireEvent.pointerUp(board, touch(350))
    finish()
  }
  expect(screen.getByRole('heading', { name: 'いっぱいに なっちゃった' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /もういちど/ })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '↶ ひとつ もどす' }))
  expect(screen.queryByRole('region', { name: 'けっか' })).not.toBeInTheDocument()
  fireEvent.pointerDown(board, touch(350))
  fireEvent.pointerUp(board, touch(350))
  finish()
  fireEvent.click(screen.getByRole('button', { name: /もういちど/ }))
  expect(board).toHaveAttribute('data-turn', '0')
  expect(screen.getByLabelText('てんすう 0')).toBeInTheDocument()
})

test('a complete winning run announces the rainbow, focuses replay and starts fresh', () => {
  const { board } = setup()
  for (const col of [0, 0, 2, 0, 1, 0, 1]) {
    fireEvent.pointerDown(board, touch((col + .5) * 100))
    fireEvent.pointerUp(board, touch((col + .5) * 100))
    finish()
  }
  expect(screen.getByRole('heading', { name: 'にじゼリー できた！' })).toBeInTheDocument()
  expect(playJellySound).toHaveBeenCalledWith('win')
  expect(screen.getByRole('button', { name: /もういちど/ })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: /もういちど/ }))
  expect(board).toHaveAttribute('data-turn', '0')
  expect(screen.queryByRole('region', { name: 'けっか' })).not.toBeInTheDocument()
})

test('direct lazy route preserves the initial description and hides it when touching the board', async () => {
  vi.useRealTimers()
  render(<MemoryRouter initialEntries={['/games/jelly-merge']}><App /></MemoryRouter>)
  expect(await screen.findByRole('heading', { name: 'ぽんぽん ゼリーがったい！' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
  fireEvent.pointerDown(screen.getByTestId('jelly-board'), touch(250))
  expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
  fireEvent.pointerCancel(screen.getByTestId('jelly-board'), touch(250))
})
