import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import StarParadeGame from './StarParadeGame'
import { playFinish, playGrow, playHit, playJump, playShrink } from './sounds'
import { drawWorld, trackHalfWidth } from './world'

vi.mock('./sounds')
vi.mock('./world', async (importOriginal) => ({
  ...await importOriginal<typeof import('./world')>(),
  drawWorld: vi.fn(),
}))

const fieldRect = new DOMRect(45, 72, 960, 440)

function openGame() {
  return render(<StrictMode><MemoryRouter><StarParadeGame /></MemoryRouter></StrictMode>)
}

function press(name: string) {
  fireEvent.click(screen.getByRole('button', { name }))
}

function advance(milliseconds: number) {
  act(() => { vi.advanceTimersByTime(milliseconds) })
}

function passed() {
  return Number(screen.getByRole('progressbar', { name: 'コース' }).getAttribute('aria-valuenow'))
}

function frame() {
  return vi.mocked(drawWorld).mock.lastCall![3]
}

function advanceTo(distance: number) {
  for (let i = 0; i < 100 && frame().distance < distance; i++) advance(80)
  expect(frame().distance).toBeGreaterThanOrEqual(distance)
}

function beginRun() {
  openGame()
  press('スタート')
  const field = screen.getByRole('group', { name: 'ほしを うごかす' })
  expect(field).toHaveFocus()
  return field
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  vi.spyOn(Math, 'random').mockReturnValue(0.75)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(fieldRect)
  const context: Partial<CanvasRenderingContext2D> = { setTransform: vi.fn() }
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D)
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

test('ゲートのない中央を抜け、数字と隕石で星が増減する。打ち上げ後に強化して再出発できる', () => {
  beginRun()
  expect(screen.getByRole('heading', { name: 'ほしぞらパレード' })).toBeInTheDocument()
  advanceTo(1)
  expect(passed()).toBe(1)
  expect(screen.getByLabelText('ほしの なかま 3こ')).toBeInTheDocument()
  expect(playGrow).not.toHaveBeenCalled()
  expect(playShrink).not.toHaveBeenCalled()
  advanceTo(2)
  const afterAddition = frame().count
  expect(afterAddition).toBe(7)
  expect(passed()).toBe(2)
  expect(playGrow).toHaveBeenCalledOnce()
  advanceTo(3)
  expect(screen.getByLabelText(`ほしの なかま 1こ`)).toBeInTheDocument()
  expect(playHit).toHaveBeenCalledOnce()
  const field = screen.getByRole('group', { name: 'ほしを うごかす' })
  fireEvent.keyDown(field, { key: 'ArrowLeft' })
  advance(550)
  fireEvent.keyUp(field, { key: 'ArrowLeft' })
  advanceTo(4)
  expect(screen.getByLabelText('ほしの なかま 1こ')).toBeInTheDocument()
  expect(playShrink).toHaveBeenCalledOnce()
  advance(30_000)
  expect(frame().phase).toBe('launching')
  expect(playFinish).toHaveBeenCalledOnce()
  advance(8000)
  expect(screen.getByRole('button', { name: 'スタート' })).toHaveFocus()
  const buy = screen.getByRole('button', { name: /さいしょの/ })
  expect(buy).toBeEnabled()
  fireEvent.click(buy)
  expect(screen.getByLabelText('ほしの なかま 4こ')).toBeInTheDocument()
  cleanup()
  openGame()
  press('スタート')
  expect(passed()).toBe(0)
  expect(screen.getByLabelText('ほしの なかま 4こ')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'ほしを うごかす' })).toHaveFocus()
  press('もどる')
  expect(screen.getByRole('button', { name: 'スタート' })).toBeInTheDocument()
})

test('左右キーは押している長さだけ動き、離した場所に止まる', () => {
  const field = beginRun()
  advance(32)
  fireEvent.keyDown(field, { key: 'ArrowRight' })
  advance(64)
  fireEvent.keyUp(field, { key: 'ArrowRight' })
  const shortPress = frame().playerX
  expect(shortPress).toBeGreaterThan(0)
  advance(300)
  expect(frame().playerX).toBeCloseTo(shortPress)
  fireEvent.keyDown(field, { key: 'ArrowLeft' })
  advance(192)
  fireEvent.keyUp(field, { key: 'ArrowLeft' })
  advance(32)
  const longPress = shortPress - frame().playerX
  expect(longPress).toBeGreaterThan(shortPress * 2)
  expect(frame().playerX).toBeLessThan(0)
  const stopped = frame().playerX
  advance(250)
  expect(frame().playerX).toBeCloseTo(stopped)
})

