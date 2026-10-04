import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent, type ReactNode } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import type { Dir, World, WorldEvent } from './core'
import { createWorld, drainEvents, pressBomb, pressSkill, setDir, stageResult, stepWorld, type StageResult } from './world'
import { Scene, eggSprite, heroImage, heroOuchImage, itemIconImage, rideImage } from './render'
import { createFx, spawnFx, updateFx } from './fx'
import { BOSS_NAMES, RIDES, STAGES, type RideColor } from './stages'
import { progressStore } from './progress'
import * as snd from './sounds'
import { blit, fitCanvas, reducedMotion } from './view'
import PixelIcon from './PixelIcon'
import styles from './DotBomb.module.css'

const FRAME_MS = 1000 / 60
const DIR_KEYS: Record<string, Dir> = { ArrowUp: 0, w: 0, ArrowRight: 1, d: 1, ArrowDown: 2, s: 2, ArrowLeft: 3, a: 3 }
const BOMB_KEYS = new Set([' ', 'z', 'j', 'Enter'])
const SKILL_KEYS = new Set(['x', 'k', 'Shift', 'l'])

type Hud = {
  hearts: number; bombs: number; fire: number; speed: number; ride: RideColor | null
  enemies: number; bossHp: number; bossMax: number; star: boolean; ready: boolean
}

function readHud(w: World): Hud {
  const h = w.hero
  return {
    hearts: h.hearts, bombs: h.bombs, fire: h.fire, speed: h.speedLv, ride: h.ride,
    enemies: w.enemies.filter(e => e.dead === 0).length, bossHp: w.boss && w.boss.dead === 0 ? w.boss.hp : 0, bossMax: w.boss?.maxHp ?? 0,
    star: w.stats.star, ready: h.cool === 0,
  }
}

function sameHud(a: Hud, b: Hud) {
  return (Object.keys(a) as (keyof Hud)[]).every(k => a[k] === b[k])
}

const heartIcon = () => itemIconImage('heart')
const bombIcon = () => itemIconImage('bomb')
const fireIcon = () => itemIconImage('fire')
const speedIcon = () => itemIconImage('speed')
const starIcon = () => itemIconImage('star')
const rideIcons: Record<RideColor, () => ReturnType<typeof rideImage>> = {
  green: () => rideImage('green'), blue: () => rideImage('blue'), pink: () => rideImage('pink'), yellow: () => rideImage('yellow'),
}
const goldEggIcon = () => eggSprite('gold')

// ---------------- じゅうじキー ----------------

const ARROWS = ['▲', '▶', '▼', '◀']

function DPad({ onDir }: { onDir: (d: Dir | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const pointer = useRef<number | null>(null)
  const current = useRef<Dir | null>(null)
  const [dir, setDirState] = useState<Dir | null>(null)
  const apply = (d: Dir | null) => {
    if (current.current === d) return
    current.current = d
    setDirState(d)
    onDir(d)
  }
  const update = (e: PointerEvent<HTMLDivElement>) => {
    const box = ref.current?.getBoundingClientRect()
    if (!box) return
    const dx = e.clientX - (box.left + box.width / 2), dy = e.clientY - (box.top + box.height / 2)
    if (Math.hypot(dx, dy) < box.width * .1) { apply(null); return }
    apply(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0))
  }
  const end = (e: PointerEvent<HTMLDivElement>) => {
    if (pointer.current !== e.pointerId) return
    pointer.current = null
    apply(null)
  }
  return <div ref={ref} className={styles.pad} data-dir={dir ?? 'none'} role="group" aria-label="いどう（やじるしキー や WASD でも うごける）"
    onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); primeAudio(); pointer.current = e.pointerId; e.currentTarget.setPointerCapture?.(e.pointerId); update(e) }}
    onPointerMove={e => { if (pointer.current === e.pointerId) update(e) }}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    {ARROWS.map((a, i) => <span key={a} className={`${styles.padArrow} ${dir === i ? styles.padOn : ''}`} data-arrow={i} aria-hidden="true">{a}</span>)}
    <span className={styles.padKnob} data-dir={dir ?? 'none'} aria-hidden="true" />
  </div>
}

