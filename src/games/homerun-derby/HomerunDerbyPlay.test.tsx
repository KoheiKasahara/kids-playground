import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { resetGameShelfCache } from '../../pages/gameShelfStore'
import HomerunDerbyPlay from './HomerunDerbyPlay'
import { FIRST_WINDUP, WINDUP, arrivalTime } from './derby'
import { playDerbySound } from './sounds'
import { STAGES } from './stages'

vi.mock('./sounds', () => ({ playDerbySound: vi.fn() }))

let frame: FrameRequestCallback | null
let time = 0
const store = new Map<string, string>()
beforeEach(() => {
  time = 0
  frame = null
  store.clear()
  vi.clearAllMocks()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v) } })
  vi.stubGlobal('requestAnimationFrame', vi.fn((cb: FrameRequestCallback) => { frame = cb; return 1 }))
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal('PointerEvent', class extends MouseEvent {
    pointerId: number
    isPrimary: boolean
    constructor(type: string, init: PointerEventInit = {}) { super(type, init); this.pointerId = init.pointerId ?? 1; this.isPrimary = init.isPrimary ?? true }
  })
  // jsdom は canvas を かけないので、絵は かかずに すすみかたと 画面の 文字だけ たしかめる。
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  // うった ボールの ばらつきを なくして、まいかい おなじ ように とばす。
  vi.spyOn(Math, 'random').mockReturnValue(.5)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function advance(frames: number) {
  act(() => { for (let i = 0; i < frames; i++) { time += 1000 / 60; frame?.(time) } })
}

const seconds = (s: number) => Math.round(s * 60)
const callout = () => document.querySelector('[data-outcome]')
const swingButton = () => screen.getByRole('button', { name: /バットを ふる/ })

function open(stageName: RegExp) {
  render(<MemoryRouter><HomerunDerbyPlay /></MemoryRouter>)
  fireEvent.click(screen.getByRole('button', { name: stageName }))
}

/** i ばんめの ボールを、とどく ときから offset びょう ずらして うち、けっかの もじが でるまで すすめる。 */
function playPitch(stageIndex: number, i: number, offset = 0, how: 'pointer' | 'key' = 'pointer') {
  const stage = STAGES[stageIndex]
  // まえの けっかの もじが きえた ときが、つぎの ボールの なげはじめ。
  for (let n = 0; n < 900 && callout(); n++) advance(1)
  advance(seconds((i === 0 ? FIRST_WINDUP : WINDUP) + arrivalTime(stage.pitches[i], stage.travel) + offset) + (i === 0 ? 1 : 0))
  if (how === 'key') fireEvent.keyDown(swingButton(), { key: ' ' })
  else fireEvent.pointerDown(swingButton(), { isPrimary: true, button: 0 })
  for (let n = 0; n < 900 && !callout(); n++) advance(1)
  return callout()
}

