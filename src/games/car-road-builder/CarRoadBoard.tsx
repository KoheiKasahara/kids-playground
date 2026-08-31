import type { CSSProperties, DragEvent, PointerEvent } from 'react'
import type { RouteSample } from './routeModel'
import { connectionsForPart, createPlacedPart, PART_DEFINITIONS } from './partDefinitions'
import type { Board, BoardCell } from './boardModel'
import { getPathSpec, pathSpecToSvgPath } from './roadGeometry'
import styles from './CarRoadBuilder.module.css'

export type CarRoadBoardProps = {
  board: Board
  selectedCellId?: string | null
  running?: boolean
  onCellClick?: (cell: BoardCell) => void
  onCellPointerDown?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  onCellPointerUp?: (cell: BoardCell, event: PointerEvent<HTMLButtonElement>) => void
  onCellDrop?: (cell: BoardCell, event: DragEvent<HTMLButtonElement>) => void
  carSample?: RouteSample | null
  carAtStart?: Readonly<{ x: number; y: number }> | null
  carAngle?: number
}

function cellLabel(cell: BoardCell): string {
  const location = `${cell.row + 1}ぎょう ${cell.col + 1}れつ`
  return cell.kind ? `${PART_DEFINITIONS[cell.kind].label}、${location}` : `あきセル、${location}`
}

export default function CarRoadBoard({ board, selectedCellId = null, running = false, onCellClick, onCellPointerDown, onCellPointerUp, onCellDrop, carSample = null, carAtStart = null, carAngle = 0 }: CarRoadBoardProps) {
  return (
    <div className={styles.boardFrame} data-testid="car-road-board" aria-label="みちの ばんめん">
      <div
        className={styles.board}
        style={{ '--board-cols': board.size.cols, '--board-rows': board.size.rows } as CSSProperties}
        role="grid"
        aria-rowcount={board.size.rows}
        aria-colcount={board.size.cols}
      >
        {board.cells.map((cell) => {
          const partStyle = cell.kind ? ({ '--rotation': cell.rotationStep } as CSSProperties) : undefined
          const connections = cell.kind ? connectionsForPart({ kind: cell.kind, rotationStep: cell.rotationStep }) : []
          const part = cell.kind ? createPlacedPart(cell.kind, cell.rotationStep) : null
          const pathSpecs = part
            ? part.kind === 'goal'
              ? connections.map((direction) => getPathSpec(part, direction))
              : part.kind === 'crossroad' || part.kind === 'xroad'
                ? connections.slice(0, 2).map((direction) => getPathSpec(part, direction))
              : [getPathSpec(part)]
            : []
          return (
            <button
              key={cell.id}
              type="button"
              role="gridcell"
              data-cell-id={cell.id}
              aria-label={cellLabel(cell)}
              aria-selected={selectedCellId === cell.id}
              disabled={running}
              className={`${styles.cell} ${cell.kind ? styles[cell.kind] : styles.empty} ${selectedCellId === cell.id ? styles.selected : ''}`}
              style={partStyle}
              onClick={() => onCellClick?.(cell)}
              onPointerDown={(event) => onCellPointerDown?.(cell, event)}
              onPointerUp={(event) => onCellPointerUp?.(cell, event)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); onCellDrop?.(cell, event) }}
            >
              <span className={`${styles.roadShape} ${pathSpecs.length > 0 ? styles.pathShape : ''}`} aria-hidden="true">
                {pathSpecs.length > 0 && (
                  <svg className={styles.roadSvg} viewBox="-0.5 -0.5 1 1" aria-hidden="true">
                    {pathSpecs.map((spec, index) => <path key={index} d={pathSpecToSvgPath(spec)} />)}
                    {cell.kind === 'goal' && <circle className={styles.roadHub} cx="0" cy="0" r=".16" />}
                  </svg>
                )}
                {cell.kind === 'start' && <span className={styles.markerEmoji}>🚩</span>}
                {cell.kind === 'goal' && <span className={styles.markerEmoji}>🏁</span>}
              </span>
            </button>
          )
        })}
        {(carSample || carAtStart) && (
          <span
            className={styles.car}
            aria-label="くるま"
            style={{
              left: `${((carSample?.point.x ?? carAtStart?.x ?? 0) / board.size.cols) * 100}%`,
              top: `${((carSample?.point.y ?? carAtStart?.y ?? 0) / board.size.rows) * 100}%`,
              '--car-angle': `${carSample ? Math.atan2(carSample.tangent.y, carSample.tangent.x) : carAngle}rad`,
            } as CSSProperties}
          >🚗</span>
        )}
      </div>
    </div>
  )
}
