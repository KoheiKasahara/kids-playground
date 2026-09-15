import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import PutterGolfPlay from './PutterGolfPlay'
import type { usePutterGolfEngine } from './usePutterGolfEngine'

type Options = Parameters<typeof usePutterGolfEngine>[0]
const engine = vi.hoisted(() => ({ options: undefined as Options | undefined, retry: vi.fn(), shoot: vi.fn(), turn: vi.fn(), setPower: vi.fn(), hint: vi.fn(), assist: vi.fn() }))
vi.mock('./usePutterGolfEngine', () => ({
  usePutterGolfEngine: (options: Options) => {
    engine.options = options
    return { registerContainer: () => {}, registerMapMarker: () => {}, retry: engine.retry, shoot: engine.shoot, turn: engine.turn, setPower: engine.setPower, hint: engine.hint, assist: engine.assist }
  },
}))
vi.mock('./golfSound', () => ({ golfSound: vi.fn() }))

const position = { x: 0, y: 0.15, z: 0 }
function renderGame() {
  render(<MemoryRouter initialEntries={['/games/putter-golf']}><PutterGolfPlay /></MemoryRouter>)
  act(() => engine.options?.onStatus('ready'))
}
function emit(...events: Parameters<Options['onEvent']>[0][]) {
  act(() => { for (const event of events) engine.options?.onEvent(event) })
}
function holeIn(strokes: number) {
  for (let i = 0; i < strokes; i++) emit({ kind: 'shot', power: 0.5, position })
  emit({ kind: 'cup', position })
}
beforeEach(() => { window.localStorage.clear() })
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('パターゴルフの画面', () => {
  test('コース・ボール・おおきいカップを えらんで スタートする', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PutterGolfPlay /></MemoryRouter>)
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeDisabled()
    act(() => engine.options?.onStatus('ready'))
    await user.click(screen.getByRole('button', { name: 'うみべコースを えらぶ' }))
    expect(engine.options?.course.id).toBe('beach')
    expect(screen.getByRole('button', { name: 'うみべコースを えらぶ' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'ピンクの ボール' }))
    expect(engine.options?.ballStyle).toBe('pink')
    await user.click(screen.getByRole('button', { name: /おおきい カップ/ }))
    expect(engine.options?.bigCup).toBe(true)
    expect(engine.options?.active).toBe(false)
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    expect(engine.options).toMatchObject({ active: true, holeIndex: 0, camera: 'ball' })
    expect(screen.getByRole('region', { name: 'ゴルフの そうさ' })).toBeInTheDocument()
    expect(screen.getByText('すなばは ころがりにくいよ')).toBeInTheDocument()
  })

  test('うつ・むき・つよさ・カメラ・ヒントのボタンが engine に届く', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    await user.click(screen.getByRole('button', { name: 'ひだりへ むける' }))
    await user.click(screen.getByRole('button', { name: 'みぎへ むける' }))
    expect(engine.turn.mock.calls).toEqual([[-1], [1]])
    await user.click(screen.getByRole('button', { name: /つよく/ }))
    expect(engine.setPower).toHaveBeenCalledWith(0.85)
    await user.click(screen.getByRole('button', { name: 'うつ！' }))
    expect(engine.shoot).toHaveBeenCalledOnce()
    await user.click(screen.getByRole('button', { name: 'ホール ぜんたいを みる' }))
    expect(engine.options?.camera).toBe('overview')
    await user.click(screen.getByRole('button', { name: 'ヒント' }))
    expect(engine.hint).toHaveBeenCalledOnce()
    act(() => engine.options?.onFeedback({ phase: 'rolling', strokes: 1, power: 0.5, aiming: false, returning: false }))
    expect(screen.getByRole('button', { name: 'うつ！' })).toBeDisabled()
  })

  test('コースの ホールを ぜんぶ回ると成績が出て、いちばん多い★を覚える', async () => {
    const user = userEvent.setup()
    renderGame()
    const holes = engine.options!.course.holes.length
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    holeIn(2)
    const result = screen.getByRole('region', { name: 'カップイン' })
    expect(within(result).getByText(/2かいで はいったよ/)).toBeInTheDocument()
    expect(within(result).getByLabelText('ほし 3こ')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'つぎの ホールへ ▶' }))
    expect(engine.options?.holeIndex).toBe(1)
    expect(screen.getByLabelText('うった かず 0')).toBeInTheDocument()
    holeIn(1)
    expect(screen.getByText('ホールインワン！')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'つぎの ホールへ ▶' }))
    holeIn(6)
    // 3ホールめまでで ★3+★3+★1。のこりのホールは めやすどおりの ★3 でうめる。
    let stars = 7
    for (let index = 2; index < holes - 1; index++) {
      await user.click(screen.getByRole('button', { name: 'つぎの ホールへ ▶' }))
      holeIn(engine.options!.course.holes[index + 1]!.par)
      stars += 3
    }
    await user.click(screen.getByRole('button', { name: 'けっかを みる ▶' }))
    const card = screen.getByRole('region', { name: 'けっか' })
    expect(within(card).getByText(/はらっぱコース クリア/)).toBeInTheDocument()
    expect(within(card).getAllByRole('row')).toHaveLength(holes + 1)
    expect(within(card).getByLabelText(`ほし ${stars}こ`)).toBeInTheDocument()
    expect(within(card).getByText('🎉 さいこう きろく！')).toBeInTheDocument()
    await user.click(within(card).getByRole('button', { name: 'コースを えらぶ' }))
    expect(screen.getByText(`さいこう ${stars}/${holes * 3} ★`)).toBeInTheDocument()
  })

  test('おたすけは5回うってから使え、水に落ちたら ひとこと出る', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    expect(screen.getByRole('button', { name: 'おたすけ' })).toBeDisabled()
    for (let i = 0; i < 5; i++) emit({ kind: 'shot', power: 0.5, position })
    expect(screen.getByRole('button', { name: 'おたすけ' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'おたすけ' }))
    expect(engine.assist).toHaveBeenCalledOnce()
    emit({ kind: 'splash', position })
    expect(screen.getByRole('status')).toHaveTextContent('ぽちゃん！')
    emit({ kind: 'returned' })
    expect(screen.getByRole('status')).toHaveTextContent('ここから もういちど！')
  })

  test('やりなおすと打った数が0へ戻り、もどるで コースえらびへ戻る', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'スタート！' }))
    emit({ kind: 'shot', power: 0.5, position }, { kind: 'shot', power: 0.5, position })
    expect(screen.getByLabelText('うった かず 2')).toBeInTheDocument()
    const attempt = engine.options?.attempt
    await user.click(screen.getByRole('button', { name: 'この ホールを やりなおす' }))
    expect(engine.options?.attempt).toBe(attempt! + 1)
    expect(screen.getByLabelText('うった かず 0')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /もどる/ }))
    expect(screen.getByRole('region', { name: 'コースを えらぶ' })).toBeInTheDocument()
    expect(engine.options?.active).toBe(false)
  })

  test('読み込みに失敗したら、スタートできず もういちど を出す', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><PutterGolfPlay /></MemoryRouter>)
    act(() => engine.options?.onStatus('error'))
    expect(screen.getByRole('alert')).toHaveTextContent('コースを よみこめなかったよ')
    expect(screen.getByRole('button', { name: 'スタート！' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engine.retry).toHaveBeenCalledOnce()
  })

  test('動きを減らす設定を engine へ伝える', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    renderGame()
    expect(engine.options?.reducedMotion).toBe(true)
  })
})
