import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ShabonPachinPlay from './ShabonPachinPlay'
import { COLOR_KINDS, GOAL_COUNT } from './shabonGame'

// Math.randomを0に固定すると、おだいは さいしょの いろ（あか）、出る しゃぼんだまは
// いつも おだい になるため、どれを タッチすれば われるかを決め打ちで検証できる。
beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderPlay() {
  return render(
    <MemoryRouter>
      <ShabonPachinPlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function selectColor() {
  fireEvent.click(screen.getByRole('button', { name: 'いろ おなじ いろを わろう' }))
}

const RED = COLOR_KINDS[0]!

describe('ShabonPachinPlay', () => {
  test('初期表示: タイトル・もどる・あそびかた選択が出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'しゃぼんだま パチン' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'いろ おなじ いろを わろう' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'かたち おなじ かたちを わろう' })).toBeInTheDocument()
  })

  test('あそびかたを選ぶと おだいが出て、しゃぼんだまが のぼってくる', () => {
    renderPlay()
    selectColor()
    expect(screen.getByText(RED.name)).toBeInTheDocument()
    expect(screen.getByLabelText(`0こ わった（ぜんぶで ${GOAL_COUNT}こ）`)).toBeInTheDocument()

    advance(500)

    expect(screen.getAllByRole('button', { name: `${RED.name}の しゃぼんだま` }).length).toBeGreaterThan(0)
  })

  test('おだいの しゃぼんだまを タッチすると われて1こ ふえる', () => {
    renderPlay()
    selectColor()
    advance(500)

    fireEvent.pointerDown(screen.getAllByRole('button', { name: `${RED.name}の しゃぼんだま` })[0]!)

    expect(screen.getByLabelText(`1こ わった（ぜんぶで ${GOAL_COUNT}こ）`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'われた' })).toBeDisabled()
  })

  test(`${GOAL_COUNT}こ わると クリアになり、もういちど あそべる`, () => {
    const { container } = renderPlay()
    selectColor()
    for (let i = 0; i < GOAL_COUNT; i += 1) {
      advance(1_200)
      // とちゅうで おだいが かわるので、そのときの おだいを画面から読んで わる。
      const targetName = container.querySelector('strong')!.textContent
      fireEvent.pointerDown(screen.getAllByRole('button', { name: `${targetName}の しゃぼんだま` })[0]!)
    }

    expect(screen.getByRole('status').textContent).toContain('ぜんぶ われたね')
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'あそびかたを かえる' }))
    expect(screen.getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()

    selectColor()
    expect(screen.getByLabelText(`0こ わった（ぜんぶで ${GOAL_COUNT}こ）`)).toBeInTheDocument()
  })

  test('プレイ中に「やめる」で選択画面に戻ると、進行が止まる', () => {
    renderPlay()
    selectColor()
    advance(1_000)

    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))

    expect(screen.getByRole('button', { name: 'いろ おなじ いろを わろう' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('画面を離れると進行タイマーが後片付けされる', () => {
    const { unmount } = renderPlay()
    selectColor()
    advance(1_000)
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })

  test('おとのON/OFF切り替えボタンが機能する', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
  })
})
