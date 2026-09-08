import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, test, vi } from 'vitest'
import type { CircuitRacingEngineOptions } from './useCircuitRacingEngine'
import CircuitRacingPlay from './CircuitRacingPlay'
import { CIRCUITS } from './circuit'
import { RACE_CARS } from './raceConfig'

const engineMock = vi.hoisted(() => ({ options: undefined as CircuitRacingEngineOptions | undefined, retry: vi.fn(), adjustCamera: vi.fn() }))

vi.mock('./useCircuitRacingEngine', () => ({
  useCircuitRacingEngine: (options: CircuitRacingEngineOptions) => {
    engineMock.options = options
    return { registerContainer: () => {}, retry: engineMock.retry, adjustCamera: engineMock.adjustCamera }
  },
}))

function renderGame() {
  const result = render(
    <MemoryRouter>
      <CircuitRacingPlay />
    </MemoryRouter>,
  )
  act(() => engineMock.options?.onStatusChange?.('ready'))
  return result
}

describe('サーキットレースの じゅんびと そうさ', () => {
  afterEach(() => vi.unstubAllGlobals())

  test('動きを減らす設定では固定カメラから明示的に開始する', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    renderGame()
    expect(engineMock.options?.running).toBe(false)
    expect(engineMock.options?.cameraMode).toBe('trackside')
    await userEvent.setup().click(screen.getByRole('button', { name: 'レースを はじめる' }))
    expect(engineMock.options?.cameraMode).toBe('trackside')
    expect(engineMock.options?.running).toBe(true)
  })
  test('2だいの3Dレースを開始できる', async () => {
    const user = userEvent.setup()
    renderGame()
    expect(screen.getByRole('heading', { name: /サーキットレース/ })).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: /だいめの くるま/ })).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'レースを はじめる' }))

    expect(screen.getByRole('heading', { name: /はしってるよ/ })).toBeInTheDocument()
    expect(engineMock.options?.running).toBe(true)
  })

  test('3だいに増やし、同じ車種と色を選べる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: '3だい' }))
    expect(screen.getAllByRole('region', { name: /だいめの くるま/ })).toHaveLength(3)
    const carButtons = screen.getAllByRole('button', { name: 'スポーツカーを えらぶ' })
    await user.click(carButtons[1]!)
    const redButtons = screen.getAllByRole('button', { name: 'あか' })
    await user.click(redButtons[1]!)
    expect(engineMock.options?.selections[1]).toEqual({ carId: 'sportsCar', color: '#ef4444' })
  })

  test('8車種を選べ、新しい車種と色を3台のレース・選び直しまで保持する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: '3だい' }))
    const slots = screen.getAllByRole('region', { name: /だいめの くるま/ })
    for (const slot of slots) {
      expect(within(slot).getAllByRole('button', { name: /を えらぶ$/ })).toHaveLength(8)
    }
    for (const car of RACE_CARS) {
      const button = within(slots[0]!).getByRole('button', { name: `${car.label}を えらぶ` })
      await user.click(button)
      expect(button).toHaveAttribute('aria-pressed', 'true')
      expect(engineMock.options?.selections[0].carId).toBe(car.id)
      expect(within(slots[0]!).getByText(car.description)).toBeInTheDocument()
    }
    await user.click(within(slots[1]!).getByRole('button', { name: 'パトカーを えらぶ' }))
    await user.click(within(slots[2]!).getByRole('button', { name: 'きゅうきゅうしゃを えらぶ' }))
    await user.click(within(slots[2]!).getByRole('button', { name: 'むらさき' }))
    const selections = [
      { carId: 'van', color: '#ef4444' },
      { carId: 'policeCar', color: '#2563eb' },
      { carId: 'ambulance', color: '#9333ea' },
    ]
    await user.click(screen.getByRole('button', { name: 'レースを はじめる' }))
    expect(engineMock.options?.running).toBe(true)
    expect(engineMock.options?.selections).toEqual(selections)
    await user.click(screen.getByRole('button', { name: /えらびなおす/ }))
    expect(engineMock.options?.selections).toEqual(selections)
    expect(within(screen.getByRole('region', { name: '3だいめの くるま' }))
      .getByRole('button', { name: 'きゅうきゅうしゃを えらぶ' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('一時停止、カメラ切り替え、対象選択、選択画面へ戻る', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'レースを はじめる' }))
    await user.click(screen.getByRole('button', { name: 'やすむ' }))
    expect(engineMock.options?.running).toBe(false)
    await user.click(screen.getByRole('button', { name: 'みちばた' }))
    expect(engineMock.options?.cameraMode).toBe('trackside')
    await user.click(screen.getByRole('button', { name: /2だいめ/ }))
    expect(engineMock.options?.targetIndex).toBe(1)
    await user.click(screen.getByRole('button', { name: 'じゆうに みる' }))
    expect(engineMock.options?.cameraMode).toBe('free')
    await user.click(screen.getByRole('button', { name: /ぜんたい/ }))
    expect(engineMock.adjustCamera).toHaveBeenLastCalledWith('overview')
    await user.click(screen.getByRole('button', { name: /えらびなおす/ }))
    expect(screen.getByRole('button', { name: 'レースを はじめる' })).toBeInTheDocument()
  })

  test('3Dエラー時は開始を止め、再試行を出す', async () => {
    renderGame()
    act(() => engineMock.options?.onStatusChange?.('error', 'webgl'))
    expect(screen.getByRole('alert')).toHaveTextContent('3Dを ひょうじできないよ')
    expect(screen.getByRole('button', { name: 'レースを はじめる' })).toBeDisabled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engineMock.retry).toHaveBeenCalledOnce()
  })
})


test('コースを選んで開始・戻る・変更でき、車の選択を保持する', async () => {
  const user = userEvent.setup()
  renderGame()
  await user.click(screen.getByRole('button', { name: '3だい' }))
  const selections = engineMock.options!.selections
  for (const course of CIRCUITS.slice(1)) {
    await user.click(screen.getByRole('button', { name: course.name }))
    expect(screen.getByRole('button', { name: course.name })).toHaveAttribute('aria-pressed', 'true')
    expect(engineMock.options?.circuit).toBe(course)
    expect(engineMock.options?.running).toBe(false)
    expect(screen.getByRole('button', { name: 'レースを はじめる' })).toBeDisabled()
    act(() => engineMock.options?.onStatusChange?.('ready'))
    await user.click(screen.getByRole('button', { name: 'レースを はじめる' }))
    expect(engineMock.options?.running).toBe(true)
    expect(screen.getByText(course.name)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /えらびなおす/ }))
    expect(screen.getByRole('button', { name: course.name })).toHaveAttribute('aria-pressed', 'true')
    expect(engineMock.options?.selections).toEqual(selections)
  }
})
