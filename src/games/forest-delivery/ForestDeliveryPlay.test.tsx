import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import ForestDeliveryPlay from './ForestDeliveryPlay'
import { playDeliverySound } from './sounds'
import { drawScene } from './render'

vi.mock('./render', () => ({ drawScene: vi.fn() }))
vi.mock('./art', () => ({ drawIcon: vi.fn() }))
vi.mock('./sounds', () => ({ playDeliverySound: vi.fn() }))
vi.mock('../../audio/sound', () => ({ primeAudio: vi.fn() }))
vi.mock('../../utils/haptics', () => ({ vibrate: vi.fn() }))

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  localStorage.clear()
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)))
  vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => window.clearTimeout(id)))
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn() } as never)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function renderPlay() {
  return render(<MemoryRouter initialEntries={['/games/forest-delivery']}><ForestDeliveryPlay /></MemoryRouter>)
}

function walk() {
  act(() => { vi.advanceTimersByTime(12_000) })
}

// These are the actual accessible controls: the model is never mocked or mutated by the test.
function guidedAction(destination: string, action: string) {
  fireEvent.click(screen.getByRole('button', { name: `${destination}へ` }))
  walk()
  const actionButton = screen.getByRole('button', { name: action })
  expect(actionButton).toBeEnabled()
  fireEvent.click(actionButton)
}

function finishFirstTwoDeliveries() {
  guidedAction('ゆうびんやさん', 'にもつを うけとる')
  guidedAction('きのえだ', 'きのえだを ひろう')
  guidedAction('はし', 'はしを なおす')
  guidedAction('りすさん', 'にもつを わたす')
  expect(screen.getByLabelText(/^1 \/ [23] にんに おとどけ$/)).toBeInTheDocument()
  guidedAction('にんじんばたけ', 'おみずを あげる')
  expect(screen.getByRole('status')).toHaveTextContent('すくすく')
  fireEvent.click(screen.getByRole('button', { name: 'にんじんを ぬく' }))
  expect(screen.getByLabelText('にんじん', { selector: 'span' })).toBeInTheDocument()
  guidedAction('うさぎさん', 'にんじんを わたす')
}

describe('ForestDeliveryPlay', () => {
  test('森を選ぶと遊べて、戻ると選択画面へ戻りアニメーションを停止する', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'もりの おとどけやさん' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /で あそぶ$/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' }))
    expect(screen.getByLabelText('0 / 2 にんに おとどけ')).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(1)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' })).toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('案内どおりに荷物・橋・水やり・収穫・配達を終えて記録し、次の森とやりなおしでリセットする', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' }))
    finishFirstTwoDeliveries()
    expect(screen.getByRole('heading', { name: 'みんなに とどいた！' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'つぎの もりへ →' })).toHaveFocus()
    expect(JSON.parse(localStorage.getItem('forest-delivery-progress-v1') ?? '{}')).toEqual({ spring: 3 })
    expect(playDeliverySound).toHaveBeenLastCalledWith('complete')
    fireEvent.click(screen.getByRole('button', { name: 'もういちど あそぶ' }))
    expect(screen.getByLabelText('0 / 2 にんに おとどけ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'にもつを うけとる' })).toBeEnabled()
    finishFirstTwoDeliveries()
    fireEvent.click(screen.getByRole('button', { name: 'つぎの もりへ →' }))
    expect(screen.getByLabelText('0 / 3 にんに おとどけ')).toBeInTheDocument()
    expect(screen.getByText('なつの ごちそう')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'もりを えらびなおす' }))
    const spring = screen.getByRole('button', { name: 'はるの はいたつで あそぶ' })
    expect(within(spring).getByRole('img', { name: 'クリアずみ ほし 3こ' })).toBeInTheDocument()
  })

  test.each(['なつの ごちそう', 'ほたるの よる'])('%s はりんごをくまに届けるまでクリアにならない', (stageName) => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: `${stageName}で あそぶ` }))
    finishFirstTwoDeliveries()
    expect(screen.queryByRole('heading', { name: 'みんなに とどいた！' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('2 / 3 にんに おとどけ')).toBeInTheDocument()
    guidedAction('りんごの き', 'りんごを とる')
    guidedAction('くまさん', 'りんごを わたす')
    expect(screen.getByRole('heading', { name: 'みんなに とどいた！' })).toBeInTheDocument()
    expect(screen.getByLabelText('3 / 3 にんに おとどけ')).toBeInTheDocument()
  })

  test('未修理の橋を渡ろうとすると手順を案内し、歩行中の連打は荷物を受け取らない', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' }))
    fireEvent.click(screen.getByRole('button', { name: 'りすさんへ いく' }))
    expect(screen.getByRole('status')).toHaveTextContent('まずは きのえだを ひろって はしを なおそう')
    expect(screen.getByLabelText('0 / 2 にんに おとどけ')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'にんじんばたけへ いく' }))
    expect(screen.getByRole('button', { name: 'あるいているよ' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'あるいているよ' }))
    expect(playDeliverySound).not.toHaveBeenCalled()
    walk()
    expect(screen.getByRole('button', { name: 'おみずを あげる' })).toBeEnabled()
  })

  test('拡大された地図のタッチ位置を森の座標へ変換して歩く', () => {
    renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' }))
    const map = screen.getByRole('img', { name: /もりの ちず/ })
    vi.spyOn(map, 'getBoundingClientRect').mockReturnValue({ x: 20, y: 30, left: 20, top: 30, right: 660, bottom: 606, width: 640, height: 576, toJSON: () => ({}) })
    // The garden at logical (72, 136) is displayed at 2x scale, with a page offset.
    fireEvent(map, new MouseEvent('pointerdown', { bubbles: true, clientX: 164, clientY: 302 }))
    expect(screen.getByRole('button', { name: 'あるいているよ' })).toBeDisabled()
    walk()
    expect(screen.getByRole('button', { name: 'おみずを あげる' })).toBeEnabled()
  })
  test('消音中も操作でき、音を戻した後の操作だけ鳴る。退出時に描画が止まる', () => {
    const { unmount } = renderPlay()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    fireEvent.click(screen.getByRole('button', { name: 'はるの はいたつで あそぶ' }))
    guidedAction('ゆうびんやさん', 'にもつを うけとる')
    expect(playDeliverySound).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    guidedAction('きのえだ', 'きのえだを ひろう')
    expect(playDeliverySound).toHaveBeenCalledExactlyOnceWith('collect')
    unmount()
    const drawCount = vi.mocked(drawScene).mock.calls.length
    walk()
    expect(vi.getTimerCount()).toBe(0)
    expect(drawScene).toHaveBeenCalledTimes(drawCount)
  })
})
