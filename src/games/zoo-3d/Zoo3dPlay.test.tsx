import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import Zoo3dPlay from './Zoo3dPlay'
import { SPECIES } from './species'
import type { ZooEngineOptions } from './useZooEngine'
import { stampKinds } from './zukan'
import { areaById, speciesOfArea } from './zooMap'

const engine = vi.hoisted(() => ({
  options: undefined as ZooEngineOptions | undefined,
  select: vi.fn(), feed: vi.fn(() => true), setFollow: vi.fn(), overview: vi.fn(), retry: vi.fn(), setMode: vi.fn(),
  setArea: vi.fn(), walkInput: vi.fn(), goTo: vi.fn(), walkToEnclosure: vi.fn(),
}))
vi.mock('./useZooEngine', () => ({
  useZooEngine: (options: ZooEngineOptions) => {
    engine.options = options
    return {
      registerContainer: () => {}, retry: engine.retry, select: engine.select, feed: engine.feed, setFollow: engine.setFollow,
      overview: engine.overview, setMode: engine.setMode, setArea: engine.setArea, walkInput: engine.walkInput, goTo: engine.goTo,
      walkToEnclosure: engine.walkToEnclosure,
    }
  },
}))
vi.mock('./sounds', () => ({ playZooSound: vi.fn() }))

function renderZoo() {
  render(<MemoryRouter><Zoo3dPlay /></MemoryRouter>)
}
function ready() {
  act(() => engine.options?.onStatus('ready'))
}
beforeEach(() => localStorage.clear())
afterEach(() => vi.clearAllMocks())