// ---------------- どこでも スティック ----------------

/** ボタンや じゅうじ、ダイアログの うえでは スティックを はじめない（ボタンの うごきを じゃましない）。 */
const STICK_SKIP = 'button, a, input, select, textarea, [role="group"], [role="dialog"]'
const STICK_RADIUS = 44
const STICK_DEAD = 10

type Stick = { id: number; ox: number; oy: number; kx: number; ky: number }

/** さわった ところを まんなかに して うごく スティック。ゆびが とおくへ いくと まんなかも ついていく。 */
function useFloatStick(onDir: (d: Dir | null) => void, enabled: boolean) {
  const stick = useRef<Stick | null>(null)
  const current = useRef<Dir | null>(null)
  const [view, setView] = useState<Stick | null>(null)
  const apply = (d: Dir | null) => {
    if (current.current === d) return
    current.current = d
    onDir(d)
  }
  const move = (s: Stick, x: number, y: number) => {
    let dx = x - s.ox, dy = y - s.oy
    const dist = Math.hypot(dx, dy)
    if (dist > STICK_RADIUS) {
      // まんなかを ゆびの ほうへ ひっぱって、はんたいに うごかしたい ときも すぐ きりかわるように する
      s.ox = x - dx / dist * STICK_RADIUS
      s.oy = y - dy / dist * STICK_RADIUS
      dx = x - s.ox; dy = y - s.oy
    }
    s.kx = dx; s.ky = dy
    setView({ ...s })
    if (Math.hypot(dx, dy) < STICK_DEAD) apply(null)
    else apply(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0))
  }
  const end = (e: PointerEvent<HTMLElement>) => {
    if (stick.current?.id !== e.pointerId) return
    stick.current = null
    setView(null)
    apply(null)
  }
  const stop = useCallback(() => {
    stick.current = null
    current.current = null
    setView(null)
  }, [])
  const handlers = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (!enabled || stick.current) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (e.target instanceof Element && e.target.closest(STICK_SKIP)) return
      e.preventDefault()
      primeAudio()
      stick.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, kx: 0, ky: 0 }
      e.currentTarget.setPointerCapture?.(e.pointerId)
      move(stick.current, e.clientX, e.clientY)
    },
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (stick.current?.id === e.pointerId) move(stick.current, e.clientX, e.clientY)
    },
    onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end,
  }
  return { handlers, view, stop }
}

/** ゆびを おいた しゅんかんに うごく ボタン（キーボードの Enter・スペースでも おせる）。 */
function PressButton({ className, label, onPress, children, disabled, ride }: { className: string; label: string; onPress: () => void; children: ReactNode; disabled?: boolean; ride?: string }) {
  return <button type="button" className={className} aria-label={label} aria-disabled={disabled || undefined} data-ride={ride}
    onPointerDown={e => { if (e.button !== 0 && e.pointerType === 'mouse') return; e.preventDefault(); primeAudio(); onPress() }}
    onClick={(e: MouseEvent<HTMLButtonElement>) => { if (e.detail === 0) onPress() }}>
    {children}
  </button>
}

// ---------------- プレイ がめん ----------------

type Props = {
  index: number
  music: boolean
  onMusic: () => void
  onExit: () => void
  onRetry: () => void
  onNext: () => void
}

type Result = StageResult & { best: boolean }

