import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import CarRoadBoard from './CarRoadBoard'
import PartPalette from './PartPalette'
import VehiclePicker from './VehiclePicker'
import {
  canPlacePart,
  canMovePart,
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
import { createCarRoadSoundController, playCarDepartureSound, playCorrectSound } from '../../utils/quizSound'
import type { CarRoadSoundController } from '../../utils/quizSound'
import type { VehicleId } from './vehicleDefinitions'
import styles from './CarRoadBuilder.module.css'
import { createStageBoard, type StageId } from './stageDefinitions'

type PlayPhase = 'ready' | 'running' | 'stopped' | 'cleared'

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function playExistingGoalSoundSafely(): void {
  try {
    // 既存のゴール音はスコープ外のまま、音声APIの失敗だけをゲームから隔離する。
    playCorrectSound()
  } catch {
    // 音が出せない環境でも、ゴール判定と編集操作は継続できる。
  }
}

const DRAG_START_DISTANCE = 8

type PaletteDragState = {
  kind: PartKind
  pointerId: number
  startX: number
  startY: number
  active: boolean
}

type BoardDragState = {
  cellId: string
  pointerId: number
  startX: number
  startY: number
  active: boolean
}

type DropPreview = Readonly<{
  kind: PartKind
  rotationStep: number
  clientX: number
  clientY: number
  cellId: string | null
  valid: boolean
}>

type CarRoadBuilderPlayProps = Readonly<{
  /** Optional prop keeps the component easy to exercise in isolated UI tests. */
  stageId?: StageId
}>

type NavigationState = Readonly<{ stageId?: unknown }>

function stageIdFromNavigationState(state: unknown): StageId | null {
  const candidate = (state as NavigationState | null)?.stageId
  return candidate === 'normal' || candidate === 'wide' ? candidate : null
}

export default function CarRoadBuilderPlay({ stageId }: CarRoadBuilderPlayProps = {}) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeStageId = stageId ?? stageIdFromNavigationState(location.state) ?? 'normal'
  const [board, setBoard] = useState<Board>(() => createStageBoard(activeStageId))
  const [vehicleId, setVehicleId] = useState<VehicleId>('red-car')
  const [selectedCellId, setSelectedCellId] = useState<string | null>(null)
  const [selectedKind, setSelectedKind] = useState<PartKind | null>(null)
  const [draggingCellId, setDraggingCellId] = useState<string | null>(null)
  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const [phase, setPhase] = useState<PlayPhase>('ready')
  const [progress, setProgress] = useState(0)
  const [departureFeedback, setDepartureFeedback] = useState(false)
  const [status, setStatus] = useState('パーツを えらんで、みちを つなごう')
  const animationRef = useRef<number | null>(null)
  const departureFeedbackTimerRef = useRef<number | null>(null)
  const [soundController] = useState<CarRoadSoundController>(() => createCarRoadSoundController())
  const boardDrag = useRef<BoardDragState | null>(null)
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

  const triggerDepartureFeedback = useCallback(() => {
    setDepartureFeedback(true)
    if (departureFeedbackTimerRef.current !== null) {
      window.clearTimeout(departureFeedbackTimerRef.current)
    }
    departureFeedbackTimerRef.current = window.setTimeout(() => {
      departureFeedbackTimerRef.current = null
      setDepartureFeedback(false)
    }, 260)
  }, [])

  useEffect(() => {
    soundController.setRunning(running)
    return () => soundController.setRunning(false)
  }, [running, soundController])

  useEffect(() => () => {
    if (departureFeedbackTimerRef.current !== null) {
      window.clearTimeout(departureFeedbackTimerRef.current)
      departureFeedbackTimerRef.current = null
    }
    soundController.dispose()
  }, [soundController])

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
        if (route.reachedGoal) playExistingGoalSoundSafely()
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

  const previewAt = useCallback((part: Readonly<{ kind: PartKind; rotationStep: number }>, clientX: number, clientY: number, sourceCellId?: string): DropPreview => {
    const boardElement = boardRef.current
    const rect = boardElement?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX >= rect.right || clientY < rect.top || clientY >= rect.bottom) {
      return { kind: part.kind, rotationStep: part.rotationStep, clientX, clientY, cellId: null, valid: false }
    }

    const col = Math.floor(((clientX - rect.left) / rect.width) * board.size.cols)
    const row = Math.floor(((clientY - rect.top) / rect.height) * board.size.rows)
    const cell = board.cells.find((candidate) => candidate.row === row && candidate.col === col)
    return {
      kind: part.kind,
      rotationStep: part.rotationStep,
      clientX,
      clientY,
      cellId: cell?.id ?? null,
      valid: cell
        ? sourceCellId
          ? canMovePart(board, sourceCellId, cell.id)
          : canPlacePart(board, cell.id, createPlacedPart(part.kind, part.rotationStep))
        : false,
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
    setDropPreview(previewAt(createPlacedPart(kind), event.clientX, event.clientY))
  }, [previewAt])

  const finishPalettePointer = useCallback((kind: PartKind, event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = paletteDrag.current
    if (!drag || drag.kind !== kind || drag.pointerId !== event.pointerId) return

    if (drag.active) {
      event.preventDefault()
      const preview = cancelled ? null : previewAt(createPlacedPart(kind), event.clientX, event.clientY)
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

  const handleCellPointerDown = useCallback((cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (running || selectedKind !== null || cell.kind === null) return
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return
    boardDrag.current = {
      cellId: cell.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
    }
    // Capture on the source cell so the board still receives the end of the
    // gesture when the finger leaves that cell or the board entirely.
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }, [running, selectedKind])

  const handleCellPointerMove = useCallback((_cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = boardDrag.current
    if (!drag || drag.pointerId !== event.pointerId || running) return
    const source = board.cells.find((candidate) => candidate.id === drag.cellId)
    if (!source?.kind) return

    if (!drag.active) {
      const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
      if (distance < DRAG_START_DISTANCE) return
      drag.active = true
      setDraggingCellId(source.id)
      setSelectedCellId(source.id)
      setSelectedKind(null)
      setStatus(`${PART_DEFINITIONS[source.kind].label}を つかんだよ。おく ばしょへ もっていこう`)
    }

    const part = createPlacedPart(source.kind, source.rotationStep)
    event.preventDefault()
    setDropPreview(previewAt(part, event.clientX, event.clientY, source.id))
  }, [board, previewAt, running])

  const finishBoardPointer = useCallback((_cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>, cancelled = false) => {
    const drag = boardDrag.current
    if (!drag || drag.pointerId !== event.pointerId) return

    boardDrag.current = null
    if (!drag.active) return

    setDraggingCellId(null)
    event.preventDefault()
    const source = board.cells.find((candidate) => candidate.id === drag.cellId)
    const preview = cancelled || !source?.kind ? null : previewAt(
      createPlacedPart(source.kind, source.rotationStep),
      event.clientX,
      event.clientY,
      source.id,
    )
    const target = preview?.cellId ? board.cells.find((candidate) => candidate.id === preview.cellId) : undefined
    if (source && preview && target && preview.valid && target.id !== source.id) {
      const next = movePart(board, source.id, target.id)
      if (next !== board) {
        setBoard(next)
        resetAfterEdit()
        setSelectedCellId(target.id)
        setStatus('うごかしたよ')
      }
    } else if (!preview || !target || !preview.valid) {
      setSelectedCellId(source?.id ?? null)
      setStatus('そこには おけないよ')
    } else {
      // Returning to the origin is a successful no-op; do not rewrite board
      // state or alter the part's orientation.
      setSelectedCellId(source?.id ?? null)
      setStatus('そのままだよ')
    }
    setDropPreview(null)
    // Pointerup may be followed by a synthetic click on the source button.
    suppressClick.current = true
    window.setTimeout(() => { suppressClick.current = false }, 0)
  }, [board, previewAt, resetAfterEdit])

  const handleCellPointerUp = useCallback((cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (running) return
    finishBoardPointer(cell, event)
  }, [finishBoardPointer, running])

  const handleCellPointerCancel = useCallback((cell: BoardCell, event: ReactPointerEvent<HTMLButtonElement>) => {
    finishBoardPointer(cell, event, true)
  }, [finishBoardPointer])

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
    const selectedPart = board.cells.find((cell) => cell.id === selectedCellId)
    if (selectedPart?.kind === 'start' || selectedPart?.kind === 'goal') {
      setStatus('スタートと ゴールは けせないよ')
      return
    }
    const next = removePart(board, selectedCellId)
    if (next === board) return
    setBoard(next)
    resetAfterEdit()
    setSelectedCellId(null)
    setStatus('けしたよ')
  }, [board, resetAfterEdit, running, selectedCellId])

  const toggleRunning = useCallback(() => {
    if (running) {
      setDepartureFeedback(false)
      setPhase('stopped')
      setStatus('とまったよ。なおして また しゅっぱつ！')
      return
    }
    triggerDepartureFeedback()
    setProgress(0)
    if (route.totalLength <= 0) {
      setPhase('stopped')
      setStatus(routeStatusLabel(route))
      return
    }
    // Keep this in the click handler so iOS Safari can use the user's gesture
    // to create/resume AudioContext before the running effect starts.
    playCarDepartureSound()
    if (prefersReducedMotion()) {
      setProgress(1)
      setPhase(route.reachedGoal ? 'cleared' : 'stopped')
      setStatus(route.reachedGoal ? 'ゴールについたよ！' : routeStatusLabel(route))
      if (route.reachedGoal) playExistingGoalSoundSafely()
      return
    }
    setPhase('running')
    setSelectedKind(null)
    setSelectedCellId(null)
    setStatus(route.reachedGoal ? 'しゅっぱつ！ ゴールまで いくよ' : routeStatusLabel(route))
  }, [route, running, triggerDepartureFeedback])

  const handleVehicleSelect = useCallback((nextVehicleId: VehicleId) => {
    if (running || nextVehicleId === vehicleId) return
    setVehicleId(nextVehicleId)
    setStatus('くるまを えらんだよ。しゅっぱつ してみよう')
  }, [running, vehicleId])

  return (
    <main className={`${styles.page} ${phase === 'cleared' ? styles.cleared : ''}`} data-phase={phase} data-stage-id={activeStageId}>
        <header className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate('/games/car-road-builder')} disabled={running}>
            <span aria-hidden="true">‹</span> もどる
          </button>
          <h1><span aria-hidden="true">🚗</span> くるまのみちづくり</h1>
        </header>

        <p className={styles.status} role="status" aria-live="polite">{status}</p>

        <VehiclePicker
          selectedVehicleId={vehicleId}
          disabled={running}
          onSelect={handleVehicleSelect}
        />

        <section className={styles.boardScroll} aria-label="みちのエリア">
          <div className={styles.boardSizer}>
            <CarRoadBoard
              board={board}
              boardRef={boardRef}
              selectedCellId={selectedCellId}
              draggingCellId={draggingCellId}
              running={running}
              onCellClick={handleCellClick}
              onCellPointerDown={handleCellPointerDown}
              onCellPointerMove={handleCellPointerMove}
              onCellPointerUp={handleCellPointerUp}
              onCellPointerCancel={handleCellPointerCancel}
              dropPreview={dropPreview}
              carSample={carSample}
              carAtStart={carSample ? null : carAtStart}
              carAngle={route.startDirection ? directionAngle(route.startDirection) : 0}
              vehicleId={vehicleId}
            />
          </div>
        </section>

        {selectedCell && selectedCell.kind && (
          <div className={styles.selectionTools} aria-label="えらんだパーツのそうさ">
            <span>{PART_DEFINITIONS[selectedCell.kind].label}</span>
            <button type="button" onClick={rotateSelected} disabled={running} aria-label="まわす">↻ まわす</button>
            <button type="button" onClick={deleteSelected} disabled={running || selectedCell.kind === 'start' || selectedCell.kind === 'goal'} aria-label="けす">けす</button>
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

        <BigButton className={`${styles.startButton} ${departureFeedback ? styles.departureFeedback : ''}`} variant="primary" onClick={toggleRunning} aria-label={running ? 'とめる' : 'しゅっぱつ'}>
          {running ? 'とめる' : 'しゅっぱつ'}
        </BigButton>
    </main>
  )
}

export { CarRoadBuilderPlay }
