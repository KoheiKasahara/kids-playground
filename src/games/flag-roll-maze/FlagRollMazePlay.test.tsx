import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import FlagRollMazePlay from './FlagRollMazePlay'
import FlagRollMazeSelect from './FlagRollMazeSelect'
import type { MazeEngineOptions } from './useMazeEngine'
import type { TiltInput } from './tiltInput'
import {
  DEFAULT_MAZE_ZOOM_INDEX,
  MAX_MAZE_ZOOM_INDEX,
  MIN_MAZE_ZOOM_INDEX,
} from './mazeCamera'
import { DEFAULT_MAZE_STAGE_ID, nextMazeStageId } from './mazeStages'

// WebGLとRapierはjsdomで動かさず、エンジンへ渡った入力とコールバックだけを検証する。
const engineMock = vi.hoisted(() => ({
  options: undefined as MazeEngineOptions | undefined,
  setTilt: vi.fn<(tilt: TiltInput) => void>(),
  resetBallToStart: vi.fn(),
  setZoomIndex: vi.fn<(index: number) => void>(),
}))
const soundMock = vi.hoisted(() => ({
  primeAudio: vi.fn(),
  playCorrectSound: vi.fn(),
}))
const navigateMock = vi.hoisted(() => vi.fn())
const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function stubMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
}

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('./useMazeEngine', () => ({
  useMazeEngine: (options: MazeEngineOptions) => {
    engineMock.options = options
    return {
      registerContainer: () => undefined,
      setTilt: engineMock.setTilt,
      resetBallToStart: engineMock.resetBallToStart,
      setZoomIndex: engineMock.setZoomIndex,
    }
  },
}))

vi.mock('../../utils/quizSound', () => ({
  primeAudio: soundMock.primeAudio,
  playCorrectSound: soundMock.playCorrectSound,
}))

function renderPlay(stageId = DEFAULT_MAZE_STAGE_ID) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: '/games/flag-roll-maze/play', state: { flagId: 'jp', stageId } }]}
    >
      <FlagRollMazePlay />
    </MemoryRouter>,
  )
}

/** 中心(60,60)・半径60として測られるようにスティックの矩形を差し替える。 */
function stubStickRect(element: HTMLElement) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
    width: 120,
    height: 120,
    left: 0,
    top: 0,
    right: 120,
    bottom: 120,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect)
}

const lastTilt = () => engineMock.setTilt.mock.calls.at(-1)?.[0]

