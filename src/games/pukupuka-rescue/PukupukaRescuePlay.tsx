import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PukupukaStage from './PukupukaStage'
import { findPukupukaStage, PUKUPUKA_STAGES, type PukupukaStageId } from './stageDefinitions'
import {
  applyWaterTap,
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
import { playPukupukaGoalSound, playPukupukaWaterSound, primeAudio } from '../../utils/quizSound'
import styles from './PukupukaRescuePlay.module.css'

/** ステージ選択。カードは番号・記号・名前を大きく並べ、読めなくても選びやすくする。 */
export function PukupukaStageSelect({ onSelect, onHome }: { onSelect: (id: PukupukaStageId) => void; onHome: () => void }) {
  return (
    <main className={`${styles.page} ${styles.selectionPage}`} data-testid="pukupuka-stage-select">
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={onHome}>
          ← もどる
        </button>
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
      setSelectedStageId(stageId)
    },
    [setControl],
  )

  useEffect(() => {
    if (!selectedStageId) return undefined

    let frameId: number | null = null
    let previous = performance.now()
    const frame = (now: number) => {
      const delta = now - previous
      previous = now
      const control = controlRef.current
      const result = stepGame(stage, stateRef.current, delta, control)
      stateRef.current = result.state
      if (result.goalReached || control !== null || !isSettled(stage, result.state)) {
        setGameState(result.state)
      }
      if (result.goalReached) {
        setControl(null)
        playPukupukaGoalSound()
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
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
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
    stateRef.current = next
    setGameState(next)
  }

  const handleGateToggle = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.gate) return
    primeAudio()
    const next = toggleGate(current)
    playPukupukaWaterSound(next.gateOpen ? 'fill' : 'drain')
    stateRef.current = next
    setGameState(next)
  }

  const handleBoardToggle = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.board) return
    primeAudio()
    const next = toggleBoard(current)
    playPukupukaWaterSound(next.boardFlowDirection === 'goal' ? 'fill' : 'drain')
    stateRef.current = next
    setGameState(next)
  }

  const handleReset = () => {
    const initial = createInitialState(stage)
    setControl(null)
    stateRef.current = initial
    setGameState(initial)
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
    return <PukupukaStageSelect onSelect={selectStage} onHome={() => navigate('/')} />
  }

  const cleared = gameState.phase === 'cleared'
  const waterRatio = waterRatioOf(stage, gameState, bodyId)
  const waterPercent = Math.round(waterRatio * 100)
  const faucetOn = activeControl === 'fill'
  const isLastStage = PUKUPUKA_STAGES.at(-1)?.id === selectedStageId

  return (
    <main className={styles.page} data-testid="pukupuka-play">
      <header className={styles.header}>
        <button
          type="button"
          className={styles.home}
          aria-label="ステージ選択へもどる"
          onClick={handleBackToSelection}
        >
          ← もどる
        </button>
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
      </div>

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
