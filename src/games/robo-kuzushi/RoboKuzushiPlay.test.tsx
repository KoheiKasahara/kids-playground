import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import RoboKuzushiPlay from './RoboKuzushiPlay'
import { playClearSound, playLaunchSound, playSplitSound } from './sounds'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()]))
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
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true }
  })
  // jsdom は canvas を かけないので、絵は かかずに 物理と 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 800, height: 500, right: 800, bottom: 500, toJSON() {} })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(n: number) {
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame?.(time) } })
}

function open(name: RegExp) {
  render(<MemoryRouter><RoboKuzushiPlay /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'とばせ！ロボくずし' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByLabelText(/たまを うしろへ ひっぱって/)
}

// 800x500 の がめんでは はば1400の ステージが ちょうど おさまる。
const SCALE = 800 / 1400
function drag(canvas: HTMLElement, degrees: number, length: number) {
  const dx = -Math.cos(degrees * Math.PI / 180) * length * SCALE
  const dy = Math.sin(degrees * Math.PI / 180) * length * SCALE
  fireEvent.pointerDown(canvas, { clientX: 150, clientY: 300, button: 0 })
  fireEvent.pointerMove(canvas, { clientX: 150 + dx / 2, clientY: 300 + dy / 2 })
  fireEvent.pointerMove(canvas, { clientX: 150 + dx, clientY: 300 + dy })
  expect(screen.getByRole('status')).toBeEmptyDOMElement()
  fireEvent.pointerUp(canvas, { clientX: 150 + dx, clientY: 300 + dy })
}

describe('robo-kuzushi play', () => {
  test('select → pull and release → robot falls → clear card with stars → next stage → back', () => {
    const canvas = open(/^1 はじめの いっぽ/)
    advance(90)
    expect(screen.getByLabelText('のこりの たま 3こ')).toBeInTheDocument()
    expect(screen.getByLabelText('のこりの ロボット 1たい')).toBeInTheDocument()
    drag(canvas, -10, 90)
    advance(2)
    expect(playLaunchSound).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('のこりの たま 2こ')).toBeInTheDocument()
    advance(700)
    expect(screen.getByLabelText('のこりの ロボット 0たい')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'クリア！' })).toBeInTheDocument()
    expect(screen.getByLabelText('ほし 3こ')).toBeInTheDocument()
    expect(playClearSound).toHaveBeenCalledOnce()
    expect(JSON.parse(store.get('robo-kuzushi-progress-v1')!)).toEqual({ 0: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ →' }))
    expect(screen.getByText('きの おしろ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 はじめの いっぽ ほし3こ' })).toBeInTheDocument()
    expect(screen.getByLabelText('あつめた ほし 3 / 30')).toBeInTheDocument()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  test('a tiny tug or a canceled drag does not shoot; missing every ball offers a retry', () => {
    const canvas = open(/^1 はじめの いっぽ/)
    advance(90)
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 300, button: 0 })
    fireEvent.pointerMove(canvas, { clientX: 146, clientY: 302 })
    fireEvent.pointerUp(canvas, { clientX: 146, clientY: 302 })
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 300, button: 0 })
    fireEvent.pointerMove(canvas, { clientX: 90, clientY: 330 })
    fireEvent.pointerCancel(canvas)
    advance(5)
    expect(playLaunchSound).not.toHaveBeenCalled()
    expect(screen.getByLabelText('のこりの たま 3こ')).toBeInTheDocument()
    for (let i = 0; i < 3; i++) {
      drag(canvas, -60, 40)
      advance(600)
    }
    expect(screen.getByRole('heading', { name: 'おしい！' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '↻ もういちど' }))
    expect(screen.queryByRole('heading', { name: 'おしい！' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('のこりの たま 3こ')).toBeInTheDocument()
  })

  test('keyboard: arrows aim, space shoots, and the blue ball splits by itself', () => {
    const canvas = open(/^7 みっつに わかれる/)
    advance(10)
    fireEvent.keyDown(canvas, { key: 'ArrowUp' })
    // ねらっている あいだは かくど・つよさの 文字を ださない（みちすじの てんだけ）。
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.keyDown(canvas, { key: 'ArrowRight' })
    fireEvent.keyDown(canvas, { key: ' ' })
    advance(60)
    expect(playLaunchSound).toHaveBeenCalledOnce()
    expect(playSplitSound).toHaveBeenCalledOnce()
    expect(screen.queryByRole('button', { name: /わける/ })).not.toBeInTheDocument()
  })

  test('a phone held upright is asked to turn sideways, and the stage waits', () => {
    const listeners = new Set<() => void>()
    const query = { matches: true, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) }
    vi.stubGlobal('matchMedia', vi.fn((q: string) => q.includes('portrait') ? query : { matches: false, addEventListener() {}, removeEventListener() {} }))
    const canvas = open(/^1 はじめの いっぽ/)
    expect(screen.getByRole('heading', { name: /よこにして/ })).toBeInTheDocument()
    fireEvent.keyDown(canvas, { key: ' ' })
    fireEvent.keyDown(canvas, { key: ' ' })
    advance(60)
    expect(playLaunchSound).not.toHaveBeenCalled()
    expect(screen.getByLabelText('のこりの たま 3こ')).toBeInTheDocument()
    query.matches = false
    act(() => listeners.forEach(cb => cb()))
    expect(screen.queryByRole('heading', { name: /よこにして/ })).not.toBeInTheDocument()
  })
})
