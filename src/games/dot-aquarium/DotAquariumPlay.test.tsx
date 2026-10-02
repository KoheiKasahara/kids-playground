import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotAquariumPlay from './DotAquariumPlay'
import { startBgm } from './sounds'
import type { World } from './sim'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()])), startBgm: vi.fn(() => () => {}) }
})

let frame: FrameRequestCallback | null
let time: number
let portrait = false
const store = new Map<string, string>()
beforeEach(() => {
  time = 0
  frame = null
  portrait = false
  store.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) }, removeItem: (k: string) => { store.delete(k) } })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('matchMedia', vi.fn((q: string) => ({ matches: q.includes('portrait') && portrait, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(n: number) {
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 30; frame?.(time) } })
}

const tank = () => (window as unknown as { __dotAquarium: World }).__dotAquarium

/** jsdom の canvas は 640x360（ドット 2ばい → 320x180）として あつかわれる。 */
function tap(clientX: number, clientY: number) {
  const canvas = screen.getByLabelText(/すいそう。/)
  const opts = { clientX, clientY, pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }
  fireEvent.pointerDown(canvas, opts)
  fireEvent.pointerUp(canvas, opts)
}

describe('dot-aquarium play', () => {
  test('からっぽから いきものと ものを いれて、えさを あげると たべにくる', () => {
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの すいぞくかん' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /からっぽから/ }))
    advance(2)
    expect(tank().creatures).toHaveLength(0)
    expect(startBgm).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'いきもの' }))
    fireEvent.click(screen.getByRole('button', { name: /^サメ 0\/1/ }))
    tap(320, 160)
    expect(tank().creatures.map(c => c.species)).toEqual(['shark'])
    expect(screen.getByLabelText('いきもの 1 / 20')).toBeInTheDocument()
    // サメは 1ぴき まで
    expect(screen.getByRole('button', { name: /^サメ 1\/1 いっぱい/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もの' }))
    fireEvent.click(screen.getByRole('button', { name: /^おしろ/ }))
    tap(320, 340)
    expect(tank().decor.map(d => d.kind)).toEqual(['castle'])

    fireEvent.click(screen.getByRole('button', { name: 'えさ' }))
    fireEvent.click(screen.getByRole('button', { name: 'フレーク' }))
    tap(320, 160)
    expect(screen.getByRole('status')).toHaveTextContent('フレークを たべる いきものが いないよ')
    expect(tank().foods).toHaveLength(0)

    tank().creatures[0].hunger = .9
    fireEvent.click(screen.getByRole('button', { name: 'エビ' }))
    tap(320, 160)
    expect(tank().foods).toHaveLength(1)
    advance(30 * 20)
    expect(tank().foods).toHaveLength(0)
    expect(tank().creatures[0].hunger).toBeLessThan(.9)
    expect(store.get('dot-aquarium-v1')).toContain('shark')
  })

  test('かたづけで いきものを もどせる', () => {
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /からっぽから/ }))
    fireEvent.click(screen.getByRole('button', { name: 'いきもの' }))
    fireEvent.click(screen.getByRole('button', { name: /^ハリセンボン/ }))
    tap(320, 160)
    expect(tank().creatures).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'かたづけ' }))
    tap(320, 160)
    expect(tank().creatures).toHaveLength(0)
  })

  test('いきものを タップすると ようすが みえる', () => {
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /からっぽから/ }))
    fireEvent.click(screen.getByRole('button', { name: 'いきもの' }))
    fireEvent.click(screen.getByRole('button', { name: /^ハリセンボン/ }))
    tap(320, 160)
    fireEvent.click(screen.getByRole('button', { name: 'いきもの' }))
    const p = tank().creatures[0]
    tap(p.x * 2, p.y * 2)
    expect(screen.getByRole('complementary', { name: 'ハリセンボンの ようす' })).toBeInTheDocument()
    expect(p.state).toBe('puff')
  })

  test('つづきから あそべて、もどると タイトル', () => {
    store.set('dot-aquarium-v1', JSON.stringify({ d: [{ k: 'rock', x: .2, z: .5, seed: 3 }], c: [{ s: 'turtle', x: .5, y: .5, z: .5 }], clock: .3, pearls: 2 }))
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /つづきから/ }))
    advance(2)
    expect(tank().creatures.map(c => c.species)).toEqual(['turtle'])
    expect(tank().decor.map(d => d.kind)).toEqual(['rock'])
    expect(screen.getByLabelText('しんじゅ 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ドットの すいぞくかん' })).toBeInTheDocument()
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-aquarium-music-v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /からっぽから/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })

  test('スマホを たてに もつと よこむきを あんないする', () => {
    portrait = true
    render(<MemoryRouter><DotAquariumPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの すいぞくかん' })).toBeInTheDocument()
    expect(screen.getByText('よこにして あそんでね')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /からっぽから/ })).not.toBeInTheDocument()
  })
})
