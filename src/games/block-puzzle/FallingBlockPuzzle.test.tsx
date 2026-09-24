import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import FallingBlockPuzzle from './FallingBlockPuzzle'
import { FALLING_COLS, FALLING_ROWS, FALLING_SHAPE_IDS } from './fallingPuzzleState'

/**
 * 出てくる形は乱数で決まるため、Math.random を固定して形を決め打ちにする。
 * 0 のときは FALLING_SHAPE_IDS の先頭（1マス）、ながいぼう（i）を出したいときだけ
 * randomValue を変えてから描画する。
 */
let randomValue = 0

/** 「おとす」を押してから実際に積まれるまでの待ち時間より十分長い時間[ms]。 */
const AFTER_DROP_MS = 400
/** はやさ「ゆっくり」で1段おちる間隔[ms]。 */
const SLOW_STEP_MS = 2400

beforeEach(() => {
  randomValue = 0
  vi.spyOn(Math, 'random').mockImplementation(() => randomValue)
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function renderFalling(onBack: () => void = () => {}) {
  return render(
    <MemoryRouter>
      <FallingBlockPuzzle onBack={onBack} />
    </MemoryRouter>,
  )
}

/** いま落ちているブロックが占めているマス（"col,row" の並び）。 */
function pieceCells(): string {
  return screen.getByTestId('falling-piece').getAttribute('data-cells') ?? ''
}

/** 着地予定のうすいブロックが占めているマス。 */
function ghostCells(): string {
  return screen.getByTestId('falling-ghost').getAttribute('data-cells') ?? ''
}

/** 積まれているマスの一覧（まとまりをほどいて並べ替えたもの）。 */
function settledCells(): string[] {
  return screen
    .queryAllByTestId('falling-settled')
    .flatMap((element) => (element.getAttribute('data-cells') ?? '').split(' '))
    .filter((cell) => cell.length > 0)
    .sort()
}

/** 「よこn に うごかす」の列ボタン（nは1始まり。積んだ数がラベル末尾に付く）。 */
function columnButton(col: number) {
  return screen.getByRole('button', { name: new RegExp(`^よこ${col} に うごかす`) })
}

function controlButton(name: string) {
  return screen.getByRole('button', { name })
}

/** おとして、積まれるまで待つ。 */
function dropAndSettle() {
  fireEvent.click(controlButton('おとす'))
  act(() => {
    vi.advanceTimersByTime(AFTER_DROP_MS)
  })
}

describe('おちてくる ブロック: 画面', () => {
  test('見出し・もどる・列えらび・うごかす/まわす/おとす・はやさがそろっている', () => {
    renderFalling()
    expect(screen.getByRole('heading', { name: /おちてくる ブロック/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'もどる' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'おきたい ばしょを えらぶ' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^よこ\d に うごかす/ })).toHaveLength(FALLING_COLS)
    for (const name of ['ひだりへ うごかす', 'まわす', 'みぎへ うごかす', 'おとす']) {
      expect(controlButton(name)).toBeEnabled()
    }
    for (const label of ['はやさ じぶんで', 'はやさ ゆっくり', 'はやさ はやめ']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    }
  })

  test('はじめは積まれたブロックがなく、そろえた数は0で、つぎの形が見えている', () => {
    renderFalling()
    expect(settledCells()).toEqual([])
    expect(screen.getByText('そろえた:').parentElement).toHaveTextContent('そろえた: 0')
    expect(screen.getByTestId('falling-next-piece')).toBeInTheDocument()
  })

  test('あそびかたを みじかいことばで 案内する', () => {
    renderFalling()
    expect(screen.getByRole('status')).toHaveTextContent('おきたい ところを タップ')
  })

  test('見分けにくいS字・Z字は落ちてこない', () => {
    expect(FALLING_SHAPE_IDS).not.toContain('s')
    expect(FALLING_SHAPE_IDS).not.toContain('z')
  })
})

describe('おちてくる ブロック: ばしょをえらんで おとす', () => {
  test('列をタップすると、落ちているブロックと着地予定がその列へ動く', () => {
    renderFalling()
    expect(pieceCells()).toBe('3,0')

    fireEvent.click(columnButton(1))
    expect(pieceCells()).toBe('0,0')
    expect(ghostCells()).toBe(`0,${FALLING_ROWS - 1}`)

    fireEvent.click(columnButton(FALLING_COLS))
    expect(pieceCells()).toBe(`${FALLING_COLS - 1},0`)
    expect(ghostCells()).toBe(`${FALLING_COLS - 1},${FALLING_ROWS - 1}`)
  })

  test('おとすと、えらんだ列のいちばん下に積まれ、つぎのブロックが上に出る', () => {
    renderFalling()
    fireEvent.click(columnButton(1))
    dropAndSettle()

    expect(settledCells()).toEqual([`0,${FALLING_ROWS - 1}`])
    expect(pieceCells()).toBe('3,0')
  })

  test('同じ列につづけておとすと、上へ積み上がる', () => {
    renderFalling()
    fireEvent.click(columnButton(1))
    dropAndSettle()
    fireEvent.click(columnButton(1))
    dropAndSettle()

    expect(settledCells()).toEqual([`0,${FALLING_ROWS - 2}`, `0,${FALLING_ROWS - 1}`])
  })

  test('列のボタンは、その列に積まれているブロックの数も読み上げに伝える', () => {
    renderFalling()
    expect(columnButton(1)).toHaveAccessibleName('よこ1 に うごかす')

    fireEvent.click(columnButton(1))
    dropAndSettle()
    expect(columnButton(1)).toHaveAccessibleName('よこ1 に うごかす ブロック1こ')
    expect(columnButton(2)).toHaveAccessibleName('よこ2 に うごかす')
  })

  test('ひだり・みぎで1マスずつ動き、盤面の外へは出ない', () => {
    renderFalling()
    fireEvent.click(controlButton('ひだりへ うごかす'))
    expect(pieceCells()).toBe('2,0')
    fireEvent.click(controlButton('みぎへ うごかす'))
    expect(pieceCells()).toBe('3,0')

    for (let step = 0; step < FALLING_COLS; step += 1) {
      fireEvent.click(controlButton('ひだりへ うごかす'))
    }
    expect(pieceCells()).toBe('0,0')
  })

  test('まわすと向きが変わる', () => {
    // ながいぼう（4マス）を出して、たてに変わることを確かめる。
    randomValue = FALLING_SHAPE_IDS.indexOf('i') / FALLING_SHAPE_IDS.length + 0.01
    renderFalling()
    expect(pieceCells()).toBe('2,0 3,0 4,0 5,0')

    fireEvent.click(controlButton('まわす'))
    const rotated = pieceCells().split(' ')
    expect(rotated).toHaveLength(4)
    expect(new Set(rotated.map((cell) => cell.split(',')[0])).size).toBe(1)
  })

  test('エルのかたちも、出てきたところで押すたびにまわる', () => {
    // 上へ伸びる向きを持つ形。出てきた直後はいちばん上の段にいるため、
    // 以前は「まわす」を押しても向きが変わらなかった。
    randomValue = FALLING_SHAPE_IDS.indexOf('l') / FALLING_SHAPE_IDS.length + 0.01
    renderFalling()
    const spawned = pieceCells()

    const seen = [spawned]
    for (let press = 0; press < 3; press += 1) {
      fireEvent.click(controlButton('まわす'))
      expect(seen, `${press + 1}回目でまわらなかった`).not.toContain(pieceCells())
      seen.push(pieceCells())
    }

    // 4回で1周して、元の向き・元の場所へ戻る。
    fireEvent.click(controlButton('まわす'))
    expect(pieceCells()).toBe(spawned)
  })

  test('キーボードの矢印でも、うごかす・まわす・おとすができる', () => {
    renderFalling()
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(pieceCells()).toBe('2,0')
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(pieceCells()).toBe('3,0')

    fireEvent.keyDown(window, { key: 'ArrowDown' })
    act(() => {
      vi.advanceTimersByTime(AFTER_DROP_MS)
    })
    expect(settledCells()).toEqual([`3,${FALLING_ROWS - 1}`])
  })
})

describe('おちてくる ブロック: おちる はやさ', () => {
  test('はじめは「じぶんで」で、待っていても落ちてこない', () => {
    renderFalling()
    expect(screen.getByRole('button', { name: 'はやさ じぶんで' })).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS * 3)
    })
    expect(pieceCells()).toBe('3,0')
    expect(settledCells()).toEqual([])
  })

  test('「ゆっくり」をえらぶと、時間がたつと1段ずつ落ちてくる', () => {
    renderFalling()
    fireEvent.click(screen.getByRole('button', { name: 'はやさ ゆっくり' }))
    expect(screen.getByRole('button', { name: 'はやさ ゆっくり' })).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS)
    })
    expect(pieceCells()).toBe('3,1')

    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS)
    })
    expect(pieceCells()).toBe('3,2')
  })

  test('下まで来てもすぐには積まれず、1回ぶん待ってから積まれる', () => {
    renderFalling()
    fireEvent.click(screen.getByRole('button', { name: 'はやさ ゆっくり' }))

    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS * (FALLING_ROWS - 1))
    })
    expect(pieceCells()).toBe(`3,${FALLING_ROWS - 1}`)

    // 床に着いた直後の1回ぶんは、動かし直せる猶予として積まずに待つ。
    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS)
    })
    expect(settledCells()).toEqual([])

    act(() => {
      vi.advanceTimersByTime(SLOW_STEP_MS)
    })
    expect(settledCells()).toEqual([`3,${FALLING_ROWS - 1}`])
  })
})

