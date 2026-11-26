import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SPECIES } from '../species'
import { commentary } from './commentary'
import { loadRecord } from './raceRecord'
import { raceById, RACES } from './races'
import type { RaceEvent, RacePlan } from './raceSim'
import type { RaceEngineOptions } from './useRaceEngine'
import ZooRacePlay from './ZooRacePlay'

const engine = vi.hoisted(() => ({
  options: undefined as RaceEngineOptions | undefined,
  retry: vi.fn(), showReception: vi.fn(), prepare: vi.fn(), start: vi.fn(), showPodium: vi.fn(), setCheer: vi.fn(),
}))
vi.mock('./useRaceEngine', () => ({
  useRaceEngine: (options: RaceEngineOptions) => {
    engine.options = options
    return {
      registerContainer: () => {}, retry: engine.retry, showReception: engine.showReception, prepare: engine.prepare,
      start: engine.start, showPodium: engine.showPodium, setCheer: engine.setCheer,
    }
  },
}))
vi.mock('../sounds', () => ({ playZooSound: vi.fn() }))

function renderRace() {
  render(
    <MemoryRouter initialEntries={['/games/zoo-3d/race']}>
      <Routes>
        <Route path="/games/zoo-3d/race" element={<ZooRacePlay />} />
        <Route path="/games/zoo-3d" element={<p>どうぶつえんの がめん</p>} />
      </Routes>
    </MemoryRouter>,
  )
}
function ready() {
  act(() => engine.options?.onStatus('ready'))
}
/** おうえんの ひとこと（「がんばれー！」は 別の かたまり）。 */
function cheerLine(text: RegExp) {
  return screen.getByText((_, el) => el?.tagName === 'P' && text.test(el.textContent ?? ''))
}
function lastPlan(): RacePlan {
  return engine.prepare.mock.lastCall![0] as RacePlan
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
})

