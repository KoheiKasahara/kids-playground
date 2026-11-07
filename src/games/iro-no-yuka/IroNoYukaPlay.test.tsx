import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import IroNoYukaPlay from './IroNoYukaPlay'
import { COUNTDOWN_MS, DIFFICULTY_SETTINGS, YUKA_COLORS } from './iroNoYukaGame'

beforeEach(() => {
  vi.useFakeTimers()
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  localStorage.clear()
})

/** 乱数を 0.99 に すると、あいては まちがえずに 近い ゆかへ むかう。0 だと いつも まよって うごかない。 */
function fixRandom(value: number) {
  vi.spyOn(Math, 'random').mockReturnValue(value)
}

function renderPlay() {
  return render(
    <MemoryRouter>
      <IroNoYukaPlay />
    </MemoryRouter>,
  )
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms)
  })
}

const easyButton = () => screen.getByRole('button', { name: /ゆっくり/ })
const tiles = (container: HTMLElement) => [...container.querySelectorAll<HTMLButtonElement>('[data-tile]')]
const meRunner = (container: HTMLElement) => container.querySelector<HTMLElement>('[data-runner="me"]')!
const roster = () => screen.getByRole('list', { name: 'のこりの ハート' })

describe('IroNoYukaPlay', () => {
  test('はじめは フィールドの上で むずかしさを えらぶ。えらぶまで ゆかは おせない', () => {
    fixRandom(0.99)
    const { container } = renderPlay()
    expect(screen.getByRole('heading', { name: 'のこれ！いろのゆか' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(easyButton()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /はやい/ })).toBeInTheDocument()
    expect(tiles(container)).toHaveLength(25)
    expect(tiles(container).every((tile) => tile.disabled)).toBe(true)
  })

  test('3・2・1 の あと かんばんの いろの ゆかへ はしると、ハートが へらずに のこる', () => {
    fixRandom(0.99)
    const { container } = renderPlay()
    fireEvent.click(easyButton())
    expect(screen.getByText('3')).toBeInTheDocument()
    advance(COUNTDOWN_MS + 100)

    const sign = YUKA_COLORS.find((color) => screen.queryByText(color.name))!
    expect(sign).toBeDefined()
    const safeTiles = tiles(container).filter((tile) => tile.dataset.color === sign.id)
    expect(safeTiles.length).toBe(DIFFICULTY_SETTINGS.easy.safeStart)
    const before = meRunner(container).style.left + meRunner(container).style.top
    fireEvent.pointerDown(safeTiles.at(-1)!)
    advance(300)
    expect(meRunner(container).style.left + meRunner(container).style.top).not.toBe(before)

    advance(DIFFICULTY_SETTINGS.easy.callStartMs)
    expect(meRunner(container).dataset.status).toBe('safe')
    expect(within(roster()).getByLabelText('きみ ハート 3こ')).toBeInTheDocument()
  })

  test('うごかないと しずんで ハートが へり、なくなると けっか。もういちど あそべる', () => {
    fixRandom(0.99)
    const { container } = renderPlay()
    fireEvent.click(easyButton())
    advance(COUNTDOWN_MS + DIFFICULTY_SETTINGS.easy.callStartMs + 100)
    expect(meRunner(container).dataset.status).toBe('fell')
    expect(within(roster()).getByLabelText('きみ ハート 2こ')).toBeInTheDocument()

    advance(30_000)
    expect(screen.getByRole('status')).toHaveTextContent('4い')
    expect(within(roster()).getByLabelText('きみ おしまい')).toBeInTheDocument()
    expect(tiles(container).every((tile) => tile.disabled)).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /もういちど/ }))
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(within(roster()).getByLabelText('きみ ハート 3こ')).toBeInTheDocument()
  })

  test('やじるしキーでも となりの ゆかへ うごける', () => {
    fixRandom(0.99)
    const { container } = renderPlay()
    fireEvent.click(easyButton())
    advance(COUNTDOWN_MS + 100)
    const top = meRunner(container).style.top
    fireEvent.keyDown(tiles(container)[0]!, { key: 'ArrowUp' })
    advance(500)
    expect(parseFloat(meRunner(container).style.top)).toBeLessThan(parseFloat(top))
  })

  test('1いに なると ★を きろくし、ほぞんできないときは しらせる', () => {
    // 乱数 0 では あいても うごかず、3ラウンドめに みんな いっしょに しずむので 1い（どうてん）。
    fixRandom(0)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    renderPlay()
    fireEvent.click(easyButton())
    advance(30_000)
    expect(screen.getByRole('status')).toHaveTextContent('1い')
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(screen.getByText('きろくを ほぞんできませんでした')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /えらびなおす/ }))
    expect(within(easyButton()).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test('とちゅうで もどると えらぶ画面へ。タブを はなれている間は すすまない', () => {
    fixRandom(0.99)
    renderPlay()
    fireEvent.click(easyButton())
    advance(COUNTDOWN_MS - 1000)
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    advance(60_000)
    expect(screen.getByText('2')).toBeInTheDocument()
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
    act(() => document.dispatchEvent(new Event('visibilitychange')))

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(easyButton()).toBeInTheDocument()
    advance(10_000)
    expect(within(roster()).getByLabelText('きみ ハート 3こ')).toBeInTheDocument()
  })
})
