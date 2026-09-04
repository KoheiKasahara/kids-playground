import type { CSSProperties } from 'react'
import type { BlockShape } from './blockShapes'
import { cellBounds, cellEdges, normalizeCells, type RenderCell } from './blockRendering'
import styles from './BlockPiece.module.css'

type Props = {
  shape: BlockShape
  /** 描くセル群。相対セル（パーツ一覧）でも絶対マス（盤面）でもよい。内部で左上そろえに直す。 */
  cells: readonly RenderCell[]
  className?: string
  style?: CSSProperties
}

/**
 * ブロック1個の見た目。盤面の配置済みブロックとパーツ一覧のミニ表示が共有する。
 *
 * 外周の辺だけに濃い輪郭と丸みを付け、内側の継ぎ目は細い線にとどめることで、
 * 「1つのまとまったパーツ」に見えつつ、何マスぶんかも分かるようにしている。
 */
export default function BlockPiece({ shape, cells, className, style }: Props) {
  const bounds = cellBounds(cells)
  const normalized = normalizeCells(cells)

  return (
    <div
      className={`${styles.piece} ${className ?? ''}`}
      style={
        {
          ...style,
          '--piece-cols': bounds.cols,
          '--piece-rows': bounds.rows,
          '--block-color': shape.color,
          '--block-edge': shape.edgeColor,
        } as CSSProperties
      }
    >
      {normalized.map((cell) => {
        const edges = cellEdges(normalized, cell)
        return (
          <span
            key={`${cell.col},${cell.row}`}
            className={styles.pieceCell}
            style={{
              gridColumn: cell.col + 1,
              gridRow: cell.row + 1,
              borderTopWidth: edges.top ? 'var(--block-edge-width)' : '0',
              borderRightWidth: edges.right ? 'var(--block-edge-width)' : '0',
              borderBottomWidth: edges.bottom ? 'var(--block-edge-width)' : '0',
              borderLeftWidth: edges.left ? 'var(--block-edge-width)' : '0',
              borderTopLeftRadius: edges.top && edges.left ? 'var(--block-radius)' : '0',
              borderTopRightRadius: edges.top && edges.right ? 'var(--block-radius)' : '0',
              borderBottomRightRadius: edges.bottom && edges.right ? 'var(--block-radius)' : '0',
              borderBottomLeftRadius: edges.bottom && edges.left ? 'var(--block-radius)' : '0',
            }}
          />
        )
      })}
    </div>
  )
}
