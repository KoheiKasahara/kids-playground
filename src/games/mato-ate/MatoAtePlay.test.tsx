import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import MatoAtePlay from './MatoAtePlay'
import { makeView } from './render'
import { playClearSound, playHitSound, playShootSound } from './sounds'

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
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 720, right: 400, bottom: 720, toJSON() {} })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(n: number) {
  act(() => { for (let i = 0; i < n; i++) { time += 1000 / 60; frame?.(time) } })
}

function open(name: RegExp) {
  render(<MemoryRouter><MatoAtePlay /></MemoryRouter>)
  expect(screen.getByRole('heading', { name: 'ねらって！まとあて' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name }))
  return screen.getByLabelText(/ねらう ところを タップすると/)
}

/** せかいの 座標（x, y）を タップする。 */
function tap(canvas: HTMLElement, x: number, y: number) {
  const view = makeView(400, 720)
  const at = { clientX: view.ox + x * view.scale, clientY: view.oy + y * view.scale }
  fireEvent.pointerDown(canvas, { ...at, button: 0 })
  fireEvent.pointerUp(canvas, at)
}

describe('mato-ate play', () => {
  test('select shows the three difficulty tiers', () => {
    render(<MemoryRouter><MatoAtePlay /></MemoryRouter>)
    for (const label of ['かんたん', 'ふつう', 'むずかしい']) expect(screen.getByRole('heading', { name: new RegExp(label) })).toBeInTheDocument()
    expect(screen.getByLabelText('あつめた ほし 0 / 36')).toBeInTheDocument()
  })

  test('tap → the ball flies → target breaks later → clear card → next stage → back', () => {
    const canvas = open(/^1 はじめての まと/)
    advance(5)
    expect(screen.getByLabelText('のこりの まと 3こ')).toBeInTheDocument()
    tap(canvas, 200, 190)
    advance(2)
    expect(playShootSound).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('のこりの たま 5こ')).toBeInTheDocument()
    // すぐには われない。
    advance(20)
    expect(playHitSound).not.toHaveBeenCalled()
    expect(screen.getByLabelText('のこりの まと 3こ')).toBeInTheDocument()
    advance(60)
    expect(playHitSound).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('のこりの まと 2こ')).toBeInTheDocument()
    tap(canvas, 110, 300)
    advance(25)
    tap(canvas, 290, 300)
    advance(160)
    expect(screen.getByRole('heading', { name: 'クリア！' })).toBeInTheDocument()
    expect(screen.getByLabelText('ほし 3こ')).toBeInTheDocument()
    expect(screen.getByText('めいちゅう 3 / 3ぱつ')).toBeInTheDocument()
    expect(playClearSound).toHaveBeenCalledOnce()
    expect(JSON.parse(store.get('mato-ate-progress-v1')!)).toEqual({ 0: 3 })
    fireEvent.click(screen.getByRole('button', { name: 'つぎへ →' }))
    expect(screen.getByLabelText(/^ステージ 2 ゆらゆら まと/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 はじめての まと ほし3こ' })).toBeInTheDocument()
    expect(screen.getByLabelText('あつめた ほし 3 / 36')).toBeInTheDocument()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  test('missing every ball shows a retry card', () => {
    const canvas = open(/^1 はじめての まと/)
    advance(5)
    for (let i = 0; i < 6; i++) {
      tap(canvas, 10, 600)
      advance(30)
    }
    advance(200)
    expect(screen.getByRole('heading', { name: 'おしい！' })).toBeInTheDocument()
    expect(screen.getByText('まとが あと 3こ のこっているよ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '↻ もういちど' }))
    expect(screen.queryByRole('heading', { name: 'おしい！' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('のこりの たま 6こ')).toBeInTheDocument()
  })

  test('hitting a wall shows a tip', () => {
    const canvas = open(/^3 かべの むこう/)
    advance(5)
    tap(canvas, 200, 300)
    advance(60)
    expect(screen.getByRole('status')).toHaveTextContent('かべに あたったよ')
  })

  test('keyboard: arrows turn the cannon and space shoots', () => {
    const canvas = open(/^1 はじめての まと/)
    advance(5)
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' })
    fireEvent.keyDown(canvas, { key: ' ' })
    advance(2)
    expect(playShootSound).toHaveBeenCalledOnce()
    // すぐに もういちど おしても、じゅんびが できてから 1ぱつだけ うつ。
    fireEvent.keyDown(canvas, { key: 'Enter' })
    fireEvent.keyDown(canvas, { key: 'Enter' })
    advance(30)
    expect(playShootSound).toHaveBeenCalledTimes(2)
    expect(screen.getByLabelText('のこりの たま 4こ')).toBeInTheDocument()
  })
})
