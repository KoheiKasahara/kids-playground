import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import CarRoadBoard from './CarRoadBoard'
import PartPalette from './PartPalette'
import {
  canPlacePart,
  createBoard,
  INITIAL_BOARD_SIZE,
  MAX_BOARD_SIZE,
  movePart,
  placePartAt,
  removePart,
  rotatePart,
  type Board,
  type BoardCell,
} from './boardModel'
import { createPlacedPart, PART_DEFINITIONS, type PartKind } from './partDefinitions'
import { directionAngle } from './direction'
import { buildRoute, routeStatusLabel, sampleRouteProgress, type CarRoute } from './routeModel'
import { playCorrectSound } from '../../utils/quizSound'
import styles from './CarRoadBuilder.module.css'

type StageId = 'normal' | 'wide'

const STAGES: Readonly<Record<StageId, Readonly<{
  label: string
  sizeLabel: string
  size: Readonly<{ rows: number; cols: number }>
}>>> = {
  normal: { label: 'ふつう', sizeLabel: '4×4', size: INITIAL_BOARD_SIZE },
  wide: { label: 'ひろい', sizeLabel: '5×5', size: MAX_BOARD_SIZE },
}

function createDemoBoard(size = INITIAL_BOARD_SIZE): Board {
  let board = createBoard(size)
  // A tiny ready-made road helps a child understand the play loop immediately;
  // every part remains editable before departure.
  board = placePartAt(board, 1, 0, createPlacedPart('start', 2))
  board = placePartAt(board, 1, 1, createPlacedPart('straight', 2))
  board = placePartAt(board, 1, 2, createPlacedPart('goal'))
  return board
}

type PlayPhase = 'ready' | 'running' | 'stopped' | 'cleared'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const DRAG_START_DISTANCE = 8

type PaletteDragState = {
  kind: PartKind
  pointerId: number
  startX: number
  startY: number
  active: boolean
}

type DropPreview = Readonly<{
  kind: PartKind
  clientX: number
  clientY: number
  cellId: string | null
  valid: boolean
}>

