import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { REGION_LABEL } from './data/regions'
import type { RegionId } from './data/prefectures'
import styles from './PrefecturePuzzleStart.module.css'

const puzzleRegions: readonly RegionId[] = ['tohoku', 'kanto', 'chubu', 'kinki', 'chugoku', 'shikoku', 'kyushuOkinawa']

export default function PrefecturePuzzleStart() {
  const navigate = useNavigate()
  return <main className={styles.page}>
    <h1 className={styles.title}>都道府県パズル</h1>
    <p className={styles.description}>ちほうの ちずに、なまえの ピースを おいてみよう！</p>
    <div className={styles.regions} aria-label="地方をえらぶ">
      {puzzleRegions.map((region) => <BigButton key={region} onClick={() => navigate(`/games/prefecture-quiz/puzzle/${region}/play`)}>{REGION_LABEL[region]}地方</BigButton>)}
    </div>
    <BigButton variant="secondary" onClick={() => navigate('/games/prefecture-quiz')}>もどる</BigButton>
  </main>
}
