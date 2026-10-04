import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotBombPlay from './DotBombPlay'
import { playBoom, playClear, playPlace, startBgm } from './sounds'
import { READY_FRAMES, center, type World } from './core'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()])), freq: actual.freq, startBgm: vi.fn(() => () => {}) }
})

let frame: FrameRequestCallback | null
let time: number
const store = new Map<string, string>()
beforeEach(() => {
  time = 0
  frame = null
  store.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(n: number) {
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame?.(time) } })
}

const world = () => (window as unknown as { __dotBombWorld: World }).__dotBombWorld
const ALL_SEEN = JSON.stringify(['prologue', 'boss-forest', 'clear-forest', 'intro-desert', 'boss-desert', 'clear-desert', 'intro-ice', 'boss-ice', 'clear-ice', 'intro-volcano', 'boss-volcano', 'clear-volcano', 'intro-castle', 'boss-castle'])

function renderGame() {
  return render(<MemoryRouter><DotBombPlay /></MemoryRouter>)
}

function startAt(progress: Record<string, number>) {
  store.set('dot-bomb-seen-v1', ALL_SEEN)
  store.set('dot-bomb-progress-v1', JSON.stringify(progress))
  renderGame()
  fireEvent.click(screen.getByRole('button', { name: /つづきから|ぼうけんを/ }))
  advance(READY_FRAMES + 2)
}

