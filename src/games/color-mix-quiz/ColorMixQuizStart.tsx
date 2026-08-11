import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './ColorMixQuizStart.module.css'

export default function ColorMixQuizStart() {
  const navigate = useNavigate()
  return (
    <main className={styles.page}>
      <span className={styles.hero} aria-hidden="true">🎨</span>
      <h1 className={styles.title}>いろまぜクイズ</h1>
      <p className={styles.description}>えのぐを まぜて、できる いろを あてよう！</p>
      <div className={styles.actions}>
        <BigButton variant="primary" onClick={() => navigate('/games/color-mix-quiz/level')}>
          はじめる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>もどる</BigButton>
      </div>
    </main>
  )
}
