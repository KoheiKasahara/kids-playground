import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isQuizResultState } from '../quiz-core/resultState'
import styles from './ColorMixQuizResult.module.css'

function praise(score: number, total: number) {
  if (score === total) return ['🏆', 'かんぺき！']
  if (score >= 7) return ['🎉', 'すごい！']
  if (score >= 4) return ['👍', 'よくできました']
  return ['😊', 'また まぜよう！']
}

export default function ColorMixQuizResult() {
  const navigate = useNavigate()
  const location = useLocation()
  if (!isQuizResultState(location.state)) return <Navigate to="/games/color-mix-quiz" replace />
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
