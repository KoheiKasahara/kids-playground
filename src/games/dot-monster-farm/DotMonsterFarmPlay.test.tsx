import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DotMonsterFarmPlay from './DotMonsterFarmPlay'
import { BATTLE_SECONDS, DT, type Battle } from './battle'
import { SAVE_KEY, newFarm, type Farm } from './farm'
import { createMonster, monsterFromWord, speciesById } from './monsters'
import { playCheer, playGreat, playGood, playFail, playRankUp, playWin, startBgm } from './sounds'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return { ...Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()])), startBgm: vi.fn(() => () => {}) }
})

let frame: FrameRequestCallback | null
let time: number
const store = new Map<string, string>()

beforeEach(() => {
  time = 0
  frame = null
  store.clear()
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
  })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

/** びょうすう ぶん フレームと タイマーを すすめる。 */
function advance(seconds: number) {
  act(() => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      time += 1000 / 60
      frame?.(time)
      vi.advanceTimersByTime(1000 / 60)
    }
  })
}

const saved = () => JSON.parse(store.get(SAVE_KEY) ?? 'null') as Farm | null
const battle = () => (window as unknown as { __monsterBattle: Battle }).__monsterBattle

function startWith(farm: Farm) {
  store.set(SAVE_KEY, JSON.stringify(farm))
  render(<MemoryRouter><DotMonsterFarmPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: /つづきから/ }))
}

/** いまの たたかいを プレイヤーの かち（または まけ）で おわらせる。 */
function finishRound(win: boolean) {
  advance(1.8)
  const b = battle()
  b.time = BATTLE_SECONDS - DT / 2
  b.f[win ? 1 : 0].hp = 1
  advance(3)
}

