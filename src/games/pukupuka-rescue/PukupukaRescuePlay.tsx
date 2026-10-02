import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import GameBackButton from '../../components/GameBackButton'
import PukupukaStage from './PukupukaStage'
import { CharacterDefs, FriendIcon } from './PukupukaCharacters'
import { FRIEND_NAMES } from './characterInfo'
import { findPukupukaStage, PUKUPUKA_STAGES, type PukupukaStageId } from './stageDefinitions'
import {
  applyWaterTap,
  applyWave,
  waterSurfaceYOf,
  createInitialState,
  friendIdsOf,
  getFloater,
  isSettled,
  leaderAtGoal,
  leaderIdOf,
  stepGame,
  toggleBoard,
  toggleDrain,
  toggleGate,
  triggerWhale,
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
      {/* カードの仲間アイコンが使う色の定義。 */}
      <svg className={styles.hiddenDefs} aria-hidden="true" focusable="false"><defs><CharacterDefs /></defs></svg>
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
              <span className={styles.stageFriends} aria-hidden="true">
                {friendIdsOf(stage).map((friendId) => {
                  const kind = stage.floaters.find((floater) => floater.id === friendId)?.kind
                  return kind ? <FriendIcon key={friendId} kind={kind} /> : null
                })}
              </span>
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

  const [gameState, setGameState] = useState<PukupukaGameState>(() => createInitialState(stage))
  const stateRef = useRef(gameState)
  const controlRef = useRef<WaterControl>(null)
  const [activeControl, setActiveControl] = useState<WaterControl>(null)
  const [feedback, setFeedback] = useState('たすけて！')
  // 目立たせたい出来事（なかま・ベルなど）だけ、盤面の上に短く出す。番号を変えてアニメーションをやり直す。
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null)
  const [progress, setProgress] = useState(readRescueProgress)

  const announce = useCallback((text: string, visible = false) => {
    setFeedback(text)
    if (visible) setToast((current) => ({ id: (current?.id ?? 0) + 1, text }))
  }, [])

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
      setToast(null)
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
      const previousState = stateRef.current
      const result = stepGame(stage, previousState, delta, control)
      const next = result.state
      stateRef.current = next
      const rescued = next.rescuedIds.length > previousState.rescuedIds.length
      const collected = next.collectedStarIds.length > previousState.collectedStarIds.length
      const rung = next.rungBellIds.length > previousState.rungBellIds.length
      const slid = !previousState.slide && next.slide !== null
      const newEffects = next.effects.filter((effect) => !previousState.effects.some((old) => old.id === effect.id))
      const launched = newEffects.some((effect) => effect.kind === 'launch')
      const splashed = newEffects.some((effect) => effect.kind === 'splash')
      const arrivedEarly = next.phase === 'playing' && !leaderAtGoal(stage, previousState) && leaderAtGoal(stage, next)
      if (result.goalReached || previousState.wave || rescued || collected || rung || control !== null ||
        newEffects.length > 0 || next.effects.length !== previousState.effects.length ||
        next.gateLift !== previousState.gateLift || next.water !== previousState.water ||
        next.doorLifts !== previousState.doorLifts || !isSettled(stage, next)) {
        setGameState(next)
      }
      if (rescued && !result.goalReached) {
        const friendId = next.rescuedIds.at(-1)
        const kind = stage.floaters.find((floater) => floater.id === friendId)?.kind
        announce(`${kind ? FRIEND_NAMES[kind] : 'なかま'}が なかまに なったよ！`, true)
        playPukupukaActionSound('join')
      } else if (rung) {
        announce('カラーン！ さくが あいたよ', true)
        playPukupukaActionSound('bell')
      } else if (slid) {
        announce('すべりだい！ しゅーっ', true)
        playPukupukaActionSound('slide')
      } else if (launched) {
        announce('ぴゅーっ！ とんだ！', true)
      } else if (collected) {
        announce('キラキラ！ ほしを みつけた！')
        playPukupukaActionSound('board')
      } else if (arrivedEarly) {
        announce('まだ なかまが まってるよ', true)
      }
      if (splashed && !rescued) playPukupukaActionSound('splash')
      if (result.goalReached) {
        setControl(null)
        setToast(null)
        playPukupukaGoalSound()
        setProgress((current) => {
          const nextProgress = { ...current, [stage.id]: Math.max(current[stage.id] ?? 0, next.collectedStarIds.length) }
          saveRescueProgress(nextProgress)
          return nextProgress
        })
      }
      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      controlRef.current = null
    }
  }, [selectedStageId, stage, setControl, announce])

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
    // 波は隊長（アヒル）を運ぶ。仲間は隊長のあとをついてくる。
    const target = getFloater(stateRef.current, leaderIdOf(stage))
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
    setControl(null)
    stateRef.current = initial
    setGameState(initial)
    setFeedback('たすけて！')
    setToast(null)
  }

  const handleWhale = () => {
    const current = stateRef.current
    if (current.phase !== 'playing' || !stage.whale) return
    const next = triggerWhale(stage, current)
    if (next === current) return
    primeAudio()
    playPukupukaActionSound('whale')
    setFeedback('くじらの しおふき！')
    stateRef.current = next
    setGameState(next)
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
  const faucetOn = activeControl === 'fill'
  const friendIds = friendIdsOf(stage)
  const isLastStage = PUKUPUKA_STAGES.at(-1)?.id === selectedStageId

  return (
    <main className={styles.page} data-testid="pukupuka-play">
      <header className={styles.header}>
        <GameBackButton onBack={handleBackToSelection} label="ステージ選択へもどる" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🛟</span> ぷかぷかレスキュー
        </h1>
        <button type="button" className={styles.reset} onClick={handleReset} aria-label="やりなおし">↻</button>
      </header>

      <p className={styles.instruction} role="status" aria-live="polite">
        {cleared ? 'ゴール！ みんなを たすけたよ' : `${stage.name}：${stage.hint}`}
      </p>

      <div className={styles.stageArea}>
        <div className={styles.rescueStatus} role="status" aria-label={`なかま ${gameState.rescuedIds.length} / ${friendIds.length} たすけた`}>
          {friendIds.map((friendId) => {
            const kind = stage.floaters.find((floater) => floater.id === friendId)?.kind ?? 'chick'
            const saved = gameState.rescuedIds.includes(friendId)
            return (
              <span key={friendId} className={`${styles.friendChip} ${saved ? styles.rescuedFriend : ''}`} data-saved={saved}>
                <FriendIcon kind={kind} />
                {saved ? <span className={styles.friendCheck} aria-hidden="true">✓</span> : null}
              </span>
            )
          })}
          <span className={styles.starScore} aria-label={`ほし ${gameState.collectedStarIds.length} / ${stage.stars?.length ?? 0}`}>
            {'★'.repeat(gameState.collectedStarIds.length)}{'☆'.repeat((stage.stars?.length ?? 0) - gameState.collectedStarIds.length)}
          </span>
        </div>
        {toast && !cleared ? <div key={toast.id} className={styles.toast} aria-hidden="true">{toast.text}</div> : null}
        <PukupukaStage
          stage={stage}
          state={gameState}
          onWave={handleWave}
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
          onWhaleTap={handleWhale}
        />
        {!cleared ? <div className={styles.waveButtons}>
          <button type="button" onClick={() => nudge(-1)} aria-label="ひだりへ なみ">🌊 ←</button>
          <button type="button" onClick={() => nudge(1)} aria-label="みぎへ なみ">→ 🌊</button>
        </div> : null}
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

      {cleared ? <div className={styles.finishActions}>
        <button type="button" className={styles.nextStage} onClick={handleNextStage}>
          {isLastStage ? 'ステージをえらぶ' : 'つぎのステージ'}
        </button>
      </div> : null}

    </main>
  )
}
