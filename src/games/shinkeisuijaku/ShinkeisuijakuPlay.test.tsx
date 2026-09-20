import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ShinkeisuijakuPlay from './ShinkeisuijakuPlay'
import type { ShinkeisuijakuDifficulty } from './cardDeck'
import type { ShinkeisuijakuTheme } from './cardFaces'

// 山札の並びをテストごとに固定し、どのカードがペアかをid順から確実に判定できるようにする
// （シャッフルの結果に依存すると、一致/不一致のテストが不安定になる）。
vi.mock('./cardDeck', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./cardDeck')>()
  const { THEMES } = await import('./cardFaces')
  return {
    ...actual,
    createShuffledDeck: (theme: ShinkeisuijakuTheme, difficulty: ShinkeisuijakuDifficulty) => {
      const pairCount = actual.DIFFICULTY_PAIR_COUNT[difficulty]
      return THEMES[theme].faces.slice(0, pairCount).flatMap((face, pairIndex) => [
        { id: `card-${pairIndex * 2}`, face, status: 'hidden' as const },
        { id: `card-${pairIndex * 2 + 1}`, face, status: 'hidden' as const },
      ])
    },
  }
})

/** 判定確定(一致/不一致)を待つのに十分な時間[ms]。 */
const AFTER_RESOLVE_MS = 1200

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

function renderPlay() {
  return render(
    <MemoryRouter>
      <ShinkeisuijakuPlay />
    </MemoryRouter>,
  )
}

function cardButton(container: HTMLElement, id: string) {
  const button = container.querySelector(`[data-card-id="${id}"]`)
  if (!button) throw new Error(`data-card-id="${id}" が見つかりません`)
  return button as HTMLButtonElement
}

function selectEasy() {
  fireEvent.click(screen.getByRole('button', { name: 'かんたん 6ペア' }))
}

function selectTheme(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

describe('ShinkeisuijakuPlay', () => {
  test('初期表示: タイトル・もどる・えがら選択・むずかしさ選択が出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'しんけいすいじゃく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    for (const name of ['どうぶつ', 'はたらくくるま', 'すうじ', 'こっき']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: 'かんたん 6ペア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'むずかしい 8ペア' })).toBeInTheDocument()
  })

  test('はじめは「どうぶつ」がえらばれている', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: 'どうぶつ' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'こっき' })).toHaveAttribute('aria-pressed', 'false')
  })

  test('かんたんを選ぶと12枚(6ペア)のカードが裏向きで並ぶ', () => {
    renderPlay()
    selectEasy()

    expect(screen.getAllByRole('button', { name: 'カード' })).toHaveLength(12)
    expect(screen.getByText('みつけた ペア：0 / 6')).toBeInTheDocument()
  })

  test('1枚めくると絵柄と名前が見える', () => {
    const { container } = renderPlay()
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    const revealed = cardButton(container, 'card-0')
    expect(revealed).toHaveAttribute('aria-pressed', 'true')
    expect(revealed.getAttribute('aria-label')).not.toBe('カード')
  })

  test('えがらに「こっき」をえらぶと、めくったカードに国旗の画像が出る', () => {
    const { container } = renderPlay()
    selectTheme('こっき')
    expect(screen.getByRole('button', { name: 'こっき' })).toHaveAttribute('aria-pressed', 'true')
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    const revealed = cardButton(container, 'card-0')
    expect(revealed).toHaveAttribute('aria-label', 'にほん')
    expect(revealed.querySelector('img')?.getAttribute('src')).toContain('flags/jp.svg')
  })

  test('えがらに「すうじ」をえらぶと、めくったカードにすうじが出る', () => {
    const { container } = renderPlay()
    selectTheme('すうじ')
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    const revealed = cardButton(container, 'card-0')
    expect(revealed).toHaveAttribute('aria-label', 'いち')
    expect(revealed).toHaveTextContent('1')
  })

  test('えがらをかえても、一致・不一致の判定は同じように動く', () => {
    const { container } = renderPlay()
    selectTheme('はたらくくるま')
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    fireEvent.click(cardButton(container, 'card-1'))
    act(() => {
      vi.advanceTimersByTime(AFTER_RESOLVE_MS)
    })
    expect(screen.getByText('みつけた ペア：1 / 6')).toBeInTheDocument()

    fireEvent.click(cardButton(container, 'card-2'))
    fireEvent.click(cardButton(container, 'card-4'))
    act(() => {
      vi.advanceTimersByTime(AFTER_RESOLVE_MS)
    })
    expect(cardButton(container, 'card-2')).toHaveAttribute('aria-label', 'カード')
    expect(screen.getByText('みつけた ペア：1 / 6')).toBeInTheDocument()
  })

  test('一致する2枚をめくると、少し待ってから揃ってdisabledになる', () => {
    const { container } = renderPlay()
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    fireEvent.click(cardButton(container, 'card-1'))

    // 判定確定前は、3枚目をめくろうとしても弾かれる（ロック中）。
    fireEvent.click(cardButton(container, 'card-2'))
    expect(cardButton(container, 'card-2')).toHaveAttribute('aria-pressed', 'false')

    act(() => {
      vi.advanceTimersByTime(AFTER_RESOLVE_MS)
    })

    expect(cardButton(container, 'card-0')).toBeDisabled()
    expect(cardButton(container, 'card-1')).toBeDisabled()
    expect(screen.getByText('みつけた ペア：1 / 6')).toBeInTheDocument()
  })

  test('一致しない2枚をめくると、少し待ってから裏に戻る', () => {
    const { container } = renderPlay()
    selectEasy()

    fireEvent.click(cardButton(container, 'card-0'))
    fireEvent.click(cardButton(container, 'card-2'))

    act(() => {
      vi.advanceTimersByTime(AFTER_RESOLVE_MS)
    })

    expect(cardButton(container, 'card-0')).toHaveAttribute('aria-pressed', 'false')
    expect(cardButton(container, 'card-0')).toHaveAttribute('aria-label', 'カード')
    expect(cardButton(container, 'card-2')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('みつけた ペア：0 / 6')).toBeInTheDocument()
  })

  test('全ペアを揃えると完成表示と「もういちど」が出る', () => {
    const { container } = renderPlay()
    selectEasy()

    for (let pairIndex = 0; pairIndex < 6; pairIndex += 1) {
      fireEvent.click(cardButton(container, `card-${pairIndex * 2}`))
      fireEvent.click(cardButton(container, `card-${pairIndex * 2 + 1}`))
      act(() => {
        vi.advanceTimersByTime(AFTER_RESOLVE_MS)
      })
    }

    expect(screen.getByText('ぜんぶ そろったよ！ 6 / 6 ペア')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もういちど' })).toBeInTheDocument()
  })

  test('「えらびなおす」で選択画面に戻り、えらんだえがらは残る', () => {
    renderPlay()
    selectTheme('こっき')
    selectEasy()
    fireEvent.click(screen.getByRole('button', { name: 'えらびなおす' }))

    expect(screen.getByRole('button', { name: 'かんたん 6ペア' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'こっき' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryAllByRole('button', { name: 'カード' })).toHaveLength(0)
  })

  test('おとのON/OFF切り替えボタンが機能する', () => {
    renderPlay()
    const toggle = screen.getByRole('button', { name: 'おとを けす' })
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
  })
})
