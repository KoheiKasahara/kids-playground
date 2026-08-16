import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { primeAudio } from '../../utils/quizSound'
import { dominoFlags, type DominoFlagId } from './flagDefinitions'
import DominoCompleteConfetti from './DominoCompleteConfetti'
import styles from './DominoFlagPlay.module.css'
import type { DominoCourseType } from './dominoCourse'
import { useDominoEngine } from './useDominoEngine'

type DominoGameState = 'select' | 'ready' | 'running' | 'complete'

const COURSE_LABELS: Record<DominoCourseType, string> = {
  normal: 'ふつう',
  long: 'ロング',
}

export default function DominoFlagPlay() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<DominoGameState>('select')
  const [flagId, setFlagId] = useState<DominoFlagId | null>(null)
  const [runId, setRunId] = useState(0)
  const [courseType, setCourseType] = useState<DominoCourseType>('normal')
  const [soundOn, setSoundOn] = useState(true)
  const selectedFlag = flagId === null
    ? null
    : dominoFlags.find((flag) => flag.id === flagId) ?? null

  const { registerContainer, start } = useDominoEngine({
    runId,
    flagId,
    courseType,
    onComplete: () => {
      if (flagId !== null) setGameState('complete')
    },
    soundEnabled: soundOn,
  })

  const handleSelectFlag = (nextFlagId: DominoFlagId) => {
    primeAudio()
    setFlagId(nextFlagId)
    setGameState('ready')
  }

  const handleSelectCourse = (nextCourseType: DominoCourseType) => {
    if (nextCourseType === courseType) return
    setCourseType(nextCourseType)
    // 選択中に切り替えても、次に作る物理世界が前のrunを再利用しないようにする。
    setRunId((current) => current + 1)
  }

  const handleStart = () => {
    if (gameState !== 'ready' || flagId === null) return
    primeAudio()
    start()
    setGameState('running')
  }

  const handleRetry = () => {
    if (gameState !== 'complete') return
    setRunId((current) => current + 1)
    setGameState('ready')
  }

  // 選択画面はアンマウントされるため、戻るたびに一覧が先頭から表示される。
  const handleChangeFlag = () => {
    if (gameState === 'running') return
    setFlagId(null)
    setGameState('select')
  }

  return (
    <main className={styles.page}>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />
      {gameState === 'complete' && flagId !== null && (
        <DominoCompleteConfetti key={`${runId}-${flagId}`} />
      )}

      <div className={styles.ui}>
        <h1 id="domino-flag-heading" className={styles.title}>
          こっきドミノ
        </h1>

        {gameState === 'select' ? (
          <>
            <p id="domino-flag-instruction" className={styles.instruction}>
              どの こっきに する？
            </p>
            <div className={styles.courseToggle} role="group" aria-label="コース">
              {(Object.keys(COURSE_LABELS) as DominoCourseType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={[
                    styles.courseButton,
                    courseType === type ? styles.courseButtonActive : '',
                  ].filter(Boolean).join(' ')}
                  aria-pressed={courseType === type}
                  onClick={() => handleSelectCourse(type)}
                >
                  {COURSE_LABELS[type]}
                </button>
              ))}
            </div>
            <section className={styles.selection} aria-labelledby="domino-flag-instruction">
              <div className={styles.flagGrid}>
                {dominoFlags.map((flag, index) => {
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
                          loading={index < 4 ? 'eager' : 'lazy'}
                          decoding="async"
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
                <>
                  <p className={styles.selectionStatus} role="status" aria-live="polite">
                    {selectedFlag.nameJa}の こっき！
                  </p>
                  <p className={styles.courseStatus}>
                    {COURSE_LABELS[courseType]} コース
                  </p>
                </>
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

      <button
        type="button"
        className={styles.soundToggle}
        aria-label={soundOn ? 'おとを けす' : 'おとを だす'}
        onClick={() => setSoundOn((current) => !current)}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
      </button>
    </main>
  )
}