describe('3Dどうぶつえんの画面', () => {
  test('読み込み中は行き先のエリアと進み具合を出し、失敗したら「もういちど」で読み直せる', async () => {
    const user = userEvent.setup()
    renderZoo()
    expect(screen.getByRole('heading', { name: '3Dどうぶつえん' })).toBeInTheDocument()
    expect(engine.options?.initialArea).toBe('savanna')
    expect(screen.getByRole('status')).toHaveTextContent('サバンナへ いくよ')
    act(() => engine.options?.onStatus('error'))
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engine.retry).toHaveBeenCalled()
  })

  test('いまのエリアの動物だけを選べて、選ぶと見に行き、えさ・おいかける・ずかんで ふれあえる', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    const picker = screen.getByRole('group', { name: 'どうぶつを えらぶ' })
    expect(within(picker).getAllByRole('button').map(b => b.getAttribute('aria-label'))).toEqual(
      speciesOfArea(areaById('savanna')).map(id => `${SPECIES[id].name}を みる`))
    await user.click(screen.getByRole('button', { name: 'ゾウを みる' }))
    expect(engine.goTo).toHaveBeenCalledWith('elephant-mom')
    act(() => { engine.options?.onSelect('elephant-mom'); engine.options?.onFollow(true); engine.options?.onActivity?.('sleep') })
    expect(screen.getByText('ねてるよ')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'りんごを あげる' }))
    expect(engine.feed).toHaveBeenCalledWith(undefined)
    expect(screen.getByRole('button', { name: 'おいかける' })).toHaveAttribute('aria-pressed', 'true')
    // ボタンで とくいわざを させるのではなく、自分でしているところを見つける
    expect(screen.queryByRole('button', { name: /パオーンを みる/ })).toBeNull()

    await user.click(screen.getByRole('button', { name: 'ずかんを みる' }))
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent('サバンナに いるよ')
    await user.click(within(dialog).getByRole('button', { name: 'とじる' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'ぜんたい' }))
    expect(engine.overview).toHaveBeenCalled()
  })

  test('よく見るとスタンプがたまり、ずかんに のって保存される', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    act(() => engine.options?.onObserve?.('giraffe', 'see'))
    expect(screen.getByText('スタンプ！')).toBeInTheDocument()
    expect(engine.options?.hasStamp?.('giraffe', 'see')).toBe(true)
    // 同じスタンプは2回押さない
    act(() => engine.options?.onObserve?.('giraffe', 'see'))
    act(() => engine.options?.onObserve?.('giraffe', 'Stretch'))
    expect(screen.getByRole('button', { name: 'ずかん（スタンプ 2こ）' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('zoo-3d-v1')!).zukan.giraffe).toEqual(['see', 'Stretch'])

    await user.click(screen.getByRole('button', { name: 'ずかん（スタンプ 2こ）' }))
    const dialog = screen.getByRole('dialog', { name: 'どうぶつ ずかん' })
    // 見つけた動物は名前が出て、まだの動物は ？ のまま
    expect(within(dialog).getByRole('button', { name: /^キリン。スタンプ 2こ/ })).toBeInTheDocument()
    expect(within(dialog).getAllByRole('button', { name: /まだ みつけて いない どうぶつ/ }).length).toBeGreaterThan(5)
    await user.click(within(dialog).getByRole('button', { name: /^キリン。/ }))
    expect(screen.getByRole('dialog', { name: 'キリン' })).toHaveTextContent('くびが とっても ながいよ')
  })

  test('「いま 〇〇してるよ」のお知らせから、見に行ける', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    act(() => engine.options?.onHint?.({ id: 'hippo-mom', species: 'hippo', kind: 'Splash' }))
    expect(screen.getByText('カバが「みずあび」してるよ！')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /みにいく/ }))
    expect(engine.goTo).toHaveBeenCalledWith('hippo-mom')
    act(() => engine.options?.onHint?.(null))
    expect(screen.queryByRole('button', { name: /みにいく/ })).toBeNull()
  })

  test('あるくモードでは、ボタンを押しているあいだ歩き、目の前の展示場の動物に えさを なげいれられる', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    await user.click(screen.getByRole('button', { name: 'あるいて みる' }))
    expect(engine.setMode).toHaveBeenCalledWith('walk')
    act(() => engine.options?.onMode('walk'))
    const forward = screen.getByRole('button', { name: 'まえへ あるく' })
    fireEvent.pointerDown(forward, { pointerId: 1 })
    expect(engine.walkInput).toHaveBeenLastCalledWith({ forward: 1, turn: 0 })
    fireEvent.pointerUp(forward, { pointerId: 1 })
    expect(engine.walkInput).toHaveBeenLastCalledWith({ forward: 0, turn: 0 })
    // キーボードでも、押しているあいだ向きを変えられる
    const left = screen.getByRole('button', { name: 'ひだりを むく' })
    fireEvent.keyDown(left, { key: 'Enter' })
    expect(engine.walkInput).toHaveBeenLastCalledWith({ forward: 0, turn: 1 })
    fireEvent.keyUp(left, { key: 'Enter' })

    // 地図の展示場を選ぶと、そこまで歩く
    await user.click(screen.getByRole('button', { name: /ゾウの ところへ いく/ }))
    expect(engine.walkToEnclosure).toHaveBeenCalledWith('elephant')

    // サバンナの展示場には、何種類もいるので、それぞれに えさを あげられる
    act(() => engine.options?.onNearby?.('savanna-plains'))
    const feed = screen.getByRole('group', { name: 'えさを なげいれる' })
    expect(within(feed).getAllByRole('button')).toHaveLength(3)
    await user.click(within(feed).getByRole('button', { name: 'シマウマに ほしくさを あげる' }))
    expect(engine.feed).toHaveBeenLastCalledWith('zebra')

    await user.click(screen.getByRole('button', { name: 'うえから みる' }))
    expect(engine.setMode).toHaveBeenLastCalledWith('overview')
  })

  test('ちずで ほかのエリアへ行ける。行ったエリアは覚えておく', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    await user.click(screen.getByRole('button', { name: /ちずを ひらく/ }))
    const dialog = screen.getByRole('dialog', { name: 'どこへ いく？' })
    expect(within(dialog).getByRole('button', { name: /サバンナ（いま ここ）/ })).toHaveAttribute('aria-current', 'location')
    await user.click(within(dialog).getByRole('button', { name: /もうじゅうの もり/ }))
    expect(engine.setArea).toHaveBeenCalledWith('wild')
    act(() => engine.options?.onArea('wild'))
    expect(screen.getByRole('button', { name: /いまは もうじゅうの もり/ })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'どうぶつを えらぶ' })).getByRole('button', { name: 'ライオンを みる' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('zoo-3d-v1')!).area).toBe('wild')
  })

  test('ちずから どうぶつレースじょうへ 行ける', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/games/zoo-3d']}>
        <Routes>
          <Route path="/games/zoo-3d" element={<Zoo3dPlay />} />
          <Route path="/games/zoo-3d/race" element={<p>レースじょうの がめん</p>} />
        </Routes>
      </MemoryRouter>,
    )
    ready()
    await user.click(screen.getByRole('button', { name: /ちずを ひらく/ }))
    const dialog = screen.getByRole('dialog', { name: 'どこへ いく？' })
    await user.click(within(dialog).getByRole('button', { name: /どうぶつレースじょう/ }))
    expect(screen.getByText('レースじょうの がめん')).toBeInTheDocument()
  })

  test('保存したエリアから はじまる', () => {
    localStorage.setItem('zoo-3d-v1', JSON.stringify({ zukan: { lion: ['see'] }, area: 'farm' }))
    renderZoo()
    expect(engine.options?.initialArea).toBe('farm')
    expect(engine.options?.hasStamp?.('lion', 'see')).toBe(true)
  })
  test('しいくいんさんの おねがいを ぜんぶ できると メダルがもらえ、つぎの おねがいが出る', async () => {
    const user = userEvent.setup()
    renderZoo()
    ready()
    await user.click(screen.getByRole('button', { name: 'おねがい（0こ できた / 3こ）' }))
    const dialog = screen.getByRole('dialog', { name: 'しいくいんさんの おねがい' })
    const items = within(within(dialog).getByRole('list', { name: 'おねがい' })).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent(/に .+を あげよう/)
    await user.click(within(dialog).getByRole('button', { name: 'とじる' }))

    // お題の中身は ランダムなので、エンジンの判定（wanted）から当てはまる できごとを探して起こす
    const here = speciesOfArea(areaById('savanna'))
    const events = here.flatMap(id => ['feed', 'see', 'sleep', ...SPECIES[id].specials.map(s => s.clip)].map(kind => [id, kind] as const))
    const wanted = () => events.filter(([id, kind]) => engine.options?.wanted?.(id, kind))
    const first = wanted()[0]
    act(() => engine.options?.onObserve?.(first[0], first[1]))
    expect(screen.getByText('おねがい できた！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'おねがい（1こ できた / 3こ）' })).toBeInTheDocument()
    // できた お題は もう「みにいく」の お知らせを出さない
    expect(engine.options?.wanted?.(first[0], first[1])).toBe(false)

    for (let i = 0; i < 3 && wanted().length; i++) {
      const [id, kind] = wanted()[0]
      act(() => engine.options?.onObserve?.(id, kind))
    }
    const medal = screen.getByRole('dialog', { name: 'メダル ゲット！' })
    expect(medal).toHaveTextContent('メダルは 1こ')
    expect(JSON.parse(localStorage.getItem('zoo-3d-v1')!).medals).toBe(1)
    await user.click(within(medal).getByRole('button', { name: 'つぎの おねがい' }))
    expect(screen.getByRole('button', { name: 'おねがい（0こ できた / 3こ）' })).toBeInTheDocument()
  })

  test('エリアの動物の スタンプが ぜんぶ そろうと お祝いが出る', () => {
    const farm = speciesOfArea(areaById('farm'))
    const zukan = Object.fromEntries(farm.map(id => [id, stampKinds(id)]))
    // ブタの さいごの スタンプ だけ まだ
    zukan.pig = stampKinds('pig').filter(k => k !== 'Oink')
    localStorage.setItem('zoo-3d-v1', JSON.stringify({ zukan, area: 'farm', medals: 2 }))
    renderZoo()
    ready()
    act(() => engine.options?.onObserve?.('pig', 'Oink'))
    expect(screen.getByRole('dialog', { name: 'ふれあい ひろば コンプリート！' })).toBeInTheDocument()
  })
})
