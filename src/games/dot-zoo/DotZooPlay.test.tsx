import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotZooPlay from './DotZooPlay'
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

const zoo = () => (window as unknown as { __dotZoo: World }).__dotZoo

/** jsdom の canvas は 640x360（ドット 1ばい）として あつかわれる。ここは (5, 5) の マスの まんなか。 */
function tapCenter() {
  const canvas = screen.getByLabelText(/どうぶつえん。/)
  const opts = { clientX: 320, clientY: 180, pointerId: 1, isPrimary: true, button: 0, pointerType: 'mouse' }
  fireEvent.pointerDown(canvas, opts)
  fireEvent.pointerUp(canvas, opts)
}

describe('dot-zoo play', () => {
  test('まっさらから はじめて どうぶつを おき、えさを あげると たべにくる', () => {
    render(<MemoryRouter><DotZooPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの どうぶつえん' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /まっさらから/ }))
    advance(2)
    expect(zoo().animals).toHaveLength(0)
    expect(startBgm).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: /どうぶつ$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^キリン 0\/1/ }))
    tapCenter()
    expect(zoo().animals.map(a => a.species)).toEqual(['giraffe'])
    expect(screen.getByLabelText('どうぶつ 1 / 12')).toBeInTheDocument()
    // キリンは 1とうまで
    expect(screen.getByRole('button', { name: /^キリン 1\/1 いっぱい/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /えさ$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'おにく' }))
    tapCenter()
    expect(screen.getByRole('status')).toHaveTextContent('たべる どうぶつが いないよ')
    expect(zoo().foods).toHaveLength(0)

    fireEvent.click(screen.getByRole('button', { name: 'くさ' }))
    tapCenter()
    expect(zoo().foods).toHaveLength(1)
    advance(30 * 12)
    expect(zoo().foods).toHaveLength(0)
    expect(store.get('dot-zoo-v1')).toContain('giraffe')
  })

  test('かたづけで どうぶつを もどせる', () => {
    render(<MemoryRouter><DotZooPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /まっさらから/ }))
    fireEvent.click(screen.getByRole('button', { name: /どうぶつ$/ }))
    fireEvent.click(screen.getByRole('button', { name: /^パンダ/ }))
    tapCenter()
    expect(zoo().animals).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: /かたづけ$/ }))
    tapCenter()
    expect(zoo().animals).toHaveLength(0)
  })

  test('つづきから あそべて、もどると タイトル', () => {
    store.set('dot-zoo-v1', JSON.stringify({ objects: [{ k: 'tree', x: 1, z: 1, seed: 3 }], animals: [{ s: 'lion', x: 5.5, z: 5.5 }], clock: .3 }))
    render(<MemoryRouter><DotZooPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /つづきから/ }))
    advance(2)
    expect(zoo().animals.map(a => a.species)).toEqual(['lion'])
    expect(zoo().objects.map(o => o.kind)).toEqual(['tree'])
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ドットの どうぶつえん' })).toBeInTheDocument()
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><DotZooPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-zoo-music-v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /まっさらから/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })

  test('スマホを たてに もつと よこむきを あんないする', () => {
    portrait = true
    render(<MemoryRouter><DotZooPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの どうぶつえん' })).toBeInTheDocument()
    expect(screen.getByText('よこにして あそんでね')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /まっさらから/ })).not.toBeInTheDocument()
  })
})
