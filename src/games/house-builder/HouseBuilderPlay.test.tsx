import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import HouseBuilderPlay from './HouseBuilderPlay'
import { EXTERIOR_STYLES, EXTRAS, GARDENS } from './data'
import { ALBUM_LIMIT } from './save'
import { playHouseSound, startBgm } from './sounds'

vi.mock('./sounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...actual, playHouseSound: vi.fn(), startBgm: vi.fn(() => stopBgm) }
})

// 3D の がめんは jsdom で かけないので、よばれかた だけを みる。
const scene = vi.hoisted(() => ({
  create: vi.fn(),
  show: vi.fn(),
  turn: vi.fn(),
  zoom: vi.fn(),
  dispose: vi.fn(),
  status: 'ready' as 'ready' | 'error',
  callbacks: null as null | { status: (status: 'ready' | 'error') => void; spot: (spot: 'door' | 'dog' | 'car' | 'room') => void },
}))

vi.mock('./three/houseScene', () => ({
  createHouseScene: (_host: HTMLElement, design: unknown, view: unknown, callbacks: NonNullable<typeof scene.callbacks>) => {
    scene.create(design, view)
    scene.callbacks = callbacks
    callbacks.status(scene.status)
    return { show: scene.show, turn: scene.turn, zoom: scene.zoom, dispose: scene.dispose }
  },
}))

const stopBgm = vi.fn()
const KEY = 'house-builder-v1'
const ALBUM_KEY = 'house-builder-album-v1'

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
  scene.status = 'ready'
  scene.callbacks = null
})

