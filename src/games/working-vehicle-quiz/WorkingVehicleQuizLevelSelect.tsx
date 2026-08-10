import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { LEVEL_LABEL, LEVEL_STARS } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
import { LEVEL_DESCRIPTION, MODE_LABEL, MODE_PATH } from './types'
import type { VehicleQuizMode } from './types'
import styles from './WorkingVehicleQuizLevelSelect.module.css'

const levels: QuizLevel[] = ['easy', 'normal', 'hard']

type WorkingVehicleQuizLevelSelectProps = {
  mode: VehicleQuizMode
}

export default function WorkingVehicleQuizLevelSelect({
  mode,
}: WorkingVehicleQuizLevelSelectProps) {
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
            onClick={() =>
              navigate(`/games/working-vehicle-quiz/${MODE_PATH[mode]}/${level}/play`)
            }
          >
            <span aria-hidden="true">{LEVEL_STARS[level]}</span>
            <span className={styles.levelLabel}>{LEVEL_LABEL[level]}</span>
            <span className={styles.levelDescription}>{LEVEL_DESCRIPTION[level]}</span>
          </BigButton>
        ))}
        <BigButton variant="secondary" onClick={() => navigate('/games/working-vehicle-quiz')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