describe('FlagRollMazePlay', () => {
  beforeEach(() => {
    stubMatchMedia(false)
    engineMock.options = undefined
    engineMock.setTilt.mockClear()
    engineMock.resetBallToStart.mockClear()
    soundMock.primeAudio.mockClear()
    soundMock.playCorrectSound.mockClear()
    navigateMock.mockClear()
  })

  afterEach(() => {
    if (originalMatchMediaDescriptor) {
      Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor)
    } else {
      delete (window as unknown as Record<string, unknown>).matchMedia
    }
  })

  it('最初は遊び方の説明とスティックが出ている', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'こっきころころめいろ' })).toBeInTheDocument()
    expect(screen.getByText(/ゴールまで ボールを ころがそう/)).toBeInTheDocument()
    expect(screen.getByTestId('virtual-stick')).toBeInTheDocument()
    expect(engineMock.options?.flag.id).toBe('jp')
    expect(engineMock.options?.stageId).toBe(DEFAULT_MAZE_STAGE_ID)
    expect(screen.getByText('🟢 かんたん')).toBeInTheDocument()
  })

  it('⭐を取るとHUDの表示が増える', () => {
    renderPlay()

    const starHud = screen.getByRole('status', { name: 'あつめた ⭐' })
    expect(starHud).toHaveTextContent('⭐ 0 / 3')

    act(() => {
      engineMock.options?.onStarCollected?.(1, 3)
    })

    expect(starHud).toHaveTextContent('⭐ 1 / 3')
  })

  it('遷移stateで選んだstageIdをエンジンへ渡す', () => {
    renderPlay('ponpon')

    expect(engineMock.options?.stageId).toBe('ponpon')
    expect(screen.getByText('🔴 ぽんぽん')).toBeInTheDocument()
  })

  it('センサーが使えない端末でもスティック操作へ案内して遊び続けられる', async () => {
    const user = userEvent.setup()
    const original = window.DeviceOrientationEvent
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: undefined,
    })
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'スマホを かたむけて あそぶ' }))

    expect(screen.getByText('ゆびで あそぼう')).toBeInTheDocument()
    expect(screen.getByTestId('virtual-stick')).toBeInTheDocument()
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: original,
    })
  })

  it('スティックを倒すとエンジンへTiltInputが渡る', () => {
    renderPlay()
    const stick = screen.getByTestId('virtual-stick')
    stubStickRect(stick)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 120, clientY: 60 })

    expect(lastTilt()!.x).toBeGreaterThan(0)
    expect(lastTilt()!.y).toBeCloseTo(0, 5)
  })

  it('スティックを離すと中立へ戻る', () => {
    renderPlay()
    const stick = screen.getByTestId('virtual-stick')
    stubStickRect(stick)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 120, clientY: 60 })
    fireEvent.pointerUp(stick, { pointerId: 1, clientX: 120, clientY: 60 })

    expect(lastTilt()).toEqual({ x: 0, y: 0 })
  })

  it('最初にスティックへ触れたときに音を解禁する', () => {
    renderPlay()
    const stick = screen.getByTestId('virtual-stick')
    stubStickRect(stick)

    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 120, clientY: 60 })
    fireEvent.pointerUp(stick, { pointerId: 1, clientX: 120, clientY: 60 })
    fireEvent.pointerDown(stick, { pointerId: 2, clientX: 120, clientY: 60 })

    expect(soundMock.primeAudio).toHaveBeenCalledTimes(1)
  })

  it('矢印キーでも同じTiltInputを送れる', () => {
    renderPlay()

    fireEvent.keyDown(window, { code: 'ArrowUp' })
    expect(lastTilt()).toEqual({ x: 0, y: -1 })

    fireEvent.keyUp(window, { code: 'ArrowUp' })
    expect(lastTilt()).toEqual({ x: 0, y: 0 })
  })

  it('画面から離れたらキーの押しっぱなしを解除する', () => {
    renderPlay()

    fireEvent.keyDown(window, { code: 'ArrowRight' })
    expect(lastTilt()).toEqual({ x: 1, y: 0 })

    fireEvent.blur(window)
    expect(lastTilt()).toEqual({ x: 0, y: 0 })
  })

  it('「スタートに もどる」でボールだけを戻す', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'スタートに もどる' }))

    expect(engineMock.resetBallToStart).toHaveBeenCalledTimes(1)
    expect(lastTilt()).toEqual({ x: 0, y: 0 })
    // 世界は作り直さないので、待たずにそのまま続けられる。
    expect(engineMock.options!.runId).toBe(0)
    expect(engineMock.options!.stageId).toBe(DEFAULT_MAZE_STAGE_ID)
  })

  it('ゴールすると結果を知らせ、もういちどを出す', () => {
    renderPlay()
    expect(engineMock.options).toBeDefined()

    act(() => engineMock.options?.onStarCollected?.(2, 3))
    act(() => engineMock.options!.onGoal())

    // 結果と復帰通知で読み上げ領域が2つあるため、結果側の文言で確かめる。
    expect(screen.getByText('ゴール！ すごい！')).toHaveAttribute('aria-live', 'polite')
    // ゴールSEはエンジンが鳴らすため、プレイ画面では鳴らさない。
    expect(soundMock.playCorrectSound).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
    expect(document.querySelector('img[src$="/jp.svg"]')).toHaveAttribute(
      'src',
      expect.stringContaining('/jp.svg'),
    )
    expect(screen.getByText('にほん')).toBeInTheDocument()
    expect(screen.getByText('🟢 かんたん')).toBeInTheDocument()
    expect(screen.getByText('⭐ 2 / 3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'つぎの ステージ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こっきを かえる' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'スタートに もどる' })).toBeNull()
  })

  it('星を1つも取らずにゴールしてもクリアできる', () => {
    renderPlay()

    act(() => engineMock.options!.onGoal())

    expect(screen.getByText('ゴール！ すごい！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
  })

  it('ゴール後だけ小さな演出を描画する', () => {
    renderPlay()
    expect(screen.queryByTestId('maze-goal-burst')).toBeNull()

    act(() => engineMock.options!.onGoal())

    const burst = screen.getByTestId('maze-goal-burst')
    expect(burst).toHaveAttribute('aria-hidden', 'true')
    expect(burst.querySelectorAll('span')).toHaveLength(12)
  })

  it('動きを減らす設定では演出を出さず、結果表示だけを残す', () => {
    stubMatchMedia(true)
    renderPlay()

    act(() => engineMock.options!.onGoal())

    expect(screen.queryByTestId('maze-goal-burst')).toBeNull()
    expect(screen.getByText('ゴール！ すごい！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
  })

  it('ゴール後はスティックもキーも受け付けない', () => {
    renderPlay()
    act(() => engineMock.options!.onGoal())
    engineMock.setTilt.mockClear()

    const stick = screen.getByTestId('virtual-stick')
    stubStickRect(stick)
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 120, clientY: 60 })
    fireEvent.keyDown(window, { code: 'ArrowRight' })

    expect(engineMock.setTilt).not.toHaveBeenCalled()
  })

  it('「もういちど」で物理世界を作り直して最初から遊べる', async () => {
    const user = userEvent.setup()
    renderPlay()
    act(() => engineMock.options?.onStarCollected?.(2, 3))
    act(() => engineMock.options!.onGoal())

    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(engineMock.options!.runId).toBe(1)
    expect(engineMock.options!.stageId).toBe(DEFAULT_MAZE_STAGE_ID)
    expect(screen.getByRole('status', { name: 'あつめた ⭐' })).toHaveTextContent('⭐ 0 / 3')
    expect(screen.getByText(/ゴールまで ボールを ころがそう/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'スタートに もどる' })).toBeInTheDocument()
  })

  it('アスレチックの「もういちど」は新しいrunでギミックの状態を初期化する', async () => {
    const user = userEvent.setup()
    renderPlay('athletic')
    const firstRun = engineMock.options
    expect(firstRun?.stageId).toBe('athletic')
    expect(firstRun?.runId).toBe(0)

    act(() => engineMock.options!.onGoal())
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    // runIdが変わるためuseMazeEngineのeffectが作り直され、大砲・ジャンプ床・車のrun内状態も持ち越さない。
    expect(engineMock.options).not.toBe(firstRun)
    expect(engineMock.options!.stageId).toBe('athletic')
    expect(engineMock.options!.runId).toBe(1)
  })

  it('場外から復帰したことを知らせ、しばらくすると消える', () => {
    vi.useFakeTimers()
    try {
      renderPlay()
      act(() => engineMock.options!.onRescue!('outOfBounds'))
      expect(screen.getByText('スタートに もどったよ')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.queryByText('スタートに もどったよ')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('つぎのステージでstageIdを進め、物理世界を作り直す', async () => {
    const user = userEvent.setup()
    renderPlay()
    const nextStage = nextMazeStageId(DEFAULT_MAZE_STAGE_ID)
    expect(nextStage).not.toBeNull()
    act(() => engineMock.options?.onStarCollected?.(1, 3))
    act(() => engineMock.options!.onGoal())

    await user.click(screen.getByRole('button', { name: 'つぎの ステージ' }))

    expect(engineMock.options!.stageId).toBe(nextStage)
    expect(engineMock.options!.runId).toBe(1)
    expect(screen.getByRole('status', { name: 'あつめた ⭐' })).toHaveTextContent('⭐ 0 / 3')
    expect(screen.getByRole('button', { name: 'スタートに もどる' })).toBeInTheDocument()
  })

  it('最後の大砲ステージではつぎのステージを出さない', () => {
    renderPlay('cannon')
    act(() => engineMock.options!.onGoal())

    expect(screen.queryByRole('button', { name: 'つぎの ステージ' })).toBeNull()
    expect(screen.getByText('ぜんぶ クリア！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
  })

  it('「こっきを かえる」でこっき選択へ戻る', async () => {
    const user = userEvent.setup()
    renderPlay()
    act(() => engineMock.options!.onGoal())

    await user.click(screen.getByRole('button', { name: 'こっきを かえる' }))

    expect(navigateMock).toHaveBeenCalledWith('/games/flag-roll-maze', { replace: true })
  })

  it('穴に落ちたときは専用の復帰メッセージを知らせる', () => {
    vi.useFakeTimers()
    try {
      renderPlay()
      act(() => engineMock.options!.onRescue!('hole'))
      expect(screen.getByText('あなに おちた！ もどるよ')).toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.queryByText('あなに おちた！ もどるよ')).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })

  it('復帰理由が省略されてもスタートへ戻ったと知らせる', () => {
    vi.useFakeTimers()
    try {
      renderPlay()
      act(() => engineMock.options!.onRescue!())
      expect(screen.getByText('スタートに もどったよ')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('スタックからの復帰もスタートへ戻ったと知らせる', () => {
    renderPlay()
    act(() => engineMock.options!.onRescue!('stuck'))
    expect(screen.getByText('スタートに もどったよ')).toBeInTheDocument()
  })

  it('「もどる」でホームへ戻れる', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'もどる' }))

    expect(navigateMock).toHaveBeenCalledWith('/')
  })

  it('stateなしでplayを直接開くと選択画面へ戻る', () => {
    render(
      <MemoryRouter initialEntries={['/games/flag-roll-maze/play']}>
        <Routes>
          <Route path="/games/flag-roll-maze/play" element={<FlagRollMazePlay />} />
          <Route path="/games/flag-roll-maze" element={<FlagRollMazeSelect />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: 'こっきころころめいろ' })).toBeInTheDocument()
    expect(screen.getByText('こっきを 1こ えらんでね！')).toBeInTheDocument()
    expect(screen.queryByTestId('virtual-stick')).toBeNull()
  })

  it('stageIdが無い古いstateでは選択画面へ戻る', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/games/flag-roll-maze/play', state: { flagId: 'jp' } }]}>
        <Routes>
          <Route path="/games/flag-roll-maze/play" element={<FlagRollMazePlay />} />
          <Route path="/games/flag-roll-maze" element={<FlagRollMazeSelect />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('こっきを 1こ えらんでね！')).toBeInTheDocument()
    expect(screen.queryByTestId('virtual-stick')).toBeNull()
  })

  it('未知のstageIdでは選択画面へ戻る', () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/games/flag-roll-maze/play', state: { flagId: 'jp', stageId: 'unknown-stage' } }]}>
        <Routes>
          <Route path="/games/flag-roll-maze/play" element={<FlagRollMazePlay />} />
          <Route path="/games/flag-roll-maze" element={<FlagRollMazeSelect />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('こっきを 1こ えらんでね！')).toBeInTheDocument()
    expect(screen.queryByTestId('virtual-stick')).toBeNull()
  })
})

describe('カメラのズーム操作', () => {
  /** エンジンへ最後に渡された段。 */
  function lastZoomIndex() {
    const calls = engineMock.setZoomIndex.mock.calls
    return calls[calls.length - 1]?.[0]
  }

  it('開始時は標準のズームでエンジンへ伝える', () => {
    renderPlay()
    expect(lastZoomIndex()).toBe(DEFAULT_MAZE_ZOOM_INDEX)
  })

  it('＋で寄り、−で引く', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'もっと ちかづく' }))
    expect(lastZoomIndex()).toBe(DEFAULT_MAZE_ZOOM_INDEX + 1)

    await user.click(screen.getByRole('button', { name: 'もっと はなれる' }))
    await user.click(screen.getByRole('button', { name: 'もっと はなれる' }))
    expect(lastZoomIndex()).toBe(DEFAULT_MAZE_ZOOM_INDEX - 1)
  })

  it('端まで来たらそれ以上押せない', async () => {
    const user = userEvent.setup()
    renderPlay()
    const zoomIn = screen.getByRole('button', { name: 'もっと ちかづく' })
    const zoomOut = screen.getByRole('button', { name: 'もっと はなれる' })

    for (let step = 0; step < MAX_MAZE_ZOOM_INDEX - DEFAULT_MAZE_ZOOM_INDEX; step += 1) {
      await user.click(zoomIn)
    }
    expect(lastZoomIndex()).toBe(MAX_MAZE_ZOOM_INDEX)
    expect(zoomIn).toBeDisabled()

    for (let step = 0; step < MAX_MAZE_ZOOM_INDEX - MIN_MAZE_ZOOM_INDEX; step += 1) {
      await user.click(zoomOut)
    }
    expect(lastZoomIndex()).toBe(MIN_MAZE_ZOOM_INDEX)
    expect(zoomOut).toBeDisabled()
  })

  it('「スタートに もどる」でズームの好みは戻さない', async () => {
    const user = userEvent.setup()
    renderPlay()

    await user.click(screen.getByRole('button', { name: 'もっと ちかづく' }))
    await user.click(screen.getByRole('button', { name: 'スタートに もどる' }))

    // 詰まったときに押す救済操作なので、見え方の好みまで巻き戻さない。
    expect(engineMock.resetBallToStart).toHaveBeenCalled()
    expect(lastZoomIndex()).toBe(DEFAULT_MAZE_ZOOM_INDEX + 1)
  })
})
