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
      act(() => {
        for (let index = 0; index < frames; index += 1) {
          const current = pending
          if (!current) throw new Error('次のフレームが予約されていません')
          pending = null
          now += 1000 / 60
          current.callback(now)
        }
      })
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

describe('ぷかぷかレスキューの直接操作', () => {
  let frames: ReturnType<typeof controlAnimationFrames>
  beforeEach(() => { localStorage.clear(); frames = controlAnimationFrames() })
  afterEach(() => vi.restoreAllMocks())
  const hold = (seconds: number) => {
    fireEvent.pointerDown(faucet()); frames.advance(seconds * 60); fireEvent.pointerUp(faucet())
  }
  test('6面を選択し、もどるは選択画面、続いてホームへ戻る', () => {
    renderGame()
    expect(screen.getAllByRole('button', { name: /^\d / })).toHaveLength(6)
    chooseStage(3)
    expect(screen.getByText(/しまの すいもん：/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /ステージ選択へもどる/ }))
    expect(screen.getByTestId('pukupuka-stage-select')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/')
  })
  test('最初の面にも蛇口と栓があり、注水でクリア、記録保存と次の面への遷移ができる', () => {
    const view = renderGame(); chooseStage(1)
    expect(screen.getByRole('button', { name: /せん/ })).toBeInTheDocument()
    hold(8)
    expect(screen.getByText('ゴール！')).toBeInTheDocument()
    expect(faucet()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'つぎのステージ' }))
    expect(screen.getByText(/くまを おむかえ：/)).toBeInTheDocument()
    view.unmount(); renderGame()
    expect(screen.getByLabelText(/クリアずみ/)).toBeInTheDocument()
  })
  test('途中のくまを浮かせ、栓を直接押して着地させる', () => {
    renderGame(); chooseStage(2)
    const bear = screen.getByTestId('pukupuka-floater-ringBear')
    const initialX = bear.getAttribute('data-floater-x')
    frames.advance(120)
    expect(bear.getAttribute('data-floater-x')).toBe(initialX)
    hold(8)
    expect(screen.queryByText('ゴール！')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /せん/ }))
    frames.advance(8 * 60)
    expect(screen.getByText('ゴール！')).toBeInTheDocument()
    expect(screen.getByLabelText('なかま 2 / 2 たすけた')).toBeInTheDocument()
  })
  test('水門は途中の位置を表示し、その開口から水が流れる', () => {
    renderGame(); chooseStage(3); hold(3)
    const gate = screen.getByTestId('pukupuka-gate')
    fireEvent.click(screen.getByRole('button', { name: /ゲート/ }))
    expect(gate).toHaveAttribute('data-gate-lift', '0')
    frames.advance(15)
    const lift = Number(gate.getAttribute('data-gate-lift'))
    expect(lift).toBeGreaterThan(0); expect(lift).toBeLessThan(1)
    expect(screen.getByTestId('pukupuka-gate-flow')).toHaveAttribute('data-flow-direction', 'right')
    frames.advance(45)
    expect(gate).toHaveAttribute('data-gate-lift', '1')
  })
  test('やりなおしで水門・栓・板・水・救助をすべて戻す', () => {
    renderGame(); chooseStage(4); hold(2)
    for (const name of [/ゲート/, /いた/, /せん/]) fireEvent.click(screen.getByRole('button', { name }))
    frames.advance(30)
    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))
    for (const name of [/ゲート/, /いた/, /せん/, /じゃぐち/]) expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('pukupuka-gate')).toHaveAttribute('data-gate-lift', '0')
    expect(screen.getByLabelText('なかま 0 / 2 たすけた')).toBeInTheDocument()
  })
  test('離す・画面を離れる操作で注水を止める', () => {
    renderGame(); chooseStage(1); hold(0.5)
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')
    frames.advance(60)
    const before = screen.getByTestId('pukupuka-water-main').getAttribute('data-surface-y')
    frames.advance(60)
    expect(screen.getByTestId('pukupuka-water-main')).toHaveAttribute('data-surface-y', before)
    fireEvent.pointerDown(faucet()); fireEvent(window, new Event('blur'))
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')
  })
  test('波の向きだけを残し、遠隔操作・仲間選択ボタン・下部ゲージを撤去する', () => {
    renderGame(); chooseStage(6)
    expect(screen.queryByRole('group', { name: 'すいろの そうさ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /を みる/ })).not.toBeInTheDocument()
    expect(screen.queryByTestId('pukupuka-gauge-fill')).not.toBeInTheDocument()
    expect(screen.getByTestId('pukupuka-stage')).toHaveAttribute('viewBox', '0 0 140 150')
    hold(1)
    fireEvent.click(screen.getByRole('button', { name: 'みぎへ なみ' }))
    expect(screen.getByTestId('pukupuka-player-wave')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))
    expect(screen.queryByTestId('pukupuka-player-wave')).not.toBeInTheDocument()
  })
  test('最終面も全景の仕掛けだけでクリアして選択へ戻れる', () => {
    renderGame(); chooseStage(6); hold(8)
    fireEvent.click(screen.getByRole('button', { name: /ゲート/ }))
    fireEvent.click(screen.getByRole('button', { name: /いた/ }))
    hold(10)
    fireEvent.click(screen.getByRole('button', { name: /せん/ })); frames.advance(12 * 60)
    fireEvent.click(screen.getByRole('button', { name: 'ステージをえらぶ' }))
    expect(screen.getByTestId('pukupuka-stage-select')).toBeInTheDocument()
  })
  test('アンマウント時にアニメーションループを解放する', () => {
    const view = renderGame(); chooseStage(1)
    expect(frames.hasPendingFrame()).toBe(true)
    view.unmount(); expect(frames.hasPendingFrame()).toBe(false)
  })
})
