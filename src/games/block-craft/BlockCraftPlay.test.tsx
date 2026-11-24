import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { isSoundEnabled } from '../../audio/sound'
import { GAME_CATALOG } from '../gameCatalog'
import BlockCraftPlay, { FUSE_MS, SLEEP_MS } from './BlockCraftPlay'
import { ANIMAL_SPAWNS, herdFrom, MAX_HERD, spawnHerd, type Animal, type Cell, type Herd } from './animals'
import { biome, BIOMES } from './biomes'
import { CRAFTED_KEY, readGame, WOOL_KEY, writeGame } from './save'
import { CRAFTED } from './recipes'
import { NEW_WORLD } from './terrain'
import type { CraftSceneOptions, SceneApi } from './useCraftScene'
import { noteStep, playCraftSound, playNote } from './sounds'
import { decodeGame, SAVE_KEY } from './save'
import { blockAt, createWorld, DEFAULT_WORLD, editWorld, PALETTE, startWalker, TREASURES, type Position, type World } from './world'

const scene = vi.hoisted(() => ({ options: null as unknown as CraftSceneOptions, api: { current: null as SceneApi | null } }))
vi.mock('./useCraftScene', () => ({ useCraftScene: (options: CraftSceneOptions) => { scene.options = options; return { setContainer: () => {}, failed: false, api: scene.api } } }))
vi.mock('./sounds', async importOriginal => ({ ...await importOriginal<typeof import('./sounds')>(), playCraftSound: vi.fn(), playNote: vi.fn() }))
// jsdom は canvas に かけない。ちずの しるしは DOM で たしかめる。
beforeAll(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })
beforeEach(() => { localStorage.clear(); scene.api.current = null; vi.mocked(playCraftSound).mockClear(); vi.mocked(playNote).mockClear() })
const world = (): World => scene.options.world
const blocks = () => [...world().blocks()]
function mount() { return render(<MemoryRouter><BlockCraftPlay /></MemoryRouter>) }
/** こまかい そうさは、ばしょの きまった ちいさな くさはらの つづきから たしかめる。 */
async function start(world = createWorld(), herd: Herd = herdFrom(ANIMAL_SPAWNS)) {
  const user = userEvent.setup()
  writeGame({ world, biome: 'meadow', wheat: 0, herd, seed: 0 })
  mount()
  await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
  return user
}
/** あたらしい ひろい せかいを はじめる。 */
async function startNew(name = 'くさはら') {
  const user = userEvent.setup()
  const view = mount()
  await user.click(screen.getByRole('button', { name }))
  return { user, view }
}
const api = (): SceneApi => ({ heading: () => ({ x: 1, z: 0 }), turn: vi.fn(), actAtCenter: vi.fn(), focus: vi.fn(), burst: vi.fn(), fireworks: vi.fn() })
const tap = (position: Position, normal: Position = { x: 0, y: 1, z: 0 }) => act(() => scene.options.onPick(position, normal))

it('shows only the essential controls', async () => {
  await start()
  expect(screen.getByRole('button', { name: 'おと' })).toHaveTextContent(/^🔊$/)
  expect(screen.queryByRole('status')).not.toBeInTheDocument()
  expect(screen.queryByText(/ドラッグで まわす/)).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'ちかづく' })).not.toBeInTheDocument()
  expect(screen.queryByText(/ボタンで ばしょを えらぶ/)).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'よる' })).toHaveTextContent(/^☀️$/)
  // ヘッダー（もどる・よる・おと）、ちず・あるく、おく・こわす・ぬる・ひろく・もどす、ざいりょう、ほぞん・はじめの せかい
  expect(screen.getAllByRole('button')).toHaveLength(3 + 2 + 5 + PALETTE.length + 2)
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
  expect(blockAt(world(), { x: 8, y: 3, z: 8 })?.material).toBe('diamond')
})

it('is listed in the menu', () => { expect(GAME_CATALOG.some((game) => game.id === 'block-craft')).toBe(true) })

it('starts, places and mines blocks, undoes, saves and resumes after re-entry', async () => {
  const user = userEvent.setup()
  const view = mount()
  await user.click(screen.getByRole('button', { name: 'くさはら' }))
  const initialCount = blocks().length
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(blocks()).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: '🧱 おく' }))
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(blocks()).toHaveLength(initialCount)
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blocks()).toHaveLength(initialCount + 1)
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect([...decodeGame(localStorage.getItem(SAVE_KEY))!.world.blocks()]).toEqual(blocks())
  await user.click(screen.getByRole('button', { name: /おと/ }))
  expect(isSoundEnabled()).toBe(false)
  await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
  expect(isSoundEnabled()).toBe(true)
  view.unmount()
  mount()
  await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
  expect(blocks()).toHaveLength(initialCount + 1)
})

it('supports material selection, keyboard cursor, reset cancellation and undoing reset', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  expect(blockAt(world(), { x: 9, y: 3, z: 8 })).toEqual({ x: 9, y: 3, z: 8, material: 'brick' })
  const built = blocks()
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'やめる' }))
  expect(blocks()).toEqual(built)
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'もどして あそぶ' }))
  // ほぞんした seed から、おなじ おおきさの はじめの せかいに もどる
  expect(blocks()).toEqual([...biome('meadow').create(DEFAULT_WORLD, 0).blocks()])
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blocks()).toEqual(built)
})

