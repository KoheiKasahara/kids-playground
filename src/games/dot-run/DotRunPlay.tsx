import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { STAGES, type StageDef } from './stages'
import {
  READY_FRAMES, autoPilot, createWorld, drainEvents, pressJump, progressRatio, releaseJump, runResult, stepWorld,
  type RunResult, type World,
} from './world'
import { Scene, bunnyImage, cameraTarget, carrotImage, createFx, medalImage, spawnFx, updateFx, viewSize, type Cam, type Fx } from './render'
import { progressStore, readMusic, writeMusic } from './progress'
import {
  playBlock, playCarrot, playDoubleJump, playFall, playGoal, playHurt, playJump, playMedal, playReady, playRescue, playSpring,
  playStomp, startBgm,
} from './sounds'
import type { Img } from './pixel'
import styles from './DotRunPlay.module.css'

const TITLE = 'ドットの ぴょんぴょんラン'
const FRAME_MS = 1000 / 60
const JUMP_KEYS = new Set([' ', 'ArrowUp', 'w', 'z', 'x'])

// ---------------- 絵の じゅんび（ステージごとに 1かいだけ） ----------------

const sceneCache = new Map<string, Scene | null>()
/** ステージの 絵を つくる。canvas が つかえない ところ（テストなど）では null。 */
function sceneFor(stage: StageDef, world: World): Scene | null {
  if (!sceneCache.has(stage.id)) {
    try { sceneCache.set(stage.id, new Scene(world)) } catch { sceneCache.set(stage.id, null) }
  }
  return sceneCache.get(stage.id) ?? null
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** canvas を 画面いっぱいの 大きさに あわせる。 */
function fitCanvas(canvas: HTMLCanvasElement) {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 640, box.height || 360, dpr)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return view
}

function blit(ctx: CanvasRenderingContext2D, img: Img | null, view: { w: number; h: number; scale: number }) {
  if (!img) return
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, view.w * view.scale, view.h * view.scale)
}

/** ドット絵を そのまま 大きく うつす ちいさな canvas。 */
function PixelIcon({ make, className }: { make: () => Img | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const img = make()
    const ctx = canvas?.getContext('2d')
    if (!canvas || !img || !ctx) return
    canvas.width = img.width
    canvas.height = img.height
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
  }, [make])
  return <canvas ref={ref} className={className} aria-hidden="true" />
}

// ---------------- プレイ画面 ----------------

type Hud = { carrots: number; medals: number; progress: number }
type Banner = 'stage' | 'ready' | 'go' | null

