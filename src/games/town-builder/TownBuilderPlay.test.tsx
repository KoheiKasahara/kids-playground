import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import { ToolIcon, TileArt } from './PartArt'
import { PARTS } from './parts'
import { playTownSound } from './sounds'
import { applyTool, COLS, createTown, decodeTown, encodeTown, SAVE_KEY } from './town'
import { createTownScene, type TownSceneCallbacks, type VehicleCounts } from './three/townScene'
import TownBuilderPlay from './TownBuilderPlay'

vi.mock('./sounds', () => ({ playTownSound: vi.fn() }))

// 3D は WebGL を つかうので、がめんの テストでは うごきを まねる ものに かえる。
const scene3d = vi.hoisted(() => ({
  counts: { car: 2, train: 0 } as VehicleCounts,
  fail: false,
  callbacks: null as TownSceneCallbacks | null,
  handle: {
    setNight: () => {}, setTour: () => {}, turn: () => {}, zoom: () => {}, ride: () => true, land: () => {}, dispose: () => {},
  } as Record<string, (...args: never[]) => unknown>,
}))
vi.mock('./three/townScene', () => ({
  createTownScene: vi.fn((_host: HTMLDivElement, _town: unknown, _night: boolean, callbacks: TownSceneCallbacks) => {
    scene3d.callbacks = callbacks
    if (scene3d.fail) callbacks.error()
    else callbacks.ready(scene3d.counts)
    return scene3d.handle
  }),
}))

beforeEach(() => {
  localStorage.clear()
  vi.mocked(playTownSound).mockClear()
  vi.mocked(createTownScene).mockClear()
  scene3d.fail = false
  for (const key of Object.keys(scene3d.handle)) scene3d.handle[key] = vi.fn(key === 'ride' ? () => true : () => {})
})
afterEach(() => vi.useRealTimers())

function mount() {
  return render(<MemoryRouter><TownBuilderPlay /></MemoryRouter>)
}

const tile = (name: string) => screen.getByRole('button', { name })
const savedTown = () => decodeTown(localStorage.getItem(SAVE_KEY))

it('keeps the new menu entry last and shows its title on the play screen', () => {
  expect(GAME_CATALOG.at(-1)?.id).toBe('town-builder')
  mount()
  expect(screen.getByRole('heading', { name: GAME_CATALOG.at(-1)?.title })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: /まちの ちず/ })).toBeInTheDocument()
})

