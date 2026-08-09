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
        <BigButton variant="primary" onClick={() => navigate('/games/flag-quiz/play')}>
          はじめる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </div>
  )
}
