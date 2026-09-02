import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import KomaBattlePlay from './KomaBattlePlay'
import type { KomaBattleEngineOptions } from './useKomaBattleEngine'
import type { MatchOutcome } from './komaOutcome'

// WebGLとRapierはjsdomで動かさず、エンジンへ渡った設定と
// エンジンから返した結果に対する画面の反応だけを検証する。
const engineMock = vi.hoisted(() => ({
  options: undefined as KomaBattleEngineOptions | undefined,
  registerContainer: vi.fn(),
  /** エンジンが何回作り直されたか。もういちどでの作り直しを数える。 */
  mountCount: 0,
}))

const soundMock = vi.hoisted(() => ({
  primeAudio: vi.fn(),
  playKomaBattleStartSound: vi.fn(),
}))

vi.mock('../../utils/quizSound', () => soundMock)

vi.mock('./useKomaBattleEngine', () => ({
  useKomaBattleEngine: (options: KomaBattleEngineOptions) => {
    engineMock.options = options
    engineMock.mountCount += 1
    return { registerContainer: engineMock.registerContainer }
  },
}))

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/games/koma-battle']}>
      <KomaBattlePlay />
    </MemoryRouter>,
  )
}

/** エンジンの代わりに決着を通知する。 */
function finishWith(outcome: MatchOutcome) {
  act(() => {
    engineMock.options?.onFinished(outcome)
  })
}

beforeEach(() => {
  engineMock.options = undefined
  engineMock.mountCount = 0
  engineMock.registerContainer.mockClear()
  soundMock.primeAudio.mockClear()
  soundMock.playKomaBattleStartSound.mockClear()
})

