import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import BlockCraftPlay from './BlockCraftPlay'
import type { CraftSceneOptions, SceneApi } from './useCraftScene'
import { playCraftSound } from './sounds'
import { createWorld, decodeWorld, MATERIALS, SAVE_KEY, TREASURES, type Position, type World } from './world'

const scene = vi.hoisted(() => ({ options: null as unknown as CraftSceneOptions, api: { current: null as SceneApi | null } }))
vi.mock('./useCraftScene', () => ({ useCraftScene: (options: CraftSceneOptions) => { scene.options = options; return { setContainer: () => {}, failed: false, api: scene.api } } }))
vi.mock('./sounds', () => ({ playCraftSound: vi.fn() }))
beforeEach(() => { localStorage.clear(); scene.api.current = null; vi.mocked(playCraftSound).mockClear() })
const world = (): World => scene.options.world
function mount() { return render(<MemoryRouter><BlockCraftPlay /></MemoryRouter>) }
async function start() {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  return user
}
const tap = (position: Position, normal: Position = { x: 0, y: 1, z: 0 }) => act(() => scene.options.onPick(position, normal))

it('shows only the essential controls', async () => {
  await start()
  expect(screen.getByRole('button', { name: 'おと' })).toHaveTextContent(/^🔊$/)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText(/ドラッグで まわす/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ちかづく' })).not.toBeInTheDocument()
  expect(screen.queryByText(/ボタンで ばしょを えらぶ/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'よる' })).toHaveTextContent(/^☀️$/)
  // ヘッダー（もどる・よる・おと）、あるく、おく・こわす・ひろく・もどす、ざいりょう、ほぞん・はじめの せかい
  expect(screen.getAllByRole('button')).toHaveLength(3 + 1 + 4 + MATERIALS.length + 2)
})

it('switches between day and night without adding messages', async () => {
  const user = await start()
  expect(scene.options.night).toBe(false)
  await user.click(screen.getByRole('button', { name: 'よる' }))
  expect(scene.options.night).toBe(true)
  expect(screen.getByRole('button', { name: 'よる' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ダイヤ' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(world().at(-1)?.material).toBe('diamond')
})

it('is listed in the menu', () => { expect(GAME_CATALOG.some((game) => game.id === 'block-craft')).toBe(true) })

it('starts, places and mines blocks, undoes, saves and resumes after re-entry', async () => {
  const user = userEvent.setup()
  const view = mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  const initialCount = world().length
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(world()).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: '🧱 おく' }))
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(world()).toHaveLength(initialCount)
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(world()).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(decodeWorld(localStorage.getItem(SAVE_KEY))).toEqual(world())
  await user.click(screen.getByRole('button', { name: /おと/ }))
  expect(isSoundEnabled()).toBe(false)
  await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
  expect(isSoundEnabled()).toBe(true)
  view.unmount()
  mount()
  await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
  expect(world()).toHaveLength(initialCount + 1)
})

it('supports material selection, keyboard cursor, reset cancellation and undoing reset', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(world().at(-1)).toEqual({ x: 9, y: 3, z: 8, material: 'brick' })
  const built = world()
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(world()).toEqual(built)
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'もどして あそぶ' }))
  expect(world()).toEqual(createWorld())
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(world()).toEqual(built)
})

