import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotAdventurePlay from './DotAdventurePlay'
import { startBgm } from './sounds'

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
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
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
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame?.(time) } })
}

describe('dot-adventure play', () => {
  test('タイトルから ステージを えらんで あそび、もどれる', () => {
    render(<MemoryRouter><DotAdventurePlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの ぼうけん' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^ステージ\d/ })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: /ステージ1 みどりの もり/ }))
    expect(screen.getByLabelText(/みどりの もり。いきたい ところを タップすると/)).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('forest')
    advance(3)
    expect(screen.getByLabelText('ほしの かけら 0 / 5')).toBeInTheDocument()
    expect(screen.getByLabelText('なかま 0にん')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ドットの ぼうけん' })).toBeInTheDocument()
  })

  test('やじるしキーで あるく', () => {
    render(<MemoryRouter><DotAdventurePlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /ステージ1/ }))
    advance(2)
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    advance(40)
    fireEvent.keyUp(window, { key: 'ArrowRight' })
    const world = (window as unknown as { __dotWorld: { hero: { x: number; dir: string } } }).__dotWorld
    expect(world.hero.dir).toBe('right')
    expect(world.hero.x).toBeGreaterThan(80)
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><DotAdventurePlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-adventure-music-v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /ステージ2/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })

  test('スマホを たてに もつと よこむきを あんないする', () => {
    portrait = true
    render(<MemoryRouter><DotAdventurePlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの ぼうけん' })).toBeInTheDocument()
    expect(screen.getByText('よこにして あそんでね')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /ステージ1/ })).not.toBeInTheDocument()
  })
})
