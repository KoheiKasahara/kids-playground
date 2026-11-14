import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import { ToolIcon, TileArt, TownPreview } from './PartArt'
import { isBuildingTool, isGroundTool, PARTS, type TilePart } from './parts'
import { createMapTown, createTown, MAPS, type MapId } from './maps'
import { LEGACY_SAVE_KEY, readSlot, slotKey } from './saves'
import { applyTool, CENTER_INDEX, COLS, encodeTown, populationOf } from './town'
import { createWorld } from './worlds'
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
const mapName = (id: MapId) => MAPS.find((map) => map.id === id)!.name
const ROWS_TO_EDGE = 26
/** 1から かぞえた れつ・ぎょうの マス（がめんの なまえと おなじ かぞえかた）。 */
const at = (col: number, row: number) => (row - 1) * COLS + col - 1
const mapTiles = (container: HTMLElement) => [...container.querySelectorAll<HTMLElement>('[data-index]')]

/** ちずを えらぶ がめんから その ちずを ひらく。 */
async function open(user: ReturnType<typeof userEvent.setup>, id: MapId) {
  await user.click(screen.getByRole('button', { name: new RegExp(`^${mapName(id)}`) }))
  expect(screen.getByRole('group', { name: /まちの ちず/ })).toBeInTheDocument()
}

it('is listed in the menu and starts on a map choice with a big card for every map and world', async () => {
  const user = userEvent.setup()
  const entry = GAME_CATALOG.find((game) => game.id === 'town-builder')
  expect(entry).toBeDefined()
  mount()
  expect(screen.getByRole('heading', { name: entry?.title })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: /まちの ちず/ })).not.toBeInTheDocument()
  const list = screen.getByRole('list', { name: 'どの まちで あそぶ？' })
  expect(within(list).getAllByRole('button')).toHaveLength(MAPS.length)
  for (const map of MAPS) expect(within(list).getByRole('button', { name: map.name })).toBeInTheDocument()
  // てがきの ちずも、たねから つくる せかいも ならぶ。
  expect(within(list).getByRole('button', { name: 'うみべの まち' })).toBeInTheDocument()
  expect(within(list).getByRole('button', { name: 'さばくの オアシス' })).toBeInTheDocument()

  await open(user, 'seaside')
  expect(screen.getByRole('heading', { name: /うみべの まち/ })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('view')
  // ひらいたら ひろい ちずの まんなかの マスに フォーカスが ある。
  expect(document.activeElement).toHaveAttribute('data-index', String(CENTER_INDEX))
})

