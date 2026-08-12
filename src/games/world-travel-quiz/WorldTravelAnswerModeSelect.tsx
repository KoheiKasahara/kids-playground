import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isTravelRegion } from './types'
import styles from './WorldTravelAnswerModeSelect.module.css'

export default function WorldTravelAnswerModeSelect() {
  const { region } = useParams()
  const navigate = useNavigate()
  if (!isTravelRegion(region)) return <Navigate to="/games/world-travel-quiz" replace />

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>どうやって こたえる？</h1>
      <p className={styles.description}>ちずを みて、こたえかたを えらぼう！</p>
      <div className={styles.modes}>
        <BigButton className={styles.mode} variant="primary" onClick={() => navigate(`/games/world-travel-quiz/${region}/country-name/play`)}>
          <span className={styles.emoji} aria-hidden="true">📝</span>
          <strong>国名で答える</strong>
          <small>ひかっている くにの なまえを えらぶ</small>
        </BigButton>
        <BigButton className={styles.mode} variant="primary" onClick={() => navigate(`/games/world-travel-quiz/${region}/flag/play`)}>
          <span className={styles.emoji} aria-hidden="true">🚩</span>
          <strong>国旗で答える</strong>
          <small>ひかっている くにの こっきを えらぶ</small>
        </BigButton>
      </div>
      <BigButton variant="secondary" onClick={() => navigate('/games/world-travel-quiz')}>もどる</BigButton>
    </main>
  )
}
