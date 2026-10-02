import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import BlockPiece from './BlockPiece'
import type { BoardCell } from './board'
import { blockShape, type BlockShapeId } from './blockShapes'
import { cellBounds, cellBoundsPercent } from './blockRendering'
import {
  FALLING_COLS,
  FALLING_ROWS,
  createFallingPuzzleState,
  dropFallingPieceToLanding,
  fallingGhostCells,
  fallingPieceCells,
  lockFallingPiece,
  moveFallingPieceSideways,
  moveFallingPieceToColumn,
  rotateFallingPiece,
  settledGroups,
  stepFallingPieceDown,
  type FallingPuzzleState,
} from './fallingPuzzleState'
import { playBlockLandSound, playLineClearSound, playStackFullSound } from './sounds'
import { blockPuzzleProgress, fallingStars, readFallingBest, recordFallingBest } from './progress'
import { vibrate } from '../../utils/haptics'
import { primeAudio } from '../../audio/sound'
import styles from './FallingBlockPuzzle.module.css'

/**
 * おちる はやさ（#711）。
 * 既定は「じぶんで」＝ひとりでには落ちてこない。幼児が自分のペースで置く場所を決め、
 * 「おとす」を押してはじめて落ちるので、急かされることも、考えている間に積み上がることもない。
 * ひとりでに落ちる2段階も、ふつうの落ち物より遅い間隔にして、動かして考える時間を残している。
 */
const SPEEDS = [
  { id: 'manual', label: 'じぶんで', icon: '✋', intervalMs: null },
  { id: 'slow', label: 'ゆっくり', icon: '🐢', intervalMs: 2400 },
  { id: 'fast', label: 'はやめ', icon: '🐰', intervalMs: 1300 },
] as const

type SpeedId = (typeof SPEEDS)[number]['id']

/** 「おとす」を押してから実際に積むまでの時間[ms]。CSSの落下アニメーションと合わせる。 */
const DROP_FALL_MS = 260
/** すでに着地している位置で押されたときの、みじかい間。 */
const DROP_SETTLE_MS = 90

const HINT_MESSAGE = 'おきたい ところを タップ！ ⬇ボタンで おとすよ'
const OVER_MESSAGE = 'いっぱいに なっちゃった！'

/** よこ1れつがそろった瞬間に盤面へ散らすキラキラ。位置(%)と遅れ(ms)だけの静的な飾り。 */
const CLEAR_SPARKLES: readonly { left: number; top: number; delayMs: number }[] = [
  { left: 12, top: 62, delayMs: 0 },
  { left: 38, top: 78, delayMs: 70 },
  { left: 62, top: 66, delayMs: 40 },
  { left: 86, top: 80, delayMs: 120 },
  { left: 50, top: 50, delayMs: 90 },
]

type BoardPieceProps = {
  shapeId: BlockShapeId
  cells: readonly BoardCell[]
  testId: string
  /** 着地予定を見せる うすい ブロックは 'valid'（BlockPiece 側が半透明にする）。 */
  tone?: 'valid'
  className?: string
}

/**
 * 盤面に重ねる1まとまりのブロック。位置は盤面に対する割合(%)で決めるので、
 * 落ちている途中のブロックも、積まれたブロックも、同じ仕組みで置ける。
 * data-cells は「どのマスを占めているか」を、テストから形の乱数に左右されずに読むための目印。
 */
function BoardPiece({ shapeId, cells, testId, tone, className }: BoardPieceProps) {
  const rect = cellBoundsPercent(cellBounds(cells), FALLING_COLS, FALLING_ROWS)
  return (
    <span
      className={`${styles.pieceSlot} ${className ?? ''}`}
      data-testid={testId}
      data-shape-id={shapeId}
      data-cells={cells.map((cell) => `${cell.col},${cell.row}`).join(' ')}
      style={{
        left: `${rect.leftPercent}%`,
        top: `${rect.topPercent}%`,
        width: `${rect.widthPercent}%`,
        height: `${rect.heightPercent}%`,
      }}
    >
      <BlockPiece shape={blockShape(shapeId)} cells={cells} tone={tone} className={styles.piece} />
    </span>
  )
}

type Props = {
  /** モードえらびへ戻る。 */
  onBack: () => void
}