it('handles invalid saves and reports storage failure without losing play state', async () => {
  localStorage.setItem(SAVE_KEY, '{broken')
  const user = userEvent.setup()
  mount()
  expect(screen.queryByRole('button', { name: /つづきから/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  const built = world()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(world()).toEqual(built)
  spy.mockRestore()
})

it('places and mines a 3×3 area at once when ひろく is on, and undoes it in one step', async () => {
  const user = await start()
  const initial = world()
  await user.click(screen.getByRole('button', { name: 'いし' }))
  await user.click(screen.getByRole('button', { name: '🔲 ひろく' }))
  expect(screen.getByRole('button', { name: '🔲 ひろく' })).toHaveAttribute('aria-pressed', 'true')
  tap({ x: 8, y: 2, z: 8 })
  expect(world().filter(b => b.y === 3 && b.material === 'stone')).toHaveLength(9)
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  tap({ x: 8, y: 3, z: 8 })
  expect(world().filter(b => b.y === 3 && b.material === 'stone')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(world()).toEqual(initial)
})

it('grows a sapling into a tree when it is tapped', async () => {
  await start()
  const sapling = world().find(b => b.material === 'sapling')!
  tap(sapling)
  expect(world().some(b => b.material === 'sapling')).toBe(false)
  expect(world().filter(b => b.x === sapling.x && b.z === sapling.z && b.material === 'wood')).toHaveLength(3)
  expect(playCraftSound).toHaveBeenLastCalledWith('grow')
})

it('copies a material with a long press, using either touch or Shift+Enter', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  act(() => scene.options.onHold?.(world().find(b => b.material === 'pumpkin')!))
  expect(screen.getByRole('button', { name: 'かぼちゃ' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '🧱 おく' })).toHaveAttribute('aria-pressed', 'true')
  const before = world()
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter', shiftKey: true })
  expect(world()).toBe(before)
  expect(screen.getByRole('button', { name: 'くさ' })).toHaveAttribute('aria-pressed', 'true')
})

it('celebrates each treasure dug up and counts toward finding them all', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  expect(screen.getByLabelText(`みつけた たから 0こ（ぜんぶで ${TREASURES.length}こ）`)).toBeInTheDocument()
  for (const [index, treasure] of TREASURES.entries()) {
    tap({ ...treasure, y: 2 })
    tap(treasure)
    const last = index === TREASURES.length - 1
    expect(screen.getByRole('status')).toHaveTextContent(last ? 'ぜんぶ みつけた' : 'みつけた')
    expect(playCraftSound).toHaveBeenLastCalledWith(last ? 'complete' : 'treasure')
  }
  expect(screen.getByLabelText(`みつけた たから ${TREASURES.length}こ（ぜんぶで ${TREASURES.length}こ）`)).toHaveTextContent('🎉')
  // もどすと かずも もどる。おしらせは でない
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(screen.getByLabelText(`みつけた たから ${TREASURES.length - 1}こ（ぜんぶで ${TREASURES.length}こ）`)).toBeInTheDocument()
})

it('hides the treasure message after a moment', async () => {
  await start()
  vi.useFakeTimers()
  try {
    fireEvent.click(screen.getByRole('button', { name: '⛏️ こわす' }))
    tap({ ...TREASURES[0], y: 2 })
    tap(TREASURES[0])
    expect(screen.getByRole('status')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  } finally { vi.useRealTimers() }
})

it('walks around the world with the pad and keyboard, climbing one step and acting at the center', async () => {
  const user = await start()
  const actAtCenter = vi.fn()
  scene.api.current = { heading: () => ({ x: 1, z: 0 }), turn: vi.fn(), actAtCenter }
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(screen.getByRole('button', { name: 'あるく' })).toHaveAttribute('aria-pressed', 'true')
  expect(scene.options.walker).toEqual({ x: 8, y: 3, z: 8 })
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  expect(scene.options.walker).toEqual({ x: 9, y: 3, z: 8 })
  expect(playCraftSound).toHaveBeenLastCalledWith('step')
  // 1だんの かいだんは のぼれる
  tap({ x: 10, y: 2, z: 8 })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowUp' })
  expect(scene.options.walker).toEqual({ x: 10, y: 4, z: 8 })
  // 2だんは のぼれない
  for (let y = 2; y <= 4; y++) tap({ x: 11, y, z: 8 })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowUp' })
  expect(scene.options.walker).toEqual({ x: 10, y: 4, z: 8 })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowDown' })
  expect(scene.options.walker).toEqual({ x: 9, y: 3, z: 8 })
  await user.click(screen.getByRole('button', { name: 'ひだりを むく' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  expect(scene.api.current.turn).toHaveBeenCalledWith('left')
  expect(scene.api.current.turn).toHaveBeenCalledWith('right')
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter', shiftKey: true })
  expect(actAtCenter.mock.calls).toEqual([['pick'], ['hold']])
  // あしもとに ブロックを おくと うえに のる
  tap({ x: 9, y: 2, z: 8 })
  expect(scene.options.walker).toEqual({ x: 9, y: 4, z: 8 })
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(scene.options.walker).toBeNull()
  expect(screen.queryByRole('button', { name: 'まえへ すすむ' })).not.toBeInTheDocument()
})

it('makes an animal hop with a sound when it is tapped', async () => {
  await start()
  act(() => scene.options.onPet?.('sheep'))
  expect(playCraftSound).toHaveBeenLastCalledWith('pet')
})
