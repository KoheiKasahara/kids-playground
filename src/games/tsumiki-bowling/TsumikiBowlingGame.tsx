import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
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
import { getBowlingStage } from './bowlingStage'
import styles from './TsumikiBowlingGame.module.css'

type TsumikiBowlingGameProps = {
  stageId: string
  /** 選択画面へ戻る。呼ばれるとこのコンポーネントはアンマウントされ、エンジンが解放される。 */
  onBackToStages: () => void
}

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

/** 大崩壊チップを出しておく長さ[ms]。短く出して消す（0.9秒）。 */
const BIG_COLLAPSE_CHIP_MS = 900

export default function TsumikiBowlingGame({ stageId, onBackToStages }: TsumikiBowlingGameProps) {
  const stage = getBowlingStage(stageId)
  const [runId, setRunId] = useState(0)
  const [game, setGame] = useState<BowlingGameState>(createBowlingGameState)
  const [aimPower, setAimPower] = useState<number | null>(null)
  const [lastThrow, setLastThrow] = useState<ThrowSettledResult | null>(null)
  // 投球中に増えていく、その投球ぶんの倒した数。
  // 1投が落ち着いたあとも、次の投球が始まるまではその投球の最終値を表示したままにする
  // （積み木は毎投組み直されるので、累計を全体数と比べても意味がないため）。
  const [liveToppled, setLiveToppled] = useState(0)
  // 1投目を投げ終えたら、操作説明は出しっぱなしにしない。
  const [hasThrown, setHasThrown] = useState(false)
  // 次に投げる玉。毎投選び直せる（「もういちど」をまたいでも選択は引き継ぐ）。
  const [ballId, setBallIdState] = useState<BowlingBallId>(DEFAULT_BOWLING_BALL_ID)
  // 3投のうち1回でも全部倒したか（パーフェクトの定義）。結果画面でだけ使う。
  const [hadPerfectThrow, setHadPerfectThrow] = useState(false)
  // 大崩壊の短いチップ表示。
  const [bigCollapseChip, setBigCollapseChip] = useState(false)
  const collapseChipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (collapseChipTimeoutRef.current !== null) {
        clearTimeout(collapseChipTimeoutRef.current)
      }
    }
  }, [])

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
    // 崩れている最中に増えていった数を、この投球の最終値として確定させる
    // （次の投球が始まるまではこの値を出し続ける）。
    setLiveToppled(result.toppled)
    if (result.isPerfect) setHadPerfectThrow(true)
    setGame((current) => finishThrow(current, result.toppled))
  }, [])

  const handleAimChange = useCallback((power: number | null) => {
    setAimPower(power)
  }, [])

  const handleBigCollapse = useCallback(() => {
    setBigCollapseChip(true)
    if (collapseChipTimeoutRef.current !== null) {
      clearTimeout(collapseChipTimeoutRef.current)
    }
    collapseChipTimeoutRef.current = setTimeout(() => {
      setBigCollapseChip(false)
      collapseChipTimeoutRef.current = null
    }, BIG_COLLAPSE_CHIP_MS)
  }, [])

  const { registerContainer, setBallId } = useTsumikiBowlingEngine({
    runId,
    stageId,
    ballId,
    onThrowStart: handleThrowStart,
    onThrowSettled: handleThrowSettled,
    onAimChange: handleAimChange,
    onToppledProgress: handleToppledProgress,
    onBigCollapse: handleBigCollapse,
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
    setHadPerfectThrow(false)
    setBigCollapseChip(false)
    if (collapseChipTimeoutRef.current !== null) {
      clearTimeout(collapseChipTimeoutRef.current)
      collapseChipTimeoutRef.current = null
    }
    // 世界を作り直して、前のプレイの物理状態を一切残さない。
    setRunId((current) => current + 1)
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link to="/" className={styles.backLink}>
          もどる
        </Link>
        <h1 className={styles.title}>つみきボウリング</h1>
        <button
          type="button"
          className={styles.stageButton}
          onClick={onBackToStages}
          aria-label="ステージをかえる"
        >
          <span className={styles.stageButtonName}>{stage.name}</span>
          <span className={styles.stageButtonChange}>かえる</span>
        </button>
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
              <span className={styles.scoreValue}>{liveToppled}</span>
              <span className={styles.scoreSeparator}> / </span>
              <span className={styles.scoreTotal}>{stage.blocks.length}</span>
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
                  // 大きさはCSS変数で渡す。width/heightを直接書くと、
                  // 背の低い画面でカードを小さくする指定（CSS側のmedia query）が
                  // インラインstyleに負けて効かなくなるため。
                  style={
                    {
                      '--ball-orb-size': `${32 + ball.uiSizeScale * 26}px`,
                      background: toCssColor(ball.color),
                    } as CSSProperties
                  }
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

        {bigCollapseChip ? (
          <p className={styles.collapseChip} aria-hidden="true">
            ガラガラー！
          </p>
        ) : null}

        {lastThrow && !isFinished ? (
          <p
            className={`${styles.throwResult} ${
              lastThrow.isPerfect ? styles.throwResultPerfect : ''
            }`}
            role="status"
            aria-live="polite"
          >
            {lastThrow.isPerfect
              ? 'ぜんぶ たおれた！'
              : lastThrow.toppled > 0
                ? `${lastThrow.toppled}こ たおれた！`
                : 'つぎは あたるかな？'}
          </p>
        ) : null}

        {isFinished ? (
          <div className={styles.resultOverlay} role="dialog" aria-label="けっか">
            {hadPerfectThrow ? (
              <>
                <p className={styles.perfectBadge}>パーフェクト！</p>
                <div className={styles.confetti} aria-hidden="true">
                  {Array.from({ length: 12 }, (_, index) => (
                    <span key={index} className={styles.confettiPiece} />
                  ))}
                </div>
              </>
            ) : null}
            <p className={styles.resultTitle}>{THROWS_PER_GAME}かい なげて</p>
            <p className={styles.resultCount}>
              <span className={styles.resultNumber}>{game.toppledTotal}</span>
              <span className={styles.resultUnit}>こ</span>
            </p>
            <p className={styles.resultText}>たおした！</p>
            <button
              type="button"
              className={styles.retryButton}
              onClick={retry}
            >
              もういちど
            </button>
            <button
              type="button"
              className={styles.changeStageButton}
              onClick={onBackToStages}
            >
              べつの ステージ
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
