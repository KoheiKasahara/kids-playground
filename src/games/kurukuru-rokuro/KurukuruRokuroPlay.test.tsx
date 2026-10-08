import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import GameIntro from '../../components/GameIntro'
import GameIntroProvider from '../../components/GameIntroProvider'
import KurukuruRokuroPlay from './KurukuruRokuroPlay'
import { createLump, stretchProfile } from './pottery'
import type { RokuroCallbacks, RokuroView } from './rokuroScene'
import { SHELF_STORAGE_KEY } from './shelf'
import { TARGETS } from './targets'

// WebGL は jsdom で うごかさない。ここでは がめんの きりかえと、ボタンや ゆびの けっかが 3D へ とどくかを みる。
const mock = vi.hoisted(() => ({
  view: null as RokuroView | null,
  callbacks: null as RokuroCallbacks | null,
  created: 0,
  dispose: vi.fn(),
  capture: vi.fn(() => 'data:image/webp;base64,AAAA' as string | null),
  status: 'ready' as 'ready' | 'error',
}))
vi.mock('./rokuroScene', () => ({
  BAKE_MS: 3000,
  createRokuroScene: (_host: HTMLDivElement, view: RokuroView, callbacks: RokuroCallbacks) => {
    mock.created++
    mock.view = view
    mock.callbacks = callbacks
    callbacks.status(mock.status)
    return { sync: (next: RokuroView) => { mock.view = next }, capture: mock.capture, dispose: mock.dispose }
  },
}))
vi.mock('./sounds', () => ({
  playDipSound: vi.fn(), playDoneSound: vi.fn(), playKilnSound: vi.fn(), playSelectSound: vi.fn(),
  playShelfSound: vi.fn(), playStretchSound: vi.fn(), playUndoSound: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  mock.status = 'ready'
  mock.created = 0
  mock.dispose.mockClear()
  mock.capture.mockClear()
})
afterEach(() => vi.useRealTimers())

function open() {
  return render(
    <MemoryRouter initialEntries={['/games/kurukuru-rokuro']}>
      <GameIntroProvider>
        <Routes>
          <Route path="/games/kurukuru-rokuro" element={<><KurukuruRokuroPlay /><GameIntro /></>} />
          <Route path="/" element={<h1>ホーム</h1>} />
        </Routes>
      </GameIntroProvider>
    </MemoryRouter>,
  )
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const radio = (name: string) => fireEvent.click(screen.getByRole('radio', { name }))

function bake() {
  click(/かまで やく/)
  expect(screen.getByRole('status')).toHaveTextContent('かまで やいているよ')
  act(() => { vi.advanceTimersByTime(3000) })
}

describe('くるくる ろくろ', () => {
  test('じゆうに つくる: かたち → いろ → やく → たなに かざる まで とおる', () => {
    vi.useFakeTimers()
    open()
    expect(screen.getByRole('heading', { name: 'くるくる ろくろ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /たな/ })).not.toBeInTheDocument()
    click('▶ じゆうに つくる')
    expect(screen.getByRole('application')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()

    // かたち
    expect(screen.getByRole('button', { name: /もどす/ })).toBeDisabled()
    click(/のばす/)
    expect(mock.view!.profile.height).toBeGreaterThan(createLump().height)
    click(/もどす/)
    expect(mock.view!.profile).toEqual(createLump())
    const pressed = { height: 1.3, radii: createLump().radii.map((radius, index) => (index > 20 ? 0.5 : radius)) }
    act(() => mock.callbacks!.profile(pressed))
    expect(mock.view!.profile).toEqual(pressed)
    click(/さいしょから/)
    expect(mock.view!.profile).toEqual(createLump())
    click(/のばす/)

    // いろ
    click(/いろを ぬる/)
    expect(mock.view!.phase).toBe('paint')
    expect(screen.getByRole('radio', { name: /ぜんぶ ぬる/ })).toHaveAttribute('aria-checked', 'true')
    radio('あお')
    expect(mock.view!.paint.base).toBe('blue')
    expect(mock.view!.brush).toBeNull()
    radio('ほそい ふで')
    expect(mock.view!.brush).toBe('thin')
    expect(screen.queryByRole('radio', { name: 'つち' })).not.toBeInTheDocument()
    radio('きいろ')
    expect(mock.view!.brushColor).toBe('yellow')
    expect(mock.view!.paint.base).toBe('blue')
    act(() => mock.callbacks!.stroke({ color: 'yellow', brush: 'thin', points: [[0, 0.5], [0.1, 0.5]] }))
    expect(mock.view!.paint.strokes).toHaveLength(1)
    click(/もどす/)
    expect(mock.view!.paint.strokes).toHaveLength(0)

    // やく
    bake()
    expect(mock.view!.phase).toBe('done')
    expect(screen.getByRole('heading', { name: /コップが できた！/ })).toBeInTheDocument()
    expect(screen.queryByRole('img', { name: /ほし/ })).not.toBeInTheDocument()
    click(/たなに かざる/)
    expect(mock.capture).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: /かざったよ/ })).toBeDisabled()
    expect(JSON.parse(localStorage.getItem(SHELF_STORAGE_KEY)!)).toHaveLength(1)

    // メニューに もどると たなに ならぶ
    fireEvent.click(screen.getByRole('button', { name: 'メニューへ もどる' }))
    expect(mock.dispose).toHaveBeenCalledOnce()
    const shelf = screen.getByRole('heading', { name: /たな/ }).closest('section')!
    expect(within(shelf).getByRole('img', { name: 'コップ' })).toHaveAttribute('src', 'data:image/webp;base64,AAAA')
  })

  test('おだい: にている ★が かわり、やいた ★を おぼえる', () => {
    vi.useFakeTimers()
    open()
    click('はないれを つくる')
    expect(screen.getByText('はないれ')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'にてる ほし 1こ' })).toBeInTheDocument()
    expect(mock.view!.target).toBe(TARGETS.find(target => target.id === 'vase')!.profile)
    act(() => mock.callbacks!.profile(TARGETS.find(target => target.id === 'vase')!.profile))
    expect(screen.getByRole('img', { name: 'にてる ほし 3こ' })).toBeInTheDocument()
    click(/いろを ぬる/)
    bake()
    expect(screen.getByRole('heading', { name: /はないれが できた！/ })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'ほし 3こ' })).toBeInTheDocument()
    expect(mock.view!.kind).toBe('vase')
    click(/もう1こ つくる/)
    expect(mock.view!.phase).toBe('shape')
    expect(mock.view!.profile).toEqual(createLump())
    expect(screen.getByRole('img', { name: 'にてる ほし 1こ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'メニューへ もどる' }))
    const card = screen.getByRole('button', { name: 'はないれを つくる' })
    expect(within(card).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test('もどる は ひとつ まえへ。いろを ぬる まえの かたちは のこる', () => {
    open()
    click('▶ じゆうに つくる')
    click(/のばす/)
    const tall = mock.view!.profile
    click(/いろを ぬる/)
    fireEvent.click(screen.getByRole('button', { name: 'まえへ もどる' }))
    expect(mock.view!.phase).toBe('shape')
    expect(mock.view!.profile).toBe(tall)
    fireEvent.click(screen.getByRole('button', { name: 'メニューへ もどる' }))
    expect(screen.getByRole('button', { name: '▶ じゆうに つくる' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ホーム' })).toBeInTheDocument()
  })

  test('キーボードでも かたちを かえ、せんを ひける', () => {
    open()
    click('▶ じゆうに つくる')
    const canvas = screen.getByRole('application')
    fireEvent.keyDown(canvas, { key: 'ArrowUp' })
    expect(mock.view!.cursor).toBe(0.6)
    fireEvent.keyDown(canvas, { key: 'ArrowRight' })
    expect(Math.max(...mock.view!.profile.radii)).toBeGreaterThan(0.85)
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' })
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' })
    expect(Math.min(...mock.view!.profile.radii)).toBeLessThan(0.85)
    fireEvent.blur(canvas)
    expect(mock.view!.cursor).toBeNull()
    click(/いろを ぬる/)
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
    expect(mock.view!.paint.strokes).toHaveLength(0)
    radio('てんてん')
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
    expect(mock.view!.paint.strokes).toHaveLength(1)
    expect(mock.view!.paint.strokes[0]).toMatchObject({ brush: 'dots', color: 'sky' })
  })

  test('3Dが ひょうじ できないときは もういちど よみこめ、かたちは のこる', () => {
    mock.status = 'error'
    open()
    click('▶ じゆうに つくる')
    expect(screen.getByRole('alert')).toHaveTextContent('3Dを ひょうじ できなかったよ')
    expect(screen.getByRole('button', { name: /のばす/ })).toBeDisabled()
    act(() => mock.callbacks!.profile(stretchProfile(createLump(), 1)))
    mock.status = 'ready'
    click('もういちど')
    expect(mock.dispose).toHaveBeenCalledOnce()
    expect(mock.created).toBe(2)
    expect(mock.view!.profile.height).toBeGreaterThan(createLump().height)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  test('たなに しゃしんが ないときは シルエットで かざる', () => {
    vi.useFakeTimers()
    mock.capture.mockReturnValueOnce(null)
    open()
    click('▶ じゆうに つくる')
    for (let i = 0; i < 3; i++) click(/ちぢめる/)
    click(/いろを ぬる/)
    bake()
    expect(screen.getByRole('heading', { name: /できた！/ })).toBeInTheDocument()
    click(/たなに かざる/)
    fireEvent.click(screen.getByRole('button', { name: 'メニューへ もどる' }))
    const shelf = screen.getByRole('heading', { name: /たな/ }).closest('section')!
    const piece = within(shelf).getByRole('img')
    expect(piece.tagName).toBe('SPAN')
    expect(piece.querySelector('path')).not.toBeNull()
  })
})
