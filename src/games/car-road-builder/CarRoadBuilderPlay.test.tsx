import { afterEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
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

async function buildSimpleGoalRoute(user: ReturnType<typeof userEvent.setup>) {
  const straight = screen.getByRole('button', { name: 'まっすぐを おく' })
  await user.click(straight)

  await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 2れつ' }))

  await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 3れつ' }))

  await user.click(screen.getByRole('button', { name: 'カーブを おく' }))
  await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 4れつ' }))
  for (let index = 0; index < 4; index += 1) {
    await user.click(screen.getByRole('button', { name: 'まわす' }))
  }

  await user.click(straight)
  await user.click(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 4れつ' }))
  await user.click(screen.getByRole('button', { name: 'まわす' }))
  await user.click(screen.getByRole('button', { name: 'まわす' }))

  await user.click(screen.getByRole('gridcell', { name: 'あきセル、3ぎょう 4れつ' }))
  await user.click(screen.getByRole('button', { name: 'まわす' }))
  await user.click(screen.getByRole('button', { name: 'まわす' }))
}

function queueAnimationFrames() {
  const callbacks: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    callbacks.push(callback)
    return callbacks.length
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  return {
    completeLatest() {
      const callback = callbacks.at(-1)
      if (!callback) throw new Error('expected a queued animation frame')
      act(() => callback(performance.now() + 100_000))
    },
  }
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
    expect(screen.queryByText('くるまを えらんでね')).not.toBeInTheDocument()
    expect(screen.queryByText('パーツを えらんでね')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
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
    expect(screen.queryByText('スタート', { selector: '.selectionTools span' })).not.toBeInTheDocument()

    const goal = screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })
    await user.click(goal)
    expect(screen.getByRole('button', { name: 'まわす' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'けす' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })).toHaveStyle('--rotation: 1')
  })

  test('moves start and goal to empty cells without duplicating them', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' }))
    expect(screen.getByRole('gridcell', { name: 'スタート、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: /スタート/ })).toHaveLength(1)

    await user.click(screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、3ぎょう 3れつ' }))
    expect(screen.getByRole('gridcell', { name: 'ゴール、3ぎょう 3れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'あきセル、4ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: /ゴール/ })).toHaveLength(1)
  })

  test('supports dragging start and goal to empty cells', () => {
    renderPlay()
    const board = mockBoardRect()
    const start = screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })

    fireEvent.pointerDown(start, pointerOptions(7, 50, 50))
    fireEvent.pointerMove(start, pointerOptions(7, 150, 150))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    fireEvent.pointerUp(start, pointerOptions(7, 150, 150))

    expect(screen.getByRole('gridcell', { name: 'スタート、2ぎょう 2れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: /スタート/ })).toHaveLength(1)

    const goal = screen.getByRole('gridcell', { name: 'ゴール、4ぎょう 4れつ' })
    fireEvent.pointerDown(goal, pointerOptions(8, 350, 350))
    fireEvent.pointerMove(goal, pointerOptions(8, 250, 250))
    expect(screen.getByTestId('car-road-drop-preview')).toHaveAttribute('data-valid', 'true')
    fireEvent.pointerUp(goal, pointerOptions(8, 250, 250))

    expect(screen.getByRole('gridcell', { name: 'ゴール、3ぎょう 3れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'あきセル、4ぎょう 4れつ' })).toBeInTheDocument()
    expect(screen.getAllByRole('gridcell', { name: /ゴール/ })).toHaveLength(1)
    expect(board).toHaveAttribute('aria-rowcount', '4')
    expect(board).toHaveAttribute('aria-colcount', '4')
  })

  test('does not let a marker move onto an occupied road cell', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'まっすぐを おく' }))
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、2ぎょう 2れつ' }))
    await user.click(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' }))
    await user.click(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' }))

    expect(screen.getByRole('gridcell', { name: 'スタート、1ぎょう 1れつ' })).toBeInTheDocument()
    expect(screen.getByRole('gridcell', { name: 'まっすぐ、2ぎょう 2れつ' })).toBeInTheDocument()
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

  test('shows, places, rotates and deletes the double curve palette part', async () => {
    const user = userEvent.setup()
    renderPlay()

    const doubleCurve = screen.getByRole('button', { name: 'ふたつカーブを おく' })
    expect(doubleCurve).toBeInTheDocument()
    await user.click(doubleCurve)
    await user.click(screen.getByRole('gridcell', { name: 'あきセル、1ぎょう 2れつ' }))

    const placed = screen.getByRole('gridcell', { name: 'ふたつカーブ、1ぎょう 2れつ' })
    expect(placed).toBeInTheDocument()
    expect(placed).toHaveStyle('--rotation: 0')
    expect(placed.querySelectorAll('svg path')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(screen.getByRole('gridcell', { name: 'ふたつカーブ、1ぎょう 2れつ' })).toHaveStyle('--rotation: 2')
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

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(screen.getAllByRole('gridcell')).toHaveLength(16)
  })

  test('shows one goal burst and allows repeated departures without losing the board or vehicle', async () => {
    const user = userEvent.setup()
    const frames = queueAnimationFrames()
    renderPlay()
    await buildSimpleGoalRoute(user)
    await user.click(screen.getByRole('button', { name: 'トラック' }))

    for (let run = 0; run < 3; run += 1) {
      if (run === 1) await user.click(screen.getByRole('button', { name: 'バス' }))
      await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
      frames.completeLatest()

      expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'cleared')
      expect(screen.getByTestId('car-road-goal-burst')).toBeInTheDocument()
      expect(screen.getAllByTestId('car-road-goal-burst')).toHaveLength(1)
      expect(screen.getByRole('button', { name: 'しゅっぱつ' })).toBeEnabled()
      expect(screen.getByRole('gridcell', { name: 'まっすぐ、1ぎょう 2れつ' })).toBeInTheDocument()
      expect(screen.getByLabelText('くるま').querySelector('[data-testid="car-visual"]')).toHaveAttribute('data-vehicle-id', run === 0 ? 'truck' : 'bus')
    }
  })

  test('does not duplicate the goal burst when the same completion frame is delivered twice', async () => {
    const user = userEvent.setup()
    const frames = queueAnimationFrames()
    renderPlay()
    await buildSimpleGoalRoute(user)
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))

    frames.completeLatest()
    frames.completeLatest()

    expect(screen.getAllByTestId('car-road-goal-burst')).toHaveLength(1)
    expect(screen.getByRole('main')).toHaveAttribute('data-phase', 'cleared')
  })

  test('cleans the goal burst when leaving the play screen for a new stage', async () => {
    const user = userEvent.setup()
    const frames = queueAnimationFrames()
    const view = renderPlay()
    await buildSimpleGoalRoute(user)
    await user.click(screen.getByRole('button', { name: 'しゅっぱつ' }))
    frames.completeLatest()
    expect(screen.getByTestId('car-road-goal-burst')).toBeInTheDocument()

    view.unmount()
    renderPlay('wide')

    expect(screen.getByRole('main')).toHaveAttribute('data-stage-id', 'wide')
    expect(screen.queryByTestId('car-road-goal-burst')).not.toBeInTheDocument()
  })
})
