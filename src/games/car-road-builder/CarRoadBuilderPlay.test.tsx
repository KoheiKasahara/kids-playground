import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CarRoadBuilderPlay from './CarRoadBuilderPlay'

function renderGame() {
  return render(<MemoryRouter><CarRoadBuilderPlay /></MemoryRouter>)
}

function mockBoardRect(size = 400) {
  const board = screen.getByRole('grid')
  vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({
    bottom: size,
    height: size,
    left: 0,
    right: size,
    top: 0,
    width: size,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
  return board
}

function pointerOptions(pointerId: number, clientX: number, clientY: number, pointerType: 'touch' | 'mouse' = 'touch') {
  return { button: 0, clientX, clientY, isPrimary: true, pointerId, pointerType }
}

describe('CarRoadBuilderPlay', () => {
  afterEach(() => vi.restoreAllMocks())
  test('renders child-friendly board, palette and departure controls', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: /くるまのみちづくり/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふつう 4×4' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ひろい 5×5' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ふつう 4×4' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '4')
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
    expect(screen.getByRole('button', { name: 'しゅっぱつ' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByRole('button', { name: 'カーブを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ゆるいカーブを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'じゅうじを おく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Xじを おく' })).toBeInTheDocument()
  })

  test('renders a clearly headed top-down car at the start', () => {
    renderGame()

    const car = screen.getByLabelText('くるま')
    expect(car.querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-front-direction', 'E')
    expect(car).toHaveStyle('--car-angle: 0rad')
    expect(car.querySelectorAll('circle')).toHaveLength(2)
    expect(car.querySelectorAll('[data-testid="car-visual"] path')).toHaveLength(5)
  })

  test('offers four visual vehicle choices and starts with the red car selected', async () => {
    const user = userEvent.setup()
    renderGame()

    const redCar = screen.getByRole('button', { name: 'あかい くるま' })
    const blueCar = screen.getByRole('button', { name: 'あおい くるま' })
    const bus = screen.getByRole('button', { name: 'バス' })
    const truck = screen.getByRole('button', { name: 'トラック' })
    expect([redCar, blueCar, bus, truck]).toHaveLength(4)
    expect(redCar).toHaveAttribute('aria-pressed', 'true')
    expect(blueCar.querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'blue-car')
    expect(bus.querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'bus')
    expect(truck.querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'truck')

    await user.click(bus)
    expect(bus).toHaveAttribute('aria-pressed', 'true')
    expect(redCar).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'bus')
  })

  test('keeps vehicle selection available in normal play and locks it while running', async () => {
    const user = userEvent.setup()
    renderGame()

    const truck = screen.getByRole('button', { name: 'トラック' })
    await user.click(truck)
    expect(truck).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'truck')

    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    expect(screen.getByRole('button', { name: 'トラック' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'バス' })).toBeDisabled()
    expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'truck')
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

  test('switches from 4x4 to 5x5, then running locks stage selection', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ひろい 5×5' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '5')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '5')
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)
    expect(screen.getByRole('button', { name: 'ひろい 5×5' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    expect(screen.getByRole('button', { name: 'とめる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふつう 4×4' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ひろい 5×5' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'カーブを おく' })).toBeDisabled()
  })

  test('switching from 5x5 back to 4x4 resets the previous placement state', async () => {
    const user = userEvent.setup()
    renderGame()

    expect(screen.queryByText('E·W')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'ひろい 5×5' }))
    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ふつう 4×4' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、4ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.queryByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).not.toBeInTheDocument()
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '4')
    expect(screen.getByRole('button', { name: 'ふつう 4×4' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('drags a palette part to an empty 4x4 cell with a visible valid preview', async () => {
    const user = userEvent.setup()
    renderGame()
    mockBoardRect()
    const palette = screen.getByRole('button', { name: 'カーブを おく' })

    fireEvent.pointerDown(palette, pointerOptions(1, 20, 500))
    fireEvent.pointerMove(palette, pointerOptions(1, 50, 50))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('カーブを つかんだよ')

    fireEvent.pointerUp(palette, pointerOptions(1, 50, 50))
    expect(screen.getByRole('gridcell', { name: 'カーブ、1ぎょう 1れつ' })).toBeInTheDocument()

    // A drag completion must not leave the source button selected through a
    // follow-up click event.
    fireEvent.click(palette)
    expect(palette).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'まわす' }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' })).toBeInTheDocument()
  })

  test('does not place when a palette drag ends outside the board or on an occupied cell', () => {
    renderGame()
    mockBoardRect()
    const palette = screen.getByRole('button', { name: 'まっすぐを おく' })

    fireEvent.pointerDown(palette, pointerOptions(2, 20, 500))
    fireEvent.pointerMove(palette, pointerOptions(2, 500, 500))
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()
    fireEvent.pointerUp(palette, pointerOptions(2, 500, 500))
    expect(screen.getByRole('status')).toHaveTextContent('そこには おけないよ')
    expect(screen.queryByRole('gridcell', { name: 'まっすぐ、1ぎょう 1れつ' })).not.toBeInTheDocument()

    fireEvent.pointerDown(palette, pointerOptions(3, 20, 500, 'mouse'))
    fireEvent.pointerMove(palette, pointerOptions(3, 50, 150, 'mouse'))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'false')
    fireEvent.pointerUp(palette, pointerOptions(3, 50, 150, 'mouse'))
    expect(screen.getByRole('gridcell', { name: 'スタート、2ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('そこには おけないよ')
  })

  test('uses the current 5x5 board geometry for a palette drag to the edge', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ひろい 5×5' }))
    mockBoardRect()
    const palette = screen.getByRole('button', { name: 'Xじを おく' })

    fireEvent.pointerDown(palette, pointerOptions(4, 20, 500))
    fireEvent.pointerMove(palette, pointerOptions(4, 360, 360))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    fireEvent.pointerUp(palette, pointerOptions(4, 360, 360))
    expect(screen.getByRole('gridcell', { name: 'Xじ、5ぎょう 5れつ' })).toBeInTheDocument()
  })

  test('drags a placed road to an empty cell with a snapped preview and preserved rotation', () => {
    renderGame()
    const board = mockBoardRect()
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })

    fireEvent.pointerDown(source, pointerOptions(10, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(10, 350, 50))
    expect(source).toHaveAttribute('aria-grabbed', 'true')
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    expect(screen.getByRole('status')).toHaveTextContent('まっすぐを つかんだよ')

    fireEvent.pointerUp(source, pointerOptions(10, 350, 50))
    expect(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' })).toBeInTheDocument()
    const moved = screen.getByRole('gridcell', { name: 'まっすぐ、1ぎょう 4れつ' })
    expect(moved).toHaveAttribute('aria-grabbed', 'false')
    expect(moved).toHaveStyle('--rotation: 2')
    expect(board).toBeInTheDocument()
  })

  test('rejects occupied and out-of-board drops without losing a placed part', () => {
    renderGame()
    mockBoardRect()
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })

    fireEvent.pointerDown(source, pointerOptions(11, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(11, 250, 150))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'false')
    fireEvent.pointerUp(source, pointerOptions(11, 250, 150))
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'ゴール、2ぎょう 3れつ' })).toBeInTheDocument()

    fireEvent.pointerDown(source, pointerOptions(12, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(12, 500, 500))
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()
    fireEvent.pointerUp(source, pointerOptions(12, 500, 500))
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('そこには おけないよ')
  })

  test('keeps a light tap as selection and treats a return to the origin as a no-op', () => {
    renderGame()
    mockBoardRect()
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })

    fireEvent.pointerDown(source, pointerOptions(14, 150, 150))
    fireEvent.pointerUp(source, pointerOptions(14, 150, 150))
    fireEvent.click(source)
    expect(source).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()

    fireEvent.pointerDown(source, pointerOptions(15, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(15, 180, 150))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    fireEvent.pointerUp(source, pointerOptions(15, 150, 150))
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })).toHaveStyle('--rotation: 2')
    expect(screen.getByRole('status')).toHaveTextContent('そのままだよ')
  })

  test('supports moving to the edge on the 5x5 stage, then rotating and deleting', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ひろい 5×5' }))
    mockBoardRect(500)
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })

    fireEvent.pointerDown(source, pointerOptions(13, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(13, 450, 450))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    fireEvent.pointerUp(source, pointerOptions(13, 450, 450))
    expect(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' })).toBeInTheDocument()
    const moved = screen.getByRole('gridcell', { name: 'まっすぐ、5ぎょう 5れつ' })
    expect(moved).toHaveStyle('--rotation: 2')

    // Consume the click that a real pointerup can synthesize, then exercise
    // the normal selected-part controls on the moved cell.
    fireEvent.click(moved)
    await user.click(moved)
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、5ぎょう 5れつ' })).toHaveStyle('--rotation: 3')
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' })).toBeInTheDocument()
  })

  test('wide stage keeps placement, rotation, deletion and start/goal controls working', async () => {
    const user = userEvent.setup()
    renderGame()

    await user.click(screen.getByRole('button', { name: 'ひろい 5×5' }))
    expect(screen.getByRole('gridcell', { name: 'スタート、2ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'ゴール、2ぎょう 3れつ' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' }))
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、5ぎょう 5れつ' })).toHaveStyle('--rotation: 1')
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、5ぎょう 5れつ' })).toBeInTheDocument()
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
