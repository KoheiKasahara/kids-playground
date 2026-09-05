import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PukupukaRescuePlay from './PukupukaRescuePlay'

/**
 * requestAnimationFrame を手動で進められるようにして、
 * 「水位を変える → アヒルが動く」までを実画面と同じ経路で確かめる。
 */
function controlAnimationFrames() {
  let nextId = 1
  let pending: { id: number; callback: FrameRequestCallback } | null = null
  const cancelled: number[] = []
  let now = 0

  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    const id = nextId
    nextId += 1
    pending = { id, callback }
    return id
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    cancelled.push(id)
    if (pending && pending.id === id) pending = null
  })
  vi.spyOn(performance, 'now').mockImplementation(() => now)

  return {
    /** 1フレーム（既定16.7ms）進める。 */
    advance(frames = 1, stepMs = 1000 / 60) {
      for (let index = 0; index < frames; index += 1) {
        const current = pending
        if (!current) throw new Error('次のフレームが予約されていません')
        pending = null
        now += stepMs
        act(() => current.callback(now))
      }
    },
    hasPendingFrame() {
      return pending !== null
    },
    cancelledIds: cancelled,
  }
}

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/games/pukupuka-rescue']}>
      <PukupukaRescuePlay />
    </MemoryRouter>,
  )
}

function duckY(): number {
  const duck = screen.getByTestId('pukupuka-floater-duck')
  return Number(duck.getAttribute('data-floater-y'))
}

function duckX(): number {
  const duck = screen.getByTestId('pukupuka-floater-duck')
  return Number(duck.getAttribute('data-floater-x'))
}

function surfaceY(): number {
  return Number(screen.getByTestId('pukupuka-water-main').getAttribute('data-surface-y'))
}

function waterPercent(): number {
  return Number(screen.getByTestId('pukupuka-gauge-fill').getAttribute('data-water-percent'))
}

/** じゃぐちの操作対象（押している間だけ注水する）。 */
function faucet(): HTMLElement {
  return screen.getByRole('button', { name: /じゃぐち/ })
}

function faucetActive(): boolean {
  return screen.getByTestId('pukupuka-faucet').getAttribute('data-faucet-active') === 'true'
}

function drainButton(): HTMLElement {
  return screen.getByRole('button', { name: /みずを へらす/ })
}

/** ボタンを押しっぱなしにしたまま指定フレーム進め、最後に離す。 */
function hold(
  frames: ReturnType<typeof controlAnimationFrames>,
  button: HTMLElement,
  frameCount: number,
) {
  fireEvent.pointerDown(button)
  frames.advance(frameCount)
  fireEvent.pointerUp(button)
}

