import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  createBowlingGameState,
  currentThrowNumber,
  finishThrow,
  restartGame,
  startThrow,
  THROWS_PER_GAME,
  type BowlingGameState,
} from './bowlingGame'
import {
  useTsumikiBowlingEngine,
  type ThrowSettledResult,
} from './useTsumikiBowlingEngine'
import {
  BOWLING_BALL_SPECS,
  DEFAULT_BOWLING_BALL_ID,
  type BowlingBallId,
} from './bowlingBalls'
import styles from './TsumikiBowlingPlay.module.css'

/** ドラッグ中のパワー表示を、幼児にも分かる3段階の言葉にする。 */
function powerLabel(power: number): string {
  if (power < 0.34) return 'よわい'
  if (power < 0.7) return 'ふつう'
  return 'つよい！'
}

/** Three.js/Rapierの色は0xRRGGBBの数値。CSSへ渡すために16進文字列へ直す。 */
function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export default function TsumikiBowlingPlay() {
  const [runId, setRunId] = useState(0)
  const [game, setGame] = useState<BowlingGameState>(createBowlingGameState)
  const [aimPower, setAimPower] = useState<number | null>(null)
  const [lastThrow, setLastThrow] = useState<ThrowSettledResult | null>(null)
  // 投球中に増えていく、その投球ぶんの倒した数。落ち着いた時点で合計へ入る。
  const [liveToppled, setLiveToppled] = useState(0)
  // 1投目を投げ終えたら、操作説明は出しっぱなしにしない。
  const [hasThrown, setHasThrown] = useState(false)
  // 次に投げる玉。毎投選び直せる（「もういちど」をまたいでも選択は引き継ぐ）。
  const [ballId, setBallIdState] = useState<BowlingBallId>(DEFAULT_BOWLING_BALL_ID)

  const handleThrowStart = useCallback(() => {
    setAimPower(null)
    setLastThrow(null)
    setLiveToppled(0)
    setHasThrown(true)
    setGame((current) => startThrow(current))
  }, [])

  const handleToppledProgress = useCallback((toppled: number) => {
    setLiveToppled(toppled)
  }, [])

  const handleThrowSettled = useCallback((result: ThrowSettledResult) => {
    setLastThrow(result)
    setLiveToppled(0)
    setGame((current) => finishThrow(current, result.toppled))
  }, [])

  const handleAimChange = useCallback((power: number | null) => {
    setAimPower(power)
  }, [])

  const { registerContainer, setBallId } = useTsumikiBowlingEngine({
    runId,
    ballId,
    onThrowStart: handleThrowStart,
    onThrowSettled: handleThrowSettled,
    onAimChange: handleAimChange,
    onToppledProgress: handleToppledProgress,
  })

  const throwNumber = currentThrowNumber(game)
  const isFinished = game.phase === 'finished'
  const isAiming = game.phase === 'aiming'
  // 投球待機中だけ切り替えられる。飛行中・組み直し中の切替は
  // useTsumikiBowlingEngine側でも無視されるが、ここでも二重に防ぐ。
  const canSelectBall = isAiming && !isFinished

  const handleSelectBall = useCallback(
    (id: BowlingBallId) => {
      if (!canSelectBall) return
      setBallIdState(id)
      setBallId(id)
    },
    [canSelectBall, setBallId],
  )

  const retry = useCallback(() => {
    setGame(restartGame())
    setLastThrow(null)
    setAimPower(null)
    setLiveToppled(0)
    setHasThrown(false)
    // 世界を作り直して、前のプレイの物理状態を一切残さない。
    setRunId((current) => current + 1)
  }, [])

  // 投球中は「合計＋いま倒れているぶん」を出し、崩れている最中も数字が動くようにする。
  const displayedToppled = game.toppledTotal + liveToppled

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>
          もどる
        </Link>
        <h1 className={styles.title}>つみきボウリング</h1>
      </header>

      <div className={styles.scene}>
        <div className={styles.canvasHost} ref={registerContainer} />

        <div className={styles.topBar}>
          <div className={styles.hud}>
            <div className={styles.throwCounter} aria-label={`${THROWS_PER_GAME}かい なげるうちの ${throwNumber}かいめ`}>
              {Array.from({ length: THROWS_PER_GAME }, (_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={`${styles.throwDot} ${
                    index < game.throwResults.length
                      ? styles.throwDotDone
                      : index === game.throwResults.length && !isFinished
                        ? styles.throwDotCurrent
                        : ''
                  }`}
                />
              ))}
            </div>
            <p className={styles.score} role="status" aria-live="polite">
              <span className={styles.scoreLabel}>たおした つみき</span>
              <span className={styles.scoreValue}>{displayedToppled}</span>
              <span className={styles.scoreUnit}>こ</span>
            </p>
          </div>

          <div className={styles.ballSelector} role="group" aria-label="たまをえらぶ">
            {BOWLING_BALL_SPECS.map((ball) => (
              <button
                key={ball.id}
                type="button"
                className={`${styles.ballCard} ${
                  ballId === ball.id ? styles.ballCardSelected : ''
                }`}
                onClick={() => handleSelectBall(ball.id)}
                disabled={!canSelectBall}
                aria-pressed={ballId === ball.id}
              >
                <span
                  className={styles.ballCardOrb}
                  aria-hidden="true"
                  style={{
                    width: `${32 + ball.uiSizeScale * 26}px`,
                    height: `${32 + ball.uiSizeScale * 26}px`,
                    background: toCssColor(ball.color),
                  }}
                >
                  <span className={styles.ballCardIcon}>{ball.icon}</span>
                </span>
                <span className={styles.ballCardName}>{ball.name}</span>
              </button>
            ))}
          </div>
        </div>

        {isAiming && !isFinished ? (
          <div className={styles.aimPanel}>
            {aimPower === null ? (
              <p className={styles.hint}>
                {hasThrown ? 'つぎも ひっぱって はなしてね' : 'たまを ひっぱって はなすと ビューン！'}
              </p>
            ) : (
              <div className={styles.powerMeter} aria-hidden="true">
                <div className={styles.powerTrack}>
                  <div
                    className={styles.powerFill}
                    style={{ width: `${Math.round(aimPower * 100)}%` }}
                  />
                </div>
                <span className={styles.powerLabel}>{powerLabel(aimPower)}</span>
              </div>
            )}
          </div>
        ) : null}

        {lastThrow && !isFinished ? (
          <p className={styles.throwResult} role="status" aria-live="polite">
            {lastThrow.toppled > 0 ? `${lastThrow.toppled}こ たおれた！` : 'つぎは あたるかな？'}
          </p>
        ) : null}

        {isFinished ? (
          <div className={styles.resultOverlay} role="dialog" aria-label="けっか">
            <p className={styles.resultTitle}>ぜんぶで</p>
            <p className={styles.resultCount}>
              <span className={styles.resultNumber}>{game.toppledTotal}</span>
              <span className={styles.resultUnit}>こ</span>
            </p>
            <p className={styles.resultText}>たおれたよ！</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={retry}
            >
              もういちど
            </button>
            <Link to="/" className={styles.resultBackLink}>
              ほかの あそび
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