/**
 * ブロックパズルの「おちてくる」モード（#711）。
 *
 * テトリスのような落ち物だが、幼児が置く場所を自分で決められることを最優先にしている。
 * - 既定では ひとりでには落ちてこない（はやさ「じぶんで」）。置きたい列をタップし、
 *   着地予定の うすいブロック を見て納得してから「おとす」で確定する。
 * - ひとりでに落ちるはやさも選べるが、どちらもふつうの落ち物よりゆっくりで、
 *   下まで来てからも1回ぶん待ってから積むので、ぎりぎりで動かし直せる。
 * - 積み上がって出口がふさがっても「いっぱいに なっちゃった」と伝えるだけにして、
 *   点数・時間制限・ゲームオーバーの演出は持たない。
 *
 * 盤面の正本は fallingPuzzleState（マスの配列）で、この画面はそこから描画を導出するだけ。
 * 落ちる途中の見た目（落下アニメーション中かどうか）だけを、正本の外のローカル状態に持つ。
 */
export default function FallingBlockPuzzle({ onBack }: Props) {
  const [state, setState] = useState<FallingPuzzleState>(() => createFallingPuzzleState())
  const [speedId, setSpeedId] = useState<SpeedId>('manual')
  /** 「おとす」で落ちている最中。積むまでのわずかな間、次の操作を受けない。 */
  const [dropping, setDropping] = useState(false)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)
  const [best, setBest] = useState(readFallingBest)
  /** 直前にそろった段の数。次の操作を始めるまで「そろった！」を出しておく。 */
  const [clearNotice, setClearNotice] = useState(0)
  /** キラキラを作り直すための世代番号。そろえるたびに1つ進める。 */
  const [clearSeq, setClearSeq] = useState(0)

  /** タイマーから常に最新の状態を読むための参照。 */
  const stateRef = useRef(state)
  const droppingRef = useRef(false)
  /** ひとりでに落ちるとき、床に着いてから1回ぶん待つための猶予フラグ。 */
  const restingRef = useRef(false)
  const lockTimerRef = useRef<number | null>(null)

  const commit = useCallback((next: FallingPuzzleState) => {
    stateRef.current = next
    setState(next)
  }, [])

  /** いま落ちているブロックを盤面へ積む。よこ1れつがそろえば、その場で音と演出を出す。 */
  const lockNow = useCallback(() => {
    lockTimerRef.current = null
    droppingRef.current = false
    restingRef.current = false
    setDropping(false)
    const current = stateRef.current
    if (current.status !== 'playing' || !current.piece) return

    const next = lockFallingPiece(current)
    commit(next)
    playBlockLandSound()
    setClearNotice(next.lastClearedRows)
    if (next.lastClearedRows > 0) {
      playLineClearSound(next.lastClearedRows)
      setClearSeq((current) => current + 1)
      vibrate('success')
      setBest(recordFallingBest(next.clearedRows))
      const stars = fallingStars(next.clearedRows)
      if (stars > 0) blockPuzzleProgress.record('falling', stars)
    } else {
      vibrate('tap')
    }
    if (next.status === 'over') playStackFullSound()
  }, [commit])

  /** 操作を始めたら「そろった！」の表示と、さいしょから の確認を引っ込める。 */
  const startAction = useCallback(() => {
    primeAudio()
    setClearNotice(0)
    setRestartConfirmOpen(false)
  }, [])

  const handleMoveToColumn = useCallback(
    (col: number) => {
      if (droppingRef.current) return
      startAction()
      commit(moveFallingPieceToColumn(stateRef.current, col))
    },
    [commit, startAction],
  )

  const handleMoveSideways = useCallback(
    (delta: number) => {
      if (droppingRef.current) return
      startAction()
      commit(moveFallingPieceSideways(stateRef.current, delta))
    },
    [commit, startAction],
  )

  const handleRotate = useCallback(() => {
    if (droppingRef.current) return
    startAction()
    commit(rotateFallingPiece(stateRef.current))
  }, [commit, startAction])

  /**
   * 「おとす」。着地予定の位置までブロックを下ろし、落ちきる時間だけ待ってから積む。
   * 待っている間に別の操作を受け付けないのは、落ちている途中で場所が変わると
   * 「どこへ落ちたのか」が分からなくなるため。
   */
  const handleDrop = useCallback(() => {
    if (droppingRef.current) return
    const current = stateRef.current
    if (current.status !== 'playing' || !current.piece) return
    startAction()

    const lowered = dropFallingPieceToLanding(current)
    const distance = (lowered.piece?.anchor.row ?? 0) - current.piece.anchor.row
    droppingRef.current = true
    setDropping(true)
    commit(lowered)
    lockTimerRef.current = window.setTimeout(lockNow, distance > 0 ? DROP_FALL_MS : DROP_SETTLE_MS)
  }, [commit, lockNow, startAction])

  const handleRestart = useCallback(() => {
    if (lockTimerRef.current !== null) window.clearTimeout(lockTimerRef.current)
    lockTimerRef.current = null
    droppingRef.current = false
    restingRef.current = false
    setDropping(false)
    setClearNotice(0)
    setRestartConfirmOpen(false)
    commit(createFallingPuzzleState())
  }, [commit])

  /** ひとりでに落ちるはやさのとき、一定の間隔で1段ずつ落とす。 */
  useEffect(() => {
    const interval = SPEEDS.find((speed) => speed.id === speedId)?.intervalMs ?? null
    if (interval === null) return

    const timer = window.setInterval(() => {
      if (droppingRef.current) return
      const current = stateRef.current
      if (current.status !== 'playing') return

      const stepped = stepFallingPieceDown(current)
      if (stepped) {
        restingRef.current = false
        commit(stepped)
        return
      }
      // 下まで来ても、すぐには積まずに1回ぶん待つ。ぎりぎりで動かし直せる余裕を残す。
      if (!restingRef.current) {
        restingRef.current = true
        return
      }
      lockNow()
    }, interval)
    return () => window.clearInterval(timer)
  }, [commit, lockNow, speedId])

  /** 画面を離れるときに、積むのを待っているタイマーを止める。 */
  useEffect(
    () => () => {
      if (lockTimerRef.current !== null) window.clearTimeout(lockTimerRef.current)
    },
    [],
  )

  /**
   * キーボードでも遊べるようにする。タッチ以外の操作手段を損なわないための補助で、
   * ボタンにフォーカスがある状態のスペース／Enterは、そのボタン自身の操作に任せる。
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return
      const onButton = event.target instanceof Element && event.target.closest('button') !== null
      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault()
          handleMoveSideways(-1)
          break
        case 'ArrowRight':
          event.preventDefault()
          handleMoveSideways(1)
          break
        case 'ArrowUp':
          event.preventDefault()
          handleRotate()
          break
        case 'ArrowDown':
          event.preventDefault()
          handleDrop()
          break
        case ' ':
          if (onButton) return
          event.preventDefault()
          handleDrop()
          break
        default:
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleDrop, handleMoveSideways, handleRotate])

  const isOver = state.status === 'over'
  const ghostCells = dropping ? [] : fallingGhostCells(state)
  const pieceCells = state.piece ? fallingPieceCells(state.piece) : []
  const nextShape = blockShape(state.nextShapeId)
  const message = isOver ? OVER_MESSAGE : clearNotice > 0 ? 'そろった！ すごい！' : HINT_MESSAGE

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton onBack={onBack} />
        {/* せまい端末で折り返すときも、ことばの途中で切れないよう語ごとに区切る。 */}
        <h1 className={styles.title}>
          <span aria-hidden="true">⬇️</span> <span className={styles.titleWord}>おちてくる</span>{' '}
          <span className={styles.titleWord}>ブロック</span>
        </h1>
        <button
          type="button"
          className={styles.restartButton}
          onClick={() => {
            setClearNotice(0)
            setRestartConfirmOpen(true)
          }}
          disabled={isOver || state.droppedPieces === 0}
        >
          <span aria-hidden="true">🔁</span> さいしょから
        </button>
      </header>

      <div className={styles.statusRow}>
        <div className={styles.nextBox}>
          <span className={styles.nextLabel}>つぎ</span>
          <span className={styles.nextPieceArea}>
            <BlockPiece
              shape={nextShape}
              cells={nextShape.cells}
              className={styles.nextPiece}
              dataTestId="falling-next-piece"
            />
          </span>
        </div>
        <p className={styles.score}>
          <span aria-hidden="true">⭐</span> そろえた: <strong>{state.clearedRows}</strong>
          {best > 0 ? <small className={styles.best}> いちばん: {best}</small> : null}
        </p>
      </div>

      <div className={styles.boardArea}>
        <div
          className={`${styles.board} ${clearNotice > 0 ? styles.boardCleared : ''}`}
          style={{ '--board-cols': FALLING_COLS, '--board-rows': FALLING_ROWS } as CSSProperties}
        >
          <div className={styles.cellGrid} aria-hidden="true">
            {Array.from({ length: FALLING_COLS * FALLING_ROWS }, (_, index) => (
              <span key={index} className={styles.cell} />
            ))}
          </div>

          <div className={styles.blockLayer} aria-hidden="true" data-testid="falling-block-layer">
            {settledGroups(state.grid).map((group) => (
              <BoardPiece
                key={`settled-${group.cells[0].col},${group.cells[0].row}`}
                shapeId={group.shapeId}
                cells={group.cells}
                testId="falling-settled"
              />
            ))}

            {/* 着地予定の うすい ブロック。どこへ落ちるかを、おとす前に見せる。 */}
            {ghostCells.length > 0 && state.piece ? (
              <BoardPiece
                shapeId={state.piece.shapeId}
                cells={ghostCells}
                tone="valid"
                testId="falling-ghost"
                className={styles.ghost}
              />
            ) : null}

            {/* 落ちているブロック。ブロックが変わるたびに作り直して、
                前のブロックの位置から動いてくるアニメーションにならないようにする。 */}
            {state.piece ? (
              <BoardPiece
                key={`piece-${state.droppedPieces}`}
                shapeId={state.piece.shapeId}
                cells={pieceCells}
                testId="falling-piece"
                className={styles.fallingPiece}
              />
            ) : null}
          </div>

          {/* 置きたい場所をえらぶ列。1列まるごとが押せる大きさなので、
              小さな指でも「ここ」と指しやすい。読み上げでは、盤面を見なくても
              どれだけ積まれているかが分かるように、その列のブロックの数も伝える。 */}
          <div className={styles.columnLayer} role="group" aria-label="おきたい ばしょを えらぶ">
            {Array.from({ length: FALLING_COLS }, (_, col) => {
              const stacked = state.grid.reduce((count, row) => (row[col] === null ? count : count + 1), 0)
              return (
                <button
                  key={col}
                  type="button"
                  className={styles.columnButton}
                  aria-label={`よこ${col + 1} に うごかす${stacked > 0 ? ` ブロック${stacked}こ` : ''}`}
                  disabled={isOver}
                  onClick={() => handleMoveToColumn(col)}
                />
              )
            })}
          </div>

          {clearNotice > 0 ? (
            <div className={styles.sparkles} aria-hidden="true" key={clearSeq}>
              {CLEAR_SPARKLES.map((sparkle) => (
                <span
                  key={`${sparkle.left}-${sparkle.top}`}
                  className={styles.sparkle}
                  style={{
                    left: `${sparkle.left}%`,
                    top: `${sparkle.top}%`,
                    animationDelay: `${sparkle.delayMs}ms`,
                  }}
                >
                  ✨
                </span>
              ))}
            </div>
          ) : null}

          {isOver ? (
            <div className={styles.overBanner}>
              <p className={styles.overText}>
                <span aria-hidden="true">🫧</span> いっぱいに なっちゃった！
              </p>
              <button type="button" className={styles.againButton} onClick={handleRestart}>
                <span aria-hidden="true">🔁</span> もういっかい
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {restartConfirmOpen ? (
        <div className={styles.restartConfirm} role="group" aria-label="さいしょから かくにん">
          <p className={styles.restartConfirmText}>さいしょから する？</p>
          <div className={styles.restartConfirmButtons}>
            <button
              type="button"
              className={styles.restartConfirmCancel}
              onClick={() => setRestartConfirmOpen(false)}
            >
              いいえ
            </button>
            <button type="button" className={styles.restartConfirmOk} onClick={handleRestart}>
              はい、さいしょから
            </button>
          </div>
        </div>
      ) : (
        <p className={styles.message} role="status" aria-live="polite">
          {message}
        </p>
      )}

      <div className={styles.controls} role="group" aria-label="うごかす・まわす・おとす">
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => handleMoveSideways(-1)}
          disabled={isOver}
          aria-label="ひだりへ うごかす"
        >
          <span className={styles.controlIcon} aria-hidden="true">
            ⬅️
          </span>
          ひだり
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={handleRotate}
          disabled={isOver}
          aria-label="まわす"
        >
          <span className={styles.controlIcon} aria-hidden="true">
            🔄
          </span>
          まわす
        </button>
        <button
          type="button"
          className={styles.controlButton}
          onClick={() => handleMoveSideways(1)}
          disabled={isOver}
          aria-label="みぎへ うごかす"
        >
          <span className={styles.controlIcon} aria-hidden="true">
            ➡️
          </span>
          みぎ
        </button>
        <button
          type="button"
          className={styles.dropButton}
          onClick={handleDrop}
          disabled={isOver || dropping}
          aria-label="おとす"
        >
          <span className={styles.controlIcon} aria-hidden="true">
            ⬇️
          </span>
          おとす
        </button>
      </div>

      <div className={styles.speeds} role="group" aria-label="おちる はやさ">
        {SPEEDS.map((speed) => {
          const selected = speed.id === speedId
          return (
            <button
              key={speed.id}
              type="button"
              className={`${styles.speedButton} ${selected ? styles.speedButtonSelected : ''}`}
              aria-pressed={selected}
              aria-label={`はやさ ${speed.label}`}
              onClick={() => setSpeedId(speed.id)}
            >
              <span aria-hidden="true">{speed.icon}</span> {speed.label}
            </button>
          )
        })}
      </div>
    </main>
  )
}