describe('PukupukaRescuePlay', () => {
  let frames: ReturnType<typeof controlAnimationFrames>

  beforeEach(() => {
    frames = controlAnimationFrames()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('タイトル・もどる・主要操作がそろっている', () => {
    renderGame()

    expect(screen.getByRole('heading', { name: 'ぷかぷかレスキュー' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← もどる' })).toBeInTheDocument()
    expect(faucet()).toBeInTheDocument()
    expect(drainButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やりなおし' })).toBeInTheDocument()
    expect(screen.getByTestId('pukupuka-stage')).toBeInTheDocument()
    expect(screen.getByTestId('pukupuka-floater-duck')).toBeInTheDocument()
  })

  test('じゃぐちを押すと水面が上がり、アヒルも上がる', () => {
    renderGame()
    frames.advance(30)
    const before = duckY()
    const beforeSurface = surfaceY()

    hold(frames, faucet(), 90)

    // Yは下向き。上がる＝値が小さくなる。
    expect(surfaceY()).toBeLessThan(beforeSurface)
    expect(duckY()).toBeLessThan(before - 5)
    expect(waterPercent()).toBeGreaterThan(20)
  })

  test('じゃぐちを押しているあいだだけ見た目上もON（注水中）になる', () => {
    renderGame()
    expect(faucetActive()).toBe(false)
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')

    fireEvent.pointerDown(faucet())
    expect(faucetActive()).toBe(true)
    expect(faucet()).toHaveAttribute('aria-pressed', 'true')

    fireEvent.pointerUp(faucet())
    expect(faucetActive()).toBe(false)
    expect(faucet()).toHaveAttribute('aria-pressed', 'false')
  })

  test('水をへらすと水面が下がり、アヒルも下がる', () => {
    renderGame()
    hold(frames, faucet(), 90)
    frames.advance(30)
    const before = duckY()

    hold(frames, drainButton(), 120)

    expect(duckY()).toBeGreaterThan(before + 5)
  })

  test('水を減らし切ってもアヒルは床の上に残る', () => {
    renderGame()
    hold(frames, drainButton(), 240)

    expect(waterPercent()).toBe(0)
    expect(duckY()).toBeCloseTo(118, 0)
  })

  test('水を増やし切っても表示が壊れない（最大水位を超えない）', () => {
    renderGame()
    hold(frames, faucet(), 300)

    expect(waterPercent()).toBe(100)
    expect(duckY()).toBeGreaterThan(0)
    expect(surfaceY()).toBeCloseTo(30, 1)
  })

  test('じゃぐちから指が離れたら水の増加が止まる', () => {
    renderGame()
    hold(frames, faucet(), 30)
    const afterRelease = waterPercent()

    frames.advance(60)

    // 目標水位まで追いつくぶんの変化はあるが、押していないので増え続けはしない。
    expect(waterPercent()).toBeLessThan(afterRelease + 20)
  })

  test('キーボード操作（click）でもじゃぐちから水が増える', () => {
    renderGame()
    frames.advance(30)
    const before = waterPercent()

    fireEvent.click(faucet())
    frames.advance(30)

    expect(waterPercent()).toBeGreaterThan(before)
  })

  test('やりなおしで初期状態へ戻る', () => {
    renderGame()
    hold(frames, faucet(), 120)
    expect(duckY()).toBeLessThan(100)

    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))
    frames.advance(1)

    expect(duckY()).toBeCloseTo(118, 0)
    expect(duckX()).toBeCloseTo(27, 0)
    expect(waterPercent()).toBeCloseTo(15, 0)
    expect(faucetActive()).toBe(false)
  })

  test('やりなおしはじゃぐちを押している最中に押しても、押しっぱなし状態を残さない', () => {
    renderGame()
    fireEvent.pointerDown(faucet())
    frames.advance(10)
    expect(faucetActive()).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))

    expect(faucetActive()).toBe(false)
    const percentAfterReset = waterPercent()
    frames.advance(60)
    // リセット後は指を離した扱いのままなので、押しっぱなしのように増え続けない。
    expect(waterPercent()).toBeLessThanOrEqual(percentAfterReset + 5)
  })

  test('ゴールすると「ゴール！」が1回だけ出て、水の操作ができなくなる', () => {
    renderGame()
    hold(frames, faucet(), 60 * 6)
    expect(screen.queryByText('ゴール！')).not.toBeInTheDocument()

    hold(frames, drainButton(), 60 * 6)

    expect(screen.getAllByText('ゴール！')).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ アヒルを たすけたよ')
    expect(faucet()).toBeDisabled()
    expect(drainButton()).toBeDisabled()

    // クリア後にさらに進めても、表示が二重になったり消えたりしない。
    frames.advance(120)
    expect(screen.getAllByText('ゴール！')).toHaveLength(1)
  })

  test('ゴール後にやりなおすと、もう一度あそべる', () => {
    renderGame()
    hold(frames, faucet(), 60 * 6)
    hold(frames, drainButton(), 60 * 6)
    expect(screen.getAllByText('ゴール！')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'やりなおし' }))
    frames.advance(1)

    expect(screen.queryByText('ゴール！')).not.toBeInTheDocument()
    expect(faucet()).toBeEnabled()
    expect(duckY()).toBeCloseTo(118, 0)
  })

  test('アンマウントすると次のフレームが残らない', () => {
    const { unmount } = renderGame()
    frames.advance(5)
    expect(frames.hasPendingFrame()).toBe(true)

    unmount()

    expect(frames.cancelledIds.length).toBeGreaterThan(0)
    expect(frames.hasPendingFrame()).toBe(false)
  })

  test('アンマウント後に window の pointer イベントを受け取らない', () => {
    const { unmount } = renderGame()
    unmount()

    // 解除されていなければ、ここで状態更新が走りReactの警告が出る。
    expect(() => fireEvent.pointerUp(window)).not.toThrow()
  })
})