describe('おちてくる ブロック: よこ1れつ', () => {
  test('よこ1れつそろえると、その段が消えて そろえた数が ふえる', () => {
    renderFalling()
    for (let col = 1; col <= FALLING_COLS; col += 1) {
      fireEvent.click(columnButton(col))
      dropAndSettle()
    }

    expect(settledCells()).toEqual([])
    expect(screen.getByText('そろえた:').parentElement).toHaveTextContent('そろえた: 1')
    expect(screen.getByRole('status')).toHaveTextContent('そろった！')
  })

  test('そろえたあと、つぎの操作を始めると案内がふつうに戻る', () => {
    renderFalling()
    for (let col = 1; col <= FALLING_COLS; col += 1) {
      fireEvent.click(columnButton(col))
      dropAndSettle()
    }
    fireEvent.click(columnButton(1))
    expect(screen.getByRole('status')).toHaveTextContent('おきたい ところを タップ')
  })
})

describe('おちてくる ブロック: いっぱいになったとき', () => {
  /** まんなかの列（ブロックが出てくる列）を上まで積み上げる。 */
  function fillSpawnColumn() {
    for (let step = 0; step < FALLING_ROWS; step += 1) dropAndSettle()
  }

  test('つぎのブロックが出られなくなると、やさしく知らせて もういっかい を出す', () => {
    renderFalling()
    fillSpawnColumn()

    expect(screen.getByRole('status')).toHaveTextContent('いっぱいに なっちゃった！')
    expect(screen.getByRole('button', { name: 'もういっかい' })).toBeInTheDocument()
    expect(screen.queryByTestId('falling-piece')).not.toBeInTheDocument()
    expect(controlButton('おとす')).toBeDisabled()
  })

  test('もういっかい を押すと、空の盤面から始め直せる', () => {
    renderFalling()
    fillSpawnColumn()
    fireEvent.click(screen.getByRole('button', { name: 'もういっかい' }))

    expect(settledCells()).toEqual([])
    expect(pieceCells()).toBe('3,0')
    expect(screen.getByText('そろえた:').parentElement).toHaveTextContent('そろえた: 0')
  })
})

describe('おちてくる ブロック: さいしょから', () => {
  test('1つも積んでいないあいだは押せない', () => {
    renderFalling()
    expect(screen.getByRole('button', { name: 'さいしょから' })).toBeDisabled()
  })

  test('押した瞬間には消さず、かくにんしてから消す', () => {
    renderFalling()
    dropAndSettle()
    expect(settledCells()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'さいしょから' }))
    expect(screen.getByRole('group', { name: 'さいしょから かくにん' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'いいえ' }))
    expect(settledCells()).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'さいしょから' }))
    fireEvent.click(screen.getByRole('button', { name: 'はい、さいしょから' }))
    expect(settledCells()).toEqual([])
  })
})

describe('おちてくる ブロック: もどる', () => {
  test('もどるを押すと、呼び出し側へ知らせる（モードえらびへ戻る）', () => {
    const onBack = vi.fn()
    renderFalling(onBack)
    fireEvent.click(screen.getByRole('button', { name: 'もどる' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
