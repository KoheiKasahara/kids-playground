import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, test } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import BlockPuzzlePlay from './BlockPuzzlePlay'
import { BLOCK_SHAPES } from './blockShapes'
import { BOARD_CELL_COUNT, BOARD_COLS, BOARD_ROWS } from './board'

function renderPlay() {
  return render(
    <MemoryRouter>
      <BlockPuzzlePlay />
    </MemoryRouter>,
  )
}

/** 盤面のマス（1始まりの「よこ・たて」で指定する。ラベルは末尾に中身が付く）。 */
function cellButton(col: number, row: number) {
  return screen.getByRole('button', { name: new RegExp(`^よこ${col} たて${row} `) })
}

function cellContent(col: number, row: number): string {
  const label = cellButton(col, row).getAttribute('aria-label') ?? ''
  return label.replace(new RegExp(`^よこ${col} たて${row} `), '')
}

function shapeButton(label: string) {
  return screen.getByRole('button', { name: `${label} を えらぶ` })
}

const setup = () => {
  const user = userEvent.setup()
  renderPlay()
  return user
}

/**
 * ドラッグの座標計算は、実際の描画サイズ（getBoundingClientRect）から
 * 1マスぶんのpxを求める。jsdomはレイアウトを持たず常に0を返すため、
 * ここだけ盤面を1マス60px・6×8マスとして固定した矩形を用意する。
 */
const CELL_PX = 60
let restoreBoardRect: (() => void) | null = null

function mockBoardRect() {
  const original = Element.prototype.getBoundingClientRect
  Element.prototype.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      width: BOARD_COLS * CELL_PX,
      height: BOARD_ROWS * CELL_PX,
      right: BOARD_COLS * CELL_PX,
      bottom: BOARD_ROWS * CELL_PX,
      toJSON() {
        return {}
      },
    }) as DOMRect
  restoreBoardRect = () => {
    Element.prototype.getBoundingClientRect = original
  }
}

afterEach(() => {
  restoreBoardRect?.()
  restoreBoardRect = null
})

/** マス（1始まりの「よこ・たて」）の中心にあたる画面座標。 */
function cellClientPoint(col: number, row: number) {
  return { clientX: (col - 0.5) * CELL_PX, clientY: (row - 0.5) * CELL_PX }
}

/** 盤面上のパーツを、あるマスから別のマスへドラッグする。 */
function dragCell(pointerId: number, from: [number, number], to: [number, number]) {
  fireEvent.pointerDown(cellButton(...from), { pointerId, ...cellClientPoint(...from) })
  fireEvent.pointerMove(window, { pointerId, ...cellClientPoint(...to) })
  fireEvent.pointerUp(window, { pointerId, ...cellClientPoint(...to) })
}

