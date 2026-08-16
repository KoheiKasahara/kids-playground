import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { dominoFlags, type DominoFlagId } from './flagDefinitions'
import styles from './DominoFlagPlay.module.css'
import { useDominoEngine } from './useDominoEngine'

type DominoGameState = 'select' | 'ready' | 'running' | 'complete'

export default function DominoFlagPlay() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<DominoGameState>('select')
  const [flagId, setFlagId] = useState<DominoFlagId | null>(null)
  const [runId, setRunId] = useState(0)
  const selectedFlag = flagId === null
    ? null
    : dominoFlags.find((flag) => flag.id === flagId) ?? null
  const { registerContainer, start } = useDominoEngine({
    runId,
    flagId,
    onComplete: () => {
      if (flagId !== null) setGameState('complete')
    },
  })

  const handleSelectFlag = (nextFlagId: DominoFlagId) => {
    setFlagId(nextFlagId)
    setGameState('ready')
  }

  const handleStart = () => {
    if (gameState !== 'ready' || flagId === null) return
    start()
    setGameState('running')
  }

  const handleRetry = () => {
    if (gameState !== 'complete') return
    setRunId((current) => current + 1)
    setGameState('ready')
  }

  const handleChangeFlag = () => {
    if (gameState === 'running') return
    setFlagId(null)
    setGameState('select')
  }

  return (
    <main className={styles.page}>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

      <div className={styles.ui}>
        <h1 id="domino-flag-heading" className={styles.title}>
          こっきドミノ
        </h1>

        {gameState === 'select' ? (
          <>
            <p id="domino-flag-instruction" className={styles.instruction}>
              どの こっきに する？
            </p>
            <section className={styles.selection} aria-labelledby="domino-flag-instruction">
              <div className={styles.flagGrid}>
                {dominoFlags.map((flag) => {
                  return (
                    <button
                      key={flag.id}
                      type="button"
                      className={styles.flagCard}
                      aria-label={flag.nameJa}
                      onClick={() => handleSelectFlag(flag.id)}
                    >
                      <span className={styles.flagImageFrame}>
                        <img
                          className={styles.flagImage}
                          src={import.meta.env.BASE_URL + flag.imagePath}
                          alt=""
                          draggable={false}
                        />
                      </span>
                      <span className={styles.flagName}>{flag.nameJa}</span>
                    </button>
                  )
                })}
              </div>
            </section>
          </>
        ) : (
          selectedFlag && (
            <>
              {gameState === 'ready' && (
                <p className={styles.selectionStatus} role="status" aria-live="polite">
                  {selectedFlag.nameJa}の こっき！
                </p>
              )}
              {gameState === 'running' && (
                <p className={styles.runningStatus} role="status" aria-live="polite">
                  たおれているよ！
                </p>
              )}
              {gameState === 'complete' && (
                <p className={styles.result} role="status" aria-live="polite">
                  {selectedFlag.nameJa}！
                </p>
              )}

              <div className={styles.actions}>
                {(gameState === 'ready' || gameState === 'running') && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.start}`}
                    onClick={handleStart}
                    disabled={gameState !== 'ready'}
                  >
                    スタート！
                  </button>
                )}
                {gameState === 'complete' && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.start}`}
                    onClick={handleRetry}
                  >
                    もういちど
                  </button>
                )}
                {(gameState === 'ready' || gameState === 'running' || gameState === 'complete') && (
                  <button
                    type="button"
                    className={`${styles.button} ${styles.retry}`}
                    onClick={handleChangeFlag}
                    disabled={gameState === 'running'}
                  >
                    こっきをかえる
                  </button>
                )}
              </div>
            </>
          )
        )}
      </div>

      <button type="button" className={styles.home} onClick={() => navigate('/')}>
        もどる
      </button>
    </main>
  )
}
