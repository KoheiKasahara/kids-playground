import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findFlagBall, type FlagBallData } from '../../components/flag-ball/flagBalls'
import { playCorrectSound, primeAudio } from '../../utils/quizSound'
import VirtualStick from './VirtualStick'
import { parseMazePlayState } from './playState'
import { useMazeEngine } from './useMazeEngine'
import { findMazeStageDefinition, nextMazeStageId } from './mazeStages'
import {
  DEFAULT_MAZE_ZOOM_INDEX,
  MAX_MAZE_ZOOM_INDEX,
  MIN_MAZE_ZOOM_INDEX,
} from './mazeCamera'
import { isTiltKeyCode, tiltFromPressedKeys, type TiltInput } from './tiltInput'
import {
  calibrateDeviceTilt,
  deviceTiltToInput,
  getScreenOrientationAngle,
  supportsDeviceOrientation,
  type DeviceTiltCalibration,
} from './deviceTilt'
import {
  lockCurrentScreenOrientation,
  unlockScreenOrientation,
  type OrientationController,
} from './orientationLock'
import styles from './FlagRollMazePlay.module.css'

type MazeGameState = 'playing' | 'goal'

/**
 * こっきころころめいろのプレイ画面。
 *
 * 傾き入力の出どころ（スティック / 矢印キー）はここで束ね、
 * エンジンへは TiltInput だけを渡す。Phase 2でジャイロを足すときも、
 * ジャイロも同じ入力型へ変換し、物理エンジンを入力端末から独立させている。
 */
export default function FlagRollMazePlay() {
  const location = useLocation()
  const playState = parseMazePlayState(location.state)

  if (!playState) {
    return <Navigate to="/games/flag-roll-maze" replace />
  }

  const flag = findFlagBall(playState.flagId)
  if (!flag) {
    return <Navigate to="/games/flag-roll-maze" replace />
  }

  // stateが差し替わったときもエンジンの世界・入力を確実に初期化する。
  return <MazeGame key={location.key} flag={flag} initialStageId={playState.stageId} />
}

