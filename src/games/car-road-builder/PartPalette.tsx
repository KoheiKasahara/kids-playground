import type { PointerEvent } from 'react'
import { PART_DEFINITIONS, ROAD_PART_KINDS, type PartKind } from './partDefinitions'
import styles from './CarRoadBuilder.module.css'

export type PartPaletteProps = {
  disabled?: boolean
  selectedKind?: PartKind | null
  draggingKind?: PartKind | null
  onSelect?: (kind: PartKind) => void
  onPointerDown?: (kind: PartKind, event: PointerEvent<HTMLButtonElement>) => void
  onPointerMove?: (kind: PartKind, event: PointerEvent<HTMLButtonElement>) => void
  onPointerUp?: (kind: PartKind, event: PointerEvent<HTMLButtonElement>) => void
  onPointerCancel?: (kind: PartKind, event: PointerEvent<HTMLButtonElement>) => void
}

export default function PartPalette({ disabled = false, selectedKind = null, draggingKind = null, onSelect, onPointerDown, onPointerMove, onPointerUp, onPointerCancel }: PartPaletteProps) {
  const handlePointerDown = (kind: PartKind, event: PointerEvent<HTMLButtonElement>) => {
    if (event.isPrimary === false || (event.pointerType === 'mouse' && event.button !== 0)) return
    // Pointer capture keeps receiving the drag after the finger leaves the
    // palette item, which is important for touch devices.
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onPointerDown?.(kind, event)
  }

  return (
    <div className={styles.palette} aria-label="パーツを えらぶ">
      <p className={styles.paletteTitle}>パーツを えらんでね</p>
      <div className={styles.paletteScroll}>
        {ROAD_PART_KINDS.map((kind) => {
          const definition = PART_DEFINITIONS[kind]
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              className={`${styles.paletteItem} ${selectedKind === kind ? styles.paletteSelected : ''} ${draggingKind === kind ? styles.paletteDragging : ''}`}
              aria-pressed={selectedKind === kind || draggingKind === kind}
              aria-label={`${definition.label}を おく`}
              onClick={() => onSelect?.(kind)}
              onPointerDown={(event) => handlePointerDown(kind, event)}
              onPointerMove={(event) => onPointerMove?.(kind, event)}
              onPointerUp={(event) => onPointerUp?.(kind, event)}
              onPointerCancel={(event) => onPointerCancel?.(kind, event)}
            >
              <span className={styles.paletteEmoji} aria-hidden="true">{definition.emoji}</span>
              <span>{definition.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
