import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { STAGES, type FriendDef, type StageDef } from './stages'
import { createWorld, drainEvents, friendsJoined, nextGoal, shardsLeft, stepWorld, walkTo, TILE, type Point, type World } from './world'
import { Scene, createFx, spawnFx, updateFx, viewSize, type Fx } from './render'
import { readMusic, readProgress, recordClear, writeMusic, type Progress } from './progress'
import {
  playBumpSound, playChestAppearSound, playFanfare, playJoinSound, playShardSound, playTapSound, playTextBlip, startBgm,
} from './sounds'
import styles from './DotAdventurePlay.module.css'

const TITLE = 'ドットの ぼうけん'
const FRAME_MS = 1000 / 60
/** スマホを たてに もっている とき（よこむきに してもらう）。 */
const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)'
/** たからばこを あけてから けっかを だすまで（びょう）。 */
const RESULT_DELAY = 2.8
const INTRO_SECONDS = .9

// ---------------- 絵の じゅんび（ステージごとに 1かいだけ） ----------------

const sceneCache = new Map<string, Scene | null>()
/** ステージの 絵を つくる。canvas が つかえない ところ（テストなど）では null。 */
function sceneFor(stage: StageDef, world: World): Scene | null {
  if (!sceneCache.has(stage.id)) {
    try { sceneCache.set(stage.id, new Scene(stage, world)) } catch { sceneCache.set(stage.id, null) }
  }
  return sceneCache.get(stage.id) ?? null
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function usePortraitPhone() {
  const query = () => typeof window !== 'undefined' && window.matchMedia?.(PORTRAIT_QUERY).matches === true
  const [portrait, setPortrait] = useState(query)
  useEffect(() => {
    const mq = window.matchMedia?.(PORTRAIT_QUERY)
    if (!mq) return undefined
    const update = () => setPortrait(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return portrait
}

/** canvas を 画面いっぱいの 大きさに あわせる。 */
function fitCanvas(canvas: HTMLCanvasElement) {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 640, box.height || 360, dpr)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return { ...view, dpr, box }
}

// ---------------- メッセージ（SFC の RPG ふうの まど） ----------------

function Dialog({ text, onDone }: { text: string; onDone: () => void }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    let n = 0
    const chars = Array.from(text)
    const typing = setInterval(() => {
      n++
      setShown(n)
      if (n % 2 === 1 && chars[n - 1]?.trim()) playTextBlip()
      if (n >= chars.length) clearInterval(typing)
    }, 45)
    const done = setTimeout(onDone, chars.length * 45 + 1900)
    return () => { clearInterval(typing); clearTimeout(done) }
  }, [text, onDone])
  const chars = Array.from(text)
  return <div className={styles.dialog} role="status">
    <p><span>{chars.slice(0, shown).join('')}</span><span className={styles.hidden} aria-hidden="true">{chars.slice(shown).join('')}</span></p>
    {shown >= chars.length && <i className={styles.cursor} aria-hidden="true">▼</i>}
  </div>
}

// ---------------- プレイ画面 ----------------

type Hud = { left: number; total: number; friends: FriendDef[] }
type Result = { treasure: string; friends: FriendDef[]; total: number }

function Stage({ index, music, onMusic, paused, onExit, onNext }: {
  index: number; music: boolean; onMusic: () => void; paused: boolean; onExit: () => void; onNext: () => void
}) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const treasureRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const fxRef = useRef<Fx | null>(null)
  const viewRef = useRef({ scale: 1, cam: { x: 0, y: 0 } as Point, time: 0 })
  const pointer = useRef<{ id: number | null; last: string; frame: number }>({ id: null, last: '', frame: 0 })
  const keys = useRef(new Set<string>())
  const pausedRef = useRef(paused)
  const [hud, setHud] = useState<Hud>(() => {
    const total = stage.map.join('').split('*').length - 1
    return { left: total, total, friends: [] }
  })
  const [messages, setMessages] = useState<{ id: number; text: string }[]>([])
  const [banner, setBanner] = useState(true)
  const [result, setResult] = useState<Result | null>(null)
  const nextMessageId = useRef(0)
  useEffect(() => { pausedRef.current = paused }, [paused])

  const say = useCallback((text: string) => {
    setMessages(list => [...list, { id: nextMessageId.current++, text }].slice(-3))
  }, [])
  const nextMessage = useCallback(() => setMessages(list => list.slice(1)), [])

  // BGM は おんがく ON の ときだけ。
  useEffect(() => {
    if (!music || result) return undefined
    return startBgm(stage.id)
  }, [music, stage.id, result])

  useEffect(() => {
    const world = createWorld(stage)
    worldRef.current = world
    // 開発中だけ ブラウザから じょうたいを のぞけるように する（本番の ビルドには はいらない）。
    if (import.meta.env.DEV) (window as unknown as { __dotWorld?: World }).__dotWorld = world
    const fx = createFx()
    fxRef.current = fx
    const scene = sceneFor(stage, world)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    const still = reducedMotion()
    const view = viewRef.current
    let size = canvas ? fitCanvas(canvas) : null
    view.scale = size?.scale ?? 1
    view.cam = scene && size ? scene.camera(world.hero, size.w, size.h) : { x: 0, y: 0 }
    view.time = 0
    const measure = () => { if (canvas) { size = fitCanvas(canvas); view.scale = size.scale } }
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    const bannerTimer = setTimeout(() => setBanner(false), 2600)
    const introTimer = setTimeout(() => {
      say(`ほしの かけらを ${world.shards.length}こ あつめよう！`)
      if (index === 0) say('いきたい ところを タップすると あるくよ')
    }, 900)

    let frame = 0, previous = 0, acc = 0, openAt = -1, resultShown = false, restAt = -1
    const draw = () => {
      if (!ctx || !scene || !size) return
      const intro = still ? 1 : Math.min(1, view.time / INTRO_SECONDS)
      const out = scene.draw(world, view.cam, view.time, fx, size.w, size.h, {
        mosaic: intro < 1 ? 1 + (1 - intro) * 14 : 1,
        fade: intro < 1 ? 1 - intro : 0,
        guide: world.state === 'play' && view.time > 3 ? nextGoal(world) : null,
      })
      if (!out) return
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(out, 0, 0, size.w * size.scale, size.h * size.scale)
    }
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (pausedRef.current || document.hidden) return
      acc += elapsed
      let steps = 0
      while (acc >= FRAME_MS && steps < 5) {
        const k = keys.current
        const input = {
          x: (k.has('ArrowRight') || k.has('d') ? 1 : 0) - (k.has('ArrowLeft') || k.has('a') ? 1 : 0),
          y: (k.has('ArrowDown') || k.has('s') ? 1 : 0) - (k.has('ArrowUp') || k.has('w') ? 1 : 0),
        }
        stepWorld(world, input)
        updateFx(fx)
        view.time += 1 / 60
        acc -= FRAME_MS
        steps++
      }
      if (steps === 5) acc = 0
      for (const event of drainEvents(world)) {
        spawnFx(fx, event, view.time)
        if (event.type === 'shard') {
          playShardSound(event.left)
          if (event.left > 0 && event.left <= 2) say(`あと ${event.left}こ！`)
        } else if (event.type === 'join') {
          playJoinSound()
          say(`${event.friend.name}が なかまに なった！`)
        } else if (event.type === 'chest-appear') {
          playChestAppearSound()
          say('たからばこが あらわれた！')
        } else if (event.type === 'chest-open') {
          playFanfare()
          openAt = view.time
          setMessages([])
        } else if (event.type === 'bump') playBumpSound()
      }
      if (steps) {
        setHud(prev => {
          const left = shardsLeft(world)
          const joined = friendsJoined(world)
          return prev.left === left && prev.friends.length === joined ? prev : { left, total: world.shards.length, friends: world.friends.filter(f => f.joined).map(f => f.def) }
        })
      }
      if (openAt >= 0 && !resultShown && view.time - openAt > RESULT_DELAY) {
        resultShown = true
        restAt = view.time + 4
        recordClear(stage.id, friendsJoined(world))
        setResult({ treasure: stage.treasure, friends: world.friends.filter(f => f.joined).map(f => f.def), total: world.friends.length })
      }
      // カメラは すこし おくれて ついていく。
      if (scene && size) {
        const target = scene.camera(world.hero, size.w, size.h)
        view.cam = { x: view.cam.x + (target.x - view.cam.x) * .12, y: view.cam.y + (target.y - view.cam.y) * .12 }
      }
      if (steps) draw()
      // けっかを だして しばらく したら 絵を とめて 電池を まもる。
      if (restAt >= 0 && view.time > restAt) cancelAnimationFrame(frame)
    }
    draw()
    frame = requestAnimationFrame(tick)
    const clearKeys = () => keys.current.clear()
    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(key)) return
      // ボタンなどを そうさ している ときは じゃましない。
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) return
      e.preventDefault()
      primeAudio()
      keys.current.add(key)
    }
    const keyUp = (e: KeyboardEvent) => keys.current.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key)
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', clearKeys)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(bannerTimer)
      clearTimeout(introTimer)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', clearKeys)
      worldRef.current = null
    }
  }, [stage, index, say])

  // けっかの まどに たからものの 絵を かく。
  useEffect(() => {
    const canvas = treasureRef.current
    const world = worldRef.current
    if (!result || !canvas || !world) return
    const img = sceneFor(stage, world)?.treasureImage()
    const ctx = canvas.getContext('2d')
    if (!img || !ctx) return
    canvas.width = img.width
    canvas.height = img.height
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(img, 0, 0)
  }, [result, stage])

  function worldPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const { scale, cam } = viewRef.current
    return {
      x: (event.clientX - box.left) * dpr / scale + Math.round(cam.x),
      y: (event.clientY - box.top) * dpr / scale + Math.round(cam.y) + 4,
    }
  }

  function go(point: Point, mark: boolean) {
    const world = worldRef.current
    if (!world || world.state !== 'play') return
    const ok = walkTo(world, point)
    if (mark && fxRef.current) fxRef.current.marker = { x: point.x, y: point.y - 4, t: viewRef.current.time }
    if (mark) (ok ? playTapSound : playBumpSound)()
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || event.button !== 0) return
    event.preventDefault()
    primeAudio()
    event.currentTarget.focus({ preventScroll: true })
    pointer.current = { id: event.pointerId, last: '', frame: 0 }
    const p = worldPoint(event)
    pointer.current.last = `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`
    go(p, true)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const ptr = pointer.current
    if (ptr.id !== event.pointerId) return
    // おしたまま うごかすと、ゆびを おいかけて あるく。
    const p = worldPoint(event)
    const key = `${Math.floor(p.x / TILE)},${Math.floor(p.y / TILE)}`
    if (key !== ptr.last) { ptr.last = key; go(p, false) }
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current.id !== event.pointerId) return
    pointer.current.id = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  function canvasKey(event: ReactKeyboardEvent<HTMLCanvasElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      nextMessage()
    }
  }

  const last = index === STAGES.length - 1
  const message = messages[0]
  return <GamePlaySurface><main className={styles.play} data-theme={stage.theme}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <GameBackButton onBack={onExit} />
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
      aria-label={`${stage.name}。いきたい ところを タップすると あるくよ。やじるしキーでも うごけるよ`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={up} onKeyDown={canvasKey} />
    <div className={styles.hud}>
      <div className={`${styles.window} ${styles.shardBox}`} aria-label={`ほしの かけら ${hud.total - hud.left} / ${hud.total}`}>
        {Array.from({ length: hud.total }, (_, i) => <span key={i} className={i < hud.total - hud.left ? styles.starOn : styles.starOff} aria-hidden="true">★</span>)}
      </div>
      <div className={`${styles.window} ${styles.friendBox}`} aria-label={`なかま ${hud.friends.length}にん`}>
        <span aria-hidden="true" className={styles.heart}>♥</span>{hud.friends.length}
      </div>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
        {music ? '♪' : '×'}
      </button>
    </div>
    {banner && <div className={`${styles.window} ${styles.banner}`} aria-hidden="true">
      <small>ステージ {index + 1}</small>
      <strong>{stage.name}</strong>
    </div>}
    {message && !result && <Dialog key={message.id} text={message.text} onDone={nextMessage} />}
    {result && <div className={styles.overlay}>
      <div className={`${styles.window} ${styles.resultCard}`} role="dialog" aria-label="たからものを みつけた">
        <h2>たからものを みつけた！</h2>
        <div className={styles.treasureStage}><canvas ref={treasureRef} className={styles.treasure} aria-hidden="true" /></div>
        <p className={styles.treasureName}>{result.treasure}</p>
        <p className={styles.resultNote}>
          {result.friends.length ? `なかま：${result.friends.map(f => f.name).join('・')}` : 'なかまは また こんど さがそう'}
          {result.friends.length === result.total && <b className={styles.perfect}> ぜんいん いっしょ！</b>}
        </p>
        {last && <p className={styles.resultNote}>ぜんぶの ぼうけんを クリアしたよ！</p>}
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>ステージを えらぶ</button>
          <button type="button" className={styles.primary} autoFocus onClick={last ? onExit : onNext}>{last ? 'タイトルへ' : 'つぎの ぼうけんへ →'}</button>
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- タイトル画面 ----------------

function TitleScreen({ progress, music, onMusic, onPick }: { progress: Progress; music: boolean; onMusic: () => void; onPick: (i: number) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [thumbs, setThumbs] = useState<Record<string, string>>({})

  // うしろで もりが ゆっくり うごく。
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    const stage = STAGES[0]
    const world = createWorld(stage)
    world.hero.x = -64
    world.hero.y = -64
    const scene = sceneFor(stage, world)
    if (!scene) return undefined
    const fx = createFx()
    let size = fitCanvas(canvas)
    const measure = () => { size = fitCanvas(canvas) }
    window.addEventListener('resize', measure)
    const still = reducedMotion()
    let time = 0, frame = 0, previous = 0
    const tick = (now: number) => {
      const dt = previous ? Math.min(100, now - previous) / 1000 : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      time += dt
      stepWorld(world)
      updateFx(fx)
      const span = Math.max(0, scene.terrain.pw - size.w)
      const cam = { x: 40 + (span - 80) * (.5 + Math.sin(time * .045) * .5), y: Math.max(0, Math.min(scene.terrain.ph - size.h, 150 + Math.sin(time * .07) * 40)) }
      const out = scene.draw(world, cam, time + 2, fx, size.w, size.h, { fade: Math.max(0, 1 - time * 1.2) })
      if (out) { ctx.imageSmoothingEnabled = false; ctx.drawImage(out, 0, 0, size.w * size.scale, size.h * size.scale) }
      if (still) cancelAnimationFrame(frame)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure) }
  }, [])

  // ステージの ちいさな え（すこしずつ つくって 画面を かためない）。
  useEffect(() => {
    let cancelled = false
    const timers: ReturnType<typeof setTimeout>[] = []
    STAGES.forEach((stage, i) => {
      timers.push(setTimeout(() => {
        if (cancelled) return
        const world = createWorld(stage)
        const scene = sceneFor(stage, world)
        if (!scene) return
        const w = 200, h = 112
        const focus = stage.id === 'ruins' ? { x: 320, y: 200 } : stage.id === 'beach' ? { x: 290, y: 250 } : { x: 250, y: 150 }
        const img = scene.draw(world, scene.camera(focus, w, h), 3, createFx(), w, h)
        try { const url = img?.toDataURL(); if (url) setThumbs(t => ({ ...t, [stage.id]: url })) } catch { /* え なしで つづける */ }
      }, 120 + i * 90))
    })
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [])

  const cleared = STAGES.filter(s => progress[s.id]?.cleared).length
  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <GameBackButton to="/" />
    <button type="button" className={`${styles.window} ${styles.titleMusic}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪ おんがく' : '× おんがく'}
    </button>
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>〜 ほしの かけらを さがして 〜</p>
        <h1>{TITLE}</h1>
      </header>
      <ol className={styles.stageList} aria-label="ステージを えらぶ">
        {STAGES.map((stage, i) => {
          const rec = progress[stage.id]
          return <li key={stage.id}>
            <button type="button" className={`${styles.window} ${styles.stageCard}`} data-cleared={rec?.cleared || undefined}
              aria-label={`ステージ${i + 1} ${stage.name}${rec?.cleared ? ' クリアずみ' : ''}`}
              onClick={() => { primeAudio(); onPick(i) }}>
              <span className={styles.thumb} data-theme={stage.theme}>{thumbs[stage.id] && <img src={thumbs[stage.id]} alt="" />}</span>
              <span className={styles.stageNo}>ステージ {i + 1}</span>
              <span className={styles.stageName}>{stage.name}</span>
              <span className={styles.stageLead}>{stage.lead}</span>
              <span className={styles.stageBadge} aria-hidden="true">{rec?.cleared ? `★ ${stage.treasure}` : '？ たからもの'}</span>
            </button>
          </li>
        })}
      </ol>
      <p className={styles.titleFoot}>たからもの {cleared} / {STAGES.length}</p>
    </div>
  </main>
}

function OrientationGuide({ back = true }: { back?: boolean }) {
  return <main className={styles.rotate}>
    {back && <GameBackButton to="/" />}
    <section className={styles.rotateCard} aria-label="横向きであそぶ案内">
      <span className={styles.rotateIcon} aria-hidden="true">↻</span>
      <h1>{TITLE}</h1>
      <p className={styles.rotateLead}>よこにして あそんでね</p>
      <p>スマホを よこむきに すると<br />ひろい せかいを ぼうけん できるよ</p>
    </section>
  </main>
}

export default function DotAdventurePlay() {
  const portrait = usePortraitPhone()
  const [index, setIndex] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState<Progress>(() => readProgress())
  const [music, setMusic] = useState(() => readMusic())
  const toggleMusic = () => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m })

  if (index === null) {
    if (portrait) return <OrientationGuide />
    return <TitleScreen progress={progress} music={music} onMusic={toggleMusic} onPick={i => { setAttempt(a => a + 1); setIndex(i) }} />
  }
  return <>
    <Stage key={`${index}-${attempt}`} index={index} music={music} onMusic={toggleMusic} paused={portrait}
      onExit={() => { setProgress(readProgress()); setIndex(null) }}
      onNext={() => { setProgress(readProgress()); setAttempt(a => a + 1); setIndex(index + 1 < STAGES.length ? index + 1 : null) }} />
    {portrait && <div className={styles.rotateOverlay}><OrientationGuide back={false} /></div>}
  </>
}
