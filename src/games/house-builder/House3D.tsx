import { useEffect, useRef, type KeyboardEvent } from 'react'
import type { HouseDesign } from './plan'
import { createHouseScene, type HouseSceneHandle, type HouseView, type SceneSpot } from './three/houseScene'
import styles from './HouseBuilderPlay.module.css'

// かんせいした おうちの 3D。three.js を つかうので かんせい がめんで はじめて よみこむ（React.lazy）。

type Props = {
  design: HouseDesign
  view: HouseView
  label: string
  onSpot: (spot: SceneSpot) => void
  onStatus: (status: 'ready' | 'error') => void
}

export default function House3D({ design, view, label, onSpot, onStatus }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const handle = useRef<HouseSceneHandle | null>(null)
  const latest = useRef({ design, view, onSpot, onStatus })

  useEffect(() => {
    latest.current = { design, view, onSpot, onStatus }
  })

  useEffect(() => {
    const el = host.current
    if (!el) return undefined
    const scene = createHouseScene(el, latest.current.design, latest.current.view, {
      status: (status) => latest.current.onStatus(status),
      spot: (spot) => latest.current.onSpot(spot),
    })
    handle.current = scene
    return () => {
      handle.current = null
      scene.dispose()
    }
  }, [])

  useEffect(() => {
    handle.current?.show(design, view)
  }, [design, view])

  function onKeyDown(event: KeyboardEvent) {
    const scene = handle.current
    if (!scene) return
    const actions: Record<string, () => void> = {
      ArrowLeft: () => scene.turn(-1),
      ArrowRight: () => scene.turn(1),
      ArrowUp: () => scene.zoom(1),
      ArrowDown: () => scene.zoom(-1),
      '+': () => scene.zoom(1),
      '-': () => scene.zoom(-1),
      Enter: () => onSpot(view.kind === 'outside' ? 'door' : 'room'),
      ' ': () => onSpot(view.kind === 'outside' ? 'door' : 'room'),
    }
    const action = actions[event.key]
    if (!action) return
    event.preventDefault()
    action()
  }

  return (
    <>
      <div
        ref={host}
        className={styles.canvas3d}
        role="group"
        aria-label={`${label}。ゆびで うごかすと まわるよ${view.kind === 'outside' ? '。2ほんゆびで ずらせるよ' : ''}`}
        tabIndex={0}
        onKeyDown={onKeyDown}
      />
      <div className={styles.stageControls} role="group" aria-label="みかたを かえる">
        <button type="button" className={styles.stageButton} aria-label="ひだりに まわす" onClick={() => handle.current?.turn(-1)}>
          <span aria-hidden="true">↺</span>
        </button>
        <button type="button" className={styles.stageButton} aria-label="みぎに まわす" onClick={() => handle.current?.turn(1)}>
          <span aria-hidden="true">↻</span>
        </button>
        <button type="button" className={styles.stageButton} aria-label="ちかづく" onClick={() => handle.current?.zoom(1)}>
          <span aria-hidden="true">＋</span>
        </button>
        <button type="button" className={styles.stageButton} aria-label="はなれる" onClick={() => handle.current?.zoom(-1)}>
          <span aria-hidden="true">－</span>
        </button>
      </div>
    </>
  )
}
