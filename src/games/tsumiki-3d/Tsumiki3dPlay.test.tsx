import GameIntro from '../../components/GameIntro'
import GameIntroProvider from '../../components/GameIntroProvider'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RefObject } from 'react'
import type { TsumikiCallbacks, TsumikiSelection } from './useTsumikiEngine'
import Tsumiki3dPlay from './Tsumiki3dPlay'

// WebGL と Rapier は jsdom で うごかさない。ここでは 画面の きりかえと ボタンが エンジンへ とどくかを 見る。
const engine = vi.hoisted(() => ({
  controls: {
    undo: vi.fn(), clear: vi.fn(), shake: vi.fn(), orbit: vi.fn(), zoom: vi.fn(),
    moveCursor: vi.fn(), placeAtCursor: vi.fn(), hideCursor: vi.fn(),
  },
  selection: null as RefObject<TsumikiSelection> | null,
  callbacks: null as RefObject<TsumikiCallbacks> | null,
}))
vi.mock('./useTsumikiEngine', () => ({
  INITIAL_SNAPSHOT: { count: 0, height: 0, goals: 0, full: false },
  useTsumikiEngine: (selection: RefObject<TsumikiSelection>, callbacks: RefObject<TsumikiCallbacks>) => {
    engine.selection = selection
    engine.callbacks = callbacks
    return { registerContainer: vi.fn(), status: 'ready', controls: { current: engine.controls }, retry: vi.fn() }
  },
}))

function renderPlay() {
  return render(
    <MemoryRouter initialEntries={['/games/tsumiki-3d']}>
      <GameIntroProvider><Tsumiki3dPlay /><GameIntro /></GameIntroProvider>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  Object.values(engine.controls).forEach(fn => fn.mockClear())
  localStorage.clear()
})

describe('Tsumiki3dPlay', () => {
  it('タイトルから あそぶ で プレイへ、もどる で タイトルへ（せつめいも もどる）', async () => {
    const user = userEvent.setup()
    renderPlay()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /あそぶ/ }))
    expect(screen.getByRole('application')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
    expect(screen.getByRole('button', { name: /あそぶ/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
  })

  it('かたち・いろ・むきの えらびが エンジンへ つたわる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: /あそぶ/ }))
    await user.click(screen.getByRole('radio', { name: 'アーチ' }))
    await user.click(screen.getByRole('radio', { name: 'あお' }))
    await user.click(screen.getByRole('button', { name: /まわす/ }))
    expect(screen.getByRole('radio', { name: 'アーチ' })).toHaveAttribute('aria-checked', 'true')
    expect(engine.selection?.current).toEqual({ shape: 'arch', color: 'blue', turns: 1 })
    // かたちを かえると むきは もとに もどる
    await user.click(screen.getByRole('radio', { name: 'しかく' }))
    expect(engine.selection?.current).toEqual({ shape: 'cube', color: 'blue', turns: 0 })
  })

  it('つんだ あとは もどす・ゆらす・かたづけ が つかえ、たかさと めあてが でる', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: /あそぶ/ }))
    expect(screen.getByRole('button', { name: /もどす/ })).toBeDisabled()
    act(() => engine.callbacks?.current.onSnapshot({ count: 4, height: 3.2, goals: 1, full: false }))
    act(() => engine.callbacks?.current.onGoal({ height: 3, emoji: '🐤', label: 'ひよこ' }, 0))
    expect(screen.getByText('16')).toBeInTheDocument()
    expect(screen.getByLabelText('めあて 1こ クリア')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('ひよこ くらい たかい！')
    await user.click(screen.getByRole('button', { name: /もどす/ }))
    await user.click(screen.getByRole('button', { name: /ゆらす/ }))
    await user.click(screen.getByRole('button', { name: /かたづけ/ }))
    expect(engine.controls.undo).toHaveBeenCalledTimes(1)
    expect(engine.controls.shake).toHaveBeenCalledTimes(1)
    expect(engine.controls.clear).toHaveBeenCalledTimes(1)
  })

  it('キーボードでも おける', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: /あそぶ/ }))
    screen.getByRole('application').focus()
    await user.keyboard('{ArrowRight}{ArrowUp}{Enter}q')
    expect(engine.controls.moveCursor).toHaveBeenCalledWith(1, 0)
    expect(engine.controls.moveCursor).toHaveBeenCalledWith(0, 1)
    expect(engine.controls.placeAtCursor).toHaveBeenCalledTimes(1)
    expect(engine.controls.orbit).toHaveBeenCalledWith(-0.3, 0)
  })

  it('いちばん たかい きろくを タイトルに だす', async () => {
    const user = userEvent.setup()
    renderPlay()
    await user.click(screen.getByRole('button', { name: /あそぶ/ }))
    act(() => engine.callbacks?.current.onSnapshot({ count: 6, height: 6, goals: 2, full: false }))
    await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
    expect(screen.getByText(/さいこう 30cm/)).toBeInTheDocument()
  })
})
