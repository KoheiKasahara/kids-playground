import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, test } from 'vitest'
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

describe('ブロックパズル: 画面と操作', () => {
  test('タイトル・もどる・盤面・パーツ一覧がそろっている', () => {
    renderPlay()
    expect(screen.getByRole('heading', { name: 'ブロックパズル' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← もどる' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'かたちを えらぶ' })).toBeInTheDocument()
    // 盤面の全マス + パーツ9種 + もどる。
    expect(screen.getAllByRole('button')).toHaveLength(BOARD_CELL_COUNT + BLOCK_SHAPES.length + 1)
  })

  test('Phase 1では後続機能（まわす・けす・できた！）のボタンを置かない', () => {
    renderPlay()
    for (const name of ['まわす', 'けす', 'ぜんぶけす', 'できた！', 'もういっかい']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
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

  test('すでに置いたブロックと重なる位置には置けない', async () => {
    const user = setup()
    await user.click(shapeButton('しかく'))
    await user.click(cellButton(1, 1))

    await user.click(shapeButton('1マス'))
    await user.click(cellButton(2, 2))
    expect(cellContent(2, 2)).toBe('しかく')
    expect(screen.getByRole('status')).toHaveTextContent('ここには おけないよ')

    // 空いているマスへは続けて置ける。
    await user.click(cellButton(3, 3))
    expect(cellContent(3, 3)).toBe('1マス')
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