it('opens a world in the village at the middle of the wide map and draws only the tiles around it', async () => {
  const user = userEvent.setup()
  const { container } = mount()
  await open(user, 'world-river')
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

it('places houses, connects them with roads, grows the town, undoes and autosaves per map', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  // まっさらでも さいしょから ちいさな せんろの わを でんしゃが はしる。
  expect(document.querySelectorAll('[data-kind="train"]').length).toBeGreaterThan(0)

  // さいしょは あかい おうちが えらばれて いる。
  expect(screen.getByRole('button', { name: 'あかい おうち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('22-22 くさはら'))
  expect(tile('22-22 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'はらっぱ・0にん' })).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('build')

  await user.click(screen.getByRole('button', { name: 'みちと じめん' }))
  expect(screen.getByRole('button', { name: 'みち' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('22-23 くさはら'))
  expect(tile('22-22 あかい おうち')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: 'むら・4にん' })).toBeInTheDocument()
  // はじめて ひとが すむと「むら」に なった おいわい。
  expect(screen.getByText('むらに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  expect(readSlot('empty')?.[at(22, 22)]).toEqual({ ground: 'grass', part: 'house' })
  expect(readSlot('starter')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('22-22 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(readSlot('empty')?.[at(22, 23)]).toEqual({ ground: 'grass', part: null })
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('22-22 くさはら')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'ひとつ もどす' })).toBeDisabled()
})

it('chooses small, big or extra big buildings, and keeps roads and ground one tile', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  const sizes = screen.getByRole('group', { name: 'おおきさ' })
  expect(within(sizes).getByRole('button', { name: /ちいさい/ })).toHaveAttribute('aria-pressed', 'true')

  await user.click(within(sizes).getByRole('button', { name: /おおきい/ }))
  expect(playTownSound).toHaveBeenLastCalledWith('select')
  expect(screen.getByRole('group', { name: /おおきい あかい おうちを おく/ })).toBeInTheDocument()
  await user.click(tile('22-22 くさはら'))
  for (const name of ['22-22', '23-22', '22-23', '23-23']) expect(screen.getByRole('button', { name: new RegExp(`^${name} おおきい あかい おうち`) })).toBeInTheDocument()
  expect(readSlot('empty')?.[at(23, 23)]).toEqual({ ground: 'grass', part: 'house', anchor: at(22, 22), scale: 2 })

  // とくだいの いえを となりに おくと、かさなる いえは まるごと どく。
  await user.click(within(sizes).getByRole('button', { name: /とくだい/ }))
  await user.click(screen.getByRole('button', { name: /^23-22 おおきい/ }))
  expect(screen.getAllByRole('button', { name: /とくだい あかい おうち/ })).toHaveLength(9)
  expect(screen.queryAllByRole('button', { name: /おおきい あかい おうち/ })).toHaveLength(0)

  // スタジアムは とくだいに できないので、おおきい（4×4）で おく。
  await user.click(screen.getByRole('button', { name: 'たのしい ところ' }))
  await user.click(screen.getByRole('button', { name: 'スタジアム' }))
  expect(within(sizes).getByRole('button', { name: /とくだい/ })).toBeDisabled()
  expect(within(sizes).getByRole('button', { name: /おおきい/ })).toHaveAttribute('aria-pressed', 'true')
  await user.click(tile('20-25 くさはら'))
  expect(screen.getAllByRole('button', { name: /おおきい スタジアム/ })).toHaveLength(16)

  // けすと まるごと きえる。
  await user.click(screen.getByRole('button', { name: 'けす' }))
  expect(within(sizes).getByRole('button', { name: /おおきい/ })).toBeDisabled()
  await user.click(screen.getAllByRole('button', { name: /おおきい スタジアム/ })[5])
  expect(screen.queryAllByRole('button', { name: /おおきい スタジアム/ })).toHaveLength(0)

  // みちや じめんは おおきさを えらべない。
  await user.click(screen.getByRole('button', { name: 'みちと じめん' }))
  expect(within(sizes).getByRole('button', { name: /ちいさい/ })).toBeDisabled()
  await user.click(tile('21-20 くさはら'))
  expect(tile('21-20 みち')).toBeInTheDocument()
  expect(tile('21-21 くさはら')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'すな' }))
  expect(within(sizes).getByRole('button', { name: /ちいさい/ })).toBeDisabled()
})

it('celebrates once each time the town reaches a bigger size', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  mount()
  await open(user, 'empty')
  await user.click(screen.getByRole('button', { name: 'みちと じめん' }))
  await user.click(tile('22-24 くさはら'))
  expect(playTownSound).toHaveBeenLastCalledWith('road')
  await user.click(tile('23-24 くさはら'))
  await user.click(screen.getByRole('button', { name: 'おうち' }))
  await user.click(screen.getByRole('button', { name: 'タワーマンション' }))
  await user.click(tile('22-25 くさはら'))
  expect(screen.getByRole('img', { name: 'まち・30にん' })).toBeInTheDocument()
  expect(screen.getByText('まちに なった！')).toBeInTheDocument()
  expect(playTownSound).toHaveBeenLastCalledWith('grow')
  act(() => { vi.advanceTimersByTime(3000) })
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()

  // いちど とどいた おおきさは、けして また たてても おいわい しない。
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  await user.click(tile('22-25 くさはら'))
  expect(screen.queryByText('まちに なった！')).not.toBeInTheDocument()
  await user.click(tile('23-25 くさはら'))
  expect(screen.getByText('としに なった！')).toBeInTheDocument()
})

it('erases buildings with the bulldozer, builds bridges and crossings, and lays sand and snow', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'world-river')
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
  expect(readSlot('world-river')?.[at(23, 24)]).toEqual({ ground: 'snow', part: 'house-blue' })
  await user.click(screen.getByRole('button', { name: 'しぜん' }))
  await user.click(screen.getByRole('button', { name: 'やしのき' }))
  await user.click(tile('27-27 すな'))
  expect(readSlot('world-river')?.[at(27, 27)]).toEqual({ ground: 'sand', part: 'palm' })
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

it('restarts only this map after confirming, and the restart can be undone', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'starter')
  await user.click(tile('21-21 き'))
  expect(readSlot('starter')?.[at(21, 21)].part).toBe('house')

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  expect(screen.getByRole('dialog', { name: 'はじめの まちを さいしょから つくる？' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'さいしょから' })).toHaveFocus()
  await user.click(screen.getByRole('button', { name: /やめる/ }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile('21-21 あかい おうち・みちが ほしい')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
  await user.click(screen.getByRole('button', { name: 'さいしょから' }))
  expect(tile('21-21 き')).toBeInTheDocument()
  expect(readSlot('starter')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'ひとつ もどす' }))
  expect(tile('21-21 あかい おうち・みちが ほしい')).toBeInTheDocument()
  expect(readSlot('starter')?.[at(21, 21)].part).toBe('house')
})

it('makes a differently shaped world each time a world starts over, and keeps it', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'world-island')
  expect(readSlot('world-island')).toBeNull()
  const worlds = []
  const random = vi.spyOn(Math, 'random')
  for (const seed of [0.25, 0.75]) {
    random.mockReturnValue(seed)
    await user.click(screen.getByRole('button', { name: 'この まちを さいしょから' }))
    expect(screen.getByRole('dialog', { name: 'しまの くにを さいしょから つくる？' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'さいしょから' }))
    worlds.push(readSlot('world-island'))
  }
  random.mockRestore()
  expect(worlds[0]?.filter((item) => item.ground === 'water').length).toBeGreaterThan(COLS * COLS / 2)
  expect(worlds[0]).not.toEqual(worlds[1])
  expect(tile('25-25 みち')).toHaveAttribute('tabindex', '0')
})

