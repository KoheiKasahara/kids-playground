import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { isSoundEnabled, primeAudio, setSoundEnabled } from '../../audio/sound'
import { INITIAL_SNAPSHOT, useSnowballEngine } from './useSnowballEngine'
import { ITEM_TYPES } from './snowballWorld'
import styles from './SnowballRoll.module.css'

function SnowballGame({ onBack, onRestart }: { onBack: () => void; onRestart: () => void }) {
  const [snapshot, setSnapshot] = useState(INITIAL_SNAPSHOT)
  const [sound, setSound] = useState(isSoundEnabled)
  const { registerContainer, status, directionRef } = useSnowballEngine(setSnapshot)
  const pointer = useRef<{ id: number; x: number; y: number } | null>(null)
  const keys = useRef(new Set<string>())
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null)
  useEffect(() => {
    const clear = () => {
      pointer.current = null
      keys.current.clear()
      directionRef.current = { x: 0, z: 0 }
      setStick(null)
    }
    window.addEventListener('blur', clear)
    document.addEventListener('visibilitychange', clear)
    return () => {
      window.removeEventListener('blur', clear)
      document.removeEventListener('visibilitychange', clear)
    }
  }, [directionRef])
  const stop = () => {
    pointer.current = null
    keys.current.clear()
    directionRef.current = { x: 0, z: 0 }
    setStick(null)
  }
  function down(event: PointerEvent<HTMLDivElement>) {
    if (status !== 'ready' || snapshot.won || pointer.current || event.button !== 0) return
    primeAudio()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    pointer.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
    const rect = event.currentTarget.getBoundingClientRect()
    setStick({ x: event.clientX - rect.left, y: event.clientY - rect.top, dx: 0, dy: 0 })
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    const dx = event.clientX - pointer.current.x
    const dy = event.clientY - pointer.current.y
    const distance = Math.hypot(dx, dy)
    const scale = Math.max(48, distance)
    directionRef.current = distance < 5 ? { x: 0, z: 0 } : { x: dx / scale, z: dy / scale }
    setStick(current => current && { ...current, dx: dx / scale * 38, dy: dy / scale * 38 })
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (!pointer.current || pointer.current.id !== event.pointerId) return
    stop()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function key(event: KeyboardEvent<HTMLDivElement>, pressed: boolean) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    if (status !== 'ready' || snapshot.won) return
    if (pressed) { primeAudio(); keys.current.add(event.key) } else keys.current.delete(event.key)
    directionRef.current = {
      x: Number(keys.current.has('ArrowRight')) - Number(keys.current.has('ArrowLeft')),
      z: Number(keys.current.has('ArrowDown')) - Number(keys.current.has('ArrowUp')),
    }
  }
  return <GamePlaySurface>
    <main className={styles.game}>
      <header className={styles.header}>
        <GameBackButton onBack={onBack} />
        <h1>ゆきだまころころ</h1>
        <button className={styles.sound} type="button" aria-label="こうかおん" aria-pressed={sound} onClick={() => { setSoundEnabled(!sound); setSound(!sound) }}>{sound ? '🔊' : '🔇'}</button>
      </header>
      <div className={styles.hud}>
        <span aria-hidden="true">❄️</span>
        <div role="progressbar" aria-label="ゆきだまの おおきさ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(snapshot.progress * 100)} className={styles.meter}>
          <div style={{ width: `${snapshot.progress * 100}%` }} />
        </div>
        <span className={styles.count}>{snapshot.count}こ</span>
      </div>
      <div className={styles.sceneWrap}>
        <div ref={registerContainer} className={styles.scene} tabIndex={0} role="application" aria-label="ゆきの ひろば。ドラッグか やじるしキーで ころがすよ" onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end} onKeyDown={event => key(event, true)} onKeyUp={event => key(event, false)} onBlur={stop}>
          {stick && <div className={styles.stick} style={{ left: stick.x, top: stick.y }} aria-hidden="true"><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></div>}
        </div>
        {status !== 'ready' && <div className={styles.overlay} role={status === 'error' ? 'alert' : 'status'}>
          <p>{status === 'error' ? '3Dを ひょうじできなかったよ' : 'ゆきの ひろばを じゅんびちゅう…'}</p>
          {status === 'error' && <button type="button" onClick={onRestart}>もういちど</button>}
        </div>}
        {snapshot.won && status === 'ready' && <section className={`${styles.overlay} ${styles.result}`} aria-label="だいせいこう">
          <div className={styles.winIcon} aria-hidden="true">🎉 ❄️ 🎉</div>
          <h2>だいせいこう！</h2>
          <p>{snapshot.count}こ くっついたよ！</p>
          <button type="button" autoFocus onClick={onRestart}>もういっかい あそぶ</button>
        </section>}
        {!snapshot.won && status === 'ready' && <div className={styles.instructions} aria-hidden="true">☝️ さわって うごかそう</div>}
      </div>
      <footer className={styles.footer}>
        <p role="status">{snapshot.message}</p>
        {!snapshot.won && <small>{snapshot.next ? <>おおきくなったら {ITEM_TYPES[snapshot.next].emoji} {ITEM_TYPES[snapshot.next].label}</> : '🚙 くるまも あつめよう！'}</small>}
      </footer>
    </main>
  </GamePlaySurface>
}

export default function SnowballRoll() {
  const [playing, setPlaying] = useState(false)
  const [round, setRound] = useState(0)
  useGameIntroPlaying(playing)
  if (playing) return <SnowballGame key={round} onBack={() => setPlaying(false)} onRestart={() => setRound(value => value + 1)} />
  return <main className={styles.start}>
    <header><GameBackButton to="/" /></header>
    <div className={styles.hero} aria-hidden="true">❄️</div>
    <h1>ゆきだまころころ</h1>
    <p>ころころ、ぺたっ！<br />どんどん おおきく しよう</p>
    <div className={styles.items} aria-hidden="true">🌰 → 🎁 → ⛄ → 🌲 → 🚙</div>
    <button type="button" className={styles.startButton} onClick={() => { primeAudio(); window.scrollTo(0, 0); setPlaying(true) }}>▶ あそぶ</button>
    <small>じかんせいげん なし。ゆっくりで いいよ</small>
  </main>
}
