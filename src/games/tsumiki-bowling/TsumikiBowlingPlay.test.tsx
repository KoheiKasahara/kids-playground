import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TsumikiBowlingPlay from './TsumikiBowlingPlay'
import type {
  ThrowSettledResult,
  TsumikiBowlingEngineOptions,
} from './useTsumikiBowlingEngine'
import { THROWS_PER_GAME } from './bowlingGame'

// WebGLとRapierはjsdomで動かさず、エンジンへ渡った設定と
// エンジンからの通知に対する画面の反応だけを検証する。
const engineMock = vi.hoisted(() => ({
  options: undefined as TsumikiBowlingEngineOptions | undefined,
  registerContainer: vi.fn(),
  setBallId: vi.fn(),
  /** エンジンが何回作り直されたか（もういちどでの作り直しを数える）。 */
  mountCount: 0,
}))

vi.mock('./useTsumikiBowlingEngine', () => ({
  useTsumikiBowlingEngine: (options: TsumikiBowlingEngineOptions) => {
    engineMock.options = options
    engineMock.mountCount += 1
    return { registerContainer: engineMock.registerContainer, setBallId: engineMock.setBallId }
  },
}))

function renderGame() {
  return render(
    <MemoryRouter initialEntries={['/games/tsumiki-bowling']}>
      <TsumikiBowlingPlay />
    </MemoryRouter>,
  )
}

function startThrow() {
  act(() => {
    engineMock.options?.onThrowStart(1)
  })
}

function settleThrow(result: Partial<ThrowSettledResult> & { toppled: number }) {
  act(() => {
    engineMock.options?.onThrowSettled({
      throwNumber: 1,
      isLastThrow: false,
      ...result,
    })
  })
}

/** 1投ぶんを通しで進める。 */
function playThrow(toppled: number, throwNumber: number) {
  startThrow()
  settleThrow({
    toppled,
    throwNumber,
    isLastThrow: throwNumber >= THROWS_PER_GAME,
  })
}

beforeEach(() => {
  engineMock.options = undefined
  engineMock.mountCount = 0
  engineMock.registerContainer.mockClear()
  engineMock.setBallId.mockClear()
})

