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
  toggleDrain,
  toggleGate,
  waterRatioOf,
  type PukupukaGameState,
  type WaterControl,
} from './pukupukaGame'
import { playPukupukaGoalSound, playPukupukaWaterSound, primeAudio } from '../../utils/quizSound'
import styles from './PukupukaRescuePlay.module.css'

/**
 * ぷかぷかレスキュー（Issue #514 Phase 1 / #515 じゃぐち / #516 せん・排水 / #517 ゲート）。
 *
 * 画面の役割はこの3つだけに絞っている。
 *  1. requestAnimationFrame でゲームを進める
 *  2. じゃぐち・せん・ゲートの操作を水位・通路の入力に変える
 *  3. ゲーム状態をSVGへ渡す
 *
 * 水位・浮力・ゴール判定・ゲートの当たり判定はすべて pukupukaGame.ts 側の純粋な関数が持つため、
 * 後続の機能追加でも、この画面の入力部分だけを直せばよい。
 */
export default function PukupukaRescuePlay() {
  const navigate = useNavigate()
  const stage = PUKUPUKA_STAGE
  const bodyId = primaryWaterBodyId(stage)

  const [gameState, setGameState] = useState<PukupukaGameState>(() => createInitialState(stage))
  // ループの中では常に最新の状態が必要なため、描画用のstateとは別にrefでも持つ。
  const stateRef = useRef(gameState)
  // じゃぐちを押している間だけ 'fill'。せん(drainOpen)はgameState側の状態でそのまま扱う。
  const controlRef = useRef<WaterControl>(null)
  // じゃぐちの見た目（ハンドル色・水の線）を更新するための、操作中の入力の描画用コピー。
  // controlRefだけだとrefの変更では再描画されないため、押下/解放のタイミングでここも合わせて更新する。
  const [activeControl, setActiveControl] = useState<WaterControl>(null)

  const setControl = useCallback((next: WaterControl) => {
    controlRef.current = next
    setActiveControl(next)
  }, [])

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
        // ゴール達成時、じゃぐちを押したままでも見た目（ハンドル・水の線）を即座にOFFへ戻す。
        // 指を離すまで待つと、離すまでの一瞬だけ「注水中」の絵が残ってしまうため。
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
  }, [stage, setControl])

  // ボタン・じゃぐちの外で指を離した場合にも押しっぱなしを必ず解除する。
  useEffect(() => {
    const stop = () => {
      setControl(null)
    }
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
    }
  }, [setControl])

  const changeWater = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'playing') return
    primeAudio()
    playPukupukaWaterSound('fill')
    const next = applyWaterTap(stage, current)
    stateRef.current = next
    setGameState(next)
  }, [stage])

  /** じゃぐちを指で押しはじめ: 1回ぶんをすぐ足したうえで、押しているあいだ注水し続ける。 */
  const startFaucetHold = () => {
    setControl('fill')
    changeWater()
  }

  const stopFaucetHold = () => {
    setControl(null)
  }

  /** キーボード（Enter / Space）での操作。押しっぱなしにはせず1回ぶんだけ動かす。 */
  const tapFaucet = () => {
    changeWater()
  }

  /** せんのタップ操作: 開⇔閉を切り替える。開いている間は毎フレーム自動で水位が下がる。 */
  const handleDrainToggle = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'playing') return
    primeAudio()
    const next = toggleDrain(current)
    if (next.drainOpen) playPukupukaWaterSound('drain')
    stateRef.current = next
    setGameState(next)
  }, [])

  /** ゲートのタップ操作: 開⇔閉を切り替える。開いている間は水位に関わらず通り抜けられる。 */
  const handleGateToggle = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'playing') return
    primeAudio()
    const next = toggleGate(current)
    playPukupukaWaterSound(next.gateOpen ? 'fill' : 'drain')
    stateRef.current = next
    setGameState(next)
  }, [])

  const handleReset = () => {
    const initial = createInitialState(stage)
    setControl(null)
    stateRef.current = initial
    setGameState(initial)
  }

  const cleared = gameState.phase === 'cleared'
  const waterRatio = waterRatioOf(stage, gameState, bodyId)
  const waterPercent = Math.round(waterRatio * 100)
  const faucetOn = activeControl === 'fill'

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
        />
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

      <div className={styles.footer}>
        <button type="button" className={styles.reset} onClick={handleReset}>
          やりなおし
        </button>
      </div>
    </main>
  )
}