describe('dot-bomb の がめん', () => {
  test('タイトルから はじめると プロローグが ながれ、スキップで 1-1 に なり、もどると マップ', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'ドットの ボンボンぼうけん' })).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('title')
    fireEvent.click(screen.getByRole('button', { name: /ぼうけんを はじめる/ }))
    expect(screen.getByText(/ここは ピョンタの むら/)).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('map')
    fireEvent.click(screen.getByRole('button', { name: /スキップ/ }))
    expect(screen.getByLabelText(/1-1 はじまりの もり。/)).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('forest')
    expect(screen.getByRole('img', { name: 'ハート 3こ' })).toBeInTheDocument()
    expect(screen.getByLabelText('てき のこり 3')).toBeInTheDocument()
    expect(JSON.parse(store.get('dot-bomb-seen-v1') ?? '[]')).toContain('prologue')
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ステージを えらぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^1-2 .*まだ えらべない/ })).toBeDisabled()
  })

  test('おはなしは ボタンで さいごまで よむと ステージが はじまる', () => {
    store.set('dot-bomb-seen-v1', JSON.stringify(['prologue']))
    store.set('dot-bomb-progress-v1', JSON.stringify({ '1-1': 1, '1-2': 1 }))
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /つづきから（1-3）/ }))
    expect(startBgm).toHaveBeenCalledWith('boss')
    for (let i = 0; i < 12 && !screen.queryByLabelText(/1-3 キングプニの ひろば。/); i++) {
      fireEvent.click(screen.getByRole('button', { name: /ぜんぶ ひょうじ|つぎへ|おわり/ }))
    }
    expect(screen.getByLabelText(/1-3 キングプニの ひろば。/)).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'キングプニの げんき' })).toHaveAttribute('aria-valuenow', '5')
  })

  test('スペースキーで ボンを おき、ばくはつする。Esc で ひとやすみ できる', () => {
    startAt({})
    expect(world().state).toBe('play')
    fireEvent.keyDown(window, { key: ' ' })
    advance(2)
    expect(playPlace).toHaveBeenCalled()
    expect(world().bombs).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    advance(30)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    advance(160)
    expect(playBoom).toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('dialog', { name: 'ひとやすみ' })).toBeInTheDocument()
    const frameBefore = world().frame
    advance(30)
    expect(world().frame).toBe(frameBefore)
    fireEvent.click(screen.getByRole('button', { name: '▶ つづける' }))
    advance(3)
    expect(world().frame).toBeGreaterThan(frameBefore)
  })

  test('じゅうじパッドと ボンボタンで あそべる', () => {
    startAt({})
    const pad = screen.getByRole('group', { name: /いどう/ })
    vi.spyOn(pad, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100, x: 0, y: 0, toJSON: () => ({}) })
    const x0 = world().hero.x
    fireEvent.pointerDown(pad, { pointerId: 1, clientX: 95, clientY: 50 })
    advance(20)
    expect(world().hero.x).toBeGreaterThan(x0)
    fireEvent.pointerUp(pad, { pointerId: 1 })
    fireEvent.pointerDown(screen.getByRole('button', { name: /ボンを おく/ }), { button: 0 })
    advance(2)
    expect(world().bombs).toHaveLength(1)
  })

  test('ボードの どこを さわっても そこから スティックで うごける。ボタンは じゃましない', () => {
    startAt({})
    const canvas = document.querySelector('canvas[aria-label]')!
    const x0 = world().hero.x
    fireEvent.pointerDown(canvas, { pointerId: 7, clientX: 200, clientY: 200 })
    expect(screen.getByTestId('float-stick')).toBeInTheDocument()
    fireEvent.pointerMove(canvas, { pointerId: 7, clientX: 240, clientY: 205 })
    advance(20)
    expect(world().hero.x).toBeGreaterThan(x0)
    fireEvent.pointerUp(canvas, { pointerId: 7 })
    expect(screen.queryByTestId('float-stick')).not.toBeInTheDocument()
    const x1 = world().hero.x
    advance(10)
    expect(world().hero.x).toBe(x1)
    fireEvent.pointerDown(screen.getByRole('button', { name: /ボンを おく/ }), { pointerId: 8, button: 0 })
    expect(screen.queryByTestId('float-stick')).not.toBeInTheDocument()
    advance(2)
    expect(world().bombs).toHaveLength(1)
  })

  test('とびらに はいって クリアすると ★が きろくされ、つぎへで つぎの ステージ', () => {
    startAt({})
    const w = world()
    w.enemies.forEach(e => { e.dead = 1 })
    w.stats.star = true
    advance(3)
    expect(w.door?.open).toBe(true)
    w.hero.x = center(w.door!.tx)
    w.hero.y = center(w.door!.ty)
    advance(170)
    expect(playClear).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'ステージクリア' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(JSON.parse(store.get('dot-bomb-progress-v1') ?? '{}')).toEqual({ '1-1': 3 })
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ →' }))
    expect(screen.getByLabelText(/1-2 もりの いけ。/)).toBeInTheDocument()
  })

  test('ハートが なくなると ざんねん、もういちどで やりなおせる', () => {
    startAt({})
    const w = world()
    w.hero.hearts = 1
    fireEvent.keyDown(window, { key: ' ' })
    advance(160 + 130)
    expect(screen.getByRole('dialog', { name: 'ざんねん' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    advance(2)
    expect(world()).not.toBe(w)
    expect(world().hero.hearts).toBe(3)
  })

  test('ピョンタに のると とくぎボタンが つかえるように なる', () => {
    startAt({})
    const w = world()
    w.items.push({ id: 999, tx: 1, ty: 1, kind: 'egg', color: 'green', age: 0 })
    advance(40)
    expect(w.hero.ride).toBe('green')
    const skill = screen.getByRole('button', { name: /とくぎ ダッシュ/ })
    fireEvent.pointerDown(skill, { button: 0 })
    advance(2)
    expect(w.hero.act?.kind === 'dash' || w.hero.cool > 0).toBe(true)
  })

  test('おんがくを けすと おぼえておく', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-bomb-music-v1')).toBe('off')
  })

  test('さいごの ボスを たおすと エンディングの おはなしと おしまいが でる', () => {
    const all = Object.fromEntries(['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3', '4-1', '4-2', '4-3', '5-1', '5-2'].map(id => [id, 2]))
    startAt(all)
    const w = world()
    w.items.push({ id: 999, tx: Math.floor(w.hero.x / 16), ty: Math.floor(w.hero.y / 16), kind: 'gold', age: 0 })
    advance(170)
    fireEvent.click(screen.getByRole('button', { name: 'エンディングへ →' }))
    expect(startBgm).toHaveBeenCalledWith('ending')
    fireEvent.click(screen.getByRole('button', { name: /スキップ/ }))
    expect(screen.getByRole('heading', { name: 'おしまい' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'タイトルへ' }))
    expect(screen.getByRole('button', { name: /エンディングを みる/ })).toBeInTheDocument()
  })
})
