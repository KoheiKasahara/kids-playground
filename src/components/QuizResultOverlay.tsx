import { useEffect, type CSSProperties, type ReactNode } from 'react'
import BigButton from './BigButton'
import { isSpeechEnabled, speak } from '../speech'
import { vibrate } from '../utils/haptics'
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
  /**
   * 不正解のときに「こたえは ○○」と読み上げる文言（よみあげONのときだけ）。
   * 省略時は answer が文字列・数値ならそれを使う。
   */
  answerSpeech?: string
  onNext: () => void
}

// 紙吹雪のひとつぶごとの横位置・色・遅れ。毎回同じ並びにして、テストやスクショで揺れないようにする。
const CONFETTI_COLORS = ['#ff6b6b', '#ffd43b', '#51cf66', '#4dabf7', '#cc5de8', '#ff922b']
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  delay: (i % 6) * 40,
  color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  turn: i % 2 === 0 ? 1 : -1,
}))

/**
 * 画面中央に大きく出す○／×と、正解時の紙吹雪（Issue #784 A9）。
 * 操作の邪魔にならないよう pointer-events: none で、1秒ほどで自然に消える。
 * オーバーレイ本体は迫り上がりの transform を持つため、position: fixed を正しく
 * 画面基準にするよう、その外側（兄弟要素）に置く。
 */
function ResultBurst({ correct }: { correct: boolean }) {
  return (
    <div className={styles.burst} aria-hidden="true" data-quiz-burst={correct ? 'correct' : 'wrong'}>
      <span className={correct ? styles.burstCorrect : styles.burstWrong}>{correct ? '◯' : '✕'}</span>
      {correct &&
        CONFETTI.map((piece, i) => (
          <i
            key={i}
            className={styles.confetti}
            style={
              {
                '--x': `${piece.x}vw`,
                '--delay': `${piece.delay}ms`,
                '--color': piece.color,
                '--turn': piece.turn,
              } as CSSProperties
            }
          />
        ))}
    </div>
  )
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
  answerSpeech,
  onNext,
}: QuizResultOverlayProps) {
  const isCorrect = result === 'correct'
  const spokenAnswer =
    answerSpeech ?? (typeof answer === 'string' || typeof answer === 'number' ? String(answer) : undefined)

  // 正誤が出た瞬間に、振動（対応端末のみ）と、不正解なら答えの読み上げで知らせる。
  useEffect(() => {
    vibrate(isCorrect ? 'success' : 'error')
    if (!isCorrect && spokenAnswer && isSpeechEnabled()) speak(`こたえは ${spokenAnswer}`)
    // オーバーレイは回答ごとにマウントし直されるため、表示された最初の1回だけ鳴らせばよい。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
    <ResultBurst correct={isCorrect} />
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
    </>
  )
}
