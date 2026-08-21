import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { playCorrectSound, primeAudio } from '../../utils/quizSound'
import VirtualStick from './VirtualStick'
import { useMazeEngine } from './useMazeEngine'
import { isTiltKeyCode, tiltFromPressedKeys, type TiltInput } from './tiltInput'
import styles from './FlagRollMazePlay.module.css'

type MazeGameState = 'playing' | 'goal'

/**
 * こっきころころめいろ Phase 1のプレイ画面。
 *
 * 傾き入力の出どころ（スティック / 矢印キー）はここで束ね、
 * エンジンへは TiltInput だけを渡す。Phase 2でジャイロを足すときも、
 * ここに入力源をもう1つ増やすだけで済む。
 */
export default function FlagRollMazePlay() {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<MazeGameState>('playing')
  const [runId, setRunId] = useState(0)
  const [rescued, setRescued] = useState(false)
  const rescueTimerRef = useRef<number | null>(null)
  const audioPrimedRef = useRef(false)

  const handleGoal = useCallback(() => {
    setGameState('goal')
    playCorrectSound()
  }, [])

  // 場外復帰は一瞬だけ知らせる。ゲームは止めず、遊びの流れを切らない。
  const handleRescue = useCallback(() => {
    setRescued(true)
    if (rescueTimerRef.current !== null) window.clearTimeout(rescueTimerRef.current)
    rescueTimerRef.current = window.setTimeout(() => setRescued(false), 1600)
  }, [])

  const { registerContainer, setTilt, resetBallToStart } = useMazeEngine({
    runId,
    onGoal: handleGoal,
    onRescue: handleRescue,
  })

  useEffect(
    () => () => {
      if (rescueTimerRef.current !== null) window.clearTimeout(rescueTimerRef.current)
    },
    [],
  )

  // ゴール後はスティックもキーも受け付けず、その場で止まるようにする。
  const acceptsInput = gameState === 'playing'

  const handleTiltChange = useCallback(
    (tilt: TiltInput) => {
      // 最初にスティックへ触れた瞬間はユーザー操作なので、ここで音を解禁する。
      if (!audioPrimedRef.current) {
        audioPrimedRef.current = true
        primeAudio()
      }
      setTilt(tilt)
    },
    [setTilt],
  )

  // PCでも遊べるように矢印キー・WASDを同じTiltInputへ流し込む。
  useEffect(() => {
    if (!acceptsInput) return
    const pressed = new Set<string>()

    const publish = () => setTilt(tiltFromPressedKeys(pressed))

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTiltKeyCode(event.code)) return
      // 矢印キーでページがスクロールしないようにする。
      event.preventDefault()
      if (pressed.has(event.code)) return
      pressed.add(event.code)
      publish()
    }
    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isTiltKeyCode(event.code)) return
      pressed.delete(event.code)
      publish()
    }
    // タブを離れた間に押しっぱなしになるのを防ぐ。
    const handleBlur = () => {
      if (pressed.size === 0) return
      pressed.clear()
      publish()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleBlur)
      if (pressed.size > 0) setTilt({ x: 0, y: 0 })
    }
  }, [acceptsInput, setTilt])

  /** ボールだけをスタートへ戻す。世界を作り直さないので待ち時間がない。 */
  const handleBackToStart = () => {
    setTilt({ x: 0, y: 0 })
    resetBallToStart()
  }

  /** ゴール後の「もういちど」。物理世界ごと作り直して最初の状態に揃える。 */
  const handleRetry = () => {
    primeAudio()
    setTilt({ x: 0, y: 0 })
    setRescued(false)
    setGameState('playing')
    setRunId((current) => current + 1)
  }

  return (
    <main className={styles.page}>
      <div ref={registerContainer} className={styles.scene} aria-hidden="true" />

      <div className={styles.ui}>
        <h1 className={styles.title}>こっきころころめいろ</h1>

        {gameState === 'playing' ? (
          <p className={styles.instruction}>
            スティックを うごかして、きいろの ゴールまで ボールを ころがそう！
          </p>
        ) : (
          <p className={styles.result} role="status" aria-live="polite">
            ゴール！ すごい！
          </p>
        )}

        <p className={styles.rescue} role="status" aria-live="polite">
          {rescued ? 'スタートに もどったよ' : ''}
        </p>
      </div>

      <div className={styles.controls}>
        <div className={styles.stickArea}>
          <VirtualStick onTiltChange={handleTiltChange} disabled={!acceptsInput} />
        </div>

        <div className={styles.actions}>
          {gameState === 'goal' ? (
            <button
              type="button"
              className={`${styles.button} ${styles.retry}`}
              onClick={handleRetry}
            >
              もういちど
            </button>
          ) : (
            <button
              type="button"
              className={`${styles.button} ${styles.rescueButton}`}
              onClick={handleBackToStart}
            >
              スタートに もどる
            </button>
          )}
          <button type="button" className={styles.button} onClick={() => navigate('/')}>
            もどる
          </button>
        </div>
      </div>

      <p className={styles.keyboardHint}>
        パソコンでは やじるしキー でも あそべます
      </p>
    </main>
  )
}
