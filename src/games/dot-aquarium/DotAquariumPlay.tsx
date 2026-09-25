import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import {
  DECOR, FOODS, MAX_CREATURES, MAX_DECOR, SPECIES, decorDef, foodDef, hiki, speciesDef,
  type DecorKind, type FoodKind, type SpeciesId,
} from './data'
import {
  addCreature, addDecor, checkCreature, checkDecor, checkFood, countDecor, countSpecies, creatureAt, createWorld, dayPhase,
  decorAt, drainEvents, dropFood, poke, rating, removeCreature, removeDecor, resizeWorld, skipTime, startle, stepWorld,
  touchDecor, wipe, SURFACE, type World,
} from './sim'
import { AquaRenderer, ICON_LIST, type Ghost, type Hover, type View } from './render'
import { clearTank, readMusic, readTank, starterTank, writeMusic, writeTank } from './save'
import {
  playBubbleSound, playClamSound, playCleanSound, playDropSound, playHappySound, playKnockSound, playMunchSound, playNoSound,
  playPearlSound, playPlaceSound, playPuffSound, playRemoveSound, playTapSound, playTimeSound, playWipeSound, startBgm,
} from './sounds'
import styles from './DotAquariumPlay.module.css'

const TITLE = 'ドットの すいぞくかん'
/** スマホを たてに もっている とき（よこむきに してもらう）。 */
const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)'

type Tab = 'creature' | 'decor' | 'food' | 'wipe' | 'remove'
type Pick = { tab: 'creature'; id: SpeciesId } | { tab: 'decor'; id: DecorKind } | { tab: 'food'; id: FoodKind } | null

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

/** 画面の 大きさから ドットの 大きさ（せいすうばい）と すいそうの ドットすうを きめる。 */
function viewSize(cssW: number, cssH: number, dpr: number) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  let scale = Math.max(1, Math.round(dh / 200))
  while (scale > 1 && dw / scale < 300) scale--
  return { W: Math.ceil(dw / scale), H: Math.ceil(dh / scale), scale, dw, dh }
}

function fitCanvas(canvas: HTMLCanvasElement) {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 640, box.height || 360, dpr)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return { ...view, dpr }
}

const PHASE_LABEL = { morning: 'あさ', day: 'ひる', evening: 'ゆうがた', night: 'よる' } as const

type Hud = { creatures: number; decor: number; stars: number; pearls: number; phase: keyof typeof PHASE_LABEL; counts: Record<string, number> }

function hudOf(world: World): Hud {
  const counts: Record<string, number> = {}
  for (const s of SPECIES) counts[s.id] = countSpecies(world, s.id)
  for (const d of DECOR) counts[d.kind] = countDecor(world, d.kind)
  return { creatures: world.creatures.length, decor: world.decor.length, stars: rating(world), pearls: world.pearls, phase: dayPhase(world.clock), counts }
}

function sameHud(a: Hud, b: Hud) {
  return a.creatures === b.creatures && a.decor === b.decor && a.stars === b.stars && a.pearls === b.pearls && a.phase === b.phase
    && Object.keys(a.counts).every(k => a.counts[k] === b.counts[k])
}

type Info = { id: number; name: string; eats: FoodKind[]; likes: DecorKind[]; hunger: number; mood: number; sleeping: boolean }

function infoOf(world: World, id: number): Info | null {
  const c = world.creatures.find(x => x.id === id)
  if (!c) return null
  const def = speciesDef(c.species)
  return { id: c.id, name: def.name, eats: [...def.eats], likes: [...def.likes], hunger: c.hunger, mood: c.mood, sleeping: c.sleep }
}

// ---------------- プレイ画面 ----------------

