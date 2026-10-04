import { useEffect, useRef } from 'react'
import styles from './ClearAllConfirmDialog.module.css'

type ClearAllConfirmDialogProps = {
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 「ぜんぶ けす」の確認。幼児が「ボールを おとす」の隣を押し間違えても、
 * 作ったコースがいきなり消えないよう、もう一度だけ聞く。
 *
 * 押し間違いをもう一度重ねにくいよう、消さない方（やめる）を左・最初のフォーカス先に置き、
 * 消す方は色で区別する。背景をタップしても「やめる」と同じ扱いにする。
 */
export default function ClearAllConfirmDialog({ onConfirm, onCancel }: ClearAllConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    cancelRef.current?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <section
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-all-confirm-title"
        aria-describedby="clear-all-confirm-text"
      >
        <span className={styles.icon} aria-hidden="true">🧹</span>
        <h2 id="clear-all-confirm-title" className={styles.title}>
          ぜんぶ けす？
        </h2>
        <p id="clear-all-confirm-text" className={styles.text}>
          おいた パーツが ぜんぶ なくなるよ
        </p>
        <div className={styles.buttons}>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel}>
            やめる
          </button>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            けす
          </button>
        </div>
      </section>
    </div>
  )
}