export default function StageScreen({ index, music, onMusic, onExit, onRetry, onNext }: Props) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World | null>(null)
  const padDir = useRef<Dir | null>(null)
  const stickDir = useRef<Dir | null>(null)
  const keyDirs = useRef<Dir[]>([])
  const pausedRef = useRef(false)
  const [hud, setHud] = useState<Hud>(() => readHud(createWorld(stage)))
  const [banner, setBanner] = useState<'ready' | 'go' | null>('ready')
  const [hint, setHint] = useState<string | null>(null)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [missed, setMissed] = useState(false)
  const [song, setSong] = useState<snd.SongId | null>(stage.boss ? 'boss' : stage.world)
  const [bump, setBump] = useState<string | null>(null)
  const stickOn = !paused && !result && !missed
  const float = useFloatStick(d => { stickDir.current = d }, stickOn)
  const stopStick = float.stop

  useEffect(() => {
    if (!music || !song) return undefined
    return snd.startBgm(song)
  }, [music, song])

  const pause = useCallback((on: boolean) => {
    const w = worldRef.current
    if (on && (!w || w.state === 'clear' || w.state === 'miss')) return
    pausedRef.current = on
    setPaused(on)
    if (on) { padDir.current = null; stickDir.current = null; keyDirs.current = []; stopStick() }
  }, [stopStick])

  useEffect(() => {
    const world = createWorld(stage)
    worldRef.current = world
    // 開発中だけ ブラウザから じょうたいを のぞけるように する（本番の ビルドには はいらない）。
    if (import.meta.env.DEV) (window as unknown as { __dotBombWorld?: World }).__dotBombWorld = world
    const fx = createFx()
    let scene: Scene | null = null
    try { scene = new Scene(world) } catch { scene = null }
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    let view = canvas && ctx ? fitCanvas(canvas) : null
    const measure = () => { if (canvas && ctx) view = fitCanvas(canvas) }
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    const timers: ReturnType<typeof setTimeout>[] = [setTimeout(() => snd.playReady(false), 300)]
    let hintTimer: ReturnType<typeof setTimeout> | undefined
    const told = new Set<string>()
    const showHint = (key: string, text: string, ms = 3600, once = true) => {
      if (once && told.has(key)) return
      told.add(key)
      setHint(text)
      clearTimeout(hintTimer)
      hintTimer = setTimeout(() => setHint(null), ms)
    }
    const flashHud = (key: string) => {
      setBump(key)
      timers.push(setTimeout(() => setBump(b => (b === key ? null : b)), 500))
    }
    const tutorial = !!stage.tutorial
    const still = reducedMotion()
    let frame = 0, previous = 0, acc = 0, time = 0, restAt = -1

    const handle = (events: WorldEvent[]) => {
      let booms = 0, power = 0, breaks = 0, bumps = 0
      for (const e of events) {
        if (scene) spawnFx(fx, e, world, scene.theme)
        if (still) { fx.shake = 0; fx.flash = 0 }
        switch (e.type) {
          case 'go':
            snd.playReady(true)
            setBanner('go')
            timers.push(setTimeout(() => setBanner(null), 900))
            if (tutorial) showHint('move', 'じゅうじで うごいて、ボンボタンで ボンを おこう！', 4200)
            else if (stage.boss) showHint('boss', `${BOSS_NAMES[stage.boss]}が あらわれた！`, 2600)
            break
          case 'place':
            snd.playPlace()
            vibrate('tap')
            if (tutorial) showHint('flee', 'ボンから はなれて！ ドカーンと なるよ', 2600)
            break
          case 'boom': booms++; power = Math.max(power, e.power); break
          case 'break': breaks++; break
          case 'reveal':
            snd.playReveal(e.kind === 'gold')
            if (e.kind === 'egg') showHint('egg', 'たまごだ！ さわると ピョンタが うまれるよ', 3400)
            else if (e.kind === 'gold') showHint('gold', 'きんいろの たまごだ！ とりに いこう！', 3400)
            else if (tutorial && e.kind !== 'star') showHint('item', 'アイテムを とると つよく なるよ', 3000)
            break
          case 'item':
            snd.playItem(e.kind)
            if (e.kind === 'star') { vibrate('success'); showHint('star', 'ほしの かけらを みつけた！', 2600, false) }
            if (e.kind === 'bomb' || e.kind === 'fire' || e.kind === 'speed' || e.kind === 'heart') flashHud(e.kind)
            break
          case 'hatch': snd.playHatch(); break
          case 'ride':
            snd.playRide()
            vibrate('success')
            showHint(`ride-${e.color}`, `${RIDES[e.color].name}に のった！ みどりの ボタンで ${RIDES[e.color].skill}`, 4200)
            flashHud('ride')
            break
          case 'dismount':
            snd.playDismount()
            vibrate('impact')
            showHint('dismount', 'ピョンタが みがわりに なってくれた！', 2600)
            break
          case 'skill': snd.playSkill(e.skill); break
          case 'land': snd.playLand(); break
          case 'bump': bumps++; break
          case 'enemyHit': if (e.dead) snd.playEnemyDown(); else snd.playClink(); break
          case 'hurt':
            snd.playHurt()
            vibrate('impact')
            flashHud('heart')
            break
          case 'heal': snd.playHeal(); break
          case 'doorOpen':
            snd.playDoorOpen()
            vibrate('success')
            showHint('door', 'とびらが ひらいた！ はいると クリア', 3200)
            break
          case 'warp': snd.playWarp(); break
          case 'ventWarn': {
            const h = world.hero
            if (Math.abs(e.x - h.x) + Math.abs(e.y - h.y) < 120) snd.playRumble()
            break
          }
          case 'bossHit': snd.playBossHit(); vibrate('impact'); break
          case 'bossAct': snd.playBossAct(e.act); break
          case 'bossPop': snd.playBossPop(); break
          case 'bossDown': setSong(null); vibrate('celebrate'); break
          case 'clear':
            setSong(null)
            snd.playClear()
            vibrate('celebrate')
            setHint(null)
            break
          case 'done': {
            const res = stageResult(world)
            const before = progressStore.read()[stage.id] ?? 0
            progressStore.record(stage.id, res.stars)
            setResult({ ...res, best: res.stars > before })
            restAt = time + 4
            break
          }
          case 'miss':
            setSong(null)
            snd.playMiss()
            vibrate('error')
            setHint(null)
            break
          case 'missDone':
            setMissed(true)
            restAt = time + 2
            break
          default: break
        }
      }
      if (booms) { snd.playBoom(booms, power); if (booms > 1) vibrate('impact') }
      if (breaks) snd.playBreak()
      if (bumps) snd.playBump()
    }

    const draw = () => {
      if (!ctx || !scene || !view) return
      blit(ctx, scene.draw(world, fx, time, view.w, view.h), view)
    }
    const currentDir = () => padDir.current ?? stickDir.current ?? keyDirs.current[keyDirs.current.length - 1] ?? null
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden || pausedRef.current) return
      acc += elapsed
      let steps = 0
      while (acc >= FRAME_MS && steps < 5) {
        setDir(world, currentDir())
        stepWorld(world)
        handle(drainEvents(world))
        if (view && scene) updateFx(fx, world, view.w, view.h, scene.theme)
        time += 1 / 60
        acc -= FRAME_MS
        steps++
      }
      if (steps === 5) acc = 0
      if (steps) {
        const next = readHud(world)
        setHud(prev => (sameHud(prev, next) ? prev : next))
        draw()
      }
      if (restAt >= 0 && time > restAt) cancelAnimationFrame(frame)
    }
    draw()
    frame = requestAnimationFrame(tick)

    const keyDown = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) {
        if (key !== 'Escape' && !(key in DIR_KEYS)) return
      }
      if (key === 'Escape' || key === 'p') { e.preventDefault(); pause(!pausedRef.current); return }
      if (pausedRef.current) return
      if (key in DIR_KEYS) {
        e.preventDefault()
        const d = DIR_KEYS[key]
        keyDirs.current = [...keyDirs.current.filter(k => k !== d), d]
        return
      }
      if (BOMB_KEYS.has(key)) { e.preventDefault(); if (!e.repeat) { primeAudio(); pressBomb(world) } return }
      if (SKILL_KEYS.has(key)) { e.preventDefault(); if (!e.repeat) { primeAudio(); pressSkill(world) } }
    }
    const keyUp = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      if (key in DIR_KEYS) keyDirs.current = keyDirs.current.filter(k => k !== DIR_KEYS[key])
    }
    const blur = () => { keyDirs.current = []; padDir.current = null; stickDir.current = null; if (world.state === 'play') pause(true) }
    const visibility = () => { if (document.hidden) blur() }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', blur)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelAnimationFrame(frame)
      timers.forEach(clearTimeout)
      clearTimeout(hintTimer)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', blur)
      document.removeEventListener('visibilitychange', visibility)
      worldRef.current = null
    }
  }, [stage, pause])

  const bomb = () => { const w = worldRef.current; if (w && !pausedRef.current) pressBomb(w) }
  const skill = () => { const w = worldRef.current; if (w && !pausedRef.current) pressSkill(w) }
  const last = index === STAGES.length - 1
  const ride = hud.ride ? RIDES[hud.ride] : null

  return <GamePlaySurface><main className={styles.play} data-world={stage.world} data-stick={stickOn ? 'on' : 'off'} {...float.handlers}>
    <h1 className={styles.srOnly}>ドットの ボンボンぼうけん {stage.no} {stage.name}</h1>
    <div className={styles.board}>
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
        aria-label={`${stage.no} ${stage.name}。じゅうじで うごいて、ボンボタンで ボンを おく。キーボードは やじるしで いどう、スペースで ボン、X で とくぎ`} />
    </div>
    <GameBackButton onBack={onExit} />
    <div className={styles.hudLeft}>
      <div className={`${styles.window} ${styles.hearts} ${bump === 'heart' ? styles.bump : ''}`} role="img" aria-label={`ハート ${hud.hearts}こ`}>
        {Array.from({ length: Math.max(3, hud.hearts) }, (_, i) => <span key={i} className={i < hud.hearts ? styles.heartOn : styles.heartOff}><PixelIcon make={heartIcon} className={styles.hudIcon} /></span>)}
      </div>
      <div className={`${styles.window} ${styles.stats}`}>
        <span className={bump === 'bomb' ? styles.bump : ''} aria-label={`ボン ${hud.bombs}こ`}><PixelIcon make={bombIcon} className={styles.hudIcon} />{hud.bombs}</span>
        <span className={bump === 'fire' ? styles.bump : ''} aria-label={`ひの ながさ ${hud.fire}`}><PixelIcon make={fireIcon} className={styles.hudIcon} />{hud.fire}</span>
        <span className={bump === 'speed' ? styles.bump : ''} aria-label={`はやさ ${hud.speed + 1}`}><PixelIcon make={speedIcon} className={styles.hudIcon} />{hud.speed + 1}</span>
        {hud.star && <span aria-label="ほしの かけら"><PixelIcon make={starIcon} className={styles.hudIcon} /></span>}
      </div>
    </div>
    <div className={styles.hudCenter}>
      <p className={`${styles.window} ${styles.stagePill}`}><small>{stage.no}</small> {stage.name}</p>
      {stage.boss ? (
        <div className={`${styles.window} ${styles.bossBar}`} role="meter" aria-label={`${BOSS_NAMES[stage.boss]}の げんき`} aria-valuemin={0} aria-valuemax={hud.bossMax} aria-valuenow={hud.bossHp}>
          <span className={styles.bossName}>{BOSS_NAMES[stage.boss]}</span>
          <span className={styles.bossTrack}><span className={styles.bossFill} style={{ width: `${hud.bossMax ? hud.bossHp / hud.bossMax * 100 : 0}%` }} /></span>
        </div>
      ) : (
        <p className={`${styles.window} ${styles.enemyCount}`} aria-label={hud.enemies ? `てき のこり ${hud.enemies}` : 'とびらが ひらいた'}>
          {hud.enemies ? <>のこり <b>{hud.enemies}</b></> : <>とびらへ GO!</>}
        </p>
      )}
    </div>
    <div className={styles.hudRight}>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={() => pause(true)} aria-label="ひとやすみ">Ⅱ</button>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>{music ? '♪' : '×'}</button>
    </div>
    <div className={styles.controls}>
      <DPad onDir={d => { padDir.current = d }} />
      <div className={styles.buttons}>
        <PressButton className={`${styles.skillButton} ${ride ? styles.skillOn : ''} ${bump === 'ride' ? styles.bump : ''}`} ride={hud.ride ?? 'none'}
          label={ride ? `とくぎ ${ride.skill}（X キー）` : 'とくぎ（ピョンタに のると つかえる）'} onPress={skill} disabled={!ride}>
          {hud.ride ? <PixelIcon make={rideIcons[hud.ride]} className={styles.skillIcon} /> : <span className={styles.skillEgg}>?</span>}
          <span className={styles.skillText}>{ride ? ride.skill : 'とくぎ'}</span>
        </PressButton>
        <PressButton className={styles.bombButton} label="ボンを おく（スペースキー）" onPress={bomb}>
          <PixelIcon make={bombIcon} className={styles.bombIcon} />
          <span>ボン</span>
        </PressButton>
      </div>
    </div>
    {float.view && <div className={styles.floatStick} style={{ left: float.view.ox, top: float.view.oy }} data-testid="float-stick" aria-hidden="true">
      <span className={styles.floatKnob} style={{ transform: `translate(${float.view.kx}px, ${float.view.ky}px)` }} />
    </div>}
    {banner === 'ready' && <div className={`${styles.window} ${styles.banner}`} aria-hidden="true">
      <small>{stage.no}</small>
      <strong>{stage.name}</strong>
      <em className={styles.ready}>よーい…</em>
    </div>}
    {banner === 'go' && <p className={styles.go} aria-hidden="true">スタート！</p>}
    {hint && !result && !missed && <p className={styles.hint} role="status">{hint}</p>}
    {paused && <div className={styles.overlay}>
      <section className={`${styles.window} ${styles.dialog}`} role="dialog" aria-modal="true" aria-label="ひとやすみ">
        <h2>ひとやすみ</h2>
        <p className={styles.dialogHelp}>じゅうじ（やじるしキー）で うごく・ボン（スペース）で ボン・とくぎ（X）</p>
        <div className={styles.cardButtons}>
          <button type="button" className={styles.primary} autoFocus onClick={() => pause(false)}>▶ つづける</button>
          <button type="button" onClick={onRetry}>さいしょから</button>
          <button type="button" onClick={onExit}>マップへ</button>
        </div>
      </section>
    </div>}
    {result && <div className={styles.overlay}>
      <section className={`${styles.window} ${styles.resultCard}`} role="dialog" aria-label="ステージクリア">
        <h2>{stage.boss ? 'ボスを たおした！' : 'ステージクリア！'}</h2>
        <div className={styles.resultHero}>
          <PixelIcon make={heroImage} className={styles.resultPon} />
          {stage.boss && <PixelIcon make={goldEggIcon} className={styles.resultEgg} />}
        </div>
        <p className={styles.resultStars} role="img" aria-label={`ほし ${result.stars}こ`}>
          {[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.3 + i * .25}s` }} aria-hidden="true">★</span>)}
        </p>
        <ul className={styles.checks}>
          <li className={styles.checkOn}>クリア</li>
          <li className={result.noDamage ? styles.checkOn : styles.checkOff}>ハートを へらさない</li>
          <li className={result.star ? styles.checkOn : styles.checkOff}>ほしの かけらを みつける</li>
        </ul>
        {result.best && <p className={styles.best}>あたらしい きろく！</p>}
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>マップへ</button>
          <button type="button" onClick={onRetry}>もういちど</button>
          <button type="button" className={styles.primary} autoFocus onClick={onNext}>{last ? 'エンディングへ →' : 'つぎへ →'}</button>
        </div>
      </section>
    </div>}
    {missed && <div className={styles.overlay}>
      <section className={`${styles.window} ${styles.resultCard}`} role="dialog" aria-label="ざんねん">
        <h2>ざんねん…</h2>
        <div className={styles.resultHero}><PixelIcon make={heroOuchImage} className={styles.resultPon} /></div>
        <p className={styles.tip}>ボンを おいたら すぐ はなれよう。ピョンタに のると 1かい まもってくれるよ</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>マップへ</button>
          <button type="button" className={styles.primary} autoFocus onClick={onRetry}>もういちど</button>
        </div>
      </section>
    </div>}
  </main></GamePlaySurface>
}
