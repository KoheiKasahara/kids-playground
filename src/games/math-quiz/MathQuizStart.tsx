import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { MODE_EMOJI, MODE_LABEL, MODE_PATH } from './types'
import type { MathQuizMode } from './types'
import styles from './MathQuizStart.module.css'

const modes: MathQuizMode[] = ['add', 'sub', 'mul', 'div']

export default function MathQuizStart() {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <span className={styles.hero} aria-hidden="true">🔢</span>
      <h1 className={styles.title}>さんすうクイズ</h1>
      <p className={styles.description}>ぜんぶで 10もん あるよ</p>
      <div className={styles.actions}>
        {modes.map((mode) => (
          <BigButton
            key={mode}
            variant="primary"
            onClick={() => navigate(`/games/math-quiz/${MODE_PATH[mode]}`)}
          >
            <span aria-hidden="true">{MODE_EMOJI[mode]}</span> {MODE_LABEL[mode]}
          </BigButton>
        ))}
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
