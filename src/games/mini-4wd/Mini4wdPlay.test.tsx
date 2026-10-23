import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import Mini4wdPlay from './Mini4wdPlay'
import { COURSES, PARTS } from './data'
import { progressStore, readBuild } from './save'
import { drawPartPreview, drawRace } from './render'
import { playMiniSound, startMiniBgm, stopMiniSounds } from './sounds'

const audio = vi.hoisted(() => ({ stop: vi.fn() }))
vi.mock('./render', () => ({ drawGarage: vi.fn(), drawCoursePreview: vi.fn(), drawPartPreview: vi.fn(), drawRace: vi.fn() }))
vi.mock('./sounds', () => ({ playMiniSound: vi.fn(), startMiniBgm: vi.fn(() => audio.stop), stopMiniSounds: vi.fn() }))

let callbacks = new Map<number, FrameRequestCallback>()
let frameId = 0
let now = 100
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  callbacks = new Map()
  now = 100
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callbacks.set(++frameId, callback); return frameId })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
function openGame() { return render(<MemoryRouter><Mini4wdPlay /></MemoryRouter>) }
function click(name: string | RegExp) { fireEvent.click(screen.getByRole('button', { name })) }
function runFor(seconds: number) {
  act(() => {
    for (let i = 0; i < seconds * 60; i++) {
      now += 1000 / 60
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach(callback => callback(now))
    }
  })
}
function startRace() { click('できた！ コースへ →'); click('この コースで レース！ →') }

describe('mini-4wd play loop', () => {
  test('part tabs support keyboard selection and keep focus on the active tab', () => {
    openGame()
    const body = screen.getByRole('tab', { name: 'ボディ' })
    body.focus()
    fireEvent.keyDown(body, { key: 'ArrowRight' })
    const motor = screen.getByRole('tab', { name: 'モーター' })
    expect(motor).toHaveFocus()
    expect(motor).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(motor, { key: 'End' })
    expect(screen.getByRole('tab', { name: 'ローラー' })).toHaveFocus()
  })

  test('part and paint changes update the preview, stats and saved build', () => {
    openGame()
    expect(startMiniBgm).not.toHaveBeenCalled()
    click(/バギー/)
    fireEvent.click(screen.getByRole('tab', { name: 'モーター' }))
    click(/ダッシュ/)
    click('あお')
    expect(readBuild()).toMatchObject({ body: 'buggy', motor: 'dash', color: 'blue' })
    expect(screen.getByRole('button', { name: 'あお' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('meter', { name: 'はやさ' })).toHaveAttribute('value', '3.7')
    expect(startMiniBgm).toHaveBeenCalledWith('garage')
  })

  test('all courses are selectable and race completes, saves stars, retries and rebuilds', () => {
    openGame()
    click('できた！ コースへ →')
    for (const course of COURSES) expect(screen.getByRole('button', { name: new RegExp(course.name) })).toBeEnabled()
    click(new RegExp(COURSES[2].name))
    click('この コースで レース！ →')
    expect(screen.getByRole('img', { name: new RegExp(COURSES[2].name) })).toBeInTheDocument()
    runFor(90)
    expect(screen.getByRole('status')).toHaveTextContent(/い！/)
    expect(progressStore.read()[COURSES[2].id]).toBeGreaterThanOrEqual(1)
    expect(callbacks.size).toBe(0)
    click('↻ もういちど')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(callbacks.size).toBe(1)
    runFor(90)
    click('🔧 くみかえる')
    expect(screen.getByRole('region', { name: 'パーツを えらぶ' })).toBeInTheDocument()
    expect(callbacks.size).toBe(0)
  })

  test('cheering visibly boosts the car, then charges before the next boost', () => {
    openGame()
    startRace()
    expect(screen.getByRole('button', { name: /がんばれー/ })).toBeDisabled()
    runFor(4)
    click(/がんばれー/)
    expect(playMiniSound).toHaveBeenCalledWith('cheer')
    runFor(.2)
    expect(vi.mocked(drawRace).mock.lastCall![1].racers[0].boost).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: /パワーアップ！/ })).toHaveAttribute('data-state', 'boost')
    expect(screen.getByText('ぐぐーんと パワーアップ！')).toBeInTheDocument()
    runFor(1.5)
    const charging = screen.getByRole('button', { name: /パワーを ためてるよ/ })
    vi.mocked(playMiniSound).mockClear()
    fireEvent.click(charging)
    expect(playMiniSound).not.toHaveBeenCalledWith('cheer')
    runFor(1.2)
    expect(screen.getByRole('button', { name: /がんばれー/ })).toHaveAttribute('data-state', 'ready')
  })

  test('every part card shows a preview of that part on the machine', () => {
    openGame()
    for (const category of ['body', 'motor', 'tires', 'rollers'] as const) {
      fireEvent.click(screen.getByRole('tab', { name: { body: 'ボディ', motor: 'モーター', tires: 'タイヤ', rollers: 'ローラー' }[category] }))
      const cards = within(screen.getByRole('tabpanel')).getAllByRole('button')
      expect(cards).toHaveLength(PARTS[category].length)
      expect(cards.filter(card => card.getAttribute('aria-pressed') === 'true')).toHaveLength(1)
      for (const part of PARTS[category]) expect(drawPartPreview).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ [category]: part.id }), category)
    }
    fireEvent.click(screen.getByRole('tab', { name: 'ボディ' }))
    click(/トラック/)
    expect(readBuild().body).toBe('truck')
  })

  test('pause and window blur freeze the simulation until explicit resume', () => {
    openGame()
    startRace()
    runFor(6)
    click('Ⅱ ひとやすみ')
    const before = vi.mocked(drawRace).mock.lastCall![1].elapsed
    runFor(4)
    expect(vi.mocked(drawRace).mock.lastCall![1].elapsed).toBe(before)
    click('▶ つづける')
    runFor(4)
    expect(vi.mocked(drawRace).mock.lastCall![1].elapsed).toBeGreaterThan(before)
    fireEvent.blur(window)
    expect(screen.getByRole('button', { name: '▶ つづける' })).toBeInTheDocument()
  })

  test('mute stops music, back cancels frames, and exit restores shared sound', () => {
    const view = openGame()
    startRace()
    runFor(1)
    click('おとを けす')
    expect(isSoundEnabled()).toBe(false)
    expect(audio.stop).toHaveBeenCalled()
    expect(stopMiniSounds).toHaveBeenCalled()
    click('もどる')
    expect(callbacks.size).toBe(0)
    expect(screen.getByRole('heading', { name: 'どこを はしろう？' })).toBeInTheDocument()
    click('この コースで レース！ →')
    expect(callbacks.size).toBe(1)
    view.unmount()
    expect(callbacks.size).toBe(0)
    expect(isSoundEnabled()).toBe(true)
  })

  test('next course and saved machine survive finishing and reentry', () => {
    let view = openGame()
    click(/ウイング/)
    startRace()
    runFor(90)
    click('つぎの コースへ →')
    const chosen = screen.getByRole('button', { name: new RegExp(COURSES[1].name) })
    expect(chosen).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /クリアずみ/ })).toBeInTheDocument()
    view.unmount()
    view = openGame()
    expect(within(screen.getByRole('tabpanel')).getByRole('button', { name: /ウイング/ })).toHaveAttribute('aria-pressed', 'true')
    expect(drawRace).toHaveBeenCalled()
    view.unmount()
  })
})
