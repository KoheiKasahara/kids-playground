import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import BlockPiece from './BlockPiece'
import { BOARD_COLS, BOARD_ROWS, allBoardCells, cellKey, type BoardCell } from './board'
import { BLOCK_SHAPES, blockShape, shapeCells, type BlockShapeId } from './blockShapes'
import { cellBounds } from './blockRendering'
import { cellOwners, placedBlockCells } from './placement'
import {
  createBlockPuzzleState,
  deleteSelectedPlacedBlock,
  moveSelectedPlacedBlock,
  placeSelectedBlock,
  rotatePendingShape,
  rotateSelectedPlacedBlock,
  selectPlacedBlock,
  selectShape,
  type BlockPuzzleState,
} from './blockPuzzleState'
import styles from './BlockPuzzlePlay.module.css'

const HINT_MESSAGE = 'かたちを えらんで、ばんめんを タップしてね'
const MOVE_HINT_MESSAGE = 'うごかしたい ばしょを タップしてね'
const CANNOT_PLACE_MESSAGE = 'ここには おけないよ'
const CANNOT_ROTATE_MESSAGE = 'ここでは まわせないよ'

/** 直前の操作で置けなかった／動かせなかったマス。 */
type InvalidCell = { readonly cell: BoardCell } | null

/**
 * ブロックパズル（#480 Phase 1 + #481 Phase 2）。
 *
 * Phase 1は「パーツ一覧で形を選ぶ → 盤面のマスをタップして置く」だけだったが、
 * Phase 2では置いたあとも自由に試行錯誤できるよう、
 * 「まわす（未配置・配置済み共通）」「盤面上パーツの選択」「移動」「けす」を追加する。
 * 落下・ライン消去・時間制限・ゲームオーバー・完成判定はなく、
 * 操作が不正なとき（盤面外／重なり）も失敗にはせず、短いことばと赤いわくで知らせるだけにしている。
 *
 * 盤面の正本は state.placedBlocks（配置済みブロックの配列）で、
 * このコンポーネントはそこから描画を導出するだけ。マスの色を直接書き換えることはしない。
 */
export default function BlockPuzzlePlay() {
  const navigate = useNavigate()
  const [state, setState] = useState<BlockPuzzleState>(createBlockPuzzleState)
  /**
   * 直前の操作で拒否されたフィードバック。「置けない」「動かせない」はマス、
   * 「まわせない」はマスを持たないので分けて持つ。次の操作まで残す（時間で消さないので動きが読みやすい）。
   */
  const [invalidCell, setInvalidCell] = useState<InvalidCell>(null)
  const [rotateBlocked, setRotateBlocked] = useState(false)

  const owners = cellOwners(state.placedBlocks)
  const selectedPlacedBlock = state.selectedPlacedBlockId
    ? (state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId) ?? null)
    : null

  const clearFeedback = () => {
    setInvalidCell(null)
    setRotateBlocked(false)
  }

  const handleSelectShape = (shapeId: BlockShapeId) => {
    setState(selectShape(state, shapeId))
    clearFeedback()
  }

  const handleTapCell = (cell: BoardCell) => {
    const owner = owners.get(cellKey(cell))
    if (owner) {
      // 配置済みパーツをタップ：その1パーツ全体を選ぶ（もう一度タップで選択解除）。
      setState(selectPlacedBlock(state, owner.id))
      clearFeedback()
      return
    }

    if (state.selectedPlacedBlockId) {
      // 配置済みパーツ選択中：あいているマスは移動先として扱う。
      const moved = moveSelectedPlacedBlock(state, cell)
      if (!moved) {
        setInvalidCell({ cell })
        return
      }
      setState(moved)
      clearFeedback()
      return
    }

    const placed = placeSelectedBlock(state, cell)
    if (!placed) {
      setInvalidCell({ cell })
      return
    }
    setState(placed)
    clearFeedback()
  }

  const handleRotate = () => {
    if (state.selectedPlacedBlockId) {
      const rotated = rotateSelectedPlacedBlock(state)
      if (!rotated) {
        setInvalidCell(null)
        setRotateBlocked(true)
        return
      }
      setState(rotated)
      clearFeedback()
      return
    }
    setState(rotatePendingShape(state))
    clearFeedback()
  }

  const handleDelete = () => {
    const deleted = deleteSelectedPlacedBlock(state)
    if (!deleted) return
    setState(deleted)
    clearFeedback()
  }

  const previewShape = blockShape(selectedPlacedBlock ? selectedPlacedBlock.shapeId : state.selectedShapeId)
  const previewCells = selectedPlacedBlock
    ? shapeCells(selectedPlacedBlock.shapeId, selectedPlacedBlock.rotation)
    : shapeCells(state.selectedShapeId, state.pendingRotation)

  const message = invalidCell
    ? CANNOT_PLACE_MESSAGE
    : rotateBlocked
      ? CANNOT_ROTATE_MESSAGE
      : selectedPlacedBlock
        ? MOVE_HINT_MESSAGE
        : HINT_MESSAGE

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
            const isSelected = owner !== undefined && owner.id === state.selectedPlacedBlockId
            const content = owner ? blockShape(owner.shapeId).label : 'あき'
            const label = `よこ${cell.col + 1} たて${cell.row + 1} ${content}${
              isSelected ? ' せんたくちゅう' : ''
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
              const isSelected = block.id === state.selectedPlacedBlockId
              return (
                <BlockPiece
                  key={block.id}
                  shape={blockShape(block.shapeId)}
                  cells={cells}
                  className={`${styles.placedBlock} ${isSelected ? styles.selectedPlacedBlock : ''}`}
                  style={{
                    gridColumn: `${bounds.minCol + 1} / span ${bounds.cols}`,
                    gridRow: `${bounds.minRow + 1} / span ${bounds.rows}`,
                  }}
                />
              )
            })}

            {/* 置けなかった・動かせなかったマスの赤枠。ブロックより後ろに置くと重なりのときに
                隠れてしまうため、同じレイヤーのいちばん上に描く。 */}
            {invalidCell ? (
              <span
                className={styles.invalidCell}
                style={{ gridColumn: invalidCell.cell.col + 1, gridRow: invalidCell.cell.row + 1 }}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.controls} role="group" aria-label="まわす・けす">
        <div
          className={`${styles.controlsPreview} ${
            selectedPlacedBlock ? styles.controlsPreviewEditing : ''
          }`}
          aria-hidden="true"
        >
          <BlockPiece shape={previewShape} cells={previewCells} className={styles.controlsPreviewPiece} />
        </div>
        <button type="button" className={styles.controlButton} onClick={handleRotate}>
          <span className={styles.controlIcon} aria-hidden="true">
            🔄
          </span>
          まわす
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleDelete}
          disabled={selectedPlacedBlock === null}
        >
          <span className={styles.controlIcon} aria-hidden="true">
            🗑️
          </span>
          けす
        </button>
      </div>

      <p className={styles.message} role="status" aria-live="polite">
        {message}
      </p>

      <div
        className={`${styles.palette} ${selectedPlacedBlock ? styles.paletteInactive : ''}`}
        role="group"
        aria-label="かたちを えらぶ"
      >
        {BLOCK_SHAPES.map((shape) => {
          const selected = shape.id === state.selectedShapeId && selectedPlacedBlock === null
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
