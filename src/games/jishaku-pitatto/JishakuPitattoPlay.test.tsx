import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import JishakuPitattoPlay from './JishakuPitattoPlay'
import { playClear, playStick, startBgm } from './sounds'
import { STAGES } from './stages'
import { autoPilot, type World } from './world'

vi.mock('./sounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...Object.fromEntries(Object.keys(actual).map((key) => [key, vi.fn()])), startBgm: vi.fn(() => () => {}) }
})

let frame: FrameRequestCallback | null
let time: number
const store = new Map<string, string>()

beforeEach(() => {
  time = 0
  frame = null
  store.clear()
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(n: number, each?: (w: World) => void) {
  act(() => {
    for (let i = 0; i < n; i++) {
      each?.(world())
      time += 1000 / 60
      frame?.(time)
    }
  })
}

const world = () => (window as unknown as { __jishakuWorld: World }).__jishakuWorld

function openStage(n: number) {
  render(<MemoryRouter><JishakuPitattoPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^ステージ${n}`) }))
  advance(2)
}

describe('ぴたっと じしゃく', () => {
  test('タイトルから ステージを えらんで あそび、もどれる', () => {
    render(<MemoryRouter><JishakuPitattoPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ぴたっと じしゃく' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^ステージ\d/ })).toHaveLength(STAGES.length)
    fireEvent.click(screen.getByRole('button', { name: /ステージ1 つくえの うえ/ }))
    expect(screen.getByLabelText(/つくえの うえ。ゆびで じしゃくを うごかして/)).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('desk')
    advance(3)
    expect(screen.getByLabelText('クリップ 0 / 2')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'ほしバッジ 0 / 3' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'チャレンジ てつを 3だん つなげよう 0 / 3' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ぴたっと じしゃく' })).toBeInTheDocument()
  })

  test('ゆびで さわった ところの すこし うえへ じしゃくが うごき、てつが くっつく', () => {
    openStage(1)
    const canvas = screen.getByLabelText(/ゆびで じしゃくを うごかして/, { selector: 'canvas' })
    const w = world()
    const clip = w.items.find((it) => it.kind.id === 'clip')!
    // jsdom の canvas は 大きさ 0 なので、がめんの 1px = せかいの 1単位 に ちかい。
    fireEvent.pointerDown(canvas, { pointerId: 1, pointerType: 'touch', clientX: 0, clientY: 0 })
    fireEvent.pointerUp(canvas, { pointerId: 1, pointerType: 'touch' })
    act(() => { w.magnet.tx = clip.x; w.magnet.ty = clip.y - 10 })
    advance(90)
    expect(clip.state).toBe('stuck')
    expect(playStick).toHaveBeenCalled()
    expect(screen.getByLabelText(/^クリップ [12] \/ 2$/)).toBeInTheDocument()
  })

  test('やじるしキーでも じしゃくを うごかせる', () => {
    openStage(2)
    const before = world().magnet.tx
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    advance(20)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    expect(world().magnet.tx).toBeGreaterThan(before + 50)
  })

  test('ぜんぶ くっつけると けっかが でて、ほしが きろくされ、もういちど あそべる', () => {
    openStage(1)
    const w = world()
    advance(60 * 60, autoPilot)
    expect(playClear).toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(2600) })
    const dialog = screen.getByRole('dialog', { name: 'クリア' })
    expect(dialog).toHaveTextContent('ぜんぶ くっついた！')
    expect(dialog).toHaveTextContent('くぎ')
    expect(dialog).toHaveTextContent('えんぴつ')
    // おてほんは 3だん つなげるので メダルも とれる。
    expect(dialog).toHaveTextContent('メダル ゲット！')
    expect(JSON.parse(store.get('jishaku-pitatto-medal-v1') ?? '{}')).toEqual({ desk: 1 })
    const saved = JSON.parse(store.get('jishaku-pitatto-progress-v1') ?? '{}') as Record<string, number>
    expect(saved.desk).toBeGreaterThanOrEqual(1)
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    advance(2)
    expect(world()).not.toBe(w)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: new RegExp(`ステージ1 つくえの うえ クリアずみ ほし${saved.desk}こ メダル あり`) })).toBeInTheDocument()
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><JishakuPitattoPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('jishaku-pitatto-music-v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /ステージ3/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })
})