it('starts the big city without celebrating its size', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'world-city')
  expect(populationOf(createMapTown('world-city'))).toBeGreaterThanOrEqual(140)
  expect(screen.queryByText(/に なった！/)).not.toBeInTheDocument()
})

it('goes back to the map choice, shows which maps can be continued, and keeps each map apart', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'lake')
  await user.click(tile('20-21 くさはら'))
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
  expect(tile('20-21 あかい おうち・みちが ほしい')).toBeInTheDocument()
})

it('continues an old 14×14 single save as the starter town and ignores broken saves', async () => {
  const user = userEvent.setup()
  const old = Array.from({ length: 14 * 14 }, () => 'g')
  old[3 * 14 + 5] = 'g:castle'
  localStorage.setItem(LEGACY_SAVE_KEY, JSON.stringify({ version: 1, cols: 14, rows: 14, tiles: old }))
  localStorage.setItem(slotKey('city'), '{broken')
  const view = mount()
  expect(localStorage.getItem(LEGACY_SAVE_KEY)).toBeNull()
  expect(screen.getByRole('button', { name: 'ビルの とし' })).toHaveTextContent('あたらしく')
  // まえの ちいさい まちは、ひろい ちずの まんなかに おかれる。
  await open(user, 'starter')
  expect(tile('23-21 おしろ')).toBeInTheDocument()
  view.unmount()

  mount()
  await user.click(screen.getByRole('button', { name: 'ビルの とし' }))
  expect(screen.getByRole('heading', { name: /ビルの とし/ })).toBeInTheDocument()
  expect(readSlot('starter')?.[at(23, 21)]).toEqual({ ground: 'grass', part: 'castle' })
})

it('continues the wide single save from before maps could be chosen as the river world', async () => {
  const user = userEvent.setup()
  const town = applyTool(createWorld('river', 2026), at(27, 27), 'castle')
  localStorage.setItem(LEGACY_SAVE_KEY, encodeTown(town))
  mount()
  expect(screen.getByRole('button', { name: 'かわの まち・つづきから' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'はじめの まち' })).toHaveTextContent('あたらしく')
  await user.click(screen.getByRole('button', { name: 'かわの まち・つづきから' }))
  expect(tile('27-27 おしろ')).toBeInTheDocument()
})

it('opens a map of the whole town and jumps to the touched place', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'world-river')
  expect(screen.queryByRole('button', { name: /^2-3 / })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'ちずを みる' }))
  expect(screen.getByRole('dialog', { name: 'ちず' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'とじる' })).toHaveFocus()
  // ちず ぜんたいを 1マスずつ ぬる。かわの まちには かわ・みち・たてものの いろが ある。
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

