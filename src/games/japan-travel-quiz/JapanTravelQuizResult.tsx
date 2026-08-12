import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { japanTravelCourses } from './data/travelCourses'
import JapanTravelMap from './map/JapanTravelMap'
import type { JapanTravelCourse } from './types'
import styles from './JapanTravelQuizResult.module.css'

type ResultState = { correctCount: number; totalCount: number; courseId: string }
function isResult(value: unknown): value is ResultState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return Number.isInteger(state.correctCount) && typeof state.correctCount === 'number' && state.correctCount >= 0 && state.correctCount <= 10 && state.totalCount === 10 && typeof state.courseId === 'string'
}
function praise(score: number) { return score === 10 ? 'かんぺき！🏆' : score >= 7 ? 'すごい！🎉' : score >= 4 ? 'よくできました 👍' : 'また たびしよう！😊' }

export default function JapanTravelQuizResult() {
  const location = useLocation(); const navigate = useNavigate()
  if (!isResult(location.state)) return <Navigate to="/games/japan-travel-quiz" replace />
  const course = japanTravelCourses.find((item) => item.id === location.state.courseId)
  if (!course) return <Navigate to="/games/japan-travel-quiz" replace />
  return <Result course={course} score={location.state.correctCount} onAgain={() => navigate('/games/japan-travel-quiz/play', { replace: true })} onHome={() => navigate('/games/japan-travel-quiz')} onRoot={() => navigate('/')} />
}
function Result({ course, score, onAgain, onHome, onRoot }: { course: JapanTravelCourse; score: number; onAgain: () => void; onHome: () => void; onRoot: () => void }) {
  return <main className={styles.page}><h1>たびが しゅうりょう！</h1><div className={styles.map}><JapanTravelMap course={course} questionIndex={9} phase="answering" onTravelComplete={() => {}} result /></div><p className={styles.course}>{course.name}</p><p className={styles.score}>{score} / 10 もん せいかい！</p><p className={styles.praise}>{praise(score)}</p><div className={styles.actions}><BigButton variant="primary" onClick={onAgain}>もういちど</BigButton><BigButton variant="secondary" onClick={onHome}>さいしょへ</BigButton><BigButton variant="secondary" onClick={onRoot}>ホームへ</BigButton></div></main>
}
