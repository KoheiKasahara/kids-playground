import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import KaitenSushiPlay from './KaitenSushiPlay'
import { playSushiSound } from './sounds'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'

vi.mock('./sounds', () => ({ playSushiSound: vi.fn() }))

const KEY = 'kaiten-sushi-v1'
let frame: FrameRequestCallback | null
let time = 0
const store = new Map<string, string>()

beforeEach(() => {
  time = 0
  frame = null
  store.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  // おきゃくさんの ねがいごとの じゅんばんを まいかい おなじに する。
  vi.spyOn(Date, 'now').mockReturnValue(20261017)
  // jsdom は canvas を かけないので、え は かかずに うごきと もじ だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** レーンの じかんを すすめる（1こま 0.1びょう）。とちゅうで でた メッセージを かえす。 */
function advance(seconds: number): string[] {
  const lines: string[] = []
  for (let i = 0; i < seconds * 10; i++) {
    act(() => {
      time += 100
      frame?.(time)
    })
    const line = screen.queryByRole('status')?.textContent
    if (line && lines.at(-1) !== line) lines.push(line)
  }
  return lines
}

function saved() {
  return JSON.parse(store.get(KEY) ?? 'null')
}

function renderGame() {
  return render(<MemoryRouter><KaitenSushiPlay /></MemoryRouter>)
}

describe('にぎにぎ かいてんずし', () => {
  test('くみあわせを えらんで つくり、レーンに ながすと たいしょうが のせる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'にぎにぎ かいてんずし' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /おすしを つくる/ }))

    fireEvent.click(screen.getByRole('button', { name: 'ぐんかん' }))
    fireEvent.click(screen.getByRole('tab', { name: /シャリ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ごまシャリ' }))
    fireEvent.click(screen.getByRole('tab', { name: /ネタ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'うに' }))
    fireEvent.click(screen.getByRole('tab', { name: /のせる/ }))
    for (const name of ['わさび', 'ねぎ', 'マヨ', 'きんぱく']) fireEvent.click(screen.getByRole('button', { name }))
    // 4つめを えらぶと いちばん ふるい わさびが はずれる。
    expect(screen.getByRole('button', { name: 'わさび' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'きんぱく' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /つぎ: おさら/ }))
    fireEvent.click(screen.getByRole('button', { name: 'きん' }))
    expect(screen.getByText('きらきら うにの ぐんかん')).toBeInTheDocument()
    expect(screen.getByText('ごまシャリ・ねぎ・マヨ・きんぱく・きんの おさら')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /できあがり/ }))
    const dialog = screen.getByRole('dialog', { name: 'きらきら うにの ぐんかん' })
    expect(within(dialog).getByText('へい おまち！')).toBeInTheDocument()
    expect(playSushiSound).toHaveBeenCalledWith('make')
    fireEvent.click(within(dialog).getByRole('button', { name: /レーンに ながす/ }))

    advance(1)
    expect(screen.getByRole('status')).toHaveTextContent('きらきら うにの ぐんかんが ながれてきたよ！')
    expect(screen.getByRole('button', { name: 'きらきら うにの ぐんかんを みる' })).toBeInTheDocument()
    expect(saved().lane.at(-1)).toEqual({ style: 'gunkan', rice: 'goma', neta: 'uni', toppings: ['negi', 'mayo', 'kinpaku'], plate: 'kin' })

    // ながれている おすしを おおきく みる。
    fireEvent.click(screen.getByRole('button', { name: 'きらきら うにの ぐんかんを みる' }))
    expect(screen.getByRole('dialog', { name: 'きらきら うにの ぐんかん' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'とじる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('ちゅうもんを えらんで しんかんせんで とどけると、たべて おさらが ふえる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /おすしを つくる/ }))
    advance(12)
    const order = screen.getAllByRole('button', { name: /の ちゅうもん/ })[0]
    const [who, neta] = order.getAttribute('aria-label')!.split('の ちゅうもん ')
    fireEvent.click(order)
    expect(order).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /できあがり/ }))
    fireEvent.click(screen.getByRole('button', { name: `しんかんせんで ${who}へ` }))
    expect(screen.getByRole('status')).toHaveTextContent(`しんかんせんが ${who}へ むかうよ！`)

    const lines = advance(8)
    expect(playSushiSound).toHaveBeenCalledWith('train')
    expect(lines).toContain(`${who}が ${neta}の にぎりを とったよ！`)
    expect(lines).toContain(`${who}「おいしい！」`)
    expect(saved().eaten).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('img', { name: /たべた おさら [1-9]/ })).toBeInTheDocument()
  })

  test('ガチャけんで まわすと たからものが でて、ずかんに のこる', () => {
    store.set(KEY, JSON.stringify({ lane: [], eaten: 5, tickets: 1, prizes: [] }))
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /レーンを みる/ }))
    fireEvent.click(screen.getByRole('button', { name: /ガチャ ×1/ }))
    fireEvent.click(screen.getByRole('button', { name: /まわす/ }))
    act(() => { vi.advanceTimersByTime(2000) })
    const dialog = screen.getByRole('dialog', { name: /が でた！/ })
    expect(within(dialog).getByText('あたらしい たからもの！')).toBeInTheDocument()
    expect(saved().prizes).toHaveLength(1)
    expect(saved().tickets).toBe(0)
    fireEvent.click(within(dialog).getByRole('button', { name: 'やったね！' }))
    expect(screen.queryByRole('button', { name: /ガチャ ×/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    fireEvent.click(screen.getByRole('button', { name: /たからもの 1\/12/ }))
    expect(screen.getByRole('dialog', { name: 'たからもの 1/12' })).toBeInTheDocument()
  })

  test('もどるで ひとつ まえの がめんへ。こわれた ほぞんでも はじめから あそべる', () => {
    store.set(KEY, '{broken')
    renderGame()
    expect(screen.getByRole('button', { name: /たからもの 0\/12/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /おすしを つくる/ }))
    fireEvent.click(screen.getByRole('button', { name: /できあがり/ }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /かたち/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /レーンを みる/ })).toBeInTheDocument()
  })

  test('レーンの はやさを かえられる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /レーンを みる/ }))
    const group = screen.getByRole('group', { name: 'レーンの はやさ' })
    expect(within(group).getByRole('button', { name: 'ふつう' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(group).getByRole('button', { name: 'はやい' }))
    expect(within(group).getByRole('button', { name: 'はやい' })).toHaveAttribute('aria-pressed', 'true')
    // はじめての ときは おみせの おすしが ながれている。
    expect(screen.getAllByRole('button', { name: /を みる$/ }).length).toBeGreaterThan(0)
  })

  test('ホームから遅延ルートへ入り、つくる→タイトル→ホームへ一階層ずつ戻る', async () => {
    resetGameShelfCache()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    const shelf = screen.getByRole('region', { name: /ぜんぶの ゲーム/ })
    expect(within(shelf).getByRole('link', { name: 'にぎにぎ かいてんずし' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'にぎにぎ かいてんずし' }))
    expect(await screen.findByRole('heading', { name: 'にぎにぎ かいてんずし' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /おすしを つくる/ }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /かたち/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /レーンを みる/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