test('方向ボタンは1フレームより短いタッチも受け取り、長押しを離すと止まる', () => {
  beginRun()
  advance(32)
  const right = screen.getByRole('button', { name: 'みぎへ' })
  Object.assign(right, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true })
  const finger = { pointerType: 'touch', pointerId: 1, isPrimary: true, button: 0 }
  fireEvent.pointerDown(right, finger)
  advance(6)
  fireEvent.pointerUp(right, finger)
  advance(32)
  const tap = frame().playerX
  expect(tap).toBeGreaterThan(0)
  fireEvent.pointerDown(right, finger)
  advance(140)
  fireEvent.pointerUp(right, finger)
  advance(32)
  const held = frame().playerX
  expect(held - tap).toBeGreaterThan(tap * 5)
  advance(450)
  expect(frame().playerX).toBeCloseTo(held)
})

test('タッチとドラッグでは描かれた道路上の位置に移り、右の×2ゲートをくぐれる', () => {
  const field = beginRun()
  vi.spyOn(field, 'getBoundingClientRect').mockReturnValue(fieldRect)
  Object.assign(field, { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn(), hasPointerCapture: () => true })
  const point = (x: number) => ({
    clientX: fieldRect.left + fieldRect.width / 2 + x * trackHalfWidth(fieldRect.width, fieldRect.height),
    pointerType: 'touch', pointerId: 7, button: 0, isPrimary: true,
  })
  fireEvent.pointerDown(field, point(-0.35))
  advance(480)
  expect(frame().playerX).toBeCloseTo(-0.35)
  fireEvent.pointerMove(field, point(0.65))
  advance(640)
  expect(frame().playerX).toBeCloseTo(0.65)
  fireEvent.pointerUp(field, point(0.65))
  advanceTo(1)
  expect(screen.getByLabelText('ほしの なかま 6こ')).toBeInTheDocument()
})

test('ジャンプボタンとスペースで跳び、空中で横切った隕石には当たらない', () => {
  const field = beginRun()
  press('ジャンプ')
  advance(200)
  expect(frame().jump).toBeGreaterThan(0)
  advanceTo(2.82)
  expect(frame().jump).toBe(0)
  const count = frame().count
  fireEvent.keyDown(field, { key: ' ', code: 'Space' })
  advanceTo(3)
  expect(frame().jump).toBeGreaterThan(0)
  expect(frame().count).toBe(count)
  expect(playJump).toHaveBeenCalledTimes(2)
  expect(playHit).not.toHaveBeenCalled()
})

test('ひとやすみと画面離脱で停止し、戻ってからの時間だけ進む。退出後に描画は残らない', () => {
  const first = openGame()
  press('スタート')
  advance(1_500)
  press('ひとやすみ')
  expect(screen.getByRole('button', { name: 'つづける' })).toHaveFocus()
  expect(vi.getTimerCount()).toBe(0)
  advance(10_000)
  expect(passed()).toBe(0)
  press('つづける')
  const field = screen.getByRole('group', { name: 'ほしを うごかす' })
  fireEvent.keyDown(field, { key: 'ArrowRight' })
  advance(400)
  const beforeBlur = frame().playerX
  expect(beforeBlur).toBeGreaterThan(0)
  fireEvent(window, new Event('blur'))
  expect(vi.getTimerCount()).toBe(0)
  advance(30_000)
  fireEvent(window, new Event('focus'))
  advance(400)
  expect(frame().playerX).toBeCloseTo(beforeBlur)
  expect(passed()).toBe(0)
  advance(1_000)
  expect(passed()).toBe(1)

  first.unmount()
  fireEvent(window, new Event('blur'))
  fireEvent(window, new Event('focus'))
  expect(vi.getTimerCount()).toBe(0)
  const second = openGame()
  press('スタート')
  expect(vi.getTimerCount()).toBe(1)
  expect(passed()).toBe(0)
  second.unmount()
  expect(vi.getTimerCount()).toBe(0)
})

test('目標に届くと打ち上げ後にクリアし、もういちど走れる', () => {
  localStorage.setItem('star-parade-progress-v1', JSON.stringify({ points: 0, level: 26 }))
  beginRun()
  advanceTo(2.82)
  press('ジャンプ')
  advanceTo(3)
  advance(30000)
  expect(frame().phase).toBe('launching')
  const count = frame().count
  expect(count).toBeGreaterThanOrEqual(30)
  advance(8000)
  expect(screen.getByText(/つきに とどいた/)).toHaveTextContent(String(count * 10))
  press('もういちど')
  expect(passed()).toBe(0)
  expect(frame().phase).toBe('running')
})
