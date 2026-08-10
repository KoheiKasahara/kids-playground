import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './WorkingVehicleQuizStart.module.css'

export default function WorkingVehicleQuizStart() {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <span className={styles.hero} aria-hidden="true">🚒</span>
      <h1 className={styles.title}>はたらくくるまクイズ</h1>
      <p className={styles.description}>ぜんぶで 10もん あるよ</p>
      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() => navigate('/games/working-vehicle-quiz/photo-to-name')}
        >
          <span aria-hidden="true">📷</span> しゃしんを みて こたえる
        </BigButton>
        <BigButton
          variant="primary"
          onClick={() => navigate('/games/working-vehicle-quiz/name-to-photo')}
        >
          <span aria-hidden="true">🔎</span> なまえを みて こたえる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
