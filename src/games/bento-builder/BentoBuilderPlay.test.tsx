import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, expect, test, vi } from 'vitest'
import BentoBuilderPlay from './BentoBuilderPlay'
import { FOODS, type BentoState } from './bentoState'
import type { SceneCallbacks } from './bentoScene'
const mock = vi.hoisted(() => ({ latest: null as BentoState | null, callbacks: null as SceneCallbacks | null, dispose: vi.fn(), status: 'ready' as 'ready' | 'error' }))
vi.mock('./bentoScene', () => ({ createBentoScene: (_host: HTMLDivElement, state: BentoState, callbacks: SceneCallbacks) => {
  mock.latest = state
  mock.callbacks = callbacks
  callbacks.status(mock.status)
  return { sync: (next: BentoState) => { mock.latest = next }, dispose: mock.dispose }
} }))
vi.mock('./sounds', () => ({ playBentoSound: vi.fn() }))
beforeEach(() => { mock.status = 'ready'; mock.dispose.mockClear() })
function open() {
  return render(<MemoryRouter initialEntries={['/games/bento-builder']}><Routes>
    <Route path="/games/bento-builder" element={<BentoBuilderPlay />} />
    <Route path="/" element={<h1>ホーム</h1>} />
  </Routes></MemoryRouter>)
}
test('箱選択から8種類の追加、編集、完成、修正、再挑戦、退出まで通る', () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'しきりつき' }))
  fireEvent.click(screen.getByRole('button', { name: 'あお' }))
  fireEvent.click(screen.getByRole('button', { name: 'つくる！' }))
  expect(mock.latest!.box).toBe('divided')
  expect(mock.latest!.color).toBe('#62b9df')
  expect(screen.getByRole('button', { name: '✓ できた！' })).toBeDisabled()
  for (const food of FOODS) fireEvent.click(screen.getByRole('button', { name: `${food.name}を いれる` }))
  expect(mock.latest!.foods).toHaveLength(8)
  fireEvent.click(screen.getByRole('button', { name: '1こめの おにぎり' }))
  fireEvent.click(screen.getByRole('button', { name: '↻ まわす' }))
  expect(mock.latest!.foods[0]!.rotation).toBeCloseTo(Math.PI / 2)
  act(() => mock.callbacks!.move(1, { x: -2, z: -1 }))
  const before = mock.latest!.foods
  fireEvent.click(screen.getByRole('button', { name: '✓ できた！' }))
  expect(screen.getByRole('heading', { name: 'おべんとう できた！' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'たまごを いれる' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '✎ なおす' }))
  expect(mock.latest!.foods).toEqual(before)
  fireEvent.click(screen.getByRole('button', { name: '1こめの おにぎり' }))
  fireEvent.click(screen.getByRole('button', { name: '− けす' }))
  expect(mock.latest!.foods).toHaveLength(7)
  fireEvent.click(screen.getByRole('button', { name: '✓ できた！' }))
  fireEvent.click(screen.getByRole('button', { name: '🍱 もういちど' }))
  expect(mock.latest!.foods).toEqual([])
  expect(screen.getByRole('button', { name: 'つくる！' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: '← もどる' }))
  expect(screen.getByRole('heading', { name: 'ホーム' })).toBeInTheDocument()
  expect(mock.dispose).toHaveBeenCalledOnce()
})
test('完成→編集→箱選択の1階層戻りで配置を保つ', () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'つくる！' }))
  fireEvent.click(screen.getByRole('button', { name: 'たまごを いれる' }))
  fireEvent.click(screen.getByRole('button', { name: '✓ できた！' }))
  fireEvent.click(screen.getByRole('button', { name: '← もどる' }))
  expect(mock.latest!.mode).toBe('edit')
  fireEvent.click(screen.getByRole('button', { name: '← もどる' }))
  expect(mock.latest!.mode).toBe('choose')
  expect(mock.latest!.foods).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'しかく' }))
  expect(mock.latest!.foods).toHaveLength(1)
})
test('上限は子ども向け表示、削除するとまた追加できる', () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'つくる！' }))
  for (let i = 0; i < 23; i++) fireEvent.click(screen.getByRole('button', { name: 'ミニトマトを いれる' }))
  expect(screen.getByRole('status')).toHaveTextContent('いっぱいだね')
  const count = within(screen.getByRole('group', { name: 'いれた おかず' })).getAllByRole('button').length
  fireEvent.click(screen.getByRole('button', { name: '− けす' }))
  fireEvent.click(screen.getByRole('button', { name: 'ミニトマトを いれる' }))
  expect(mock.latest!.foods).toHaveLength(count)
})
test('ロード失敗の再試行で配置を失わず旧シーンを解放する', () => {
  open()
  fireEvent.click(screen.getByRole('button', { name: 'つくる！' }))
  fireEvent.click(screen.getByRole('button', { name: 'おすしを いれる' }))
  act(() => mock.callbacks!.status('error'))
  expect(screen.getByRole('alert')).toHaveTextContent('うまく よみこめなかったよ')
  expect(screen.getByRole('button', { name: 'おすしを いれる' })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: 'もういちど よみこむ' }))
  expect(mock.dispose).toHaveBeenCalledOnce()
  expect(mock.latest!.foods).toHaveLength(1)
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