function Stage({ index, music, onMusic, onExit, onRetry, onNext }: {
  index: number; music: boolean; onMusic: () => void; onExit: () => void; onRetry: () => void; onNext: () => void
}) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const pointers = useRef(new Set<number>())
  const [hud, setHud] = useState<Hud>({ carrots: 0, medals: 0, progress: 0 })
  const [banner, setBanner] = useState<Banner>('stage')
  const [hint, setHint] = useState(false)
  const [result, setResult] = useState<(RunResult & { best: boolean }) | null>(null)
  const [medalTotal] = useState(() => createWorld(stage).medals.length)

  useEffect(() => {
    if (!music || result) return undefined
    return startBgm(stage.id)
  }, [music, stage.id, result])

  useEffect(() => {
    const world = createWorld(stage)
    worldRef.current = world
    // 開発中だけ ブラウザから じょうたいを のぞけるように する（本番の ビルドには はいらない）。
    if (import.meta.env.DEV) (window as unknown as { __dotRunWorld?: World }).__dotRunWorld = world
    const fx: Fx = createFx()
    const scene = sceneFor(stage, world)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    const still = reducedMotion()
    let view = canvas ? fitCanvas(canvas) : null
    let cam: Cam = view ? cameraTarget(world, view.w, view.h) : { x: 0, y: 0 }
    const measure = () => { if (canvas) view = fitCanvas(canvas) }
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    const timers = [
      setTimeout(() => { setBanner('ready'); playReady(false) }, 700),
    ]
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    const showHint = (ms: number) => {
      setHint(true)
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setHint(false), ms)
    }

    let frame = 0, previous = 0, acc = 0, time = 0, restAt = -1, carrotCombo = 0, lastCarrotAt = -99
    const draw = () => {
      if (!ctx || !scene || !view) return
      const fade = still ? 0 : Math.max(0, 1 - time * 2.2)
      blit(ctx, scene.draw(world, cam, time, fx, view.w, view.h, { fade }), view)
    }
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      acc += elapsed
      let steps = 0
      while (acc >= FRAME_MS && steps < 5) {
        stepWorld(world)
        updateFx(fx, world)
        time += 1 / 60
        acc -= FRAME_MS
        steps++
      }
      if (steps === 5) acc = 0
      for (const event of drainEvents(world)) {
        spawnFx(fx, event, world.frame)
        switch (event.type) {
          case 'go':
            playReady(true)
            setBanner('go')
            timers.push(setTimeout(() => setBanner(null), 800))
            if (index === 0) showHint(3600)
            break
          case 'jump': playJump(); break
          case 'double': playDoubleJump(); break
          case 'carrot':
            carrotCombo = time - lastCarrotAt < .6 ? carrotCombo + 1 : 0
            lastCarrotAt = time
            playCarrot(carrotCombo)
            break
          case 'medal': playMedal(); vibrate('success'); break
          case 'block': playBlock(); break
          case 'stomp': playStomp(); vibrate('tap'); break
          case 'hurt': playHurt(); vibrate('impact'); break
          case 'spring': playSpring(); break
          case 'fall': playFall(); break
          case 'rescue': playRescue(); break
          case 'hint': showHint(3000); break
          case 'goal': playGoal(); vibrate('celebrate'); setHint(false); break
          case 'done': {
            const res = runResult(world)
            const before = progressStore.read()[stage.id] ?? 0
            progressStore.record(stage.id, res.stars)
            setResult({ ...res, best: res.stars > before })
            restAt = time + 4
            break
          }
          default: break
        }
      }
      if (steps) {
        setHud(prev => {
          const next = { carrots: world.got.carrots, medals: world.got.medals, progress: Math.round(progressRatio(world) * 200) / 200 }
          return prev.carrots === next.carrots && prev.medals === next.medals && prev.progress === next.progress ? prev : next
        })
        if (view) {
          const target = cameraTarget(world, view.w, view.h)
          // よこは ぴったり、たては すこし おくれて ついていく。
          cam = { x: target.x, y: cam.y + (target.y - cam.y) * .12 }
        }
        draw()
      }
      // けっかを だして しばらく したら 絵を とめて 電池を まもる。
      if (restAt >= 0 && time > restAt) cancelAnimationFrame(frame)
    }
    draw()
    frame = requestAnimationFrame(tick)

    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (!JUMP_KEYS.has(key)) return
      // ボタンなどを そうさ している ときは じゃましない。
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) return
      e.preventDefault()
      if (e.repeat) return
      primeAudio()
      pressJump(world)
    }
    const keyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (JUMP_KEYS.has(key)) releaseJump(world)
    }
    const blur = () => { pointers.current.clear(); releaseJump(world) }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      clearTimeout(hintTimer)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      worldRef.current = null
    }
  }, [stage, index])

  function down(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const world = worldRef.current
    if (!world) return
    event.preventDefault()
    primeAudio()
    pointers.current.add(event.pointerId)
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pressJump(world)
  }

  function up(event: PointerEvent<HTMLElement>) {
    if (!pointers.current.delete(event.pointerId)) return
    if (pointers.current.size === 0 && worldRef.current) releaseJump(worldRef.current)
  }

  const last = index === STAGES.length - 1
  return <GamePlaySurface><main className={styles.play} data-stage={stage.id}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
      aria-label={`${stage.name}。タップで ジャンプ。ながく おすと たかく とぶよ。スペースキーでも とべるよ`}
      onPointerDown={down} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} />
    <GameBackButton onBack={onExit} />
    <div className={styles.hud}>
      <div className={`${styles.window} ${styles.carrotBox}`} aria-label={`にんじん ${hud.carrots}こ`}>
        <PixelIcon make={carrotImage} className={styles.carrotIcon} />
        <span aria-hidden="true">{hud.carrots}</span>
      </div>
      <div className={`${styles.window} ${styles.medalBox}`} aria-label={`ほしメダル ${hud.medals} / ${medalTotal}`}>
        {Array.from({ length: medalTotal }, (_, i) => <span key={i} className={i < hud.medals ? styles.medalOn : styles.medalOff} aria-hidden="true">★</span>)}
      </div>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
        {music ? '♪' : '×'}
      </button>
    </div>
    <div className={styles.track} role="progressbar" aria-label="ゴールまで" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.progress * 100)}>
      <span className={styles.trackFill} style={{ width: `${hud.progress * 100}%` }} />
      <span className={styles.trackRunner} style={{ left: `${hud.progress * 100}%` }} aria-hidden="true" />
      <span className={styles.trackFlag} aria-hidden="true" />
    </div>
    {banner === 'stage' || banner === 'ready' ? <div className={`${styles.window} ${styles.banner}`} aria-hidden="true">
      <small>ステージ {index + 1}</small>
      <strong>{stage.name}</strong>
      {banner === 'ready' && <em className={styles.ready}>よーい…</em>}
    </div> : null}
    {banner === 'go' && <p className={styles.go} aria-hidden="true">どん！</p>}
    {hint && !result && <p className={styles.hint} role="status">
      <span className={styles.hintHand} aria-hidden="true" />タップで ジャンプ！
    </p>}
    {result && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.resultCard}`} role="dialog" aria-label="ゴール">
        <h2>ゴール！</h2>
        <div className={styles.resultHero}><PixelIcon make={bunnyImage} className={styles.resultBunny} /></div>
        <p className={styles.resultStars} role="img" aria-label={`ほし ${result.stars}こ`}>
          {[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.3 + i * .25}s` }} aria-hidden="true">★</span>)}
        </p>
        <div className={styles.resultRows}>
          <p><PixelIcon make={medalImage} className={styles.rowIcon} />ほしメダル {result.medals} / {result.medalTotal}</p>
          <p><PixelIcon make={carrotImage} className={styles.rowIcon} />にんじん {result.carrots} / {result.carrotTotal}</p>
        </div>
        {result.best && <p className={styles.best}>あたらしい きろく！</p>}
        {result.medals < result.medalTotal && <p className={styles.tip}>たかい ところや あなの うえに ほしメダルが あるよ</p>}
        {last && <p className={styles.tip}>ぜんぶの ステージを はしったよ！</p>}
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>ステージを えらぶ</button>
          <button type="button" onClick={onRetry}>もういちど</button>
          {!last && <button type="button" className={styles.primary} autoFocus onClick={onNext}>つぎへ →</button>}
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- タイトル画面 ----------------

