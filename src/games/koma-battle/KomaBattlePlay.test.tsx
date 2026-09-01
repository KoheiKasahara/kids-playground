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
})

describe('KomaBattlePlay', () => {
  it('最初にコマの数を選ぶ画面が出る', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'コマバトル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /1こで まわす/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /2こで たいせん/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'まわせ！' })).toBeInTheDocument()
  })

  it('2個モードで開始でき、コマ2個ぶんの表示になる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(2)
    expect(screen.getByText('あかコマ')).toBeInTheDocument()
    expect(screen.getByText('あおコマ')).toBeInTheDocument()
  })

  it('2個それぞれのタイプ選択をエンジンへ渡す', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
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
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
    await user.click(screen.getByRole('button', { name: 'あかコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'あおコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual(['stamina', 'stamina'])
    expect(screen.getAllByText('スタミナ')).toHaveLength(2)
  })

  it('1個モードで開始でき、コマ1個だけになる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /1こで まわす/ }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(1)
    expect(screen.getByText('あかコマ')).toBeInTheDocument()
    expect(screen.queryByText('あおコマ')).not.toBeInTheDocument()
  })

  it('1個モードでも選んだタイプをエンジンへ渡す', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /1こで まわす/ }))
    await user.click(screen.getByRole('button', { name: 'あかコマ スタミナ' }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(1)
    expect(engineMock.options?.specs.map((spec) => spec.typeId)).toEqual(['stamina'])
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

  it('1個モードは勝敗ではなく終了として表示する', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /1こで まわす/ }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    finishWith({ kind: 'soloFinished', reason: 'stopped' })
    expect(screen.getByRole('heading', { name: 'おしまい！' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'かち！' })).not.toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
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
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
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

  it('コマの数を変えて再開すると、その数でエンジンが作り直される', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: /2こで たいせん/ }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))
    expect(engineMock.options?.komaCount).toBe(2)

    finishWith({ kind: 'draw', reason: 'simultaneous' })
    await user.click(screen.getByRole('button', { name: 'コマを えらびなおす' }))
    await user.click(screen.getByRole('button', { name: /1こで まわす/ }))
    await user.click(screen.getByRole('button', { name: 'まわせ！' }))

    expect(engineMock.options?.komaCount).toBe(1)
  })

  it('ホームへ戻るリンクがある', () => {
    renderGame()
    expect(screen.getByRole('link', { name: 'ホームへ' })).toHaveAttribute('href', '/')
  })
})
