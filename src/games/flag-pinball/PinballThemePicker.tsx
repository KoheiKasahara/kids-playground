import { PINBALL_THEMES, resolvePinballTheme } from './themes'
import { setPinballThemeId, usePinballThemeId } from './themeStore'
import styles from './PinballThemePicker.module.css'

export default function PinballThemePicker() {
  const selectedThemeId = usePinballThemeId()
  const currentTheme = resolvePinballTheme(selectedThemeId)
  const currentIndex = PINBALL_THEMES.findIndex((theme) => theme.id === currentTheme.id)

  const moveTheme = (direction: -1 | 1) => {
    // テーマの順番だけを動かし、国旗の選択やゲームモードには触れない。
    const baseIndex = currentIndex >= 0 ? currentIndex : 0
    const nextIndex = (baseIndex + direction + PINBALL_THEMES.length) % PINBALL_THEMES.length
    const nextTheme = PINBALL_THEMES[nextIndex]
    if (nextTheme === undefined) return

    // 選んだ瞬間に保存することで、「あそぶ！」を押さずに画面を離れても次回へ引き継ぐ。
    setPinballThemeId(nextTheme.id)
  }

  return (
    <section className={styles.picker} aria-labelledby="pinball-theme-picker-title">
      <h2 id="pinball-theme-picker-title" className={styles.heading}>
        もよう
      </h2>
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.arrowButton}
          aria-label="まえの もよう"
          onClick={() => moveTheme(-1)}
        >
          <span aria-hidden="true">＜</span>
        </button>

        <div className={styles.current}>
          <div
            className={[styles.preview, currentTheme.boardClassName].join(' ')}
            aria-hidden="true"
          />
          <p className={styles.status} role="status" aria-live="polite">
            <span className={styles.emoji} aria-hidden="true">
              {currentTheme.emoji}
            </span>
            <span className={styles.label}>{currentTheme.labelJa}</span>
          </p>
        </div>

        <button
          type="button"
          className={styles.arrowButton}
          aria-label="つぎの もよう"
          onClick={() => moveTheme(1)}
        >
          <span aria-hidden="true">＞</span>
        </button>
      </div>
    </section>
  )
}
