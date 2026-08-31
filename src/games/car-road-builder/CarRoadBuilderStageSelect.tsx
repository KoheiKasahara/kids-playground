import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './CarRoadBuilder.module.css'
import { STAGE_ORDER, STAGES, type StageId } from './stageDefinitions'

export default function CarRoadBuilderStageSelect() {
  const navigate = useNavigate()

  const startStage = (stageId: StageId) => {
    navigate('/games/car-road-builder/play', { state: { stageId } })
  }

  return (
    <main className={`${styles.page} ${styles.stageSelectPage}`}>
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/')}>
          <span aria-hidden="true">‹</span> もどる
        </button>
        <h1><span aria-hidden="true">🚗</span> くるまのみちづくり</h1>
      </header>

      <section className={styles.stageSelectContent} aria-labelledby="car-road-stage-title">
        <h2 id="car-road-stage-title" className={styles.stageSelectTitle}>どのひろさで あそぶ？</h2>
        <div className={styles.stageOptions} role="group" aria-label="ステージ選択">
          {STAGE_ORDER.map((stageId) => {
            const stage = STAGES[stageId]
            return (
              <button
                key={stageId}
                type="button"
                className={styles.stageOption}
                aria-label={`${stage.label} ${stage.sizeLabel}`}
                data-stage-id={stageId}
                onClick={() => startStage(stageId)}
              >
                <span
                  className={styles.stageMiniBoard}
                  style={{ '--stage-mini-cols': stage.size.cols, '--stage-mini-rows': stage.size.rows } as CSSProperties}
                  aria-hidden="true"
                >
                  {Array.from({ length: stage.size.rows * stage.size.cols }, (_, index) => <span key={index} className={styles.stageMiniCell} />)}
                </span>
                <span className={styles.stageOptionLabel}>{stage.label}</span>
                <span className={styles.stageOptionSize}>{stage.sizeLabel}</span>
              </button>
            )
          })}
        </div>
      </section>
    </main>
  )
}

export { CarRoadBuilderStageSelect }

