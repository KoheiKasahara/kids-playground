import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { primeAudio } from '../../audio/sound'
import { ToolIcon } from './PartArt'
import { partLabel } from './parts'
import { playTownSound } from './sounds'
import type { Town } from './town'
import type { VehicleKind } from './vehicles'
import { createTownScene, type TownPick, type TownSceneHandle, type VehicleCounts } from './three/townScene'
import styles from './Town3D.module.css'

// できた まちを 3D で ながめる がめん。three.js を つかうので ひらいた ときに はじめて よみこむ（React.lazy）。

type Props = {
  town: Town
  night: boolean
  onToggleNight: () => void
  sound: boolean
  onToggleSound: () => void
  onClose: () => void
}

type Status = 'loading' | 'ready' | 'error'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function pickLabel(pick: TownPick): string {
  if (pick.kind === 'vehicle') return pick.vehicle === 'car' ? 'くるま' : 'でんしゃ'
  if (pick.kind === 'ground') return pick.ground === 'water' ? 'かわ' : 'くさはら'
  const name = partLabel(pick.part)
  return pick.bridge ? `${name}の はし` : name
}

function PickIcon({ pick }: { pick: TownPick }) {
  if (pick.kind === 'vehicle') return <span className={styles.bubbleEmoji} aria-hidden="true">{pick.vehicle === 'car' ? '🚗' : '🚃'}</span>
  if (pick.kind === 'ground') return pick.ground === 'water' ? <ToolIcon tool="water" /> : <span className={styles.bubbleEmoji} aria-hidden="true">🌱</span>
  return <ToolIcon tool={pick.part === 'crossing' ? 'rail' : pick.part} />
}

export default function Town3D({ town, night, onToggleNight, sound, onToggleSound, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<TownSceneHandle | null>(null)
  const initialNight = useRef(night)
  const [status, setStatus] = useState<Status>('loading')
  const [counts, setCounts] = useState<VehicleCounts>({ car: 0, train: 0 })
  const [tour, setTour] = useState(() => !prefersReducedMotion())
  const [riding, setRiding] = useState<VehicleKind | null>(null)
  const [picked, setPicked] = useState<{ pick: TownPick; stamp: number } | null>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return undefined
    const scene = createTownScene(element, town, initialNight.current, {
      ready: (next) => {
        setCounts(next)
        setStatus('ready')
      },
      error: () => setStatus('error'),
      tour: setTour,
      pick: (pick) => {
        setPicked((previous) => ({ pick, stamp: (previous?.stamp ?? 0) + 1 }))
        playTownSound('select')
      },
    })
    handle.current = scene
    element.focus({ preventScroll: true })
    return () => {
      handle.current = null
      scene.dispose()
    }
  }, [town])

  useEffect(() => {
    handle.current?.setNight(night)
  }, [night])

  useEffect(() => {
    if (!picked) return undefined
    const timer = setTimeout(() => setPicked(null), 2400)
    return () => clearTimeout(timer)
  }, [picked])

  function press(action: () => void) {
    primeAudio()
    action()
  }

  function toggleTour() {
    press(() => {
      const next = !tour
      setTour(next)
      handle.current?.setTour(next)
      playTownSound('select')
    })
  }

  function board(kind: VehicleKind) {
    press(() => {
      if (!handle.current?.ride(kind)) return
      setRiding(kind)
      playTownSound('ride')
    })
  }

  function land() {
    press(() => {
      handle.current?.land()
      setRiding(null)
      playTownSound('select')
    })
  }

  function turn(step: number) {
    press(() => {
      handle.current?.turn(step)
      playTownSound('select')
    })
  }

  function zoom(step: number) {
    press(() => {
      handle.current?.zoom(step)
      playTownSound('select')
    })
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.target !== host.current || riding) return
    const actions: Record<string, () => void> = {
      ArrowLeft: () => handle.current?.turn(-1),
      ArrowRight: () => handle.current?.turn(1),
      ArrowUp: () => handle.current?.zoom(1),
      ArrowDown: () => handle.current?.zoom(-1),
      '+': () => handle.current?.zoom(1),
      '-': () => handle.current?.zoom(-1),
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  const ready = status === 'ready'

  return <div className={styles.overlay} data-night={night} role="dialog" aria-modal="true" aria-labelledby="town-3d-title" onKeyDown={onKeyDown}>
    <header className={styles.header}>
      <GameBackButton onBack={onClose} ariaLabel="まちづくりに もどる" />
      <h2 id="town-3d-title" className={styles.title}>3Dで みる</h2>
      <button type="button" className={styles.iconButton} onClick={() => press(onToggleNight)} aria-label={night ? 'ひるに する' : 'よるに する'} aria-pressed={night}>
        <span aria-hidden="true">{night ? '☀️' : '🌙'}</span>
      </button>
      <button type="button" className={styles.iconButton} onClick={onToggleSound} aria-label="おと" aria-pressed={sound}>
        <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
      </button>
    </header>

    <div className={styles.stage}>
      <div
        ref={host}
        className={styles.canvas}
        role="group"
        tabIndex={0}
        aria-label="3Dの まち。ゆびで うごかすと まわるよ。2ほんゆびで ずらしたり ちかづいたり できるよ"
      />
      {status === 'loading' && <p className={styles.message} role="status">じゅんびちゅう…</p>}
      {status === 'error' && <div className={styles.message} role="alert">
        <p>3Dで みられなかったよ</p>
        <button type="button" onClick={onClose}>まちづくりに もどる</button>
      </div>}
      {picked && <div key={picked.stamp} className={styles.bubble} role="status">
        <PickIcon pick={picked.pick} />
        <span>{pickLabel(picked.pick)}</span>
      </div>}
      {ready && riding === null && <div className={styles.viewTools} role="group" aria-label="みかたを かえる">
        <button type="button" onClick={() => zoom(1)} aria-label="ちかづく"><span aria-hidden="true">＋</span></button>
        <button type="button" onClick={() => zoom(-1)} aria-label="はなれる"><span aria-hidden="true">－</span></button>
        <button type="button" onClick={() => turn(-1)} aria-label="ひだりに まわす"><span aria-hidden="true">↺</span></button>
        <button type="button" onClick={() => turn(1)} aria-label="みぎに まわす"><span aria-hidden="true">↻</span></button>
      </div>}
    </div>

    {ready && <nav className={styles.bar} aria-label="ながめかた">
      {riding === null
        ? <button type="button" className={styles.barButton} onClick={toggleTour} aria-label="ぐるっと まわる" aria-pressed={tour}>
          <span aria-hidden="true">🔄</span>
        </button>
        : <button type="button" className={styles.barButton} onClick={land} aria-label="そらから みる">
          <span aria-hidden="true">🎈</span>
        </button>}
      <button type="button" className={styles.barButton} onClick={() => board('car')} disabled={!counts.car}
        aria-label={riding === 'car' ? 'つぎの くるまに のる' : 'くるまに のる'} aria-pressed={riding === 'car'}>
        <span aria-hidden="true">🚗</span>
      </button>
      <button type="button" className={styles.barButton} onClick={() => board('train')} disabled={!counts.train}
        aria-label={riding === 'train' ? 'つぎの でんしゃに のる' : 'でんしゃに のる'} aria-pressed={riding === 'train'}>
        <span aria-hidden="true">🚃</span>
      </button>
    </nav>}
  </div>
}