describe('dot-monster-farm', () => {
  test('いしを えらんで モンスターを よび、ぼくじょうで そだてはじめる', () => {
    render(<MemoryRouter><DotMonsterFarmPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'ドットの モンスターぼくじょう' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /つづきから/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /モンスターを よぶ/ }))
    expect(screen.getAllByRole('button', { name: /いし$/ })).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'あかい いし' }))
    expect(screen.getByRole('status')).toHaveTextContent('なにが うまれるかな')
    advance(4)
    const born = screen.getByRole('dialog', { name: 'うまれた' })
    expect(born).toHaveTextContent('ドラコが うまれた！')
    fireEvent.click(screen.getByRole('button', { name: 'この こを そだてる！' }))
    expect(screen.getByRole('heading', { name: 'ドラコ' })).toBeInTheDocument()
    expect(screen.getByText('4がつ 1しゅうめ', { selector: 'span' })).toBeInTheDocument()
    expect(saved()?.monster.species).toBe('draco')
    expect(JSON.parse(store.get('dot-monster-farm-dex-v1') ?? '[]')).toHaveLength(1)
    expect(startBgm).toHaveBeenCalledWith('ranch')
  })

  test('ことばで よぶと、その ことばの モンスターが うまれる', () => {
    render(<MemoryRouter><DotMonsterFarmPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /モンスターを よぶ/ }))
    fireEvent.change(screen.getByLabelText('ことばで よぶ'), { target: { value: 'たまごやき' } })
    fireEvent.click(screen.getByRole('button', { name: 'よぶ' }))
    advance(4)
    const expected = monsterFromWord('たまごやき')!
    expect(screen.getByRole('dialog', { name: 'うまれた' })).toHaveTextContent(`${expected.name}が うまれた！`)
    fireEvent.click(screen.getByRole('button', { name: 'この こを そだてる！' }))
    expect(saved()?.monster.stats).toEqual(expected.stats)
  })

  test('とっくんで おうえんすると のうりょくが のびて、つぎの しゅうに なる', () => {
    const start = newFarm(createMonster(speciesById('draco')!, 0, 1))
    startWith(start)
    fireEvent.click(screen.getByRole('button', { name: /^とっくん/ }))
    fireEvent.click(screen.getByRole('button', { name: /いわわり/ }))
    const canvas = screen.getByLabelText(/いわわりの とっくん/)
    for (let i = 0; i < 5; i++) fireEvent.pointerDown(canvas, { button: 0, pointerType: 'touch' })
    expect(playCheer).toHaveBeenCalledTimes(5)
    expect(screen.getByRole('meter', { name: 'おうえん' })).toHaveAttribute('aria-valuenow', '5')
    advance(4.5)
    expect(vi.mocked(playGreat).mock.calls.length + vi.mocked(playGood).mock.calls.length + vi.mocked(playFail).mock.calls.length).toBe(1)
    const card = screen.getByRole('dialog', { name: 'とっくんの けっか' })
    expect(card).toHaveTextContent(/ちから \+\d+/)
    fireEvent.click(screen.getByRole('button', { name: 'ぼくじょうへ もどる' }))
    expect(screen.getByText('4がつ 2しゅうめ', { selector: 'span' })).toBeInTheDocument()
    expect(saved()!.monster.stats.pow).toBeGreaterThan(start.monster.stats.pow)
    expect(saved()!.monster.fatigue).toBeGreaterThan(0)
  })

  test('おやつは 1しゅうに 1かい。やすむと つかれが とれる', () => {
    const tired = newFarm({ ...createMonster(speciesById('puru')!, 0, 1), fatigue: 80 })
    startWith(tired)
    expect(screen.getByText(/つかれてるよ/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^おやつ/ }))
    fireEvent.click(screen.getByRole('button', { name: /くだもの/ }))
    expect(saved()!.snacked).toBe(true)
    advance(2.5)
    expect(screen.getByRole('button', { name: /^おやつ/ })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /^やすむ/ }))
    advance(3.6)
    expect(saved()!.week).toBe(1)
    expect(saved()!.monster.fatigue).toBeLessThan(30)
    expect(screen.getByRole('button', { name: /^おやつ/ })).toBeEnabled()
  })

  test('モンスターを なでると なかよしが あがる', () => {
    startWith(newFarm({ ...createMonster(speciesById('mofu')!, 0, 1), bond: 20 }))
    fireEvent.keyDown(screen.getByLabelText(/ぼくじょう。モフが いるよ/), { key: 'Enter' })
    expect(saved()!.monster.bond).toBe(23)
    expect(saved()!.petted).toBe(true)
  })

  test('たいかいで 3かい かつと ランクが あがる', () => {
    startWith({ ...newFarm(createMonster(speciesById('goron')!, 0, 1)), week: 3 })
    expect(screen.getByText(/こんしゅうは Eランク たいかい/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /たいかいに でる/ }))
    expect(screen.getByText('1かいせん', { selector: 'strong' })).toBeInTheDocument()
    for (let round = 0; round < 3; round++) {
      finishRound(true)
      expect(playWin).toHaveBeenCalledTimes(round + 1)
      const dialog = screen.getByRole('dialog', { name: 'かち' })
      if (round < 2) {
        expect(dialog).toHaveTextContent('つぎは')
        fireEvent.click(screen.getByRole('button', { name: 'つぎの しあいへ' }))
      } else fireEvent.click(screen.getByRole('button', { name: 'けっかを みる' }))
    }
    const result = screen.getByRole('dialog', { name: 'たいかいの けっか' })
    expect(result).toHaveTextContent('ゆうしょう！')
    expect(result).toHaveTextContent('Dランクに あがった！')
    expect(playRankUp).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'ぼくじょうへ もどる' }))
    expect(saved()).toMatchObject({ rank: 1, wins: 3, week: 4 })
    expect(screen.getByLabelText('Dランク')).toBeInTheDocument()
  })

  test('たいかいで まけると ランクは そのまま', () => {
    startWith({ ...newFarm(createMonster(speciesById('piko')!, 0, 1)), week: 3 })
    fireEvent.click(screen.getByRole('button', { name: /たいかいに でる/ }))
    finishRound(false)
    expect(screen.getByRole('dialog', { name: 'まけ' })).toHaveTextContent('とっくんして また ちょうせん')
    fireEvent.click(screen.getByRole('button', { name: 'けっかを みる' }))
    expect(screen.getByRole('dialog', { name: 'たいかいの けっか' })).toHaveTextContent('0しょう')
    fireEvent.click(screen.getByRole('button', { name: 'ぼくじょうへ もどる' }))
    expect(saved()).toMatchObject({ rank: 0, wins: 0, week: 4 })
  })

  test('たたかいの わざボタンで わざを えらべる', () => {
    startWith({ ...newFarm(createMonster(speciesById('draco')!, 0, 1)), week: 3 })
    fireEvent.click(screen.getByRole('button', { name: /たいかいに でる/ }))
    advance(1.8)
    fireEvent.click(screen.getByRole('button', { name: /ひのこ/ }))
    expect(battle().f[0].plan?.name).toBe('ひのこ')
    advance(.05)
    expect(screen.getByRole('button', { name: /ひのこ/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /おまかせ/ }))
    expect(battle().auto).toBe(true)
  })

  test('もどるで タイトルへ。こわれた セーブは つかわない', () => {
    startWith(newFarm(createMonster(speciesById('fuwari')!, 0, 1)))
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /つづきから/ })).toHaveTextContent('ふわり')
    fireEvent.click(screen.getByRole('button', { name: /あたらしく よぶ/ }))
    expect(screen.getByRole('dialog', { name: 'あたらしく よぶ' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  test('こわれた セーブは はじめから', () => {
    store.set(SAVE_KEY, JSON.stringify({ v: 1, monster: { species: 'unicorn' } }))
    render(<MemoryRouter><DotMonsterFarmPlay /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /つづきから/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /モンスターを よぶ/ })).toBeInTheDocument()
  })

  test('おんがくを けすと おぼえておく', () => {
    render(<MemoryRouter><DotMonsterFarmPlay /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: 'おんがくを けす' }))
    expect(store.get('dot-monster-farm-music-v1')).toBe('off')
    vi.mocked(startBgm).mockClear()
    fireEvent.click(screen.getByRole('button', { name: /モンスターを よぶ/ }))
    expect(startBgm).not.toHaveBeenCalled()
  })
})
