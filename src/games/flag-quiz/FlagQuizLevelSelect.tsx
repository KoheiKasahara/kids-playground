import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { LEVEL_DESCRIPTION, LEVEL_LABEL, LEVEL_STARS, MODE_LABEL, MODE_PATH } from './types'
import type { QuizLevel, QuizMode } from './types'
import styles from './FlagQuizLevelSelect.module.css'

const levels: QuizLevel[] = ['easy', 'normal', 'hard']

type FlagQuizLevelSelectProps = {
  mode: QuizMode
}

export default function FlagQuizLevelSelect({ mode }: FlagQuizLevelSelectProps) {
  const navigate = useNavigate()

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>むずかしさを えらんでね</h1>
      <p className={styles.modeLabel}>{MODE_LABEL[mode]}</p>
      <div className={styles.actions}>
        {levels.map((level) => (
          <BigButton
            key={level}
            className={styles.levelButton}
            variant="primary"
            onClick={() => navigate(`/games/flag-quiz/${MODE_PATH[mode]}/${level}/play`)}
          >
            <span aria-hidden="true">{LEVEL_STARS[level]}</span> <span className={styles.levelLabel}>{LEVEL_LABEL[level]}</span>{' '}
            <span className={styles.levelDescription}>{LEVEL_DESCRIPTION[level]}</span>
          </BigButton>
        ))}
        <BigButton variant="secondary" onClick={() => navigate('/games/flag-quiz')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