describe('ブロックパズル: 画面と操作', () => {
  test('タイトル・もどる・盤面・パーツ一覧・まわす/けす/ぜんぶけすがそろっている', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'ブロックパズル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← もどる' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'かたちを えらぶ' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /まわす/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^けす$/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /ぜんぶけす/ })).toBeInTheDocument()
    // 盤面の全マス + パーツ9種 + もどる + ぜんぶけす + まわす + けす。
    expect(screen.getAllByRole('button')).toHaveLength(BOARD_CELL_COUNT + BLOCK_SHAPES.length + 4)
  })

  test('できた！・もういっかいは、盤面が完成するまで出さない', () => {
    renderPlay()
    for (const name of ['できた！', 'もういっかい']) {
      expect(screen.queryByText(name)).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
  })

  test('配置済みパーツを選んでいないとき、けす は押せない', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: /^けす$/ })).toBeDisabled()
  })

  test('何も置いていないとき、ぜんぶけす は押せない', () => {
    renderPlay()
    expect(screen.getByRole('button', { name: /ぜんぶけす/ })).toBeDisabled()
  })

  test('9種類の形をすべて選べ、最初は1マスが選ばれている', async () => {
    const user = setup()
    expect(shapeButton('1マス')).toHaveAttribute('aria-pressed', 'true')

    for (const shape of BLOCK_SHAPES) {
      await user.click(shapeButton(shape.label))
      expect(shapeButton(shape.label)).toHaveAttribute('aria-pressed', 'true')
      const others = BLOCK_SHAPES.filter((other) => other.id !== shape.id)
      for (const other of others) {
        expect(shapeButton(other.label)).toHaveAttribute('aria-pressed', 'false')
      }
    }
  })

  test('選んだ形を盤面へ置ける', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 3))

    // タップしたマスが基準セルになり、右と下へ2×2ぶん埋まる。
    expect(cellContent(2, 3)).toBe('しかく')
    expect(cellContent(3, 3)).toBe('しかく')
    expect(cellContent(2, 4)).toBe('しかく')
    expect(cellContent(3, 4)).toBe('しかく')
    expect(cellContent(4, 3)).toBe('あき')
  })

  test('同じ形を何個でも置ける', async () => {
    const user = setup()
    await user.click(shapeButton('ティーのかたち'))
    await user.click(cellButton(1, 1))
    await user.click(cellButton(1, 3))
    await user.click(cellButton(1, 5))

    for (const row of [1, 3, 5]) {
      expect(cellContent(1, row)).toBe('ティーのかたち')
      expect(cellContent(2, row + 1)).toBe('ティーのかたち')
    }
  })

  test('1マスブロックは繰り返し置ける', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    for (let col = 1; col <= BOARD_COLS; col += 1) {
      await user.click(cellButton(col, BOARD_ROWS))
    }
    for (let col = 1; col <= BOARD_COLS; col += 1) {
      expect(cellContent(col, BOARD_ROWS)).toBe('1マス')
    }
  })

  test('盤面外へはみ出す位置には置けず、ゲームは続けられる', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    // 6列盤面の右から3列目に置くと、4マスめが盤面の外へ出る。
    await user.click(cellButton(BOARD_COLS - 2, 1))

    expect(cellContent(BOARD_COLS - 2, 1)).toBe('あき')
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')

    // 右端ぴったりに収まる位置なら置ける（拒否されてもパーツは消費されない）。
    await user.click(cellButton(BOARD_COLS - 3, 1))
    for (let col = BOARD_COLS - 3; col <= BOARD_COLS; col += 1) {
      expect(cellContent(col, 1)).toBe('ながいぼう')
    }
    expect(screen.getByRole('status')).not.toHaveTextContent('ここには おけないよ')
  })

  test('端のマスにもぴったり置ける（左上・右下）', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 1))
    await user.click(cellButton(BOARD_COLS, BOARD_ROWS))
    expect(cellContent(1, 1)).toBe('1マス')
    expect(cellContent(BOARD_COLS, BOARD_ROWS)).toBe('1マス')
  })

  test('あいているマスでも他パーツと重なる形は置けない', async () => {
    const user = setup()
    await user.click(shapeButton('しかく')) // よこ2〜3, たて2〜3 に 2×2
    await user.click(cellButton(2, 2))

    await user.click(shapeButton('ながいぼう'))
    // よこ1,たて2 自体は空きだが、よこ2〜4,たて2 でしかくと重なる。
    await user.click(cellButton(1, 2))
    expect(cellContent(1, 2)).toBe('あき')
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')

    // 空いているマスへは続けて置ける。
    await user.click(cellButton(1, 6))
    expect(cellContent(1, 6)).toBe('ながいぼう')
  })

  test('配置済みブロックをタップすると置こうとはせず、そのパーツを選ぶ', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(1, 1))

    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))
    // 置かれず、その代わりに しかく が選ばれた状態になる。
    expect(cellContent(2, 2)).toBe('しかく せんたくちゅう')
  })

  test('置けなかった知らせは、次に形を選び直すと消える', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(BOARD_COLS, 1))
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')

    await user.click(shapeButton('1マス'))
    expect(screen.getByRole('status')).toHaveTextContent('かたちを えらんで')
  })
})

