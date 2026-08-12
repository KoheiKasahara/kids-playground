import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import type { TravelRegion } from './types'
import styles from './WorldTravelQuizStart.module.css'

const regions: readonly { id: TravelRegion; title: string; emoji: string; description: string }[] = [
  { id: 'asia', title: 'アジア', emoji: '🗾', description: 'にほん から とうなんアジアへ' },
  { id: 'europe', title: 'ヨーロッパ', emoji: '🏰', description: 'いろいろな くにを めぐろう' },
  { id: 'africa', title: 'アフリカ', emoji: '🦁', description: 'さばく や そうげんを たびしよう' },
  { id: 'northAmerica', title: '北アメリカ', emoji: '🗽', description: 'カナダ から カリブの うみへ' },
  { id: 'southAmerica', title: '南アメリカ', emoji: '🦜', description: 'アンデス や アマゾンを たびしよう' },
  { id: 'oceania', title: 'オセアニア', emoji: '🐠', description: 'たいへいようの しまを めぐろう' },
]

export default function WorldTravelQuizStart() {
  const navigate = useNavigate()
  return <main className={styles.page}>
    <h1 className={styles.title}>せかい旅行クイズ</h1>
    <p className={styles.description}>ちずの ひかっている くにを あてながら、10この くにを たびしよう！</p>
    <div className={styles.regions}>{regions.map((region) => <BigButton key={region.id} variant="primary" className={styles.region} onClick={() => navigate(`/games/world-travel-quiz/${region.id}/answer-mode`)}><span aria-hidden="true">{region.emoji}</span><span><strong>{region.title}</strong><small>{region.description}</small></span></BigButton>)}</div>
    <BigButton variant="secondary" onClick={() => navigate('/')}>もどる</BigButton>
  </main>
}
