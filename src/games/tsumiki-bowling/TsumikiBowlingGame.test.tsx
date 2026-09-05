import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TsumikiBowlingGame from './TsumikiBowlingGame'
import type {
  ThrowSettledResult,
  TsumikiBowlingEngineOptions,
} from './useTsumikiBowlingEngine'
import { THROWS_PER_GAME } from './bowlingGame'
import { getBowlingStage } from './bowlingStage'

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

/** テスト対象は常に'tower'ステージなので、積み木の総数もそこから読む（数値の二重管理をしない）。 */
const TOWER_TOTAL = getBowlingStage('tower').blocks.length

function renderGame(onBackToStages: () => void = vi.fn()) {
  return render(
    <MemoryRouter initialEntries={['/games/tsumiki-bowling']}>
      <TsumikiBowlingGame stageId="tower" onBackToStages={onBackToStages} />
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
    const toppled = result.toppled
    engineMock.options?.onThrowSettled({
      throwNumber: 1,
      isLastThrow: false,
      total: TOWER_TOTAL,
      isPerfect: toppled >= TOWER_TOTAL,
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

describe('TsumikiBowlingGame', () => {
  it('最初はあそびかたの案内と、0この表示から始まる', () => {
    renderGame()
    expect(screen.getByRole('heading', { name: 'つみきボウリング' })).toBeInTheDocument()
    expect(screen.getByText('たまを ひっぱって はなすと ビューン！')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`たおした つみき0 / ${TOWER_TOTAL}こ`)
    expect(engineMock.registerContainer).toHaveBeenCalled()
  })

  it('渡したstageIdがそのままエンジンへ渡る', () => {
    renderGame()
    expect(engineMock.options?.stageId).toBe('tower')
  })

  it('「ステージをかえる」ボタンでonBackToStagesが呼ばれる', async () => {
    const user = userEvent.setup()
    const onBackToStages = vi.fn()
    renderGame(onBackToStages)
    await user.click(screen.getByRole('button', { name: 'ステージをかえる' }))
    expect(onBackToStages).toHaveBeenCalledTimes(1)
  })

  it('結果画面の「べつの ステージ」でもonBackToStagesが呼ばれる', async () => {
    const user = userEvent.setup()
    const onBackToStages = vi.fn()
    renderGame(onBackToStages)
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    await user.click(screen.getByRole('button', { name: 'べつの ステージ' }))
    expect(onBackToStages).toHaveBeenCalledTimes(1)
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
    expect(screen.getByTestId('power-label')).toHaveTextContent('よわい')
    act(() => engineMock.options?.onAimChange(0.5))
    // 「ふつう」は高さ選択（既定値）のラベルとも文字がかぶるため、
    // パワー表示のほうはdata-testidで区別して読む。
    expect(screen.getByTestId('power-label')).toHaveTextContent('ふつう')
    act(() => engineMock.options?.onAimChange(0.95))
    expect(screen.getByTestId('power-label')).toHaveTextContent('つよい！')
    act(() => engineMock.options?.onAimChange(null))
    expect(screen.queryByTestId('power-label')).not.toBeInTheDocument()
  })

  it('崩れている最中も、いま倒れている数がその投球ぶんとして増えていく', () => {
    renderGame()
    startThrow()
    act(() => engineMock.options?.onToppledProgress(3, 3))
    expect(screen.getByRole('status')).toHaveTextContent(`3 / ${TOWER_TOTAL}こ`)
    act(() => engineMock.options?.onToppledProgress(9, 6))
    expect(screen.getByRole('status')).toHaveTextContent(`9 / ${TOWER_TOTAL}こ`)
  })

  it('1投終わると、その投球で倒した数を知らせ、HUDにもその投球ぶんの数が残る', () => {
    renderGame()
    playThrow(7, 1)
    expect(screen.getByText('7こ たおれた！')).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(`7 / ${TOWER_TOTAL}こ`)
  })

  it('1個も倒せなくても失敗扱いにせず、次を促す', () => {
    renderGame()
    playThrow(0, 1)
    expect(screen.getByText('つぎは あたるかな？')).toBeInTheDocument()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(`0 / ${TOWER_TOTAL}こ`)
  })

  it('全部倒すと「ぜんぶ たおれた！」になる', () => {
    renderGame()
    playThrow(TOWER_TOTAL, 1)
    expect(screen.getByText('ぜんぶ たおれた！')).toBeInTheDocument()
  })

  it('2投目からは案内の文が変わる', () => {
    renderGame()
    playThrow(2, 1)
    expect(screen.getByText('つぎも ひっぱって はなしてね')).toBeInTheDocument()
  })

  it('次の投球が始まると、HUDのその投球ぶんの数字が0へ戻る', () => {
    renderGame()
    playThrow(5, 1)
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(`5 / ${TOWER_TOTAL}こ`)
    startThrow()
    expect(screen.getAllByRole('status')[0]).toHaveTextContent(`0 / ${TOWER_TOTAL}こ`)
  })

  it('大崩壊のコールバックで短いチップが出て、しばらくすると消える', () => {
    vi.useFakeTimers()
    try {
      renderGame()
      startThrow()
      act(() => engineMock.options?.onBigCollapse?.(6))
      expect(screen.getByText('ガラガラー！')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(screen.queryByText('ガラガラー！')).not.toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it('3投したら合計を出して、もういちど できる', async () => {
    const user = userEvent.setup()
    renderGame()
    playThrow(5, 1)
    playThrow(8, 2)
    playThrow(3, 3)

    const result = screen.getByRole('dialog', { name: 'けっか' })
    expect(result).toHaveTextContent(`${THROWS_PER_GAME}かい なげて`)
    expect(result).toHaveTextContent('16')
    expect(result).toHaveTextContent('たおした！')

    const mountsBeforeRetry = engineMock.mountCount
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    // 世界を作り直すため、エンジンへ渡すrunIdが変わる。
    expect(engineMock.mountCount).toBeGreaterThan(mountsBeforeRetry)
    expect(screen.queryByRole('dialog', { name: 'けっか' })).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(`0 / ${TOWER_TOTAL}こ`)
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

  it('「もういちど」ではrunIdだけが変わり、stageIdは変わらない（世界を作り直すのは同じステージ）', async () => {
    const user = userEvent.setup()
    renderGame()
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    expect(engineMock.options?.stageId).toBe('tower')
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

describe('パーフェクト', () => {
  it('1回でも全部倒した投球があれば、結果画面に「パーフェクト！」が出る', () => {
    renderGame()
    playThrow(TOWER_TOTAL, 1)
    playThrow(0, 2)
    playThrow(0, 3)

    const result = screen.getByRole('dialog', { name: 'けっか' })
    expect(result).toHaveTextContent('パーフェクト！')
  })

  it('全部倒した投球が1回もなければ、「パーフェクト！」は出ない', () => {
    renderGame()
    playThrow(2, 1)
    playThrow(3, 2)
    playThrow(4, 3)

    const result = screen.getByRole('dialog', { name: 'けっか' })
    expect(result).not.toHaveTextContent('パーフェクト！')
  })

  it('もういちどすると、前のプレイのパーフェクトは引き継がれない', async () => {
    const user = userEvent.setup()
    renderGame()
    playThrow(TOWER_TOTAL, 1)
    playThrow(0, 2)
    playThrow(0, 3)
    expect(screen.getByRole('dialog', { name: 'けっか' })).toHaveTextContent('パーフェクト！')

    await user.click(screen.getByRole('button', { name: 'もういちど' }))
    playThrow(1, 1)
    playThrow(1, 2)
    playThrow(1, 3)
    expect(screen.getByRole('dialog', { name: 'けっか' })).not.toHaveTextContent('パーフェクト！')
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

describe('発射の高さ選択', () => {
  it('3段階が選べ、最初は「ふつう」が選ばれていて、エンジンにもそう伝わる', () => {
    renderGame()
    const low = screen.getByRole('button', { name: 'ひくい' })
    const normal = screen.getByRole('button', { name: 'ふつう' })
    const high = screen.getByRole('button', { name: 'たかい' })
    expect(low).toHaveAttribute('aria-pressed', 'false')
    expect(normal).toHaveAttribute('aria-pressed', 'true')
    expect(high).toHaveAttribute('aria-pressed', 'false')
    expect(engineMock.options?.heightLevel).toBe('normal')
  })

  it('投球待機中に高さを選び直すと、エンジンへ渡る値が変わる（世界は作り直さない）', async () => {
    const user = userEvent.setup()
    renderGame()
    const runIdBefore = engineMock.options?.runId
    await user.click(screen.getByRole('button', { name: 'たかい' }))
    expect(engineMock.options?.heightLevel).toBe('high')
    expect(screen.getByRole('button', { name: 'たかい' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'ふつう' })).toHaveAttribute('aria-pressed', 'false')
    // runIdが変わらない＝Rapierのworldは作り直されない（高さは毎回読むだけの値のため）。
    expect(engineMock.options?.runId).toBe(runIdBefore)
  })

  it('飛行中は高さの選択ボタンがdisabledになる', () => {
    renderGame()
    startThrow()
    expect(screen.getByRole('button', { name: 'ひくい' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'たかい' })).toBeDisabled()
  })

  it('もういちどしても、選んでいた高さは引き継がれる', async () => {
    const user = userEvent.setup()
    renderGame()
    await user.click(screen.getByRole('button', { name: 'ひくい' }))
    for (let index = 1; index <= THROWS_PER_GAME; index += 1) playThrow(2, index)
    await user.click(screen.getByRole('button', { name: 'もういちど' }))

    expect(engineMock.options?.heightLevel).toBe('low')
    expect(screen.getByRole('button', { name: 'ひくい' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'ひくい' })).not.toBeDisabled()
  })
})
