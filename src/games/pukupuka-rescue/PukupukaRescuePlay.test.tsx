import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import PukupukaRescuePlay from './PukupukaRescuePlay'

function controlAnimationFrames() {
  let nextId = 1
  let pending: { id: number; callback: FrameRequestCallback } | null = null
  let now = 0

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId
    nextId += 1
    pending = { id, callback }
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    if (pending?.id === id) pending = null
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)

  return {
    advance(frames = 1) {
      for (let index = 0; index < frames; index += 1) {
        const current = pending
        if (!current) throw new Error('次のフレームが予約されていません')
        pending = null
        now += 1000 / 60
        act(() => current.callback(now))
      }
    },
    hasPendingFrame: () => pending !== null,
  }
}

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/games/pukupuka-rescue']}>
      <PukupukaRescuePlay />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-probe">{location.pathname}</div>
}

function chooseStage(index: number) {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${index} `) }))
}

function faucet() {
  return screen.getByRole('button', { name: /じゃぐち/ })
}

describe('PukupukaRescuePlay: ステージ選択', () => {
  test('起動時は6つのステージ選択だけを表示する', () => {
    renderGame()

    expect(screen.getByTestId('pukupuka-stage-select')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'どのステージで あそぶ？' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^\d / })).toHaveLength(6)
    expect(screen.queryByTestId('pukupuka-stage')).not.toBeInTheDocument()
  })

  test('ステージカードを押すと対応するプレイ画面になる', () => {
    renderGame()
    chooseStage(3)

    expect(screen.getByTestId('pukupuka-play')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('ゲートを あけよう')
    expect(screen.getByTestId('pukupuka-gate')).toBeInTheDocument()
  })

  test('プレイ中のもどるはステージ選択へ戻り、選択画面のもどるはホームへ進む', () => {
    renderGame()
    chooseStage(1)
    fireEvent.click(screen.getByRole('button', { name: /ステージ選択へもどる/ }))
    expect(screen.getByTestId('pukupuka-stage-select')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '← もどる' }))
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/')
  })
})

describe('PukupukaRescuePlay: ステージ固有の操作', () => {
  let frames: ReturnType<typeof controlAnimationFrames>

  beforeEach(() => {
    frames = controlAnimationFrames()
  })

  afterEach(() => vi.restoreAllMocks())

  test('ステージ1はじゃぐちだけを表示し、注水でゴールできる', () => {
    renderGame()
    chooseStage(1)

    expect(faucet()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /せん/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ゲート/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /いた/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pukupuka-water-wheel')).not.toBeInTheDocument()

    fireEvent.pointerDown(faucet())
    frames.advance(5 * 60)
    fireEvent.pointerUp(faucet())

    expect(screen.getByText('ゴール！')).toBeInTheDocument()
  })

  test('ステージ2は水をためてから排水するとゴールできる', () => {
    renderGame()
    chooseStage(2)

    const drain = screen.getByRole('button', { name: /せん/ })
    expect(screen.queryByRole('button', { name: /ゲート/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('pukupuka-water-wheel')).toBeInTheDocument()

    fireEvent.pointerDown(faucet())
    frames.advance(8 * 60)
    fireEvent.pointerUp(faucet())
    expect(screen.queryByText('ゴール！')).not.toBeInTheDocument()

    fireEvent.click(drain)
    frames.advance(8 * 60)
    expect(screen.getByText('ゴール！')).toBeInTheDocument()
    expect(faucet()).toBeDisabled()
    expect(drain).toBeDisabled()
  })

  test('じゃぐちから指を離すと注水中表示が消え、注水を押し続けない', () => {
    renderGame()
    chooseStage(1)

    fireEvent.pointerDown(faucet())
    expect(faucet()).toHaveAttribute('aria-pressed', 'true')
    frames.advance(30)
    fireEvent.pointerUp(faucet())
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')
    const afterRelease = Number(screen.getByTestId('pukupuka-gauge-fill').getAttribute('data-water-percent'))

    frames.advance(60)
    const afterWait = Number(screen.getByTestId('pukupuka-gauge-fill').getAttribute('data-water-percent'))
    // 押しっぱなしならさらに24レベル/秒で目標が伸び続けるが、解放後は
    // 直前の目標へ追いつくぶんを除いて増えない。
    expect(afterWait).toBeLessThan(afterRelease + 20)
  })

  test('やりなおしで選択中ステージの初期状態とギミック状態へ戻る', () => {
    renderGame()
    chooseStage(4)

    const board = screen.getByRole('button', { name: /いた/ })
    const gate = screen.getByRole('button', { name: /ゲート/ })
    const drain = screen.getByRole('button', { name: /せん/ })
    expect(board).toHaveAttribute('aria-pressed', 'false')
    fireEvent.pointerDown(faucet())
    frames.advance(5)
    fireEvent.click(board)
    fireEvent.click(gate)
    fireEvent.click(drain)
    expect(board).toHaveAttribute('aria-pressed', 'true')
    expect(gate).toHaveAttribute('aria-pressed', 'true')
    expect(drain).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))
    expect(board).toHaveAttribute('aria-pressed', 'false')
    expect(gate).toHaveAttribute('aria-pressed', 'false')
    expect(drain).toHaveAttribute('aria-pressed', 'false')
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')
  })

  test('クリア後は最終ステージ以外につぎのステージを表示する', () => {
    renderGame()
    chooseStage(1)
    fireEvent.pointerDown(faucet())
    frames.advance(5 * 60)
    fireEvent.pointerUp(faucet())

    fireEvent.click(screen.getByRole('button', { name: 'つぎのステージ' }))
    expect(screen.getByRole('status')).toHaveTextContent('うえから ちゃくち')
    expect(screen.getByTestId('pukupuka-floater-duck')).toBeInTheDocument()
  })

  // 合計3000フレーム（6×60 + 12×60 + 12×60 + 20×60）を1フレームずつact()で
  // 進めるため、既定の5秒タイムアウトでは足りない（実測 約5秒）。
  test('最終ステージをクリアするとステージ選択へ戻る', () => {
    renderGame()
    chooseStage(6)

    fireEvent.pointerDown(faucet())
    frames.advance(6 * 60)
    fireEvent.pointerUp(faucet())
    frames.advance(12 * 60)
    fireEvent.click(screen.getByRole('button', { name: /ゲート/ }))
    frames.advance(12 * 60)
    fireEvent.click(screen.getByRole('button', { name: /いた/ }))
    frames.advance(20 * 60)

    const returnButton = screen.getByRole('button', { name: 'ステージをえらぶ' })
    expect(returnButton).toBeInTheDocument()
    fireEvent.click(returnButton)
    expect(screen.getByTestId('pukupuka-stage-select')).toBeInTheDocument()
  }, 20000)

  test('水車の水門は、せんを開けて水車を回すと通過してクリアできる', () => {
    renderGame()
    chooseStage(5)

    fireEvent.pointerDown(faucet())
    frames.advance(6 * 60)
    fireEvent.pointerUp(faucet())
    frames.advance(6 * 60)
    expect(screen.queryByText('ゴール！')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /せん/ }))
    expect(screen.getByTestId('pukupuka-water-wheel-gate')).toHaveAttribute('data-open', 'true')
    frames.advance(8 * 60)
    expect(screen.getByText('ゴール！')).toBeInTheDocument()
  })

  test('長い水路では浮遊物を追って横方向へカメラが移動する', () => {
    renderGame()
    chooseStage(6)

    const stage = screen.getByTestId('pukupuka-stage')
    expect(stage).toHaveAttribute('viewBox', '0 0 100 150')
    fireEvent.pointerDown(faucet())
    frames.advance(6 * 60)
    fireEvent.pointerUp(faucet())

    expect(Number(stage.getAttribute('data-camera-x'))).toBeGreaterThan(30)
    expect(stage.getAttribute('viewBox')?.split(' ')[2]).toBe('100')
  })

  test('プレイ画面をアンマウントすると予約中のRAFをキャンセルする', () => {
    const rendered = renderGame()
    chooseStage(1)
    expect(frames.hasPendingFrame()).toBe(true)

    rendered.unmount()

    expect(frames.hasPendingFrame()).toBe(false)
  })
})
