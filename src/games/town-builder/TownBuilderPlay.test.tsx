import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import { ToolIcon, TileArt, TownPreview } from './PartArt'
import { isBuildingTool, PARTS } from './parts'
import { createMapTown, createTown, MAPS, type MapId } from './maps'
import { LEGACY_SAVE_KEY, readSlot, slotKey } from './saves'
import { applyTool, COLS, createEmptyTown, encodeTile, encodeTown, ROWS } from './town'
import { playTownSound } from './sounds'
import { createTownScene, type TownSceneCallbacks, type VehicleCounts } from './three/townScene'
import TownBuilderPlay from './TownBuilderPlay'

vi.mock('./sounds', () => ({ playTownSound: vi.fn() }))

// 3D は WebGL を つかうので、がめんの テストでは うごきを まねる ものに かえる。
const scene3d = vi.hoisted(() => ({
  counts: { car: 2, train: 1 } as VehicleCounts,
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
const mapName = (id: MapId) => MAPS.find((map) => map.id === id)!.name

/** ちずを えらぶ がめんから その ちずを ひらく。 */
async function open(user: ReturnType<typeof userEvent.setup>, id: MapId) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${mapName(id)}`) }))
  expect(screen.getByRole('group', { name: /まちの ちず/ })).toBeInTheDocument()
}

it('is listed in the menu and starts on a map choice with a big card for every map', async () => {
  const user = userEvent.setup()
  const entry = GAME_CATALOG.find((game) => game.id === 'town-builder')
  expect(entry).toBeDefined()
  mount()
  expect(screen.getByRole('heading', { name: entry?.title })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /まちの ちず/ })).not.toBeInTheDocument()
  const list = screen.getByRole('list', { name: 'どの まちで あそぶ？' })
  expect(within(list).getAllByRole('button')).toHaveLength(MAPS.length)
  for (const map of MAPS) expect(within(list).getByRole('button', { name: map.name })).toBeInTheDocument()

  await open(user, 'seaside')
  expect(screen.getByRole('heading', { name: /うみべの まち/ })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('view')
  // ひらいたら まんなかの マスに フォーカスが ある。
  expect(document.activeElement).toHaveAttribute('data-index', String(7 * COLS + 7))
  // さいしょから でんしゃが はしって いる。
  expect(document.querySelectorAll('[data-kind="train"]').length).toBeGreaterThan(0)
})

it('places houses, connects them with roads, grows the town, undoes and autosaves per map', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  // まっさらでも さいしょから ちいさな せんろの わを でんしゃが はしる。
  expect(document.querySelectorAll('[data-kind="train"]').length).toBeGreaterThan(0)

  // さいしょは あかい おうちが えらばれて いる。
  expect(screen.getByRole('button', { name: 'あかい おうち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('3-1 くさはら'))
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('build')

  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  expect(screen.getByRole('button', { name: 'みち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('3-2 くさはら'))
  expect(tile('3-1 あかい おうち')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・4にん' })).toBeInTheDocument()
  // はじめて ひとが すむと「むら」に なった おいわい。
  expect(screen.getByText('むらに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  expect(readSlot('empty')?.[2]).toEqual({ ground: 'grass', part: 'house' })
  expect(readSlot('starter')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(readSlot('empty')?.[COLS + 2]).toEqual({ ground: 'grass', part: null })
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('3-1 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ひとつ もどす' })).toBeDisabled()
})

it('chooses small, big or extra big buildings, and keeps roads and rivers one tile', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  const sizes = screen.getByRole('group', { name: 'おおきさ' })
  expect(within(sizes).getByRole('button', { name: /ちいさい/ })).toHaveAttribute('aria-pressed', 'true')

  await user.click(within(sizes).getByRole('button', { name: /おおきい/ }))
  expect(playTownSound).toHaveBeenLastCalledWith('select')
  expect(screen.getByRole('group', { name: /おおきい あかい おうちを おく/ })).toBeInTheDocument()
  await user.click(tile('3-3 くさはら'))
  for (const name of ['3-3', '4-3', '3-4', '4-4']) expect(screen.getByRole('button', { name: new RegExp(`^${name} おおきい あかい おうち`) })).toBeInTheDocument()
  expect(readSlot('empty')?.[3 * COLS + 3]).toEqual({ ground: 'grass', part: 'house', anchor: 2 * COLS + 2, scale: 2 })

  // とくだいの いえを となりに おくと、かさなる いえは まるごと どく。
  await user.click(within(sizes).getByRole('button', { name: /とくだい/ }))
  await user.click(screen.getByRole('button', { name: /^4-3 おおきい/ }))
  expect(screen.getAllByRole('button', { name: /とくだい あかい おうち/ })).toHaveLength(9)
  expect(screen.queryAllByRole('button', { name: /おおきい あかい おうち/ })).toHaveLength(0)

  // スタジアムは とくだいに できないので、おおきい（4×4）で おく。
  await user.click(screen.getByRole('button', { name: 'たのしい ところ' }))
  await user.click(screen.getByRole('button', { name: 'スタジアム' }))
  expect(within(sizes).getByRole('button', { name: /とくだい/ })).toBeDisabled()
  expect(within(sizes).getByRole('button', { name: /おおきい/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('1-10 くさはら'))
  expect(screen.getAllByRole('button', { name: /おおきい スタジアム/ })).toHaveLength(16)

  // けすと まるごと きえる。
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(within(sizes).getByRole('button', { name: /おおきい/ })).toBeDisabled()
  await user.click(screen.getAllByRole('button', { name: /おおきい スタジアム/ })[5])
  expect(screen.queryAllByRole('button', { name: /おおきい スタジアム/ })).toHaveLength(0)

  // みちは おおきさを えらべない。
  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  expect(within(sizes).getByRole('button', { name: /ちいさい/ })).toBeDisabled()
  await user.click(tile('1-1 くさはら'))
  expect(tile('1-1 みち')).toBeInTheDocument()
  expect(tile('1-2 くさはら')).toBeInTheDocument()
})

it('celebrates once each time the town reaches a bigger size', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mount()
  await open(user, 'empty')
  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  await user.click(tile('6-8 くさはら'))
  expect(playTownSound).toHaveBeenLastCalledWith('road')
  await user.click(tile('7-8 くさはら'))
  await user.click(screen.getByRole('button', { name: 'おうち' }))
  await user.click(screen.getByRole('button', { name: 'タワーマンション' }))
  await user.click(tile('6-9 くさはら'))
  expect(screen.getByRole('img', { name: 'まち・30にん' })).toBeInTheDocument()
  expect(screen.getByText('まちに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()

  // いちど とどいた おおきさは、けして また たてても おいわい しない。
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  await user.click(tile('6-9 くさはら'))
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()
  await user.click(tile('7-9 くさはら'))
  expect(screen.getByText('としに なった！')).toBeInTheDocument()
})

it('erases buildings with the bulldozer and builds bridges and crossings', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'starter')
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(screen.getByRole('button', { name: 'けす' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('5-3 あかい おうち'))
  expect(tile('5-3 くさはら')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('erase')
  // なにも ない ところを けしても かわらない。
  vi.mocked(playTownSound).mockClear()
  await user.click(tile('5-3 くさはら'))
  expect(playTownSound).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'みちと かわ' }))
  await user.click(screen.getByRole('button', { name: 'かわ' }))
  await user.click(tile('5-8 みち'))
  expect(tile('5-8 みちの はし')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'せんろ' }))
  await user.click(tile('8-8 みち'))
  expect(tile('8-8 ふみきり')).toBeInTheDocument()
})

it('switches between day and night and limits zooming in and out', async () => {
  const user = userEvent.setup()
  const { container } = mount()
  await open(user, 'island')
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

it('restarts only this map after confirming, and the restart can be undone', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'starter')
  await user.click(tile('1-1 き'))
  expect(readSlot('starter')?.[0].part).toBe('house')

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  expect(screen.getByRole('dialog', { name: 'はじめの まちを さいしょから つくる？' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'さいしょから' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: /やめる/ }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile('1-1 あかい おうち・みちが ほしい')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  await user.click(screen.getByRole('button', { name: 'さいしょから' }))
  expect(tile('1-1 き')).toBeInTheDocument()
  expect(readSlot('starter')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('1-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(readSlot('starter')?.[0].part).toBe('house')
})

it('goes back to the map choice, shows which maps can be continued, and keeps each map apart', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'lake')
  await user.click(tile('2-3 くさはら'))
  await user.click(screen.getByRole('button', { name: 'ちずを えらぶ' }))
  expect(playTownSound).toHaveBeenLastCalledWith('select')
  expect(screen.queryByRole('group', { name: /まちの ちず/ })).not.toBeInTheDocument()
  const card = screen.getByRole('button', { name: 'やまと みずうみ・つづきから' })
  expect(card).toHaveFocus()
  expect(card).toHaveTextContent('つづきから')
  expect(screen.getByRole('button', { name: 'ゆうえんち' })).toHaveTextContent('あたらしく')

  await user.click(screen.getByRole('button', { name: 'ゆうえんち' }))
  expect(screen.queryByRole('button', { name: /あかい おうち・みちが ほしい/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ちずを えらぶ' }))
  await user.click(screen.getByRole('button', { name: 'やまと みずうみ・つづきから' }))
  expect(tile('2-3 あかい おうち・みちが ほしい')).toBeInTheDocument()
})

it('continues the old single save as the starter town and ignores broken saves', async () => {
  const user = userEvent.setup()
  const old = applyTool(createEmptyTown(), 2, 'castle')
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ version: 1, cols: COLS, rows: ROWS, tiles: old.map(encodeTile) }))
  localStorage.setItem(slotKey('city'), '{broken')
  const view = mount()
  expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  expect(screen.getByRole('button', { name: 'おおきな とし' })).toHaveTextContent('あたらしく')
  await open(user, 'starter')
  expect(tile('3-1 おしろ')).toBeInTheDocument()
  view.unmount()

  mount()
  await user.click(screen.getByRole('button', { name: 'おおきな とし' }))
  expect(screen.getByRole('heading', { name: /おおきな とし/ })).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /^\d+-\d+ / })).toHaveLength(COLS * ROWS)
  expect(readSlot('starter')?.[2]).toEqual({ ground: 'grass', part: 'castle' })
})

it('keeps playing when saving fails and restores sound when leaving', async () => {
  const user = userEvent.setup()
  const view = mount()
  await open(user, 'empty')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(tile('3-1 くさはら'))
  expect(screen.getByRole('status')).toHaveTextContent('ほぞん できなかったよ')
  expect(tile('3-1 あかい おうち・みちが ほしい')).toBeInTheDocument()
  spy.mockRestore()
  await user.click(tile('4-1 くさはら'))
  expect(screen.queryByText('ほぞん できなかったよ')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'おと' }))
  expect(isSoundEnabled()).toBe(false)
  // ちずを えらぶ がめんに もどっても おとは きえた まま。
  await user.click(screen.getByRole('button', { name: 'ちずを えらぶ' }))
  expect(screen.getByRole('button', { name: 'おと' })).toHaveAttribute('aria-pressed', 'false')
  view.unmount()
  expect(isSoundEnabled()).toBe(true)
})

it('moves around the map with arrow keys and places with Enter', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  expect(tile('8-8 くさはら')).toHaveFocus()
  await user.keyboard('{ArrowUp}{ArrowUp}{ArrowLeft}')
  expect(tile('7-6 くさはら')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(tile('7-6 あかい おうち・みちが ほしい')).toHaveFocus()
  await user.keyboard('{ArrowUp}'.repeat(10))
  expect(tile('7-1 くさはら')).toHaveFocus()
})

it('draws every part as an icon and as a tile, at every size, by day and by night', () => {
  const buildings = PARTS.filter((part) => part.id !== 'water')
  const { container } = render(<div data-night="true">
    {PARTS.map((part) => <ToolIcon key={part.id} tool={part.id} />)}
    <ToolIcon tool="erase" />
    {buildings.map((part) => <TileArt key={part.id} ground="grass" part={part.id as Exclude<typeof part.id, 'water'>}
      roadMask={0b1010} railMask={0b0101} waterMask={0} checker lit={part.id !== 'house'} wantsRoad={part.id === 'house'} pop={1} dust={false} />)}
    {buildings.filter((part) => isBuildingTool(part.id)).map((part) => <TileArt key={`${part.id}-big`} ground="grass" part={part.id as Exclude<typeof part.id, 'water'>}
      roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pieceCol={1} pieceRow={1} scale={2} pop={0} dust={false} />)}
    <TileArt ground="water" part="crossing" roadMask={0b0011} railMask={0b1100} waterMask={0b1111} checker={false} lit wantsRoad={false} pop={0} dust />
    {MAPS.map((map) => <TownPreview key={map.id} town={createMapTown(map.id)} />)}
  </div>)
  const bigCount = buildings.filter((part) => isBuildingTool(part.id)).length
  expect(container.querySelectorAll('svg')).toHaveLength(PARTS.length + 1 + buildings.length + bigCount + 1 + MAPS.length)
  expect(container.querySelector('[transform="translate(-100 -100) scale(2)"]')).not.toBeNull()
  expect(container.querySelector('[data-lit="false"]')).not.toBeNull()
  expect(container.querySelectorAll('[data-lit="true"]').length).toBeGreaterThan(10)
})

it('opens the finished town in 3D, rides a car, and comes back to building', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'starter')
  const openButton = screen.getByRole('button', { name: '3Dで みる' })
  await user.click(openButton)
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

  await user.click(screen.getByRole('button', { name: 'でんしゃに のる' }))
  expect(scene3d.handle.ride).toHaveBeenLastCalledWith('train')
  expect(playTownSound).toHaveBeenLastCalledWith('ride')
  expect(screen.getByRole('button', { name: 'つぎの でんしゃに のる' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'くるまに のる' }))
  expect(scene3d.handle.ride).toHaveBeenLastCalledWith('car')
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
  await open(user, 'empty')
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
  expect(JSON.parse(localStorage.getItem(slotKey('empty'))!).tiles[2]).toBe('g:castle')
  expect(localStorage.getItem(slotKey('empty'))).toBe(encodeTown(applyTool(createMapTown('empty'), 2, 'castle')))
})
