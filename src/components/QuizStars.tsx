import { quizStarCount } from '../games/quiz-core/stars'
import styles from './QuizStars.module.css'

type Props = {
  correctCount: number
  totalCount: number
}

/** クイズ結果画面の ★1〜3。ひとつずつ ぽん・ぽん・ぽん と出す。 */
export default function QuizStars({ correctCount, totalCount }: Props) {
  const stars = quizStarCount(correctCount, totalCount)
  return (
    <p className={styles.stars} role="img" aria-label={`ほし ${stars}こ`} data-quiz-stars={stars}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden="true"
          className={i < stars ? styles.on : styles.off}
          style={{ animationDelay: `${0.2 + i * 0.25}s` }}
        >
          ★
        </span>
      ))}
    </p>
  )
}
