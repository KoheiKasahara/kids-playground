import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import OnajiPonPlay from './OnajiPonPlay'
import { dealStage, type AnimalId, type Card, type ColorId, type GameState } from './onajiPonGame'

vi.mock('./onajiPonGame', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./onajiPonGame')>()
  return { ...actual, dealStage: vi.fn(actual.dealStage) }
})

let nextId = 0
function card(color: ColorId, animal: AnimalId): Card {
  nextId += 1
  return { id: `${color}-${animal}-t${nextId}`, color, animal }
}

/**
 * はじめて（3れつ×3まい）。ぜんぶ あかなので どの じゅんでも つながる。
 * いちばん したの カードは 2・5・8ばん。
 */
function easyDeal(): GameState {
  const animals: AnimalId[] = ['dog', 'cat', 'rabbit']
  return {
    stageId: 'hajimete',
    tableau: Array.from({ length: 9 }, (_, index) => card('red', animals[index % 3]!)),
    pile: [card('red', 'bear')],
    stock: [card('blue', 'dog'), card('yellow', 'cat'), card('blue', 'cat'), card('yellow', 'rabbit')],
    combo: 0,
    bestCombo: 0,
    par: 4,
  }
}

/** あおい ねこ ばかりで、やまを めくっても つながらない（おしまいに なる）。 */
function stuckDeal(): GameState {
  return {
    stageId: 'hajimete',
    tableau: Array.from({ length: 9 }, () => card('blue', 'cat')),
    pile: [card('red', 'dog')],
    stock: [card('yellow', 'rabbit')],
    combo: 0,
    bestCombo: 0,
    par: 0,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.mocked(dealStage).mockClear()
})