function rotateButton() {
  return screen.getByRole('button', { name: /まわす/ })
}

function deleteButton() {
  return screen.getByRole('button', { name: /^けす$/ })
}

describe('ブロックパズル: まわす（未配置パーツ）', () => {
  test('まわすを1回押すと、置いたときの向きが90度変わる', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(rotateButton())
    await user.click(cellButton(2, 2))

    // 横4マスだった形が、縦4マスになって置かれる。
    for (const row of [2, 3, 4, 5]) {
      expect(cellContent(2, row)).toBe('ながいぼう')
    }
    expect(cellContent(3, 2)).toBe('あき')
  })

  test('4回押すと元の向きに戻る', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    const rotate = rotateButton()
    await user.click(rotate)
    await user.click(rotate)
    await user.click(rotate)
    await user.click(rotate)
    await user.click(cellButton(2, 2))

    for (const col of [2, 3, 4, 5]) {
      expect(cellContent(col, 2)).toBe('ながいぼう')
    }
  })

  test('対称形（1マス）は回転しても置ける位置が変わらない', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(rotateButton())
    await user.click(cellButton(3, 3))
    expect(cellContent(3, 3)).toBe('1マス')
  })
})

describe('ブロックパズル: 配置済みパーツの選択', () => {
  test('盤面上のブロックをタップすると、そのパーツ全体（1マス単位ではない）が選択される', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))

    // 2×2の右下セルをタップしても、4マス全体が選ばれる。
    await user.click(cellButton(3, 3))
    for (const [col, row] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]) {
      expect(cellContent(col, row)).toBe('しかく せんたくちゅう')
    }
  })

  test('選んでいるブロックをもう一度タップすると選択解除になる', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))
    await user.click(cellButton(2, 2))
    expect(cellContent(2, 2)).toBe('1マス せんたくちゅう')

    await user.click(cellButton(2, 2))
    expect(cellContent(2, 2)).toBe('1マス')
  })

  test('別のブロックをタップすると選択が切り替わる', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 1))
    await user.click(cellButton(5, 5))

    await user.click(cellButton(1, 1))
    expect(cellContent(1, 1)).toBe('1マス せんたくちゅう')

    await user.click(cellButton(5, 5))
    expect(cellContent(1, 1)).toBe('1マス')
    expect(cellContent(5, 5)).toBe('1マス せんたくちゅう')
  })

  test('配置済みパーツ選択中はパーツ一覧の選択表示が消え、一覧をタップすると選択が解除される', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))
    await user.click(cellButton(2, 2))
    expect(shapeButton('しかく')).toHaveAttribute('aria-pressed', 'false')

    await user.click(shapeButton('1マス'))
    // 選択が解けるだけで、置いたパーツは消えない。
    expect(cellContent(2, 2)).toBe('しかく')
    expect(shapeButton('1マス')).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ブロックパズル: 配置済みパーツの回転', () => {
  test('選んだブロックをまわすと、その場で向きが変わる', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(2, 2))
    await user.click(cellButton(2, 2))
    await user.click(rotateButton())

    for (const row of [2, 3, 4, 5]) {
      expect(cellContent(2, row)).toBe('ながいぼう せんたくちゅう')
    }
    expect(cellContent(3, 2)).toBe('あき')
  })

  test('回転すると盤面外へ出る場合でも向きは変わり、直すまでの案内が出る（#483）', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    // いちばん下の行に横4マスで置く。
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(rotateButton())

    expect(screen.getByRole('status')).toHaveTextContent('はみだしているよ')
    // 縦にまわり、盤面内に収まる先頭のマスだけが「ながいぼう」のまま残る
    // （残り3マスぶんは盤面の外へ出て、もとの横並びのマスは空く）。
    expect(cellContent(1, BOARD_ROWS)).toBe('ながいぼう せんたくちゅう')
    for (const col of [2, 3, 4]) {
      expect(cellContent(col, BOARD_ROWS)).toBe('あき')
    }
  })

  test('回転すると他パーツと重なる場合でも向きは変わり、直すまでの案内が出る（#483）', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(1, 1)) // よこ1〜4, たて1
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 3)) // よこ1, たて3

    await user.click(cellButton(1, 1)) // ながいぼうを選択
    await user.click(rotateButton())

    expect(screen.getByRole('status')).toHaveTextContent('はみだしているよ')
    // 縦にまわった「ながいぼう」と「1マス」が (1,3) で重なり、
    // あとから置かれた「1マス」がそのマスの表示を持つ。
    for (const row of [1, 2, 4]) {
      expect(cellContent(1, row)).toBe('ながいぼう せんたくちゅう')
    }
    expect(cellContent(1, 3)).toBe('1マス')
  })

  test('はみ出た状態のまま別の形を選ぼうとすると、直すまで案内される（#483）', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(rotateButton())
    expect(screen.getByRole('status')).toHaveTextContent('はみだしているよ')

    await user.click(shapeButton('1マス'))
    expect(screen.getByRole('status')).toHaveTextContent('さきに')
    // 形の選択も切り替わらない。
    expect(shapeButton('ながいぼう')).toHaveAttribute('aria-pressed', 'false')
    expect(shapeButton('1マス')).toHaveAttribute('aria-pressed', 'false')

    // 直す（あいている場所へ動かす）と、確定した通常の案内に戻る。
    await user.click(cellButton(2, 2))
    expect(screen.getByRole('status')).toHaveTextContent('うごかしたい ばしょを タップしてね')
  })

  test('はみ出た状態のまま別の配置済みパーツを選ぼうとすると、直すまで案内される（#483）', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(5, 1)) // block-1: 1マス（他の場所に確定済み）

    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(1, BOARD_ROWS)) // block-2
    await user.click(cellButton(1, BOARD_ROWS)) // block-2を選択
    await user.click(rotateButton())
    expect(screen.getByRole('status')).toHaveTextContent('はみだしているよ')

    // 別のパーツ（block-1）をタップしても選択は切り替わらない。
    await user.click(cellButton(5, 1))
    expect(screen.getByRole('status')).toHaveTextContent('さきに')
    expect(cellContent(5, 1)).toBe('1マス')
    expect(cellContent(1, BOARD_ROWS)).toBe('ながいぼう せんたくちゅう')

    // 自分自身の選択解除も、直すまではさせない。
    await user.click(cellButton(1, BOARD_ROWS))
    expect(screen.getByRole('status')).toHaveTextContent('さきに')
    expect(cellContent(1, BOARD_ROWS)).toBe('ながいぼう せんたくちゅう')
  })
})

