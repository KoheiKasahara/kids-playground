import GameBackButton from '../../components/GameBackButton'
import { useCallback, useState, type CSSProperties } from 'react'
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

/** Three.js/Rapierの色は0xRRGGBBの数値。CSSへ渡すために16進文字列へ直す。 */
function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`
}

export default function TsumikiBowlingGame({ stageId, onBackToStages }: TsumikiBowlingGameProps) {
  const stage = getBowlingStage(stageId)
  const [runId, setRunId] = useState(0)
  const [game, setGame] = useState<BowlingGameState>(createBowlingGameState)
  const [aimPower, setAimPower] = useState<number | null>(null)
  const [lastThrow, setLastThrow] = useState<ThrowSettledResult | null>(null)
  // 投球中に増えていく、その投球ぶんの倒した数。
  // 積み木は組み直さず続きから投げるので、HUDにはこれまでの合計へ足した数を出す。
  // 1投が落ち着いたら合計（game.toppledTotal）へ入るので、ここは0へ戻す。
  const [liveToppled, setLiveToppled] = useState(0)
  // 1投目を投げ終えたら、操作説明は出しっぱなしにしない。
  const [hasThrown, setHasThrown] = useState(false)
  // 次に投げる玉。毎投選び直せる（「もういちど」をまたいでも選択は引き継ぐ）。
  const [ballId, setBallIdState] = useState<BowlingBallId>(DEFAULT_BOWLING_BALL_ID)
  // 全部倒し切ったか（パーフェクトの定義）。結果画面でだけ使う。
  const [hadPerfectThrow, setHadPerfectThrow] = useState(false)
  const handleThrowStart = useCallback(() => {
    setAimPower(null)
    setLastThrow(null)
    setLiveToppled(0)
    setHasThrown(true)
    setGame((current) => startThrow(current))
  }, [])

  const handleStageRebuilt = useCallback(() => {
    setLastThrow(null)
    setLiveToppled(0)
  }, [])

  const handleToppledProgress = useCallback((toppled: number) => {
    setLiveToppled(toppled)
  }, [])

  const handleThrowSettled = useCallback((result: ThrowSettledResult) => {
    setLastThrow(result)
    // この投球ぶんは合計へ入るので、二重に足さないよう0へ戻す。
    setLiveToppled(0)
    if (result.isPerfect) setHadPerfectThrow(true)
    // 全部倒し切ったら投げるものが残らないので、3投を待たずに結果へ進む。
    setGame((current) => finishThrow(current, result.toppled, result.isPerfect))
  }, [])

  const handleAimChange = useCallback((power: number | null) => {
    setAimPower(power)
  }, [])

  const { registerContainer, setBallId } = useTsumikiBowlingEngine({
    runId,
    stageId,
    ballId,
    onThrowStart: handleThrowStart,
    onThrowSettled: handleThrowSettled,
    onStageRebuilt: handleStageRebuilt,
    onAimChange: handleAimChange,
    onToppledProgress: handleToppledProgress,
  })

  const throwNumber = currentThrowNumber(game)
  const isFinished = game.phase === 'finished'
  const isAiming = game.phase === 'aiming'
  const toppledSoFar = game.toppledTotal + (game.phase === 'flying' ? liveToppled : 0)
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
    // 世界を作り直して、前のプレイの物理状態を一切残さない。
    setRunId((current) => current + 1)
  }, [])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton onBack={onBackToStages} label="ステージ選択へもどる" />
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
              <span className={styles.scoreValue}>{toppledSoFar}</span>
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
                aria-label={ball.name}
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
                      '--ball-orb-size': `${20 + ball.uiSizeScale * 12}px`,
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
            <p className={styles.hint}>
              {aimPower !== null
                ? 'そのまま はなそう！'
                : hasThrown ? 'つぎも ひっぱって はなしてね' : 'たまを すこし ひっぱって はなそう！'}
            </p>
          </div>
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
            <p className={styles.resultTitle}>{game.throwResults.length}かい なげて</p>
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
          </div>
        ) : null}
      </div>
    </main>
  )
}
