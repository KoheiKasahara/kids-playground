import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test, vi } from 'vitest'
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
  // Phase 5では最初にステージを選ぶ。既存の盤面操作テストは、従来どおり
  // easyを選んだ状態から始める。
  const easyStage = await screen.findByTestId('puzzle-stage-easy')
  fireEvent.click(easyStage)
  await screen.findByTestId('puzzle-board')
}

async function renderStageSelect() {
  render(
    <MemoryRouter initialEntries={['/games/flag-roll-puzzle']}>
      <App />
    </MemoryRouter>,
  )
  await screen.findByRole('heading', { name: 'どのステージで あそぶ？' })
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

afterEach(() => {
  vi.unstubAllGlobals()
})

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
  test('開始前に3ステージを選べ、選択すると盤面へ進む', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    expect(screen.getByRole('button', { name: 'かんたん' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ふつう' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'むずかしい' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'ふつう' }))
    expect(screen.getByTestId('puzzle-board')).toBeInTheDocument()
    expect(screen.getAllByTestId('puzzle-ball')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'バンパー' })).not.toBeInTheDocument()
  })

  test('むずかしいは2球とも初期国旗で表示し、1回の落下で同時に開始する', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    await user.click(screen.getByRole('button', { name: 'むずかしい' }))
    const balls = screen.getAllByTestId('puzzle-ball')
    expect(balls).toHaveLength(2)
    expect(new Set(balls.map((ball) => ball.getAttribute('data-ball-id'))).size).toBe(2)
    expect(new Set(balls.map((ball) => ball.getAttribute('data-flag-id'))).size).toBe(1)

    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    expect(engineMock.options?.running).toBe(true)
    expect(engineMock.options?.balls).toHaveLength(2)
    expect(engineMock.options?.balls?.every((ball) => ball.status === 'moving')).toBe(true)
  })

  test('むずかしいはボールごとに別々の国旗を選べる', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    await user.click(screen.getByRole('button', { name: 'むずかしい' }))

    await user.click(screen.getByRole('button', { name: 'Aの こっきを かえる（にほん）' }))
    expect(screen.getByRole('dialog', { name: 'Aの こっきを えらぶ' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'フランス' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bの こっきを かえる（にほん）' }))
    await user.click(screen.getByRole('button', { name: 'アメリカ' }))

    const balls = screen.getAllByTestId('puzzle-ball')
    expect(balls.find((ball) => ball.getAttribute('data-ball-id') === 'ball-a')).toHaveAttribute('data-flag-id', 'fr')
    expect(balls.find((ball) => ball.getAttribute('data-ball-id') === 'ball-b')).toHaveAttribute('data-flag-id', 'us')
    expect(screen.getByRole('button', { name: 'Aの こっきを かえる（フランス）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bの こっきを かえる（アメリカ）' })).toBeInTheDocument()
  })

  test('むずかしいは1球ゴールでは未クリア、2球目でクリアになる', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    await user.click(screen.getByRole('button', { name: 'むずかしい' }))
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal?.('ball-a'))
    expect(screen.getByTestId('puzzle-board').querySelector('[data-cleared="true"]')).not.toBeInTheDocument()
    act(() => engineMock.options?.onGoal?.('ball-b'))
    expect(screen.getByTestId('puzzle-board').querySelector('[data-cleared="true"]')).toBeInTheDocument()
    expect(screen.getAllByTestId('puzzle-ball').map((ball) => ball.getAttribute('data-status'))).toEqual(['goal', 'goal'])
  })

  test('2球が同じactでゴール通知されても最後は成功表示になる', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    await user.click(screen.getByRole('button', { name: 'むずかしい' }))
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => {
      engineMock.options?.onGoal?.('ball-a')
      engineMock.options?.onGoal?.('ball-b')
    })

    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')
    expect(screen.getByRole('status')).not.toHaveTextContent('あと 1こ！')
  })

  test('むずかしいで両方止まった後、ゴール済みを動かさず未ゴールだけ再開する', async () => {
    const user = userEvent.setup()
    await renderStageSelect()
    await user.click(screen.getByRole('button', { name: 'むずかしい' }))
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal?.('ball-a'))
    act(() => engineMock.options?.onStopped?.('ball-b'))
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    expect(engineMock.options?.balls?.find((ball) => ball.id === 'ball-a')?.status).toBe('goal')
    expect(engineMock.options?.balls?.find((ball) => ball.id === 'ball-b')?.status).toBe('moving')

    act(() => engineMock.options?.onGoal?.('ball-b'))
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')
    expect(screen.getByRole('status')).not.toHaveTextContent('あと 1こ！')
  })

  test('横画面では盤面と操作パネルを2ペインにし、縦スクロール一覧から左へドラッグして置ける', async () => {
    let matches = true
    let onChange: (() => void) | undefined
    vi.stubGlobal('matchMedia', () => ({
      get matches() { return matches },
      addEventListener: (_event: string, listener: () => void) => { onChange = listener },
      removeEventListener: () => { onChange = undefined },
    }))

    await renderGame()
    expect(document.querySelector('main')).toHaveAttribute('data-layout', 'landscape')
    expect(screen.getByTestId('puzzle-board-pane')).toBeInTheDocument()
    expect(screen.getByTestId('puzzle-control-pane')).toBeInTheDocument()
    expect(screen.getByTestId('part-tray')).toHaveAttribute('data-layout', 'landscape')
    expect(screen.getByRole('button', { name: 'こっきを かえる（にほん）' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'ぜんぶ けす' })).toBeEnabled()

    const part = trayPart('ひだりへ')
    // 右ペイン内の上下移動は一覧スクロール扱いで、パーツは置かない。
    fireEvent.pointerDown(part, { pointerId: 1, clientX: 300, clientY: 220 })
    fireEvent.pointerMove(part, { pointerId: 1, clientX: 280, clientY: 300 })
    fireEvent.pointerUp(part, { pointerId: 1, clientX: 280, clientY: 300 })
    expect(placedParts()).toHaveLength(0)

    // 右から左への移動は盤面へ持ち出すドラッグとして扱い、座標は盤面のグリッドへ吸着する。
    fireEvent.pointerDown(part, { pointerId: 2, clientX: 320, clientY: 300 })
    fireEvent.pointerMove(part, { pointerId: 2, clientX: 180, clientY: 300 })
    fireEvent.pointerUp(part, { pointerId: 2, clientX: 180, clientY: 300 })
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '3,3')

    // 向きを戻しても状態は初期化せず、縦画面用の一覧へ切り替わる。
    matches = false
    act(() => onChange?.())
    expect(document.querySelector('main')).toHaveAttribute('data-layout', 'portrait')
    expect(screen.getByTestId('part-tray')).toHaveAttribute('data-layout', 'portrait')
    expect(placedParts()[0]).toHaveAttribute('data-cell', '3,3')
  })

  test('パーツ置き場に既存板とPhase 3の追加パーツが並び、「ボールをおとす」が押せる', async () => {
    await renderGame()
    expect(trayPart('ひだりへ')).toBeEnabled()
    expect(trayPart('みぎへ')).toBeEnabled()
    expect(trayPart('カーブ ひだり')).toBeEnabled()
    expect(trayPart('カーブ みぎ')).toBeEnabled()
    expect(trayPart('バンパー')).toBeEnabled()
    expect(trayPart('ひだりへ おす')).toBeEnabled()
    expect(trayPart('みぎへ おす')).toBeEnabled()
    expect(trayPart('たいほう みぎ')).toBeEnabled()
    expect(trayPart('かいてんばん')).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'よこいた' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'ながい いた' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ボールを おとす！' })).toBeEnabled()
  })

  test('国旗ボールは日本を初期値にし、国旗一覧から1タップで選び直せる', async () => {
    const user = userEvent.setup()
    await renderGame()
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'jp')

    await user.click(screen.getByRole('button', { name: 'こっきを かえる（にほん）' }))
    expect(screen.getByRole('dialog', { name: 'こっきを えらぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'フランス' })).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'フランス' }))
    expect(screen.queryByRole('dialog', { name: 'こっきを えらぶ' })).not.toBeInTheDocument()
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'fr')
    expect(screen.getByRole('button', { name: 'こっきを かえる（フランス）' })).toBeInTheDocument()
  })

  test('選んだ国旗はボールをもどす・ぜんぶけす・途中停止・ゴール後にも維持される', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'こっきを かえる（にほん）' }))
    await user.click(screen.getByRole('button', { name: 'アメリカ' }))
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'us')

    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    expect(screen.getByRole('button', { name: 'こっきを かえる（アメリカ）' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'ボールを もどす' }))
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'us')

    await user.click(screen.getByRole('button', { name: 'ぜんぶ けす' }))
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'us')

    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    act(() => engineMock.options?.onStopped())
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'us')

    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    act(() => engineMock.options?.onGoal())
    await user.click(screen.getByRole('button', { name: 'ボールを もどす' }))
    expect(screen.getByTestId('puzzle-ball')).toHaveAttribute('data-flag-id', 'us')
  })

  test('ゴールの成功状態は一度だけ確定し、ボールはもどす操作まで残る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    act(() => engineMock.options?.onGoal())
    act(() => engineMock.options?.onGoal())

    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')
    expect(screen.getByTestId('puzzle-board').querySelector('[data-cleared="true"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'ボールを もどす' })).toBeEnabled()
  })

  test('特殊パーツのプレビューはカード内に収まる', async () => {
    await renderGame()
    expect(trayPart('たいほう みぎ').querySelector('[data-preview-scale]')).toHaveAttribute('data-preview-scale', '1.1')
  })

  test('置き場の横スワイプは配置ドラッグを始めず、続けて盤面方向へはドラッグできる', async () => {
    await renderGame()
    const part = trayPart('ひだりへ')
    fireEvent.pointerDown(part, { pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(part, { pointerId: 1, clientX: 140, clientY: 101 })
    fireEvent.pointerUp(part, { pointerId: 1, clientX: 140, clientY: 101 })
    fireEvent.click(part)
    expect(screen.queryByTestId('puzzle-ghost')).not.toBeInTheDocument()
    expect(part).toHaveAttribute('aria-pressed', 'false')

    fireEvent.pointerDown(part, { pointerId: 2, clientX: 0, clientY: 0 })
    fireEvent.pointerMove(part, { pointerId: 2, ...cellPoint(1, 2) })
    expect(screen.getByTestId('puzzle-ghost')).toBeInTheDocument()
    fireEvent.pointerUp(part, { pointerId: 2, ...cellPoint(1, 2) })
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeLeft')
  })

  test('バンパーは配置・選択・削除でき、選択中にも回転操作を出さない', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('バンパー'))
    tapBoard(2, 3)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'bumper')
    tapBoard(2, 3)
    expect(screen.queryByRole('button', { name: 'まわす' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'えらんだ いたを けす' }))
    expect(placedParts()).toHaveLength(0)
  })

  test('キャノンは配置・選択・8方向回転ができる', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('たいほう みぎ'))
    tapBoard(2, 3)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'cannon')
    tapBoard(2, 3)
    expect(screen.getByRole('button', { name: 'まわす' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'cannonDownRight')
  })

  test('パーツを選んで盤面をタップすると、そのマスへ置ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
    expect(trayPart('ひだりへ')).toHaveAttribute('aria-pressed', 'true')

    tapBoard(2, 3)
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeLeft')
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
    tapBoard(2, 3)
    await user.click(trayPart('みぎへ'))
    tapBoard(4, 5)
    expect(placedParts()).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'えらんだ いたを けす' })).not.toBeInTheDocument()

    // ひだりへを置いたマスをタップして選ぶ
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
    await user.click(trayPart('ひだりへ'))
    tapBoard(2, 3)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '2,3')

    dragBoardPart([2, 3], [4, 5])
    // 増えずに、同じパーツが移動している
    expect(placedParts()).toHaveLength(1)
    expect(placedParts()[0]).toHaveAttribute('data-cell', '4,5')
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeLeft')
  })

  test('ほかのパーツの上へ動かそうとしても動かず、元の場所に残る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    dragBoardPart([2, 3], [4, 5])
    expect(placedParts()[0]).toHaveAttribute('data-cell', '2,3')
  })

  test('選んだパーツをもう一度タップする・別の場所をタップすると選択が解ける', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    await user.click(trayPart('ひだりへ'))
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
    expect(trayPart('ひだりへ')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'ボールを もどす' })).toBeEnabled()
  })

  test('ゴールに入るとお祝いを出し、「ボールをもどす」で置いたパーツを残したまま編集へ戻る', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onGoal())
    expect(screen.getByRole('status')).toHaveTextContent('ゴール！ すごい！')

    await user.click(screen.getByRole('button', { name: 'ボールを もどす' }))
    expect(engineMock.options?.running).toBe(false)
    expect(placedParts()).toHaveLength(1)
    expect(trayPart('ひだりへ')).toBeEnabled()
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

  test('途中停止したら開始位置へ戻って編集でき、板を回して再挑戦できる', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
    tapBoard(2, 3)
    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))

    act(() => engineMock.options?.onStopped())
    expect(screen.getByRole('status')).toHaveTextContent('つづきを つくろう！')
    expect(engineMock.options?.running).toBe(false)
    expect(trayPart('ひだりへ')).toBeEnabled()

    tapBoard(2, 3)
    await user.click(screen.getByRole('button', { name: 'まわす' }))
    expect(placedParts()[0]).toHaveAttribute('data-part-type', 'slopeRight')
    await user.click(screen.getByRole('button', { name: 'ボールを おとす！' }))
    expect(engineMock.options?.running).toBe(true)
  })

  test('「ぜんぶ けす」でパーツを外して最初からやり直せる', async () => {
    const user = userEvent.setup()
    await renderGame()
    await user.click(trayPart('ひだりへ'))
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