export default function CarRoadBuilderPlay() {
  const navigate = useNavigate()
  const [board, setBoard] = useState<Board>(createDemoBoard)
  const [stageId, setStageId] = useState<StageId>('normal')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<PartKind | null>(null)
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const [phase, setPhase] = useState<PlayPhase>('ready')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('パーツを えらんで、みちを つなごう')
  const animationRef = useRef<number | null>(null)
  const dragFromCell = useRef<string | null>(null)
  const paletteDrag = useRef<PaletteDragState | null>(null)
  const boardRef = useRef<HTMLDivElement | null>(null)
  const suppressClick = useRef(false)
  const running = phase === 'running'

  const route = useMemo<CarRoute>(() => buildRoute(board), [board])
  const selectedCell = board.cells.find((cell) => cell.id === selectedCellId)

  // Every successful edit returns the play surface to a clean, editable
  // state. Keeping this in one helper also removes the cleared animation and
  // puts the car back at the route's start on the next render.
  const resetAfterEdit = useCallback(() => {
    setPhase('ready')
    setProgress(0)
  }, [])

  useEffect(() => {
    if (!running) {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
      return
    }
    if (route.totalLength <= 0) {
      // The departure handler resolves this case to stopped before entering
      // the running phase. Keep this guard for defensive callers.
      return
    }
    const started = performance.now()
    const duration = Math.max(2600, route.totalLength * 850)
    const frame = (now: number) => {
      const next = Math.min(1, (now - started) / duration)
      setProgress(next)
      if (next < 1) animationRef.current = requestAnimationFrame(frame)
      else {
        setPhase(route.reachedGoal ? 'cleared' : 'stopped')
        setStatus(route.reachedGoal ? 'ゴールについたよ！' : routeStatusLabel(route))
        if (route.reachedGoal) playCorrectSound()
      }
    }
    animationRef.current = requestAnimationFrame(frame)
    return () => {
      if (animationRef.current !== null) cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
  }, [route, running])

  const carSample = route.totalLength > 0
    ? sampleRouteProgress(route, phase === 'ready' ? 0 : progress)
    : null
  const carAtStart = route.startPose
    ? { x: route.startPose.col + 0.5, y: route.startPose.row + 0.5 }
    : null

  const place = useCallback((cell: BoardCell, kind: PartKind) => {
    const next = placePartAt(board, cell.row, cell.col, createPlacedPart(kind))
    if (next === board) {
      setStatus(kind === 'start' ? 'スタートは 1こ だけだよ' : kind === 'goal' ? 'ゴールは 1こ だけだよ' : 'そこには おけないよ')
      return
    }
    setBoard(next)
    resetAfterEdit()
    setSelectedCellId(cell.id)
    setStatus('おいたよ。つなぎめを みてみよう')
  }, [board, resetAfterEdit])

  const previewAt = useCallback((kind: PartKind, clientX: number, clientY: number): DropPreview => {
    const boardElement = boardRef.current
    const rect = boardElement?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      return { kind, clientX, clientY, cellId: null, valid: false }
    }

    const col = Math.floor(((clientX - rect.left) / rect.width) * board.size.cols)
    const row = Math.floor(((clientY - rect.top) / rect.height) * board.size.rows)
    const cell = board.cells.find((candidate) => candidate.row === row && candidate.col === col)
    return {
      kind,
      clientX,
      clientY,
      cellId: cell?.id ?? null,
      valid: cell ? canPlacePart(board, cell.id, createPlacedPart(kind)) : false,
    }
  }, [board])

  const handlePalettePointerDown = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (running) return
    paletteDrag.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    }
  }, [running])

  const handlePalettePointerMove = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = paletteDrag.current
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) return

    if (!drag.active) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      if (distance < DRAG_START_DISTANCE) return
      drag.active = true
      setSelectedKind(null)
      setSelectedCellId(null)
      setStatus(`${PART_DEFINITIONS[kind].label}を つかんだよ。おく ばしょへ もっていこう`)
    }

    event.preventDefault()
    setDropPreview(previewAt(kind, event.clientX, event.clientY))
  }, [previewAt])

  const finishPalettePointer = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = paletteDrag.current
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) return

    if (drag.active) {
      event.preventDefault()
      const preview = cancelled ? null : previewAt(kind, event.clientX, event.clientY)
      const target = preview?.cellId ? board.cells.find((cell) => cell.id === preview.cellId) : undefined
      if (preview && target && preview.valid) place(target, kind)
      else if (!cancelled) {
        setSelectedCellId(null)
        setStatus('そこには おけないよ')
      }
      if (!cancelled) {
        // The pointerup on the source button can be followed by a synthetic
        // click. Consume that click so a drag never becomes a second selection.
        suppressClick.current = true
        window.setTimeout(() => { suppressClick.current = false }, 0)
      }
    }

    paletteDrag.current = null
    setDropPreview(null)
  }, [board, place, previewAt])

  const handlePalettePointerUp = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPalettePointer(kind, event)
  }, [finishPalettePointer])

  const handlePalettePointerCancel = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>) => {
    finishPalettePointer(kind, event, true)
  }, [finishPalettePointer])

  const handleCellClick = useCallback((cell: BoardCell) => {
    if (running) return
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    if (selectedKind !== null) {
      // A filled cell is always selected first, even while the palette tool is
      // active. This makes touch editing deterministic and lets the next tap
      // on an empty cell move the selected part as a fallback for browsers
      // that capture the pointer on the original button.
      if (cell.kind !== null) {
        setSelectedCellId(cell.id)
        setSelectedKind(null)
        setStatus('えらんだよ。あきセルを おすと うごかせるよ')
        return
      }
      place(cell, selectedKind)
      return
    }
    const selected = selectedCellId ? board.cells.find((candidate) => candidate.id === selectedCellId) : undefined
    if (selected?.kind !== null && selected !== undefined && cell.kind === null && selected.id !== cell.id) {
      const next = movePart(board, selected.id, cell.id)
      if (next !== board) {
        setBoard(next)
        resetAfterEdit()
        setSelectedCellId(cell.id)
        setStatus('うごかしたよ')
        return
      }
    }
    setSelectedCellId(cell.id)
  }, [board, place, resetAfterEdit, running, selectedCellId, selectedKind])

  const handleCellPointerDown = useCallback((cell: BoardCell) => {
    if (!running && selectedKind === null && cell.kind !== null) dragFromCell.current = cell.id
  }, [running, selectedKind])

  const handleCellPointerUp = useCallback((cell: BoardCell) => {
    if (running) return
    const from = dragFromCell.current
    if (from !== null) {
      dragFromCell.current = null
      if (from !== cell.id) {
        const next = movePart(board, from, cell.id)
        if (next === board) setStatus('そこには おけないよ')
        else {
          setBoard(next)
          resetAfterEdit()
          setSelectedCellId(cell.id)
          setStatus('うごかしたよ')
        }
        suppressClick.current = true
      }
      return
    }
  }, [board, resetAfterEdit, running])

  const selectKind = useCallback((kind: PartKind) => {
    if (suppressClick.current) {
      suppressClick.current = false
      return
    }
    setSelectedKind((current) => current === kind ? null : kind)
    setStatus(`${PART_DEFINITIONS[kind].label}を おく ばしょを おしてね`)
  }, [])

  const rotateSelected = useCallback(() => {
    if (!selectedCellId || running) return
    const next = rotatePart(board, selectedCellId)
    if (next === board) return
    setBoard(next)
    resetAfterEdit()
    setStatus('まわしたよ')
  }, [board, resetAfterEdit, running, selectedCellId])

  const deleteSelected = useCallback(() => {
    if (!selectedCellId || running) return
    const next = removePart(board, selectedCellId)
    if (next === board) return
    setBoard(next)
    resetAfterEdit()
    setSelectedCellId(null)
    setStatus('けしたよ')
  }, [board, resetAfterEdit, running, selectedCellId])

  const toggleRunning = useCallback(() => {
    if (running) {
      setPhase('stopped')
      setStatus('とまったよ。なおして また しゅっぱつ！')
      return
    }
    setProgress(0)
    if (route.totalLength <= 0) {
      setPhase('stopped')
      setStatus(routeStatusLabel(route))
      return
    }
    if (prefersReducedMotion()) {
      setProgress(1)
      setPhase(route.reachedGoal ? 'cleared' : 'stopped')
      setStatus(route.reachedGoal ? 'ゴールについたよ！' : routeStatusLabel(route))
      if (route.reachedGoal) playCorrectSound()
      return
    }
    setPhase('running')
    setSelectedKind(null)
    setSelectedCellId(null)
    setStatus(route.reachedGoal ? 'しゅっぱつ！ ゴールまで いくよ' : routeStatusLabel(route))
  }, [route, running])

  const handleStageChange = useCallback((nextStageId: StageId) => {
    if (running) return
    if (nextStageId === stageId) return
    setStageId(nextStageId)
    setBoard(createDemoBoard(STAGES[nextStageId].size))
    setSelectedCellId(null)
    setSelectedKind(null)
    paletteDrag.current = null
    setDropPreview(null)
    setPhase('ready')
    setProgress(0)
    setStatus(`${STAGES[nextStageId].label}の ばんめんだよ。みちを つなごう`)
  }, [running, stageId])

  return (
    <main className={`${styles.page} ${phase === 'cleared' ? styles.cleared : ''}`} data-phase={phase}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/')} disabled={running}>
            <span aria-hidden="true">‹</span> もどる
          </button>
          <h1><span aria-hidden="true">🚗</span> くるまのみちづくり</h1>
        </header>

        <p className={styles.status} role="status" aria-live="polite">{status}</p>

        <section className={styles.stageSelector} aria-label="ステージのひろさ">
          <p className={styles.stageTitle}>ひろさを えらんでね</p>
          <div className={styles.stageOptions} role="group" aria-label="ステージ選択">
            {(Object.entries(STAGES) as Array<[StageId, typeof STAGES[StageId]]>).map(([id, stage]) => (
              <button
                key={id}
                type="button"
                className={`${styles.stageOption} ${stageId === id ? styles.stageOptionSelected : ''}`}
                aria-pressed={stageId === id}
                aria-label={`${stage.label} ${stage.sizeLabel}`}
                onClick={() => handleStageChange(id)}
                disabled={running}
              >
                <span
                  className={styles.stageMiniBoard}
                  style={{ '--stage-mini-cols': stage.size.cols, '--stage-mini-rows': stage.size.rows } as CSSProperties}
                  aria-hidden="true"
                >
                  {Array.from({ length: stage.size.rows * stage.size.cols }, (_, index) => <span key={index} className={styles.stageMiniCell} />)}
                </span>
                <span className={styles.stageOptionLabel}>{stage.label}</span>
                <span className={styles.stageOptionSize}>{stage.sizeLabel}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.boardScroll} aria-label="みちのエリア">
          <div className={styles.boardSizer}>
            <CarRoadBoard
              board={board}
              boardRef={boardRef}
              selectedCellId={selectedCellId}
              running={running}
              onCellClick={handleCellClick}
              onCellPointerDown={handleCellPointerDown}
              onCellPointerUp={handleCellPointerUp}
              dropPreview={dropPreview}
              carSample={carSample}
              carAtStart={carSample ? null : carAtStart}
              carAngle={route.startDirection ? directionAngle(route.startDirection) : 0}
            />
          </div>
        </section>

        {selectedCell && selectedCell.kind && (
          <div className={styles.selectionTools} aria-label="えらんだパーツのそうさ">
            <span>{PART_DEFINITIONS[selectedCell.kind].label}</span>
            <button type="button" onClick={rotateSelected} disabled={running || selectedCell.kind === 'goal'} aria-label="まわす">↻ まわす</button>
            <button type="button" onClick={deleteSelected} disabled={running} aria-label="けす">けす</button>
          </div>
        )}

        <PartPalette
          selectedKind={selectedKind}
          draggingKind={dropPreview?.kind ?? null}
          disabled={running}
          onSelect={selectKind}
          onPointerDown={handlePalettePointerDown}
          onPointerMove={handlePalettePointerMove}
          onPointerUp={handlePalettePointerUp}
          onPointerCancel={handlePalettePointerCancel}
        />

        {dropPreview && (
          <span
            className={styles.dragGhost}
            style={{ left: dropPreview.clientX, top: Math.max(74, dropPreview.clientY - 12) }}
            aria-hidden="true"
          >
            {PART_DEFINITIONS[dropPreview.kind].emoji}
          </span>
        )}

        <BigButton className={styles.startButton} variant="primary" onClick={toggleRunning} aria-label={running ? 'とめる' : 'しゅっぱつ'}>
          {running ? 'とめる' : 'しゅっぱつ'}
        </BigButton>
    </main>
  )
}

export { CarRoadBuilderPlay }
