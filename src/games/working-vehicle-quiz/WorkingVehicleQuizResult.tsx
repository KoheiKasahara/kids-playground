import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
import { isQuizResultState } from '../quiz-core/resultState'
import { MODE_LABEL, MODE_PATH } from './types'
import type { VehicleQuizMode } from './types'
import styles from './WorkingVehicleQuizResult.module.css'

function getPraise(correctCount: number, totalCount: number) {
  if (correctCount === totalCount) return { emoji: '🏆', message: 'かんぺき！' }
  if (correctCount >= 7) return { emoji: '🎉', message: 'すごい！' }
  if (correctCount >= 4) return { emoji: '👍', message: 'よくできました' }
  return { emoji: '😊', message: 'またあそぼう！' }
}

type WorkingVehicleQuizResultProps = {
  mode: VehicleQuizMode
}

export default function WorkingVehicleQuizResult({ mode }: WorkingVehicleQuizResultProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { level } = useParams()

  if (!isQuizResultState(location.state)) {
    return <Navigate to="/games/working-vehicle-quiz" replace />
  }

  if (!isQuizLevel(level)) {
    return (
      <Navigate to={`/games/working-vehicle-quiz/${MODE_PATH[mode]}`} replace />
    )
  }

  const { correctCount, totalCount } = location.state
  const praise = getPraise(correctCount, totalCount)

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.modeLabel}>
        {MODE_LABEL[mode]} ・ {LEVEL_LABEL[level]}
      </p>
      <p className={styles.score}>
        {correctCount} / {totalCount}もん せいかい！
      </p>
      <p className={styles.praise}>
        <span aria-hidden="true">{praise.emoji}</span> {praise.message}
      </p>
      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() =>
            navigate(`/games/working-vehicle-quiz/${MODE_PATH[mode]}/${level}/play`, {
              replace: true,
            })
          }
        >
          もういちど
        </BigButton>
        <BigButton
          variant="secondary"
          onClick={() => navigate(`/games/working-vehicle-quiz/${MODE_PATH[mode]}`)}
        >
          べつの むずかしさ
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/games/working-vehicle-quiz')}>
          べつの クイズ
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          ホームへ
        </BigButton>
      </div>
    </main>
  )
}