it('handles invalid saves and reports storage failure without losing play state', async () => {
  localStorage.setItem(SAVE_KEY, '{broken')
  const user = userEvent.setup()
  mount()
  expect(screen.queryByRole('button', { name: /つづきから/ })).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'くさはら' }))
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
  const built = blocks()
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(blocks()).toEqual(built)
  spy.mockRestore()
})

it('places and mines a 3×3 area at once when ひろく is on, and undoes it in one step', async () => {
  const user = await start()
  const initial = blocks()
  await user.click(screen.getByRole('button', { name: 'いし' }))
  await user.click(screen.getByRole('button', { name: '🔲 ひろく' }))
  expect(screen.getByRole('button', { name: '🔲 ひろく' })).toHaveAttribute('aria-pressed', 'true')
  tap({ x: 8, y: 2, z: 8 })
  expect(blocks().filter(b => b.y === 3 && b.material === 'stone')).toHaveLength(9)
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  tap({ x: 8, y: 3, z: 8 })
  expect(blocks().filter(b => b.y === 3 && b.material === 'stone')).toHaveLength(0)
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blocks()).toEqual(initial)
})

it('grows a sapling into a tree when it is tapped', async () => {
  await start()
  const sapling = blocks().find(b => b.material === 'sapling')!
  tap(sapling)
  expect(blocks().some(b => b.material === 'sapling')).toBe(false)
  expect(blocks().filter(b => b.x === sapling.x && b.z === sapling.z && b.material === 'wood')).toHaveLength(3)
  expect(playCraftSound).toHaveBeenLastCalledWith('grow')
})

it('copies a material with a long press, using either touch or Shift+Enter', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  act(() => scene.options.onHold?.(blocks().find(b => b.material === 'pumpkin')!))
  expect(screen.getByRole('button', { name: 'かぼちゃ' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '🧱 おく' })).toHaveAttribute('aria-pressed', 'true')
  const before = blocks()
  fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter', shiftKey: true })
  expect(blocks()).toEqual(before)
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
  scene.api.current = { ...api(), actAtCenter }
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

const herd = () => scene.options.herd!
const touch = (animal: Animal, cell: Cell = animal) => act(() => scene.options.onAnimal?.(animal, cell))
const wheatCount = (n: number) => screen.getByLabelText(`もっている こむぎ ${n}こ`)
/** はたけに たねを うえて、3かい タッチして こむぎを とる。 */
async function harvest(user: ReturnType<typeof userEvent.setup>, times = 1) {
  await user.click(screen.getByRole('button', { name: 'たね' }))
  tap({ x: 8, y: 2, z: 8 })
  const seed = { x: 8, y: 3, z: 8 }
  expect(blockAt(world(), { x: 8, y: 2, z: 8 })?.material).toBe('farmland')
  for (let i = 0; i < times * 3; i++) tap(seed)
}

it('makes an animal hop with a sound when it is tapped without wheat', async () => {
  await start()
  const before = herd()
  touch(before[0])
  expect(playCraftSound).toHaveBeenLastCalledWith('pet')
  expect(herd()).toBe(before)
  expect(screen.getByRole('button', { name: '↩ もどす' })).toBeDisabled()
})

it('starts a wide new world in each land with its own sky and animals, and resumes it after saving', async () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.3)
  try {
    const { user, view } = await startNew('さばく')
    const seed = Math.floor(0.3 * 1_000_000)
    const desert = biome('desert').create(NEW_WORLD, seed)
    expect(world()).toMatchObject(NEW_WORLD)
    expect(blocks()).toHaveLength([...desert.blocks()].length)
    expect(scene.options.sky).toBe(biome('desert').sky)
    expect(herd()).toEqual(spawnHerd(desert, biome('desert').animals, seed))
    expect(scene.options.cursor).toEqual({ x: 48, y: 0, z: 48 })
    fireEvent.keyDown(screen.getByRole('application'), { key: 'Enter' })
    const built = blocks().length
    expect(built).toBe([...desert.blocks()].length + 1)
    await user.click(screen.getByRole('button', { name: /ほぞん/ }))
    view.unmount()
    mount()
    await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
    expect(scene.options.sky).toBe(biome('desert').sky)
    expect(blocks()).toHaveLength(built)
    await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
    await user.click(screen.getByRole('button', { name: 'もどして あそぶ' }))
    expect(blocks()).toHaveLength(built - 1)
    expect(readGame()?.seed).toBe(seed)
  } finally { vi.mocked(Math.random).mockRestore() }
})

it('offers every land on the title', () => {
  mount()
  const lands = screen.getByRole('group', { name: 'あたらしい せかいを えらぶ' })
  expect(BIOMES.length).toBeGreaterThanOrEqual(10)
  for (const land of BIOMES) expect(lands).toContainElement(screen.getByRole('button', { name: land.label }))
})