function renderPlay() {
  return render(
    <MemoryRouter>
      <OnajiPonPlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

function startHajimete(deal?: GameState) {
  if (deal) vi.mocked(dealStage).mockReturnValueOnce(deal)
  fireEvent.click(screen.getByRole('button', { name: 'はじめて 3いろ・3どうぶつ' }))
}

function slot(index: number): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-slot="${index}"]`)!
}

describe('OnajiPonPlay', () => {
  test('初期表示: タイトル・もどる・ルールの え・3つの ステージが出る', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'おなじで ポン！' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /おなじ いろ か おなじ どうぶつ なら つながる/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'はじめて 3いろ・3どうぶつ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ならんで 4いろ・4どうぶつ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'おやま さんかくの やま' })).toBeInTheDocument()
  })

  test('ステージを えらぶと ランダムに くばった カードが ならぶ', () => {
    renderPlay()
    startHajimete()
    expect(dealStage).toHaveBeenCalledWith('hajimete', Math.random)
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(9)
    expect(screen.getByRole('img', { name: /^まんなかの カード / })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 4まい）' })).toBeInTheDocument()
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('おなじ いろかおなじ どうぶつを タッチ！')
  })

  test('つながる カードを タッチすると まんなかに のり、うえの カードが とれるように なる', () => {
    renderPlay()
    startHajimete(easyDeal())
    expect(slot(1)).toHaveAttribute('aria-disabled', 'true')
    expect(slot(1)).toHaveAccessibleName('あかい ねこ（したに ある）')

    fireEvent.click(slot(2))

    expect(slot(2)).toBeNull()
    expect(screen.getByRole('img', { name: 'まんなかの カード あかい うさぎ' })).toBeInTheDocument()
    expect(slot(1)).toHaveAttribute('aria-disabled', 'false')
    expect(document.querySelector('[aria-live="polite"]')).toHaveTextContent('のこり 8 まい')
    expect(screen.getByText('ぴょん！')).toBeInTheDocument()
  })

  test('つながらない カード・したに ある カードは うごかず、ぷるぷる ゆれる', () => {
    renderPlay()
    startHajimete(stuckDeal())

    fireEvent.click(slot(2))
    expect(slot(2)).toBeInTheDocument()
    expect(slot(2).className).toMatch(/nope/)

    fireEvent.click(slot(0))
    expect(slot(0)).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'まんなかの カード あかい いぬ' })).toBeInTheDocument()

    advance(500)
    expect(slot(0).className).not.toMatch(/nope/)
  })

  test('つづけて つなぐと れんさが ふえ、やまを めくると まんなかが かわる', () => {
    renderPlay()
    startHajimete(easyDeal())
    fireEvent.click(slot(2))
    fireEvent.click(slot(1))
    expect(screen.getByText('れんさ！')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'やまから めくる（のこり 4まい）' }))
    expect(screen.getByRole('img', { name: 'まんなかの カード あおい いぬ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 3まい）' })).toBeInTheDocument()
    expect(screen.queryByText('れんさ！')).toBeNull()
  })

  test('ぜんぶ つなぐと クリアに なり、★が きろくされ、つぎの カードで また あそべる', () => {
    renderPlay()
    startHajimete(easyDeal())
    for (const index of [2, 1, 0, 5, 4, 3, 8, 7, 6]) fireEvent.click(slot(index))
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(0)
    // けっかが でるまでに やまを さわっても めくれない（★が かわらない）。
    fireEvent.click(screen.getByRole('button', { name: 'やまから めくる（のこり 4まい）' }))
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 4まい）' })).toBeInTheDocument()

    advance(800)

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('パーフェクト！')
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(screen.getByText('いちばん うまい とりかた！')).toBeInTheDocument()
    // いちばん うまい とりかたなら「おなじ カードで」は ださない。
    expect(screen.queryByRole('button', { name: 'おなじ カードで もういちど' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'つぎの カード' }))
    expect(dealStage).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('status')).toBeNull()
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(9)

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    const hajimete = screen.getByRole('button', { name: 'はじめて 3いろ・3どうぶつ' })
    expect(within(hajimete).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test('やまを つかいすぎて クリアすると ★が へり、おなじ カードで やりなおせる', () => {
    renderPlay()
    startHajimete(easyDeal())
    const stock = () => screen.getByRole('button', { name: /^やまから めくる/ })
    fireEvent.click(slot(2))
    expect(screen.getByRole('img', { name: 'いま クリアすると ほし 3こ' })).toBeInTheDocument()
    fireEvent.click(stock())
    fireEvent.click(stock())
    expect(screen.getByRole('img', { name: 'いま クリアすると ほし 2こ' })).toBeInTheDocument()
    fireEvent.click(stock())
    // さいごの きいろい うさぎ まで めくると、あかい うさぎ（5ばん）から また つなげられる。
    fireEvent.click(stock())
    expect(screen.getByRole('button', { name: 'やまは もう ない' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'いま クリアすると ほし 1こ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'やまは もう ない' }))
    expect(screen.getByRole('button', { name: 'やまは もう ない' }).className).toMatch(/nope/)
    for (const index of [5, 1, 0, 4, 3, 8, 7, 6]) fireEvent.click(slot(index))

    advance(800)

    expect(screen.getByRole('status')).toHaveTextContent('できた！')
    expect(screen.getByRole('img', { name: 'ほし 1こ' })).toBeInTheDocument()
    expect(screen.getByText('4まい のこせる とりかたも あるよ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'おなじ カードで もういちど' }))
    expect(dealStage).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 4まい）' })).toBeInTheDocument()
    expect(document.querySelectorAll('[data-slot]')).toHaveLength(9)
  })

  test('つなげなく なると「おしい！」に なり、おなじ カードで もういちど あそべる', () => {
    renderPlay()
    startHajimete(stuckDeal())
    fireEvent.click(screen.getByRole('button', { name: 'やまから めくる（のこり 1まい）' }))
    expect(screen.queryByRole('status')).toBeNull()

    advance(1300)

    expect(screen.getByRole('status')).toHaveTextContent('おしい！ あと 9まい')
    fireEvent.click(screen.getByRole('button', { name: 'おなじ カードで もういちど' }))
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 1まい）' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'まんなかの カード あかい いぬ' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'やまから めくる（のこり 1まい）' }))
    advance(1300)
    fireEvent.click(screen.getByRole('button', { name: 'あたらしく くばる' }))
    expect(dealStage).toHaveBeenCalledTimes(2)
  })

  test('しばらく さわらないと、つなげられる カードを おしえる', () => {
    renderPlay()
    startHajimete(easyDeal())
    advance(6_000)
    expect(document.querySelector('[class*="hint"]')).toBeNull()
    advance(1_500)
    expect(slot(2).className).toMatch(/hint/)

    fireEvent.click(slot(2))
    expect(document.querySelector('[class*="hint"]')).toBeNull()
  })

  test('つなげる カードが ないときは、すぐに やまを ひからせる', () => {
    renderPlay()
    startHajimete(stuckDeal())
    advance(1_700)
    expect(screen.getByRole('button', { name: 'やまから めくる（のこり 1まい）' }).className).toMatch(/hint/)
  })

  test('プレイ中の「もどる」で ステージえらびに もどり、タイマーも のこらない', () => {
    renderPlay()
    startHajimete(stuckDeal())
    fireEvent.click(slot(2))
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))

    expect(screen.getByRole('button', { name: 'はじめて 3いろ・3どうぶつ' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('とちゅうで がめんを はなれると タイマーが あとかたづけ される', () => {
    const { unmount } = renderPlay()
    startHajimete(easyDeal())
    for (const index of [2, 1, 0, 5, 4, 3, 8, 7, 6]) fireEvent.click(slot(index))
    expect(vi.getTimerCount()).toBeGreaterThan(0)

    unmount()

    // React が あとかたづけの ために つむ 0ms の しごとだけ すすめる（ゲームの タイマーは のこらない）。
    advance(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  test('おとの ON/OFF を きりかえられる', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(screen.getByRole('button', { name: 'おとを だす' })).toBeInTheDocument()
  })
})
