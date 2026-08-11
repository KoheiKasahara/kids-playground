import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
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
  const { level } = useParams()
  if (!isResultState(location.state)) return <Navigate to="/games/color-mix-quiz" replace />
  if (!isQuizLevel(level)) return <Navigate to="/games/color-mix-quiz/level" replace />
  const [emoji, message] = praise(location.state.correctCount, location.state.totalCount)
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.level}>{LEVEL_LABEL[level]}</p>
      <p className={styles.score}>{location.state.correctCount} / {location.state.totalCount}もん せいかい！</p>
      <p className={styles.praise}><span aria-hidden="true">{emoji}</span> {message}</p>
      <div className={styles.actions}>
        <BigButton variant="primary" onClick={() => navigate(`/games/color-mix-quiz/${level}/play`, { replace: true })}>もういちど</BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/games/color-mix-quiz/level')}>べつの むずかしさ</BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>ホームへ</BigButton>
      </div>
    </main>
  )
}