describe('ブロックパズル: 配置済みパーツの移動', () => {
  test('選んでからあいているマスをタップすると、そこへ移動する', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))

    await user.click(cellButton(2, 2))
    await user.click(cellButton(5, 6))

    expect(cellContent(2, 2)).toBe('あき')
    expect(cellContent(5, 6)).toBe('1マス せんたくちゅう')
  })

  test('移動先が盤面外になる場合は移動を拒否し、元の位置を保つ', async () => {
    const user = setup()
    await user.click(shapeButton('2マス'))
    await user.click(cellButton(2, 2)) // よこ2〜3, たて2

    await user.click(cellButton(2, 2))
    await user.click(cellButton(BOARD_COLS, 4)) // 2マス目が盤面外へ出る

    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
    expect(cellContent(2, 2)).toBe('2マス せんたくちゅう')
    expect(cellContent(3, 2)).toBe('2マス せんたくちゅう')
    expect(cellContent(BOARD_COLS, 4)).toBe('あき')
  })

  test('移動先が他パーツと重なる場合は移動を拒否し、元の位置を保つ（パーツは消えない）', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(4, 1))

    await user.click(shapeButton('2マス'))
    await user.click(cellButton(1, 3)) // よこ1〜2, たて3

    await user.click(cellButton(1, 3)) // 2マスを選択
    await user.click(cellButton(3, 1)) // よこ3〜4,たて1 になり、よこ4,たて1 と重なる

    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
    expect(cellContent(1, 3)).toBe('2マス せんたくちゅう')
    expect(cellContent(2, 3)).toBe('2マス せんたくちゅう')
    expect(cellContent(4, 1)).toBe('1マス')
    expect(cellContent(3, 1)).toBe('あき')
  })
})

