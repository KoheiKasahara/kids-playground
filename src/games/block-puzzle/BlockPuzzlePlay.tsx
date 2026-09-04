import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import BlockPiece from './BlockPiece'
import { BOARD_COLS, BOARD_ROWS, allBoardCells, cellKey, type BoardCell } from './board'
import { BLOCK_SHAPES, blockShape, shapeCells, type BlockShapeId } from './blockShapes'
import { cellBounds } from './blockRendering'
import { cellOwners, isBoardFull, placedBlockCells } from './placement'
import {
  createBlockPuzzleState,
  deleteSelectedPlacedBlock,
  moveSelectedPlacedBlock,
  placeSelectedBlock,
  resetBoard,
  rotatePendingShape,
  rotateSelectedPlacedBlock,
  selectPlacedBlock,
  selectShape,
  type BlockPuzzleState,
} from './blockPuzzleState'
import { playBlockPuzzleCompleteSound, primeAudio } from '../../utils/quizSound'
import styles from './BlockPuzzlePlay.module.css'

const HINT_MESSAGE = 'かたちを えらんで、ばんめんを タップしてね'
const MOVE_HINT_MESSAGE = 'うごかしたい ばしょを タップしてね'
const CANNOT_PLACE_MESSAGE = 'ここには おけないよ'
const CANNOT_ROTATE_MESSAGE = 'ここでは まわせないよ'

/** 直前の操作で置けなかった／動かせなかったマス。 */
type InvalidCell = { readonly cell: BoardCell } | null

/**
 * 完成した瞬間に盤面のまわりで弾けるキラキラ。位置(%)と遅れ(ms)だけの静的な飾りで、
 * 完成のたびに（もう一度崩して埋め直した場合も）同じ配置で1回だけ再生する。
 */
const CELEBRATION_SPARKLES: readonly { left: number; top: number; delayMs: number; scale: number }[] = [
  { left: 8, top: 10, delayMs: 0, scale: 1 },
  { left: 88, top: 8, delayMs: 80, scale: 0.85 },
  { left: 50, top: 2, delayMs: 40, scale: 1.1 },
  { left: 4, top: 55, delayMs: 150, scale: 0.8 },
  { left: 94, top: 50, delayMs: 110, scale: 0.95 },
  { left: 22, top: 92, delayMs: 200, scale: 0.75 },
  { left: 78, top: 90, delayMs: 170, scale: 0.9 },
]

