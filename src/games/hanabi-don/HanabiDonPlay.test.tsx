import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import HanabiDonPlay from './HanabiDonPlay'
import { FINALE_MS, FLIGHT_MS, STAGES } from './hanabiGame'
import * as sounds from './sounds'

const EASY = STAGES[0]!

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderPlay() {
  return render(
    <MemoryRouter>
      <HanabiDonPlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function selectEasy() {
  fireEvent.click(screen.getByRole('button', { name: `${EASY.name} ${EASY.hint}` }))
}

/** まだ ともっていない ほしを キーボード操作と同じ click で ひとつ ねらい、ひらくまで まつ。 */
function lightOneStar() {
  fireEvent.click(screen.getAllByRole('button', { name: 'ほし' })[0]!)
  advance(FLIGHT_MS + 50)
}

function clearStage() {
  let guard = 0
  while (screen.queryAllByRole('button', { name: 'ほし' }).length > 0 && guard < 50) {
    guard += 1
    lightOneStar()
  }
}

describe('HanabiDonPlay', () => {
  test('初期表示: タイトル・もどる・よぞら選択が出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'どーん！はなび' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    for (const stage of STAGES) {
      expect(screen.getByRole('button', { name: `${stage.name} ${stage.hint}` })).toBeInTheDocument()
    }
  })

  test('よぞらを選ぶと ほしが ならび、BGMが はじまる', () => {
    const stop = vi.fn()
    const bgm = vi.spyOn(sounds, 'startBgm').mockReturnValue(stop)
    renderPlay()
    selectEasy()
    expect(screen.getAllByRole('button', { name: 'ほし' })).toHaveLength(EASY.starCount)
    expect(screen.getByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).toBeInTheDocument()
    expect(bgm).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(stop).toHaveBeenCalledTimes(1)
  })

  test('ほしを ねらうと はなびが あがり、ひらくと あかりが つく', () => {
    const launchSound = vi.spyOn(sounds, 'playLaunch')
    const burstSound = vi.spyOn(sounds, 'playBurst')
    const litSound = vi.spyOn(sounds, 'playStarLit')
    renderPlay()
    selectEasy()

    fireEvent.click(screen.getAllByRole('button', { name: 'ほし' })[0]!)
    expect(launchSound).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('はなび 1ぱつ')).toBeInTheDocument()
    expect(burstSound).not.toHaveBeenCalled()

    advance(FLIGHT_MS + 50)
    expect(burstSound).toHaveBeenCalledTimes(1)
    expect(litSound).toHaveBeenCalledTimes(1)
    expect(screen.queryByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'あかりが ついた ほし' }).length).toBeGreaterThan(0)
  })

  test('よぞらの タッチした ところへ はなびが あがる', () => {
    const { container } = renderPlay()
    selectEasy()
    const sky = container.querySelector('[data-stage]') as HTMLElement
    vi.spyOn(sky, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 300, height: 400, right: 300, bottom: 400, x: 0, y: 0, toJSON: () => ({}) })

    fireEvent.pointerDown(sky, { clientX: 150, clientY: 390 })

    expect(screen.getByLabelText('はなび 1ぱつ')).toBeInTheDocument()
    advance(FLIGHT_MS + 50)
    // ほしの いない したの ほうなので、あかりは つかない。
    expect(screen.getByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).toBeInTheDocument()
  })

  test('ぜんぶ ともすと クリアになり、★が のこって もういちど あそべる', () => {
    const clearSound = vi.spyOn(sounds, 'playClear')
    renderPlay()
    selectEasy()
    clearStage()
    expect(screen.getByRole('status').textContent).toContain('ぜんぶ ともった')
    expect(clearSound).not.toHaveBeenCalled()

    advance(FINALE_MS + 100)
    expect(screen.getByRole('status').textContent).toContain('ぜんぶ ともせたね')
    expect(clearSound).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)

    fireEvent.click(screen.getByRole('button', { name: 'よぞらを かえる' }))
    expect(screen.getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()

    selectEasy()
    expect(screen.getByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).toBeInTheDocument()
  })

  test('中断中は進まず、復帰で再開する', () => {
    renderPlay()
    selectEasy()
    fireEvent.click(screen.getAllByRole('button', { name: 'ほし' })[0]!)
    act(() => window.dispatchEvent(new Event('blur')))
    advance(10_000)
    expect(screen.getByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).toBeInTheDocument()
    act(() => window.dispatchEvent(new Event('focus')))
    advance(FLIGHT_MS + 50)
    expect(screen.queryByLabelText(`0こ ともした（ぜんぶで ${EASY.starCount}こ）`)).not.toBeInTheDocument()
  })

  test('「やめる」や退出で 進行タイマーが後片付けされる', () => {
    const { unmount } = renderPlay()
    selectEasy()
    advance(500)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(vi.getTimerCount()).toBe(0)

    selectEasy()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('おとボタンで ON/OFF でき、画面を離れると ON に戻る', () => {
    const { unmount } = renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
    expect(isSoundEnabled()).toBe(false)
    unmount()
    expect(isSoundEnabled()).toBe(true)
  })
})
