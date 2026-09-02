import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ColoringCanvas from './ColoringCanvas'
import { DEFAULT_PAINT_COLOR_ID, PAINT_COLORS, type PaintColorId } from './paintColors'
import { INITIAL_PAINT_PHASE, canPaint, reducePaintPhase, type PaintPhase } from './paintPhase'
import { DEFAULT_PICTURE_ID, PAINT_PICTURES, findPaintPicture } from './paintPictures'
import { createEmptyPaintings, getPaintedAreas, paintArea, resetPicture, type PaintingsState } from './paintState'
import { playColorPaintFinishSound, primeAudio } from '../../utils/quizSound'
import styles from './ColorPaintPuzzlePlay.module.css'

/**
 * 完成した瞬間に絵のまわりで弾けるキラキラ。位置(%)と遅れ(ms)だけの静的な飾りで、
 * 1回だけ再生して消える（ずっと出しっぱなしにすると絵より目立ってしまうため）。
 */
const SPARKLES: readonly { left: number; top: number; delayMs: number; scale: number }[] = [
  { left: 12, top: 18, delayMs: 0, scale: 1 },
  { left: 84, top: 12, delayMs: 90, scale: 0.8 },
  { left: 50, top: 6, delayMs: 45, scale: 1.15 },
  { left: 8, top: 66, delayMs: 160, scale: 0.85 },
  { left: 90, top: 58, delayMs: 120, scale: 1 },
  { left: 30, top: 88, delayMs: 210, scale: 0.75 },
  { left: 70, top: 90, delayMs: 180, scale: 0.9 },
]

export default function ColorPaintPuzzlePlay() {
  const navigate = useNavigate()
  const [selectedColorId, setSelectedColorId] = useState<PaintColorId>(DEFAULT_PAINT_COLOR_ID)
  const [selectedPictureId, setSelectedPictureId] = useState<string>(DEFAULT_PICTURE_ID)
  const [paintings, setPaintings] = useState<PaintingsState>(createEmptyPaintings)
  const [phase, setPhase] = useState<PaintPhase>(INITIAL_PAINT_PHASE)

  const picture = findPaintPicture(selectedPictureId) ?? PAINT_PICTURES[0]
  // 完成演出中も、この同じ塗り状態をそのまま渡す。演出用の別データは持たない。
  const painted = getPaintedAreas(paintings, picture.id)
  const celebrating = phase === 'celebrating'

  const handlePaintArea = (areaId: string) => {
    // 演出中はCanvas側でもタップを受け付けないが、正となる状態更新側でも必ず弾く。
    if (!canPaint(phase)) return
    setPaintings((current) => paintArea(current, picture.id, areaId, selectedColorId))
  }

  const handleReset = () => {
    setPaintings((current) => resetPicture(current, picture.id))
  }

  /**
   * 「できた！」。塗り具合は一切見ない（何も塗っていなくても押せる）。
   * 完成判定はシステムではなく子ども自身がするのがこのゲームの前提。
   */
  const handleFinish = () => {
    // 連打の2回目以降は reducePaintPhase が同じ値を返すため、Reactが再レンダリングせず
    // 演出が最初から作り直されない（＝多重起動しない）。
    setPhase((current) => reducePaintPhase(current, 'finish'))
    if (celebrating) return
    primeAudio()
    playColorPaintFinishSound()
  }

  /** 「もういちどぬる」。塗った色はそのまま残して編集へ戻す（色を変えてまた動かせる）。 */
  const handleBackToColoring = () => {
    setPhase((current) => reducePaintPhase(current, 'backToColoring'))
  }

  return (
    <main className={`${styles.page} ${celebrating ? styles.pageCelebrating : ''}`}>
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          ← もどる
        </button>
        <h1 className={`${styles.title} ${celebrating ? styles.titleQuiet : ''}`}>
          <span aria-hidden="true">🖍️</span> うごくぬりえ
        </h1>
      </header>

      {/* 演出中は絵を主役にするため、題材えらび・色パレット・やりなおしは出さない。 */}
      {celebrating ? null : (
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
      )}

      {/* ぬりえの名前はSVG側（role="img" + aria-label）が持つため、ここでは重ねて付けない。 */}
      <section className={styles.canvasArea}>
        <div className={`${styles.canvasCard} ${celebrating ? styles.canvasCardCelebrating : ''}`}>
          <ColoringCanvas
            picture={picture}
            painted={painted}
            onPaintArea={handlePaintArea}
            phase={phase}
            className={styles.canvas}
          />
          {celebrating ? (
            <div className={styles.sparkles} aria-hidden="true">
              {SPARKLES.map((sparkle) => (
                <span
                  key={`${sparkle.left}-${sparkle.top}`}
                  className={styles.sparkle}
                  style={{
                    left: `${sparkle.left}%`,
                    top: `${sparkle.top}%`,
                    animationDelay: `${sparkle.delayMs}ms`,
                    fontSize: `${sparkle.scale * 30}px`,
                  }}
                >
                  ✨
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {celebrating ? null : (
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
      )}

      {/* 各ボタンに固定のkeyを付けて、フェーズが変わったときにReactが同じ<button>要素を
          使い回さないようにしている。使い回されると、「できた！」を連打した2打目が
          同じ位置に現れた「もういちどぬる」に当たり、演出が一瞬で終わってしまう。 */}
      <div className={styles.actionRow}>
        {celebrating ? (
          <>
            <p key="finish-message" className={styles.finishMessage} role="status">
              <span aria-hidden="true">🎉</span> できた！ うごいたね！
            </p>
            <button
              key="again"
              type="button"
              className={styles.againButton}
              onClick={handleBackToColoring}
            >
              <span aria-hidden="true">🖍️</span> もういちどぬる
            </button>
          </>
        ) : (
          <>
            <button key="reset" type="button" className={styles.resetButton} onClick={handleReset}>
              <span aria-hidden="true">🔄</span> やりなおし
            </button>
            <button
              key="finish"
              type="button"
              className={styles.finishButton}
              onClick={handleFinish}
            >
              <span aria-hidden="true">✨</span> できた！
            </button>
          </>
        )}
      </div>
    </main>
  )
}
