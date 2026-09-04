import { useEffect, useRef } from 'react'
import type { CelestialBody, CelestialBodyId } from '../types'
import styles from './BodySelector.module.css'

type BodySelectorProps = {
  bodies: readonly CelestialBody[]
  selectedId: CelestialBodyId
  onSelect: (id: CelestialBodyId) => void
}

export default function BodySelector({ bodies, selectedId, onSelect }: BodySelectorProps) {
  const buttonRefs = useRef(new Map<CelestialBodyId, HTMLButtonElement>())

  useEffect(() => {
    const selectedButton = buttonRefs.current.get(selectedId)
    if (!selectedButton || typeof selectedButton.scrollIntoView !== 'function') return

    // 初期表示時も含め、選択中の天体が横スクロールの外へ隠れないようにする。
    // inline:center は、画面端へ寄せるより前後の選択肢も見渡しやすい。
    selectedButton.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    })
  }, [selectedId])

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
            ref={(element) => {
              if (element) {
                buttonRefs.current.set(body.id, element)
              } else {
                buttonRefs.current.delete(body.id)
              }
            }}
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