it('shows a treasure map and jumps to the touched place, by camera or on foot', async () => {
  const { user } = await startNew()
  scene.api.current = api()
  const treasures = world().treasures.length
  const map = screen.getByRole('button', { name: 'ちず' })
  expect(map.querySelectorAll('[data-treasure]')).toHaveLength(treasures)
  const markerLeft = map.querySelector<HTMLElement>('[data-here]')!.style.left
  expect(markerLeft).toMatch(/^\d+(?:\.\d+)?%$/)
  expect(Number.parseFloat(markerLeft)).toBeCloseTo(48.5 / 96 * 100, 3)
  await user.click(map)
  const big = screen.getByRole('button', { name: 'ちずの ばしょへ いく' })
  vi.spyOn(big.querySelector('canvas')!, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, width: 192, height: 192 } as DOMRect)
  // ちずの (10, 80) の ますを タッチ
  fireEvent.click(big, { clientX: 100 + 21, clientY: 50 + 161, detail: 1 })
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(scene.options.cursor).toEqual({ x: 10, y: 0, z: 80 })
  expect(scene.api.current.focus).toHaveBeenLastCalledWith(10, 80)
  const markerTop = screen.getByRole('button', { name: 'ちず' }).querySelector<HTMLElement>('[data-here]')!.style.top
  expect(markerTop).toMatch(/^\d+(?:\.\d+)?%$/)
  expect(Number.parseFloat(markerTop)).toBeCloseTo(80.5 / 96 * 100, 3)
  // やじるしで うごかすと カメラも ついてくる
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowRight' })
  expect(scene.api.current.focus).toHaveBeenLastCalledWith(11, 80)
  // あるいている ときは その ばしょの じめんへ とぶ
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(scene.options.walker).toEqual(startWalker(world(), 11, 80))
  await user.click(screen.getByRole('button', { name: 'ちず' }))
  const again = screen.getByRole('button', { name: 'ちずの ばしょへ いく' })
  vi.spyOn(again.querySelector('canvas')!, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 96, height: 96 } as DOMRect)
  fireEvent.click(again, { clientX: 70.5, clientY: 20.5, detail: 1 })
  expect(scene.options.walker).toEqual(startWalker(world(), 70, 20))
  // あるくのを やめると、その ばしょが カーソルに なる
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(scene.options.cursor).toEqual({ x: 70, y: 0, z: 20 })
  // とじるだけも できる。みつけた たからは ちずから きえる
  await user.click(screen.getByRole('button', { name: 'ちず' }))
  await user.click(screen.getByRole('button', { name: 'とじる' }))
  expect(scene.options.cursor).toEqual({ x: 70, y: 0, z: 20 })
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  const [treasure] = world().treasures
  for (let y = world().topY(treasure.x, treasure.z); y >= 1; y--) tap({ x: treasure.x, y, z: treasure.z })
  expect(screen.getByRole('status')).toHaveTextContent('みつけた')
  expect(screen.getByRole('button', { name: 'ちず' }).querySelectorAll('[data-treasure]')).toHaveLength(treasures - 1)
  expect(screen.getByLabelText(`みつけた たから 1こ（ぜんぶで ${treasures}こ）`)).toBeInTheDocument()
})

it('keeps walking while a walk button is held, and takes one step for a tap', async () => {
  await start()
  scene.api.current = api()
  fireEvent.click(screen.getByRole('button', { name: 'あるく' }))
  vi.useFakeTimers()
  try {
    const forward = screen.getByRole('button', { name: 'まえへ すすむ' })
    fireEvent.pointerDown(forward)
    act(() => { vi.advanceTimersByTime(380) })
    expect(scene.options.walker).toEqual({ x: 9, y: 3, z: 8 })
    act(() => { vi.advanceTimersByTime(170) })
    act(() => { vi.advanceTimersByTime(170) })
    expect(scene.options.walker).toEqual({ x: 11, y: 4, z: 8 })
    // はなすと とまり、はなした ときの クリックでは すすまない
    fireEvent.pointerUp(forward)
    fireEvent.click(forward)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(scene.options.walker).toEqual({ x: 11, y: 4, z: 8 })
    const back = screen.getByRole('button', { name: 'うしろへ さがる' })
    fireEvent.pointerDown(back)
    fireEvent.pointerUp(back)
    fireEvent.click(back)
    expect(scene.options.walker).toEqual({ x: 10, y: 4, z: 8 })
    // がめんを はなれたら とまる
    fireEvent.pointerDown(forward)
    fireEvent.blur(window)
    act(() => { vi.advanceTimersByTime(1000) })
    expect(scene.options.walker).toEqual({ x: 10, y: 4, z: 8 })
  } finally { vi.useRealTimers() }
})