describe('ブロックパズル: けす（削除）', () => {
  test('選んでいるパーツを けす で削除でき、そのセルが空く', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))

    await user.click(cellButton(2, 2))
    await user.click(deleteButton())

    for (const [col, row] of [
      [2, 2],
      [3, 2],
      [2, 3],
      [3, 3],
    ]) {
      expect(cellContent(col, row)).toBe('あき')
    }
    // 削除すると選択も解けるので、けす はまた押せなくなる。
    expect(deleteButton()).toBeDisabled()
  })

  test('削除しても在庫は減らず、同じ形をまた一覧から選んで置ける', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))
    await user.click(cellButton(2, 2))
    await user.click(deleteButton())

    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))
    expect(cellContent(2, 2)).toBe('しかく')
    expect(cellContent(3, 3)).toBe('しかく')
  })
})

/** 1マスパーツだけで盤面全体を埋める（何度でも使えることの確認も兼ねる）。 */
async function fillBoardWithSingles(user: ReturnType<typeof userEvent.setup>) {
  await user.click(shapeButton('1マス'))
  for (let row = 1; row <= BOARD_ROWS; row += 1) {
    for (let col = 1; col <= BOARD_COLS; col += 1) {
      await user.click(cellButton(col, row))
    }
  }
}

describe('ブロックパズル: 完成判定・完成演出（#482）', () => {
  test('全マスが埋まると「できた！」ともういっかいが表示される', async () => {
    const user = setup()
    await fillBoardWithSingles(user)

    expect(screen.getByText('できた！')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /もういっかい/ })).toBeInTheDocument()
  }, 20000)

  test('1マスでも空きがあれば完成演出は出ない', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    for (let row = 1; row <= BOARD_ROWS; row += 1) {
      for (let col = 1; col <= BOARD_COLS; col += 1) {
        if (row === BOARD_ROWS && col === BOARD_COLS) continue
        await user.click(cellButton(col, row))
      }
    }

    expect(screen.queryByText('できた！')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /もういっかい/ })).not.toBeInTheDocument()
  }, 20000)

  test('もういっかい で盤面・パーツ一覧の選択・向きが初期状態に戻る', async () => {
    const user = setup()
    await fillBoardWithSingles(user)

    // 完成後でもパーツ一覧・まわすは操作でき、そこでの選択は「もういっかい」で消える対象になる。
    await user.click(shapeButton('ティーのかたち'))
    await user.click(rotateButton())

    await user.click(screen.getByRole('button', { name: /もういっかい/ }))

    expect(screen.queryByText('できた！')).not.toBeInTheDocument()
    expect(cellContent(1, 1)).toBe('あき')
    expect(cellContent(BOARD_COLS, BOARD_ROWS)).toBe('あき')
    expect(shapeButton('1マス')).toHaveAttribute('aria-pressed', 'true')
    expect(deleteButton()).toBeDisabled()
  }, 20000)

  test('崩して埋め直すと完成演出がもう一度出る', async () => {
    const user = setup()
    await fillBoardWithSingles(user)
    expect(screen.getByText('できた！')).toBeInTheDocument()

    await user.click(cellButton(1, 1))
    await user.click(deleteButton())
    expect(screen.queryByText('できた！')).not.toBeInTheDocument()

    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 1))
    expect(screen.getByText('できた！')).toBeInTheDocument()
  }, 20000)
})

