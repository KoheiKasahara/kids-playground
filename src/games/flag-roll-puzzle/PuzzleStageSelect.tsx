import { useNavigate } from 'react-router-dom'
import { PUZZLE_STAGES, type PuzzleStageId } from './puzzleStages'
import styles from './PuzzleStageSelect.module.css'

type PuzzleStageSelectProps = {
  readonly onSelect: (stageId: PuzzleStageId) => void
}

/** 文字が読めなくても個数と絵で区別できる、3枚だけのステージ選択。 */
export default function PuzzleStageSelect({ onSelect }: PuzzleStageSelectProps) {
  const navigate = useNavigate()
  return (
    <main className={styles.page} data-testid="puzzle-stage-select">
      <header className={styles.header}>
        <button type="button" className={styles.homeButton} onClick={() => navigate('/')}>
          ホームへ
        </button>
        <h1 className={styles.title}>こっきコロコロパズル</h1>
      </header>
      <section className={styles.content} aria-labelledby="puzzle-stage-title">
        <h2 id="puzzle-stage-title" className={styles.heading}>どのステージで あそぶ？</h2>
        <div className={styles.cards}>
          {PUZZLE_STAGES.map((stage) => (
            <button
              key={stage.id}
              type="button"
              className={styles.card}
              aria-label={stage.nameJa}
              data-testid={`puzzle-stage-${stage.id}`}
              data-stage-id={stage.id}
              onClick={() => onSelect(stage.id)}
            >
              <span className={styles.emoji} aria-hidden="true">{stage.emoji}</span>
              <span className={styles.name}>{stage.nameJa}</span>
              <span className={styles.info}>{stage.description}</span>
              <span className={styles.ballCount} aria-label={`ボール${stage.balls.length}こ`}>
                {'●'.repeat(stage.balls.length)}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}