it('grows seeds on farmland into wheat to harvest, by tapping and by mining', async () => {
  const user = await start()
  wheatCount(0)
  await harvest(user)
  expect(wheatCount(1)).toHaveTextContent('🌾 1')
  expect(screen.getByRole('status')).toHaveTextContent('こむぎが 1こ とれた')
  expect(playCraftSound).toHaveBeenLastCalledWith('harvest')
  expect(blockAt(world(), { x: 8, y: 3, z: 8 })?.material).toBe('seed')
  // ながおしすると たねを えらぶ
  act(() => scene.options.onHold?.({ x: 8, y: 2, z: 8 }))
  expect(screen.getByRole('button', { name: 'つち' })).toHaveAttribute('aria-pressed', 'true')
  tap({ x: 8, y: 3, z: 8 })
  tap({ x: 8, y: 3, z: 8 })
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  tap({ x: 8, y: 3, z: 8 })
  expect(wheatCount(2)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(wheatCount(1)).toBeInTheDocument()
})

it('feeds wheat to animals to make friends and babies, and keeps them in the save', async () => {
  const user = await start()
  await harvest(user, 3)
  const [white, pink] = herd().filter(a => a.kind === 'sheep')
  touch(white)
  expect(screen.getByRole('status')).toHaveTextContent('なかよし')
  expect(herd().find(a => a.id === white.id)?.love).toBe(true)
  touch(pink, { x: 3, z: 4 })
  expect(playCraftSound).toHaveBeenLastCalledWith('baby')
  expect(screen.getByRole('status')).toHaveTextContent('あかちゃん')
  const baby = herd().at(-1)!
  expect(baby).toMatchObject({ kind: 'sheep', baby: true, x: 3, z: 4, wool: 'pink' })
  touch(baby)
  expect(herd().at(-1)?.baby).toBeUndefined()
  expect(wheatCount(0)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(readGame()?.herd).toEqual(herd())
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(herd().at(-1)?.baby).toBe(true)
  expect(wheatCount(1)).toBeInTheDocument()
})

it('shears sheep in mining mode to collect wool colors for the palette', async () => {
  const user = await start()
  const locked = screen.getAllByRole('button', { name: 'ひつじの けを とると つかえる' })
  expect(locked).toHaveLength(4)
  expect(locked.every(button => (button as HTMLButtonElement).disabled)).toBe(true)
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  const pink = herd().find(a => a.wool === 'pink')!
  touch(pink)
  expect(playCraftSound).toHaveBeenLastCalledWith('shear')
  expect(screen.getByRole('status')).toHaveTextContent('ピンクの けいとが とれた')
  expect(herd().find(a => a.id === pink.id)?.sheared).toBe(true)
  expect(JSON.parse(localStorage.getItem(WOOL_KEY)!)).toEqual(['pink'])
  await user.click(screen.getByRole('button', { name: 'ピンク' }))
  tap({ x: 8, y: 2, z: 8 })
  expect(blocks().some(b => b.material === 'wool_pink')).toBe(true)
  // けが ないと もう とれない
  vi.mocked(playCraftSound).mockClear()
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  touch(herd().find(a => a.id === pink.id)!)
  expect(playCraftSound).toHaveBeenLastCalledWith('pet')
  expect(screen.getAllByRole('button', { name: 'ひつじの けを とると つかえる' })).toHaveLength(3)
})

it('hardens lava that touches water with a sizzle', async () => {
  const user = await start()
  await user.click(screen.getByRole('button', { name: 'ようがん' }))
  // みずうみ（z<2）の なかへ おくと すぐ かたまる
  tap({ x: 4, y: 2, z: 2 }, { x: 0, y: 0, z: -1 })
  expect(playCraftSound).toHaveBeenLastCalledWith('cool')
  expect(screen.getByRole('status')).toHaveTextContent('ようがんが かたまった')
  expect(blockAt(world(), { x: 4, y: 2, z: 1 })?.material).toBe('obsidian')
  // ようがんの したを ほると みずが ながれこんで かたまる
  tap({ x: 6, y: 2, z: 2 })
  expect(playCraftSound).toHaveBeenLastCalledWith('place')
  expect(blockAt(world(), { x: 6, y: 3, z: 2 })?.material).toBe('lava')
  await user.click(screen.getByRole('button', { name: '⛏️ こわす' }))
  tap({ x: 6, y: 2, z: 2 })
  expect(playCraftSound).toHaveBeenLastCalledWith('cool')
  expect(blockAt(world(), { x: 6, y: 3, z: 2 })?.material).toBe('obsidian')
})

it('reports save failure and resumes the previous complete save', async () => {
  const user = await start()
  await harvest(user)
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  const saved = localStorage.getItem(SAVE_KEY)
  expect(saved).not.toBeNull()
  touch(herd()[0])
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  tap({ x: 9, y: 2, z: 8 })
  const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
  try {
    await user.click(screen.getByRole('button', { name: /ほぞん/ }))
    expect(screen.getByRole('alert')).toHaveTextContent('ほぞん できなかった')
    expect(localStorage.getItem(SAVE_KEY)).toBe(saved)
    await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
    await user.click(screen.getByRole('button', { name: /つづきから あそぶ/ }))
    expect(wheatCount(1)).toBeInTheDocument()
    expect(herd()[0].love).toBeUndefined()
    expect(blockAt(world(), { x: 9, y: 3, z: 8 })).toBeUndefined()
  } finally { storage.mockRestore() }
})

it('undoes a reset after construction, harvesting and an animal edit, then undoes earlier edits', async () => {
  const user = await start()
  const undo = () => user.click(screen.getByRole('button', { name: '↩ もどす' }))
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  tap({ x: 9, y: 2, z: 8 })
  await harvest(user, 2)
  touch(herd()[0])
  const before = blocks()
  const animals = herd()
  expect(animals[0].love).toBe(true)
  expect(wheatCount(1)).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: /はじめの せかい/ }))
  await user.click(screen.getByRole('button', { name: 'もどして あそぶ' }))
  expect(wheatCount(0)).toBeInTheDocument()
  expect(herd()[0].love).toBeUndefined()
  await undo()
  expect(blocks()).toEqual(before)
  expect(herd()).toEqual(animals)
  expect(wheatCount(1)).toBeInTheDocument()
  await undo()
  expect(blocks()).toEqual(before)
  expect(herd()[0].love).toBeUndefined()
  expect(wheatCount(2)).toBeInTheDocument()
  await undo()
  expect(wheatCount(1)).toBeInTheDocument()
  expect(blockAt(world(), { x: 8, y: 3, z: 8 })?.material).toBe('wheat')
  expect(blockAt(world(), { x: 9, y: 3, z: 8 })?.material).toBe('brick')
})