describe('どうぶつレースじょうの画面', () => {
  test('うけつけで ようこそと言われ、読み込めたら レースを えらべる。もどると どうぶつえんへ', async () => {
    const user = userEvent.setup()
    renderRace()
    expect(screen.getByRole('heading', { name: 'どうぶつレースじょう' })).toBeInTheDocument()
    expect(screen.getByText(/ようこそ、どうぶつレースじょうへ/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('うけつけへ いくよ')
    expect(screen.getByRole('button', { name: /レースを えらぶ/ })).toBeDisabled()
    ready()
    await user.click(screen.getByRole('button', { name: /レースを えらぶ/ }))
    const list = screen.getByRole('group', { name: 'どの レースを みる？' })
    expect(within(list).getAllByRole('button')).toHaveLength(RACES.length)
    expect(within(list).getByRole('button', { name: /^こおりと みずの レース。みずべに すむ どうぶつの レース/ })).toBeInTheDocument()

    // 1かい もどると うけつけ、もう1かい もどると どうぶつえん
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: /レースを えらぶ/ })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'どうぶつえんへ もどる' }))
    expect(screen.getByText('どうぶつえんの がめん')).toBeInTheDocument()
  })

  test('レースを えらぶと、その種目の どうぶつが レーンじゅんに 出走表に ならび、おうえんを えらべる', async () => {
    const user = userEvent.setup()
    renderRace()
    ready()
    await user.click(screen.getByRole('button', { name: /レースを えらぶ/ }))
    await user.click(screen.getByRole('button', { name: /^サバンナ ダッシュ。/ }))
    const plan = lastPlan()
    expect(plan.race).toBe('savanna')
    expect(screen.getByText('まっすぐな つちの みちで、はやさ くらべ！')).toBeInTheDocument()
    const runners = within(screen.getByRole('group', { name: 'おうえんする どうぶつを えらぶ' })).getAllByRole('button')
    const byLane = [...plan.runners].sort((a, b) => a.lane - b.lane)
    expect(runners.map(b => b.getAttribute('aria-label')?.split('。')[0])).toEqual(
      byLane.map(r => `${r.lane + 1}ばん ${SPECIES[r.species].name}`))
    // きょうの ちょうし と、とくちょうの ひとこと
    const cheetah = runners.find(b => b.getAttribute('aria-label')?.includes('チーター'))!
    expect(cheetah).toHaveAccessibleName(/きょうは (ぜっこうちょう|げんき|ちょっと ねむそう)。せかいいち はやいけど/)

    await user.click(cheetah)
    expect(cheetah).toHaveAttribute('aria-pressed', 'true')
    const index = plan.runners.findIndex(r => r.species === 'cheetah')
    expect(engine.setCheer).toHaveBeenLastCalledWith(index)
    expect(screen.getByText('チーターを おうえん するよ！')).toBeInTheDocument()
    // もういちど タップすると やめる
    await user.click(cheetah)
    expect(cheetah).toHaveAttribute('aria-pressed', 'false')
    expect(engine.setCheer).toHaveBeenLastCalledWith(null)

    // ほかの レースへ もどると、うけつけの景色で えらびなおす
    await user.click(screen.getByRole('button', { name: 'ほかの レース' }))
    expect(engine.showReception).toHaveBeenCalled()
    expect(screen.getByRole('group', { name: 'どの レースを みる？' })).toBeInTheDocument()
  })

  test('よーい どんで 観戦がはじまり、じっきょう・順位が出て、みんな ゴールすると 表彰式と きろく', async () => {
    const user = userEvent.setup()
    renderRace()
    ready()
    await user.click(screen.getByRole('button', { name: /レースを えらぶ/ }))
    await user.click(screen.getByRole('button', { name: /^ぴょんぴょん ハードル。/ }))
    const plan = lastPlan()
    const cheer = plan.order[plan.order.length - 1]
    const cheerName = SPECIES[plan.runners[cheer].species].name
    await user.click(screen.getByRole('button', { name: new RegExp(`^\\d+ばん ${cheerName}。`) }))
    // よーい どんの 3・2・1 は 時計を すすめて たしかめる
    vi.useFakeTimers()
    fireEvent.click(screen.getByRole('button', { name: /スタート！/ }))
    expect(screen.getByRole('status')).toHaveTextContent('3')
    act(() => { vi.advanceTimersByTime(800) })
    expect(screen.getByRole('status')).toHaveTextContent('2')
    act(() => { vi.advanceTimersByTime(1600) })
    vi.useRealTimers()
    expect(engine.start).toHaveBeenCalledTimes(1)
    // おうえんしている どうぶつの ゴールも じっきょうに入る
    const narration = engine.start.mock.lastCall![0] as RaceEvent[]
    expect(narration).toContainEqual(expect.objectContaining({ type: 'finish', runner: cheer }))
    expect(cheerLine(new RegExp(`^📣 \\S+${cheerName} がんばれー！`))).toBeInTheDocument()

    // 順位と じっきょう
    const order = [...plan.order].reverse()
    act(() => engine.options?.onRanking?.(order, 0.4))
    const strip = screen.getByRole('list', { name: 'いまの じゅんい' })
    expect(within(strip).getAllByRole('listitem')[0]).toHaveAccessibleName(new RegExp(`^1い \\d+ばん ${SPECIES[plan.runners[order[0]].species].name}`))
    expect(cheerLine(new RegExp(`${cheerName}は いま 1い！ がんばれー！`))).toBeInTheDocument()
    const lead = { t: 3, runner: order[0], type: 'lead' } as RaceEvent
    act(() => engine.options?.onEvent?.(lead))
    expect(screen.getByRole('status')).toHaveTextContent(commentary(plan, lead, cheer).text)
    expect(screen.queryByRole('button', { name: /けっかを みる/ })).toBeNull()
    act(() => engine.options?.onEvent?.({ t: 20, runner: plan.order[0], type: 'finish', place: 1 }))
    expect(screen.getByText(`ゴール！ 1ちゃくは ${SPECIES[plan.runners[plan.order[0]].species].name}！`)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /けっかを みる/ })).toBeInTheDocument()
    // おうえんしている どうぶつが ゴールしたら「がんばれー」は おしまい
    act(() => engine.options?.onEvent?.({ t: 26, runner: cheer, type: 'finish', place: plan.order.length }))
    expect(cheerLine(new RegExp(`${cheerName}は ${plan.order.length}ちゃくで ゴール！$`))).toBeInTheDocument()

    act(() => engine.options?.onFinish?.())
    expect(engine.showPodium).toHaveBeenCalledTimes(1)
    const results = within(screen.getByRole('list', { name: 'ちゃくじゅん' })).getAllByRole('listitem')
    expect(results.map(li => li.textContent)).toEqual(plan.order.map((i, place) =>
      expect.stringContaining(`${place + 1}ちゃく ${SPECIES[plan.runners[i].species].name}`)))
    expect(screen.getByText(new RegExp(`おうえんした ${cheerName}は ${plan.order.length}ちゃく。よく がんばったね！`))).toBeInTheDocument()
    expect(loadRecord().hurdle).toEqual([plan.runners[plan.order[0]].species])

    // もういちど: 同じ種目で、あたらしい レースを用意する
    await user.click(screen.getByRole('button', { name: /もういちど/ }))
    expect(engine.prepare).toHaveBeenCalledTimes(2)
    expect(lastPlan().race).toBe('hurdle')
    expect(lastPlan()).not.toBe(plan)
  })

  test('1ちゃくに なった どうぶつは、レースの カードに きろくされる', async () => {
    const user = userEvent.setup()
    localStorage.setItem('zoo-3d-race-v1', JSON.stringify({ wins: { ice: ['penguin', 'lion', 'polar_bear'], moon: ['cat'] } }))
    renderRace()
    ready()
    await user.click(screen.getByRole('button', { name: /レースを えらぶ/ }))
    // ほかの種目の動物や、ない種目は 数えない
    expect(screen.getByRole('button', { name: /^こおりと みずの レース。.*1ちゃくに なった どうぶつ 2\/5/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^サバンナ ダッシュ。.*0\/5/ })).toBeInTheDocument()
  })

  test('ひらけなかったら「もういちど」で 読み直し、レースは 出走表から やりなおす', async () => {
    const user = userEvent.setup()
    renderRace()
    act(() => engine.options?.onStatus('error'))
    expect(screen.getByRole('alert')).toHaveTextContent('レースじょうを ひらけなかったよ')
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engine.retry).toHaveBeenCalled()
  })
})

describe('じっきょうの ことば', () => {
  const plan = {
    race: 'forest', distance: 112, order: [0, 1], end: 30,
    runners: [
      { species: 'panda', lane: 0 }, { species: 'fox', lane: 1 },
    ],
    events: [{ t: 2, runner: 1, type: 'lead' }, { t: 5, runner: 0, type: 'lead' }],
  } as unknown as RacePlan

  test('どうぶつの なまえと、とくいわざの なまえで 伝える', () => {
    expect(commentary(plan, plan.events[0], null).text).toBe('キツネが とびだした！')
    expect(commentary(plan, plan.events[1], null).text).toBe('パンダが トップに たった！')
    expect(commentary(plan, { t: 6, runner: 0, type: 'quirk', clip: 'Roll' }, null).text).toBe('パンダが「ころりん」！ よりみち しちゃった')
    expect(commentary(plan, { t: 9, runner: 1, type: 'finish', place: 2 }, null).text).toBe('2ちゃくは キツネ')
    expect(raceById('forest').runners).toContain('panda')
  })
})
