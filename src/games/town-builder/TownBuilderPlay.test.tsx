import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import { ToolIcon, TileArt } from './PartArt'
import { isGroundTool, PARTS, type TilePart } from './parts'
import { playTownSound } from './sounds'
import { applyTool, CENTER_INDEX, COLS, createEmptyTown, decodeTown, encodeTown, populationOf, SAVE_KEY } from './town'
import { createTown, WORLDS } from './worlds'
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

// jsdom は canvas に かけないので、ちずに かいた いろを おぼえる にせものを わたす。
const painted: string[] = []
const fakeContext = { fillStyle: '', fillRect() { painted.push(this.fillStyle) } }

beforeEach(() => {
  painted.length = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext as unknown as CanvasRenderingContext2D)
  localStorage.clear()
  vi.mocked(playTownSound).mockClear()
  vi.mocked(createTownScene).mockClear()
  scene3d.fail = false
  for (const key of Object.keys(scene3d.handle)) scene3d.handle[key] = vi.fn(key === 'ride' ? () => true : () => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function mount() {
  return render(<MemoryRouter><TownBuilderPlay /></MemoryRouter>)
}

const tile = (name: string) => screen.getByRole('button', { name })
const ROWS_TO_EDGE = 26
const savedTown = () => decodeTown(localStorage.getItem(SAVE_KEY))
/** 1から かぞえた れつ・ぎょうの マス（がめんの なまえと おなじ かぞえかた）。 */
const at = (col: number, row: number) => (row - 1) * COLS + col - 1
const mapTiles = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-index]')]

it('is listed in the menu and shows its title on the play screen', () => {
  const entry = GAME_CATALOG.find((game) => game.id === 'town-builder')
  expect(entry).toBeDefined()
  mount()
  expect(screen.getByRole('heading', { name: entry?.title })).toBeInTheDocument()
  expect(screen.getByRole('group', { name: /まちの ちず/ })).toBeInTheDocument()
})

it('starts in the village at the middle of the wide map and draws only the tiles around it', () => {
  const { container } = mount()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()
  expect(tile('25-25 みち')).toHaveAttribute('tabindex', '0')
  expect(tile('21-24 あかい おうち')).toBeInTheDocument()
  expect(tile('23-24 あおい おうち')).toBeInTheDocument()
  // ひろい ちずの うち、みえて いる あたり だけを えがく（うごきを かるく する）。
  const drawn = mapTiles(container)
  expect(drawn.length).toBeGreaterThan(100)
  expect(drawn.length).toBeLessThan(COLS * COLS / 8)
  expect(screen.queryByRole('button', { name: /^1-1 / })).not.toBeInTheDocument()
  expect(tile('25-25 みち').style.gridColumn).toBe('25')
  expect(tile('25-25 みち').style.gridRow).toBe('25')
})

it('places houses, connects them with roads, grows the town, undoes and autosaves', async () => {
  const user = userEvent.setup()
  mount()

  // さいしょは あかい おうちが えらばれて いる。
  expect(screen.getByRole('button', { name: 'あかい おうち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('27-27 くさはら'))
  expect(tile('27-27 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('build')

  await user.click(screen.getByRole('button', { name: 'みちと じめん' }))
  expect(screen.getByRole('button', { name: 'みち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('27-26 くさはら'))
  expect(tile('27-27 あかい おうち')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・12にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('road')
  expect(savedTown()?.[at(27, 27)]).toEqual({ ground: 'grass', part: 'house' })

  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('27-27 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(savedTown()?.[at(27, 26)]).toEqual({ ground: 'grass', part: null })
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('27-27 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ひとつ もどす' })).toBeDisabled()
})

it('celebrates once each time the town reaches a bigger size', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mount()
  await user.click(screen.getByRole('button', { name: 'タワーマンション' }))
  await user.click(tile('27-26 くさはら'))
  expect(screen.getByRole('img', { name: 'まち・38にん' })).toBeInTheDocument()
  expect(screen.getByText('まちに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()

  // いちど とどいた おおきさは、けして また たてても おいわい しない。
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  await user.click(tile('27-26 くさはら'))
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()
  await user.click(tile('29-26 くさはら'))
  expect(screen.getByText('としに なった！')).toBeInTheDocument()
})

it('erases buildings with the bulldozer, builds bridges and crossings, and lays sand and snow', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(screen.getByRole('button', { name: 'けす' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('21-24 あかい おうち'))
  expect(tile('21-24 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・4にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('erase')
  // なにも ない ところを けしても かわらない。
  vi.mocked(playTownSound).mockClear()
  await user.click(tile('21-24 くさはら'))
  expect(playTownSound).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'みちと じめん' }))
  await user.click(screen.getByRole('button', { name: 'みず' }))
  await user.click(tile('27-25 みち'))
  expect(tile('27-25 みちの はし')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('water')
  await user.click(screen.getByRole('button', { name: 'せんろ' }))
  await user.click(tile('29-25 みち'))
  expect(tile('29-25 ふみきり')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'すな' }))
  await user.click(tile('27-27 くさはら'))
  expect(tile('27-27 すな')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ゆき' }))
  await user.click(tile('23-24 あおい おうち'))
  expect(savedTown()?.[at(23, 24)]).toEqual({ ground: 'snow', part: 'house-blue' })
  await user.click(screen.getByRole('button', { name: 'しぜん' }))
  await user.click(screen.getByRole('button', { name: 'やしのき' }))
  await user.click(tile('27-27 すな'))
  expect(savedTown()?.[at(27, 27)]).toEqual({ ground: 'sand', part: 'palm' })
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
  const before = mapTiles(container).length
  for (let step = 0; step < 6; step += 1) if (!zoomIn.hasAttribute('disabled')) await user.click(zoomIn)
  expect(zoomIn).toBeDisabled()
  expect(mapTiles(container).length).toBeLessThan(before)
  for (let step = 0; step < 6; step += 1) if (!zoomOut.hasAttribute('disabled')) await user.click(zoomOut)
  expect(zoomOut).toBeDisabled()
  expect(zoomIn).toBeEnabled()
  // いちばん ちいさく みても、えがくのは ちずの いちぶ だけ。
  expect(mapTiles(container).length).toBeGreaterThan(before)
  expect(mapTiles(container).length).toBeLessThan(COLS * COLS / 2)
  expect(tile('25-25 みち')).toBeInTheDocument()
})

it('starts a new world only after choosing one, and the change can be undone', async () => {
  const user = userEvent.setup()
  const { container } = mount()
  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  const dialog = screen.getByRole('dialog', { name: 'どの せかいで つくる？' })
  for (const world of WORLDS) expect(dialog).toHaveTextContent(world.label)
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  expect(screen.getByRole('button', { name: /かわの まち/ })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  await user.click(screen.getByRole('button', { name: /まっさら/ }))
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  expect(mapTiles(container).every((button) => button.getAttribute('aria-label')?.endsWith('くさはら'))).toBe(true)
  expect(savedTown()).toEqual(createEmptyTown())
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(screen.getByRole('img', { name: 'むら・8にん' })).toBeInTheDocument()

  // えらぶ たびに かたちの ちがう せかいが できる。
  const random = vi.spyOn(Math, 'random')
  const worlds = []
  for (const seed of [0.25, 0.75]) {
    random.mockReturnValue(seed)
    await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
    await user.click(screen.getByRole('button', { name: /しまの くに/ }))
    worlds.push(savedTown())
  }
  random.mockRestore()
  expect(worlds[0]?.filter((item) => item.ground === 'water').length).toBeGreaterThan(COLS * COLS / 2)
  expect(worlds[0]).not.toEqual(worlds[1])
  expect(tile('25-25 みち')).toHaveAttribute('tabindex', '0')
})

it('starts a big city without celebrating, then celebrates the next size reached there', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'あたらしい まちに する' }))
  await user.click(screen.getByRole('button', { name: /おおきな まち/ }))
  expect(populationOf(savedTown()!)).toBeGreaterThanOrEqual(140)
  expect(screen.queryByText(/に なった！/)).not.toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('erase')
})

it('opens a map of the whole town and jumps to the touched place', async () => {
  const user = userEvent.setup()
  mount()
  expect(screen.queryByRole('button', { name: /^2-3 / })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ちずを みる' }))
  expect(screen.getByRole('dialog', { name: 'ちず' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'とじる' })).toHaveFocus()
  // ちず ぜんたいを 1マスずつ ぬる。はじめの まちには かわ・みち・たてものの いろが ある。
  expect(painted).toHaveLength(COLS * COLS)
  expect(new Set(painted).size).toBeGreaterThan(5)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'ちずを みる' }))
  const map = screen.getByRole('button', { name: 'ちずを タッチして いどう する' })
  map.getBoundingClientRect = () => ({ left: 10, top: 20, width: 480, height: 480, x: 10, y: 20, right: 490, bottom: 500, toJSON() {} })
  // ひだりうえの 2れつめ・3ぎょうめ あたりを タッチ。
  fireEvent.click(map, { clientX: 10 + 15, clientY: 20 + 25, detail: 1 })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('view')
  expect(screen.getByRole('button', { name: /^2-3 / })).toHaveAttribute('tabindex', '0')
  expect(screen.queryByRole('button', { name: '25-25 みち' })).not.toBeInTheDocument()

  // キーボードで おした ときは まんなかへ もどる。
  await user.click(screen.getByRole('button', { name: 'ちずを みる' }))
  fireEvent.click(screen.getByRole('button', { name: 'ちずを タッチして いどう する' }), { detail: 0 })
  expect(tile('25-25 みち')).toHaveAttribute('tabindex', '0')
})

it('resumes the saved town after leaving, keeps an old small town, and ignores broken saves', async () => {
  const town = applyTool(createTown(), at(27, 27), 'castle')
  localStorage.setItem(SAVE_KEY, encodeTown(town))
  const view = mount()
  expect(tile('27-27 おしろ')).toBeInTheDocument()
  view.unmount()

  // まえの ちいさい ちず（14×14）の まちは、ひろい ちずの まんなかに おかれる。
  const old = Array.from({ length: 14 * 14 }, () => 'g')
  old[7 * 14 + 7] = 'g:ferris'
  localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 1, cols: 14, rows: 14, tiles: old }))
  const legacy = mount()
  expect(tile('25-25 かんらんしゃ・みちが ほしい')).toBeInTheDocument()
  legacy.unmount()

  localStorage.setItem(SAVE_KEY, '{broken')
  mount()
  expect(tile('27-27 くさはら')).toBeInTheDocument()
})

it('keeps playing when saving fails and restores sound when leaving', async () => {
  const user = userEvent.setup()
  const view = mount()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(tile('27-27 くさはら'))
  expect(screen.getByRole('status')).toHaveTextContent('ほぞん できなかったよ')
  expect(tile('27-27 あかい おうち・みちが ほしい')).toBeInTheDocument()
  spy.mockRestore()
  await user.click(tile('28-28 くさはら'))
  expect(screen.queryByText('ほぞん できなかったよ')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'おと' }))
  expect(isSoundEnabled()).toBe(false)
  view.unmount()
  expect(isSoundEnabled()).toBe(true)
})

