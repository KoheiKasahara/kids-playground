import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './FlagQuizResult.module.css'

type ResultState = {
  correctCount: number
  totalCount: number
}

function isResultState(value: unknown): value is ResultState {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.correctCount === 'number' &&
    typeof candidate.totalCount === 'number'
  )
}

function getPraise(correctCount: number, totalCount: number): { emoji: string; message: string } {
  if (totalCount > 0 && correctCount === totalCount) {
    return { emoji: '🏆', message: 'かんぺき！' }
  }
  if (correctCount >= 7) {
    return { emoji: '🎉', message: 'すごい！' }
  }
  if (correctCount >= 4) {
    return { emoji: '👍', message: 'よくできました' }
  }
  return { emoji: '😊', message: 'またあそぼう！' }
}

export default function FlagQuizResult() {
  const navigate = useNavigate()
  const location = useLocation()

  if (!isResultState(location.state)) {
    return <Navigate to="/games/flag-quiz" replace />
  }

  const { correctCount, totalCount } = location.state
  const praise = getPraise(correctCount, totalCount)

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.score}>
        {correctCount} / {totalCount}もん せいかい！
      </p>
      <p className={styles.praise}>
        <span aria-hidden="true">{praise.emoji}</span> {praise.message}
      </p>
      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() => navigate('/games/flag-quiz/play', { replace: true })}
        >
          もういちど
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          ホームへ
        </BigButton>
      </div>
    </div>
  )
}
