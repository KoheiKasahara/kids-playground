import GameBackButton from '../../components/GameBackButton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PukupukaStage from './PukupukaStage'
import { findPukupukaStage, PUKUPUKA_STAGES, type PukupukaStageId } from './stageDefinitions'
import {
  applyWaterTap,
  applyWave,
  waterSurfaceYOf,
  createInitialState,
  isSettled,
  primaryWaterBodyId,
  stepGame,
  toggleBoard,
  toggleDrain,
  toggleGate,
  waterRatioOf,
  type PukupukaGameState,
  type WaterControl,
} from './pukupukaGame'
import {
  playPukupukaActionSound,
  playPukupukaGoalSound,
  playPukupukaWaterSound,
} from './sounds'
import { primeAudio } from '../../audio/sound'
import { readRescueProgress, saveRescueProgress, type RescueProgress } from './rescueProgress'
import styles from './PukupukaRescuePlay.module.css'

/** ステージ選択。カードは番号・記号・名前を大きく並べ、読めなくても選びやすくする。 */
export function PukupukaStageSelect({ onSelect, onHome, progress = {} }: { onSelect: (id: PukupukaStageId) => void; onHome: () => void; progress?: RescueProgress }) {
  return (
    <main className={`${styles.page} ${styles.selectionPage}`} data-testid="pukupuka-stage-select">
      <header className={styles.header}>
        <GameBackButton onBack={onHome} />
        <h1 className={styles.title}>
          <span aria-hidden="true">🛟</span> ぷかぷかレスキュー
        </h1>
      </header>

      <section className={styles.selectionContent} aria-labelledby="pukupuka-stage-select-title">
        <h2 id="pukupuka-stage-select-title" className={styles.selectionTitle}>
          どのステージで あそぶ？
        </h2>
        <div className={styles.stageOptions} role="group" aria-label="ステージ選択">
          {PUKUPUKA_STAGES.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className={styles.stageOption}
              data-stage-id={stage.id}
              aria-label={`${index + 1} ${stage.name}`}
              onClick={() => onSelect(stage.id as PukupukaStageId)}
            >
              <span className={styles.stageOptionNumber} aria-hidden="true">
                {index + 1}
              </span>
              <span className={styles.stageOptionIcon} aria-hidden="true">
                {stage.icon}
              </span>
              <span className={styles.stageOptionLabel}>{stage.name}</span>
              {progress[stage.id] !== undefined ? <span className={styles.stageRecord} aria-label={`クリアずみ。ほし ${progress[stage.id]}こ`}>✓ {'★'.repeat(progress[stage.id])}{'☆'.repeat(3 - progress[stage.id])}</span> : null}
            </button>
          ))}
        </div>
      </section>
    </main>
  )
}

/**
 * ぷかぷかレスキュー。
 *
 * ステージ選択とプレイ画面を同じrouteで切り替える。物理は純粋な pukupukaGame.ts に
 * 閉じ込め、ここでは入力・描画・ステージ導線だけを扱う。
 */
