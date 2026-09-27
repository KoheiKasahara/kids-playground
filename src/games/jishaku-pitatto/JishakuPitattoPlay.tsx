import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { KINDS, type KindId } from './items'
import { STAGES } from './stages'
import {
  autoPilot, carryOver, createWorld, disposeWorld, drainEvents, setMagnetTarget, stepWorld, worldResult, worldSize,
  type Result, type World,
} from './world'
import { Painter, createFx, itemIcon, makeView, screenToWorld, snapshotMagnet, spawnFx, updateFx, type View } from './render'
import { progressStore, readMusic, writeMusic } from './progress'
import * as sfx from './sounds'
import styles from './JishakuPitattoPlay.module.css'

const TITLE = 'ぴたっと じしゃく'
const STEP_MS = 1000 / 60
/** ゆびで かくれないように、じしゃくは ゆびの すこし うえに でる（CSS px）。 */
const TOUCH_LIFT_PX = 64
const KEY_DIRS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
  a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1],
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

// ---------------- ちいさな え ----------------

const iconCache = new Map<string, string | null>()
function iconFor(kind: KindId, variant: number): string | null {
  const key = `${kind}:${variant}`
  if (!iconCache.has(key)) iconCache.set(key, itemIcon(kind, variant, 72))
  return iconCache.get(key) ?? null
}

function ItemIcon({ kind, variant = 0, className }: { kind: KindId; variant?: number; className?: string }) {
  const [src] = useState(() => iconFor(kind, variant))
  if (!src) return <span className={`${className ?? ''} ${styles.iconFallback}`} aria-hidden="true">{KINDS[kind].name.slice(0, 1)}</span>
  return <img className={className} src={src} alt="" aria-hidden="true" draggable={false} />
}

// ---------------- canvas の じゅんび ----------------

function fitCanvas(canvas: HTMLCanvasElement, world: { w: number; h: number }): View {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const cssW = box.width || window.innerWidth || 390
  const cssH = box.height || window.innerHeight || 700
  const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr)
  if (canvas.width !== w) canvas.width = w
  if (canvas.height !== h) canvas.height = h
  return makeView(cssW, cssH, dpr, world)
}

function initialSize(canvas: HTMLCanvasElement | null) {
  const box = canvas?.getBoundingClientRect()
  return worldSize(box?.width || window.innerWidth || 390, box?.height || window.innerHeight || 700)
}

// ---------------- プレイ画面 ----------------

type Group = { kind: KindId; variant: number; total: number; got: number }
type Hud = { groups: Group[]; stars: number; starTotal: number }

function hudFrom(world: World): Hud {
  const groups: Group[] = []
  for (const it of world.items) {
    if (!it.target) continue
    let g = groups.find((x) => x.kind === it.kind.id)
    if (!g) groups.push((g = { kind: it.kind.id, variant: it.variant, total: 0, got: 0 }))
    g.total++
    if (it.state === 'stuck') g.got++
  }
  return {
    groups,
    stars: world.items.filter((it) => it.star && it.state === 'stuck').length,
    starTotal: world.items.filter((it) => it.star).length,
  }
}

const TIPS: Record<string, string> = {
  desk: 'てつで できた ものは じしゃくに くっつくよ',
  sand: 'すなの なかの くろい つぶは「さてつ」。てつの つぶ だよ',
  sea: 'おなじ かんでも、スチールは くっつく。アルミは くっつかないよ',
}

