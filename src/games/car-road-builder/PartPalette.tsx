import type { DragEvent } from 'react'
import { PART_DEFINITIONS, PART_KINDS, type PartKind } from './partDefinitions'
import styles from './CarRoadBuilder.module.css'

export type PartPaletteProps = {
  disabled?: boolean
  selectedKind?: PartKind | null
  onSelect?: (kind: PartKind) => void
  onDragStart?: (kind: PartKind) => void
}

export default function PartPalette({ disabled = false, selectedKind = null, onSelect, onDragStart }: PartPaletteProps) {
  const handleDragStart = (kind: PartKind, event: DragEvent<HTMLButtonElement>) => {
    event.dataTransfer?.setData('application/x-car-road-part', kind)
    event.dataTransfer?.setData('text/plain', kind)
    onDragStart?.(kind)
  }

  return (
    <div className={styles.palette} aria-label="パーツを えらぶ">
      <p className={styles.paletteTitle}>パーツを えらんでね</p>
      <div className={styles.paletteScroll}>
        {PART_KINDS.map((kind) => {
          const definition = PART_DEFINITIONS[kind]
          return (
            <button
              key={kind}
              type="button"
              draggable={!disabled}
              disabled={disabled}
              className={`${styles.paletteItem} ${selectedKind === kind ? styles.paletteSelected : ''}`}
              aria-pressed={selectedKind === kind}
              aria-label={`${definition.label}を おく`}
              onClick={() => onSelect?.(kind)}
              onDragStart={(event) => handleDragStart(kind, event)}
              onPointerDown={() => onDragStart?.(kind)}
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
