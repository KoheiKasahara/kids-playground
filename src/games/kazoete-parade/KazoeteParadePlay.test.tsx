import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import KazoeteParadePlay from './KazoeteParadePlay'
import { PARADE_ANIMALS, SHOW_MS, createInitialState, createParade, judgeAtMs, roundCount } from './kazoeteParadeGame'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

/**
 * 乱数を 0 に すると、あいては おだいを みおとし ほかの どうぶつだけを かぞえる（まちがえる）。
 * 0.99 だと あいては いつも ぴったり。どちらも パレードの ならびは 決め打ちに なる。
 */
function fixRandom(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue(value)
}

function renderPlay() {
  return render(
    <MemoryRouter>
      <KazoeteParadePlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const easyButton = () => screen.getByRole('button', { name: /ゆっくり/ })
const clicker = () => screen.getByRole('button', { name: /^かぞえる/ })
const roster = () => screen.getByRole('list', { name: 'メダルの かず' })
const answerValue = () => screen.getByRole('status', { name: 'きみの こたえ' })

describe('KazoeteParadePlay', () => {
  test('はじめは ステージの上で むずかしさを えらぶ。えらぶまで かぞえられない', () => {
    fixRandom(0.5)
    renderPlay()
    expect(screen.getByRole('heading', { name: 'かぞえて！どうぶつパレード' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(easyButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /はやい/ })).toBeInTheDocument()
    expect(clicker()).toBeDisabled()
    expect(within(roster()).getAllByRole('listitem')).toHaveLength(4)
  })

  test('おだいを みて、パレードの あいだ かぞえ、なおして OK。こたえあわせで ぴったりなら 🏅', () => {
    fixRandom(0.99)
    const { container } = renderPlay()
    const parade = createInitialState('easy', Math.random).parade
    const target = PARADE_ANIMALS[parade.target]!

    fireEvent.click(easyButton())
    expect(screen.getByText('この こを かぞえてね')).toBeInTheDocument()
    expect(screen.getAllByText(target.name).length).toBeGreaterThan(0)
    expect(clicker()).toBeDisabled()

    advance(SHOW_MS + 100)
    expect(clicker()).toBeEnabled()
    advance(parade.marchers[0]!.startMs + 200)
    expect(container.querySelectorAll('[data-animal]').length).toBeGreaterThan(0)

    fireEvent.pointerDown(clicker())
    fireEvent.pointerDown(clicker())
    // キーボード（Enter・Space）の click でも かぞえられる。
    fireEvent.click(clicker(), { detail: 0 })
    expect(clicker()).toHaveAccessibleName('かぞえる いま 3')

    advance(parade.endMs)
    expect(screen.getByText(`${target.name}は なんびき いた？`)).toBeInTheDocument()
    expect(answerValue()).toHaveTextContent('3')
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: '1 へらす' }))
    expect(answerValue()).toHaveTextContent('0')
    expect(screen.getByRole('button', { name: '1 へらす' })).toBeDisabled()
    for (let i = 0; i < parade.targetCount; i++) fireEvent.click(screen.getByRole('button', { name: '1 ふやす' }))
    expect(answerValue()).toHaveTextContent(String(parade.targetCount))
    // あいての こたえは こたえあわせまで ひみつ。
    expect(within(roster()).getByLabelText('パンダ メダル 0こ')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'これで OK' }))
    expect(screen.getByRole('list', { name: 'こたえあわせ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /つぎへ/ })).not.toBeInTheDocument()

    advance(judgeAtMs(parade.targetCount) + 100)
    expect(screen.getByText(`ぴったり！ ${parade.targetCount}ひき`)).toBeInTheDocument()
    expect(within(roster()).getByLabelText(`きみ メダル 1こ、こたえ ${parade.targetCount}、ぴったり`)).toBeInTheDocument()
    expect(within(roster()).getByLabelText(`パンダ メダル 1こ、こたえ ${parade.targetCount}、ぴったり`)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /つぎへ/ }))
    expect(screen.getByText('この こを かぞえてね')).toBeInTheDocument()
    expect(screen.getByLabelText('2かいめ')).toBeInTheDocument()
    expect(clicker()).toHaveAccessibleName('かぞえる いま 0')
  })

  test('さいごまで ぴったりで あいてが まちがえると 1い。★を きろくし、ほぞんできないときは しらせる', () => {
    fixRandom(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    renderPlay()
    fireEvent.click(easyButton())

    const rounds = roundCount('easy')
    for (let round = 1; round <= rounds; round++) {
      // 乱数が 決め打ちなので、画面と おなじ パレードを つくって おだいの かずを しる。
      const parade = createParade('easy', round, Math.random)
      advance(SHOW_MS + 100)
      for (let i = 0; i < parade.targetCount; i++) fireEvent.pointerDown(clicker())
      advance(parade.endMs)
      fireEvent.click(screen.getByRole('button', { name: 'これで OK' }))
      advance(judgeAtMs(parade.targetCount) + 100)
      expect(screen.getByText(`ぴったり！ ${parade.targetCount}ひき`)).toBeInTheDocument()
      expect(within(roster()).getByLabelText(new RegExp(`^パンダ メダル 0こ、こたえ \\d+$`))).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: round < rounds ? /つぎへ/ : /けっかへ/ }))
    }

    expect(screen.getByRole('status')).toHaveTextContent('やったね！ 1い！')
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(screen.getByText('きろくを ほぞんできませんでした')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /えらびなおす/ }))
    expect(within(easyButton()).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test('いちども ぴったりに ならないと 4い。★は つかない。もういちど あそべる', () => {
    fixRandom(0.99)
    renderPlay()
    fireEvent.click(easyButton())
    const rounds = roundCount('easy')
    for (let round = 1; round <= rounds; round++) {
      const parade = createParade('easy', round, Math.random)
      advance(SHOW_MS + parade.endMs + 200)
      fireEvent.click(screen.getByRole('button', { name: 'これで OK' }))
      advance(judgeAtMs(parade.targetCount) + 100)
      expect(screen.getByText(`こたえは ${parade.targetCount}ひき`)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: round < rounds ? /つぎへ/ : /けっかへ/ }))
    }
    expect(screen.getByRole('status')).toHaveTextContent('4い')
    expect(screen.queryByRole('img', { name: /ほし/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /もういちど/ }))
    expect(screen.getByText('この こを かぞえてね')).toBeInTheDocument()
    expect(screen.getByLabelText('1かいめ')).toBeInTheDocument()
    expect(within(roster()).getByLabelText('きみ メダル 0こ')).toBeInTheDocument()
  })

  test('とちゅうで もどると えらぶ画面へ。タブを はなれている間は すすまない', () => {
    fixRandom(0.5)
    renderPlay()
    fireEvent.click(easyButton())
    advance(SHOW_MS - 1000)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    advance(60_000)
    expect(screen.getByText('この こを かぞえてね')).toBeInTheDocument()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(easyButton()).toBeInTheDocument()
    advance(10_000)
    expect(clicker()).toBeDisabled()
    expect(clicker()).toHaveAccessibleName('かぞえる いま 0')
  })
})

