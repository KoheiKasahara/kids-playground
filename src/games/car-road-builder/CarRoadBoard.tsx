import type { CSSProperties, PointerEvent, Ref } from 'react'
import type { RouteSample } from './routeModel'
import { connectionsForPart, createPlacedPart, PART_DEFINITIONS, type PartKind } from './partDefinitions'
import type { Board, BoardCell } from './boardModel'
import { getPathSpec, pathSpecToSvgPath } from './roadGeometry'
import styles from './CarRoadBuilder.module.css'

export type CarRoadBoardProps = {
  board: Board
  boardRef?: Ref<HTMLDivElement>
  selectedCellId?: string | null
  draggingCellId?: string | null
  running?: boolean
  onCellClick?: (cell: BoardCell) => void
  onCellPointerDown?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  onCellPointerMove?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  onCellPointerUp?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  onCellPointerCancel?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  dropPreview?: Readonly<{ kind: PartKind; rotationStep: number; cellId: string | null; valid: boolean }> | null
  carSample?: RouteSample | null
  carAtStart?: Readonly<{ x: number; y: number }> | null
  carAngle?: number
}

function RoadPartVisual({ part }: { part: Readonly<{ kind: PartKind; rotationStep: number }> }) {
  const connections = connectionsForPart(part)
  const pathSpecs = part.kind === 'goal'
    ? connections.map((direction) => getPathSpec(part, direction))
    : part.kind === 'crossroad' || part.kind === 'xroad'
      ? connections.slice(0, 2).map((direction) => getPathSpec(part, direction))
      : [getPathSpec(part)]

  return (
    <span className={`${styles.roadShape} ${pathSpecs.length > 0 ? styles.pathShape : ''}`} aria-hidden="true">
      {pathSpecs.length > 0 && (
        <svg className={styles.roadSvg} viewBox="-0.5 -0.5 1 1" aria-hidden="true">
          {pathSpecs.map((spec, index) => <path key={index} d={pathSpecToSvgPath(spec)} />)}
          {part.kind === 'goal' && <circle className={styles.roadHub} cx="0" cy="0" r=".16" />}
        </svg>
      )}
      {part.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
      {part.kind === 'goal' && <span className={styles.markerEmoji}>🏁</span>}
    </span>
  )
}

/**
 * Top-down car artwork with an explicit canonical heading.
 *
 * The nose points right (E) when the SVG is unrotated. The route sample uses
 * the same screen-coordinate convention, so rotating this one visual by the
 * sample tangent keeps the front aligned for every cardinal and diagonal
 * direction without per-direction corrections.
 */
function CarVisual() {
  return (
    <svg
      className={styles.carSvg}
      data-testid="car-visual"
      data-front-direction="E"
      viewBox="-20 -13 40 26"
      aria-hidden="true"
    >
      <path className={styles.carShadow} d="M-14-9 Q-18 0-14 9 Q-11 12-5 12 H9 Q15 12 18 5 L20 0 18-5 Q15-12 9-12 H-5 Q-11-12-14-9Z" />
      <path className={styles.carBody} d="M-15-8 Q-12-10-8-10 H8 Q14-10 16-5 L19 0 16 5 Q14 10 8 10 H-8 Q-12 10-15 8 Q-18 0-15-8Z" />
      <path className={styles.carRearWindow} d="M-9-6 H-2 V6 H-9 Q-11 0-9-6Z" />
      <path className={styles.carFrontWindshield} d="M1-6 H7 Q10-6 12-3 L14 0 12 3 Q10 6 7 6 H1Z" />
      <path className={styles.carCenterLine} d="M-1-6 V6" />
      <rect className={styles.carWheel} x="-7" y="-11.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="7" y="-11.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="-7" y="8.5" width="5" height="3" rx="1.5" />
      <rect className={styles.carWheel} x="7" y="8.5" width="5" height="3" rx="1.5" />
      <circle className={styles.carHeadlight} cx="16" cy="-3.3" r="1.25" />
      <circle className={styles.carHeadlight} cx="16" cy="3.3" r="1.25" />
      <rect className={styles.carTailLight} x="-15.5" y="-4" width="1.7" height="2.6" rx=".7" />
      <rect className={styles.carTailLight} x="-15.5" y="1.4" width="1.7" height="2.6" rx=".7" />
    </svg>
  )
}

function cellLabel(cell: BoardCell): string {
  const location = `${cell.row + 1}ぎょう ${cell.col + 1}れつ`
  return cell.kind ? `${PART_DEFINITIONS[cell.kind].label}、${location}` : `あきセル、${location}`
}

export default function CarRoadBoard({ board, boardRef, selectedCellId = null, draggingCellId = null, running = false, onCellClick, onCellPointerDown, onCellPointerMove, onCellPointerUp, onCellPointerCancel, dropPreview = null, carSample = null, carAtStart = null, carAngle = 0 }: CarRoadBoardProps) {
  return (
    <div className={styles.boardFrame} data-testid="car-road-board" aria-label="みちの ばんめん">
      <div
        ref={boardRef}
        className={styles.board}
        style={{ '--board-cols': board.size.cols, '--board-rows': board.size.rows } as CSSProperties}
        role="grid"
        aria-rowcount={board.size.rows}
        aria-colcount={board.size.cols}
      >
        {board.cells.map((cell) => {
          const partStyle = cell.kind ? ({ '--rotation': cell.rotationStep } as CSSProperties) : undefined
          const part = cell.kind ? createPlacedPart(cell.kind, cell.rotationStep) : null
          return (
            <button
              key={cell.id}
              type="button"
              role="gridcell"
              data-cell-id={cell.id}
              aria-label={cellLabel(cell)}
              aria-selected={selectedCellId === cell.id}
              disabled={running}
              className={`${styles.cell} ${cell.kind ? styles[cell.kind] : styles.empty} ${selectedCellId === cell.id ? styles.selected : ''} ${draggingCellId === cell.id ? styles.dragging : ''}`}
              style={partStyle}
              aria-grabbed={draggingCellId === cell.id}
              onClick={() => onCellClick?.(cell)}
              onPointerDown={(event) => onCellPointerDown?.(cell, event)}
              onPointerMove={(event) => onCellPointerMove?.(cell, event)}
              onPointerUp={(event) => onCellPointerUp?.(cell, event)}
              onPointerCancel={(event) => onCellPointerCancel?.(cell, event)}
            >
              {part && <RoadPartVisual part={part} />}
            </button>
          )
        })}
        {dropPreview?.cellId && (() => {
          const target = board.cells.find((cell) => cell.id === dropPreview.cellId)
          if (!target) return null
          return (
            <span
              data-testid="car-road-drop-preview"
              data-valid={dropPreview.valid}
              className={`${styles.dropPreview} ${styles[dropPreview.kind]} ${dropPreview.valid ? styles.dropAllowed : styles.dropForbidden}`}
              style={{ gridColumn: target.col + 1, gridRow: target.row + 1, '--rotation': dropPreview.rotationStep } as CSSProperties}
              aria-hidden="true"
            >
              <RoadPartVisual part={createPlacedPart(dropPreview.kind, dropPreview.rotationStep)} />
            </span>
          )
        })()}
        {(carSample || carAtStart) && (
          <span
            className={styles.car}
            aria-label="くるま"
            style={{
              left: `${((carSample?.point.x ?? carAtStart?.x ?? 0) / board.size.cols) * 100}%`,
              top: `${((carSample?.point.y ?? carAtStart?.y ?? 0) / board.size.rows) * 100}%`,
              '--car-angle': `${carSample ? Math.atan2(carSample.tangent.y, carSample.tangent.x) : carAngle}rad`,
            } as CSSProperties}
          >
            <CarVisual />
          </span>
        )}
      </div>
    </div>
  )
}
