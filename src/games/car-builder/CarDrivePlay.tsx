/**
 * つくった車を走らせる画面。
 *
 * カスタマイズ状態（CarConfig）は「3Dクルマづくり」側が持ち、ここは受け取るだけ。
 * 3Dの組み立てと走行は useCarDriveScene が受け持ち、この画面はカメラ・加速・
 * 一時停止のUIと、周回数の表示だけを持つ。
 */
import { useCallback, useEffect, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import type { CarConfig } from './carConfig'
import { DRIVE_COURSE } from './driveCourse'
import { playDriveBoostSound } from './sounds'
import {
  useCarDriveScene,
  type CarDriveCameraMode,
  type CarDriveSceneStatus,
} from './useCarDriveScene'
import styles from './CarDrivePlay.module.css'

type Props = {
  config: CarConfig
  /** つくりかえ画面へ戻す。 */
  onBack: () => void
}

const CAMERA_BUTTONS: readonly { mode: CarDriveCameraMode; label: string; icon: string }[] = [
  { mode: 'chase', label: 'おいかける', icon: '🚗' },
  { mode: 'trackside', label: 'みちばた', icon: '👀' },
  { mode: 'overview', label: 'ぜんたい', icon: '🗺️' },
]

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false
}

export default function CarDrivePlay({ config, onBack }: Props) {
  const [cameraMode, setCameraMode] = useState<CarDriveCameraMode>(() =>
    prefersReducedMotion() ? 'trackside' : 'chase',
  )
  const [status, setStatus] = useState<CarDriveSceneStatus>('loading')
  const [paused, setPaused] = useState(false)
  const [laps, setLaps] = useState(0)
  const [boostFeedback, setBoostFeedback] = useState(0)

  const handleStatus = useCallback((next: CarDriveSceneStatus) => setStatus(next), [])
  const handleLap = useCallback((next: number) => setLaps(next), [])

  const { registerContainer, boost, retry } = useCarDriveScene({
    config,
    running: status === 'ready' && !paused,
    cameraMode,
    onStatusChange: handleStatus,
    onLapChange: handleLap,
  })

  useEffect(() => {
    if (boostFeedback === 0) return undefined
    const timeout = window.setTimeout(() => setBoostFeedback(0), 420)
    return () => window.clearTimeout(timeout)
  }, [boostFeedback])

  const handleBoost = useCallback(() => {
    boost()
    playDriveBoostSound()
    setBoostFeedback((value) => value + 1)
  }, [boost])

  const handleRetry = useCallback(() => {
    setStatus('loading')
    // 作り直したコースは1周目から始まるので、表示もそろえる。
    setLaps(0)
    retry()
  }, [retry])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton onBack={onBack} ariaLabel="クルマづくりへ もどる" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🏁</span> はしってるよ！
        </h1>
        <p className={styles.lap} aria-live="polite" aria-label={`${laps}しゅう はしったよ`}>
          <span aria-hidden="true">🏁 {laps}しゅう</span>
        </p>
      </header>

      <div
        ref={registerContainer}
        className={styles.scene}
        role="application"
        aria-label="つくった くるまが はしる 3Dコース"
      >
        {status === 'ready' ? null : (
          <div className={styles.sceneStatus} role={status === 'error' ? 'alert' : 'status'}>
            <span className={styles.sceneStatusIcon} aria-hidden="true">
              {status === 'error' ? '⚠️' : '⏳'}
            </span>
            <span>{status === 'error' ? '3Dを ひょうじできないよ' : 'コースを よういしているよ'}</span>
            {status === 'error' ? (
              <button type="button" className={styles.retryButton} onClick={handleRetry}>
                もういちど
              </button>
            ) : null}
          </div>
        )}
      </div>

      <section className={styles.panel} aria-label="はしらせる そうさ">
        <p className={styles.courseName}>
          <span aria-hidden="true">📍</span> {DRIVE_COURSE.name}
        </p>
        <div className={styles.cameraRow} role="group" aria-label="カメラを えらぶ">
          {CAMERA_BUTTONS.map((button) => (
            <button
              key={button.mode}
              type="button"
              className={styles.cameraButton}
              aria-pressed={cameraMode === button.mode}
              onClick={() => setCameraMode(button.mode)}
            >
              <span aria-hidden="true">{button.icon}</span>
              {button.label}
            </button>
          ))}
        </div>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={styles.pauseButton}
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
          >
            <span aria-hidden="true">{paused ? '▶' : '⏸'}</span> {paused ? 'はしる' : 'とまる'}
          </button>
          <button
            type="button"
            className={styles.boostButton}
            data-active={boostFeedback > 0 ? 'true' : 'false'}
            disabled={status !== 'ready' || paused}
            onClick={handleBoost}
          >
            <span aria-hidden="true">⚡</span> かそく！
          </button>
        </div>
      </section>
    </main>
  )
}
