import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { MODE_PATH } from './types'
import type { PrefectureQuizMode } from './types'
import styles from './PrefectureQuizResult.module.css'

type ResultState = { correctCount: number; totalCount: number }
function isResultState(value: unknown): value is ResultState {
  return typeof value === 'object' && value !== null && typeof (value as ResultState).correctCount === 'number' && typeof (value as ResultState).totalCount === 'number'
}
const pathToMode: Record<string, PrefectureQuizMode> = { 'shape-to-name': 'shapeToName', 'name-to-shape': 'nameToShape', 'name-to-map': 'nameToMap' }

export default function PrefectureQuizResult() {
  const { mode: modePath } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const mode = modePath ? pathToMode[modePath] : undefined
  if (!mode || !isResultState(location.state)) return <Navigate to="/games/prefecture-quiz" replace />
  const { correctCount, totalCount } = location.state
  const praise = correctCount === totalCount ? 'かんぺき！' : correctCount >= 7 ? 'すごい！' : correctCount >= 4 ? 'よくできました' : 'また あそぼう！'
  return <main className={styles.page}>
    <h1 className={styles.title}>けっか</h1>
    <p className={styles.score}>{correctCount} / {totalCount}もん せいかい！</p>
    <p className={styles.praise}>🎉 {praise}</p>
    <div className={styles.actions}>
      <BigButton onClick={() => navigate(`/games/prefecture-quiz/${MODE_PATH[mode]}/play`, { replace: true })}>もういちど</BigButton>
      <BigButton variant="secondary" onClick={() => navigate('/games/prefecture-quiz')}>べつの モード</BigButton>
      <BigButton variant="secondary" onClick={() => navigate('/')}>ホームへ</BigButton>
    </div>
  </main>
}