const LOCKED_CRAFT = 'クラフトだいで つくると つかえる'
/** クラフトだいで つくる ブロックを ぜんぶ つかえる ように して はじめる。 */
async function startCrafted() {
  localStorage.setItem(CRAFTED_KEY, JSON.stringify(CRAFTED))
  return start()
}
const sounds = () => vi.mocked(playCraftSound).mock.calls.map(([sound]) => sound)

it('crafts new blocks at the crafting table and keeps them unlocked in other worlds', async () => {
  const user = await start()
  expect(screen.getAllByRole('button', { name: LOCKED_CRAFT })).toHaveLength(CRAFTED.length)
  await user.click(screen.getByRole('button', { name: 'クラフト' }))
  tap({ x: 8, y: 2, z: 8 })
  expect(blockAt(world(), { x: 8, y: 3, z: 8 })?.material).toBe('workbench')
  const built = blocks()
  tap({ x: 8, y: 3, z: 8 })
  let panel = screen.getByRole('dialog', { name: 'クラフトだい' })
  expect(blocks()).toEqual(built)
  expect(within(panel).getByRole('button', { name: 'まだ できない' })).toBeDisabled()
  await user.click(within(panel).getByRole('button', { name: 'きを ならべる' }))
  await user.click(within(panel).getByRole('button', { name: 'ひかりを ならべる' }))
  // ランタンに つかう たいまつ・はなびに つかう ばくだんは まだ つくって いない
  expect(within(panel).getByRole('button', { name: 'ランタンの レシピ' })).toBeDisabled()
  expect(within(panel).getAllByRole('button', { name: LOCKED_CRAFT })).toHaveLength(2)
  await user.click(within(panel).getByRole('button', { name: 'たいまつを つくる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('status')).toHaveTextContent('たいまつが できた')
  expect(playCraftSound).toHaveBeenLastCalledWith('craft')
  expect(screen.getByRole('button', { name: 'たいまつ' })).toHaveAttribute('aria-pressed', 'true')
  expect(JSON.parse(localStorage.getItem(CRAFTED_KEY)!)).toEqual(['torch'])
  tap({ x: 9, y: 2, z: 8 })
  expect(blockAt(world(), { x: 9, y: 3, z: 8 })?.material).toBe('torch')
  // レシピを タッチすると ならべて くれる。とりだす・けす も できる
  tap({ x: 8, y: 3, z: 8 })
  panel = screen.getByRole('dialog', { name: 'クラフトだい' })
  expect(within(panel).getByRole('button', { name: 'たいまつの レシピ（つくった）' })).toBeEnabled()
  await user.click(within(panel).getByRole('button', { name: 'ランタンの レシピ' }))
  expect(within(panel).getByRole('button', { name: 'ランタンを つくる' })).toBeEnabled()
  await user.click(within(panel).getByRole('button', { name: 'かぼちゃを とりだす' }))
  expect(within(panel).getByRole('button', { name: 'まだ できない' })).toBeDisabled()
  await user.click(within(panel).getByRole('button', { name: 'けす' }))
  expect(within(panel).queryByRole('button', { name: /とりだす/ })).not.toBeInTheDocument()
  // 3つ ならべたら もう ならべられない
  const plank = within(panel).getByRole('button', { name: 'いたを ならべる' })
  plank.focus()
  await user.keyboard('{Enter}{Enter} ')
  expect(within(panel).getByRole('button', { name: 'きを ならべる' })).toBeDisabled()
  expect(within(panel).getByRole('button', { name: 'ドアを つくる' })).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('application')).toHaveFocus()
  // つくった ものは ほかの せかいでも つかえる
  await user.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
  await user.click(screen.getByRole('button', { name: 'さばく' }))
  expect(screen.getByRole('button', { name: 'たいまつ' })).toBeEnabled()
  expect(screen.getAllByRole('button', { name: LOCKED_CRAFT })).toHaveLength(CRAFTED.length - 1)
})

it('keeps keyboard focus in the crafting table when full slots do not match a recipe', async () => {
  const placed = createWorld()
  editWorld(placed, { x: 8, y: 3, z: 8 }, 'workbench', 'place')
  const user = await start(placed)
  tap({ x: 8, y: 3, z: 8 })
  const panel = screen.getByRole('dialog', { name: 'クラフトだい' })
  const wood = within(panel).getByRole('button', { name: 'きを ならべる' })
  wood.focus()
  await user.keyboard('{Enter}{Enter} ')
  expect(wood).toBeDisabled()
  expect(within(panel).getByRole('button', { name: 'まだ できない' })).toBeDisabled()
  expect(panel).toHaveFocus()
  await user.keyboard('{Escape}')
  expect(panel).not.toBeInTheDocument()
  expect(screen.getByRole('application')).toHaveFocus()
})

it('chooses an already crafted block again from the crafting table, and by a long press on it in the world', async () => {
  const placed = createWorld()
  editWorld(placed, { x: 9, y: 3, z: 8 }, 'door', 'place')
  const user = await start(placed)
  expect(screen.queryByRole('button', { name: 'ドア' })).not.toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: LOCKED_CRAFT })).toHaveLength(CRAFTED.length)
  // ほぞんした せかいに ある ドアを ながおしすると つかえる ように なる
  act(() => scene.options.onHold?.({ x: 9, y: 3, z: 8 }))
  expect(screen.getByRole('button', { name: 'ドア' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getAllByRole('button', { name: LOCKED_CRAFT })).toHaveLength(CRAFTED.length - 1)
  await user.click(screen.getByRole('button', { name: 'クラフト' }))
  tap({ x: 8, y: 2, z: 8 })
  tap({ x: 8, y: 3, z: 8 })
  const panel = screen.getByRole('dialog', { name: 'クラフトだい' })
  await user.click(within(panel).getByRole('button', { name: 'ドアの レシピ（つくった）' }))
  await user.click(within(panel).getByRole('button', { name: 'ドアを つくる' }))
  expect(screen.getByRole('status')).toHaveTextContent('ドアを えらんだよ')
  expect(screen.getByRole('button', { name: 'ドア' })).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: 'クラフト' }))
  tap({ x: 8, y: 3, z: 8 })
  await user.click(screen.getByRole('button', { name: 'とじる' }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

it('sleeps in a bed only at night, waking up in the morning', async () => {
  const user = await startCrafted()
  await user.click(screen.getByRole('button', { name: 'ベッド' }))
  tap({ x: 8, y: 2, z: 8 })
  const bed = { x: 8, y: 3, z: 8 }
  expect(blockAt(world(), bed)?.material).toBe('bed')
  tap(bed)
  expect(screen.getByRole('status')).toHaveTextContent('まだ あかるい')
  expect(scene.options.night).toBe(false)
  await user.click(screen.getByRole('button', { name: 'よる' }))
  vi.useFakeTimers()
  try {
    tap(bed)
    expect(screen.getByRole('status')).toHaveTextContent('ぐうぐう')
    expect(playCraftSound).toHaveBeenLastCalledWith('sleep')
    expect(scene.options.night).toBe(true)
    act(() => { vi.advanceTimersByTime(SLEEP_MS) })
    expect(scene.options.night).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent('おはよう')
    expect(playCraftSound).toHaveBeenLastCalledWith('morning')
    expect(screen.getByRole('button', { name: 'よる' })).toHaveAttribute('aria-pressed', 'false')
  } finally { vi.useRealTimers() }
})

it('opens and closes a door by touch, walks through it only while open, and undoes it', async () => {
  const user = await startCrafted()
  scene.api.current = api()
  await user.click(screen.getByRole('button', { name: 'ドア' }))
  const door = { x: 9, y: 3, z: 8 }
  tap({ x: 9, y: 2, z: 8 })
  // ドアの てまえから あるく
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowLeft' })
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  expect(scene.options.walker).toEqual({ x: 8, y: 3, z: 8 })
  tap(door)
  expect(blockAt(world(), door)?.material).toBe('door_open')
  expect(playCraftSound).toHaveBeenLastCalledWith('door')
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  expect(scene.options.walker).toEqual(door)
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  tap(door)
  expect(blockAt(world(), door)?.material).toBe('door')
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blockAt(world(), door)?.material).toBe('door_open')
})

it('lights a bomb by touch, blows up the blocks around it after a moment, and undoes the blast', async () => {
  const user = await startCrafted()
  scene.api.current = api()
  await user.click(screen.getByRole('button', { name: 'ばくだん' }))
  const bomb = { x: 8, y: 3, z: 8 }
  tap({ x: 8, y: 2, z: 8 })
  const built = blocks()
  vi.useFakeTimers()
  try {
    tap(bomb)
    tap(bomb)
    expect(scene.options.lit).toEqual([bomb])
    expect(sounds().filter(sound => sound === 'fuse')).toHaveLength(1)
    expect(blocks()).toEqual(built)
    act(() => { vi.advanceTimersByTime(FUSE_MS) })
    expect(blockAt(world(), bomb)).toBeUndefined()
    expect(blockAt(world(), { x: 8, y: 2, z: 8 })).toBeUndefined()
    expect(blockAt(world(), { x: 8, y: 0, z: 8 })?.material).toBe('stone')
    expect(scene.options.lit).toEqual([])
    expect(scene.api.current!.burst).toHaveBeenCalledWith([bomb])
    expect(playCraftSound).toHaveBeenLastCalledWith('boom')
    expect(screen.getByRole('status')).toHaveTextContent('ドカーン')
    fireEvent.click(screen.getByRole('button', { name: '↩ もどす' }))
    expect(blocks()).toEqual(built)
    // ひの ついた ばくだんを こわすと はじけない
    vi.mocked(playCraftSound).mockClear()
    tap(bomb)
    expect(scene.options.lit).toEqual([bomb])
    fireEvent.click(screen.getByRole('button', { name: '⛏️ こわす' }))
    tap(bomb)
    expect(scene.options.lit).toEqual([])
    act(() => { vi.advanceTimersByTime(FUSE_MS * 2) })
    expect(sounds()).not.toContain('boom')
    expect(blockAt(world(), { x: 8, y: 2, z: 8 })?.material).toBe('grass')
  } finally { vi.useRealTimers() }
})

it('stops a lit fuse when leaving the game', async () => {
  const user = await startCrafted()
  await user.click(screen.getByRole('button', { name: 'ばくだん' }))
  tap({ x: 8, y: 2, z: 8 })
  vi.useFakeTimers()
  try {
    tap({ x: 8, y: 3, z: 8 })
    fireEvent.click(screen.getByRole('button', { name: 'タイトルへ もどる' }))
    act(() => { vi.advanceTimersByTime(FUSE_MS * 2) })
    expect(sounds()).not.toContain('boom')
  } finally { vi.useRealTimers() }
})

it('plays a note block by touch and by walking onto it, higher as it goes up', async () => {
  const user = await startCrafted()
  scene.api.current = api()
  await user.click(screen.getByRole('button', { name: 'おんぷ' }))
  const note = { x: 9, y: 3, z: 8 }
  tap({ x: 9, y: 2, z: 8 })
  const built = blocks()
  tap(note)
  expect(playNote).toHaveBeenLastCalledWith(noteStep(3))
  expect(screen.getByRole('status')).toHaveTextContent('🎵 ミ')
  expect(blocks()).toEqual(built)
  expect(screen.getByRole('button', { name: '↩ もどす' })).toBeEnabled()
  expect([1, 2, 8, 9].map(noteStep)).toEqual([0, 1, 7, 0])
  vi.mocked(playNote).mockClear()
  fireEvent.keyDown(screen.getByRole('application'), { key: 'ArrowLeft' })
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(scene.options.walker).toEqual({ x: 8, y: 3, z: 8 })
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  expect(scene.options.walker).toEqual({ x: 9, y: 4, z: 8 })
  expect(playNote).toHaveBeenLastCalledWith(noteStep(3))
  expect(playCraftSound).not.toHaveBeenLastCalledWith('step')
})

it('eats a cake in two bites', async () => {
  const user = await startCrafted()
  await user.click(screen.getByRole('button', { name: 'ケーキ' }))
  const cake = { x: 8, y: 3, z: 8 }
  tap({ x: 8, y: 2, z: 8 })
  tap(cake)
  expect(blockAt(world(), cake)?.material).toBe('cake_half')
  expect(screen.getByRole('status')).toHaveTextContent('おいしい')
  expect(playCraftSound).toHaveBeenLastCalledWith('eat')
  tap(cake)
  expect(blockAt(world(), cake)).toBeUndefined()
  expect(screen.getByRole('status')).toHaveTextContent('ぜんぶ たべた')
})

it('crafts a dragon egg from lava, fire (a torch) and lava, and hatches a baby dragon that breathes fire', async () => {
  localStorage.setItem(CRAFTED_KEY, JSON.stringify(['torch']))
  const placed = createWorld()
  editWorld(placed, { x: 8, y: 3, z: 8 }, 'workbench', 'place')
  const user = await start(placed)
  tap({ x: 8, y: 3, z: 8 })
  const panel = screen.getByRole('dialog', { name: 'クラフトだい' })
  expect(within(panel).getByRole('button', { name: 'たまごの レシピ' })).toHaveTextContent('🌋+🔥+🌋=🥚')
  for (const name of ['ようがんを ならべる', 'たいまつを ならべる', 'ようがんを ならべる']) await user.click(within(panel).getByRole('button', { name }))
  await user.click(within(panel).getByRole('button', { name: 'たまごを つくる' }))
  expect(screen.getByRole('status')).toHaveTextContent('たまごが できた')
  expect(screen.getByRole('button', { name: 'たまご' })).toHaveAttribute('aria-pressed', 'true')
  tap({ x: 9, y: 2, z: 8 })
  const egg = { x: 9, y: 3, z: 8 }
  expect(blockAt(world(), egg)?.material).toBe('dragon_egg')
  const animals = herd().length
  tap(egg)
  expect(blockAt(world(), egg)).toBeUndefined()
  expect(herd()).toHaveLength(animals + 1)
  const dragon = herd().at(-1)!
  expect(dragon).toMatchObject({ kind: 'dragon', x: 9, z: 8, baby: true })
  expect(screen.getByRole('status')).toHaveTextContent('ドラゴンが うまれた')
  expect(playCraftSound).toHaveBeenLastCalledWith('hatch')
  // こむぎが なくても、さわると ひを はく
  touch(dragon)
  expect(playCraftSound).toHaveBeenLastCalledWith('flame')
  expect(herd().at(-1)).toBe(dragon)
  await user.click(screen.getByRole('button', { name: /ほぞん/ }))
  expect(readGame()?.herd.at(-1)).toEqual(dragon)
  // もどすと たまごに もどる
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blockAt(world(), egg)?.material).toBe('dragon_egg')
  expect(herd()).toHaveLength(animals)
})

