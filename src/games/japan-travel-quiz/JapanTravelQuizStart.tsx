import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './JapanTravelQuizStart.module.css'

export default function JapanTravelQuizStart() {
  const navigate = useNavigate()
  return <main className={styles.page}>
    <h1 className={styles.title}>にほん旅行クイズ</h1>
    <p className={styles.description}>ちずの ひかっている ばしょは なんけん？ にほんを 10けん たびしよう！</p>
    <div className={styles.ticket} aria-hidden="true"><span>🗾</span><span>✈️</span><span>🏝️</span></div>
    <div className={styles.actions}>
      <BigButton variant="primary" className={styles.start} onClick={() => navigate('/games/japan-travel-quiz/play')}>たびに しゅっぱつ！</BigButton>
      <BigButton variant="secondary" onClick={() => navigate('/')}>もどる</BigButton>
    </div>
  </main>
}
