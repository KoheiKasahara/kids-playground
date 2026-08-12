import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { travelCourses } from './data/travelCourses'
import WorldTravelMap from './map/WorldTravelMap'
import { isAnswerMode, isTravelRegion, type AnswerMode, type TravelCourse } from './types'
import styles from './WorldTravelQuizResult.module.css'

type ResultState = { correctCount: number; totalCount: number; courseId: string; answerMode: AnswerMode }
function isResult(value: unknown): value is ResultState {
  if (!value || typeof value !== 'object') return false
  const state = value as Record<string, unknown>
  return Number.isInteger(state.correctCount)
    && typeof state.correctCount === 'number'
    && state.correctCount >= 0
    && state.correctCount <= 10
    && state.totalCount === 10
    && typeof state.courseId === 'string'
    && typeof state.answerMode === 'string'
    && isAnswerMode(state.answerMode)
}
function praise(score: number) { return score === 10 ? 'かんぺき！🏆' : score >= 7 ? 'すごい！🎉' : score >= 4 ? 'よくできました 👍' : 'また たびしよう！😊' }

export default function WorldTravelQuizResult() {
  const { region: pathRegion, answerMode: pathAnswerMode } = useParams(); const location = useLocation(); const navigate = useNavigate()
  if (!isTravelRegion(pathRegion) || !isAnswerMode(pathAnswerMode) || !isResult(location.state) || location.state.answerMode !== pathAnswerMode) return <Navigate to="/games/world-travel-quiz" replace />
  const course = travelCourses.find((item) => item.id === location.state.courseId)
  if (!course || course.region !== pathRegion) return <Navigate to="/games/world-travel-quiz" replace />
  return <Result course={course} score={location.state.correctCount} onAgain={() => navigate(`/games/world-travel-quiz/${pathRegion}/${pathAnswerMode}/play`, { replace: true })} onHome={() => navigate('/games/world-travel-quiz')} onRoot={() => navigate('/')} />
}
function Result({ course, score, onAgain, onHome, onRoot }: { course: TravelCourse; score: number; onAgain: () => void; onHome: () => void; onRoot: () => void }) {
  return <main className={styles.page}><h1>たびが しゅうりょう！</h1><div className={styles.map}><WorldTravelMap course={course} questionIndex={9} phase="answering" onTravelComplete={() => {}} result /></div><p className={styles.course}>{course.name}</p><p className={styles.score}>{score} / 10 もん せいかい！</p><p className={styles.praise}>{praise(score)}</p><div className={styles.actions}><BigButton variant="primary" onClick={onAgain}>もういちど</BigButton><BigButton variant="secondary" onClick={onHome}>ちいきを えらぶ</BigButton><BigButton variant="secondary" onClick={onRoot}>ホームへ</BigButton></div></main>
}
