import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import GochisoRacePlay from './GochisoRacePlay'
import { READY_TIME } from './race'
import { playBump, playJump, playLose, playReady, playSlide, playWin, startBgm } from './sounds'

vi.mock('./sounds', () => ({
  playTap: vi.fn(), playReady: vi.fn(), playJump: vi.fn(), playSlide: vi.fn(), playSpring: vi.fn(), playBoost: vi.fn(),
  playEat: vi.fn(), playRivalEat: vi.fn(), playBump: vi.fn(),
  playFall: vi.fn(), playRespawn: vi.fn(), playGoal: vi.fn(), playWin: vi.fn(), playLose: vi.fn(),
  startBgm: vi.fn(() => vi.fn()),
}))

// みじかい コースで すすみかたを たしかめる（ほんものの コースの データは courses.test.ts）。
vi.mock('./courses', async importOriginal => {
  const actual = await importOriginal<typeof import('./courses')>()
  const rival = { speed: .5, greed: 0, hesitate: 0, appetite: 0 }
  return {
    ...actual,
    COURSES: [
      actual.buildCourse({ id: 'meadow', name: 'れんしゅう コース', lead: 'まっすぐ はしろう', rival, pieces: [{ t: 'run', len: 700, row: 'banana', n: 6 }] }),
      actual.buildCourse({ id: 'sweets', name: 'だんの コース', lead: 'だんを ジャンプ', rival, pieces: [{ t: 'run', len: 300 }, { t: 'hurdle', h: 60 }, { t: 'run', len: 400 }] }),
      actual.buildCourse({ id: 'starry', name: 'トンネルの コース', lead: 'くぐろう', rival, pieces: [{ t: 'run', len: 300 }, { t: 'tunnel', len: 200 }, { t: 'run', len: 400 }] }),
    ],
  }
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
  // あいては いつも おなじ どうぶつ（パンダの あいては コアラ）。
  vi.spyOn(Math, 'random').mockReturnValue(.5)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(frames: number) {
  act(() => { for (let i = 0; i < frames; i++) { time += 1000 / 60; frame?.(time) } })
}

const seconds = (s: number) => Math.round(s * 60)
const jumpButton = () => screen.getByRole('button', { name: /^ジャンプ/ })
const slideButton = () => screen.getByRole('button', { name: /^スライディング/ })

function startRace(course: RegExp, animal = 'パンダ') {
  render(<MemoryRouter><GochisoRacePlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: animal }))
  fireEvent.click(screen.getByRole('button', { name: course }))
}

function untilDialog(maxSeconds: number) {
  for (let n = 0; n < maxSeconds * 6 && !screen.queryByRole('dialog'); n++) advance(10)
}

