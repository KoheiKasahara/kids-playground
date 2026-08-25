import type { PointerEvent, RefObject } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import type { FlagBallData } from '../../components/flag-ball/flagBalls'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  CELL_SIZE,
  GRID_BOTTOM,
  GRID_LEFT,
  GRID_TOP,
  GRID_WIDTH,
  type GoalArea,
} from './boardLayout'
import type { PuzzleBallState } from './puzzleState'
import { cellCenter, type GridCell } from './grid'
import PartShape from './PartShape'
import { isSpinnerPart, type PartTypeId } from './partTypes'
import { occupiedCells, type PlacedPart } from './placement'
import styles from './PuzzleBoard.module.css'

type PuzzleBallView = PuzzleBallState & { readonly flag: FlagBallData }

type PuzzleBoardProps = {
  parts: readonly PlacedPart[]
  selectedPartId: string | null
  draggingPartId: string | null
  balls: readonly PuzzleBallView[]
  goalArea: GoalArea
  ghost: { readonly typeId: PartTypeId; readonly cell: GridCell } | null
  highlightGrid: boolean
  cleared: boolean
  justPlacedPartId: string | null
  rotatingPartId: string | null
  invalidDrop: boolean
  containerRef: RefObject<HTMLDivElement | null>
  boardRef: RefObject<HTMLDivElement | null>
  scale: number
  width: number
  height: number
  registerBall: (ballId: string, el: HTMLElement | null) => void
  registerPartElement: (partId: string, el: HTMLElement | null) => void
  onPointerDown?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerMove?: (event: PointerEvent<HTMLDivElement>) => void
  onPointerUp?: (event: PointerEvent<HTMLDivElement>) => void
}

function selectionRingStyle(part: PlacedPart) {
  const cells = occupiedCells(part.typeId, part.cell)
  const cols = cells.map((cell) => cell.col)
  const rows = cells.map((cell) => cell.row)
  return {
    left: GRID_LEFT + Math.min(...cols) * CELL_SIZE,
    top: GRID_TOP + Math.min(...rows) * CELL_SIZE,
    width: (Math.max(...cols) - Math.min(...cols) + 1) * CELL_SIZE,
    height: (Math.max(...rows) - Math.min(...rows) + 1) * CELL_SIZE,
  }
}

export default function PuzzleBoard({
  parts,
  selectedPartId,
  draggingPartId,
  balls,
  goalArea,
  ghost,
  highlightGrid,
  cleared,
  justPlacedPartId,
  rotatingPartId,
  invalidDrop,
  containerRef,
  boardRef,
  scale,
  width,
  height,
  registerBall,
  registerPartElement,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: PuzzleBoardProps) {
  const selectedPart = parts.find((part) => part.id === selectedPartId) ?? null
  return (
    <div ref={containerRef} className={styles.fit}>
      <div className={styles.stage} style={{ width, height }}>
        <div
          ref={boardRef}
          className={styles.logical}
          style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT, transform: `scale(${scale})` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          data-testid="puzzle-board"
        >
          <div className={styles.startZone} aria-hidden="true" />
          {balls.map((ball) => (
            <div
              key={`start-${ball.id}`}
              className={styles.startMarker}
              aria-hidden="true"
              data-start-ball-id={ball.id}
              style={{ left: ball.startPosition.x, top: ball.startPosition.y }}
            >
              <span>{ball.id === 'ball-a' ? 'A' : 'B'}</span>
            </div>
          ))}

          <div
            className={styles.grid}
            data-highlight={highlightGrid ? 'true' : 'false'}
            aria-hidden="true"
            style={{ left: GRID_LEFT, top: GRID_TOP, width: GRID_WIDTH, height: GRID_BOTTOM - GRID_TOP, backgroundSize: `${CELL_SIZE}px ${CELL_SIZE}px` }}
          />

          {parts.map((part) => {
            const center = cellCenter(part.cell)
            const selected = part.id === selectedPartId
            return (
              <div
                key={part.id}
                className={styles.partSlot}
                style={{ left: center.x, top: center.y }}
                aria-hidden="true"
                data-testid="puzzle-part"
                data-part-type={part.typeId}
                data-cell={`${part.cell.col},${part.cell.row}`}
                data-selected={selected ? 'true' : 'false'}
                data-dragging={part.id === draggingPartId ? 'true' : 'false'}
                data-placed={part.id === justPlacedPartId ? 'true' : 'false'}
                data-rotating={part.id === rotatingPartId ? 'true' : 'false'}
              >
                {isSpinnerPart(part.typeId) ? (
                  <span
                    ref={(element) => registerPartElement(part.id, element)}
                    className={styles.spinnerVisual}
                    aria-hidden="true"
                  >
                    <PartShape typeId={part.typeId} variant={selected ? 'selected' : 'placed'} />
                  </span>
                ) : (
                  <PartShape typeId={part.typeId} variant={selected ? 'selected' : 'placed'} />
                )}
              </div>
            )
          })}

          {selectedPart && selectedPart.id !== draggingPartId ? (
            <div className={styles.selectionRing} aria-hidden="true" data-testid="puzzle-selection" style={selectionRingStyle(selectedPart)} />
          ) : null}

          {ghost ? (
            <div className={styles.partSlot} style={{ left: cellCenter(ghost.cell).x, top: cellCenter(ghost.cell).y }} aria-hidden="true" data-testid="puzzle-ghost">
              <PartShape typeId={ghost.typeId} variant="ghost" />
            </div>
          ) : null}

          <div className={styles.goalBand} aria-hidden="true" style={{ top: GRID_BOTTOM }} />
          <div
            className={styles.goal}
            data-cleared={cleared ? 'true' : 'false'}
            aria-hidden="true"
            style={{ left: goalArea.x, top: goalArea.y, width: goalArea.width, height: goalArea.height }}
          >
            ゴール
          </div>
          {invalidDrop ? <div className={styles.gentleHint} aria-hidden="true" /> : null}

          {balls.map((ball) => (
            <div
              key={ball.id}
              ref={(element) => registerBall(ball.id, element)}
              className={styles.ballSlot}
              aria-hidden="true"
              data-testid="puzzle-ball"
              data-ball-id={ball.id}
              data-status={ball.status}
              data-flag-id={ball.flag.id}
              style={{
                transform: `translate(${ball.position.x - BALL_RADIUS}px, ${ball.position.y - BALL_RADIUS}px)`,
              }}
            >
              <FlagBall flag={ball.flag} size={BALL_RADIUS * 2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
