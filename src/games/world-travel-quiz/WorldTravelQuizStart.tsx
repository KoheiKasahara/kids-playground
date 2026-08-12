import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { travelRegions } from './data/travelRegions'
import styles from './WorldTravelQuizStart.module.css'

export default function WorldTravelQuizStart() {
  const navigate = useNavigate()
  return <main className={styles.page}>
    <h1 className={styles.title}>せかい旅行クイズ</h1>
    <p className={styles.description}>ちずの ひかっている くにを あてながら、10この くにを たびしよう！</p>
    <div className={styles.regions}>{travelRegions.map((region) => <BigButton key={region.id} variant="primary" className={`${styles.region} ${region.id === 'asiaOceania' ? styles.longRegion : ''}`} onClick={() => navigate(`/games/world-travel-quiz/${region.id}/answer-mode`)}><span aria-hidden="true">{region.emoji}</span><span><strong>{region.title}</strong><small>{region.description}</small></span></BigButton>)}</div>
    <BigButton variant="secondary" onClick={() => navigate('/')}>もどる</BigButton>
  </main>
}