it('keeps the egg when there is no room for another animal', async () => {
  const placed = createWorld()
  const egg = { x: 9, y: 3, z: 8 }
  editWorld(placed, egg, 'dragon_egg', 'place')
  await start(placed, herdFrom(Array.from({ length: MAX_HERD }, (_, i) => ({ kind: 'rabbit' as const, x: i, z: 12 }))))
  tap(egg)
  expect(screen.getByRole('status')).toHaveTextContent('いっぱい')
  expect(blockAt(world(), egg)?.material).toBe('dragon_egg')
  expect(herd()).toHaveLength(MAX_HERD)
  expect(screen.getByRole('button', { name: '↩ もどす' })).toBeDisabled()
})

it('warps between portals by touch and by walking onto one, after asking for a second portal', async () => {
  const user = await startCrafted()
  scene.api.current = api()
  await user.click(screen.getByRole('button', { name: 'ワープ' }))
  const first = { x: 4, y: 3, z: 8 }, second = { x: 12, y: 3, z: 10 }
  tap({ ...first, y: 2 })
  tap(first)
  expect(screen.getByRole('status')).toHaveTextContent('もう 1つ')
  expect(blockAt(world(), first)?.material).toBe('portal')
  tap({ ...second, y: 2 })
  const built = blocks()
  tap(first)
  expect(scene.options.cursor).toEqual({ x: 12, y: 0, z: 10 })
  expect(scene.api.current!.focus).toHaveBeenLastCalledWith(12, 10)
  expect(screen.getByRole('status')).toHaveTextContent('ワープ！')
  expect(playCraftSound).toHaveBeenLastCalledWith('warp')
  expect(blocks()).toEqual(built)
  // あるいて ワープの うえから おりて、もういちど のると もどる
  await user.click(screen.getByRole('button', { name: 'あるく' }))
  expect(scene.options.walker).toEqual({ ...second, y: 4 })
  await user.click(screen.getByRole('button', { name: 'まえへ すすむ' }))
  expect(scene.options.walker).toEqual({ x: 13, y: 3, z: 10 })
  expect(playCraftSound).toHaveBeenLastCalledWith('step')
  await user.click(screen.getByRole('button', { name: 'うしろへ さがる' }))
  expect(scene.options.walker).toEqual({ ...first, y: 4 })
  expect(scene.options.cursor).toEqual({ x: 4, y: 0, z: 8 })
  expect(playCraftSound).toHaveBeenLastCalledWith('warp')
})

