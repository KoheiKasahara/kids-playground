import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import App from '../../app/App'
import { CELL_SIZE, GRID_TOP } from './boardLayout'
import type { PuzzleEngineOptions } from './usePuzzleEngine'

// 物理エンジン(matter-js)はjsdomでは動かさず、配置とゲーム進行の操作だけを検証する。
// usePuzzleEngine を差し替え、ゴール到達は engineMock.options.onGoal() で直接起こす。
const engineMock = vi.hoisted(() => ({ options: undefined as PuzzleEngineOptions | undefined }))
vi.mock('./usePuzzleEngine', () => ({
  usePuzzleEngine: (options: PuzzleEngineOptions) => {
    engineMock.options = options
    return { registerBall: () => {} }
  },
}))

/**
 * こっきコロコロパズルの画面は matter-js を含むため lazy(import()) で読み込む
 * （src/app/routes.tsx）。最初の要素取得は findBy* で読込完了を待つ。
 */
async function renderGame() {
  render(
    <MemoryRouter initialEntries={['/games/flag-roll-puzzle']}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'こっきコロコロパズル' })
}

/**
 * jsdom はレイアウトを持たず getBoundingClientRect が 0 を返すため、盤面の倍率は1、
 * 盤面の左上は画面の (0, 0) になる。つまり clientX/clientY がそのまま論理座標にあたる。
 */
function cellPoint(col: number, row: number) {
  return {
    clientX: col * CELL_SIZE + CELL_SIZE / 2,
    clientY: GRID_TOP + row * CELL_SIZE + CELL_SIZE / 2,
  }
}

const trayPart = (name: string) => screen.getByRole('button', { name })
const placedParts = () => screen.queryAllByTestId('puzzle-part')

/** 盤面のマスをタップする（押して、動かさずに離す） */
function tapBoard(col: number, row: number) {
  const board = screen.getByTestId('puzzle-board')
  const point = cellPoint(col, row)
  fireEvent.pointerDown(board, { pointerId: 1, ...point })
  fireEvent.pointerUp(board, { pointerId: 1, ...point })
}

/** 盤面のパーツを、別のマスまでドラッグする */
function dragBoardPart(from: [number, number], to: [number, number]) {
  const board = screen.getByTestId('puzzle-board')
  fireEvent.pointerDown(board, { pointerId: 1, ...cellPoint(...from) })
  fireEvent.pointerMove(board, { pointerId: 1, ...cellPoint(...to) })
  fireEvent.pointerUp(board, { pointerId: 1, ...cellPoint(...to) })
}

