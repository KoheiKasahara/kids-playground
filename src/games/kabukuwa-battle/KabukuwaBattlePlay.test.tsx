import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import KabukuwaBattlePlay from './KabukuwaBattlePlay'
import type { Battle } from './battle'
import { SPECIES } from './species'
import { playBuzz, playGo, playReady, playWin } from './sounds'

vi.mock('./sounds', async importOriginal => {
  const actual = await importOriginal<typeof import('./sounds')>()
  return Object.fromEntries(Object.keys(actual).map(key => [key, vi.fn()]))
})

let frame: FrameRequestCallback | null
let time: number

beforeEach(() => {
  time = 0
  frame = null
  vi.clearAllMocks()
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn(() => { frame = null }))
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

const battle = () => (window as unknown as { __kabukuwaBattle?: Battle }).__kabukuwaBattle

function renderGame() {
  return render(<MemoryRouter><KabukuwaBattlePlay /></MemoryRouter>)
}

/** ヘラクレス たい コーカサス、ばしょを えらぶ ところまで すすむ。 */
function chooseHerculesVsCaucasus() {
  fireEvent.click(screen.getByRole('button', { name: /^ヘラクレスオオカブト/ }))
  fireEvent.click(screen.getByRole('button', { name: 'ヘラクレスに けってい！' }))
  fireEvent.click(screen.getByRole('button', { name: /^コーカサスオオカブト/ }))
  fireEvent.click(screen.getByRole('button', { name: 'コーカサスと たたかう！' }))
}

describe('カブクワ バトル', () => {
  test('はじめは じぶんの むしを えらぶ。12しゅるいの ずかんと つよさが みられる', () => {
    renderGame()
    expect(screen.getByRole('heading', { level: 1, name: 'カブクワ バトル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByText('たたかわせる むしを えらぼう')).toBeInTheDocument()
    for (const sp of SPECIES) expect(screen.getByRole('button', { name: `${sp.name}（${sp.home}）` })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'カブトムシ' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^ヘラクレスオオカブト/ }))
    expect(screen.getByRole('heading', { name: 'ヘラクレスオオカブト' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^ヘラクレスオオカブト/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('おおきさ 10（10の うち）')).toBeInTheDocument()
    expect(screen.getByLabelText('ちから 9（10の うち）')).toBeInTheDocument()
    expect(screen.getByLabelText('はやさ 4（10の うち）')).toBeInTheDocument()
    expect(screen.getByText('50〜172mm')).toBeInTheDocument()
    expect(playBuzz).toHaveBeenCalledWith(SPECIES.find(sp => sp.id === 'hercules')!.voice)
  })

  test('じぶん → あいて → ばしょ の じゅんに えらび、もどるで ひとつ まえへ', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: /^ノコギリクワガタ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ノコギリに けってい！' }))
    expect(screen.getByText(/ノコギリと たたかう/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /おまかせ/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByText('たたかわせる むしを えらぼう')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'ノコギリクワガタ' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ノコギリに けってい！' }))
    fireEvent.click(screen.getByRole('button', { name: /^ミヤマクワガタ/ }))
    fireEvent.click(screen.getByRole('button', { name: 'ミヤマと たたかう！' }))
    expect(screen.getByLabelText('ノコギリクワガタ たい ミヤマクワガタ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'よるの き の えだ（よこから みる）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もりの まるた（ななめから みる）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'きりかぶ どひょう（うえから みる）' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'ミヤマクワガタ' })).toBeInTheDocument()
  })

  test('おまかせで あいてを えらぶと、じぶんと ちがう むしに なる', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'カブトムシに けってい！' }))
    fireEvent.click(screen.getByRole('button', { name: /おまかせ/ }))
    expect(screen.getByLabelText('カブトムシ たい ヘラクレスオオカブト')).toBeInTheDocument()
  })

  test('ばしょを えらぶと みているだけで たたかいが すすみ、しょうぶが つくと けっかが でる', () => {
    renderGame()
    chooseHerculesVsCaucasus()
    fireEvent.click(screen.getByRole('button', { name: 'きりかぶ どひょう（うえから みる）' }))
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
    expect(playReady).toHaveBeenCalled()
    expect(screen.getByRole('meter', { name: 'ヘラクレスの げんき' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('meter', { name: 'コーカサスの げんき' })).toBeInTheDocument()

    advance(2.4)
    expect(playGo).toHaveBeenCalled()
    expect(battle()?.state).toBe('fight')

    // あいてを つかれきらせて、にげださせる。
    act(() => { battle()!.f[1].st = 0 })
    advance(.5)
    expect(battle()?.state).toBe('over')
    expect(screen.getByRole('status')).toHaveTextContent('コーカサスは にげだした！')
    expect(screen.getByRole('meter', { name: 'コーカサスの げんき' })).toHaveAttribute('aria-valuenow', '0')

    advance(3)
    expect(playWin).toHaveBeenCalled()
    expect(screen.getByRole('heading', { name: 'ヘラクレスの かち！' })).toBeInTheDocument()
    expect(screen.getByText('コーカサスは かなわないと おもって にげだした！')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(screen.queryByRole('heading', { name: 'ヘラクレスの かち！' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('はっけよい')
  })

  test('けっかから あいて・ばしょを かえられる', () => {
    renderGame()
    chooseHerculesVsCaucasus()
    fireEvent.click(screen.getByRole('button', { name: 'もりの まるた（ななめから みる）' }))
    advance(2.4)
    act(() => { battle()!.f[0].st = 0 })
    advance(3.5)
    expect(screen.getByRole('heading', { name: 'コーカサスの かち！' })).toBeInTheDocument()
    expect(screen.getByText('ざんねん…')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'ばしょを かえる' }))
    expect(screen.getByText('たたかう ばしょを えらぼう')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'よるの き の えだ（よこから みる）' }))
    advance(2.4)
    act(() => { battle()!.f[1].st = 0 })
    advance(3.5)
    fireEvent.click(screen.getByRole('button', { name: 'あいてを かえる' }))
    expect(screen.getByText(/ヘラクレスと たたかう/)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'コーカサスオオカブト' })).toBeInTheDocument()
  })

  test('おなじ むしどうしでも じぶんと あいてを みわけられる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'カブトムシに けってい！' }))
    fireEvent.click(screen.getByRole('button', { name: /^カブトムシ（/ }))
    fireEvent.click(screen.getByRole('button', { name: 'カブトムシと たたかう！' }))
    fireEvent.click(screen.getByRole('button', { name: 'よるの き の えだ（よこから みる）' }))
    expect(screen.getByRole('meter', { name: 'じぶんの カブトムシの げんき' })).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: 'あいての カブトムシの げんき' })).toBeInTheDocument()
  })

  test('たたかいの とちゅうで もどると ばしょ えらびに もどり、すすみかたも とまる', () => {
    const { unmount } = renderGame()
    chooseHerculesVsCaucasus()
    fireEvent.click(screen.getByRole('button', { name: 'よるの き の えだ（よこから みる）' }))
    advance(1)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByText('たたかう ばしょを えらぼう')).toBeInTheDocument()
    expect(cancelAnimationFrame).toHaveBeenCalled()
    expect(battle()).toBeUndefined()

    fireEvent.click(screen.getByRole('button', { name: 'きりかぶ どひょう（うえから みる）' }))
    advance(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  test('おとの ON/OFF を きりかえられる', () => {
    renderGame()
    fireEvent.click(screen.getByRole('button', { name: 'おとを けす' }))
    expect(screen.getByRole('button', { name: 'おとを だす' })).toHaveAttribute('aria-pressed', 'false')
  })
})