afterEach(() => {
  vi.restoreAllMocks()
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const cell = (x: number, y: number) => `よこ ${x}・たて ${y} に おく`
const saved = () => JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
const album = () => JSON.parse(window.localStorage.getItem(ALBUM_KEY) ?? '[]')
const sounds = () => vi.mocked(playHouseSound).mock.calls.map(([kind]) => kind)

function renderGame() {
  return render(<MemoryRouter><HouseBuilderPlay /></MemoryRouter>)
}

const spot = (kind: 'door' | 'dog' | 'car' | 'room') => act(() => scene.callbacks!.spot(kind))

/** ほぞんした おうちから かんせい がめんへ すすむ。 */
function openDone(design: object) {
  window.localStorage.setItem(KEY, JSON.stringify(design))
  renderGame()
  click('つづきから つくる')
  click(/そとがわを つくる/)
  click('かんせい！')
}

const SAVED_HOUSE = {
  houseType: 'nikai',
  shape: 'square',
  rooms: [
    { id: 1, floor: 0, type: 'toilet', style: 'flower', size: 'm', turned: false, x: 5, y: 0 },
    { id: 2, floor: 1, type: 'kids', style: 'space', size: 'm', turned: false, x: 0, y: 0 },
  ],
  exterior: { wall: 'brick', roof: 'kawara', window: 'square', door: 'wood', parking: 'two', doghouse: 'red', garden: 'none', pool: 'none', extras: [] },
}

function startHouse(type: RegExp, shape: RegExp) {
  renderGame()
  click(type)
  click(shape)
}

function pickRoom(type: string, style?: string, size?: RegExp) {
  fireEvent.click(within(screen.getByRole('list', { name: 'へやの しゅるい' })).getByRole('button', { name: type }))
  if (style) fireEvent.click(within(screen.getByRole('list', { name: 'みための しゅるい' })).getByRole('button', { name: style }))
  if (size) fireEvent.click(within(screen.getByRole('group', { name: 'おおきさ' })).getByRole('button', { name: size }))
}

describe('house-builder play', () => {
  test('いえの しゅるい → かたち の じゅんに えらぶと、まどりが はじまり BGM が ながれる', () => {
    renderGame()
    expect(screen.getByRole('heading', { level: 1, name: 'おうちづくり' })).toBeInTheDocument()
    const types = within(screen.getByRole('list', { name: 'いえの しゅるい' })).getAllByRole('button')
    expect(types.map((b) => b.querySelector('span:nth-child(2)')?.textContent)).toEqual(['ひらや', '2かいだて', '3かいだて', '4かいだて'])
    expect(startBgm).not.toHaveBeenCalled()

    click(/^3かいだて/)
    expect(screen.getByText('3かいだて の おうち')).toBeInTheDocument()
    const shapes = within(screen.getByRole('list', { name: 'おうちの かたち' })).getAllByRole('button')
    expect(shapes).toHaveLength(6)
    expect(startBgm).toHaveBeenCalledTimes(1)

    click(/^なかにわつき/)
    expect(screen.getByRole('region', { name: 'まどりを つくる' })).toBeInTheDocument()
    const floors = within(screen.getByRole('group', { name: 'なんかい' })).getAllByRole('button')
    expect(floors.map((b) => b.firstChild?.textContent)).toEqual(['1かい', '2かい', '3かい'])
    // なかにわの マスには おけない（ボタンが ない）。
    expect(screen.queryByRole('button', { name: cell(5, 5) })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: cell(1, 1) })).toBeInTheDocument()
    expect(saved()).toMatchObject({ houseType: 'sangai', shape: 'ushape', rooms: [] })
  })

  test('へやを えらんで タップで おき、えらびなおして みため・おおきさ・むきを かえ、けせる', () => {
    startHouse(/^2かいだて/, /^しかく/)
    pickRoom('おふろ', 'ひのきの おふろ', /^おおきい/)
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    expect(screen.getByRole('status')).toHaveTextContent('おふろを おいたよ！')
    expect(sounds()).toContain('place')
    expect(saved().rooms).toEqual([{ id: 1, floor: 0, type: 'bath', style: 'hinoki', size: 'l', turned: false, x: 0, y: 0 }])
    // おいた ところは もう からっぽの マスでは ない。
    expect(screen.queryByRole('button', { name: cell(3, 3) })).not.toBeInTheDocument()

    // かさなる ところには おけない。
    pickRoom('リビング', 'しろくて モダンな リビング', /^おおきい/)
    fireEvent.click(screen.getByRole('button', { name: cell(4, 1) }))
    expect(screen.getByRole('status')).toHaveTextContent('ここには はいらないよ')
    expect(sounds()).toContain('blocked')
    fireEvent.click(screen.getByRole('button', { name: cell(3, 6) }))
    expect(saved().rooms[1]).toMatchObject({ type: 'living', style: 'modern', x: 0, y: 3 })

    // おいた へやを えらぶと、みため・おおきさを かえられる。
    click('おいた ひのきの おふろ')
    expect(screen.getByRole('button', { name: 'おいた ひのきの おふろ' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(screen.getByRole('list', { name: 'みための しゅるい' })).getByRole('button', { name: 'いわぶろの おんせん' }))
    expect(saved().rooms[0]).toMatchObject({ style: 'onsen' })
    fireEvent.click(within(screen.getByRole('group', { name: 'おおきさ' })).getByRole('button', { name: /^ちいさい/ }))
    expect(saved().rooms[0]).toMatchObject({ size: 's', x: 0, y: 0 })
    fireEvent.click(within(screen.getByRole('group', { name: 'おおきさ' })).getByRole('button', { name: /^ふつう/ }))
    click('くるっと まわす')
    expect(saved().rooms[0]).toMatchObject({ size: 'm', turned: true, x: 0, y: 0 })
    click('できた')
    expect(screen.getByRole('button', { name: 'おいた いわぶろの おんせん' })).toHaveAttribute('aria-pressed', 'false')

    // となりに トイレを おくと、おふろは もう おおきく できない。
    pickRoom('トイレ', undefined, /^ちいさい/)
    fireEvent.click(screen.getByRole('button', { name: cell(3, 1) }))
    click('おいた いわぶろの おんせん')
    fireEvent.click(within(screen.getByRole('group', { name: 'おおきさ' })).getByRole('button', { name: /^おおきい/ }))
    expect(screen.getByRole('status')).toHaveTextContent('ここでは そう できないよ')
    expect(saved().rooms[0]).toMatchObject({ size: 'm' })

    click('けす')
    expect(saved().rooms.map((r: { type: string }) => r.type)).toEqual(['living', 'toilet'])
    expect(sounds()).toContain('remove')
    expect(screen.getByRole('list', { name: 'へやの しゅるい' })).toBeInTheDocument()
  })

  test('かいを きりかえて へやを おき、かいだんの ヒントが でる', () => {
    startHouse(/^2かいだて/, /^ながしかく/)
    expect(screen.getByText('かいだんを おくと うえと したが つながるよ')).toBeInTheDocument()
    pickRoom('かいだん')
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    expect(screen.queryByText('かいだんを おくと うえと したが つながるよ')).not.toBeInTheDocument()
    click(/^2かい/)
    expect(sounds()).toContain('floor')
    expect(screen.getByRole('group', { name: '2かいの まどり' })).toBeInTheDocument()
    pickRoom('しんしつ', 'ほしぞらの しんしつ')
    fireEvent.click(screen.getByRole('button', { name: cell(8, 5) }))
    expect(saved().rooms.map((r: { floor: number; type: string }) => [r.floor, r.type])).toEqual([[0, 'stairs'], [1, 'bedroom']])
    expect(screen.getAllByLabelText('へや 1こ')).toHaveLength(2)
  })

  test('おいた へやを ひっぱって うごかし、はいらない ところでは もとの まま', () => {
    startHouse(/^ひらや/, /^しかく/)
    pickRoom('トイレ', 'シンプルな トイレ', /^ちいさい/)
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    fireEvent.click(screen.getByRole('button', { name: cell(3, 1) }))
    // 6×6 の ばんを 600px に みたてる（1マス 100px）。
    const board = screen.getByRole('group', { name: '1かいの まどり' })
    vi.spyOn(board, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 600, height: 600, right: 600, bottom: 600, x: 0, y: 0, toJSON: () => ({}) })
    const drag = (from: [number, number], to: [number, number]) => {
      const room = screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0]
      const at = (p: [number, number]) => ({ clientX: p[0], clientY: p[1], pointerId: 1, isPrimary: true, button: 0 })
      fireEvent.pointerDown(room, at(from))
      fireEvent.pointerMove(room, at([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]))
      fireEvent.pointerMove(room, at(to))
      fireEvent.pointerUp(room, at(to))
      fireEvent.click(room)
    }

    drag([50, 50], [150, 350])
    expect(saved().rooms[0]).toMatchObject({ id: 1, x: 1, y: 3 })
    expect(screen.getByRole('status')).toHaveTextContent('トイレを うごかしたよ')
    // ひっぱった あとは えらんだ ことに しない。
    expect(screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0]).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: cell(1, 1) })).toBeInTheDocument()

    // ほかの へやの うえには うごかせない。
    drag([150, 350], [250, 50])
    expect(screen.getByRole('status')).toHaveTextContent('そこには うごかせないよ')
    expect(sounds()).toContain('blocked')
    expect(saved().rooms[0]).toMatchObject({ x: 1, y: 3 })

    // ひっぱらずに タップすれば いつもどおり えらべる。
    fireEvent.pointerDown(screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0], { clientX: 150, clientY: 350, pointerId: 2, isPrimary: true, button: 0 })
    fireEvent.pointerUp(screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0], { clientX: 150, clientY: 350, pointerId: 2, isPrimary: true, button: 0 })
    fireEvent.click(screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0])
    expect(screen.getAllByRole('button', { name: 'おいた シンプルな トイレ' })[0]).toHaveAttribute('aria-pressed', 'true')
  })

  test('やじるしキーで マスを うごき、Enter で おける', () => {
    startHouse(/^ひらや/, /^せまい/)
    const first = screen.getByRole('button', { name: cell(1, 1) })
    expect(first).toHaveAttribute('tabindex', '0')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByRole('button', { name: cell(2, 1) }), { key: 'ArrowDown' })
    expect(screen.getByRole('button', { name: cell(2, 2) })).toHaveFocus()
    expect(screen.getByRole('button', { name: cell(2, 2) })).toHaveAttribute('tabindex', '0')
  })

  test('そとがわを えらんで かんせいさせ、そとと へやごとの なかを 3D で みられる', async () => {
    startHouse(/^2かいだて/, /^しかく/)
    pickRoom('げんかん', 'いしだたみの げんかん')
    fireEvent.click(screen.getByRole('button', { name: cell(3, 6) }))
    pickRoom('トイレ', 'おはなの トイレ')
    fireEvent.click(screen.getByRole('button', { name: cell(6, 1) }))
    click(/^2かい/)
    pickRoom('こどもべや', 'うちゅうの こどもべや')
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))

    click(/そとがわを つくる/)
    expect(screen.getByRole('region', { name: 'そとがわを つくる' })).toBeInTheDocument()
    const choose = (category: string, option: string) => {
      fireEvent.click(within(screen.getByRole('list', { name: 'えらぶ もの' })).getByRole('button', { name: category }))
      fireEvent.click(within(screen.getByRole('list', { name: category })).getByRole('button', { name: option }))
    }
    choose('かべ', 'レンガの かべ')
    choose('やね', 'かわらの やね')
    choose('ちゅうしゃじょう', 'くるま 2だい')
    expect(sounds()).toContain('horn')
    choose('いぬごや', 'あかい やねの いぬごや')
    expect(sounds()).toContain('bark')
    choose('おまけ', 'えんとつ')
    choose('おまけ', 'こいのぼり')
    choose('おまけ', 'えんとつ')
    expect(screen.getByRole('status')).toHaveTextContent('えんとつを はずしたよ')
    expect(saved().exterior).toMatchObject({ wall: 'brick', roof: 'kawara', parking: 'two', doghouse: 'red', extras: ['koinobori'] })

    click('かんせい！')
    expect(sounds()).toContain('complete')
    expect(screen.getByRole('heading', { name: /かんせい！ すてきな おうちが できたね/ })).toBeInTheDocument()
    expect(screen.getByText('2かいだて・しかく・へや 3こ')).toBeInTheDocument()
    // そと: 3D の おうちを ゆびや ボタンで まわし、いぬ・くるま・ドアを タップすると こえが でる。
    const stage = await screen.findByRole('group', { name: /^できあがった おうち（3D）/ })
    expect(scene.create).toHaveBeenCalledWith(expect.objectContaining({ houseType: 'nikai', shape: 'square' }), { kind: 'outside' })
    spot('dog')
    expect(screen.getByText('わん わん！')).toBeInTheDocument()
    spot('car')
    expect(screen.getByText('ブッブー！ おでかけ しよう')).toBeInTheDocument()
    fireEvent.keyDown(stage, { key: 'Enter' })
    expect(screen.getByText('ピンポーン！ おかえりなさい')).toBeInTheDocument()
    expect(sounds()).toEqual(expect.arrayContaining(['bark', 'horn', 'bell']))
    fireEvent.keyDown(stage, { key: 'ArrowRight' })
    expect(scene.turn).toHaveBeenLastCalledWith(1)
    click('ひだりに まわす')
    expect(scene.turn).toHaveBeenLastCalledWith(-1)
    click('ちかづく')
    expect(scene.zoom).toHaveBeenLastCalledWith(1)
    click('はなれる')
    expect(scene.zoom).toHaveBeenLastCalledWith(-1)

    // なか: 1かいから じゅんに へやを ひとつずつ 3D で みる。
    const ids = Object.fromEntries(saved().rooms.map((r: { type: string; id: number }) => [r.type, r.id]))
    click('なかを みる')
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: ids.toilet })
    expect(screen.getByRole('group', { name: /^1かいの おはなの トイレ（3D）/ })).toBe(stage)
    spot('room')
    expect(screen.getByText('おはなの トイレ「じゃー！ すっきり」')).toBeInTheDocument()
    expect(sounds()).toContain('flush')
    click('つぎの へや')
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: ids.entrance })
    spot('room')
    expect(screen.getByText('いしだたみの げんかん「ただいま！」')).toBeInTheDocument()
    const picker = screen.getByRole('group', { name: 'みる へや' })
    expect(within(picker).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual([
      '1かいの おはなの トイレ', '1かいの いしだたみの げんかん', '2かいの うちゅうの こどもべや',
    ])
    fireEvent.click(within(picker).getByRole('button', { name: '2かいの うちゅうの こどもべや' }))
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: ids.kids })
    expect(within(picker).getByRole('button', { name: '2かいの うちゅうの こどもべや' })).toHaveAttribute('aria-pressed', 'true')
    click('つぎの へや')
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: ids.toilet })
    click('まえの へや')
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: ids.kids })
    click('そとから みる')
    expect(scene.show).toHaveBeenLastCalledWith(expect.anything(), { kind: 'outside' })
    expect(scene.create).toHaveBeenCalledTimes(1)

    // なおす と さいしょから。3D は がめんを はなれると すてる。
    click('まどりを なおす')
    expect(scene.dispose).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('region', { name: 'まどりを つくる' })).toBeInTheDocument()
    click(/そとがわを つくる/)
    click('かんせい！')
    click('さいしょから つくる')
    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    click('さいしょから つくる')
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'けして つくる' }))
    expect(screen.getByRole('list', { name: 'いえの しゅるい' })).toBeInTheDocument()
    expect(window.localStorage.getItem(KEY)).toBeNull()
  })

  test('つくりかけの おうちは ほぞんされ、つぎに ひらくと つづきから つくれる', () => {
    const first = renderGame()
    click(/^ひらや/)
    click(/^L の かたち/)
    pickRoom('わしつ', 'こたつの わしつ')
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    first.unmount()

    renderGame()
    expect(screen.getByText('つくりかけの おうちが あるよ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ひらや/ })).toHaveAttribute('aria-pressed', 'true')
    click('つづきから つくる')
    expect(screen.getByRole('button', { name: 'おいた こたつの わしつ' })).toBeInTheDocument()

    // もどって かたちを かえても、おさまる へやは のこる。
    click('もどる')
    expect(screen.getByRole('button', { name: /^L の かたち/ })).toHaveAttribute('aria-pressed', 'true')
    click(/^せまい/)
    expect(saved()).toMatchObject({ shape: 'narrow', rooms: [{ type: 'washitsu', style: 'kotatsu' }] })
  })

  test('とちゅうで「いったん ほぞんして もどる」と さいしょの がめんへ もどり、つづきから つくれる', () => {
    startHouse(/^ひらや/, /^L の かたち/)
    pickRoom('わしつ', 'こたつの わしつ')
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    click(/そとがわを つくる/)
    fireEvent.click(within(screen.getByRole('list', { name: 'えらぶ もの' })).getByRole('button', { name: 'やね' }))
    fireEvent.click(within(screen.getByRole('list', { name: 'やね' })).getAllByRole('button')[1])
    const roof = saved().exterior.roof

    click('いったん ほぞんして もどる')
    expect(screen.getByRole('status')).toHaveTextContent('とちゅうまで ほぞんしたよ')
    expect(screen.getByText('つくりかけの おうちが あるよ')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'いったん ほぞんして もどる' })).not.toBeInTheDocument()
    expect(sounds().at(-1)).toBe('place')
    expect(saved()).toMatchObject({ shape: 'lshape', rooms: [{ type: 'washitsu' }], exterior: { roof } })

    click('つづきから つくる')
    expect(screen.queryByText(/とちゅうまで ほぞんしたよ/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'おいた こたつの わしつ' })).toBeInTheDocument()
  })

  test('いったん もどる ときに ほぞん できなければ おしえて、つくりかけは その ばに のこる', () => {
    startHouse(/^ひらや/, /^L の かたち/)
    pickRoom('わしつ', 'こたつの わしつ')
    fireEvent.click(screen.getByRole('button', { name: cell(1, 1) }))
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })

    click('いったん ほぞんして もどる')
    expect(screen.getByText('この ブラウザでは ほぞん できないよ')).toBeInTheDocument()
    expect(sounds().at(-1)).toBe('blocked')
    click('つづきから つくる')
    expect(screen.getByRole('button', { name: 'おいた こたつの わしつ' })).toBeInTheDocument()
  })

  test('プールと はたけを いっしょに おき、セットで いえの みためだけを かえて ほぞんできる', async () => {
    window.localStorage.setItem(KEY, JSON.stringify(SAVED_HOUSE))
    const first = renderGame()
    click('つづきから つくる')
    click(/そとがわを つくる/)
    const choose = (category: string, option: string) => {
      fireEvent.click(within(screen.getByRole('list', { name: 'えらぶ もの' })).getByRole('button', { name: category }))
      fireEvent.click(within(screen.getByRole('list', { name: category })).getByRole('button', { name: option }))
    }
    const crop = GARDENS.find((option) => option.id === 'strawberries')!
    choose('にわ', crop.name)
    choose('プール', 'まるい プール')
    expect(saved().exterior).toMatchObject({ garden: 'strawberries', pool: 'round' })
    choose('プール', 'なし')
    expect(saved().exterior).toMatchObject({ garden: 'strawberries', pool: 'none' })
    choose('プール', 'おおきな プール')
    for (const id of ['picnic', 'fountain']) choose('おまけ', EXTRAS.find((option) => option.id === id)!.name)

    const beforeStyle = saved()
    for (const style of EXTERIOR_STYLES) {
      choose('おうちセット', style.name)
      expect(saved()).toEqual({ ...beforeStyle, exterior: { ...beforeStyle.exterior, ...style.facade } })
      expect(within(screen.getByRole('list', { name: 'おうちセット' })).getByRole('button', { name: style.name })).toHaveAttribute('aria-pressed', 'true')
    }
    expect(sounds()).toContain('paint')
    const finished = saved()
    click('かんせい！')
    await screen.findByRole('group', { name: /^できあがった おうち（3D）/ })
    expect(scene.create).toHaveBeenLastCalledWith(expect.objectContaining({ exterior: finished.exterior, rooms: SAVED_HOUSE.rooms }), { kind: 'outside' })
    click(/おうちを ほぞんする/)
    first.unmount()

    window.localStorage.removeItem(KEY)
    renderGame()
    click('1ばんめの おうちを ひらく（2かいだて・へや 2こ）')
    await screen.findByRole('group', { name: /^できあがった おうち（3D）/ })
    expect(scene.create).toHaveBeenLastCalledWith(expect.objectContaining({ exterior: finished.exterior, rooms: SAVED_HOUSE.rooms }), { kind: 'outside' })
    click('そとがわを なおす')
    fireEvent.click(within(screen.getByRole('list', { name: 'えらぶ もの' })).getByRole('button', { name: 'プール' }))
    expect(within(screen.getByRole('list', { name: 'プール' })).getByRole('button', { name: 'おおきな プール' })).toHaveAttribute('aria-pressed', 'true')
    expect(saved().exterior).toMatchObject({ garden: 'strawberries', pool: 'rectangle', extras: ['picnic', 'fountain'] })
  })

  test('3D で みられない ときは そと と かいごとの まどりを え で みせ、もういちど 3D に できる', async () => {
    scene.status = 'error'
    openDone(SAVED_HOUSE)
    expect(await screen.findByText('3Dで みられない ので、えで みせているよ')).toBeInTheDocument()
    const front = screen.getByRole('group', { name: 'できあがった おうちの そとがわ' })
    fireEvent.click(within(front).getByRole('button', { name: 'いぬ' }))
    expect(screen.getByText('わん わん！')).toBeInTheDocument()
    fireEvent.click(within(front).getByRole('button', { name: 'くるま 2' }))
    expect(screen.getByText('ブッブー！ おでかけ しよう')).toBeInTheDocument()
    fireEvent.keyDown(within(front).getByRole('button', { name: 'げんかんの ドア' }), { key: 'Enter' })
    expect(screen.getByText('ピンポーン！ おかえりなさい')).toBeInTheDocument()

    click('なかを みる')
    expect(screen.getAllByText(/^[12]かい$/).map((e) => e.textContent)).toEqual(['2かい', '1かい'])
    expect(screen.queryByRole('group', { name: 'みる へや' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '2かいの うちゅうの こどもべや' }))
    expect(screen.getByText('うちゅうの こどもべや「なにして あそぶ？」')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1かいの おはなの トイレ' }))
    expect(sounds()).toContain('flush')

    scene.status = 'ready'
    click('もういちど 3Dで みる')
    expect(await screen.findByRole('group', { name: /^1かいの おはなの トイレ（3D）/ })).toBeInTheDocument()
    expect(scene.create).toHaveBeenLastCalledWith(expect.anything(), { kind: 'room', roomId: 1 })
    expect(screen.queryByText('3Dで みられない ので、えで みせているよ')).not.toBeInTheDocument()
  })

  test('へやが ない おうちの なかは まどりを なおすように おしえる', async () => {
    openDone({ ...SAVED_HOUSE, rooms: [] })
    await screen.findByRole('group', { name: /^できあがった おうち（3D）/ })
    click('なかを みる')
    expect(screen.getByText('へやが まだ ないよ。「まどりを なおす」で へやを おいてね')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: /（3D）/ })).not.toBeInTheDocument()
    expect(scene.dispose).toHaveBeenCalledTimes(1)
  })

  test('かんせいした おうちを ほぞんし、つぎに ひらくと いちらんから ひらいて なおせる', async () => {
    openDone(SAVED_HOUSE)
    await screen.findByRole('group', { name: /^できあがった おうち（3D）/ })
    click(/おうちを ほぞんする/)
    expect(screen.getByText('ほぞんしたよ！ さいしょの がめんから また ひらけるよ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ほぞんずみ/ })).toBeDisabled()
    expect(album()).toEqual([{ id: 1, savedAt: expect.any(Number), design: SAVED_HOUSE }])
    expect(saved()).toMatchObject({ savedId: 1 })
    cleanup()

    // つくりかけを けしても、ほぞんした おうちは のこる。
    window.localStorage.removeItem(KEY)
    renderGame()
    const list = screen.getByRole('list', { name: 'ほぞんした おうち' })
    fireEvent.click(within(list).getByRole('button', { name: '1ばんめの おうちを ひらく（2かいだて・へや 2こ）' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: /かんせい！/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ほぞんずみ/ })).toBeDisabled()

    // なおすと また ほぞん できて、おなじ ところに うわがき する。
    click('そとがわを なおす')
    fireEvent.click(within(screen.getByRole('list', { name: 'えらぶ もの' })).getByRole('button', { name: 'かべ' }))
    fireEvent.click(within(screen.getByRole('list', { name: 'かべ' })).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'false')!)
    click('かんせい！')
    click(/おうちを ほぞんする/)
    expect(album()).toHaveLength(1)
    expect(album()[0].design.exterior.wall).not.toBe('brick')

    // ほぞんした おうちを えらんで いても、さいしょからは けさずに のこす。
    click('さいしょから つくる')
    expect(screen.getByRole('dialog')).toHaveTextContent('ほぞんした おうちは のこるよ')
    click('あたらしく つくる')
    expect(window.localStorage.getItem(KEY)).toBeNull()
    expect(within(screen.getByRole('list', { name: 'ほぞんした おうち' })).getAllByRole('listitem')).toHaveLength(1)
  })

  test('ほぞんしていない つくりかけが ある ときは たしかめてから ひらき、けす ときも たしかめる', () => {
    window.localStorage.setItem(ALBUM_KEY, JSON.stringify([{ id: 4, savedAt: 1, design: SAVED_HOUSE }, { id: 7, savedAt: 2, design: { ...SAVED_HOUSE, rooms: [] } }]))
    startHouse(/^ひらや/, /^しかく/)
    click('もどる')
    click('もどる')
    const list = () => screen.getByRole('list', { name: 'ほぞんした おうち' })
    fireEvent.click(within(list()).getByRole('button', { name: /^2ばんめの おうちを ひらく/ }))
    expect(screen.getByRole('dialog')).toHaveTextContent('つくりかけの おうちは きえるよ')
    click('やめる')
    expect(saved()).toMatchObject({ houseType: 'hiraya', savedId: null })
    fireEvent.click(within(list()).getByRole('button', { name: /^2ばんめの おうちを ひらく/ }))
    click('ひらく')
    expect(screen.getByRole('heading', { name: /かんせい！/ })).toBeInTheDocument()
    expect(saved()).toMatchObject({ houseType: 'nikai', rooms: [], savedId: 7 })

    click('もどる')
    click('もどる')
    click('もどる')
    click('もどる')
    fireEvent.click(within(list()).getByRole('button', { name: '1ばんめの おうちを けす' }))
    expect(screen.getByRole('dialog')).toHaveTextContent('この おうちを けす？')
    click('やめる')
    expect(album()).toHaveLength(2)
    fireEvent.click(within(list()).getByRole('button', { name: '1ばんめの おうちを けす' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'けす' }))
    expect(screen.getByRole('status')).toHaveTextContent('ほぞんした おうちを けしたよ')
    expect(album().map((h: { id: number }) => h.id)).toEqual([7])
    // ひらいて いた おうちは そのまま ひらける。
    fireEvent.click(within(list()).getByRole('button', { name: /^1ばんめの おうちを ひらく/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('ほぞんが いっぱいの ときは どれと いれかえるか えらぶ', () => {
    const full = Array.from({ length: ALBUM_LIMIT }, (_, i) => ({ id: i + 1, savedAt: i, design: { ...SAVED_HOUSE, rooms: [] } }))
    window.localStorage.setItem(ALBUM_KEY, JSON.stringify(full))
    openDone(SAVED_HOUSE)
    click(/おうちを ほぞんする/)
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(`ほぞんは ${ALBUM_LIMIT}こ まで`)
    fireEvent.click(within(dialog).getByRole('button', { name: 'やめる' }))
    expect(album()).toEqual(full)

    click(/おうちを ほぞんする/)
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '3ばんめの おうちと いれかえる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(album()).toHaveLength(ALBUM_LIMIT)
    expect(album()[2]).toMatchObject({ id: 3, design: SAVED_HOUSE })
    expect(saved()).toMatchObject({ savedId: 3 })
  })

  test('ブラウザに ほぞん できない ときは おしえて、そのまま あそべる', () => {
    openDone(SAVED_HOUSE)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('QuotaExceededError') })
    click(/おうちを ほぞんする/)
    expect(screen.getByText('この ブラウザでは ほぞん できないよ')).toBeInTheDocument()
    expect(sounds()).toContain('blocked')
    expect(screen.getByRole('button', { name: /おうちを ほぞんする/ })).toBeEnabled()
  })

  test('おまかせで つくると、まどりも そとがわも きまった おうちが できあがり、もういちど おまかせ できる', () => {
    renderGame()
    click(/おまかせで つくる/)
    expect(screen.getByRole('heading', { name: /かんせい！ すてきな おうちが できたね/ })).toBeInTheDocument()
    const first = saved()
    expect(first.rooms.some((r: { type: string }) => r.type === 'entrance')).toBe(true)
    expect(sounds()).toContain('complete')

    // ほぞんしていない おうちは たしかめてから けす。
    click(/もういちど おまかせ/)
    expect(screen.getByRole('dialog', { name: 'いまの おうちを けして、おまかせで つくる？' })).toBeInTheDocument()
    click('やめる')
    expect(saved()).toEqual(first)

    vi.spyOn(Math, 'random').mockReturnValue(0)
    click(/もういちど おまかせ/)
    click('けして つくる')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(saved()).toMatchObject({ houseType: 'hiraya', shape: 'square', savedId: null })

    // ほぞんした あとなら たしかめずに つくりなおす。
    click(/おうちを ほぞんする/)
    vi.mocked(Math.random).mockReturnValue(0.99)
    click(/もういちど おまかせ/)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(saved()).toMatchObject({ houseType: 'yonkai', shape: 'ushape', savedId: null })
    expect(album()).toHaveLength(1)
  })

  test('こわれた ほぞんデータは つかわずに はじめから', () => {
    window.localStorage.setItem(KEY, '{broken')
    renderGame()
    expect(screen.queryByText('つくりかけの おうちが あるよ')).not.toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'いえの しゅるい' })).toBeInTheDocument()
  })

  test('おとボタンで BGM を とめて、また ながせる', () => {
    startHouse(/^ひらや/, /^しかく/)
    expect(startBgm).toHaveBeenCalledTimes(1)
    click('おとを けす')
    expect(stopBgm).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'おとを だす' })).toHaveAttribute('aria-pressed', 'false')
    click('おとを だす')
    expect(startBgm).toHaveBeenCalledTimes(2)
  })

  test('ホームから遅延ルートへ入り、まどり→かたち→しゅるい→ホームへ一階層ずつ戻る', async () => {
    resetGameShelfCache()
    const user = userEvent.setup()
    const { unmount } = render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    await user.click(screen.getByRole('link', { name: 'おうちづくり' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'おうちづくり' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^2かいだて/ }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^ながしかく/ }))
    expect(screen.getAllByRole('button', { name: 'もどる' })).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('list', { name: 'おうちの かたち' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('list', { name: 'いえの しゅるい' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
    unmount()
    expect(stopBgm).toHaveBeenCalled()
  })
})
