import type { ReactNode } from 'react'
import BigButton from './BigButton'
import styles from './QuizResultOverlay.module.css'

export type QuizResultKind = 'correct' | 'wrong'

type QuizResultOverlayProps = {
  /** 正解／不正解のどちらの見た目・文言にするか */
  result: QuizResultKind
  /** 「こたえ: ○○」の○○にあたる部分。省略時はその行ごと非表示にする */
  answer?: ReactNode
  /** 「3まいで わかった！ 80てん」「0てん」など、正誤メッセージに続く補足の1行。省略時は非表示 */
  detail?: ReactNode
  /** 正解の国旗・写真などの補足ビジュアル。省略時は非表示 */
  media?: ReactNode
  /** 「つぎのもんだい」ボタンの文言。既定は「つぎのもんだい」 */
  nextLabel?: string
  /** 不正解時の見出し。既定の文言は既存クイズとの互換性のため維持する。 */
  wrongLabel?: string
  onNext: () => void
}

/**
 * クイズ回答後の正誤結果を、画面下部に固定したオーバーレイとして表示する共通コンポーネント。
 * 背景を暗くするモーダルにはせず、下から迫り上がって表示する（詳細な演出はCSS側）。
 * このコンポーネント自体は position: fixed のため、呼び出し元のレイアウト（.page 等）の
 * 通常フローには一切影響しない。呼び出し元は、このオーバーレイぶんの下部余白を
 * ビューポートの幅・高さだけを基準に（回答したかどうかには依存させずに）確保すること。
 */
export default function QuizResultOverlay({
  result,
  answer,
  detail,
  media,
  nextLabel = 'つぎのもんだい',
  wrongLabel = 'ざんねん！',
  onNext,
}: QuizResultOverlayProps) {
  const isCorrect = result === 'correct'

  return (
    <div
      className={isCorrect ? `${styles.overlay} ${styles.correct}` : `${styles.overlay} ${styles.wrong}`}
      role="status"
      aria-live="polite"
    >
      <div className={styles.inner}>
        <div className={styles.texts}>
          <p
            className={
              isCorrect
                ? `${styles.resultText} ${styles.correctText}`
                : `${styles.resultText} ${styles.wrongText}`
            }
          >
            {isCorrect ? '🎉 せいかい！' : wrongLabel}
          </p>
          {answer !== undefined && <p className={styles.answerText}>こたえ: {answer}</p>}
          {detail !== undefined && <p className={styles.detailText}>{detail}</p>}
          {media !== undefined && <div className={styles.media}>{media}</div>}
        </div>

        <BigButton variant="primary" className={styles.nextButton} onClick={onNext}>
          {nextLabel}
        </BigButton>
      </div>
    </div>
  )
}