function TitleScreen({ progress, music, onMusic, onPick, focus }: {
  progress: Record<string, number>; music: boolean; onMusic: () => void; onPick: (i: number) => void; focus: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  // よこに スクロールできる ステージの ならび。はしに いるかどうかで やじるしを だしわける。
  const [edges, setEdges] = useState({ start: true, end: true, active: 0 })
  const measureList = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const max = list.scrollWidth - list.clientWidth
    const ratio = max > 0 ? list.scrollLeft / max : 0
    const next = { start: list.scrollLeft <= 4, end: list.scrollLeft >= max - 4, active: Math.round(ratio * (STAGES.length - 1)) }
    setEdges(prev => prev.start === next.start && prev.end === next.end && prev.active === next.active ? prev : next)
  }, [])
  const scrollStages = (dir: number) => {
    const list = listRef.current
    list?.scrollBy?.({ left: dir * list.clientWidth * .75, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  useEffect(() => {
    const list = listRef.current
    // まえに あそんだ ステージが みえる ところから はじめる。
    const card = list?.children[focus] as HTMLElement | undefined
    if (list && card && focus > 0) list.scrollLeft = card.offsetLeft - (list.clientWidth - card.offsetWidth) / 2
    measureList()
    window.addEventListener('resize', measureList)
    return () => window.removeEventListener('resize', measureList)
  }, [focus, measureList])

  // うしろで うさぎが じぶんで はしる おてほん。
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    const stage = STAGES[0]
    let world = createWorld(stage)
    const scene = sceneFor(stage, world)
    if (!scene) return undefined
    let fx = createFx()
    let view = fitCanvas(canvas)
    const measure = () => { view = fitCanvas(canvas) }
    window.addEventListener('resize', measure)
    const still = reducedMotion()
    let time = 0, frame = 0, previous = 0, acc = 0
    const reset = () => {
      world = createWorld(stage)
      fx = createFx()
      for (let i = 0; i < READY_FRAMES; i++) stepWorld(world)
    }
    reset()
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      acc += elapsed
      while (acc >= FRAME_MS) {
        autoPilot(world)
        stepWorld(world)
        for (const e of drainEvents(world)) spawnFx(fx, e, world.frame)
        updateFx(fx, world)
        time += 1 / 60
        acc -= FRAME_MS
      }
      if (world.state === 'done') reset()
      const cam = cameraTarget(world, view.w, view.h)
      blit(ctx, scene.draw(world, cam, time, fx, view.w, view.h, { fade: still ? 0 : Math.max(0, 1 - time * 1.5) }), view)
      if (still) cancelAnimationFrame(frame)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure) }
  }, [])

  // ステージの ちいさな え（すこしずつ つくって 画面を かためない）。
  useEffect(() => {
    let cancelled = false
    const timers = STAGES.map((stage, i) => setTimeout(() => {
      if (cancelled) return
      const world = createWorld(stage)
      const scene = sceneFor(stage, world)
      if (!scene) return
      world.hero.x = 22 * 16
      const w = 200, h = 112
      const img = scene.draw(world, { x: 20 * 16, y: 160 - h + 6 }, 3, createFx(), w, h)
      try { const url = img?.toDataURL(); if (url) setThumbs(t => ({ ...t, [stage.id]: url })) } catch { /* え なしで つづける */ }
    }, 150 + i * 120))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [])

  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <GameBackButton to="/" />
    <button type="button" className={`${styles.window} ${styles.titleMusic}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪ おんがく' : '× おんがく'}
    </button>
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>〜 うさぎの にんじん だいぼうけん 〜</p>
        <h1>{TITLE}</h1>
      </header>
      <div className={styles.stageScroller} data-start={edges.start} data-end={edges.end}>
      {!edges.start && <button type="button" className={`${styles.window} ${styles.scrollArrow} ${styles.scrollPrev}`} aria-label="まえの ステージを みる" onClick={() => scrollStages(-1)}>◀</button>}
      <ol ref={listRef} className={styles.stageList} aria-label="ステージを えらぶ" onScroll={measureList}>
        {STAGES.map((stage, i) => {
          const stars = progress[stage.id] ?? 0
          return <li key={stage.id}>
            <button type="button" className={`${styles.window} ${styles.stageCard}`} data-stage={stage.id}
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
      {!edges.end && <button type="button" className={`${styles.window} ${styles.scrollArrow} ${styles.scrollNext}`} aria-label="つぎの ステージを みる" onClick={() => scrollStages(1)}>▶</button>}
      </div>
      {!(edges.start && edges.end) && <div className={styles.scrollDots} aria-hidden="true">
        {STAGES.map((stage, i) => <span key={stage.id} className={i === edges.active ? styles.dotOn : styles.dot} />)}
      </div>}
      <p className={styles.titleFoot}><span>タップで ジャンプ！</span> <span>ながく おすと たかく、</span><span>くうちゅうで もう1かい とべるよ</span></p>
    </div>
  </main>
}

export default function DotRunPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [lastIndex, setLastIndex] = useState(0)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState(() => progressStore.read())
  const [music, setMusic] = useState(() => readMusic())
  const toggleMusic = useCallback(() => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m }), [])
  const play = (i: number | null) => {
    setProgress(progressStore.read())
    setAttempt(a => a + 1)
    if (i !== null) setLastIndex(i)
    setIndex(i)
  }

  if (index === null) return <TitleScreen progress={progress} music={music} onMusic={toggleMusic} onPick={play} focus={lastIndex} />
  return <Stage key={`${index}-${attempt}`} index={index} music={music} onMusic={toggleMusic}
    onExit={() => play(null)}
    onRetry={() => play(index)}
    onNext={() => play(index + 1 < STAGES.length ? index + 1 : null)} />
}
