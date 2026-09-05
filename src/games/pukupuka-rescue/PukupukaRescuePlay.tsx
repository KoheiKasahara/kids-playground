import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PukupukaStage from './PukupukaStage'
import { PUKUPUKA_STAGE } from './stageDefinitions'
import {
  applyWaterTap,
  createInitialState,
  isSettled,
  primaryWaterBodyId,
  stepGame,
  waterRatioOf,
  type PukupukaGameState,
  type WaterControl,
} from './pukupukaGame'
import { playPukupukaGoalSound, playPukupukaWaterSound, primeAudio } from '../../utils/quizSound'
import styles from './PukupukaRescuePlay.module.css'

type WaterButtonProps = {
  direction: 'fill' | 'drain'
  emoji: string
  label: string
  variantClassName: string
  disabled: boolean
  onHoldStart: (direction: 'fill' | 'drain') => void
  onHoldEnd: () => void
  onTap: (direction: 'fill' | 'drain') => void
}

/**
 * 「みずを ふやす / へらす」のボタン。
 * 押しっぱなしで出し続けられるようポインタで扱いつつ、キーボード操作（Enter / Space）でも
 * 1回ぶん動くように click を併用する。二重に動かないよう、直前がポインタ操作かを覚えておく。
 */
function WaterButton({
  direction,
  emoji,
  label,
  variantClassName,
  disabled,
  onHoldStart,
  onHoldEnd,
  onTap,
}: WaterButtonProps) {
  const pointerActivatedRef = useRef(false)

  const handlePointerDown = () => {
    pointerActivatedRef.current = true
    onHoldStart(direction)
  }

  const handleClick = () => {
    if (pointerActivatedRef.current) {
      pointerActivatedRef.current = false
      return
    }
    onTap(direction)
  }

  return (
    <button
      type="button"
      className={`${styles.waterButton} ${variantClassName}`}
      disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerUp={onHoldEnd}
      onPointerLeave={onHoldEnd}
      onPointerCancel={onHoldEnd}
      onClick={handleClick}
    >
      <span className={styles.waterButtonEmoji} aria-hidden="true">
        {emoji}
      </span>
      {label}
    </button>
  )
}

/**
 * ぷかぷかレスキュー（Issue #514 Phase 1）。
 *
 * 画面の役割はこの3つだけに絞っている。
 *  1. requestAnimationFrame でゲームを進める
 *  2. ボタンの押下を「みずをふやす / へらす」という入力に変える
 *  3. ゲーム状態をSVGへ渡す
 *
 * 水位・浮力・ゴール判定はすべて pukupukaGame.ts 側の純粋な関数が持つため、
 * じゃぐち(#515)や排水(#516)へ操作を差し替えるときも、この画面の入力部分だけを直せばよい。
 */
export default function PukupukaRescuePlay() {
  const navigate = useNavigate()
  const stage = PUKUPUKA_STAGE
  const bodyId = primaryWaterBodyId(stage)

  const [gameState, setGameState] = useState<PukupukaGameState>(() => createInitialState(stage))
  // ループの中では常に最新の状態が必要なため、描画用のstateとは別にrefでも持つ。
  const stateRef = useRef(gameState)
  const controlRef = useRef<WaterControl>(null)

  useEffect(() => {
    let frameId: number | null = null
    let previous = performance.now()

    const frame = (now: number) => {
      const delta = now - previous
      previous = now
      const control = controlRef.current
      const result = stepGame(stage, stateRef.current, delta, control)
      stateRef.current = result.state
      // 水も浮遊物も止まっていて操作もされていないときは、同じ絵を描き直さない
      // （置きっぱなしのスマホで毎フレーム再描画し続けないようにするため）。
      if (result.goalReached || control !== null || !isSettled(stage, result.state)) {
        setGameState(result.state)
      }
      if (result.goalReached) {
        controlRef.current = null
        playPukupukaGoalSound()
      }
      frameId = requestAnimationFrame(frame)
    }

    frameId = requestAnimationFrame(frame)
    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      controlRef.current = null
    }
  }, [stage])

  // ボタンの外で指を離した場合にも押しっぱなしを必ず解除する。
  useEffect(() => {
    const stop = () => {
      controlRef.current = null
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [])

  const changeWater = useCallback(
    (direction: 'fill' | 'drain') => {
      const current = stateRef.current
      if (current.phase !== 'playing') return
      primeAudio()
      playPukupukaWaterSound(direction)
      const next = applyWaterTap(stage, current, direction)
      stateRef.current = next
      setGameState(next)
    },
    [stage],
  )

  /** 指で押しはじめ: 1回ぶんをすぐ足したうえで、押しているあいだ増減し続ける。 */
  const startWaterHold = (direction: 'fill' | 'drain') => {
    controlRef.current = direction
    changeWater(direction)
  }

  const stopWaterHold = () => {
    controlRef.current = null
  }

  /** キーボード（Enter / Space）での操作。押しっぱなしにはせず1回ぶんだけ動かす。 */
  const tapWater = (direction: 'fill' | 'drain') => {
    changeWater(direction)
  }

  const handleReset = () => {
    const initial = createInitialState(stage)
    controlRef.current = null
    stateRef.current = initial
    setGameState(initial)
  }

  const cleared = gameState.phase === 'cleared'
  const waterRatio = waterRatioOf(stage, gameState, bodyId)
  const waterPercent = Math.round(waterRatio * 100)

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          ← もどる
        </button>
        <h1 className={styles.title}>
          <span aria-hidden="true">🛟</span> ぷかぷかレスキュー
        </h1>
      </header>

      <p className={styles.instruction} role="status" aria-live="polite">
        {cleared ? 'ゴール！ アヒルを たすけたよ' : stage.hint}
      </p>

      <div className={styles.stageArea}>
        <PukupukaStage stage={stage} state={gameState} />
        {cleared ? (
          <div className={styles.clearBanner}>
            <span className={styles.clearEmoji} aria-hidden="true">
              🎉
            </span>
            <span className={styles.clearText}>ゴール！</span>
          </div>
        ) : null}
      </div>

      <div className={styles.gauge}>
        <span className={styles.gaugeLabel} aria-hidden="true">
          💧
        </span>
        <span className={styles.gaugeTrack}>
          <span
            className={styles.gaugeFill}
            style={{ width: `${waterPercent}%` }}
            data-testid="pukupuka-gauge-fill"
            data-water-percent={waterPercent}
          />
        </span>
      </div>

      <div className={styles.controls}>
        <WaterButton
          direction="fill"
          emoji="💧"
          label="みずを ふやす"
          variantClassName={styles.waterButtonFill}
          disabled={cleared}
          onHoldStart={startWaterHold}
          onHoldEnd={stopWaterHold}
          onTap={tapWater}
        />
        <WaterButton
          direction="drain"
          emoji="🕳️"
          label="みずを へらす"
          variantClassName={styles.waterButtonDrain}
          disabled={cleared}
          onHoldStart={startWaterHold}
          onHoldEnd={stopWaterHold}
          onTap={tapWater}
        />
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.reset} onClick={handleReset}>
          やりなおし
        </button>
      </div>
    </main>
  )
}