function Tank({ initial, music, onMusic, onExit }: { initial: World; music: boolean; onMusic: () => void; onExit: () => void }) {
  useGameIntroPlaying(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World>(initial)
  const renderer = useMemo(() => new AquaRenderer(), [])
  const viewRef = useRef<View>({ time: 0, still: reducedMotion() })
  const scaleRef = useRef(1)
  const hoverRef = useRef<Hover | null>(null)
  const pickRef = useRef<Pick>(null)
  const tabRef = useRef<Tab | null>(null)
  const pointer = useRef<{ id: number | null; x: number; y: number; touch: boolean; wiped: number }>({ id: null, x: 0, y: 0, touch: false, wiped: 0 })
  const [tab, setTab] = useState<Tab | null>(null)
  const [pick, setPick] = useState<Pick>(null)
  const [hidden, setHidden] = useState(false)
  const [hud, setHud] = useState<Hud>(() => hudOf(initial))
  const [message, setMessage] = useState<{ id: number; text: string; bad?: boolean } | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const infoIdRef = useRef<number | null>(null)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const messageId = useRef(0)
  const told = useRef({ moss: false, clam: 0, sand: false })
  const [night, setNight] = useState(initial.night)

  useEffect(() => { pickRef.current = pick }, [pick])
  useEffect(() => { tabRef.current = tab }, [tab])

  const say = useCallback((text: string, bad = false) => setMessage({ id: messageId.current++, text, bad }), [])
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(m => (m?.id === message.id ? null : m)), message.bad ? 3200 : 2800)
    return () => clearTimeout(timer)
  }, [message])

  // BGM は ひる と よるで かえる。
  useEffect(() => {
    if (!music) return undefined
    return startBgm(night ? 'night' : 'day')
  }, [music, night])

  // トレイの え（すこしずつ つくる）。
  useEffect(() => {
    let cancelled = false
    let i = 0
    const timer = setInterval(() => {
      if (cancelled) return
      const batch: Record<string, string> = {}
      for (let k = 0; k < 3 && i < ICON_LIST.length; k++, i++) {
        const [kind, id] = ICON_LIST[i]
        const url = renderer.iconUrl(kind, id)
        if (url) batch[`${kind}:${id}`] = url
      }
      if (Object.keys(batch).length) setIcons(prev => ({ ...prev, ...batch }))
      if (i >= ICON_LIST.length) clearInterval(timer)
    }, 30)
    return () => { cancelled = true; clearInterval(timer) }
  }, [renderer])

  useEffect(() => {
    const world = worldRef.current
    if (import.meta.env.DEV) (window as unknown as { __dotAquarium?: World }).__dotAquarium = world
    const canvas = canvasRef.current
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas?.getContext('2d') ?? null } catch { ctx = null }
    const view = viewRef.current
    let size = canvas ? fitCanvas(canvas) : null
    const measure = () => {
      if (!canvas) return
      size = fitCanvas(canvas)
      scaleRef.current = size.scale
      resizeWorld(world, size.W, size.H)
    }
    measure()
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)

    let frame = 0, previous = 0, saveTimer = 0, hudTimer = 0
    const handleEvents = () => {
      for (const e of drainEvents(world)) {
        if (e.type === 'eat') {
          playMunchSound()
          renderer.burst('crumb', e.x, e.y, 5, e.food === 'flake' ? '#ff9a3a' : e.food === 'pellet' ? '#b85a28' : '#f26a34')
        } else if (e.type === 'full') {
          playHappySound()
          renderer.burst('heart', e.c.x, e.c.y - 8, 2)
        } else if (e.type === 'happy') {
          renderer.burst('note', e.c.x, e.c.y - 8, 1)
        } else if (e.type === 'puff') {
          playPuffSound()
          renderer.burst('bubble', e.c.x, e.c.y, 4)
        } else if (e.type === 'hide') {
          renderer.burst('crumb', e.c.homeX, e.c.y + 8, 4, '#e0c48c')
        } else if (e.type === 'wave') {
          renderer.burst('bubble', e.c.x, e.c.y - 4, 2)
        } else if (e.type === 'breathe') {
          renderer.burst('splash', e.c.x, SURFACE - 1, 1)
          renderer.burst('bubble', e.c.x, e.c.y, 5)
        } else if (e.type === 'chest') {
          playBubbleSound()
        } else if (e.type === 'clam') {
          playClamSound()
          if (e.d.pearl && view.time - told.current.clam > 50) { told.current.clam = view.time; say('シャコガイが ひらいた！ しんじゅを タップしてね') }
        } else if (e.type === 'pearl') {
          playPearlSound()
          renderer.burst('spark', e.d.x, world.H - 30, 8)
        } else if (e.type === 'moss') {
          if (!told.current.moss) { told.current.moss = true; say('ガラスに コケが ついたよ。「そうじ」で ふいてね') }
        } else if (e.type === 'settle') {
          if (!told.current.sand && !world.creatures.some(c => c.species === 'crab')) { told.current.sand = true; say('のこった えさは しずんで よごれに なるよ') }
        } else if (e.type === 'night') { playTimeSound(true); say('よるに なったよ。クラゲが ひかる…'); setNight(true) }
        else if (e.type === 'morning') { playTimeSound(false); say('あさだよ！ みんな おきてきた'); setNight(false) }
      }
    }
    const tick = (now: number) => {
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      view.time += dt
      let left = dt
      while (left > 0) { const s = Math.min(.05, left); stepWorld(world, s); left -= s }
      handleEvents()
      if (ctx && size) renderer.draw(ctx, world, view, hoverRef.current, dt, size.scale)
      hudTimer += dt
      if (hudTimer > .4) {
        hudTimer = 0
        const next = hudOf(world)
        setHud(prev => (sameHud(prev, next) ? prev : next))
        const id = infoIdRef.current
        if (id !== null) {
          const n = infoOf(world, id)
          setInfo(prev => (!n ? null : prev && Math.abs(prev.hunger - n.hunger) < .02 && Math.abs(prev.mood - n.mood) < .02 && prev.sleeping === n.sleeping ? prev : n))
        }
      }
      saveTimer += dt
      if (saveTimer > 5) { saveTimer = 0; writeTank(world) }
    }
    frame = requestAnimationFrame(tick)
    const flush = () => writeTank(world)
    window.addEventListener('pagehide', flush)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('pagehide', flush)
      writeTank(world)
    }
  }, [renderer, say])

  function logical(event: PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = event.currentTarget.getBoundingClientRect()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const s = scaleRef.current
    return [(event.clientX - box.left) * dpr / s, (event.clientY - box.top) * dpr / s]
  }

  function ghostOf(p: Pick, t: Tab | null): Ghost | null {
    if (t === 'remove') return { kind: 'remove' }
    if (t === 'wipe') return { kind: 'wipe' }
    if (!p) return null
    return p.tab === 'creature' ? { kind: 'creature', species: p.id } : p.tab === 'decor' ? { kind: 'decor', decor: p.id } : { kind: 'food', food: p.id }
  }

  function updateHover(px: number, py: number) {
    const ghost = ghostOf(pickRef.current, tabRef.current)
    if (!ghost) { hoverRef.current = null; return }
    const world = worldRef.current
    let ok = true
    if (ghost.kind === 'creature') ok = checkCreature(world, ghost.species, px, py).ok
    else if (ghost.kind === 'decor') ok = checkDecor(world, ghost.decor, px, py).ok
    else if (ghost.kind === 'food') ok = checkFood(world, ghost.food).ok
    else if (ghost.kind === 'remove') ok = !!(creatureAt(world, px, py) ?? decorAt(world, px, py))
    hoverRef.current = { x: px, y: py, ok, ghost }
  }

  function showInfo(id: number | null) {
    infoIdRef.current = id
    setInfo(id === null ? null : infoOf(worldRef.current, id))
  }

  function act(px: number, py: number) {
    const world = worldRef.current
    const t = tabRef.current, p = pickRef.current
    if (t === 'wipe') { doWipe(px, py, true); return }
    if (t === 'remove') {
      const c = creatureAt(world, px, py)
      const d = c ? null : decorAt(world, px, py)
      if (!c && !d) { playNoSound(); say('かたづけたい ものを タップしてね', true); return }
      playRemoveSound()
      renderer.burst('bubble', px, py, 6)
      if (c) {
        removeCreature(world, c)
        say(`${speciesDef(c.species).name}を うみに かえしたよ`)
        if (infoIdRef.current === c.id) showInfo(null)
      } else if (d) {
        removeDecor(world, d)
        say(`${decorDef(d.kind).name}を かたづけたよ`)
      }
      setHud(hudOf(world))
      writeTank(world)
      return
    }
    if (p?.tab === 'creature') {
      const check = checkCreature(world, p.id, px, py)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      const c = addCreature(world, p.id, px, py)
      playPlaceSound()
      renderer.burst('ring', c.x, c.y, 1)
      renderer.burst('bubble', c.x, c.y, 6)
      const def = speciesDef(p.id)
      const tip = p.id === 'shark' && world.creatures.some(o => speciesDef(o.species).small)
        ? 'ちいさい さかなは サメが ちかづくと にげるよ'
        : p.id === 'clown' && !countDecor(world, 'anemone') ? 'イソギンチャクを おくと よろこぶよ'
          : p.id === 'seahorse' && !countDecor(world, 'kelp') ? 'かいそうを おくと つかまって やすむよ'
            : `すきな えさは ${def.eats.map(f => foodDef(f).name).join('と ')}`
      say(`${def.name}が きたよ！ ${tip}`)
      setHud(hudOf(world))
      writeTank(world)
      if (countSpecies(world, p.id) >= def.limit || world.creatures.length >= MAX_CREATURES) setPick(null)
      return
    }
    if (p?.tab === 'decor') {
      const check = checkDecor(world, p.id, px, py)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      const d = addDecor(world, p.id, px, py)
      playPlaceSound()
      renderer.burst('bubble', d.x, world.H - 30, 8)
      const fans = SPECIES.filter(s => s.likes.includes(p.id)).map(s => s.name)
      say(fans.length ? `${decorDef(p.id).name}を おいたよ。${fans.slice(0, 2).join('と ')}が よろこぶよ` : `${decorDef(p.id).name}を おいたよ`)
      setHud(hudOf(world))
      writeTank(world)
      if (countDecor(world, p.id) >= decorDef(p.id).limit || world.decor.length >= MAX_DECOR) setPick(null)
      return
    }
    if (p?.tab === 'food') {
      const check = checkFood(world, p.id)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      dropFood(world, p.id, px)
      playDropSound()
      renderer.burst('splash', px, SURFACE - 1, 1)
      const fans = world.creatures.filter(c => speciesDef(c.species).eats.includes(p.id))
      say(`${foodDef(p.id).name}だ！ ${speciesDef(fans[0].species).name}たちが くるよ`)
      return
    }
    // なにも えらんで いない ときは さわる。
    const c = creatureAt(world, px, py)
    if (c) {
      poke(world, c)
      showInfo(c.id)
      const def = speciesDef(c.species)
      if (c.species === 'puffer') say('ぷくーっ！ びっくりして ふくらんだ')
      else if (c.species === 'eel') say('チンアナゴが すなに かくれた！')
      else say(`${def.name}「${def.act}」`)
      if (c.species !== 'puffer' && c.species !== 'eel') playTapSound()
      return
    }
    const d = decorAt(world, px, py)
    if (d && (d.kind === 'clam' || d.kind === 'chest')) {
      const r = touchDecor(world, d)
      if (r === 'pearl') say(`しんじゅを みつけた！ ぜんぶで ${world.pearls}こ`)
      else if (r === 'closed') { playTapSound(); say('シャコガイは とじているよ。ひらくのを まってね') }
      else if (r === 'chest') say('たからばこから あわが ぶくぶく！')
      showInfo(null)
      return
    }
    showInfo(null)
    // ガラスを コンコン。
    const n = startle(world, px, py)
    playKnockSound()
    renderer.burst('ring', px, py, 1)
    if (n) say('コンコン！ みんな びっくり')
  }

  function doWipe(px: number, py: number, tap: boolean) {
    const world = worldRef.current
    const n = wipe(world, px, py)
    const ptr = pointer.current
    if (n) {
      ptr.wiped += n
      renderer.burst('spark', px, py, 1)
      if (tap || ptr.wiped % 3 === 1) playWipeSound()
      if (!world.moss.length) { playCleanSound(); say('ピカピカに なった！'); renderer.burst('spark', px, py, 6) }
    } else if (tap) {
      if (!world.moss.length) { playNoSound(); say('いまは コケが ないよ。ピカピカ！', true) }
      else say('みどりの コケを こすって ふいてね')
    }
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    primeAudio()
    const [px, py] = logical(event)
    pointer.current = { id: event.pointerId, x: px, y: py, touch: event.pointerType !== 'mouse', wiped: 0 }
    updateHover(px, py)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const [px, py] = logical(event)
    const ptr = pointer.current
    if (ptr.id !== event.pointerId) {
      if (event.pointerType === 'mouse') updateHover(px, py)
      return
    }
    updateHover(px, py)
    if (tabRef.current === 'wipe') {
      doWipe(px, py, false)
      ptr.x = px; ptr.y = py
    }
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    const ptr = pointer.current
    if (ptr.id !== event.pointerId) return
    ptr.id = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const [px, py] = logical(event)
    if (!(tabRef.current === 'wipe' && ptr.wiped > 0)) act(px, py)
    if (ptr.touch) hoverRef.current = null
    else updateHover(px, py)
  }

  function cancel(event: PointerEvent<HTMLCanvasElement>) {
    if (pointer.current.id !== event.pointerId) return
    pointer.current.id = null
    hoverRef.current = null
  }

  function chooseTab(next: Tab) {
    playTapSound()
    const same = tab === next
    setTab(same ? null : next)
    setPick(null)
    hoverRef.current = null
    showInfo(null)
    if (same) return
    if (next === 'remove') say('かたづけたい いきものや ものを タップしてね')
    else if (next === 'food') say('えさを えらんで、いれたい ところを タップしてね')
    else if (next === 'wipe') say(worldRef.current.moss.length ? 'みどりの コケを こすって ふいてね' : 'いまは ピカピカ！ コケが ついたら ふいてね')
  }

  function choose(p: Exclude<Pick, null>, full: string | null) {
    primeAudio()
    if (full) { playNoSound(); say(full, true); return }
    playTapSound()
    const same = pick && pick.tab === p.tab && pick.id === p.id
    setPick(same ? null : p)
    showInfo(null)
    if (same) return
    if (p.tab === 'creature') say(`${speciesDef(p.id).name}を いれたい ところを タップしてね`)
    else if (p.tab === 'decor') say(`${decorDef(p.id).name}を おきたい ところを タップしてね`)
    else say(`${foodDef(p.id).name}を いれたい ところを タップしてね`)
  }

  function changeTime() {
    playTapSound()
    skipTime(worldRef.current)
  }

  const world = worldRef.current
  const trayItems = tab === 'creature' ? SPECIES.map(s => {
    const n = hud.counts[s.id] ?? 0
    const full = n >= s.limit ? `${s.name}は ${hiki(s.limit)} までだよ` : hud.creatures >= MAX_CREATURES ? `いきものは ぜんぶで ${hiki(MAX_CREATURES)} までだよ` : null
    return { key: s.id, name: s.short ?? s.name, icon: icons[`creature:${s.id}`], badge: `${n}/${s.limit}`, full, active: pick?.tab === 'creature' && pick.id === s.id, onClick: () => choose({ tab: 'creature', id: s.id }, full) }
  }) : tab === 'decor' ? DECOR.map(d => {
    const n = hud.counts[d.kind] ?? 0
    const full = n >= d.limit ? `${d.name}は ${d.limit}こ までだよ` : hud.decor >= MAX_DECOR ? `ものは ぜんぶで ${MAX_DECOR}こ までだよ` : null
    return { key: d.kind, name: d.name, icon: icons[`decor:${d.kind}`], badge: `${n}/${d.limit}`, full, active: pick?.tab === 'decor' && pick.id === d.kind, onClick: () => choose({ tab: 'decor', id: d.kind }, full) }
  }) : tab === 'food' ? FOODS.map(f => ({
    key: f.kind, name: f.name, icon: icons[`food:${f.kind}`], badge: null, full: null, active: pick?.tab === 'food' && pick.id === f.kind,
    onClick: () => choose({ tab: 'food', id: f.kind }, null),
  })) : []

  const tabs: { id: Tab; label: string; mark: string }[] = [
    { id: 'creature', label: 'いきもの', mark: '🐠' },
    { id: 'decor', label: 'もの', mark: '🪨' },
    { id: 'food', label: 'えさ', mark: '🦐' },
    { id: 'wipe', label: 'そうじ', mark: '🧽' },
    { id: 'remove', label: 'かたづけ', mark: '↩' },
  ]

  return <GamePlaySurface><main className={styles.play} data-night={night || undefined}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <div className={styles.stage}>
      <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} data-tool={tab ?? 'look'}
        aria-label="すいそう。したの ボタンで いきものや ものを えらんで、いれたい ところを タップしてね。いきものを タップすると ようすが わかるよ"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
        onPointerLeave={e => { if (e.pointerType === 'mouse' && pointer.current.id === null) hoverRef.current = null }} />
      <GameBackButton onBack={() => { writeTank(world); onExit() }} />

      {!hidden && <div className={`${styles.window} ${styles.status}`}>
        <span className={styles.stars} aria-label={`にんき ほし ${hud.stars}`}>
          {Array.from({ length: 5 }, (_, i) => <span key={i} className={i < hud.stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>)}
        </span>
        <span aria-label={`いきもの ${hud.creatures} / ${MAX_CREATURES}`}>🐠{hud.creatures}<small>/{MAX_CREATURES}</small></span>
        <span aria-label={`もの ${hud.decor} / ${MAX_DECOR}`}>🪨{hud.decor}<small>/{MAX_DECOR}</small></span>
        <span aria-label={`しんじゅ ${hud.pearls}`}><span className={styles.pearl} aria-hidden="true" />{hud.pearls}</span>
      </div>}

      <div className={styles.corner}>
        <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={changeTime} aria-label={`いまは ${PHASE_LABEL[hud.phase]}。${hud.phase === 'night' ? 'あさ' : 'よる'}に する`}>
          <span aria-hidden="true" className={hud.phase === 'night' ? styles.moon : styles.sun}>{hud.phase === 'night' ? '☾' : '☀'}</span>
          <small>{PHASE_LABEL[hud.phase]}</small>
        </button>
        <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
          <span aria-hidden="true">{music ? '♪' : '×'}</span><small>おと</small>
        </button>
        <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={() => { setHidden(h => !h); setTab(null); setPick(null); hoverRef.current = null }} aria-pressed={hidden} aria-label={hidden ? 'ボタンを だす' : 'ながめる'}>
          <span aria-hidden="true">{hidden ? '◎' : '◉'}</span><small>{hidden ? 'もどす' : 'みるだけ'}</small>
        </button>
      </div>

      {message && <div key={message.id} className={`${styles.window} ${styles.message}`} data-bad={message.bad || undefined} role="status">{message.text}</div>}

      {info && !hidden && <aside className={`${styles.window} ${styles.info}`} aria-label={`${info.name}の ようす`}>
        <button type="button" className={styles.close} aria-label="とじる" onClick={() => showInfo(null)}>×</button>
        <h2>{info.name}{info.sleeping && <small> すやすや</small>}</h2>
        <dl>
          <dt>たべもの</dt>
          <dd className={styles.chips}>{info.eats.map(f => <span key={f}>{icons[`food:${f}`] && <img src={icons[`food:${f}`]} alt="" />}{foodDef(f).name}</span>)}</dd>
          <dt>すきな もの</dt>
          <dd className={styles.chips}>{info.likes.map(o => <span key={o}>{icons[`decor:${o}`] && <img src={icons[`decor:${o}`]} alt="" />}{decorDef(o).name}</span>)}</dd>
          <dt>おなか</dt>
          <dd><span className={styles.meter} aria-label={info.hunger > .7 ? 'ぺこぺこ' : info.hunger > .4 ? 'ふつう' : 'いっぱい'}><i style={{ width: `${Math.round((1 - info.hunger) * 100)}%` }} data-low={info.hunger > .7 || undefined} /></span></dd>
          <dt>ごきげん</dt>
          <dd className={styles.hearts} aria-label={`ごきげん ${Math.round(info.mood * 5)} / 5`}>{Array.from({ length: 5 }, (_, i) => <span key={i} data-on={i < Math.round(info.mood * 5) || undefined} aria-hidden="true">♥</span>)}</dd>
        </dl>
      </aside>}
    </div>
    {!hidden && <nav className={styles.dock} aria-label="どうぐ">
      <div className={styles.tabs} data-compact={tab ? true : undefined}>
        {tabs.map(t => <button key={t.id} type="button" className={`${styles.window} ${styles.tab}`} data-active={tab === t.id || undefined} aria-pressed={tab === t.id} onClick={() => chooseTab(t.id)}>
          <span aria-hidden="true">{t.mark}</span>{t.label}
        </button>)}
      </div>
      {tab === 'wipe' && <p className={styles.hint}>みどりの コケを ゆびで こすって ピカピカに しよう</p>}
      {tab === 'remove' && <p className={styles.hint}>かたづけたい いきものや ものを タップしてね</p>}
      {tab && tab !== 'remove' && tab !== 'wipe' && <div className={`${styles.window} ${styles.tray}`} role="group" aria-label={tabs.find(t => t.id === tab)?.label}>
        {trayItems.map(item => <button key={item.key} type="button" className={styles.item} data-active={item.active || undefined} data-full={item.full ? true : undefined}
          aria-pressed={item.active} aria-label={`${item.name}${item.badge ? ` ${item.badge}` : ''}${item.full ? ' いっぱい' : ''}`} onClick={item.onClick}>
          <span className={styles.itemIcon}>{item.icon ? <img src={item.icon} alt="" /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}</span>
          <span className={styles.itemName} data-long={item.name.length > 5 || undefined}>{item.name}</span>
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
        </button>)}
      </div>}
    </nav>}
  </main></GamePlaySurface>
}

