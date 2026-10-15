import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import FishArt from './FishArt'
import { FISH, findFish, fishingReducer, initialFishingState, type FishId, type FishingAction, type FishingState } from './fishingGame'
import {
  SURFACE_Y, castHook, createPond, homeHook, lureNearest, nudgeHookTarget, setHookTarget, stepPond, syncPond,
  type Pond, type Point, type SwimMode,
} from './pondSim'
import SeaScenery from './SeaScenery'
import { BOAT_BOX, ROD_TIP } from './sceneLayout'
import { playFishingSound } from './sounds'
import styles from './FishingPondPlay.module.css'

type FishView = { id: FishId; x: number; y: number; dir: 1 | -1; mode: SwimMode }
type PondView = { fish: FishView[]; hook: Point; target: Point; leftRecently: boolean }

/** 釣れたあとは連打の勢いで次へ進まないよう、しばらくボタンを受け付けない[ms]。 */
export const LANDING_LOCK_MS = 1500

function snapshot(pond: Pond): PondView {
  return {
    fish: pond.fish.map(({ id, x, y, dir, mode }) => ({ id, x, y, dir, mode })),
    hook: { ...pond.hook },
    target: { ...pond.target },
    leftRecently: pond.time - pond.leftAt < 2.5,
  }
}

/** 竿先の位置[px]。船の絵は枠の下寄せ・縦横比維持で描かれる。 */
function rodTipPx(width: number, height: number): Point {
  const bw = width * BOAT_BOX.width, bh = height * BOAT_BOX.height
  const scale = Math.min(bw / BOAT_BOX.viewWidth, bh / BOAT_BOX.viewHeight)
  const left = width * BOAT_BOX.left + (bw - BOAT_BOX.viewWidth * scale) / 2
  const top = height * BOAT_BOX.top + bh - BOAT_BOX.viewHeight * scale
  return { x: left + ROD_TIP.x * scale, y: top + ROD_TIP.y * scale }
}

const KEY_STEP: Record<string, [number, number]> = {
  ArrowLeft: [-8, 0], ArrowRight: [8, 0], ArrowUp: [0, -8], ArrowDown: [0, 8],
}

