import { afterEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import CarRoadBuilderPlay from './CarRoadBuilderPlay'
import CarRoadBuilderStageSelect from './CarRoadBuilderStageSelect'

function LocationProbe() {
  const location = useLocation()
  const stageId = (location.state as { stageId?: unknown } | null)?.stageId
  return <div data-testid="location-probe">{location.pathname}:{typeof stageId === 'string' ? stageId : ''}</div>
}

function renderPlay(stageId: 'normal' | 'wide' = 'normal') {
  return render(
    <MemoryRouter initialEntries={['/games/car-road-builder/play']}>
      <CarRoadBuilderPlay stageId={stageId} />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function renderStageSelect() {
  return render(
    <MemoryRouter initialEntries={['/games/car-road-builder']}>
      <CarRoadBuilderStageSelect />
      <LocationProbe />
    </MemoryRouter>,
  )
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

describe('CarRoadBuilderStageSelect', () => {
  test('opens with only the simple stage choices', () => {
    renderStageSelect()

    expect(screen.getByRole('heading', { name: 'どのひろさで あそぶ？' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふつう 4×4' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ひろい 5×5' })).toBeEnabled()
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  test.each([
    ['ふつう 4×4', 'normal'],
    ['ひろい 5×5', 'wide'],
  ])('starts the selected stage from %s', async (label, stageId) => {
    const user = userEvent.setup()
    renderStageSelect()

    await user.click(screen.getByRole('button', { name: label }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent(`/games/car-road-builder/play:${stageId}`)
  })

  test('returns to the mini-game list from stage selection', async () => {
    const user = userEvent.setup()
    renderStageSelect()

    await user.click(screen.getByRole('button', { name: 'もどる' }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/')
  })
})

describe('CarRoadBuilderPlay', () => {
  afterEach(() => vi.restoreAllMocks())

  test('renders a fresh 4x4 board with only start and goal markers', () => {
    renderPlay()

    expect(screen.getByRole('heading', { name: /くるまのみちづくり/ })).toBeInTheDocument()
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '4')
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
    expect(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.queryByText('ひろさを えらんでね')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ふつう 4×4' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'スタートを おく' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ゴールを おく' })).not.toBeInTheDocument()
  })

  test('renders the complete 5x5 board inside the selected play screen', () => {
    renderPlay('wide')

    expect(screen.getByRole('main')).toHaveAttribute('data-stage-id', 'wide')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '5')
    expect(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '5')
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)
    expect(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'ゴール、5ぎょう 5れつ' })).toBeInTheDocument()
  })

  test('returns from play to stage selection instead of the mini-game list', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'もどる' }))

    expect(screen.getByTestId('location-probe')).toHaveTextContent('/games/car-road-builder:')
  })

  test('keeps the car and vehicle selection available in play', async () => {
    const user = userEvent.setup()
    renderPlay()

    const truck = screen.getByRole('button', { name: 'トラック' })
    await user.click(truck)

    expect(truck).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', 'truck')
    expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-front-direction', 'E')
  })

  test('keeps start and goal movable/rotatable but not deletable', async () => {
    const user = userEvent.setup()
    renderPlay()

    const start = screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })
    await user.click(start)
    expect(screen.getByRole('button', { name: 'まわす' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'けす' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })).toHaveStyle('--rotation: 3')

    const goal = screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })
    await user.click(goal)
    expect(screen.getByRole('button', { name: 'まわす' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'けす' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })).toHaveStyle('--rotation: 1')
  })

  test('places road parts by tap and exposes rotate/delete controls', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 2れつ' }))
    expect(screen.getByRole('gridcell', { name: 'カーブ、1ぎょう 2れつ' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'まわす' }))
    await user.click(screen.getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 2れつ' })).toBeInTheDocument()
  })

  test('palette drag keeps a 4x4 grid and places one part', () => {
    renderPlay()
    const board = mockBoardRect()
    const palette = screen.getByRole('button', { name: 'カーブを おく' })

    fireEvent.pointerDown(palette, pointerOptions(1, 20, 500))
    fireEvent.pointerMove(palette, pointerOptions(1, 50, 150))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
    expect(board).toHaveAttribute('aria-rowcount', '4')

    fireEvent.pointerUp(palette, pointerOptions(1, 50, 150))
    expect(screen.getByRole('gridcell', { name: 'カーブ、2ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
  })

  test('palette drag to the 5x5 edge keeps all 25 cells and no extra grid tracks', () => {
    renderPlay('wide')
    const board = mockBoardRect(500)
    const palette = screen.getByRole('button', { name: 'Xじを おく' })

    fireEvent.pointerDown(palette, pointerOptions(2, 20, 600))
    fireEvent.pointerMove(palette, pointerOptions(2, 450, 50))
    const preview = screen.getByTestId('car-road-drop-preview')
    expect(preview).toHaveAttribute('data-valid', 'true')
    expect(preview).toHaveStyle({ left: 'calc(var(--road-cell) * 4)', top: 'calc(var(--road-cell) * 0)' })
    expect(board).toHaveAttribute('aria-rowcount', '5')
    expect(board).toHaveAttribute('aria-colcount', '5')
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)

    fireEvent.pointerUp(palette, pointerOptions(2, 450, 50))
    expect(screen.getByRole('gridcell', { name: 'Xじ、1ぎょう 5れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)
  })

  test('dragging a placed part moves it without changing the 4x4 grid size', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: 'まっすぐを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' }))
    await user.click(screen.getByRole('button', { name: 'まっすぐを おく' }))

    const board = mockBoardRect()
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })
    fireEvent.pointerDown(source, pointerOptions(3, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(3, 350, 50))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)

    fireEvent.pointerUp(source, pointerOptions(3, 350, 50))
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、1ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
    expect(board).toHaveAttribute('aria-rowcount', '4')
    expect(board).toHaveAttribute('aria-colcount', '4')
  })

  test('cancelling palette or placed-part drags leaves the board dimensions unchanged', async () => {
    const user = userEvent.setup()
    renderPlay('wide')
    const palette = screen.getByRole('button', { name: 'まっすぐを おく' })
    const board = mockBoardRect(500)

    fireEvent.pointerDown(palette, pointerOptions(4, 20, 600))
    fireEvent.pointerMove(palette, pointerOptions(4, 50, 50))
    fireEvent.pointerCancel(palette, pointerOptions(4, 50, 50))
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)

    await user.click(palette)
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' }))
    const source = screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })
    fireEvent.pointerDown(source, pointerOptions(5, 150, 150))
    fireEvent.pointerMove(source, pointerOptions(5, 450, 50))
    fireEvent.pointerCancel(source, pointerOptions(5, 450, 50))
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(25)
    expect(board).toHaveAttribute('aria-rowcount', '5')
    expect(board).toHaveAttribute('aria-colcount', '5')
  })

  test('rejects a palette drop outside the board without changing cell count', () => {
    renderPlay()
    mockBoardRect()
    const palette = screen.getByRole('button', { name: 'まっすぐを おく' })

    fireEvent.pointerDown(palette, pointerOptions(6, 20, 500))
    fireEvent.pointerMove(palette, pointerOptions(6, 500, 500))
    expect(screen.queryByTestId('car-road-drop-preview')).not.toBeInTheDocument()
    fireEvent.pointerUp(palette, pointerOptions(6, 500, 500))

    expect(screen.getByRole('status')).toHaveTextContent('そこには おけないよ')
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
  })
})
