import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import BlockCraftPlay from './BlockCraftPlay'
import { createWorld, decodeWorld, MATERIALS, SAVE_KEY, type World } from './world'

const scene = vi.hoisted(() => ({ world: [] as World, night: false }))
vi.mock('./useCraftScene', () => ({ useCraftScene: (world: World, _cursor: unknown, _pick: unknown, night: boolean) => { scene.world = world; scene.night = night; return { setContainer: () => {}, failed: false, api: { current: null } } } }))
vi.mock('./sounds', () => ({ playCraftSound: vi.fn() }))
beforeEach(() => localStorage.clear())
function mount() { return render(<MemoryRouter><BlockCraftPlay /></MemoryRouter>) }

it('shows only the essential controls', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  expect(screen.getByRole('button', { name: 'おと' })).toHaveTextContent(/^🔊$/)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText(/ドラッグで まわす/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ちかづく' })).not.toBeInTheDocument()
  expect(screen.queryByText(/ボタンで ばしょを えらぶ/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'よる' })).toHaveTextContent(/^☀️$/)
  expect(screen.getAllByRole('button')).toHaveLength(3 + 3 + MATERIALS.length + 2)
})

it('switches between day and night without adding messages', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  expect(scene.night).toBe(false)
  await user.click(screen.getByRole('button', { name: 'よる' }))
  expect(scene.night).toBe(true)
  expect(screen.getByRole('button', { name: 'よる' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ダイヤ' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(scene.world.at(-1)?.material).toBe('diamond')
})

it('is listed in the menu', () => { expect(GAME_CATALOG.some((game) => game.id === 'block-craft')).toBe(true) })

it('starts, places and mines blocks, undoes, saves and resumes after re-entry', async () => {
  const user = userEvent.setup()
  const view = mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  const initialCount = scene.world.length
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(scene.world).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: '🧱 おく' }))
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(scene.world).toHaveLength(initialCount)
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(scene.world).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(decodeWorld(localStorage.getItem(SAVE_KEY))).toEqual(scene.world)
  await user.click(screen.getByRole('button', { name: /おと/ }))
  expect(isSoundEnabled()).toBe(false)
  await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
  expect(isSoundEnabled()).toBe(true)
  view.unmount()
  mount()
  await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
  expect(scene.world).toHaveLength(initialCount + 1)
})

it('supports material selection, keyboard cursor, reset cancellation and undoing reset', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(scene.world.at(-1)).toEqual({ x: 9, y: 3, z: 8, material: 'brick' })
  const built = scene.world
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(scene.world).toEqual(built)
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'もどして あそぶ' }))
  expect(scene.world).toEqual(createWorld())
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(scene.world).toEqual(built)
})

it('handles invalid saves and reports storage failure without losing play state', async () => {
  localStorage.setItem(SAVE_KEY, '{broken')
  const user = userEvent.setup()
  mount()
  expect(screen.queryByRole('button', { name: /つづきから/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  const built = scene.world
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(scene.world).toEqual(built)
  spy.mockRestore()
})