it('moves around the map with arrow keys, even past the drawn tiles, and places with Enter', async () => {
  const user = userEvent.setup()
  mount()
  const start = screen.getAllByRole('button').find((button) => button.getAttribute('tabindex') === '0' && button.dataset.index)
  expect(start).toHaveAccessibleName('25-25 みち')
  start!.focus()
  await user.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}')
  expect(tile('26-27 くさはら')).toHaveFocus()
  await user.keyboard('{Enter}')
  expect(tile('26-27 あかい おうち・みちが ほしい')).toHaveFocus()
  // えがいて いない とおくの マスへも すすめる。ちずの はしで とまる。
  await user.keyboard('{ArrowUp}'.repeat(ROWS_TO_EDGE))
  expect(screen.getByRole('button', { name: /^26-1 / })).toHaveFocus()
  await user.keyboard('{ArrowUp}')
  expect(screen.getByRole('button', { name: /^26-1 / })).toHaveFocus()
})

it('draws every part as an icon and as a tile, by day and by night', () => {
  const tileParts = PARTS.map((part) => part.id).filter((id): id is Exclude<TilePart, 'crossing'> => !isGroundTool(id))
  const { container } = render(<div data-night="true">
    {PARTS.map((part) => <ToolIcon key={part.id} tool={part.id} />)}
    <ToolIcon tool="erase" />
    {tileParts.map((part) => <TileArt key={part} ground="grass" bank="grass" part={part}
      roadMask={0b1010} railMask={0b0101} waterMask={0} checker lit={part !== 'house'} wantsRoad={part === 'house'} pop={1} dust={false} />)}
    <TileArt ground="water" bank="sand" part="crossing" roadMask={0b0011} railMask={0b1100} waterMask={0b1111} checker={false} lit wantsRoad={false} pop={0} dust />
    <TileArt ground="water" bank="water" part={null} roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pop={0} dust={false} />
    <TileArt ground="sand" bank="sand" part="cactus" roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pop={0} dust={false} />
    <TileArt ground="snow" bank="snow" part={null} roadMask={0} railMask={0} waterMask={0} checker={false} lit wantsRoad={false} pop={0} dust={false} />
  </div>)
  expect(container.querySelectorAll('svg')).toHaveLength(PARTS.length + 1 + tileParts.length + 4)
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
  // 2D で みて いた ばしょ（まんなかの むら）から ながめはじめる。
  expect(createTownScene).toHaveBeenCalledWith(expect.any(HTMLDivElement), createTown(), false, expect.anything(), CENTER_INDEX)
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
  act(() => scene3d.callbacks!.pick({ kind: 'ground', ground: 'sand' }))
  expect(screen.getByRole('status')).toHaveTextContent('すな')
  act(() => scene3d.callbacks!.pick({ kind: 'ground', ground: 'grass' }))
  expect(screen.getByRole('status')).toHaveTextContent('くさはら')
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
  expect(createTownScene).toHaveBeenLastCalledWith(expect.any(HTMLDivElement), createTown(), true, expect.anything(), CENTER_INDEX)
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('shows the town just built and explains when 3D cannot be shown', async () => {
  const user = userEvent.setup()
  mount()
  await user.click(screen.getByRole('button', { name: 'たのしい ところ' }))
  await user.click(screen.getByRole('button', { name: 'おしろ' }))
  await user.click(tile('27-27 くさはら'))
  scene3d.fail = true
  await user.click(screen.getByRole('button', { name: '3Dで みる' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('3Dで みられなかったよ')
  expect(vi.mocked(createTownScene).mock.lastCall?.[1][at(27, 27)]).toEqual({ ground: 'grass', part: 'castle' })
  expect(screen.queryByRole('button', { name: 'くるまに のる' })).not.toBeInTheDocument()
  const backs = screen.getAllByRole('button', { name: 'まちづくりに もどる' })
  await user.click(backs.at(-1)!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile('27-27 おしろ')).toBeInTheDocument()
})