function Stage({ index, music, onMusic, onExit, onRetry, onNext }: {
  index: number; music: boolean; onMusic: () => void; onExit: () => void; onRetry: () => void; onNext: () => void
}) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const viewRef = useRef<View | null>(null)
  const pointerRef = useRef<{ id: number; touch: boolean } | null>(null)
  const keysRef = useRef(new Set<string>())
  const trayRef = useRef<HTMLUListElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const [hud, setHud] = useState<Hud>({ groups: [], stars: 0, starTotal: 3 })
  const [banner, setBanner] = useState(true)
  const [guide, setGuide] = useState(index === 0)
  const [cleared, setCleared] = useState(false)
  const [result, setResult] = useState<(Result & { best: boolean; photo: string | null; count: number; sand: number }) | null>(null)

  useEffect(() => {
    if (!music || result) return undefined
    return sfx.startBgm(stage.id)
  }, [music, stage.id, result])

  useEffect(() => {
    const canvas = canvasRef.current
    let world = createWorld(stage, initialSize(canvas))
    const expose = () => {
      worldRef.current = world
      // 開発中だけ ブラウザから じょうたいを のぞけるように する（本番の ビルドには はいらない）。
      if (import.meta.env.DEV) (window as unknown as { __jishakuWorld?: World }).__jishakuWorld = world
    }
    expose()
    setHud(hudFrom(world))
    const ctx = canvas?.getContext('2d') ?? null
    const still = reducedMotion()
    let painter = new Painter(world)
    painter.calm = still
    let fx = createFx()
    let done = false
    const measure = () => {
      if (!canvas) return
      // たて↔よこ に まわしたら、その むきに あう 大きさの せかいへ うつす（くっついた ものは そのまま）。
      const ideal = initialSize(canvas)
      const ratio = (ideal.w / ideal.h) / (world.w / world.h)
      if (!done && (ratio > 1.3 || ratio < 1 / 1.3)) {
        const next = createWorld(stage, ideal)
        carryOver(world, next)
        disposeWorld(world)
        world = next
        painter = new Painter(world)
        painter.calm = still
        fx = createFx()
        expose()
        setHud(hudFrom(world))
      }
      const view = fitCanvas(canvas, world)
      viewRef.current = view
      // うえの ボタンや あつめる もの の したまでを じしゃくの うごける ところに する。
      const tray = trayRef.current?.getBoundingClientRect()
      const top = canvas.getBoundingClientRect().top
      if (tray && tray.height > 0) world.topLimit = Math.max(20, (tray.bottom - top - view.oy) / view.scale + 2)
    }
    measure()
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    if (trayRef.current) observer?.observe(trayRef.current)
    window.addEventListener('resize', measure)
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => setBanner(false), 2600)]
    sfx.playStart()

    let frame = 0, previous = 0, acc = 0, time = 0, restAt = -1
    const draw = () => {
      const view = viewRef.current
      if (!ctx || !view) return
      painter.draw(ctx, world, view, time, fx)
    }
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      acc += elapsed
      let steps = 0
      while (acc >= STEP_MS && steps < 5) {
        if (keysRef.current.size) {
          const m = world.magnet
          let dx = 0, dy = 0
          for (const k of keysRef.current) { const d = KEY_DIRS[k]; if (d) { dx += d[0]; dy += d[1] } }
          setMagnetTarget(world, m.tx + dx * 5, m.ty + dy * 5)
        }
        if (import.meta.env.DEV && (window as unknown as { __jishakuAuto?: boolean }).__jishakuAuto) autoPilot(world)
        stepWorld(world)
        updateFx(fx, world, 1 / 60)
        time += 1 / 60
        acc -= STEP_MS
        steps++
      }
      if (steps === 5) acc = 0
      let hudDirty = false
      for (const e of drainEvents(world)) {
        if (!still || e.type === 'clear') spawnFx(fx, e, world)
        switch (e.type) {
          case 'stick':
            hudDirty = true
            sfx.playStick(e.combo, KINDS[e.kind].material, KINDS[e.kind].density > 0.005)
            if (e.star) { sfx.playStar(); vibrate('success') } else vibrate('tap')
            setGuide(false)
            break
          case 'lift': sfx.playLift(); break
          case 'clink': sfx.playClink(e.material, e.power); break
          case 'shiin': sfx.playShiin(); break
          case 'pop': sfx.playPop(); vibrate('impact'); break
          case 'splash': sfx.playSplash(e.power); break
          case 'grains': sfx.playGrains(e.n); break
          case 'hooked': sfx.playHooked(); break
          case 'clear': {
            done = true
            sfx.playClear()
            vibrate('celebrate')
            setCleared(true)
            setGuide(false)
            // ほめている あいだに とった ほしも かぞえる。
            timers.push(setTimeout(() => {
              const res = worldResult(world)
              const before = progressStore.read()[stage.id] ?? 0
              progressStore.record(stage.id, res.stars)
              setResult({
                ...res, best: res.stars > before,
                photo: ctx ? snapshotMagnet(world, time) : null,
                count: world.stuckOrder.length,
                sand: world.sand?.stuck ?? 0,
              })
            }, 2300))
            restAt = time + 9
            break
          }
          default: break
        }
      }
      if (hudDirty) setHud(hudFrom(world))
      if (steps) draw()
      // けっかを だして しばらく したら 絵を とめて 電池を まもる。
      if (restAt >= 0 && time > restAt) cancelAnimationFrame(frame)
    }
    draw()
    frame = requestAnimationFrame(tick)

    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (!KEY_DIRS[key]) return
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) return
      e.preventDefault()
      primeAudio()
      keysRef.current.add(key)
      setGuide(false)
    }
    const keyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      keysRef.current.delete(key)
    }
    const blur = () => { keysRef.current.clear(); pointerRef.current = null }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      disposeWorld(world)
      worldRef.current = null
    }
  }, [stage])

  // けっかが でたら「つぎへ」に フォーカス（がめんは うごかさない）。
  useEffect(() => { if (result) nextRef.current?.focus({ preventScroll: true }) }, [result])

  const aim = (event: ReactPointerEvent<HTMLCanvasElement>, touch: boolean) => {
    const world = worldRef.current, view = viewRef.current
    if (!world || !view) return
    const box = event.currentTarget.getBoundingClientRect()
    const p = screenToWorld(view, event.clientX - box.left, event.clientY - box.top)
    setMagnetTarget(world, p.x, p.y - (touch ? TOUCH_LIFT_PX / view.scale : 0))
  }

  function down(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.preventDefault()
    primeAudio()
    const touch = event.pointerType !== 'mouse'
    pointerRef.current = { id: event.pointerId, touch }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    aim(event, touch)
    setGuide(false)
  }

  function move(event: ReactPointerEvent<HTMLCanvasElement>) {
    const p = pointerRef.current
    if (event.pointerType === 'mouse') aim(event, false)
    else if (p && p.id === event.pointerId) aim(event, p.touch)
  }

  function up(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null
  }

  const remaining = hud.groups.reduce((sum, g) => sum + g.total - g.got, 0)
  const last = index === STAGES.length - 1
  return <GamePlaySurface><main className={styles.play} data-stage={stage.id}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
      aria-label={`${stage.name}。ゆびで じしゃくを うごかして、てつの ものを くっつけよう。やじるしキーでも うごかせるよ`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} />
    <GameBackButton onBack={onExit} />
    <div className={styles.hudRight}>
      <p className={styles.starBox} role="img" aria-label={`ほしバッジ ${hud.stars} / ${hud.starTotal}`}>
        {Array.from({ length: hud.starTotal }, (_, i) => <span key={i} className={i < hud.stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>)}
      </p>
      <button type="button" className={styles.musicButton} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
        <span aria-hidden="true">{music ? '♪' : '×'}</span>
      </button>
    </div>
    <ul ref={trayRef} className={styles.tray} aria-label={`あと ${remaining}こ`}>
      {hud.groups.map((g) => <li key={`${g.kind}-${g.got}`} className={`${g.got === g.total ? styles.chipDone : styles.chip} ${g.got > 0 ? styles.bump : ''}`} aria-label={`${KINDS[g.kind].name} ${g.got} / ${g.total}`}>
        <ItemIcon kind={g.kind} variant={g.variant} className={styles.chipIcon} />
        <span className={styles.pips} aria-hidden="true">
          {Array.from({ length: g.total }, (_, i) => <i key={i} className={i < g.got ? styles.pipOn : styles.pipOff} />)}
        </span>
        {g.got === g.total && <b className={styles.check} aria-hidden="true">✓</b>}
      </li>)}
    </ul>
    {banner && <div className={styles.banner} aria-hidden="true">
      <small>ステージ {index + 1}</small>
      <strong>{stage.name}</strong>
      <span>{stage.hint}</span>
    </div>}
    {guide && !banner && <p className={styles.guide} role="status">
      <span className={styles.guideHand} aria-hidden="true">👆</span>
      じしゃくを うごかしてね
    </p>}
    {cleared && !result && <p className={styles.cheer} role="status">ぜんぶ くっついた！</p>}
    {result && <div className={styles.overlay}>
      <div className={styles.resultCard} role="dialog" aria-label="クリア">
        <div className={styles.resultMain}>
          <h2>ぜんぶ くっついた！</h2>
          <p className={styles.resultStars} role="img" aria-label={`ほし ${result.stars}こ`}>
            {[0, 1, 2].map((i) => <span key={i} className={i < result.stars ? styles.bigStarOn : styles.bigStarOff} style={{ animationDelay: `${0.25 + i * 0.22}s` }} aria-hidden="true">★</span>)}
          </p>
          {result.best && <p className={styles.best}>あたらしい きろく！</p>}
          {result.photo && <figure className={styles.photo}>
            <img src={result.photo} alt={`じしゃくに ${result.count}こ くっついた しゃしん`} />
            <figcaption>{result.count}こ ぴたっ！{result.sand > 20 ? ' さてつも いっぱい' : ''}</figcaption>
          </figure>}
        </div>
        <div className={styles.resultInfo}>
          <section className={styles.sortBox} aria-label="じしゃくに くっついた もの">
            <h3><span className={styles.sortMark} aria-hidden="true">🧲</span> くっついた</h3>
            <ul>{result.stuckKinds.map((k) => <li key={k}><ItemIcon kind={k} className={styles.sortIcon} /><span>{KINDS[k].name}</span></li>)}</ul>
          </section>
          <section className={`${styles.sortBox} ${styles.sortNo}`} aria-label="くっつかなかった もの">
            <h3><span className={styles.sortMark} aria-hidden="true">✕</span> くっつかない</h3>
            <ul>{result.otherKinds.map((k) => <li key={k}><ItemIcon kind={k} className={styles.sortIcon} /><span>{KINDS[k].name}</span></li>)}</ul>
          </section>
          <p className={styles.tip}>{TIPS[stage.id]}</p>
          {result.starsGot < result.starTotal && <p className={styles.tip}>ほしバッジが まだ かくれているよ（{result.starsGot} / {result.starTotal}）</p>}
          {last && <p className={styles.tip}>ぜんぶの ステージを あそんだよ！ じしゃく はかせ だね</p>}
          <div className={styles.cardButtons}>
            <button type="button" onClick={onExit}>ステージを えらぶ</button>
            <button type="button" onClick={onRetry}>もういちど</button>
            {!last && <button ref={nextRef} type="button" className={styles.primary} onClick={onNext}>つぎへ →</button>}
          </div>
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- タイトル画面 ----------------

function TitleScreen({ progress, music, onMusic, onPick }: {
  progress: Record<string, number>; music: boolean; onMusic: () => void; onPick: (i: number) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // うしろで じしゃくが じぶんで てつを あつめる おてほん。
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    let world = createWorld(STAGES[0], initialSize(canvas), 3)
    let painter = new Painter(world)
    let fx = createFx()
    let view = fitCanvas(canvas, world)
    const still = reducedMotion()
    let time = 0, frame = 0, previous = 0, acc = 0, clearAt = -1
    const reset = () => {
      disposeWorld(world)
      world = createWorld(STAGES[0], initialSize(canvas), 3 + Math.floor(time))
      painter = new Painter(world)
      fx = createFx()
      view = fitCanvas(canvas, world)
      clearAt = -1
    }
    // がめんの 大きさが かわったら おてほんを つくりなおす。
    let resizeTimer: ReturnType<typeof setTimeout> | undefined
    let lastSize = `${view.cssW}x${view.cssH}`
    const onResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        const box = canvas.getBoundingClientRect()
        const size = `${box.width || window.innerWidth}x${box.height || window.innerHeight}`
        if (size !== lastSize) { lastSize = size; reset() }
      }, 120)
    }
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(onResize) : null
    observer?.observe(canvas)
    window.addEventListener('resize', onResize)
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      acc += elapsed
      let steps = 0
      while (acc >= STEP_MS && steps < 4) {
        // ゆっくり うごく おてほん。
        if (world.frame % 2 === 0) autoPilot(world)
        stepWorld(world)
        updateFx(fx, world, 1 / 60)
        for (const e of drainEvents(world)) {
          spawnFx(fx, e, world)
          if (e.type === 'clear') clearAt = time
        }
        time += 1 / 60
        acc -= STEP_MS
        steps++
      }
      if (steps === 4) acc = 0
      if (clearAt >= 0 && time - clearAt > 3) reset()
      painter.draw(ctx, world, view, time, fx)
      if (still) cancelAnimationFrame(frame)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(resizeTimer)
      observer?.disconnect()
      window.removeEventListener('resize', onResize)
      disposeWorld(world)
    }
  }, [])

  // ステージの ちいさな え（すこしずつ つくって 画面を かためない）。
  useEffect(() => {
    let cancelled = false
    const timers = STAGES.map((stage, i) => setTimeout(() => {
      if (cancelled) return
      try {
        const world = createWorld(stage, { w: 420, h: 480 }, 11)
        for (let k = 0; k < 40; k++) { autoPilot(world); stepWorld(world) }
        drainEvents(world)
        const canvas = document.createElement('canvas')
        canvas.width = 312
        canvas.height = 240
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        // したの ほう（ものが ある ところ）を おおきく うつす。
        const scale = 312 / world.w
        const view: View = { cssW: 312, cssH: 240, dpr: 1, scale, ox: 0, oy: Math.min(0, 240 - world.groundY * scale - 70) }
        new Painter(world).draw(ctx, world, view, 1.3, createFx())
        const url = canvas.toDataURL('image/png')
        disposeWorld(world)
        setThumbs((t) => ({ ...t, [stage.id]: url }))
      } catch {
        // え なしでも えらべる。
      }
    }, 120 + i * 140))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [])

  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <GameBackButton to="/" />
    <button type="button" className={styles.titleMusic} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪ おんがく' : '× おんがく'}
    </button>
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>てつを あつめる じしゃくあそび</p>
        <h1>{TITLE}</h1>
      </header>
      <ol className={styles.stageList} aria-label="ステージを えらぶ">
        {STAGES.map((stage, i) => {
          const stars = progress[stage.id] ?? 0
          return <li key={stage.id}>
            <button type="button" className={styles.stageCard} data-stage={stage.id}
              aria-label={`ステージ${i + 1} ${stage.name}${stars ? ` クリアずみ ほし${stars}こ` : ''}`}
              onClick={() => { primeAudio(); onPick(i) }}>
              <span className={styles.thumb} data-stage={stage.id}>{thumbs[stage.id] && <img src={thumbs[stage.id]} alt="" />}</span>
              <span className={styles.stageNo}>ステージ {i + 1}</span>
              <span className={styles.stageName}>{stage.name}</span>
              <span className={styles.stageLead}>{stage.lead}</span>
              <span className={styles.stageBadge}><StageClearBadge stars={stars} /></span>
            </button>
          </li>
        })}
      </ol>
      <p className={styles.titleFoot}>じしゃくで てつを くっつけよう</p>
    </div>
  </main>
}

export default function JishakuPitattoPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState(() => progressStore.read())
  const [music, setMusic] = useState(() => readMusic())
  const toggleMusic = useCallback(() => setMusic((m) => { writeMusic(!m); if (!m) primeAudio(); return !m }), [])
  const play = (i: number | null) => {
    setProgress(progressStore.read())
    setAttempt((a) => a + 1)
    setIndex(i)
  }

  if (index === null) return <TitleScreen progress={progress} music={music} onMusic={toggleMusic} onPick={play} />
  return <Stage key={`${index}-${attempt}`} index={index} music={music} onMusic={toggleMusic}
    onExit={() => play(null)}
    onRetry={() => play(index)}
    onNext={() => play(index + 1 < STAGES.length ? index + 1 : null)} />
}