// ---------------- タイトル ----------------

function TitleScreen({ hasSave, music, onMusic, onStart }: { hasSave: boolean; music: boolean; onMusic: () => void; onStart: (mode: 'continue' | 'starter' | 'empty') => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [confirmNew, setConfirmNew] = useState<null | 'starter' | 'empty'>(null)

  // うしろで すいそうが うごく。
  useEffect(() => {
    const canvas = canvasRef.current
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas?.getContext('2d') ?? null } catch { ctx = null }
    if (!canvas || !ctx) return undefined
    let size = fitCanvas(canvas)
    const world = starterTank(size.W, size.H)
    world.clock = .3
    const renderer = new AquaRenderer()
    const view: View = { time: 0, still: reducedMotion() }
    const measure = () => { size = fitCanvas(canvas); resizeWorld(world, size.W, size.H) }
    window.addEventListener('resize', measure)
    let frame = 0, previous = 0
    const tick = (now: number) => {
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      view.time += dt
      stepWorld(world, dt)
      drainEvents(world)
      world.clock = .3
      world.moss = []
      renderer.draw(ctx!, world, view, null, dt, size.scale)
      if (view.still) cancelAnimationFrame(frame)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure) }
  }, [])

  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <GameBackButton to="/" />
    <button type="button" className={`${styles.window} ${styles.titleMusic}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪ おんがく' : '× おんがく'}
    </button>
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>〜 じぶんだけの すいそうを つくろう 〜</p>
        <h1>{TITLE}</h1>
      </header>
      {confirmNew ? <div className={`${styles.window} ${styles.menu}`} role="group" aria-label="はじめから つくる">
        <p className={styles.menuNote}>いまの すいそうは きえちゃうけど いい？</p>
        <button type="button" className={styles.menuButton} autoFocus onClick={() => onStart(confirmNew)}>▶ はい、あたらしく つくる</button>
        <button type="button" className={styles.menuButton} onClick={() => setConfirmNew(null)}>▶ やめる</button>
      </div> : <div className={`${styles.window} ${styles.menu}`} role="group" aria-label="メニュー">
        {hasSave && <button type="button" className={styles.menuButton} autoFocus onClick={() => onStart('continue')}>▶ つづきから</button>}
        <button type="button" className={styles.menuButton} autoFocus={!hasSave} onClick={() => (hasSave ? setConfirmNew('starter') : onStart('starter'))}>▶ いきものと はじめる</button>
        <button type="button" className={styles.menuButton} onClick={() => (hasSave ? setConfirmNew('empty') : onStart('empty'))}>▶ からっぽから つくる</button>
      </div>}
    </div>
  </main>
}

function OrientationGuide() {
  return <main className={styles.rotate}>
    <GameBackButton to="/" />
    <section className={styles.rotateCard} aria-label="横向きであそぶ案内">
      <span className={styles.rotateIcon} aria-hidden="true">↻</span>
      <h1>{TITLE}</h1>
      <p className={styles.rotateLead}>よこにして あそんでね</p>
      <p>スマホを よこむきに すると<br />ひろい すいそうを つくれるよ</p>
    </section>
  </main>
}

export default function DotAquariumPlay() {
  const portrait = usePortraitPhone()
  const [world, setWorld] = useState<World | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [music, setMusic] = useState(() => readMusic())
  const [hasSave, setHasSave] = useState(() => readTank() !== null)
  const toggleMusic = () => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m })

  function start(mode: 'continue' | 'starter' | 'empty') {
    primeAudio()
    let next: World | null = null
    if (mode === 'continue') next = readTank()
    if (!next && mode !== 'empty') { clearTank(); next = starterTank() }
    if (!next) { clearTank(); next = createWorld(Date.now() & 0xffff) }
    writeTank(next)
    setAttempt(a => a + 1)
    setWorld(next)
  }

  if (portrait) return <OrientationGuide />
  if (!world) return <TitleScreen hasSave={hasSave} music={music} onMusic={toggleMusic} onStart={start} />
  return <Tank key={attempt} initial={world} music={music} onMusic={toggleMusic} onExit={() => { setHasSave(readTank() !== null); setWorld(null) }} />
}
