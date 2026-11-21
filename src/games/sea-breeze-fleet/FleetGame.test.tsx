import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import FleetGame from './FleetGame'
import { fleetSound } from './sounds'
import { createSeaView } from './seaView'

const { paint } = vi.hoisted(() => ({ paint: vi.fn() }))
vi.mock('./seaView', async original => ({
  ...await original<typeof import('./seaView')>(), createSeaView: vi.fn(() => paint),
}))
vi.mock('./sounds')

const button = (name: string) => screen.getByRole('button', { name })
const press = (name: string) => fireEvent.click(button(name))
const advance = (ms: number) => act(() => { vi.advanceTimersByTime(ms) })
function open() {
  return render(<StrictMode><MemoryRouter><FleetGame /></MemoryRouter></StrictMode>)
}
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'] })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  localStorage.clear()
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.useRealTimers()
})

it('出発、海図タッチでの発射、目標の切替、クリアと次の航海をつなぎ、海域に星を記録する', () => {
  open()
  press('しゅっぱつ')
  const sea = screen.getByLabelText('ふねを うごかす うみ')
  expect(sea).toHaveFocus()
  vi.spyOn(sea, 'getBoundingClientRect').mockReturnValue(new DOMRect(20, 70, 600, 320))
  fireEvent.pointerDown(sea, { button: 0, isPrimary: true, clientX: 324, clientY: 140 })
  expect(fleetSound).toHaveBeenCalledWith('water')
  press('まとを かえる')
  expect(screen.getByText(/まとは 2ばん/)).toBeInTheDocument()
  fireEvent.keyDown(button('みずでっぽう'), { key: 'x' })
  expect(screen.getByText(/まとは 3ばん/)).toBeInTheDocument()
  fireEvent.keyDown(sea, { key: ' ' })
  advance(10_000)
  expect(screen.getByRole('status')).toHaveTextContent('うみを まもった！')
  expect(fleetSound).toHaveBeenCalledWith('clear')
  expect(button('つぎの うみへ')).toHaveFocus()
  press('つぎの うみへ')
  expect(screen.getByRole('meter', { name: 'ゆうびんせん' })).toHaveAttribute('aria-valuenow', '4')
  press('もどる')
  expect(screen.getByRole('img', { name: /クリアずみ ほし/ })).toBeInTheDocument()
  expect(button('しゅっぱつ')).toBeInTheDocument()
})

it('ひとやすみ・画面離脱で描画と入力が止まり、退出後は時計が残らず、再入場で新しい船が出る', () => {
  const game = open()
  press('しゅっぱつ')
  press('ひとやすみ')
  expect(vi.getTimerCount()).toBe(0)
  expect(button('つづける')).toHaveFocus()
  press('つづける')
  const sea = screen.getByLabelText('ふねを うごかす うみ')
  fireEvent.keyDown(sea, { key: ' ' })
  fireEvent(window, new Event('blur'))
  expect(vi.getTimerCount()).toBe(0)
  advance(30_000)
  fireEvent(window, new Event('focus'))
  advance(2000)
  expect(vi.mocked(fleetSound).mock.calls.filter(([cue]) => cue === 'water')).toHaveLength(1)
  expect(screen.getByRole('meter', { name: 'ふねの げんき' })).toHaveAttribute('aria-valuenow', '5')
  game.unmount()
  expect(vi.getTimerCount()).toBe(0)
  const before = vi.mocked(createSeaView).mock.calls.length
  open()
  expect(vi.mocked(createSeaView).mock.calls.length).toBeGreaterThan(before)
  expect(button('しゅっぱつ')).toBeInTheDocument()
})