export default function FishingPondPlay() {
  const [game, dispatch] = useReducer(fishingReducer, undefined, initialFishingState)
  // ループやイベントからも最新の状態を読めるよう、同じreducerで同期して持つ。
  const gameRef = useRef<FishingState>(game)
  const pondRef = useRef<Pond | null>(null)
  const [view, setView] = useState<PondView>({ fish: [], hook: homeHook(), target: homeHook(), leftRecently: false })
  const [seaSize, setSeaSize] = useState({ width: 400, height: 300 })
  const [reelCount, setReelCount] = useState(0)
  const [bobber, setBobber] = useState<{ key: number; anim: 'cast' | 'jiggle' | null }>({ key: 0, anim: null })
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(false)
  const lockTimerRef = useRef<number | undefined>(undefined)
  const [soundOn, setSoundOn] = useState(true)
  const soundOnRef = useRef(true)
  const draggingRef = useRef(false)
  const seaRef = useRef<HTMLDivElement>(null)
  const actionRef = useRef<HTMLButtonElement>(null)
  const playing = game.phase !== 'title'
  useGameIntroPlaying(playing)

  const send = useCallback((action: FishingAction) => {
    const next = fishingReducer(gameRef.current, action)
    gameRef.current = next
    dispatch(action)
    return next
  }, [])

  const sound = useCallback((kind: Parameters<typeof playFishingSound>[0]) => {
    if (soundOnRef.current) playFishingSound(kind)
  }, [])

  // 魚が泳ぎ続けるアニメーションループ。タブが隠れると requestAnimationFrame ごと止まる。
  useEffect(() => {
    pondRef.current ??= createPond([])
    let raf = 0
    let last: number | null = null
    let nibbling = false
    const frame = (now: number) => {
      const dt = last === null ? 1 / 60 : Math.min(0.05, Math.max(0, (now - last) / 1000))
      last = now
      const pond = pondRef.current!
      let g = gameRef.current
      syncPond(pond, g.caught, g.phase === 'hooked' ? g.hookedId : null)
      const bite = stepPond(pond, dt, {
        active: g.phase === 'fishing',
        hookedId: g.phase === 'hooked' ? g.hookedId : null,
        progress: g.progress,
      })
      const nowNibbling = pond.fish.some((fish) => fish.mode === 'nibble')
      if (nowNibbling && !nibbling) sound('nibble')
      nibbling = nowNibbling
      if (bite) {
        send({ type: 'bite', fishId: bite })
        sound('bite')
        vibrate('impact')
      } else if (g.phase === 'hooked') {
        g = send({ type: 'tick', ms: dt * 1000 })
        if (g.phase === 'ready') {
          sound('escape')
          vibrate('tap')
        }
      }
      setView(snapshot(pond))
      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(raf)
  }, [send, sound])

  // タイトル⇔プレイで海の要素が作り直されても、大きさを測り直す。
  const observeSea = useCallback((node: HTMLDivElement) => {
    seaRef.current = node
    const measure = (width: number, height: number) => {
      if (width > 0 && height > 0) setSeaSize({ width, height })
    }
    const rect = node.getBoundingClientRect()
    measure(rect.width, rect.height)
    if (typeof ResizeObserver === 'undefined') return () => { seaRef.current = null }
    const observer = new ResizeObserver(([entry]) => measure(entry.contentRect.width, entry.contentRect.height))
    observer.observe(node)
    return () => {
      observer.disconnect()
      seaRef.current = null
    }
  }, [])

  useEffect(() => () => window.clearTimeout(lockTimerRef.current), [])

  // 矢印キーでも、投げる場所や針を動かせる。
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const step = KEY_STEP[event.key]
      const phase = gameRef.current.phase
      if (!step || (phase !== 'fishing' && phase !== 'ready') || !pondRef.current) return
      event.preventDefault()
      nudgeHookTarget(pondRef.current, step[0], step[1])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    actionRef.current?.focus({ preventScroll: true })
  }, [game.phase])

  function reel() {
    if (gameRef.current.phase !== 'hooked') return
    const next = send({ type: 'reel' })
    setReelCount((count) => count + 1)
    if (next.phase === 'hooked') {
      sound('reel')
      vibrate('tap')
    } else {
      if (pondRef.current) {
        syncPond(pondRef.current, next.caught, null)
        setView(snapshot(pondRef.current))
      }
      lockedRef.current = true
      setLocked(true)
      window.clearTimeout(lockTimerRef.current)
      lockTimerRef.current = window.setTimeout(() => {
        lockedRef.current = false
        setLocked(false)
      }, LANDING_LOCK_MS)
      sound(next.phase === 'complete' ? 'complete' : 'catch')
      vibrate(next.phase === 'complete' ? 'celebrate' : 'success')
    }
  }

  function resetPond(caught: readonly FishId[]) {
    pondRef.current = createPond(caught)
    setView(snapshot(pondRef.current))
  }

  function cast(point: Point) {
    if (gameRef.current.phase !== 'ready' || !pondRef.current) return
    send({ type: 'cast' })
    castHook(pondRef.current, point)
    setView(snapshot(pondRef.current))
    setBobber((current) => ({ key: current.key + 1, anim: 'cast' }))
    sound('cast')
    vibrate('tap')
  }

  function handleAction() {
    primeAudio()
    const phase = gameRef.current.phase
    if (lockedRef.current && (phase === 'caught' || phase === 'complete')) return
    if (phase === 'title' || phase === 'complete') {
      send({ type: 'start' })
      resetPond([])
      vibrate('tap')
    } else if (phase === 'ready') {
      if (pondRef.current) cast(pondRef.current.target)
    } else if (phase === 'fishing') {
      if (pondRef.current && lureNearest(pondRef.current)) sound('nibble')
      setBobber((current) => ({ key: current.key + 1, anim: 'jiggle' }))
      vibrate('tap')
    } else if (phase === 'hooked') {
      reel()
    } else if (phase === 'caught') {
      send({ type: 'next' })
      if (pondRef.current) pondRef.current.target = homeHook()
      vibrate('tap')
    }
  }

  function pointerToSea(event: PointerEvent<HTMLDivElement>): Point | null {
    const rect = seaRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    return { x: ((event.clientX - rect.left) / rect.width) * 100, y: ((event.clientY - rect.top) / rect.height) * 100 }
  }

  function handleSeaDown(event: PointerEvent<HTMLDivElement>) {
    const phase = gameRef.current.phase
    if (phase === 'hooked') {
      primeAudio()
      reel()
      return
    }
    if (phase === 'ready') {
      primeAudio()
      const point = pointerToSea(event)
      if (point) cast(point)
      return
    }
    if (phase !== 'fishing' || !pondRef.current) return
    primeAudio()
    const point = pointerToSea(event)
    if (!point) return
    draggingRef.current = true
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* 古いブラウザでも動かせる */ }
    setHookTarget(pondRef.current, point)
  }

  function handleSeaMove(event: PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current || gameRef.current.phase !== 'fishing' || !pondRef.current) return
    const point = pointerToSea(event)
    if (point) setHookTarget(pondRef.current, point)
  }

  const hooked = findFish(game.hookedId)
  const landed = (game.phase === 'caught' || game.phase === 'complete') && hooked
  const hasLine = game.phase === 'fishing' || game.phase === 'hooked'
  const approaching = view.fish.some((fish) => fish.mode === 'approach' || fish.mode === 'inspect' || fish.mode === 'nibble')
  const nibbling = view.fish.some((fish) => fish.mode === 'nibble')
  const message = {
    title: 'いとを なげて おさかなを つろう！',
    ready: game.escaped ? 'にげちゃった… もういちど なげよう！' : 'なげたい ところを タップしてね',
    fishing: approaching
      ? 'おさかなが きたよ… まってね'
      : view.leftRecently ? 'あれれ… いっちゃった' : 'うみを さわって はりを うごかそう',
    hooked: 'かかった！ れんだで まきあげよう！',
    caught: `${hooked?.name ?? ''}が つれた！`,
    complete: 'ぜんぶ つれた！ おめでとう！',
  }[game.phase]
  const actionLabel = {
    title: 'つりを はじめる',
    ready: 'なげる！',
    fishing: 'えさを ゆらす',
    hooked: 'まく！',
    caught: 'つぎの おさかな',
    complete: 'もういちど',
  }[game.phase]
  const actionIcon = { title: '🎣', ready: '🎯', fishing: '🪱', hooked: '💪', caught: '🐟', complete: '↻' }[game.phase]

  const { width: seaW, height: seaH } = seaSize
  const tip = rodTipPx(seaW, seaH)
  const hookPx = { x: (view.hook.x / 100) * seaW, y: (view.hook.y / 100) * seaH }
  const bobberPx = { x: hookPx.x, y: (SURFACE_Y / 100) * seaH }
  const linePath = game.phase === 'hooked'
    ? `M${tip.x} ${tip.y} L${hookPx.x} ${hookPx.y}`
    : `M${tip.x} ${tip.y} Q${(tip.x + bobberPx.x) / 2} ${bobberPx.y + 6} ${bobberPx.x} ${bobberPx.y} L${hookPx.x} ${hookPx.y}`

  const content = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton
          to="/"
          onBack={playing ? () => { send({ type: 'back' }); resetPond([]) } : undefined}
        />
        <h1 className={styles.title}>のんびり さかなつり</h1>
        <button
          type="button"
          className={styles.soundButton}
          aria-label={soundOn ? 'おとを けす' : 'おとを だす'}
          aria-pressed={soundOn}
          onClick={() => {
            primeAudio()
            soundOnRef.current = !soundOn
            setSoundOn(!soundOn)
          }}
        >
          <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
        </button>
      </header>

      <div className={styles.layout}>
        <div
          ref={observeSea}
          className={`${styles.sea} ${game.phase === 'fishing' || game.phase === 'ready' ? styles.seaAim : ''} ${game.phase === 'hooked' ? styles.seaReel : ''}`}
          role="group"
          aria-label="おさかなの うみ"
          onPointerDown={handleSeaDown}
          onPointerMove={handleSeaMove}
          onPointerUp={() => { draggingRef.current = false }}
          onPointerCancel={() => { draggingRef.current = false }}
        >
          <SeaScenery />

          {view.fish.map((fish, index) => {
            const info = findFish(fish.id)
            const fishStyle = {
              left: `${fish.x}%`,
              top: `${fish.y}%`,
              '--size': info?.size ?? 1,
              '--dir': fish.dir,
              '--delay': `${index * -0.37}s`,
            } as CSSProperties
            return (
              <div key={fish.id} className={`${styles.fish} ${styles[`mode_${fish.mode}`] ?? ''}`} style={fishStyle} data-fish={fish.id} aria-hidden="true">
                <span className={styles.swimmer}><FishArt fishId={fish.id} /></span>
              </div>
            )
          })}

          {game.phase === 'ready' ? (
            <>
              <svg className={styles.line} viewBox={`0 0 ${seaW} ${seaH}`} aria-hidden="true" focusable="false">
                <path d={`M${tip.x} ${tip.y} Q${tip.x + 4} ${tip.y + 16} ${tip.x + 2} ${tip.y + 30}`} fill="none" stroke="#fffdf0" strokeWidth="1.6" strokeLinecap="round" />
                <ellipse cx={tip.x + 2} cy={tip.y + 36} rx="6" ry="7.5" fill="#ff6a5c" stroke="#fffdf5" strokeWidth="1.6" />
              </svg>
              <div className={styles.aim} style={{ left: `${view.target.x}%`, top: `${SURFACE_Y}%` }} data-testid="aim" aria-hidden="true">
                <span />
              </div>
            </>
          ) : null}

          {hasLine ? (
            <>
              <svg className={styles.line} viewBox={`0 0 ${seaW} ${seaH}`} aria-hidden="true" focusable="false">
                <path d={linePath} fill="none" stroke="#fffdf0" strokeWidth={game.phase === 'hooked' ? 2.2 : 1.6} strokeLinecap="round" />
              </svg>
              {game.phase === 'fishing' ? (
                <div
                  key={`bobber-${bobber.key}`}
                  className={`${styles.float} ${nibbling ? styles.nibbling : ''} ${bobber.anim ? styles[bobber.anim] : ''}`}
                  style={{ left: `${view.hook.x}%` }}
                  aria-hidden="true"
                >
                  <span className={styles.ripple} />
                  <span className={styles.bobber} />
                  {approaching ? <strong className={styles.biteMark}>{nibbling ? '！' : '？'}</strong> : null}
                </div>
              ) : (
                <div className={styles.splash} style={{ left: `${view.hook.x}%` }} aria-hidden="true">
                  <span /><span /><span />
                </div>
              )}
              <div className={styles.hook} style={{ left: `${view.hook.x}%`, top: `${view.hook.y}%` }} data-testid="hook" aria-hidden="true">
                <svg viewBox="0 0 24 34" focusable="false">
                  <path d="M12 0 V22 Q12 30 6 30 Q1 30 1 24 L4 26" fill="none" stroke="#d6dde3" strokeWidth="2.6" strokeLinecap="round" />
                  {game.phase === 'fishing' ? <path d="M12 20 Q20 22 17 28 Q14 33 19 33" fill="none" stroke="#f08aa0" strokeWidth="4" strokeLinecap="round" /> : null}
                </svg>
              </div>
            </>
          ) : null}

          {game.phase === 'hooked' ? (
            <span key={reelCount} className={styles.tapBurst} style={{ left: `${view.hook.x}%`, top: `${view.hook.y}%` }} aria-hidden="true">
              {reelCount > 0 ? 'ぐいっ！' : 'ばしゃ！'}
            </span>
          ) : null}

          {landed ? (
            <div className={styles.catchShow} aria-hidden="true">
              <span className={styles.burst} />
              <span className={styles.sparkles}>✦ ✧ ✦</span>
              <div className={styles.prize}><FishArt fishId={hooked.id} /></div>
              <span className={styles.catchWord}>{hooked.name}</span>
              <span className={styles.catchSub}>{game.phase === 'complete' ? 'だいせいこう！' : 'つれた！'}</span>
            </div>
          ) : null}
        </div>

        <section className={styles.panel} aria-label="つりの そうさ">
          <p className={styles.message} role="status" aria-live="polite" aria-atomic="true">{message}</p>
          {game.phase === 'hooked' ? (
            <div
              className={styles.meter}
              role="progressbar"
              aria-label="まきあげ"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(game.progress * 100)}
            >
              <span className={styles.meterFill} style={{ width: `${game.progress * 100}%` }} />
              <span className={styles.meterFish} style={{ left: `${game.progress * 100}%` }}>🐟</span>
            </div>
          ) : null}
          <button
            ref={actionRef}
            type="button"
            className={`${styles.action} ${game.phase === 'hooked' ? styles.reel : ''} ${locked ? styles.locked : ''}`}
            aria-disabled={locked || undefined}
            onClick={handleAction}
          >
            <span aria-hidden="true">{actionIcon}</span>
            {actionLabel}
          </button>
          <div className={styles.collection}>
            <p className={styles.count}>つれた おさかな <strong>{game.caught.length} / {FISH.length}</strong></p>
            <ol className={styles.album} aria-label="つれた おさかな">
              {FISH.map((fish) => {
                const caught = game.caught.includes(fish.id)
                return (
                  <li key={fish.id} className={caught ? styles.collected : styles.empty} aria-label={`${fish.name} ${caught ? 'つれた' : 'まだ'}`}>
                    <FishArt fishId={fish.id} />
                    <span aria-hidden="true">{caught ? '✓' : '？'}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      </div>
    </main>
  )

  return playing && game.phase !== 'complete' ? <GamePlaySurface>{content}</GamePlaySurface> : content
}
