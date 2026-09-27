import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotRunPlay from './DotRunPlay'
import { playGoal, playJump, startBgm } from './sounds'
import { READY_FRAMES, type World } from './world'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()])), startBgm: vi.fn(() => () => {}) }
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

const world = () => (window as unknown as { __dotRunWorld: World }).__dotRunWorld

function openStage(n: number) {
  render(<MemoryRouter><DotRunPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^ステージ${n}`) }))
  advance(READY_FRAMES + 4)
}

describe('dot-run play', () => {
  test('タイトルから ステージを えらんで あそび、もどれる', () => {
    render(<MemoryRouter><DotRunPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの ぴょんぴょんラン' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^ステージ\d/ })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: /ステージ1 はなの はらっぱ/ }))
    expect(screen.getByLabelText(/はなの はらっぱ。タップで ジャンプ/)).toBeInTheDocument()
    expect(startBgm).toHaveBeenCalledWith('meadow')
    advance(3)
    expect(screen.getByLabelText('にんじん 0こ')).toBeInTheDocument()
    expect(screen.getByLabelText('ほしメダル 0 / 3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ドットの ぴょんぴょんラン' })).toBeInTheDocument()
  })

  test('よーい どん！ の あと、タップで ジャンプし、はしって にんじんを あつめる', () => {
    openStage(1)
    const canvas = screen.getByLabelText(/タップで ジャンプ/, { selector: 'canvas' })
    fireEvent.pointerDown(canvas)
    advance(4)
    expect(playJump).toHaveBeenCalled()
    expect(world().hero.vy).toBeLessThan(0)
    fireEvent.pointerUp(canvas)
    advance(60 * 5)
    expect(world().got.carrots).toBeGreaterThan(0)
    expect(screen.getByLabelText(`にんじん ${world().got.carrots}こ`)).toBeInTheDocument()
  })

  test('スペースキーでも ジャンプできる', () => {
    openStage(2)
    fireEvent.keyDown(window, { key: ' ' })
    advance(3)
    expect(world().hero.onGround).toBe(false)
    fireEvent.keyUp(window, { key: ' ' })
    expect(world().held).toBe(false)
  })

  test('ゴールすると けっかが でて、ほしが きろくされ、もういちど あそべる', () => {
    openStage(1)
    const w = world()
    w.hero.x = w.goalX - 40
    w.got.medals = 2
    advance(60 * 5)
    expect(playGoal).toHaveBeenCalled()
    const dialog = screen.getByRole('dialog', { name: 'ゴール' })
    expect(dialog).toHaveTextContent('ほしメダル 2 / 3')
    expect(screen.getByRole('img', { name: 'ほし 2こ' })).toBeInTheDocument()
    expect(JSON.parse(store.get('dot-run-progress-v1') ?? '{}')).toEqual({ meadow: 2 })
    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(world()).not.toBe(w)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /ステージ1 はなの はらっぱ クリアずみ ほし2こ/ })).toBeInTheDocument()
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><DotRunPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-run-music-v1')).toBe('off')
    fireEvent.click(screen.getByRole('button', { name: /ステージ3/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })
})