it('places houses, connects them with roads, grows the town, undoes and autosaves', async () => {
  const user = userEvent.setup()
  mount()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()

  // さいしょは あかい おうちが えらばれて いる。
  expect(screen.getByRole('button', { name: 'あかい おうち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('3-1 くさはら'))
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('build')

  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  expect(screen.getByRole('button', { name: 'みち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('3-2 くさはら'))
  expect(tile('3-1 あかい おうち')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・12にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('road')
  expect(savedTown()?.[2]).toEqual({ ground: 'grass', part: 'house' })

  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(savedTown()?.[COLS + 2]).toEqual({ ground: 'grass', part: null })
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('3-1 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ひとつ もどす' })).toBeDisabled()
})

it('celebrates once each time the town reaches a bigger size', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mount()
  await user.click(screen.getByRole('button', { name: 'タワーマンション' }))
  await user.click(tile('6-9 くさはら'))
  expect(screen.getByRole('img', { name: 'まち・38にん' })).toBeInTheDocument()
  expect(screen.getByText('まちに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()

  // いちど とどいた おおきさは、けして また たてても おいわい しない。
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  await user.click(tile('6-9 くさはら'))
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()
  await user.click(tile('8-9 くさはら'))
  expect(screen.getByText('としに なった！')).toBeInTheDocument()
})

it('erases buildings with the bulldozer and builds bridges and crossings', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(screen.getByRole('button', { name: 'けす' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('5-7 あかい おうち'))
  expect(tile('5-7 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・4にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('erase')
  // なにも ない ところを けしても かわらない。
  vi.mocked(playTownSound).mockClear()
  await user.click(tile('5-7 くさはら'))
  expect(playTownSound).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  await user.click(screen.getByRole('button', { name: 'かわ' }))
  await user.click(tile('6-8 みち'))
  expect(tile('6-8 みちの はし')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'せんろ' }))
  await user.click(tile('8-8 みち'))
  expect(tile('8-8 ふみきり')).toBeInTheDocument()
})

it('switches between day and night and limits zooming in and out', async () => {
  const user = userEvent.setup()
  const { container } = mount()
  const screenRoot = container.querySelector('[data-night]')
  expect(screenRoot).toHaveAttribute('data-night', 'false')
  await user.click(screen.getByRole('button', { name: 'よるに する' }))
  expect(screenRoot).toHaveAttribute('data-night', 'true')
  await user.click(screen.getByRole('button', { name: 'ひるに する' }))
  expect(screenRoot).toHaveAttribute('data-night', 'false')

  const zoomIn = screen.getByRole('button', { name: 'おおきく みる' })
  const zoomOut = screen.getByRole('button', { name: 'ちいさく みる' })
  for (let step = 0; step < 5; step += 1) if (!zoomIn.hasAttribute('disabled')) await user.click(zoomIn)
  expect(zoomIn).toBeDisabled()
  for (let step = 0; step < 5; step += 1) if (!zoomOut.hasAttribute('disabled')) await user.click(zoomOut)
  expect(zoomOut).toBeDisabled()
  expect(zoomIn).toBeEnabled()
})

it('starts a new empty or starter town only after confirming, and the reset can be undone', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  expect(screen.getByRole('dialog', { name: 'あたらしく つくる？' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  expect(screen.getByRole('button', { name: /まっさら/ })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  await user.click(screen.getByRole('button', { name: /まっさら/ }))
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /くさはら$/ })).toHaveLength(COLS * COLS)
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()

  await user.click(tile('3-1 くさはら'))
  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  await user.click(screen.getByRole('button', { name: /はじめの まち/ }))
  expect(savedTown()).toEqual(createTown())
})

it('resumes the saved town after leaving and ignores broken saves', async () => {
  const town = applyTool(createTown(), 2, 'castle')
  localStorage.setItem(SAVE_KEY, encodeTown(town))
  const view = mount()
  expect(tile('3-1 おしろ')).toBeInTheDocument()
  view.unmount()

  localStorage.setItem(SAVE_KEY, '{broken')
  mount()
  expect(tile('3-1 くさはら')).toBeInTheDocument()
})

it('keeps playing when saving fails and restores sound when leaving', async () => {
  const user = userEvent.setup()
  const view = mount()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(tile('3-1 くさはら'))
  expect(screen.getByRole('status')).toHaveTextContent('ほぞん できなかったよ')
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  spy.mockRestore()
  await user.click(tile('4-1 くさはら'))
  expect(screen.queryByText('ほぞん できなかったよ')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'おと' }))
  expect(isSoundEnabled()).toBe(false)
  view.unmount()
  expect(isSoundEnabled()).toBe(true)
})

it('moves around the map with arrow keys and places with Enter', async () => {
  const user = userEvent.setup()
  mount()
  const start = screen.getAllByRole('button').find((button) => button.getAttribute('tabindex') === '0' && button.dataset.index)
  expect(start).toHaveAccessibleName('8-8 みち')
  start!.focus()
  await user.keyboard('{ArrowUp}{ArrowUp}{ArrowLeft}')
  expect(tile('7-6 くさはら')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(tile('7-6 あかい おうち・みちが ほしい')).toHaveFocus()
  await user.keyboard('{ArrowUp}'.repeat(10))
  expect(tile('7-1 くさはら')).toHaveFocus()
})

it('draws every part as an icon and as a tile, by day and by night', () => {
  const { container } = render(<div data-night="true">
    {PARTS.map((part) => <ToolIcon key={part.id} tool={part.id} />)}
    <ToolIcon tool="erase" />
    {PARTS.filter((part) => part.id !== 'water').map((part) => <TileArt key={part.id} ground="grass" part={part.id as Exclude<typeof part.id, 'water'>}
      roadMask={0b1010} railMask={0b0101} waterMask={0} checker lit={part.id !== 'house'} wantsRoad={part.id === 'house'} pop={1} dust={false} />)}
    <TileArt ground="water" part="crossing" roadMask={0b0011} railMask={0b1100} waterMask={0b1111} checker={false} lit wantsRoad={false} pop={0} dust />
  </div>)
  expect(container.querySelectorAll('svg')).toHaveLength(PARTS.length * 2 + 1)
  expect(container.querySelector('[data-lit="false"]')).not.toBeNull()
  expect(container.querySelectorAll('[data-lit="true"]').length).toBeGreaterThan(10)
})

it('opens the finished town in 3D, rides a car, and comes back to building', async () => {
  const user = userEvent.setup()
  mount()
  const open = screen.getByRole('button', { name: '3Dで みる' })
  await user.click(open)
  const dialog = await screen.findByRole('dialog', { name: '3Dで みる' })
  expect(playTownSound).toHaveBeenCalledWith('view')
  expect(createTownScene).toHaveBeenCalledWith(expect.any(HTMLDivElement), createTown(), false, expect.anything())
  // うしろの ちずは さわれない。
  expect(screen.queryByRole('group', { name: /まちの ちず/ })).not.toBeInTheDocument()
  expect(dialog.querySelector('[role="group"][tabindex="0"]')).toHaveFocus()

  await user.click(screen.getByRole('button', { name: 'よるに する' }))
  expect(scene3d.handle.setNight).toHaveBeenLastCalledWith(true)
  expect(screen.getByRole('button', { name: 'ひるに する' })).toHaveAttribute('aria-pressed', 'true')

  await user.click(screen.getByRole('button', { name: 'ちかづく' }))
  await user.click(screen.getByRole('button', { name: 'はなれる' }))
  await user.click(screen.getByRole('button', { name: 'みぎに まわす' }))
  await user.click(screen.getByRole('button', { name: 'ひだりに まわす' }))
  expect(scene3d.handle.zoom).toHaveBeenNthCalledWith(1, 1)
  expect(scene3d.handle.zoom).toHaveBeenNthCalledWith(2, -1)
  expect(scene3d.handle.turn).toHaveBeenNthCalledWith(1, 1)
  expect(scene3d.handle.turn).toHaveBeenNthCalledWith(2, -1)

  const tour = screen.getByRole('button', { name: 'ぐるっと まわる' })
  expect(tour).toHaveAttribute('aria-pressed', 'true')
  await user.click(tour)
  expect(scene3d.handle.setTour).toHaveBeenLastCalledWith(false)
  expect(tour).toHaveAttribute('aria-pressed', 'false')
  // ゆびで まわすと 3D の ほうから とまったと しらせる。
  await user.click(tour)
  act(() => scene3d.callbacks!.tour(false))
  expect(screen.getByRole('button', { name: 'ぐるっと まわる' })).toHaveAttribute('aria-pressed', 'false')

  expect(screen.getByRole('button', { name: 'でんしゃに のる' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'くるまに のる' }))
  expect(scene3d.handle.ride).toHaveBeenLastCalledWith('car')
  expect(playTownSound).toHaveBeenLastCalledWith('ride')
  expect(screen.getByRole('button', { name: 'つぎの くるまに のる' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.queryByRole('button', { name: 'ちかづく' })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'そらから みる' }))
  expect(scene3d.handle.land).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: 'くるまに のる' })).toHaveAttribute('aria-pressed', 'false')

  act(() => scene3d.callbacks!.pick({ kind: 'part', part: 'road', bridge: true }))
  expect(screen.getByRole('status')).toHaveTextContent('みちの はし')
  act(() => scene3d.callbacks!.pick({ kind: 'vehicle', vehicle: 'car' }))
  expect(screen.getByRole('status')).toHaveTextContent('くるま')

  await user.click(screen.getByRole('button', { name: 'まちづくりに もどる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(scene3d.handle.dispose).toHaveBeenCalledOnce()
  expect(screen.getByRole('button', { name: '3Dで みる' })).toHaveFocus()
  // よるの まま もどり、2D の ちずも よるに なって いる。
  expect(screen.getByRole('button', { name: 'ひるに する' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: '3Dで みる' }))
  await screen.findByRole('dialog', { name: '3Dで みる' })
  expect(createTownScene).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), createTown(), true, expect.anything())
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows the town just built and explains when 3D cannot be shown', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'たのしい ところ' }))
  await user.click(screen.getByRole('button', { name: 'おしろ' }))
  await user.click(tile('3-1 くさはら'))
  scene3d.fail = true
  await user.click(screen.getByRole('button', { name: '3Dで みる' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('3Dで みられなかったよ')
  expect(vi.mocked(createTownScene).mock.lastCall?.[1][2]).toEqual({ ground: 'grass', part: 'castle' })
  expect(screen.queryByRole('button', { name: 'くるまに のる' })).not.toBeInTheDocument()
  const backs = screen.getAllByRole('button', { name: 'まちづくりに もどる' })
  await user.click(backs.at(-1)!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile('3-1 おしろ')).toBeInTheDocument()
})
