import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import HouseBuilderPlay from './HouseBuilderPlay'
import { playHouseSound, startBgm } from './sounds'

vi.mock('./sounds', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...actual, playHouseSound: vi.fn(), startBgm: vi.fn(() => stopBgm) }
})

const stopBgm = vi.fn()
const KEY = 'house-builder-v1'

beforeEach(() => {
  window.localStorage.clear()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
const cell = (x: number, y: number) => `よこ ${x}・たて ${y} に おく`
const saved = () => JSON.parse(window.localStorage.getItem(KEY) ?? 'null')
const sounds = () => vi.mocked(playHouseSound).mock.calls.map(([kind]) => kind)

function renderGame() {
  return render(<MemoryRouter><HouseBuilderPlay /></MemoryRouter>)
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

  test('そとがわを えらんで かんせいさせ、そとと なかを みられる', () => {
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
    // そとの え: いぬ・くるま・ドアを タップすると こえが でる。
    const front = screen.getByRole('group', { name: 'できあがった おうちの そとがわ' })
    fireEvent.click(within(front).getByRole('button', { name: 'いぬ' }))
    expect(screen.getByText('わん わん！')).toBeInTheDocument()
    fireEvent.click(within(front).getByRole('button', { name: 'くるま 2' }))
    expect(screen.getByText('ブッブー！ おでかけ しよう')).toBeInTheDocument()
    fireEvent.keyDown(within(front).getByRole('button', { name: 'げんかんの ドア' }), { key: 'Enter' })
    expect(screen.getByText('ピンポーン！ おかえりなさい')).toBeInTheDocument()

    // なか: かいごとの まどりで へやを タップできる。
    click('なかを みる')
    expect(screen.getAllByText(/^[12]かい$/).map((e) => e.textContent)).toEqual(['2かい', '1かい'])
    fireEvent.click(screen.getByRole('button', { name: '2かいの うちゅうの こどもべや' }))
    expect(screen.getByText('うちゅうの こどもべや「なにして あそぶ？」')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1かいの おはなの トイレ' }))
    expect(sounds()).toContain('flush')

    // なおす と さいしょから。
    click('まどりを なおす')
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
