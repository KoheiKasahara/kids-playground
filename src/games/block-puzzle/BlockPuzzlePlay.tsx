import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'
import BlockPiece from './BlockPiece'
import { BOARD_COLS, BOARD_ROWS, allBoardCells, cellKey, type BoardCell } from './board'
import { BLOCK_SHAPES, blockShape, shapeCells, type BlockRotation, type BlockShapeId } from './blockShapes'
import { cellBounds, cellBoundsPercent } from './blockRendering'
import { canPlaceBlock, cellOwners, isBoardFull, occupiedCells, placedBlockCells } from './placement'
import {
  canMoveOrSwapPlacedBlock,
  createBlockPuzzleState,
  deleteSelectedPlacedBlock,
  isSelectedPlacedBlockConfirmed,
  moveOrSwapPlacedBlock,
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
/** #483: 回転は常に成功するが、その結果はみ出た／重なったままのときの案内。 */
const UNCONFIRMED_MESSAGE = 'はみだしているよ。うごかして なおしてね'
/** #483: はみ出たパーツを直す前に、他のパーツ／形を選ぼうとしたときの案内。 */
const CANNOT_SWITCH_MESSAGE = 'さきに ここを なおしてね'

/** 直前の操作で置けなかった／動かせなかったマス。 */
type InvalidCell = { readonly cell: BoardCell } | null

/**
 * ドラッグでつまみ上げている最中の一時状態（#483, #510）。ゲームの正本（BlockPuzzleState）
 * には含めない。指を離すまでは盤面には何も書き込まず、見た目の追従だけに使う。
 *
 * kind: 'move' は配置済みパーツをつかんで動かす／入れ替える操作（#483）、
 * 'place' はパーツ一覧で選んだ「まだ置いていない形」を、あきマスの上へ
 * ドラッグして置く操作（#510）。どちらも指を離すまでは着地候補を見せるだけで、
 * 実際に盤面を書き換えるのは pointerup／pointercancel の時点だけにする。
 */
type MoveDragState = {
  readonly kind: 'move'
  readonly pointerId: number
  readonly blockId: string
  readonly originAnchor: BoardCell
  readonly currentAnchor: BoardCell
  readonly startClientX: number
  readonly startClientY: number
  /** 指がしきい値を超えて動いたか。タップと区別するためだけに使う。 */
  readonly moved: boolean
}

type PlaceDragState = {
  readonly kind: 'place'
  readonly pointerId: number
  readonly shapeId: BlockShapeId
  readonly rotation: BlockRotation
  /** 指の現在位置から算出した、置いたときの基準セル（盤面外もそのまま持つ）。 */
  readonly currentAnchor: BoardCell
  readonly startClientX: number
  readonly startClientY: number
  readonly moved: boolean
}

type DragState = MoveDragState | PlaceDragState | null

/** タップとドラッグを区別するしきい値（px）。指のわずかな揺れをタップ扱いにする。 */
const DRAG_THRESHOLD_PX = 10

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
 * ブロックパズル（#480 Phase 1 + #481 Phase 2 + #482 Phase 3 + #483 Phase 4）。
 *
 * Phase 1は「パーツ一覧で形を選ぶ → 盤面のマスをタップして置く」だけ、
 * Phase 2では置いたあとも自由に試行錯誤できるよう
 * 「まわす（未配置・配置済み共通）」「盤面上パーツの選択」「移動」「けす」を追加した。
 * Phase 3では遊びとして完成させるため、全マスが埋まったときだけの完成演出（できた！＋
 * もういっかい）と、プレイ途中でも盤面全体を空にできる「ぜんぶけす」を追加した。
 * Phase 4では、選択中パーツの縁取りを囲む長方形ではなく形なりにし（BlockPiece側）、
 * 配置済みパーツの回転を常に成功させて「はみ出た／重なったまま」の状態を許し、
 * ドラッグでの移動・入れ替えを追加した。
 *
 * 落下・ライン消去・時間制限・スコア・ゲームオーバー・ランダム配布は最後まで持たず、
 * 操作が不正なとき（盤面外／重なり）も失敗にはせず、短いことばと赤いわくで知らせるだけにしている。
 *
 * 盤面の正本は state.placedBlocks（配置済みブロックの配列）で、
 * このコンポーネントはそこから描画を導出するだけ。マスの色を直接書き換えることはしない。
 * 完成判定（isBoardFull）も同じ配列から毎回導くだけで、専用のフラグは状態に持たない。
 * ドラッグ中の一時的な見た目（DragState）だけは例外的にこのコンポーネントのローカル状態
 * （盤面の正本の外）に持ち、指を離した瞬間にだけ正本へ反映する。
 */
export default function BlockPuzzlePlay() {
  const navigate = useNavigate()
  const [state, setState] = useState<BlockPuzzleState>(createBlockPuzzleState)
  /**
   * 直前の操作で拒否されたフィードバック。「置けない」「動かせない」はマス、
   * 「よそを選ぼうとした」はマスを持たないので分けて持つ。次の操作まで残す（時間で消さないので動きが読みやすい）。
   */
  const [invalidCell, setInvalidCell] = useState<InvalidCell>(null)
  /** はみ出た／重なったパーツを直す前に、他のパーツや形を選ぼうとしたときの案内（#483）。 */
  const [switchBlocked, setSwitchBlocked] = useState(false)
  /** 「ぜんぶけす」の確認中かどうか（誤操作防止のため、押した瞬間には消さない）。 */
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  /** 完成演出（キラキラ）を作り直すための世代番号。完成するたびに1つ進める。 */
  const [celebrationSeq, setCelebrationSeq] = useState(0)
  /** 直前の描画時点で完成していたか。「いま完成した瞬間」だけを検出するために持つ。 */
  const wasCompleteRef = useRef(false)

  /** ドラッグ中の一時状態。再描画のトリガー用（実体は dragRef）。 */
  const [dragPreview, setDragPreview] = useState<DragState>(null)
  const dragRef = useRef<DragState>(null)
  /** ドラッグ直後に発火する click を無視するためのフラグ（タップとの二重処理を防ぐ）。 */
  const dragMovedRef = useRef(false)
  /** ピクセル→マスの変換に使う、盤面の実表示範囲（#483）。 */
  const blockLayerRef = useRef<HTMLDivElement>(null)
  /** window イベントリスナーから常に最新の state を読むための参照。 */
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })

  /**
   * 直前のフィードバックをまとめて消す。「ぜんぶけす」の確認もここに含めるのは、
   * 確認を出したあとに他の操作（形を選ぶ・置く・まわす・けす）を始めたら、
   * 確認画面を出したままにしないため。
   */
  const clearFeedback = () => {
    setInvalidCell(null)
    setSwitchBlocked(false)
    setResetConfirmOpen(false)
  }

  const owners = cellOwners(state.placedBlocks)
  const selectedPlacedBlock = state.selectedPlacedBlockId
    ? (state.placedBlocks.find((block) => block.id === state.selectedPlacedBlockId) ?? null)
    : null
  const isSelectedConfirmed = isSelectedPlacedBlockConfirmed(state)
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
   * ドラッグの追従・確定を window レベルの pointermove / pointerup で行う（#483, #510）。
   * 盤面のマスボタンは pointerdown だけ受け、指が盤面の外へ出ても追従・確定できるよう
   * window で拾う。マウント時に一度だけ張り、常に ref 経由で最新の状態を読むことで
   * 依存配列を空のままにし、張り直しのたびに購読が切れる不具合を避けている。
   *
   * #510 では、ドラッグ確定後（moved）は pointermove の既定動作（ページスクロール等）を
   * 明示的に打ち消す。CSS の touch-action: none が主な対策だが、念のための二重の備え。
   */
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current || event.pointerId !== current.pointerId) return
      const rect = blockLayerRef.current?.getBoundingClientRect()
      if (!rect || rect.width === 0 || rect.height === 0) return

      const cellWidth = rect.width / BOARD_COLS
      const cellHeight = rect.height / BOARD_ROWS
      const moved =
        current.moved ||
        Math.abs(event.clientX - current.startClientX) > DRAG_THRESHOLD_PX ||
        Math.abs(event.clientY - current.startClientY) > DRAG_THRESHOLD_PX

      // 'move'（配置済みパーツ）は、つかんだ指の位置からの移動量（マス単位）で
      // 着地先を決める。指がパーツの基準セルからずれた場所をつかんでいても、
      // その相対位置を保ったまま追従できる。
      // 'place'（未配置の形）は、指の絶対位置の下にあるマスをそのまま基準セルにする
      // （タップで置いたときと同じ考え方）。盤面の外へ出た場合もそのまま外挿し、
      // クランプしない（＝盤面外へはみ出た「置けない」プレビューをそのまま見せる）。
      const nextAnchor: BoardCell =
        current.kind === 'move'
          ? {
              col: current.originAnchor.col + Math.round((event.clientX - current.startClientX) / cellWidth),
              row: current.originAnchor.row + Math.round((event.clientY - current.startClientY) / cellHeight),
            }
          : {
              col: Math.floor((event.clientX - rect.left) / cellWidth),
              row: Math.floor((event.clientY - rect.top) / cellHeight),
            }

      if (
        moved === current.moved &&
        nextAnchor.col === current.currentAnchor.col &&
        nextAnchor.row === current.currentAnchor.row
      ) {
        return
      }
      // しきい値を超えて実際にドラッグが始まったら、ブラウザ既定のスクロール等を打ち消す。
      if (moved) event.preventDefault()
      const next = { ...current, currentAnchor: nextAnchor, moved } as DragState
      dragRef.current = next
      setDragPreview(next)
    }

    /** 指を離した／ドラッグが中断されたときの確定処理。 */
    const finishDrag = (event: PointerEvent) => {
      const current = dragRef.current
      if (!current || event.pointerId !== current.pointerId) return
      dragRef.current = null
      setDragPreview(null)
      if (!current.moved) return

      // 実際に動かしたドラッグだけ、続けて発火する click（タップ扱い）を無視させる。
      dragMovedRef.current = true

      if (current.kind === 'move') {
        const result = moveOrSwapPlacedBlock(stateRef.current, current.blockId, current.currentAnchor)
        if (result) {
          setState(result)
          clearFeedback()
        } else {
          setInvalidCell({ cell: current.currentAnchor })
        }
        return
      }

      const placed = placeSelectedBlock(stateRef.current, current.currentAnchor)
      if (placed) {
        setState(placed)
        clearFeedback()
      } else {
        setInvalidCell({ cell: current.currentAnchor })
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', finishDrag)
    window.addEventListener('pointercancel', finishDrag)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', finishDrag)
      window.removeEventListener('pointercancel', finishDrag)
    }
  }, [])

  const handleSelectShape = (shapeId: BlockShapeId) => {
    if (selectedPlacedBlock && !isSelectedConfirmed) {
      // はみ出た／重なったパーツを直す前に形を選ぼうとした：直すまで待たせる。
      setSwitchBlocked(true)
      return
    }
    setState(selectShape(state, shapeId))
    clearFeedback()
  }

  const handleTapCell = (cell: BoardCell) => {
    if (dragMovedRef.current) {
      // 直前のドラッグの終わりに続けて発火した click。すでにドラッグ側で処理済み。
      dragMovedRef.current = false
      return
    }

    const owner = owners.get(cellKey(cell))
    if (owner) {
      if (state.selectedPlacedBlockId && state.selectedPlacedBlockId !== owner.id && !isSelectedConfirmed) {
        // 選んでいるパーツがはみ出た／重なったままのとき、別のパーツはつかめない。
        setSwitchBlocked(true)
        return
      }
      if (state.selectedPlacedBlockId === owner.id && !isSelectedConfirmed) {
        // まだ確定していない自分自身の選択解除も、直すまではさせない。
        setSwitchBlocked(true)
        return
      }
      // 配置済みパーツをタップ：その1パーツ全体を選ぶ（もう一度タップで選択解除）。
      setState(selectPlacedBlock(state, owner.id))
      clearFeedback()
      return
    }

    if (state.selectedPlacedBlockId) {
      // 配置済みパーツ選択中：あいているマスは移動先として扱う
      // （はみ出た／重なったままのパーツを直す操作もここを通る）。
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

  /**
   * 盤面のマスを押し始めた瞬間（#483, #510）。パーツの上なら配置済みパーツの
   * 移動・入れ替えドラッグ、あきマス（かつ配置済みパーツを編集中でない）なら
   * 新規パーツの配置ドラッグの開始候補にする。しきい値を超えるまではどちらも
   * タップと同じ扱いのままなので、既存のタップ操作は変えない。
   */
  const handleCellPointerDown = (cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const owner = owners.get(cellKey(cell))

    if (owner) {
      if (state.selectedPlacedBlockId && state.selectedPlacedBlockId !== owner.id && !isSelectedConfirmed) {
        // はみ出た／重なったパーツを直す前は、他のパーツのドラッグも始めさせない。
        return
      }
      const next: DragState = {
        kind: 'move',
        pointerId: event.pointerId,
        blockId: owner.id,
        originAnchor: owner.anchor,
        currentAnchor: owner.anchor,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      }
      dragRef.current = next
      setDragPreview(next)
      return
    }

    if (state.selectedPlacedBlockId) return
    const next: DragState = {
      kind: 'place',
      pointerId: event.pointerId,
      shapeId: state.selectedShapeId,
      rotation: state.pendingRotation,
      currentAnchor: cell,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    }
    dragRef.current = next
    setDragPreview(next)
  }

  const handleRotate = () => {
    if (state.selectedPlacedBlockId) {
      const rotated = rotateSelectedPlacedBlock(state)
      if (!rotated) return
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

  /**
   * ドラッグ中の着地プレビュー（#510）。配置済みパーツの移動・入れ替えも、
   * パーツ一覧から選んだ新規パーツの配置も、同じ形で「いま置こうとしている形」を
   * 盤面に対する割合(%)で求める。盤面外・重なりで置けない場合も cells 自体は
   * そのまま返し、valid だけで区別する（プレビューを消さないため）。
   */
  const dropPreview = (() => {
    if (!dragPreview) return null
    if (dragPreview.kind === 'move') {
      if (!dragPreview.moved) return null
      const block = state.placedBlocks.find((candidate) => candidate.id === dragPreview.blockId)
      if (!block) return null
      return {
        shapeId: block.shapeId,
        cells: occupiedCells(block.shapeId, dragPreview.currentAnchor, block.rotation),
        valid: canMoveOrSwapPlacedBlock(state, block.id, dragPreview.currentAnchor),
      }
    }
    return {
      shapeId: dragPreview.shapeId,
      cells: occupiedCells(dragPreview.shapeId, dragPreview.currentAnchor, dragPreview.rotation),
      valid: canPlaceBlock(state.placedBlocks, dragPreview.shapeId, dragPreview.currentAnchor, dragPreview.rotation),
    }
  })()

  const message = invalidCell
    ? CANNOT_PLACE_MESSAGE
    : switchBlocked
      ? CANNOT_SWITCH_MESSAGE
      : selectedPlacedBlock
        ? isSelectedConfirmed
          ? MOVE_HINT_MESSAGE
          : UNCONFIRMED_MESSAGE
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
                onPointerDown={(event) => handleCellPointerDown(cell, event)}
              />
            )
          })}

          {/* 置いたブロックはマス目の上に重ねて描く。タップは下のマスのボタンが受ける。
              位置は盤面に対する割合(%)で決める（#483）。回転で盤面外へはみ出た
              まだ確定していないパーツも、CSS Gridの行番号に頼らずそのまま描ける。 */}
          <div
            className={styles.blockLayer}
            aria-hidden="true"
            ref={blockLayerRef}
            data-testid="block-puzzle-block-layer"
          >
            {state.placedBlocks.map((block) => {
              const isSelected = block.id === state.selectedPlacedBlockId
              // #510: ドラッグ中も元の位置（originAnchor ではなく、書き換えていない
              // block.anchor そのもの）に薄く残し、着地候補は別の重ね（dropPreview）で見せる。
              // こうすることで「元のパーツ位置」と「いまの着地候補」を視覚的に区別できる。
              const isDraggingSource =
                dragPreview !== null &&
                dragPreview.kind === 'move' &&
                dragPreview.moved &&
                dragPreview.blockId === block.id
              const cells = placedBlockCells(block)
              const bounds = cellBounds(cells)
              const rect = cellBoundsPercent(bounds, BOARD_COLS, BOARD_ROWS)
              const unconfirmed = isSelected && !isDraggingSource && !isSelectedConfirmed
              return (
                <BlockPiece
                  key={block.id}
                  shape={blockShape(block.shapeId)}
                  cells={cells}
                  selected={isSelected && !isDraggingSource}
                  unconfirmed={unconfirmed}
                  dragging={isDraggingSource}
                  className={`${styles.placedBlock} ${isSelected ? styles.selectedPlacedBlock : ''} ${
                    isDraggingSource ? styles.draggingPlacedBlock : ''
                  }`}
                  style={{
                    left: `${rect.leftPercent}%`,
                    top: `${rect.topPercent}%`,
                    width: `${rect.widthPercent}%`,
                    height: `${rect.heightPercent}%`,
                  }}
                />
              )
            })}

            {/* ドラッグ中の着地プレビュー（#510）。配置可能なら通常色の半透明、
                配置不可なら赤系の警告色にするが、盤面外・重なりで置けない場合も
                cells 自体は消さず、形なりのまま見せ続ける。 */}
            {dropPreview
              ? (() => {
                  const bounds = cellBounds(dropPreview.cells)
                  const rect = cellBoundsPercent(bounds, BOARD_COLS, BOARD_ROWS)
                  return (
                    <BlockPiece
                      shape={blockShape(dropPreview.shapeId)}
                      cells={dropPreview.cells}
                      tone={dropPreview.valid ? 'valid' : 'invalid'}
                      dataTestId="block-puzzle-drop-preview"
                      className={styles.dropPreview}
                      style={{
                        left: `${rect.leftPercent}%`,
                        top: `${rect.topPercent}%`,
                        width: `${rect.widthPercent}%`,
                        height: `${rect.heightPercent}%`,
                      }}
                    />
                  )
                })()
              : null}

            {/* 置けなかった・動かせなかったマスの赤枠。ブロックより後ろに置くと重なりのときに
                隠れてしまうため、同じレイヤーのいちばん上に描く。 */}
            {invalidCell ? (
              <span
                className={styles.invalidCell}
                style={{
                  left: `${(invalidCell.cell.col / BOARD_COLS) * 100}%`,
                  top: `${(invalidCell.cell.row / BOARD_ROWS) * 100}%`,
                  width: `${(1 / BOARD_COLS) * 100}%`,
                  height: `${(1 / BOARD_ROWS) * 100}%`,
                }}
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
