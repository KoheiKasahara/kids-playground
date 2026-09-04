import type { CSSProperties } from 'react'
import type { BlockShape } from './blockShapes'
import { cellBounds, cellEdges, normalizeCells, outlinePolygonPoints, type RenderCell } from './blockRendering'
import styles from './BlockPiece.module.css'

type Props = {
  shape: BlockShape
  /** 描くセル群。相対セル（パーツ一覧）でも絶対マス（盤面）でもよい。内部で左上そろえに直す。 */
  cells: readonly RenderCell[]
  className?: string
  style?: CSSProperties
  /**
   * 選ばれていることを示す縁取りを、形なり（バラバラの四角の集まりではなく
   * 1つのまとまったパーツの外周）に沿わせて表示するか。
   */
  selected?: boolean
  /**
   * 回転などでいったん盤面からはみ出た／他パーツと重なった「まだ確定していない」
   * 状態の見た目にするか（#483）。selected と併用し、縁取りの色と線種を変える。
   */
  unconfirmed?: boolean
  /** ドラッグでつまみ上げている最中（元の位置に残す薄い見た目）にするか（#483, #510）。 */
  dragging?: boolean
  /**
   * ドラッグ／新規配置の「着地プレビュー」として描くときの見た目（#510）。
   * valid = 置ける場所の通常系の半透明表示、invalid = 置けない場所の赤系の警告表示。
   * 置けない場合でも消さず、形そのものは常に描く。
   */
  tone?: 'valid' | 'invalid'
  /** プレビューをテストから拾うための data-testid（#510）。 */
  dataTestId?: string
}

/**
 * ブロック1個の見た目。盤面の配置済みブロックとパーツ一覧のミニ表示、
 * ドラッグ・新規配置の着地プレビューが共有する。
 *
 * 外周の辺だけに濃い輪郭と丸みを付け、内側の継ぎ目は細い線にとどめることで、
 * 「1つのまとまったパーツ」に見えつつ、何マスぶんかも分かるようにしている。
 * 選択中の縁取りは、cellEdges で判定した外周の辺をそのままつなぎ合わせ、
 * 1本の多角形（SVG polygon）として描く（#510）。囲む長方形にも、
 * セルごとに分かれた枠にもならず、L字・T字などの凹んだ形でも自然につながる。
 */
export default function BlockPiece({
  shape,
  cells,
  className,
  style,
  selected = false,
  unconfirmed = false,
  dragging = false,
  tone,
  dataTestId,
}: Props) {
  const bounds = cellBounds(cells)
  const normalized = normalizeCells(cells)
  const blockColor = tone === 'invalid' ? 'var(--color-danger)' : shape.color
  const blockEdge = tone === 'invalid' ? 'var(--color-danger-dark)' : shape.edgeColor

  return (
    <div
      className={`${styles.piece} ${className ?? ''} ${dragging ? styles.pieceDragging : ''} ${
        tone === 'valid' ? styles.pieceToneValid : ''
      } ${tone === 'invalid' ? styles.pieceToneInvalid : ''}`}
      data-testid={dataTestId}
      data-tone={tone}
      style={
        {
          ...style,
          '--piece-cols': bounds.cols,
          '--piece-rows': bounds.rows,
          '--block-color': blockColor,
          '--block-edge': blockEdge,
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

      {selected ? (
        <svg
          className={styles.selectionOutline}
          viewBox={`0 0 ${bounds.cols} ${bounds.rows}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            className={`${styles.selectionOutlineShape} ${unconfirmed ? styles.selectionOutlineShapeUnconfirmed : ''}`}
            points={outlinePolygonPoints(normalized)
              .map((point) => `${point.x},${point.y}`)
              .join(' ')}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
    </div>
  )
}
