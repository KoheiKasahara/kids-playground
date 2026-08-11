import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { LEVEL_LABEL, LEVEL_STARS } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
import { LEVEL_DESCRIPTION } from './types'
import styles from './ColorMixQuizLevelSelect.module.css'

const levels: QuizLevel[] = ['easy', 'normal', 'hard']

export default function ColorMixQuizLevelSelect() {
  const navigate = useNavigate()
  return (
    <main className={styles.page}>
      <span className={styles.hero} aria-hidden="true">🖌️</span>
      <h1 className={styles.title}>むずかしさを えらんでね</h1>
      <div className={styles.actions}>
        {levels.map((level) => (
          <BigButton key={level} className={styles.levelButton} variant="primary" onClick={() => navigate(`/games/color-mix-quiz/${level}/play`)}>
            <span aria-hidden="true">{LEVEL_STARS[level]}</span>
            <span className={styles.levelLabel}>{LEVEL_LABEL[level]}</span>
            <span className={styles.levelDescription}>{LEVEL_DESCRIPTION[level]}</span>
          </BigButton>
        ))}
        <BigButton variant="secondary" onClick={() => navigate('/games/color-mix-quiz')}>もどる</BigButton>
      </div>
    </main>
  )
}