describe('gochiso-race play', () => {
  test('picks an animal first, then a course; later courses start locked', () => {
    render(<MemoryRouter><GochisoRacePlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { level: 1, name: 'ぱくぱく ごちそうレース' })).toBeInTheDocument()
    const animals = within(screen.getByRole('list', { name: 'どうぶつを えらぶ' })).getAllByRole('button')
    expect(animals.map(button => button.textContent)).toEqual(['いぬ', 'ねこ', 'うさぎ', 'パンダ', 'ペンギン', 'ライオン', 'コアラ', 'ハムスター', 'キリン', 'ぞう', 'くま', 'きつね'])

    fireEvent.click(screen.getByRole('button', { name: 'パンダ' }))
    expect(store.get('gochiso-race-animal-v1')).toBe('panda')
    expect(screen.getByText('で はしるよ！', { exact: false })).toHaveTextContent('パンダで はしるよ！')
    expect(screen.getByLabelText('あつめた ほし 0 / 9')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 れんしゅう コース' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '2 だんの コース まだ あそべないよ' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '3 トンネルの コース まだ あそべないよ' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'パンダ' })).toHaveAttribute('data-current', 'true')
  })

  test('よーい→どん, then the buttons jump and slide, and winning saves stars and opens the next course', () => {
    startRace(/^1 れんしゅう/)
    expect(screen.getByTestId('race-banner')).toHaveTextContent('よーい…')
    expect(screen.getByTestId('race-banner')).toHaveTextContent('さきに ゴールで +30てん')
    expect(playReady).toHaveBeenCalledWith(false)
    expect(screen.getByLabelText('ごちそう きみ 0てん、コアラ 0てん')).toBeInTheDocument()

    // 「どん！」の まえに おしても とばない。
    fireEvent.pointerDown(jumpButton(), { button: 0 })
    advance(1)
    expect(playJump).not.toHaveBeenCalled()

    advance(seconds(READY_TIME) + 4)
    expect(playReady).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('race-banner')).toHaveTextContent('どん！')
    expect(screen.getByRole('status')).toHaveTextContent('どん！ はしれ！')
    expect(startBgm).toHaveBeenCalledTimes(1)

    fireEvent.pointerDown(jumpButton(), { button: 0 })
    advance(1)
    expect(playJump).toHaveBeenCalledWith(false)

    advance(seconds(1.2))
    fireEvent.pointerDown(slideButton(), { button: 0, pointerId: 3 })
    advance(1)
    expect(playSlide).toHaveBeenCalledTimes(1)

    untilDialog(20)
    expect(screen.getByRole('dialog', { name: 'かち' })).toBeInTheDocument()
    expect(screen.getByLabelText('ほし 3こ')).toBeInTheDocument()
    expect(screen.getByText(/きみは ごちそう 6てん、ゴール \+30、ごうけい 36てん。コアラは ごちそう 0てん、ゴール 0、ごうけい 0てん。/)).toBeInTheDocument()
    expect(playWin).toHaveBeenCalled()
    expect(JSON.parse(store.get('gochiso-race-progress-v1')!)).toEqual({ meadow: 3 })

    fireEvent.click(screen.getByRole('button', { name: 'つぎの コースへ →' }))
    expect(screen.getByTestId('race-banner')).toHaveTextContent('だんの コース')
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 れんしゅう コース ほし3こ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 だんの コース' })).toBeEnabled()
    expect(screen.getByLabelText('あつめた ほし 3 / 9')).toBeInTheDocument()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  test('without jumping the rival gets to the goal first, and losing offers a retry', () => {
    store.set('gochiso-race-progress-v1', JSON.stringify({ meadow: 1 }))
    startRace(/^2 だんの/)
    advance(seconds(READY_TIME) + 4)
    for (let n = 0; n < 200 && !/さきに ゴールしたよ/.test(screen.getByRole('status').textContent ?? ''); n++) advance(10)
    expect(screen.getByRole('status')).toHaveTextContent('コアラが さきに ゴールしたよ。がんばれ！')

    untilDialog(40)
    expect(screen.getByRole('dialog', { name: 'まけ' })).toHaveTextContent('おしい！')
    expect(screen.getByText(/コアラは ごちそう 0てん、ゴール \+30、ごうけい 30てん。/)).toBeInTheDocument()
    expect(screen.queryByLabelText(/ほし \dこ/)).not.toBeInTheDocument()
    expect(playLose).toHaveBeenCalled()
    expect(JSON.parse(store.get('gochiso-race-progress-v1')!)).toEqual({ meadow: 1 })

    fireEvent.click(screen.getByRole('button', { name: '↻ もういちど' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('race-banner')).toHaveTextContent('よーい…')
  })

  test('keys jump and slide too, and the sound button turns the music off', () => {
    startRace(/^1 れんしゅう/)
    advance(seconds(READY_TIME) + 4)
    fireEvent.keyDown(window, { key: 'ArrowUp' })
    advance(1)
    expect(playJump).toHaveBeenCalledTimes(1)
    advance(seconds(1.5))
    fireEvent.keyDown(document.body, { key: ' ' })
    advance(1)
    expect(playJump).toHaveBeenCalledTimes(2)

    advance(seconds(1.5))
    fireEvent.keyDown(window, { key: 'ArrowDown' })
    advance(1)
    expect(playSlide).toHaveBeenCalledTimes(1)
    expect(playJump).toHaveBeenCalledTimes(2)
    // スライディングボタンに フォーカスが ある ときの スペースは スライディング。
    advance(seconds(1))
    fireEvent.keyDown(slideButton(), { key: ' ' })
    advance(1)
    expect(playSlide).toHaveBeenCalledTimes(2)
    expect(playJump).toHaveBeenCalledTimes(2)

    const stopMusic = vi.mocked(startBgm).mock.results[0].value as ReturnType<typeof vi.fn>
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(stopMusic).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'おとを だす' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    expect(startBgm).toHaveBeenCalledTimes(2)
  })

  test('a tunnel bonks a standing runner, and the slide button gets under it', () => {
    store.set('gochiso-race-progress-v1', JSON.stringify({ meadow: 1, sweets: 1 }))
    startRace(/^3 トンネルの/)
    advance(seconds(READY_TIME) + 4)
    advance(seconds(2.5))
    expect(playBump).toHaveBeenCalledWith('bonk')
    expect(screen.getByRole('status')).toHaveTextContent('ごつん！ スライディングで くぐろう')

    fireEvent.click(slideButton(), { detail: 0 })
    untilDialog(20)
    expect(playSlide).toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'かち' })).toBeInTheDocument()
  })

  test('opens from home, and もどる goes back one screen at a time', async () => {
    resetGameShelfCache()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    const shelf = screen.getByRole('region', { name: /ぜんぶの ゲーム/ })
    expect(within(shelf).getByRole('link', { name: 'ぱくぱく ごちそうレース' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'ぱくぱく ごちそうレース' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'ぱくぱく ごちそうレース' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'きつね' }))
    await user.click(screen.getByRole('button', { name: '1 れんしゅう コース' }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    expect(jumpButton()).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 れんしゅう コース' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'きつね' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
