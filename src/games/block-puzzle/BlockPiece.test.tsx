import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import BlockPiece from './BlockPiece'
import { blockShape, shapeCells } from './blockShapes'

describe('BlockPiece: 選択枠（#510）', () => {
  test('選択中は、セルごとの四角ではなく1本の polygon で外周を描く', () => {
    const shape = blockShape('t')
    const { container } = render(
      <BlockPiece shape={shape} cells={shapeCells('t')} selected />,
    )
    const polygons = container.querySelectorAll('polygon')
    expect(polygons).toHaveLength(1)

    // T字は4セル×4辺=16辺のうち、内側の継ぎ目3本ぶんが消えるので、
    // 実際の外周は10辺（11頂点、始点=終点で1周）になる。
    const points = polygons[0].getAttribute('points')?.trim().split(/\s+/) ?? []
    expect(points).toHaveLength(11)
    expect(points[0]).toBe(points[points.length - 1])
  })

  test('選択していないときは polygon を描かない', () => {
    const shape = blockShape('l')
    const { container } = render(<BlockPiece shape={shape} cells={shapeCells('l')} />)
    expect(container.querySelectorAll('polygon')).toHaveLength(0)
  })

  test('L字・S字などの凹んだ形でも、選択枠は1本の polygon のまま（分割された複数の枠にならない）', () => {
    for (const id of ['l', 'j', 's', 'z'] as const) {
      const shape = blockShape(id)
      const { container, unmount } = render(
        <BlockPiece shape={shape} cells={shapeCells(id)} selected />,
      )
      expect(container.querySelectorAll('polygon')).toHaveLength(1)
      unmount()
    }
  })

  test('unconfirmed のときは、選択枠に破線用のクラスが付く', () => {
    const shape = blockShape('i')
    render(<BlockPiece shape={shape} cells={shapeCells('i')} selected unconfirmed />)
    const polygon = document.querySelector('polygon')
    expect(polygon?.getAttribute('class')).toMatch(/unconfirmed/i)
  })
})

describe('BlockPiece: 着地プレビュー（#510）', () => {
  test('tone を渡すと、data-tone 属性でテストから見た目を判別できる', () => {
    const shape = blockShape('single')
    render(<BlockPiece shape={shape} cells={shapeCells('single')} tone="valid" dataTestId="preview" />)
    expect(screen.getByTestId('preview')).toHaveAttribute('data-tone', 'valid')
  })

  test('配置不可のプレビューでも、パーツのセル自体はそのまま描かれる（消えない）', () => {
    const shape = blockShape('o')
    const { container } = render(
      <BlockPiece shape={shape} cells={shapeCells('o')} tone="invalid" dataTestId="preview" />,
    )
    expect(screen.getByTestId('preview')).toHaveAttribute('data-tone', 'invalid')
    // 4マスぶんのセルは消えずに描かれ続ける。
    expect(container.querySelectorAll('[class*="pieceCell"]')).toHaveLength(4)
  })
})
