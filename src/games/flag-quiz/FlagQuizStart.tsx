import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import styles from './FlagQuizStart.module.css'

export default function FlagQuizStart() {
  const navigate = useNavigate()

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>こっきクイズ</h1>
      <p className={styles.description}>ぜんぶで 10もん あるよ</p>
      <div className={styles.actions}>
        <BigButton variant="primary" onClick={() => navigate('/games/flag-quiz/flag-to-name/play')}>
          <span aria-hidden="true">🚩</span> こっきを みて こたえる
        </BigButton>
        <BigButton variant="primary" onClick={() => navigate('/games/flag-quiz/name-to-flag/play')}>
          <span aria-hidden="true">🔎</span> なまえを みて こたえる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </div>
  )
}