export default function PukupukaRescuePlay() {
  const navigate = useNavigate()
  const [selectedStageId, setSelectedStageId] = useState<PukupukaStageId | null>(null)
  // 選択前もHooksを同じ順序で呼ぶための表示用フォールバック。選択画面では描画しない。
  const stage = (selectedStageId ? findPukupukaStage(selectedStageId) : undefined) ?? PUKUPUKA_STAGES[0]
  const bodyId = primaryWaterBodyId(stage)

  const [gameState, setGameState] = useState<PukupukaGameState>(() => createInitialState(stage))
  const stateRef = useRef(gameState)
  const controlRef = useRef<WaterControl>(null)
  const [activeControl, setActiveControl] = useState<WaterControl>(null)
  const [feedback, setFeedback] = useState('たすけて！')
  const [progress, setProgress] = useState(readRescueProgress)
  const [focusedFloaterId, setFocusedFloaterId] = useState<string | undefined>(undefined)

  const setControl = useCallback((next: WaterControl) => {
    controlRef.current = next
    setActiveControl(next)
  }, [])

  const selectStage = useCallback(
    (stageId: PukupukaStageId) => {
      const nextStage = findPukupukaStage(stageId)
      if (!nextStage) return
      const initial = createInitialState(nextStage)
      setControl(null)
      stateRef.current = initial
      setGameState(initial)
      setFeedback('たすけて！')
      setFocusedFloaterId(undefined)
      setSelectedStageId(stageId)
    },
    [setControl, setFocusedFloaterId],
  )

  useEffect(() => {
    if (!selectedStageId) return undefined

    let frameId: number | null = null
    let previous = performance.now()
    const frame = (now: number) => {
      const delta = now - previous
      previous = now
      const control = controlRef.current
      const previousState = stateRef.current
      const result = stepGame(stage, previousState, delta, control)
      stateRef.current = result.state
      const rescued = result.state.rescuedIds.length > previousState.rescuedIds.length
      const collected = result.state.collectedStarIds.length > previousState.collectedStarIds.length
      if (result.goalReached || previousState.wave || rescued || collected || control !== null || !isSettled(stage, result.state)) {
        setGameState(result.state)
      }
      if (rescued && !result.goalReached) {
        setFeedback('たすかったよ！ つぎの なかまへ！')
        playPukupukaActionSound('wheel')
      } else if (collected) {
        setFeedback('キラキラ！ ほしを みつけた！')
        playPukupukaActionSound('board')
      }
      if (result.goalReached) {
        setControl(null)
        playPukupukaGoalSound()
        setProgress((current) => {
          const next = { ...current, [stage.id]: Math.max(current[stage.id] ?? 0, result.state.collectedStarIds.length) }
          saveRescueProgress(next)
          return next
        })
      }
      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      controlRef.current = null
    }
  }, [selectedStageId, stage, setControl])

  useEffect(() => {
    const stop = () => setControl(null)
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [setControl])

  const changeWater = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.faucet) return
    primeAudio()
    playPukupukaWaterSound('fill')
    const next = applyWaterTap(stage, current)
    setFeedback('みずが でた！')
    stateRef.current = next
    setGameState(next)
  }

  const startFaucetHold = () => {
    setControl('fill')
    changeWater()
  }

  const stopFaucetHold = () => setControl(null)
  const tapFaucet = () => changeWater()

  const handleDrainToggle = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.drain) return
    primeAudio()
    const next = toggleDrain(current)
    if (next.drainOpen) playPukupukaWaterSound('drain')
    if (next.drainOpen && stage.waterWheel) playPukupukaActionSound('wheel')
    setFeedback(next.drainOpen ? (stage.waterWheel ? '水車が まわった！' : 'みずが ながれる！') : 'せんを しめたよ')
    stateRef.current = next
    setGameState(next)
  }

  const handleGateToggle = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.gate) return
    primeAudio()
    const next = toggleGate(current)
    playPukupukaActionSound('gate')
    setFeedback(next.gateOpen ? 'ゲートが あいた！' : 'ゲートを しめたよ')
    stateRef.current = next
    setGameState(next)
  }

  const handleBoardToggle = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.board) return
    primeAudio()
    const next = toggleBoard(current)
    playPukupukaActionSound('board')
    setFeedback(next.boardFlowDirection === 'goal' ? 'ゴールへ ながすよ！' : 'ながれが かわった！')
    stateRef.current = next
    setGameState(next)
  }

  const handleWave = (x: number, y: number) => {
    const next = applyWave(stage, stateRef.current, x, y)
    if (next === stateRef.current) return
    primeAudio()
    playPukupukaWaterSound('fill')
    stateRef.current = next
    setGameState(next)
    setFeedback('ぽちゃん！ なみで はこぼう')
  }

  const nudge = (direction: -1 | 1) => {
    const remaining = stateRef.current.floaters.filter((item) => !stateRef.current.rescuedIds.includes(item.id))
    const target = remaining.find((item) => item.id === focusedFloaterId) ?? remaining[0]
    if (!target) return
    const body = stage.waterBodies.find((item) => target.x >= item.left && target.x <= item.right)
    if (!body) return
    const y = waterSurfaceYOf(stage, stateRef.current, body.id) + 2
    for (const offset of [14, 8, 3]) {
      const x = Math.max(body.left + 1, Math.min(body.right - 1, target.x - direction * offset))
      if (applyWave(stage, stateRef.current, x, y) !== stateRef.current) {
        handleWave(x, y)
        return
      }
    }
  }

  const handleReset = () => {
    const initial = createInitialState(stage)
    setFocusedFloaterId(undefined)
    setControl(null)
    stateRef.current = initial
    setGameState(initial)
    setFeedback('たすけて！')
  }

  const handleBackToSelection = () => {
    setControl(null)
    setSelectedStageId(null)
    stateRef.current = createInitialState(PUKUPUKA_STAGES[0])
    setGameState(stateRef.current)
  }

  const handleNextStage = () => {
    if (!selectedStageId) return
    const currentIndex = PUKUPUKA_STAGES.findIndex((candidate) => candidate.id === selectedStageId)
    const next = PUKUPUKA_STAGES[currentIndex + 1]
    if (next) selectStage(next.id as PukupukaStageId)
    else handleBackToSelection()
  }

  if (!selectedStageId) {
    return <PukupukaStageSelect onSelect={selectStage} onHome={() => navigate('/')} progress={progress} />
  }

  const cleared = gameState.phase === 'cleared'
  const waterRatio = waterRatioOf(stage, gameState, bodyId)
  const waterPercent = Math.round(waterRatio * 100)
  const faucetOn = activeControl === 'fill'
  const isLastStage = PUKUPUKA_STAGES.at(-1)?.id === selectedStageId

  return (
    <main className={styles.page} data-testid="pukupuka-play">
      <header className={styles.header}>
        <GameBackButton onBack={handleBackToSelection} label="ステージ選択へもどる" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🛟</span> ぷかぷかレスキュー
        </h1>
      </header>

      <p className={styles.instruction} role="status" aria-live="polite">
        {cleared ? 'ゴール！ みんなを たすけたよ' : `${stage.name}：${stage.hint}`}
      </p>

      <div className={styles.stageArea}>
        <PukupukaStage
          stage={stage}
          state={gameState}
          onWave={handleWave}
          focusedFloaterId={focusedFloaterId}
          faucetActive={faucetOn}
          faucetDisabled={cleared}
          onFaucetHoldStart={startFaucetHold}
          onFaucetHoldEnd={stopFaucetHold}
          onFaucetTap={tapFaucet}
          drainOpen={gameState.drainOpen}
          drainDisabled={cleared}
          onDrainToggle={handleDrainToggle}
          gateOpen={gameState.gateOpen}
          gateDisabled={cleared}
          onGateToggle={handleGateToggle}
          boardFlowDirection={gameState.boardFlowDirection}
          boardDisabled={cleared}
          onBoardToggle={handleBoardToggle}
        />
        {cleared ? (
          <div className={styles.clearBanner}>
            <span className={styles.clearEmoji} aria-hidden="true">🎉</span>
            <span className={styles.clearText}>ゴール！</span>
          </div>
        ) : null}
        <div className={`${styles.feedbackBubble} ${cleared ? styles.feedbackCleared : ''}`} aria-live="polite">
          {cleared ? 'やったー！' : feedback}
        </div>
        {cleared ? (
          <div className={styles.celebration} aria-hidden="true">
            <span>★</span><span>●</span><span>★</span><span>●</span><span>★</span>
          </div>
        ) : null}
      </div>

      <div className={styles.playTools}>
        <div className={styles.rescueRow}>
          <div className={styles.friends} role="group" aria-label="たすける なかま">
            {stage.floaters.map((floater) => {
              const rescued = gameState.rescuedIds.includes(floater.id)
              const label = floater.kind === 'duck' ? 'あひる' : floater.kind === 'boat' ? 'ボート' : 'くま'
              return <button key={floater.id} type="button" className={styles.friendButton}
                disabled={rescued} aria-label={`${label}${rescued ? ' たすけた！' : 'を みる'}`}
                aria-pressed={focusedFloaterId === floater.id}
                onClick={() => setFocusedFloaterId(floater.id)}>
                {floater.kind === 'duck' ? '🦆' : floater.kind === 'boat' ? '⛵' : '🐻'}{rescued ? '✓' : ''}
              </button>
            })}
          </div>
          <span className={styles.starScore} aria-label={`ほし ${gameState.collectedStarIds.length} / ${stage.stars?.length ?? 0}`}>
            {'★'.repeat(gameState.collectedStarIds.length)}{'☆'.repeat((stage.stars?.length ?? 0) - gameState.collectedStarIds.length)}
          </span>
        </div>
        {!cleared ? <>
          <p className={styles.waveHint}>みずを タッチ！ なみで おそう 👆</p>
          <div className={styles.waveButtons}>
            <button type="button" onClick={() => nudge(-1)} aria-label="ひだりへ なみ">🌊 ←</button>
            <button type="button" onClick={() => nudge(1)} aria-label="みぎへ なみ">→ 🌊</button>
          </div>
          {stage.viewportWidth ? <div className={styles.remoteControls} role="group" aria-label="すいろの そうさ">
            <button type="button" onClick={tapFaucet}>💧 みずを たす</button>
            <button type="button" onClick={handleGateToggle} aria-pressed={gameState.gateOpen}>🚪 {gameState.gateOpen ? 'とじる' : 'あける'}</button>
            <button type="button" onClick={handleBoardToggle}>↔️ ながれを かえる</button>
            <button type="button" onClick={handleDrainToggle} aria-pressed={gameState.drainOpen}>🌀 {gameState.drainOpen ? 'みずを とめる' : 'みずを ぬく'}</button>
          </div> : null}
        </> : <p className={styles.waveHint}>{gameState.collectedStarIds.length === stage.stars?.length ? 'ほしも ぜんぶ！ だいせいこう！' : 'だいせいこう！ つぎは ほしも さがそう'}</p>}
        <div className={styles.gauge}>
          <span className={styles.gaugeLabel} aria-hidden="true">💧</span>
          <span className={styles.gaugeTrack}>
            <span
              className={styles.gaugeFill}
              style={{ width: `${waterPercent}%` }}
              data-testid="pukupuka-gauge-fill"
              data-water-percent={waterPercent}
            />
          </span>
        </div>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.reset} onClick={handleReset}>やりなおし</button>
        {cleared ? (
          <button type="button" className={styles.nextStage} onClick={handleNextStage}>
            {isLastStage ? 'ステージをえらぶ' : 'つぎのステージ'}
          </button>
        ) : null}
      </div>
    </main>
  )
}