describe('homerun-derby play', () => {
  test('the opponent list starts with only the first opponent open', () => {
    render(<MemoryRouter><HomerunDerbyPlay /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'かっとばせ！ホームランダービー' })).toBeInTheDocument()
    expect(screen.getByLabelText('あつめた ほし 0 / 18')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 ペンギンの ペンタ' })).toBeEnabled()
    for (const [i, stage] of STAGES.entries()) {
      if (i === 0) continue
      expect(screen.getByRole('button', { name: `${i + 1} ${stage.name} まだ あそべないよ` })).toBeDisabled()
    }
  })

  test('hit home runs on time → win card with stars → next opponent → back to the list', () => {
    open(/^1 ペンギンの ペンタ/)
    expect(screen.getByTestId('stage-banner')).toHaveTextContent('ホームラン 2ほんで かち！')
    // なげる まえに おしても バットは ふらない（かんばんは きえる）。
    fireEvent.pointerDown(swingButton(), { isPrimary: true, button: 0 })
    expect(screen.queryByTestId('stage-banner')).not.toBeInTheDocument()
    advance(2)
    expect(playDerbySound).not.toHaveBeenCalledWith('swing')

    expect(playPitch(0, 0)).toHaveTextContent('ホームラン！')
    expect(playDerbySound).toHaveBeenCalledWith('hit')
    expect(screen.getByRole('status')).toHaveTextContent(/ホームラン！ \d+メートル/)
    expect(screen.getByLabelText('ホームラン 1ほん。めあては 2ほん')).toBeInTheDocument()
    expect(screen.getByLabelText('のこりの ボール 4こ')).toBeInTheDocument()
    expect(screen.getByLabelText('1きゅうめ ホームラン')).toBeInTheDocument()
    for (let i = 1; i < 5; i++) expect(playPitch(0, i), `${i + 1}きゅうめ`).toHaveTextContent('ホームラン！')

    for (let n = 0; n < 600 && !screen.queryByRole('dialog'); n++) advance(5)
    expect(screen.getByRole('dialog', { name: 'かち' })).toBeInTheDocument()
    expect(screen.getByLabelText('ほし 3こ')).toBeInTheDocument()
    expect(screen.getByText('ホームラン 5ほん')).toBeInTheDocument()
    expect(playDerbySound).toHaveBeenCalledWith('clear')
    expect(JSON.parse(store.get('homerun-derby-progress-v1')!)).toEqual({ penguin: 3 })

    fireEvent.click(screen.getByRole('button', { name: 'つぎの あいてへ →' }))
    expect(screen.getByTestId('stage-banner')).toHaveTextContent('カエルの ケロスケ')
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 ペンギンの ペンタ ほし3こ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2 カエルの ケロスケ' })).toBeEnabled()
    expect(screen.getByLabelText('あつめた ほし 3 / 18')).toBeInTheDocument()
    expect(cancelAnimationFrame).toHaveBeenCalled()
  })

  test('early swings and missed balls teach the timing, and losing offers a retry', () => {
    open(/^1 ペンギンの ペンタ/)
    const first = playPitch(0, 0, -.7)
    expect(first).toHaveTextContent('からぶり')
    expect(first).toHaveTextContent('はやすぎ！')
    expect(screen.getByLabelText('1きゅうめ ストライク')).toBeInTheDocument()
    // あとは ふらずに みおくる。
    advance(seconds(60))
    expect(screen.getByRole('dialog', { name: 'おしい' })).toBeInTheDocument()
    expect(screen.getByText('あと 2ほんで かちだったよ')).toBeInTheDocument()
    expect(playDerbySound).toHaveBeenCalledWith('fail')
    expect(store.has('homerun-derby-progress-v1')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '↻ もういちど' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByLabelText('のこりの ボール 5こ')).toBeInTheDocument()
    expect(screen.getByTestId('stage-banner')).toBeInTheDocument()
  })

  test('a slightly late swing goes foul to the right side and is counted', () => {
    open(/^1 ペンギンの ペンタ/)
    const result = playPitch(0, 0, .26)
    expect(result).toHaveAttribute('data-outcome', 'foul')
    expect(result).toHaveTextContent('ちょっと おそかった')
    expect(screen.getByLabelText('1きゅうめ ファウル')).toBeInTheDocument()
    expect(screen.getByLabelText('ホームラン 0ほん。めあては 2ほん')).toBeInTheDocument()
  })

  test('the space key swings too, and the sound button turns sound off and on', () => {
    open(/^1 ペンギンの ペンタ/)
    expect(playPitch(0, 0, 0, 'key')).toHaveTextContent('ホームラン！')
    const sound = screen.getByRole('button', { name: 'おとを けす' })
    expect(sound).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(sound)
    expect(screen.getByRole('button', { name: 'おとを だす' })).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(screen.getByRole('button', { name: 'おとを だす' }))
    expect(screen.getByRole('button', { name: 'おとを けす' })).toBeInTheDocument()
  })

  test('saved wins open later opponents and show their stars', () => {
    store.set('homerun-derby-progress-v1', JSON.stringify({ penguin: 2, frog: 1 }))
    render(<MemoryRouter><HomerunDerbyPlay /></MemoryRouter>)
    expect(screen.getByLabelText('あつめた ほし 3 / 18')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '1 ペンギンの ペンタ ほし2こ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '2 カエルの ケロスケ ほし1こ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '3 タコの タコハチ' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '4 ロボの ガッチャン まだ あそべないよ' })).toBeDisabled()
    expect(screen.getByLabelText('クリアずみ ほし 2こ')).toBeInTheDocument()
  })

  test('ホームから遅延ルートへ入り、しょうぶ→あいて えらび→ホームへ一階層ずつ戻る', async () => {
    resetGameShelfCache()
    const user = userEvent.setup()
    render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>)
    const shelf = screen.getByRole('region', { name: /ぜんぶの ゲーム/ })
    expect(within(shelf).getByRole('link', { name: 'かっとばせ！ホームランダービー' })).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'かっとばせ！ホームランダービー' }))
    expect(await screen.findByRole('heading', { name: 'かっとばせ！ホームランダービー' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '1 ペンギンの ペンタ' }))
    expect(screen.queryByRole('heading', { name: 'このゲームについて' })).not.toBeInTheDocument()
    expect(swingButton()).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('button', { name: '1 ペンギンの ペンタ' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'このゲームについて' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'もどる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
