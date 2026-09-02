import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ColoringCanvas from './ColoringCanvas'
import { DEFAULT_PAINT_COLOR_ID, PAINT_COLORS, type PaintColorId } from './paintColors'
import { DEFAULT_PICTURE_ID, PAINT_PICTURES, findPaintPicture } from './paintPictures'
import { createEmptyPaintings, getPaintedAreas, paintArea, resetPicture, type PaintingsState } from './paintState'
import styles from './ColorPaintPuzzlePlay.module.css'

export default function ColorPaintPuzzlePlay() {
  const navigate = useNavigate()
  const [selectedColorId, setSelectedColorId] = useState<PaintColorId>(DEFAULT_PAINT_COLOR_ID)
  const [selectedPictureId, setSelectedPictureId] = useState<string>(DEFAULT_PICTURE_ID)
  const [paintings, setPaintings] = useState<PaintingsState>(createEmptyPaintings)

  const picture = findPaintPicture(selectedPictureId) ?? PAINT_PICTURES[0]
  const painted = getPaintedAreas(paintings, picture.id)

  const handlePaintArea = (areaId: string) => {
    setPaintings((current) => paintArea(current, picture.id, areaId, selectedColorId))
  }

  const handleReset = () => {
    setPaintings((current) => resetPicture(current, picture.id))
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          ← もどる
        </button>
        <h1 className={styles.title}>
          <span aria-hidden="true">🖍️</span> いろぬりパズル
        </h1>
      </header>

      <div className={styles.pictureGroup} role="group" aria-label="えを えらぶ">
        {PAINT_PICTURES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`${styles.pictureButton} ${option.id === picture.id ? styles.pictureButtonSelected : ''}`}
            aria-pressed={option.id === picture.id}
            onClick={() => setSelectedPictureId(option.id)}
          >
            <span aria-hidden="true">{option.emoji}</span>
            <span>{option.label}</span>
          </button>
        ))}
      </div>

      {/* ぬりえの名前はSVG側（role="img" + aria-label）が持つため、ここでは重ねて付けない。 */}
      <section className={styles.canvasArea}>
        <div className={styles.canvasCard}>
          <ColoringCanvas
            picture={picture}
            painted={painted}
            onPaintArea={handlePaintArea}
            className={styles.canvas}
          />
        </div>
      </section>

      <div className={styles.paletteGroup} role="group" aria-label="いろを えらぶ">
        {PAINT_COLORS.map((color) => {
          const selected = color.id === selectedColorId
          return (
            <button
              key={color.id}
              type="button"
              className={`${styles.swatch} ${selected ? styles.swatchSelected : ''}`}
              style={{ backgroundColor: color.hex }}
              aria-label={color.label}
              aria-pressed={selected}
              onClick={() => setSelectedColorId(color.id)}
            >
              {selected ? (
                <span className={styles.swatchCheck} aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <button type="button" className={styles.resetButton} onClick={handleReset}>
        <span aria-hidden="true">🔄</span> やりなおし
      </button>
    </main>
  )
}
