import type { CelestialBody, CelestialBodyId } from '../types'
import styles from './BodySelector.module.css'

type BodySelectorProps = {
  bodies: readonly CelestialBody[]
  selectedId: CelestialBodyId
  onSelect: (id: CelestialBodyId) => void
}

export default function BodySelector({ bodies, selectedId, onSelect }: BodySelectorProps) {
  return (
    <nav className={styles.bar} aria-label="てんたいを えらぶ">
      {bodies.map((body) => {
        const selected = body.id === selectedId
        return (
          <button
            key={body.id}
            type="button"
            className={selected ? `${styles.button} ${styles.selected}` : styles.button}
            aria-pressed={selected}
            onClick={() => onSelect(body.id)}
          >
            <span
              className={styles.preview}
              aria-hidden="true"
              style={{ background: body.previewBackground }}
            >
              {/* 輪を持つ天体だけ、プレビュー円の中に輪らしい楕円を重ねる。 */}
              {body.ring !== undefined && <span className={styles.previewRing} />}
            </span>
            <span className={styles.name}>{body.displayName}</span>
          </button>
        )
      })}
    </nav>
  )
}