function MazeGame({ flag, initialStageId }: { flag: FlagBallData; initialStageId: string }) {
  const navigate = useNavigate()
  const [gameState, setGameState] = useState<MazeGameState>('playing')
  const [runId, setRunId] = useState(0)
  const [stageId, setStageId] = useState(initialStageId)
  const [rescueMessage, setRescueMessage] = useState('')
  const rescueTimerRef = useRef<number | null>(null)
  const audioPrimedRef = useRef(false)
  const calibrationRef = useRef<DeviceTiltCalibration | null>(null)
  const [inputMode, setInputMode] = useState<'stick' | 'gyro'>('stick')
  // 端末の大きさや持ち方で好みが分かれるので、遊びながら距離だけを選べるようにする。
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_MAZE_ZOOM_INDEX)
  const [gyroMessage, setGyroMessage] = useState('')
  const stageDefinition = findMazeStageDefinition(stageId)
  const followingStageId = nextMazeStageId(stageId)

  const handleGoal = useCallback(() => {
    setGameState('goal')
    playCorrectSound()
  }, [])

  // 場外復帰は一瞬だけ知らせる。ゲームは止めず、遊びの流れを切らない。
  const handleRescue = useCallback((reason?: 'hole' | 'outOfBounds' | 'stuck') => {
    setRescueMessage(reason === 'hole' ? 'あなに おちた！ もどるよ' : 'スタートに もどったよ')
    if (rescueTimerRef.current !== null) window.clearTimeout(rescueTimerRef.current)
    rescueTimerRef.current = window.setTimeout(() => setRescueMessage(''), 1600)
  }, [])

  const { registerContainer, setTilt, resetBallToStart, setZoomIndex: applyZoomIndex } = useMazeEngine({
    runId,
    flag,
    stageId,
    onGoal: handleGoal,
    onRescue: handleRescue,
  })

  useEffect(
    () => () => {
      if (rescueTimerRef.current !== null) window.clearTimeout(rescueTimerRef.current)
    },
    [],
  )

  // ズームはエンジンのカメラ距離だけに効く。物理も入力も再構築しない。
  useEffect(() => {
    applyZoomIndex(zoomIndex)
  }, [applyZoomIndex, zoomIndex])

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
      setInputMode('stick')
      setGyroMessage('')
    },
    [setTilt],
  )

  const startGyro = useCallback(async () => {
    primeAudio()
    const OrientationEvent = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    if (!supportsDeviceOrientation()) {
      setGyroMessage('ゆびで あそぼう')
      return
    }
    if (typeof OrientationEvent.requestPermission === 'function') {
      try {
        if ((await OrientationEvent.requestPermission()) !== 'granted') {
          setGyroMessage('ゆびで あそぼう')
          return
        }
      } catch {
        setGyroMessage('ゆびで あそぼう')
        return
      }
    }
    calibrationRef.current = null
    setInputMode('gyro')
    setGyroMessage('スマホを かたむけて あそぼう')
    void lockCurrentScreenOrientation(window.screen.orientation as unknown as OrientationController)
  }, [])

  useEffect(() => {
    if (!acceptsInput || inputMode !== 'gyro') return
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.beta === null || event.gamma === null) return
      const reading = { beta: event.beta, gamma: event.gamma }
      const angle = getScreenOrientationAngle()
      if (calibrationRef.current === null) calibrationRef.current = calibrateDeviceTilt(reading, angle)
      setTilt(deviceTiltToInput(reading, angle, calibrationRef.current))
    }
    window.addEventListener('deviceorientation', handleOrientation)
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation)
      setTilt({ x: 0, y: 0 })
    }
  }, [acceptsInput, inputMode, setTilt])

  useEffect(() => {
    if (!acceptsInput || inputMode !== 'gyro') return
    const recalibrate = () => {
      calibrationRef.current = null
      setTilt({ x: 0, y: 0 })
    }
    window.screen.orientation?.addEventListener('change', recalibrate)
    window.addEventListener('orientationchange', recalibrate)
    return () => {
      window.screen.orientation?.removeEventListener('change', recalibrate)
      window.removeEventListener('orientationchange', recalibrate)
      unlockScreenOrientation(window.screen.orientation as unknown as OrientationController)
    }
  }, [acceptsInput, inputMode, setTilt])

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

  /** 同じステージのやり直しと次のステージへの移動を、同じ新しい開始状態へそろえる。 */
  const restartRun = useCallback((nextStageId: string) => {
    primeAudio()
    setTilt({ x: 0, y: 0 })
    setRescueMessage('')
    setGameState('playing')
    setStageId(nextStageId)
    setRunId((current) => current + 1)
    if (inputMode === 'gyro') {
      calibrationRef.current = null
      void lockCurrentScreenOrientation(window.screen.orientation as unknown as OrientationController)
    }
  }, [inputMode, setTilt])

  /** ゴール後の「もういちど」。物理世界ごと作り直して最初の状態に揃える。 */
  const handleRetry = () => restartRun(stageId)

  const handleNextStage = () => {
    if (followingStageId === null) return
    restartRun(followingStageId)
  }

  return (
    <main className={styles.page}>
      <div className={styles.scene}>
        <div ref={registerContainer} className={styles.sceneCanvas} aria-hidden="true" />
        <div className={styles.zoom}>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="もっと ちかづく"
            onClick={() => setZoomIndex((index) => Math.min(MAX_MAZE_ZOOM_INDEX, index + 1))}
            disabled={zoomIndex >= MAX_MAZE_ZOOM_INDEX}
          >
            <span aria-hidden="true">＋</span>
          </button>
          <button
            type="button"
            className={styles.zoomButton}
            aria-label="もっと はなれる"
            onClick={() => setZoomIndex((index) => Math.max(MIN_MAZE_ZOOM_INDEX, index - 1))}
            disabled={zoomIndex <= MIN_MAZE_ZOOM_INDEX}
          >
            <span aria-hidden="true">−</span>
          </button>
        </div>
      </div>

      <div className={styles.ui}>
        <h1 className={styles.title}>こっきころころめいろ</h1>
        {stageDefinition !== null && (
          <p className={styles.stageBadge}>
            {stageDefinition.emoji} {stageDefinition.nameJa}
          </p>
        )}

        {gameState === 'playing' ? (
          <p className={styles.instruction}>
            {inputMode === 'gyro'
              ? 'スマホを かたむけて、きいろの ゴールまで ボールを ころがそう！'
              : 'スティックを うごかして、きいろの ゴールまで ボールを ころがそう！'}
          </p>
        ) : (
          <>
            <p className={styles.result} role="status" aria-live="polite">
              ゴール！ すごい！
            </p>
            <div className={styles.resultPanel} aria-label="ゴールした こっき">
              <FlagBall flag={flag} size={72} />
              <span className={styles.resultName}>{flag.nameJa}</span>
            </div>
          </>
        )}

        <p className={styles.rescue} role="status" aria-live="polite">
          {rescueMessage}
        </p>

        <p className={styles.keyboardHint}>
          {gyroMessage || 'パソコンでは やじるしキー でも あそべます'}
        </p>
      </div>

      <div className={styles.controls}>
        {gameState === 'playing' && inputMode === 'stick' && (
          <button type="button" className={styles.gyroButton} onClick={startGyro}>
            スマホを かたむけて あそぶ
          </button>
        )}
        {gameState === 'playing' && inputMode === 'gyro' && (
          <p className={styles.gyroStatus}>📱 かたむけ操作中</p>
        )}
        <div className={styles.stickArea}>
          <VirtualStick onTiltChange={handleTiltChange} disabled={!acceptsInput} />
        </div>

        <div className={styles.actions}>
          {gameState === 'goal' ? (
            <>
              {followingStageId !== null && (
                <button
                  type="button"
                  className={`${styles.button} ${styles.nextStage}`}
                  onClick={handleNextStage}
                >
                  つぎの ステージ
                </button>
              )}
              <button
                type="button"
                className={`${styles.button} ${styles.retry}`}
                onClick={handleRetry}
              >
                もういちど
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => navigate('/games/flag-roll-maze', { replace: true })}
              >
                えらびなおす
              </button>
            </>
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

    </main>
  )
}