describe('KomaBattlePlay', () => {
  it('最初はbasicが選ばれ、4つのフィールドカードから選べる', () => {
    renderGame()
    expect(screen.getByRole('button', { name: 'ベーシック' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'バンパー' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'リングの きふく' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ながれる ゆか' })).toBeInTheDocument()
  })

  it('選んだフィールドをエンジンへ渡し、再戦・コマ選び直しでも保持する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'バンパー' }))
    expect(screen.getByRole('button', { name: 'バンパー' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(engineMock.options?.fieldId).toBe('bumper')

    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engineMock.options?.fieldId).toBe('bumper')
    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'コマを えらびなおす' }))
    expect(screen.getByRole('button', { name: 'バンパー' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('動く床フィールド（belt）を選ぶとエンジンへそのIDが渡る', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ながれる ゆか' }))
    expect(screen.getByRole('button', { name: 'ながれる ゆか' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(engineMock.options?.fieldId).toBe('belt')
  })

  it('コマ選択UIは表示せず、常に2個対戦になる', async () => {
    const user = userEvent.setup()
    renderGame()

    expect(screen.getByRole('heading', { name: 'コマバトル' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'コマを えらんでね' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /1こで まわす/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /2こで たいせん/ })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(2)
    expect(screen.getByText('あかコマ')).toBeInTheDocument()
    expect(screen.getByText('あおコマ')).toBeInTheDocument()
  })

  it('ヘッダーは左に戻る導線、中央にタイトルを置く', () => {
    renderGame()
    const header = screen.getByRole('banner')

    expect(header.firstElementChild).toHaveAttribute('aria-label', 'もどる')
    expect(header.querySelector('h1')).toHaveTextContent('コマバトル')
  })

  it('まわせ！を押すと、操作イベント中に音声を準備して開始音を1回鳴らす', async () => {
    const user = userEvent.setup()
    renderGame()

    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(soundMock.primeAudio).toHaveBeenCalledTimes(1)
    expect(soundMock.playKomaBattleStartSound).toHaveBeenCalledTimes(1)
  })

  it('もういちどでも開始音を鳴らし、古い結果を残さない', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    finishWith({ kind: 'win', winnerIndex: 0, loserIndex: 1, reason: 'stopped' })

    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(soundMock.primeAudio).toHaveBeenCalledTimes(2)
    expect(soundMock.playKomaBattleStartSound).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('button', { name: 'もういちど' })).not.toBeInTheDocument()
  })

  it('2個モードで開始でき、コマ2個ぶんの表示になる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(2)
    expect(screen.getByText('あかコマ')).toBeInTheDocument()
    expect(screen.getByText('あおコマ')).toBeInTheDocument()
  })

  it('2個それぞれのタイプ選択をエンジンへ渡す', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマ アタック' }))
    await user.click(screen.getByRole('button', { name: 'あおコマ ディフェンス' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual(['attack', 'defense'])
    expect(engineMock.options?.specs.map((spec) => spec.slotId)).toEqual(['player1', 'player2'])
    expect(screen.getByText('アタック')).toBeInTheDocument()
    expect(screen.getByText('ディフェンス')).toBeInTheDocument()
  })

  it('同じタイプを2個選んでも対戦を開始できる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'あおコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual(['stamina', 'stamina'])
    expect(screen.getAllByText('スタミナ')).toHaveLength(2)
  })

  it('対戦中は結果を表示しない', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(screen.queryByRole('button', { name: 'もういちど' })).not.toBeInTheDocument()
  })

  it('勝敗が決まると勝ったコマと負けた理由を表示する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'win', winnerIndex: 1, loserIndex: 0, reason: 'toppled' })

    // 勝者名はコマ一覧にも出るため、結果表示の中だけを見る。
    const result = within(screen.getByRole('status'))
    expect(result.getByRole('heading', { name: 'かち！' })).toBeInTheDocument()
    expect(result.getAllByText('✦')).toHaveLength(3)
    expect(result.getAllByText('✧')).toHaveLength(3)
    expect(result.getByText('あおコマ')).toBeInTheDocument()
    expect(result.getByText(/あかコマが たおれたよ/)).toBeInTheDocument()
  })

  it('場外で決まった場合もその理由を表示する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'win', winnerIndex: 0, loserIndex: 1, reason: 'outOfArena' })
    expect(screen.getByText(/あおコマが そとに でたよ/)).toBeInTheDocument()
  })

  it('引き分けを表示できる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'draw', reason: 'simultaneous' })
    expect(screen.getByRole('heading', { name: 'ひきわけ！' })).toBeInTheDocument()
  })

  it('もういちどで結果が消え、エンジンが新しいrunIdで作り直される', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    const firstRunId = engineMock.options!.runId

    finishWith({ kind: 'win', winnerIndex: 0, loserIndex: 1, reason: 'stopped' })
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    // 前回の結果表示が残らない。
    expect(screen.queryByRole('heading', { name: 'かち！' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'もういちど' })).not.toBeInTheDocument()
    // runIdが変わることでエンジンが世界を作り直す（前回のBodyを残さない）。
    expect(engineMock.options!.runId).toBeGreaterThan(firstRunId)
  })

  it('もういちどではタイプ選択を保持する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマ アタック' }))
    await user.click(screen.getByRole('button', { name: 'あおコマ ディフェンス' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual(['attack', 'defense'])
  })

  it('コマを選びなおしてもタイプ選択状態を保持する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマ アタック' }))
    await user.click(screen.getByRole('button', { name: 'あおコマ ディフェンス' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'コマを えらびなおす' }))

    expect(screen.getByRole('button', { name: 'あかコマ アタック' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'あおコマ ディフェンス' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('コマを選びなおしたあと別タイプへ変更して再開できる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマ アタック' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'コマを えらびなおす' }))

    await user.click(screen.getByRole('button', { name: 'あかコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual([
      'stamina',
      'balance',
    ])
  })

  it('何度もういちどを押しても、そのたびに新しいrunIdになる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    const runIds = [engineMock.options!.runId]
    for (let round = 0; round < 3; round += 1) {
      finishWith({ kind: 'draw', reason: 'simultaneous' })
      await user.click(screen.getByRole('button', { name: 'もういちど' }))
      runIds.push(engineMock.options!.runId)
    }
    expect(new Set(runIds).size).toBe(runIds.length)
  })

  it('コマを選びなおすと選択画面へ戻り、結果も消える', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    finishWith({ kind: 'win', winnerIndex: 0, loserIndex: 1, reason: 'toppled' })

    await user.click(screen.getByRole('button', { name: 'コマを えらびなおす' }))

    expect(screen.getByRole('button', { name: 'まわせ！' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'かち！' })).not.toBeInTheDocument()
  })

  it('選択画面からホームへ戻る「もどる」リンクがある', () => {
    renderGame()
    expect(screen.getByRole('link', { name: 'もどる' })).toHaveAttribute('href', '/')
  })

  it('色えらびボタンを押すまで色の一覧は出ない', () => {
    renderGame()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'みどり' })).not.toBeInTheDocument()
  })

  it('色えらびボタンで色を選ぶと、名前つきボタンとエンジンへ渡す色が変わる', async () => {
    const user = userEvent.setup()
    renderGame()

    await user.click(screen.getByRole('button', { name: 'あかコマの いろを かえる' }))
    expect(screen.getByRole('dialog', { name: 'あかコマの いろを かえる' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'みどり' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'みどりコマの いろを かえる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'みどりコマ バランス' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'あおコマの いろを かえる' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(engineMock.options?.specs.map((spec) => spec.colorId)).toEqual(['green', 'blue'])
  })

  it('相手が使っている色を選ぶと、相手の色と入れ替わる', async () => {
    const user = userEvent.setup()
    renderGame()

    await user.click(screen.getByRole('button', { name: 'あかコマの いろを かえる' }))
    await user.click(screen.getByRole('button', { name: 'あお' }))

    // 元1P(あか)は「あお」を得て、元2Pは1Pが手放した「あか」へ入れ替わる。
    expect(screen.getByRole('button', { name: 'あおコマの いろを かえる' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'あかコマの いろを かえる' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(engineMock.options?.specs.map((spec) => spec.colorId)).toEqual(['blue', 'red'])
  })

  it('色を閉じるボタンで一覧を閉じられる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'あかコマの いろを かえる' }))
    await user.click(screen.getByRole('button', { name: 'とじる' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
