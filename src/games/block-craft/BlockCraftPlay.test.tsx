import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import BlockCraftPlay from './BlockCraftPlay'
import { createWorld, decodeWorld, SAVE_KEY, type World } from './world'

const scene = vi.hoisted(() => ({ world: [] as World }))
vi.mock('./useCraftScene', () => ({ useCraftScene: (world: World) => { scene.world = world; return { setContainer: () => {}, failed: false, api: { current: null } } } }))
vi.mock('./sounds', () => ({ playCraftSound: vi.fn() }))
beforeEach(() => localStorage.clear())
function mount() { return render(<MemoryRouter><BlockCraftPlay /></MemoryRouter>) }

it('keeps the new menu entry last', () => { expect(GAME_CATALOG.at(-1)?.id).toBe('block-craft') })

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

it('supports material selection, button cursor, reset cancellation and undoing reset', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: /はじめから あそぶ/ }))
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  await user.click(screen.getByText('🎯 ボタンで ばしょを えらぶ'))
  await user.click(screen.getByRole('button', { name: 'ばしょを みぎへ' }))
  await user.click(screen.getByRole('button', { name: 'ここに おく' }))
  expect(scene.world.at(-1)).toEqual({ x: 6, y: 3, z: 5, material: 'brick' })
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
  expect(screen.getByRole('status')).toHaveTextContent('ほぞんできなかった')
  expect(scene.world).toEqual(built)
  spy.mockRestore()
})