describe('ブロックパズル: ぜんぶけす（#482）', () => {
  test('押してもすぐには消えず、はい で確認してから盤面が空になる', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))

    await user.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
    expect(cellContent(2, 2)).toBe('しかく')
    expect(screen.getByText('ぜんぶ けす？')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'はい、けす' }))
    expect(cellContent(2, 2)).toBe('あき')
    expect(screen.queryByText('ぜんぶ けす？')).not.toBeInTheDocument()
  })

  test('いいえ で取り消すと盤面は変わらない', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(2, 2))

    await user.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
    await user.click(screen.getByRole('button', { name: 'いいえ' }))

    expect(cellContent(2, 2)).toBe('しかく')
    expect(screen.queryByText('ぜんぶ けす？')).not.toBeInTheDocument()
  })

  test('選んでいる形・向きは変えない（もういっかいとの違い）', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(rotateButton())
    await user.click(cellButton(2, 2))

    await user.click(screen.getByRole('button', { name: /ぜんぶけす/ }))
    await user.click(screen.getByRole('button', { name: 'はい、けす' }))

    expect(shapeButton('ながいぼう')).toHaveAttribute('aria-pressed', 'true')
    await user.click(cellButton(2, 2))
    for (const row of [2, 3, 4, 5]) {
      expect(cellContent(2, row)).toBe('ながいぼう')
    }
  })
})

describe('ブロックパズル: ドラッグでの移動・入れ替え（#483）', () => {
  test('あいている場所へドラッグすると移動する', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))

    mockBoardRect()
    dragCell(1, [2, 2], [5, 6])

    expect(cellContent(2, 2)).toBe('あき')
    expect(cellContent(5, 6)).toBe('1マス せんたくちゅう')
  })

  test('しきい値を超えて動かさない（タップ扱いの）場合はドラッグとして扱わない', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))

    mockBoardRect()
    // 1マス未満のわずかな動き。移動にはならない。
    fireEvent.pointerDown(cellButton(2, 2), { pointerId: 1, clientX: 90, clientY: 90 })
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 92, clientY: 91 })
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 92, clientY: 91 })

    expect(cellContent(2, 2)).toBe('1マス')
    // ドラッグ扱いされなかったので、続く click はふつうのタップとして選択する。
    await user.click(cellButton(2, 2))
    expect(cellContent(2, 2)).toBe('1マス せんたくちゅう')
  })

  test('ちょうど1つのパーツと重なる場所へドラッグすると入れ替わる', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 1))
    await user.click(shapeButton('2マス'))
    await user.click(cellButton(4, 4)) // よこ4〜5, たて4

    mockBoardRect()
    dragCell(1, [1, 1], [4, 4])

    expect(cellContent(1, 1)).toBe('2マス')
    expect(cellContent(2, 1)).toBe('2マス')
    expect(cellContent(4, 4)).toBe('1マス せんたくちゅう')
    expect(cellContent(5, 4)).toBe('あき')
  })

  test('複数パーツにまたがる／盤面外へのドラッグは失敗し、元の位置へ戻る', async () => {
    const user = setup()
    await user.click(shapeButton('1マス'))
    await user.click(cellButton(1, 1))
    await user.click(cellButton(2, 1))
    await user.click(shapeButton('2マス'))
    await user.click(cellButton(5, 5))

    mockBoardRect()
    dragCell(1, [5, 5], [1, 1])

    expect(cellContent(1, 1)).toBe('1マス')
    expect(cellContent(2, 1)).toBe('1マス')
    expect(cellContent(5, 5)).toBe('2マス')
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')
  })

  test('はみ出た状態のパーツも、ドラッグしてあいている場所へ動かせば直る（#483）', async () => {
    const user = setup()
    await user.click(shapeButton('ながいぼう'))
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(cellButton(1, BOARD_ROWS))
    await user.click(rotateButton())
    expect(screen.getByRole('status')).toHaveTextContent('はみだしているよ')

    mockBoardRect()
    dragCell(1, [1, BOARD_ROWS], [3, 3])

    expect(screen.getByRole('status')).toHaveTextContent('うごかしたい ばしょを タップしてね')
    for (const row of [3, 4, 5, 6]) {
      expect(cellContent(3, row)).toBe('ながいぼう せんたくちゅう')
    }
  })
})
