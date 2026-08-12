import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './ColorMixQuizResult.module.css'

type ResultState = { correctCount: number; totalCount: number }

function isResultState(value: unknown): value is ResultState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return typeof state.correctCount === 'number' && Number.isInteger(state.correctCount) && typeof state.totalCount === 'number' && Number.isInteger(state.totalCount) && state.totalCount > 0 && state.correctCount >= 0 && state.correctCount <= state.totalCount
}

function praise(score: number, total: number) {
  if (score === total) return ['🏆', 'かんぺき！']
  if (score >= 7) return ['🎉', 'すごい！']
  if (score >= 4) return ['👍', 'よくできました']
  return ['😊', 'また まぜよう！']
}

export default function ColorMixQuizResult() {
  const navigate = useNavigate()
  const location = useLocation()
  if (!isResultState(location.state)) return <Navigate to="/games/color-mix-quiz" replace />
  const [emoji, message] = praise(location.state.correctCount, location.state.totalCount)
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.score}>{location.state.correctCount} / {location.state.totalCount}もん せいかい！</p>
      <p className={styles.praise}><span aria-hidden="true">{emoji}</span> {message}</p>
      <div className={styles.actions}>
        <BigButton variant="primary" onClick={() => navigate('/games/color-mix-quiz/play', { replace: true })}>もういちど</BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>ホームへ</BigButton>
      </div>
    </main>
  )
}