describe('TsumikiBowlingPlay', () => {
  it('最初はあそびかたの案内と、0この表示から始まる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'つみきボウリング' })).toBeInTheDocument()
    expect(screen.getByText('たまを ひっぱって はなすと ビューン！')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('たおした つみき0こ')
    expect(engineMock.registerContainer).toHaveBeenCalled()
  })

  it('残りの投球数が分かる表示になっている', () => {
    renderGame()
    expect(
      screen.getByLabelText(`${THROWS_PER_GAME}かい なげるうちの 1かいめ`),
    ).toBeInTheDocument()
    playThrow(4, 1)
    expect(
      screen.getByLabelText(`${THROWS_PER_GAME}かい なげるうちの 2かいめ`),
    ).toBeInTheDocument()
  })

  it('ドラッグ中はパワーが3段階の言葉で出る', () => {
    renderGame()
    act(() => engineMock.options?.onAimChange(0.1))
    expect(screen.getByText('よわい')).toBeInTheDocument()
    act(() => engineMock.options?.onAimChange(0.5))
    expect(screen.getByText('ふつう')).toBeInTheDocument()
    act(() => engineMock.options?.onAimChange(0.95))
    expect(screen.getByText('つよい！')).toBeInTheDocument()
    act(() => engineMock.options?.onAimChange(null))
    expect(screen.queryByText('つよい！')).not.toBeInTheDocument()
  })

  it('崩れている最中も、倒れた数が増えていく', () => {
    renderGame()
    startThrow()
    act(() => engineMock.options?.onToppledProgress(3))
    expect(screen.getByRole('status')).toHaveTextContent('3こ')
    act(() => engineMock.options?.onToppledProgress(9))
    expect(screen.getByRole('status')).toHaveTextContent('9こ')
  })

  it('1投終わると、その投球で倒した数を知らせる', () => {
    renderGame()
    playThrow(7, 1)
    expect(screen.getByText('7こ たおれた！')).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('7こ')
  })

  it('1個も倒せなくても失敗扱いにせず、次を促す', () => {
    renderGame()
    playThrow(0, 1)
    expect(screen.getByText('つぎは あたるかな？')).toBeInTheDocument()
  })

  it('2投目からは案内の文が変わる', () => {
    renderGame()
    playThrow(2, 1)
    expect(screen.getByText('つぎも ひっぱって はなしてね')).toBeInTheDocument()
  })

  it('投球中の合計は、前の投球までの合計といまの数の足し算になる', () => {
    renderGame()
    playThrow(5, 1)
    startThrow()
    act(() => engineMock.options?.onToppledProgress(4))
    expect(screen.getAllByRole('status')[0]).toHaveTextContent('9こ')
  })

  it('3投したら合計を出して、もういちど できる', async () => {
    const user = userEvent.setup()
    renderGame()
    playThrow(5, 1)
    playThrow(8, 2)
    playThrow(3, 3)

    const result = screen.getByRole('dialog', { name: 'けっか' })
    expect(result).toHaveTextContent('16')
    expect(result).toHaveTextContent('たおれたよ！')

    const mountsBeforeRetry = engineMock.mountCount
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    // 世界を作り直すため、エンジンへ渡すrunIdが変わる。
    expect(engineMock.mountCount).toBeGreaterThan(mountsBeforeRetry)
    expect(screen.queryByRole('dialog', { name: 'けっか' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('0こ')
    expect(screen.getByText('たまを ひっぱって はなすと ビューン！')).toBeInTheDocument()
    expect(
      screen.getByLabelText(`${THROWS_PER_GAME}かい なげるうちの 1かいめ`),
    ).toBeInTheDocument()
  })

  it('もういちどのたびにrunIdが変わり、前のプレイの物理が残らない', async () => {
    const user = userEvent.setup()
    renderGame()
    const firstRunId = engineMock.options?.runId
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engineMock.options?.runId).not.toBe(firstRunId)
  })

  it('ホームへもどるリンクがある', () => {
    renderGame()
    expect(screen.getByRole('link', { name: 'もどる' })).toHaveAttribute('href', '/')
  })

  it('結果画面からもホームへ戻れる', () => {
    renderGame()
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    expect(screen.getByRole('link', { name: 'ほかの あそび' })).toHaveAttribute('href', '/')
  })
})

describe('玉の選択', () => {
  it('3種類の玉が選べ、最初は「どっしりだま」が選ばれている', () => {
    renderGame()
    const heavy = screen.getByRole('button', { name: 'どっしりだま' })
    const bouncy = screen.getByRole('button', { name: 'はずむだま' })
    const small = screen.getByRole('button', { name: 'ちいさいだま' })
    expect(heavy).toHaveAttribute('aria-pressed', 'true')
    expect(bouncy).toHaveAttribute('aria-pressed', 'false')
    expect(small).toHaveAttribute('aria-pressed', 'false')
    expect(engineMock.options?.ballId).toBe('heavy')
  })

  it('投球待機中に玉を選び直すと、エンジンへ切替が伝わる（世界は作り直さない）', async () => {
    const user = userEvent.setup()
    renderGame()
    const runIdBefore = engineMock.options?.runId
    await user.click(screen.getByRole('button', { name: 'はずむだま' }))
    expect(engineMock.setBallId).toHaveBeenCalledWith('bouncy')
    expect(screen.getByRole('button', { name: 'はずむだま' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'どっしりだま' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    // runIdが変わらない＝useTsumikiBowlingEngineのworldは作り直されない
    // （切替はエンジンのhandle.setBallId経由で行う）。
    expect(engineMock.options?.runId).toBe(runIdBefore)
  })

  it('飛行中は玉の選択ボタンがdisabledになり、切替を呼ばない', () => {
    renderGame()
    startThrow()
    const bouncy = screen.getByRole('button', { name: 'はずむだま' })
    expect(bouncy).toBeDisabled()
    bouncy.click()
    expect(engineMock.setBallId).not.toHaveBeenCalled()
  })

  it('1投ごとに玉を変えても、3投制・スコア・次投への遷移は普段どおり進む', async () => {
    const user = userEvent.setup()
    renderGame()
    playThrow(3, 1)
    await user.click(screen.getByRole('button', { name: 'はずむだま' }))
    playThrow(5, 2)
    await user.click(screen.getByRole('button', { name: 'ちいさいだま' }))
    playThrow(2, 3)

    expect(engineMock.setBallId).toHaveBeenNthCalledWith(1, 'bouncy')
    expect(engineMock.setBallId).toHaveBeenNthCalledWith(2, 'small')
    const result = screen.getByRole('dialog', { name: 'けっか' })
    expect(result).toHaveTextContent('10')
  })

  it('もういちどしても、選んでいた玉の選択は引き継がれる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ちいさいだま' }))
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(engineMock.options?.ballId).toBe('small')
    expect(screen.getByRole('button', { name: 'ちいさいだま' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    // 結果画面が消え、投球待機中に戻っているので選択ボタンはまた押せる。
    expect(screen.getByRole('button', { name: 'ちいさいだま' })).not.toBeDisabled()
  })
})
