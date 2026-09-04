import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import BlockPiece from './BlockPiece'
import { BOARD_COLS, BOARD_ROWS, allBoardCells, cellKey, type BoardCell } from './board'
import { BLOCK_SHAPES, blockShape, type BlockShapeId } from './blockShapes'
import { cellBounds } from './blockRendering'
import { cellOwners, placedBlockCells } from './placement'
import {
  createBlockPuzzleState,
  placeSelectedBlock,
  selectShape,
  type BlockPuzzleState,
} from './blockPuzzleState'
import styles from './BlockPuzzlePlay.module.css'

const HINT_MESSAGE = 'かたちを えらんで、ばんめんを タップしてね'
const CANNOT_PLACE_MESSAGE = 'ここには おけないよ'

/**
 * ブロックパズル（#480 Phase 1）。
 *
 * 「パーツ一覧で形を選ぶ → 盤面のマスをタップして置く」だけのゲーム。
 * 落下・ライン消去・時間制限・ゲームオーバーはなく、置けなかったときも
 * 失敗にはせず、短いことばと赤いわくで知らせるだけにしている。
 *
 * 盤面の正本は state.placedBlocks（配置済みブロックの配列）で、
 * このコンポーネントはそこから描画を導出するだけ。マスの色を直接書き換えることはしない。
 */
export default function BlockPuzzlePlay() {
  const navigate = useNavigate()
  const [state, setState] = useState<BlockPuzzleState>(createBlockPuzzleState)
  /** 直前に置けなかったマス。次の操作まで赤い枠で残す（時間で消さないので動きが読みやすい）。 */
  const [rejectedCell, setRejectedCell] = useState<BoardCell | null>(null)

  const owners = cellOwners(state.placedBlocks)

  const handleSelectShape = (shapeId: BlockShapeId) => {
    setState(selectShape(state, shapeId))
    setRejectedCell(null)
  }

  const handleTapCell = (cell: BoardCell) => {
    const placed = placeSelectedBlock(state, cell)
    if (!placed) {
      setRejectedCell(cell)
      return
    }
    setState(placed)
    setRejectedCell(null)
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          ← もどる
        </button>
        <h1 className={styles.title}>
          <span aria-hidden="true">🧩</span> ブロックパズル
        </h1>
      </header>

      <div className={styles.boardArea}>
        <div
          className={styles.board}
          style={{ '--board-cols': BOARD_COLS, '--board-rows': BOARD_ROWS } as CSSProperties}
        >
          {allBoardCells().map((cell) => {
            const key = cellKey(cell)
            const owner = owners.get(key)
            const label = `よこ${cell.col + 1} たて${cell.row + 1} ${
              owner ? blockShape(owner.shapeId).label : 'あき'
            }`
            return (
              <button
                key={key}
                type="button"
                className={styles.cell}
                style={{ gridColumn: cell.col + 1, gridRow: cell.row + 1 }}
                aria-label={label}
                onClick={() => handleTapCell(cell)}
              />
            )
          })}

          {/* 置いたブロックはマス目の上に重ねて描く。タップは下のマスのボタンが受ける。 */}
          <div className={styles.blockLayer} aria-hidden="true">
            {state.placedBlocks.map((block) => {
              const cells = placedBlockCells(block)
              const bounds = cellBounds(cells)
              return (
                <BlockPiece
                  key={block.id}
                  shape={blockShape(block.shapeId)}
                  cells={cells}
                  className={styles.placedBlock}
                  style={{
                    gridColumn: `${bounds.minCol + 1} / span ${bounds.cols}`,
                    gridRow: `${bounds.minRow + 1} / span ${bounds.rows}`,
                  }}
                />
              )
            })}

            {/* 置けなかったマスの赤枠。ブロックより後ろに置くと重なりのときに隠れてしまうため、
                同じレイヤーのいちばん上に描く。 */}
            {rejectedCell ? (
              <span
                className={styles.rejectedCell}
                style={{ gridColumn: rejectedCell.col + 1, gridRow: rejectedCell.row + 1 }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {rejectedCell ? CANNOT_PLACE_MESSAGE : HINT_MESSAGE}
      </p>

      <div className={styles.palette} role="group" aria-label="かたちを えらぶ">
        {BLOCK_SHAPES.map((shape) => {
          const selected = shape.id === state.selectedShapeId
          return (
            <button
              key={shape.id}
              type="button"
              className={`${styles.paletteButton} ${selected ? styles.paletteButtonSelected : ''}`}
              aria-pressed={selected}
              aria-label={`${shape.label} を えらぶ`}
              onClick={() => handleSelectShape(shape.id)}
            >
              <span className={styles.palettePieceArea}>
                <BlockPiece shape={shape} cells={shape.cells} className={styles.palettePiece} />
              </span>
              {selected ? (
                <span className={styles.selectedMark} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </main>
  )
}
