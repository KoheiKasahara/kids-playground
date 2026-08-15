import type { ToyPlacement } from './toyLayout'
import type { PinballThemeDefinition } from './themes/types'
import styles from './PinballToy.module.css'

export type PinballToyProps = {
  toy: ToyPlacement
  theme: PinballThemeDefinition
  registerToy: (toyId: string) => (el: HTMLElement | null) => void
  onActivate: (toyId: string) => void
}

export default function PinballToy({ toy, theme, registerToy, onActivate }: PinballToyProps) {
  const tapDiameter = toy.tapRadius * 2

  return (
    <button
      type="button"
      className={styles.toyButton}
      style={{
        left: toy.x - toy.tapRadius,
        top: toy.y - toy.tapRadius,
        width: tapDiameter,
        height: tapDiameter,
      }}
      aria-label={toy.labelJa}
      onPointerDown={() => onActivate(toy.id)}
      onClick={(event) => {
        // pointerdown の直後にもポインタ由来の click が発火するため、detail が1以上の
        // clickは無視する。キーボードのEnter/Spaceによるclickだけはdetailが0なので、
        // ここで発動させて二重発動を防ぎながら標準ボタンの操作性を保つ。
        if (event.detail === 0) onActivate(toy.id)
      }}
    >
      <span
        ref={registerToy(toy.id)}
        className={`${styles.toyVisual} ${theme.toyClassName}`}
        data-toy-kind={toy.kind}
        aria-hidden="true"
        style={{ width: toy.radius * 2, height: toy.radius * 2 }}
      >
        {theme.renderToy(toy.kind)}
      </span>
    </button>
  )
}