/**
 * ブロックパズル（#480 Phase 1 + #481 Phase 2 + #482 Phase 3）。
 *
 * Phase 1は「パーツ一覧で形を選ぶ → 盤面のマスをタップして置く」だけ、
 * Phase 2では置いたあとも自由に試行錯誤できるよう
 * 「まわす（未配置・配置済み共通）」「盤面上パーツの選択」「移動」「けす」を追加した。
 * Phase 3では遊びとして完成させるため、全マスが埋まったときだけの完成演出（できた！＋
 * もういっかい）と、プレイ途中でも盤面全体を空にできる「ぜんぶけす」を追加する。
 * 落下・ライン消去・時間制限・スコア・ゲームオーバー・ランダム配布は最後まで持たず、
 * 操作が不正なとき（盤面外／重なり）も失敗にはせず、短いことばと赤いわくで知らせるだけにしている。
 *
 * 盤面の正本は state.placedBlocks（配置済みブロックの配列）で、
 * このコンポーネントはそこから描画を導出するだけ。マスの色を直接書き換えることはしない。
 * 完成判定（isBoardFull）も同じ配列から毎回導くだけで、専用のフラグは状態に持たない。
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
  /** 「ぜんぶけす」の確認中かどうか（誤操作防止のため、押した瞬間には消さない）。 */
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  /** 完成演出（キラキラ）を作り直すための世代番号。完成するたびに1つ進める。 */
  const [celebrationSeq, setCelebrationSeq] = useState(0)
  /** 直前の描画時点で完成していたか。「いま完成した瞬間」だけを検出するために持つ。 */
  const wasCompleteRef = useRef(false)

  const owners = cellOwners(state.placedBlocks)
  const selectedPlacedBlock = state.selectedPlacedBlockId
    ? (state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId) ?? null)
    : null
  const isComplete = isBoardFull(state.placedBlocks)

  /**
   * 完成判定はplacedBlocksから毎回導出するだけなので、「いま完成した」瞬間の1回だけ
   * 音を鳴らす／キラキラを出すには、前回の完成有無との差分をここで見る必要がある。
   * 崩して埋め直せばまた false → true になるので、そのたびにちゃんと再演出される
   * （＝多重発火はしないが、完成のたびには毎回鳴る）。
   */
  useEffect(() => {
    if (isComplete && !wasCompleteRef.current) {
      primeAudio()
      playBlockPuzzleCompleteSound()
      setCelebrationSeq((current) => current + 1)
    }
    wasCompleteRef.current = isComplete
  }, [isComplete])

  /**
   * 直前のフィードバックをまとめて消す。「ぜんぶけす」の確認もここに含めるのは、
   * 確認を出したあとに他の操作（形を選ぶ・置く・まわす・けす）を始めたら、
   * 確認画面を出したままにしないため。
   */
  const clearFeedback = () => {
    setInvalidCell(null)
    setRotateBlocked(false)
    setResetConfirmOpen(false)
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

  /** 「ぜんぶけす」を押した直後。押した瞬間には消さず、まず確認だけを出す。 */
  const handleRequestReset = () => {
    clearFeedback()
    setResetConfirmOpen(true)
  }

  const handleCancelReset = () => {
    setResetConfirmOpen(false)
  }

  /** 確認後の「ぜんぶけす」。盤面だけを空にし、選んでいる形や向きは変えない。 */
  const handleConfirmReset = () => {
    setState(resetBoard(state))
    clearFeedback()
  }

  /** 「もういっかい」。盤面・パーツ一覧の選択・配置済み選択・向きをすべて初期状態へ戻す。 */
  const handleRestart = () => {
    setState(createBlockPuzzleState())
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
        {/* 未就学児の誤操作を考えて、押した瞬間には消さずまず確認を出す（#482）。 */}
        <button
          type="button"
          className={styles.resetAllButton}
          onClick={handleRequestReset}
          disabled={state.placedBlocks.length === 0}
        >
          <span aria-hidden="true">🧹</span> ぜんぶけす
        </button>
      </header>

      <div className={styles.boardArea}>
        <div
          className={`${styles.board} ${isComplete ? styles.boardComplete : ''}`}
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

          {/* 完成演出。盤面を隠さない薄いキラキラ＋盤面下のバナーだけを重ね、
              盤面そのものはそのまま見えるようにする（過度に長い操作不能時間を作らない）。 */}
          {isComplete ? (
            <div className={styles.celebration}>
              <div className={styles.celebrationSparkles} aria-hidden="true" key={celebrationSeq}>
                {CELEBRATION_SPARKLES.map((sparkle) => (
                  <span
                    key={`${sparkle.left}-${sparkle.top}`}
                    className={styles.sparkle}
                    style={{
                      left: `${sparkle.left}%`,
                      top: `${sparkle.top}%`,
                      animationDelay: `${sparkle.delayMs}ms`,
                      fontSize: `${sparkle.scale * 26}px`,
                    }}
                  >
                    ✨
                  </span>
                ))}
              </div>
              <div className={styles.celebrationBanner} role="status" aria-live="polite">
                <p className={styles.celebrationText}>
                  <span aria-hidden="true">🎉</span> できた！
                </p>
                <button type="button" className={styles.againButton} onClick={handleRestart}>
                  <span aria-hidden="true">🔁</span> もういっかい
                </button>
              </div>
            </div>
          ) : null}
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

      {resetConfirmOpen ? (
        <div className={styles.resetConfirm} role="group" aria-label="ぜんぶ けす かくにん">
          <p className={styles.resetConfirmText}>ぜんぶ けす？</p>
          <div className={styles.resetConfirmButtons}>
            <button type="button" className={styles.resetConfirmCancel} onClick={handleCancelReset}>
              いいえ
            </button>
            <button type="button" className={styles.resetConfirmOk} onClick={handleConfirmReset}>
              はい、けす
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.message} role="status" aria-live="polite">
          {message}
        </p>
      )}

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
