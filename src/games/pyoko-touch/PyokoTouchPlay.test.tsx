import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import PyokoTouchPlay from './PyokoTouchPlay'
import { DIFFICULTY_SETTINGS, FRIENDS } from './pyokoGame'

// Math.randomを0に固定すると「最初の空き穴・最初のなかま・最短の表示時間」が選ばれるため、
// どの穴に何が出るかを決め打ちで検証できる（やさしいでは はち が出ない設定なのでなかま、
// はやいでは はち の割合が0より大きいので はち が出る）。
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** 最初の1ぴきが顔を出すまで進めるのに十分な時間[ms]。 */
const UNTIL_FIRST_POP_MS = 1_000

function renderPlay() {
  return render(
    <MemoryRouter>
      <PyokoTouchPlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function hole(container: HTMLElement, index: number) {
  const button = container.querySelector(`[data-hole-index="${index}"]`)
  if (!button) throw new Error(`data-hole-index="${index}" が見つかりません`)
  return button as HTMLButtonElement
}

function selectEasy() {
  fireEvent.click(screen.getByRole('button', { name: 'やさしい ゆっくり でてくる' }))
}

function selectFast() {
  fireEvent.click(screen.getByRole('button', { name: 'はやい はちも でてくる' }))
}

describe('PyokoTouchPlay', () => {
  test('初期表示: タイトル・もどる・むずかしさ選択が出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'ぴょこぴょこタッチ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やさしい ゆっくり でてくる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'はやい はちも でてくる' })).toBeInTheDocument()
  })

  test('むずかしさを選ぶと、9つの空いた穴と てん・のこり時間 が出る', () => {
    renderPlay()
    selectEasy()

    expect(screen.getAllByRole('button', { name: 'あな' })).toHaveLength(9)
    expect(screen.getByText('てん：0')).toBeInTheDocument()
    expect(screen.getByText(`のこり ${DIFFICULTY_SETTINGS.easy.durationMs / 1000}びょう`)).toBeInTheDocument()
  })

  test('少し待つと穴からなかまが顔を出し、名前がラベルになる', () => {
    const { container } = renderPlay()
    selectEasy()
    advance(UNTIL_FIRST_POP_MS)

    expect(hole(container, 0)).toHaveAttribute('aria-label', FRIENDS[0]!.name)
    expect(hole(container, 0).textContent).toBe(FRIENDS[0]!.emoji)
  })

  test('なかまをタッチすると1てん増え、つかまえた印が出る', () => {
    const { container } = renderPlay()
    selectEasy()
    advance(UNTIL_FIRST_POP_MS)

    fireEvent.click(hole(container, 0))

    expect(screen.getByText('てん：1')).toBeInTheDocument()
    expect(hole(container, 0).textContent).toBe('✨')
    expect(hole(container, 0)).toHaveAttribute('aria-label', 'あな')
  })

  test('のこり時間は進むほど減る', () => {
    renderPlay()
    selectEasy()
    advance(5_000)

    expect(screen.getByText('のこり 25びょう')).toBeInTheDocument()
  })

  test('空の穴をタッチしても点は変わらない', () => {
    const { container } = renderPlay()
    selectEasy()
    advance(UNTIL_FIRST_POP_MS)

    fireEvent.click(hole(container, 5))

    expect(screen.getByText('てん：0')).toBeInTheDocument()
  })

  test('はやいでは、はちにさわっても0てんより下がらず、びっくり印が出る', () => {
    const { container } = renderPlay()
    selectFast()
    advance(UNTIL_FIRST_POP_MS)
    expect(hole(container, 0)).toHaveAttribute('aria-label', 'はち')

    fireEvent.click(hole(container, 0))

    expect(screen.getByText('てん：0')).toBeInTheDocument()
    expect(hole(container, 0).textContent).toBe('💦')
  })

  test('じかんが来ると結果が出て、もういちど遊べる', () => {
    const { container } = renderPlay()
    selectEasy()
    advance(UNTIL_FIRST_POP_MS)
    fireEvent.click(hole(container, 0))
    advance(DIFFICULTY_SETTINGS.easy.durationMs)

    expect(screen.getByRole('status').textContent).toContain('1てん！')
    expect(screen.queryByRole('button', { name: 'あな' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(screen.getByText('てん：0')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'あな' })).toHaveLength(9)
  })

  test('結果から「むずかしさをかえる」で選択画面に戻れる', () => {
    renderPlay()
    selectEasy()
    advance(DIFFICULTY_SETTINGS.easy.durationMs)

    fireEvent.click(screen.getByRole('button', { name: 'むずかしさをかえる' }))

    expect(screen.getByRole('button', { name: 'やさしい ゆっくり でてくる' })).toBeInTheDocument()
  })

  test('プレイ中に「やめる」で選択画面に戻ると、進行が止まる', () => {
    renderPlay()
    selectEasy()
    advance(5_000)

    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))

    expect(screen.getByRole('button', { name: 'やさしい ゆっくり でてくる' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('画面を離れると進行タイマーが後片付けされる', () => {
    const { unmount } = renderPlay()
    selectEasy()
    advance(1_000)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  test('おとのON/OFF切り替えボタンが機能する', () => {
    renderPlay()
    const toggle = screen.getByRole('button', { name: 'おとを けす' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
  })
})