describe('こっきコロコロパズル', () => {
  test('パーツ置き場に Phase 1の3種類が並び、「ボールをおとす」が押せる', async () => {
    await renderGame()
    expect(trayPart('よこいた')).toBeEnabled()
    expect(trayPart('ひだりへ')).toBeEnabled()
    expect(trayPart('みぎへ')).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeEnabled()
  })

  test('パーツを選んで盤面をタップすると、そのマスへ置ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    expect(trayPart('よこいた')).toHaveAttribute('aria-pressed', 'true')

    tapBoard(2, 3)
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'plank')
  })

  test('パーツ置き場からドラッグして盤面へ落とすと置ける', async () => {
    await renderGame()
    const part = trayPart('ひだりへ')
    fireEvent.pointerDown(part, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(part, { pointerId: 1, ...cellPoint(1, 2) })
    // ドラッグ中は、置ける場所に下書きが出る
    expect(screen.getByTestId('puzzle-ghost')).toBeInTheDocument()
    fireEvent.pointerUp(part, { pointerId: 1, ...cellPoint(1, 2) })

    expect(screen.queryByTestId('puzzle-ghost')).not.toBeInTheDocument()
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeLeft')
  })

  test('同じマスへドラッグして重ねようとしても増えず、置けないことを伝える', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    expect(placedParts()).toHaveLength(1)

    const part = trayPart('みぎへ')
    fireEvent.pointerDown(part, { pointerId: 1, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(part, { pointerId: 1, ...cellPoint(2, 3) })
    // 置けない場所なので下書きも出ない
    expect(screen.queryByTestId('puzzle-ghost')).not.toBeInTheDocument()
    fireEvent.pointerUp(part, { pointerId: 1, ...cellPoint(2, 3) })

    expect(placedParts()).toHaveLength(1)
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('置いたパーツをタップすると選ばれ、「けす」でそのパーツだけ消える', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    await user.click(trayPart('みぎへ'))
    tapBoard(4, 5)
    expect(placedParts()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()

    // よこいたを置いたマスをタップして選ぶ
    tapBoard(2, 3)
    expect(screen.getByTestId('puzzle-selection')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()
    expect(placedParts().filter((part) => part.dataset.selected === 'true')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'えらんだ いたを けす' }))
    expect(placedParts()).toHaveLength(1)
    // 残るのは選んでいなかった「みぎへ」のほう
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeRight')
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('puzzle-selection')).not.toBeInTheDocument()
  })

  test('置いたパーツをドラッグすると、離したマスへ動く', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '2,3')

    dragBoardPart([2, 3], [4, 5])
    // 増えずに、同じパーツが移動している
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '4,5')
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'plank')
  })

  test('ほかのパーツの上へ動かそうとしても動かず、元の場所に残る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(4, 5)
    expect(placedParts()).toHaveLength(2)

    dragBoardPart([2, 3], [4, 5])
    expect(placedParts()).toHaveLength(2)
    expect(placedParts().map((part) => part.dataset.cell)).toEqual(['2,3', '4,5'])
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('ボードの外へ動かそうとしても動かず、元の場所に残る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)

    const board = screen.getByTestId('puzzle-board')
    fireEvent.pointerDown(board, { pointerId: 1, ...cellPoint(2, 3) })
    // スタート帯（グリッドの外）まで動かして離す
    fireEvent.pointerMove(board, { pointerId: 1, clientX: 180, clientY: GRID_TOP - 20 })
    fireEvent.pointerUp(board, { pointerId: 1, clientX: 180, clientY: GRID_TOP - 20 })

    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '2,3')
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('選んでいるパーツを動かしても、選択はそのパーツに付いていく', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()

    dragBoardPart([2, 3], [4, 5])
    expect(placedParts()[0]).toHaveAttribute('data-cell', '4,5')
    expect(placedParts()[0]).toHaveAttribute('data-selected', 'true')
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()
  })

  test('別のパーツを動かし始めると、前の選択は解ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(4, 5)
    // (2,3) のパーツを選んでおく
    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()

    // 選んでいないほう (4,5) を動かす
    dragBoardPart([4, 5], [1, 6])
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()
    expect(placedParts().map((part) => part.dataset.cell)).toEqual(['2,3', '1,6'])
  })

  test('実行中は盤面のパーツを動かせない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    dragBoardPart([2, 3], [4, 5])
    expect(placedParts()[0]).toHaveAttribute('data-cell', '2,3')
  })

  test('選んだパーツをもう一度タップする・別の場所をタップすると選択が解ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)

    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()
    tapBoard(2, 3)
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()

    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()
    // 何もないマスをタップしたら選択は解ける（パーツは消えない）
    tapBoard(0, 0)
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()
    expect(placedParts()).toHaveLength(1)
  })

  test('パーツ置き場を選び直すと、盤面の選択は解ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()

    await user.click(trayPart('ひだりへ'))
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()
    expect(trayPart('ひだりへ')).toHaveAttribute('aria-pressed', 'true')
  })

  test('「ボールをおとす」を押すと盤面の選択は解け、実行中は「けす」を出さない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'えらんだ いたを けす' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('puzzle-selection')).not.toBeInTheDocument()
  })

  test('ボードの外（スタート帯・ゴール帯）へは置けない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    // グリッドより上（スタート帯）
    fireEvent.pointerDown(screen.getByTestId('puzzle-board'), { clientX: 180, clientY: GRID_TOP - 10 })
    expect(placedParts()).toHaveLength(0)
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('「ボールをおとす」で実行に入り、実行中はパーツを触れない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    expect(engineMock.options?.running).toBe(true)
    expect(engineMock.options?.runId).toBe(1)
    expect(trayPart('よこいた')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ボールを もどす' })).toBeEnabled()
  })

  test('ゴールに入るとお祝いを出し、「ボールをもどす」で置いたパーツを残したまま編集へ戻る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal())
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')

    await user.click(screen.getByRole('button', { name: 'ボールを もどす' }))
    expect(engineMock.options?.running).toBe(false)
    expect(placedParts()).toHaveLength(1)
    expect(trayPart('よこいた')).toBeEnabled()
  })

  test('ゴール通知が重ねて届いても、成功の状態は1回ぶんしか変わらない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal())
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')
    // 物理エンジン側は1回の実行につき一度しか呼ばない契約だが、状態側も冪等にしてある
    act(() => engineMock.options?.onGoal())
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')
    expect(screen.getByRole('button', { name: 'ボールを もどす' })).toBeEnabled()
    // ゴールしてもボールは止めないので、物理世界はそのまま動かし続ける
    expect(engineMock.options?.running).toBe(true)
  })

  test('「ぜんぶ けす」でパーツを外して最初からやり直せる', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('よこいた'))
    tapBoard(2, 3)
    tapBoard(4, 5)
    expect(placedParts()).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: 'ぜんぶ けす' }))
    expect(placedParts()).toHaveLength(0)
  })

  test('「やめる」でホームへ戻る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'やめる' }))
    expect(screen.getByRole('heading', { name: 'こどもミニゲーム' })).toBeInTheDocument()
  })
})
