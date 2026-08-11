import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { MODE_PATH } from './types'
import styles from './PrefectureQuizStart.module.css'

export default function PrefectureQuizStart() {
  const navigate = useNavigate()
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>都道府県クイズ</h1>
      <p className={styles.description}>ぜんぶで 10もん。にほんの ちずと なかよく なろう！</p>
      <div className={styles.actions}>
        <BigButton onClick={() => navigate('/games/prefecture-quiz/puzzle')}>都道府県パズルで あそぶ</BigButton>
        <BigButton onClick={() => navigate(`/games/prefecture-quiz/${MODE_PATH.shapeToName}/play`)}>🗺️ かたちを みて こたえる</BigButton>
        <BigButton onClick={() => navigate(`/games/prefecture-quiz/${MODE_PATH.nameToShape}/play`)}>🔎 なまえを みて かたちを えらぶ</BigButton>
        <BigButton onClick={() => navigate(`/games/prefecture-quiz/${MODE_PATH.nameToMap}/play`)}>🗾 にほんちず から さがす</BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>もどる</BigButton>
      </div>
    </main>
  )
}