it('keeps playing when saving fails and restores sound when leaving', async () => {
  const user = userEvent.setup()
  const view = mount()
  await open(user, 'empty')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(tile('22-22 くさはら'))
  expect(screen.getByRole('status')).toHaveTextContent('ほぞん できなかったよ')
  expect(tile('22-22 あかい おうち・みちが ほしい')).toBeInTheDocument()
  spy.mockRestore()
  await user.click(tile('23-23 くさはら'))
  expect(screen.queryByText('ほぞん できなかったよ')).not.toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'おと' }))
  expect(isSoundEnabled()).toBe(false)
  // ちずを えらぶ がめんに もどっても おとは きえた まま。
  await user.click(screen.getByRole('button', { name: 'ちずを えらぶ' }))
  expect(screen.getByRole('button', { name: 'おと' })).toHaveAttribute('aria-pressed', 'false')
  view.unmount()
  expect(isSoundEnabled()).toBe(true)
})

it('moves around the map with arrow keys, even past the drawn tiles, and places with Enter', async () => {
  const user = userEvent.setup()
  mount()
  await open(user, 'empty')
  expect(tile('25-25 くさはら')).toHaveFocus()
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

it('draws every part as an icon and as a tile, at every size, on every ground, by day and by night', () => {
  const tileParts = PARTS.map((part) => part.id).filter((id): id is Exclude<TilePart, 'crossing'> => !isGroundTool(id))
  const bigParts = tileParts.filter((id) => isBuildingTool(id))
  const { container } = render(<div data-night="true">
    {PARTS.map((part) => <ToolIcon key={part.id} tool={part.id} />)}
    <ToolIcon tool="erase" />
    {tileParts.map((part) => <TileArt key={part} ground="grass" bank="grass" part={part}
      roadMask={0b1010} railMask={0b0101} waterMask={0} checker lit={part !== 'house'} wantsRoad={part === 'house'} pop={1} dust={false} />)}
    {bigParts.map((part) => <TileArt key={`${part}-big`} ground="grass" bank="grass" part={part}
      roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pieceCol={1} pieceRow={1} scale={2} pop={0} dust={false} />)}
    <TileArt ground="water" bank="sand" part="crossing" roadMask={0b0011} railMask={0b1100} waterMask={0b1111} checker={false} lit wantsRoad={false} pop={0} dust />
    <TileArt ground="water" bank="water" part={null} roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pop={0} dust={false} />
    <TileArt ground="sand" bank="sand" part="cactus" roadMask={0} railMask={0} waterMask={0} checker lit wantsRoad={false} pop={0} dust={false} />
    <TileArt ground="snow" bank="snow" part={null} roadMask={0} railMask={0} waterMask={0} checker={false} lit wantsRoad={false} pop={0} dust={false} />
    {MAPS.map((map) => <TownPreview key={map.id} town={createMapTown(map.id)} />)}
  </div>)
  expect(container.querySelectorAll('svg')).toHaveLength(PARTS.length + 1 + tileParts.length + bigParts.length + 4 + MAPS.length)
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
  // 2D で みて いた ばしょ（ちずの まんなか）から ながめはじめる。
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
  await open(user, 'empty')
  await user.click(screen.getByRole('button', { name: 'たのしい ところ' }))
  await user.click(screen.getByRole('button', { name: 'おしろ' }))
  await user.click(tile('22-22 くさはら'))
  scene3d.fail = true
  await user.click(screen.getByRole('button', { name: '3Dで みる' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('3Dで みられなかったよ')
  expect(vi.mocked(createTownScene).mock.lastCall?.[1][at(22, 22)]).toEqual({ ground: 'grass', part: 'castle' })
  expect(screen.queryByRole('button', { name: 'くるまに のる' })).not.toBeInTheDocument()
  const backs = screen.getAllByRole('button', { name: 'まちづくりに もどる' })
  await user.click(backs.at(-1)!)
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(tile('22-22 おしろ')).toBeInTheDocument()
  expect(localStorage.getItem(slotKey('empty'))).toBe(encodeTown(applyTool(createMapTown('empty'), at(22, 22), 'castle')))
})
