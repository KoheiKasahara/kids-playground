import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './DominoFlagPlay.module.css'
import { useDominoEngine } from './useDominoEngine'

type DominoGameState = 'ready' | 'running' | 'complete'

export default function DominoFlagPlay() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<DominoGameState>('ready')
  const [runId, setRunId] = useState(0)
  const { registerContainer, start } = useDominoEngine({
    runId,
    onComplete: () => setGameState('complete'),
  })

  const handleStart = () => {
    if (gameState !== 'ready') return
    start()
    setGameState('running')
  }

  const handleRetry = () => {
    if (gameState !== 'complete') return
    setRunId((current) => current + 1)
    setGameState('ready')
  }

  return (
    <main className={styles.page}>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

      <div className={styles.ui}>
        <h1 className={styles.title}>こっきドミノ</h1>

        {gameState === 'complete' && (
          <p className={styles.result} role="status" aria-live="polite">
            にほん！
          </p>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={`${styles.button} ${styles.start}`}
            onClick={handleStart}
            disabled={gameState !== 'ready'}
          >
            スタート！
          </button>
          <button
            type="button"
            className={`${styles.button} ${styles.retry}`}
            onClick={handleRetry}
            disabled={gameState !== 'complete'}
          >
            もういちど
          </button>
        </div>
      </div>

      <button type="button" className={styles.home} onClick={() => navigate('/')}>
        もどる
      </button>
    </main>
  )
}
