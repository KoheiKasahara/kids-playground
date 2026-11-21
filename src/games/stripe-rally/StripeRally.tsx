import { useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { useGameInterval } from '../../utils/useGameInterval'
import { advance, grid, LAPS, position, RECHARGE, STEP } from './race'
import { drawRace, makeLoadingCircuit } from './scenery'
import { raceChime } from './sounds'
import carSheetUrl from './rally-cars.webp'
import valleyUrl from './alpine-valley.webp'
import styles from './StripeRally.module.css'

export default function StripeRally() {
  const [race, setRace] = useState(grid)
  const [started, setStarted] = useState(false)
  const [sound, toggleSound] = useSoundToggle()
  const canvas = useRef<HTMLCanvasElement>(null)
  const latestRace = useRef(race)
  const redraw = useRef<(() => void) | null>(null)
  const finished = race.distance >= LAPS
  const running = started && !finished
  useGameIntroPlaying(started)
  useGameInterval(() => setRace(advance), running ? STEP * 1000 : null)
  useEffect(() => {
    const surface = canvas.current
    const ctx = surface?.getContext('2d')
    if (!surface || !ctx) return
    let circuit: HTMLCanvasElement | HTMLImageElement = makeLoadingCircuit()
    let sprites: HTMLImageElement | null = null
    const paint = () => {
      const width = Math.max(1, Math.round(surface.clientWidth * 1.08))
      const height = Math.max(1, Math.round(surface.clientHeight * 1.08))
      if (surface.width !== width) surface.width = width
      if (surface.height !== height) surface.height = height
      drawRace(ctx, circuit, sprites, latestRace.current)
    }
    const valley = new Image()
    valley.onload = () => {
      circuit = valley
      paint()
    }
    valley.src = valleyUrl
    const cars = new Image()
    cars.onload = () => {
      sprites = cars
      paint()
    }
    cars.src = carSheetUrl
    redraw.current = paint
    const observer = new ResizeObserver(paint)
    observer.observe(surface)
    return () => {
      observer.disconnect()
      valley.onload = null
      cars.onload = null
      redraw.current = null
    }
  }, [])
  useEffect(() => {
    latestRace.current = race
    redraw.current?.()
  }, [race])
  useEffect(() => { if (finished) raceChime('finish') }, [finished])

  function reset() {
    setRace(grid())
    setStarted(false)
  }
  function drive() {
    primeAudio()
    if (!running) {
      setRace(grid())
      setStarted(true)
      raceChime('start')
    } else if (race.cooldown === 0) {
      setRace(previous => ({ ...previous, cooldown: RECHARGE }))
      raceChime('boost')
    }
  }
  const lap = Math.min(LAPS, Math.floor(race.distance) + 1)
  const rank = position(race)
  return <section className={styles.game}>
    <header className={styles.header}>
      <GameBackButton to="/" onBack={started ? reset : undefined} />
      <h1>しましまラリー</h1>
      <button onClick={toggleSound} aria-pressed={sound}>おと {sound ? '♪' : '×'}</button>
    </header>
    <div className={styles.console}>
      <div className={styles.hud}>
        <span>🏁 <b>{lap} / {LAPS}</b> しゅう</span>
        <span><b>{rank}</b> い <small>/ 3だい</small></span>
      </div>
      <div className={styles.field}>
        <canvas ref={canvas} width={288} height={208} role="img" aria-label="しましまの あおい くるまと 2だいの ライバル" />
        {finished && <div className={styles.result} role="status">
          <strong>🏁 ゴール！</strong><span>{rank}いで かんそう！</span>
        </div>}
      </div>
      <progress className={styles.progress} aria-label="ゴールまで" value={race.distance} max={LAPS} />
      <div className={styles.controls}>
        <p>{finished ? 'やったね！' : started ? 'たまったら ダッシュ！' : 'あおい くるまで はしろう'}</p>
        <button className={styles.drive} onClick={drive} aria-disabled={running && race.cooldown > 0}>
          <span className={styles.charge} style={{ width: (1 - race.cooldown / RECHARGE) * 100 + '%' }} />
          <b>{finished ? '↻ もういちど' : !started ? '▶ スタート' : race.cooldown > 0 ? 'じゅうでん中' : '⚡ ダッシュ'}</b>
        </button>
      </div>
    </div>
  </section>
}
