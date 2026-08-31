import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CarRoadBuilderPlay from './CarRoadBuilderPlay'

function renderGame() {
  return render(<MemoryRouter><CarRoadBuilderPlay /></MemoryRouter>)
}

describe('CarRoadBuilderPlay', () => {
  afterEach(() => vi.restoreAllMocks())
  test('renders child-friendly board, palette and departure controls', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: /くるまのみちづくり/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ひろげる' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'しゅっぱつ' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'カーブを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ゆるいカーブを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'じゅうじを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xじを おく' })).toBeInTheDocument()
  })

  test('palette tap then cell tap places a part, and selected controls rotate/remove it', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、1ぎょう 1れつ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' })).toBeInTheDocument()
  })

  test('palette exposes and places the gentle curve as its own part', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ゆるいカーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' }))

    expect(screen.getByRole('gridcell', { name: 'ゆるいカーブ、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ゆるいカーブを おく' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'まわす' })).toBeEnabled()
  })

  test('palette exposes and places the crossroad as its own part', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'じゅうじを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' }))

    const crossroad = screen.getByRole('gridcell', { name: 'じゅうじ、1ぎょう 1れつ' })
    expect(crossroad).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'じゅうじを おく' })).toHaveAttribute('aria-pressed', 'true')
    expect(crossroad.querySelectorAll('svg path')).toHaveLength(2)
  })

  test('palette exposes and places the X road as a separate two-path part', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'Xじを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' }))

    const xroad = screen.getByRole('gridcell', { name: 'Xじ、1ぎょう 1れつ' })
    expect(xroad).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xじを おく' })).toHaveAttribute('aria-pressed', 'true')
    expect(xroad.querySelectorAll('svg path')).toHaveLength(2)
  })

  test('expand appends a row and column, then running locks editing', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ひろげる' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    expect(screen.getByRole('button', { name: 'とめる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどす' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'カーブを おく' })).toBeDisabled()
  })

  test('hides connection direction hints and toggles the expanded view without losing parts', async () => {
    const user = userEvent.setup()
    renderGame()

    expect(screen.queryByText('E·W')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ひろげる' }))
    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'もどす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、4ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.queryByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ひろげる' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'まわす' })).toBeInTheDocument()
  })

  test('occupied palette target selects the part, then an empty tap moves it', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'スタート、2ぎょう 1れつ' }))
    expect(screen.getByRole('status')).toHaveTextContent('あきセルを おすと うごかせるよ')
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、3ぎょう 1れつ' }))
    expect(screen.getByRole('gridcell', { name: 'スタート、3ぎょう 1れつ' })).toBeInTheDocument()
  })

  test('goal completion enters cleared phase, keeps the car and unlocks editing', async () => {
    let callback: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => {
      callback = next
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'running')
    await act(async () => { callback?.(3000) })
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'cleared')
    expect(screen.getByRole('status')).toHaveTextContent('ゴールについたよ！')
    expect(screen.getByRole('button', { name: 'カーブを おく' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'しゅっぱつ' })).toBeEnabled()
    expect(screen.getByLabelText('くるま')).toBeInTheDocument()
  })

  test('manual stop keeps the car at its current position', async () => {
    let callback: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => {
      callback = next
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    await act(async () => { callback?.(1300) })
    const carBeforeStop = screen.getByLabelText('くるま').getAttribute('style')
    expect(carBeforeStop).toContain('left:')
    await user.click(screen.getByRole('button', { name: 'とめる' }))
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'stopped')
    expect(screen.getByLabelText('くるま').getAttribute('style')).toBe(carBeforeStop)
  })

  test('editing after clear returns to ready with the car at start', async () => {
    let callback: FrameRequestCallback | undefined
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => {
      callback = next
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    vi.spyOn(performance, 'now').mockReturnValue(0)
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    await act(async () => { callback?.(3000) })
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'cleared')

    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 4れつ' }))
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'ready')
    expect(screen.getByRole('gridcell', { name: 'カーブ、1ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.getByLabelText('くるま').getAttribute('style')).toContain('left: 12.5%')
  })
})