it('launches fireworks from the block by touch, without changing the world', async () => {
  const user = await startCrafted()
  scene.api.current = api()
  await user.click(screen.getByRole('button', { name: 'はなび' }))
  const fireworks = { x: 8, y: 3, z: 8 }
  tap({ ...fireworks, y: 2 })
  const built = blocks()
  tap(fireworks)
  tap(fireworks)
  expect(scene.api.current!.fireworks).toHaveBeenCalledTimes(2)
  expect(scene.api.current!.fireworks).toHaveBeenLastCalledWith(fireworks)
  expect(blocks()).toEqual(built)
  expect(screen.getByRole('status')).toHaveTextContent('きれい')
  expect(playCraftSound).toHaveBeenLastCalledWith('firework')
  // もどすと はなびを おく まえに もどる（うちあげは きろくしない）
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blockAt(world(), fireworks)).toBeUndefined()
})

it('paints touched blocks in ぬる mode, also 3×3, and keeps painting after choosing another block', async () => {
  const user = await start()
  const initial = blocks()
  const paint = screen.getByRole('button', { name: '🖌️ ぬる' })
  await user.click(screen.getByRole('button', { name: 'いし' }))
  await user.click(paint)
  expect(paint).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: '🧱 おく' })).toHaveAttribute('aria-pressed', 'false')
  tap({ x: 8, y: 2, z: 8 })
  expect(blockAt(world(), { x: 8, y: 2, z: 8 })?.material).toBe('stone')
  expect(blockAt(world(), { x: 8, y: 3, z: 8 })).toBeUndefined()
  expect(playCraftSound).toHaveBeenLastCalledWith('paint')
  // ほかの ブロックを えらんでも、ながおしで えらんでも ぬる まま
  await user.click(screen.getByRole('button', { name: 'れんが' }))
  expect(paint).toHaveAttribute('aria-pressed', 'true')
  await user.click(screen.getByRole('button', { name: '🔲 ひろく' }))
  tap({ x: 8, y: 2, z: 8 })
  expect(blocks().filter(b => b.y === 2 && b.material === 'brick')).toHaveLength(9)
  expect(blocks()).toHaveLength(initial.length)
  act(() => scene.options.onHold?.(blocks().find(b => b.material === 'pumpkin')!))
  expect(screen.getByRole('button', { name: 'かぼちゃ' })).toHaveAttribute('aria-pressed', 'true')
  expect(paint).toHaveAttribute('aria-pressed', 'true')
  // くさばなは ぬらない
  await user.click(screen.getByRole('button', { name: '🔲 ひろく' }))
  vi.mocked(playCraftSound).mockClear()
  const before = blocks()
  tap(blocks().find(b => b.material === 'flower')!)
  expect(blocks()).toEqual(before)
  expect(playCraftSound).not.toHaveBeenCalled()
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  await user.click(screen.getByRole('button', { name: '↩ もどす' }))
  expect(blocks()).toEqual(initial)
})
