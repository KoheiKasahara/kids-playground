import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import {
  FOODS, GRID, MAX_ANIMALS, MAX_OBJECTS, OBJECTS, SPECIES, foodName, objectDef, speciesDef,
  type FoodKind, type ObjectKind, type SpeciesId,
} from './data'
import {
  addAnimal, addObject, animalAt, checkAnimal, checkFood, checkObject, cleanPoop, countKind, countSpecies, counter, dayPhase,
  drainEvents, dropFood, pokeAnimal, poopAt, removeAt, removeObject, stepWorld, zooRating, createWorld, DAY_SECONDS, type World,
} from './sim'
import { ZooRenderer, type Ghost, type Hover, type View } from './render'
import { clearZoo, readMusic, readZoo, starterZoo, writeMusic, writeZoo } from './save'
import {
  playCleanSound, playCry, playDropSound, playHappySound, playMunchSound, playNoSound, playPlaceSound, playPoopSound,
  playRemoveSound, playSpinSound, playTapSound, playTimeSound, startBgm,
} from './sounds'
import styles from './DotZooPlay.module.css'

const TITLE = 'ドットの どうぶつえん'
/** スマホを たてに もっている とき（よこむきに してもらう）。 */
const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)'

type Tab = 'animal' | 'object' | 'food' | 'remove'
type Pick = { tab: 'animal'; id: SpeciesId } | { tab: 'object'; id: ObjectKind } | { tab: 'food'; id: FoodKind } | null

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

/** 画面の 大きさから ドットの 大きさ（せいすうばい）を きめる。 */
function viewSize(cssW: number, cssH: number, dpr: number, zoom: number) {
  const dw = Math.max(1, Math.round(cssW * dpr)), dh = Math.max(1, Math.round(cssH * dpr))
  const base = Math.max(1, Math.floor(Math.min(dw / 470, dh / 285)))
  const scale = zoom ? base * 2 : base
  return { w: Math.ceil(dw / scale), h: Math.ceil(dh / scale), scale, dw, dh }
}

function fitCanvas(canvas: HTMLCanvasElement, zoom: number) {
  const box = canvas.getBoundingClientRect()
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(box.width || 640, box.height || 360, dpr, zoom)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return { ...view, dpr }
}

const PHASE_LABEL = { morning: 'あさ', day: 'ひる', evening: 'ゆうがた', night: 'よる' } as const
const PHASE_ICON = { morning: '☀', day: '☀', evening: '☀', night: '☾' } as const

type Hud = { animals: number; objects: number; stars: number; phase: keyof typeof PHASE_LABEL; counts: Record<string, number> }

function hudOf(world: World): Hud {
  const counts: Record<string, number> = {}
  for (const s of SPECIES) counts[s.id] = countSpecies(world, s.id)
  for (const o of OBJECTS) counts[o.kind] = countKind(world, o.kind)
  return { animals: world.animals.length, objects: world.objects.length, stars: zooRating(world), phase: dayPhase(world.clock), counts }
}

function sameHud(a: Hud, b: Hud) {
  return a.animals === b.animals && a.objects === b.objects && a.stars === b.stars && a.phase === b.phase
    && Object.keys(a.counts).every(k => a.counts[k] === b.counts[k])
}

type Info = { id: number; name: string; eats: FoodKind[]; likes: ObjectKind[]; hunger: number; mood: number; sleeping: boolean }

// ---------------- プレイ画面 ----------------

function Zoo({ initial, music, onMusic, onExit }: { initial: World; music: boolean; onMusic: () => void; onExit: () => void }) {
  useGameIntroPlaying(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<World>(initial)
  const renderer = useMemo(() => new ZooRenderer(), [])
  const viewRef = useRef<View>({ w: 480, h: 270, rot: 0, panX: 0, panY: 0, time: 0, squash: 1, still: reducedMotion() })
  const scaleRef = useRef(1)
  const hoverRef = useRef<Hover | null>(null)
  const pickRef = useRef<Pick>(null)
  const tabRef = useRef<Tab | null>(null)
  const spinRef = useRef<{ t: number; dir: 1 | -1; switched: boolean } | null>(null)
  const pointer = useRef<{ id: number | null; x: number; y: number; moved: boolean; panX: number; panY: number; touch: boolean }>({ id: null, x: 0, y: 0, moved: false, panX: 0, panY: 0, touch: false })
  const [tab, setTab] = useState<Tab | null>(null)
  const [pick, setPick] = useState<Pick>(null)
  const [zoom, setZoom] = useState(0)
  const zoomRef = useRef(0)
  const [hidden, setHidden] = useState(false)
  const [hud, setHud] = useState<Hud>(() => hudOf(initial))
  const [message, setMessage] = useState<{ id: number; text: string; bad?: boolean } | null>(null)
  const [info, setInfo] = useState<Info | null>(null)
  const infoIdRef = useRef<number | null>(null)
  const [icons, setIcons] = useState<Record<string, string>>({})
  const messageId = useRef(0)
  const toldPoop = useRef(false)
  const [night, setNight] = useState(initial.night)

  useEffect(() => { pickRef.current = pick }, [pick])
  useEffect(() => { tabRef.current = tab }, [tab])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const say = useCallback((text: string, bad = false) => setMessage({ id: messageId.current++, text, bad }), [])
  useEffect(() => {
    if (!message) return undefined
    const timer = setTimeout(() => setMessage(m => (m?.id === message.id ? null : m)), message.bad ? 3200 : 2600)
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
    const list: ['animal' | 'object' | 'food', string][] = [
      ...SPECIES.map(s => ['animal', s.id] as ['animal', string]),
      ...OBJECTS.map(o => ['object', o.kind] as ['object', string]),
      ...FOODS.map(f => ['food', f.kind] as ['food', string]),
    ]
    let i = 0
    const timer = setInterval(() => {
      if (cancelled) return
      const batch: Record<string, string> = {}
      for (let k = 0; k < 4 && i < list.length; k++, i++) {
        const [kind, id] = list[i]
        const url = renderer.iconUrl(kind, id)
        if (url) batch[`${kind}:${id}`] = url
      }
      if (Object.keys(batch).length) setIcons(prev => ({ ...prev, ...batch }))
      if (i >= list.length) clearInterval(timer)
    }, 30)
    return () => { cancelled = true; clearInterval(timer) }
  }, [renderer])

  useEffect(() => {
    const world = worldRef.current
    if (import.meta.env.DEV) (window as unknown as { __dotZoo?: World }).__dotZoo = world
    const canvas = canvasRef.current
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas?.getContext('2d') ?? null } catch { ctx = null }
    const view = viewRef.current
    let size = canvas ? fitCanvas(canvas, zoomRef.current) : null
    const measure = () => {
      if (!canvas) return
      size = fitCanvas(canvas, zoomRef.current)
      scaleRef.current = size.scale
      view.w = size.w
      view.h = size.h
    }
    measure()
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    const zoomListener = () => measure()
    window.addEventListener('dotzoo:zoom', zoomListener)

    let frame = 0, previous = 0, saveTimer = 0, hudTimer = 0, lastCry = 0
    const handleEvents = () => {
      for (const e of drainEvents(world)) {
        if (e.type === 'eat') {
          playMunchSound()
          renderer.burst('crumb', e.animal.x, .2, e.animal.z, 6, e.food === 'grass' ? '#7cc050' : e.food === 'meat' ? '#c04040' : e.food === 'fish' ? '#a0d0f0' : '#f0c040')
        } else if (e.type === 'ate') {
          playHappySound()
          renderer.burst('heart', e.animal.x, 1, e.animal.z, 3)
        } else if (e.type === 'act') {
          if (view.time - lastCry > 5) { lastCry = view.time; playCry(e.animal.species) }
          if (e.animal.species === 'elephant') renderer.burst('drop', e.animal.x + Math.cos(e.animal.facing) * .9, 1.2, e.animal.z - Math.sin(e.animal.facing) * .9, 14)
          if (e.animal.species === 'rabbit' || e.animal.species === 'monkey') e.animal.hop = 1
        } else if (e.type === 'react') {
          playCry(e.animal.species)
          renderer.burst('note', e.animal.x, 1, e.animal.z, 2)
        } else if (e.type === 'poop') {
          playPoopSound()
          renderer.burst('dust', e.x, .1, e.z, 4, '#b8a070')
          if (!toldPoop.current) { toldPoop.current = true; say('うんちを タップして おそうじ しよう') }
        } else if (e.type === 'friends') renderer.burst('heart', e.x, .9, e.z, 2)
        else if (e.type === 'night') { playTimeSound(true); say('よるに なったよ。みんな おやすみ…'); setNight(true) }
        else if (e.type === 'morning') { playTimeSound(false); say('あさだよ！ みんな おきてきた'); setNight(false) }
      }
    }
    const tick = (now: number) => {
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      view.time += dt
      // かいてんの アニメ（よこに つぶれて もどる）。
      const spin = spinRef.current
      if (spin) {
        spin.t += dt / .34
        if (spin.t >= .5 && !spin.switched) { spin.switched = true; view.rot = (view.rot + spin.dir + 4) % 4 }
        view.squash = Math.max(.02, Math.abs(Math.cos(Math.min(1, spin.t) * Math.PI)))
        if (spin.t >= 1) { spinRef.current = null; view.squash = 1 }
      }
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
          const a = world.animals.find(x => x.id === id)
          setInfo(prev => (!a ? null : prev && Math.abs(prev.hunger - a.hunger) < .02 && Math.abs(prev.mood - a.mood) < .02 && prev.sleeping === (a.state === 'sleep') ? prev : {
            id: a.id, name: speciesDef(a.species).name, eats: [...speciesDef(a.species).eats], likes: [...speciesDef(a.species).likes],
            hunger: a.hunger, mood: a.mood, sleeping: a.state === 'sleep',
          }))
        }
      }
      saveTimer += dt
      if (saveTimer > 5) { saveTimer = 0; writeZoo(world) }
    }
    frame = requestAnimationFrame(tick)
    const keyDown = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, select, textarea, a')) return
      const step = 24
      if (e.key === 'ArrowLeft') view.panX += step
      else if (e.key === 'ArrowRight') view.panX -= step
      else if (e.key === 'ArrowUp') view.panY += step
      else if (e.key === 'ArrowDown') view.panY -= step
      else return
      e.preventDefault()
      clampPan(view)
    }
    window.addEventListener('keydown', keyDown)
    const flush = () => writeZoo(world)
    window.addEventListener('pagehide', flush)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('dotzoo:zoom', zoomListener)
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('pagehide', flush)
      writeZoo(world)
    }
  }, [renderer, say])

  // ズームが かわったら 大きさを はかりなおす。
  useEffect(() => { window.dispatchEvent(new Event('dotzoo:zoom')) }, [zoom])

  function clampPan(view: View) {
    const lim = zoomRef.current ? 200 : 60
    view.panX = Math.max(-lim, Math.min(lim, view.panX))
    view.panY = Math.max(-lim * .7, Math.min(lim * .7, view.panY))
  }

  function logical(event: PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = event.currentTarget.getBoundingClientRect()
    const dpr = Math.min(3, window.devicePixelRatio || 1)
    const s = scaleRef.current
    return [(event.clientX - box.left) * dpr / s, (event.clientY - box.top) * dpr / s]
  }

  function ghostOf(p: Pick, t: Tab | null): Ghost | null {
    if (t === 'remove') return { kind: 'remove' }
    if (!p) return null
    return p.tab === 'animal' ? { kind: 'animal', species: p.id } : p.tab === 'object' ? { kind: 'object', object: p.id } : { kind: 'food', food: p.id }
  }

  function updateHover(px: number, py: number) {
    const p = pickRef.current, t = tabRef.current
    const ghost = ghostOf(p, t)
    if (!ghost) { hoverRef.current = null; return }
    const world = worldRef.current
    const [gx, gz] = renderer.pick(viewRef.current, px, py)
    let tx = Math.floor(gx), tz = Math.floor(gz)
    let ok: boolean
    if (ghost.kind === 'object') { const sz = objectDef(ghost.object).size; tx = Math.round(gx - sz / 2); tz = Math.round(gz - sz / 2) }
    if (ghost.kind === 'animal') ok = checkAnimal(world, ghost.species, tx, tz).ok
    else if (ghost.kind === 'object') ok = checkObject(world, ghost.object, tx, tz).ok
    else if (ghost.kind === 'food') ok = checkFood(world, ghost.food, gx, gz).ok
    else ok = !!(removeTarget(px, py))
    if (tx < -1 || tz < -1 || tx > GRID || tz > GRID) { hoverRef.current = null; return }
    hoverRef.current = { x: tx, z: tz, ok, ghost }
  }

  function removeTarget(px: number, py: number) {
    const world = worldRef.current
    const hit = renderer.hitAt(px, py, 'animal') ?? renderer.hitAt(px, py, 'object')
    if (hit) return true
    const [gx, gz] = renderer.pick(viewRef.current, px, py)
    return animalAt(world, gx, gz) ?? (world.objects.some(o => {
      const s = objectDef(o.kind).size
      return gx >= o.x && gx < o.x + s && gz >= o.z && gz < o.z + s
    }) ? true : null)
  }

  function act(px: number, py: number) {
    const world = worldRef.current
    const view = viewRef.current
    const [gx, gz] = renderer.pick(view, px, py)
    // うんちは いつでも おそうじ できる。
    const poopHit = renderer.hitAt(px, py, 'poop')
    const poop = poopHit ? world.poops.find(p => p.id === poopHit.id) : poopAt(world, gx, gz)
    if (poop && tabRef.current !== 'remove') {
      cleanPoop(world, poop)
      playCleanSound()
      renderer.burst('spark', poop.x, .2, poop.z, 4)
      say('ピカピカに なった！')
      return
    }
    const t = tabRef.current, p = pickRef.current
    if (t === 'remove') {
      const hit = renderer.hitAt(px, py, 'animal') ?? renderer.hitAt(px, py, 'object')
      const target = hit?.kind === 'animal' ? world.animals.find(a => a.id === hit.id) : null
      const obj = hit?.kind === 'object' ? world.objects.find(o => o.id === hit.id) : null
      let res = target ? removeAt(world, target.x, target.z) : null
      if (!res && obj) { removeObject(world, obj); res = { kind: 'object', object: obj.kind } }
      if (!res) res = removeAt(world, gx, gz)
      if (!res) { playNoSound(); say('かたづけたい ものを タップしてね', true); return }
      playRemoveSound()
      renderer.burst('dust', gx, .2, gz, 8)
      say(res.kind === 'animal' ? `${speciesDef(res.species).name}を おうちに かえしたよ` : `${objectDef(res.object).name}を かたづけたよ`)
      if (target && infoIdRef.current === target.id) { infoIdRef.current = null; setInfo(null) }
      setHud(hudOf(world))
      writeZoo(world)
      return
    }
    if (p?.tab === 'animal') {
      const tx = Math.floor(gx), tz = Math.floor(gz)
      const check = checkAnimal(world, p.id, tx, tz)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      const a = addAnimal(world, p.id, tx, tz)
      playPlaceSound()
      playCry(p.id)
      renderer.burst('dust', a.x, .1, a.z, 8)
      const def = speciesDef(p.id)
      say(`${def.name}が きたよ！ すきな たべものは ${def.eats.map(foodName).join('と ')}`)
      setHud(hudOf(world))
      writeZoo(world)
      if (countSpecies(world, p.id) >= def.limit) setPick(null)
      return
    }
    if (p?.tab === 'object') {
      const size = objectDef(p.id).size
      const tx = Math.round(gx - size / 2), tz = Math.round(gz - size / 2)
      const check = checkObject(world, p.id, tx, tz)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      addObject(world, p.id, tx, tz)
      playPlaceSound()
      renderer.burst('dust', tx + size / 2, .1, tz + size / 2, 10)
      const fans = SPECIES.filter(s => s.likes.includes(p.id)).map(s => s.name)
      say(fans.length ? `${objectDef(p.id).name}を おいたよ。${fans.slice(0, 2).join('と ')}が よろこぶよ` : `${objectDef(p.id).name}を おいたよ`)
      setHud(hudOf(world))
      writeZoo(world)
      if (countKind(world, p.id) >= objectDef(p.id).limit) setPick(null)
      return
    }
    if (p?.tab === 'food') {
      const check = checkFood(world, p.id, gx, gz)
      if (!check.ok) { playNoSound(); say(check.reason, true); return }
      dropFood(world, p.id, gx, gz)
      playDropSound()
      const fans = world.animals.filter(a => speciesDef(a.species).eats.includes(p.id) && a.state !== 'sleep')
      if (fans.length) say(`${foodName(p.id)}だ！ ${[...new Set(fans.map(a => speciesDef(a.species).name))].slice(0, 2).join('と ')}が くるよ`)
      return
    }
    // なにも えらんで いない ときは どうぶつを さわる。
    const hit = renderer.hitAt(px, py, 'animal')
    const a = hit ? world.animals.find(x => x.id === hit.id) : animalAt(world, gx, gz)
    if (a) {
      pokeAnimal(world, a)
      infoIdRef.current = a.id
      const def = speciesDef(a.species)
      setInfo({ id: a.id, name: def.name, eats: [...def.eats], likes: [...def.likes], hunger: a.hunger, mood: a.mood, sleeping: a.state === 'sleep' })
      if (a.state === 'sleep') say(`${def.name}は ねているよ。しーっ`)
      else say(`${def.name}「${def.act}」`)
    } else {
      infoIdRef.current = null
      setInfo(null)
    }
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
    event.preventDefault()
    primeAudio()
    const [px, py] = logical(event)
    const view = viewRef.current
    pointer.current = { id: event.pointerId, x: px, y: py, moved: false, panX: view.panX, panY: view.panY, touch: event.pointerType !== 'mouse' }
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
    const dist = Math.hypot(px - ptr.x, py - ptr.y) * scaleRef.current / Math.min(3, window.devicePixelRatio || 1)
    const placing = !!pickRef.current || tabRef.current === 'remove'
    if (dist > 10) ptr.moved = true
    if (placing) { updateHover(px, py); return }
    if (ptr.moved) {
      const view = viewRef.current
      view.panX = ptr.panX + (px - ptr.x)
      view.panY = ptr.panY + (py - ptr.y)
      clampPan(view)
    }
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    const ptr = pointer.current
    if (ptr.id !== event.pointerId) return
    ptr.id = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    const [px, py] = logical(event)
    const placing = !!pickRef.current || tabRef.current === 'remove'
    if (!ptr.moved || placing) act(px, py)
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
    if (!same && next === 'remove') say('かたづけたい どうぶつや ものを タップしてね')
    if (!same && next === 'food') say('えさを えらんで、なげたい ところを タップしてね')
  }

  function choose(p: Exclude<Pick, null>, full: string | null) {
    primeAudio()
    if (full) { playNoSound(); say(full, true); return }
    playTapSound()
    const same = pick && pick.tab === p.tab && pick.id === p.id
    setPick(same ? null : p)
    if (!same) {
      if (p.tab === 'animal') {
        const def = speciesDef(p.id)
        say(def.needsPond && !countKind(worldRef.current, 'pond') ? `${def.name}には いけが いるよ。さきに いけを つくってね` : `${def.name}を おきたい ところを タップしてね`)
      } else if (p.tab === 'object') say(`${objectDef(p.id).name}を おきたい ところを タップしてね`)
      else say(`${foodName(p.id)}を なげたい ところを タップしてね`)
    }
  }

  function rotate(dir: 1 | -1) {
    if (spinRef.current) return
    playSpinSound()
    hoverRef.current = null
    if (viewRef.current.still) viewRef.current.rot = (viewRef.current.rot + dir + 4) % 4
    else spinRef.current = { t: 0, dir, switched: false }
  }

  function toggleZoom() {
    playTapSound()
    const view = viewRef.current
    // ズームの 中心を たもつ。
    view.panX = zoom ? view.panX / 2 : view.panX * 2
    view.panY = zoom ? view.panY / 2 : view.panY * 2
    setZoom(z => (z ? 0 : 1))
  }

  function skipTime() {
    playTapSound()
    const world = worldRef.current
    // つぎの あさ / よるへ。
    const target = world.night ? .97 : .7
    const diff = ((target - world.clock + 1) % 1) * DAY_SECONDS
    stepWorld(world, Math.max(.01, diff - .5))
  }

  const world = worldRef.current
  const trayItems = tab === 'animal' ? SPECIES.map(s => {
    const n = hud.counts[s.id] ?? 0
    const full = n >= s.limit ? `${s.name}は ${s.limit}${counter(s.id)} までだよ` : hud.animals >= MAX_ANIMALS ? `どうぶつは ぜんぶで ${MAX_ANIMALS}とう までだよ` : null
    return { key: s.id, name: s.name, icon: icons[`animal:${s.id}`], badge: `${n}/${s.limit}`, full, active: pick?.tab === 'animal' && pick.id === s.id, onClick: () => choose({ tab: 'animal', id: s.id }, full), note: s.needsPond ? 'いけ' : null }
  }) : tab === 'object' ? OBJECTS.map(o => {
    const n = hud.counts[o.kind] ?? 0
    const full = n >= o.limit ? `${o.name}は ${o.limit}こ までだよ` : hud.objects >= MAX_OBJECTS ? `ものは ぜんぶで ${MAX_OBJECTS}こ までだよ` : null
    return { key: o.kind, name: o.name, icon: icons[`object:${o.kind}`], badge: `${n}/${o.limit}`, full, active: pick?.tab === 'object' && pick.id === o.kind, onClick: () => choose({ tab: 'object', id: o.kind }, full), note: null }
  }) : tab === 'food' ? FOODS.map(f => ({
    key: f.kind, name: f.name, icon: icons[`food:${f.kind}`], badge: null, full: null, active: pick?.tab === 'food' && pick.id === f.kind,
    onClick: () => choose({ tab: 'food', id: f.kind }, null), note: SPECIES.filter(s => s.eats.includes(f.kind)).length ? null : null,
  })) : []

  const tabs: { id: Tab; label: string; mark: string }[] = [
    { id: 'animal', label: 'どうぶつ', mark: '🐾' },
    { id: 'object', label: 'もの', mark: '🌳' },
    { id: 'food', label: 'えさ', mark: '🍖' },
    { id: 'remove', label: 'かたづけ', mark: '🧹' },
  ]

  return <GamePlaySurface><main className={styles.play} data-night={night || undefined}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0} data-tool={tab ?? 'look'}
      aria-label="どうぶつえん。したの ボタンで どうぶつや ものを えらんで、おきたい ところを タップしてね。どうぶつを タップすると ようすが わかるよ"
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerLeave={e => { if (e.pointerType === 'mouse' && pointer.current.id === null) hoverRef.current = null }}
      onWheel={e => { if ((e.deltaY < 0 && !zoom) || (e.deltaY > 0 && zoom)) toggleZoom() }} />
    <GameBackButton onBack={() => { writeZoo(world); onExit() }} />

    {!hidden && <div className={`${styles.window} ${styles.status}`}>
      <span className={styles.stars} aria-label={`にんき ほし ${hud.stars}`}>
        {Array.from({ length: 5 }, (_, i) => <span key={i} className={i < hud.stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>)}
      </span>
      <span aria-label={`どうぶつ ${hud.animals} / ${MAX_ANIMALS}`}>🐾{hud.animals}<small>/{MAX_ANIMALS}</small></span>
      <span aria-label={`もの ${hud.objects} / ${MAX_OBJECTS}`}>🌳{hud.objects}<small>/{MAX_OBJECTS}</small></span>
    </div>}

    <div className={styles.corner}>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={skipTime} aria-label={`いまは ${PHASE_LABEL[hud.phase]}。${hud.phase === 'night' ? 'あさ' : 'よる'}に する`}>
        <span aria-hidden="true" className={hud.phase === 'night' ? styles.moon : styles.sun}>{PHASE_ICON[hud.phase]}</span>
        <small>{PHASE_LABEL[hud.phase]}</small>
      </button>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={() => rotate(1)} aria-label="まわす">
        <span aria-hidden="true">↻</span><small>まわす</small>
      </button>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={toggleZoom} aria-pressed={zoom === 1} aria-label={zoom ? 'ひく' : 'ちかく'}>
        <span aria-hidden="true">{zoom ? '－' : '＋'}</span><small>{zoom ? 'ひく' : 'ちかく'}</small>
      </button>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
        <span aria-hidden="true">{music ? '♪' : '×'}</span><small>おと</small>
      </button>
      <button type="button" className={`${styles.window} ${styles.iconButton}`} onClick={() => { setHidden(h => !h); setTab(null); setPick(null); hoverRef.current = null }} aria-pressed={hidden} aria-label={hidden ? 'ボタンを だす' : 'ながめる'}>
        <span aria-hidden="true">{hidden ? '◎' : '◉'}</span><small>{hidden ? 'もどす' : 'みるだけ'}</small>
      </button>
    </div>

    {!hidden && <nav className={styles.dock} aria-label="どうぐ">
      {tab && tab !== 'remove' && <div className={`${styles.window} ${styles.tray}`} role="group" aria-label={tabs.find(t => t.id === tab)?.label}>
        {trayItems.map(item => <button key={item.key} type="button" className={styles.item} data-active={item.active || undefined} data-full={item.full ? true : undefined}
          aria-pressed={item.active} aria-label={`${item.name}${item.badge ? ` ${item.badge}` : ''}${item.full ? ' いっぱい' : ''}`} onClick={item.onClick}>
          <span className={styles.itemIcon}>{item.icon ? <img src={item.icon} alt="" /> : <span aria-hidden="true">{item.name.slice(0, 1)}</span>}</span>
          <span className={styles.itemName}>{item.name}</span>
          {item.badge && <span className={styles.badge}>{item.badge}</span>}
          {item.note && <span className={styles.note} aria-hidden="true">💧</span>}
        </button>)}
      </div>}
      <div className={styles.tabs}>
        {tabs.map(t => <button key={t.id} type="button" className={`${styles.window} ${styles.tab}`} data-active={tab === t.id || undefined} aria-pressed={tab === t.id} onClick={() => chooseTab(t.id)}>
          <span aria-hidden="true">{t.mark}</span>{t.label}
        </button>)}
      </div>
    </nav>}

    {message && <div key={message.id} className={`${styles.window} ${styles.message}`} data-bad={message.bad || undefined} role="status">{message.text}</div>}

    {info && !hidden && <aside className={`${styles.window} ${styles.info}`} aria-label={`${info.name}の ようす`}>
      <button type="button" className={styles.close} aria-label="とじる" onClick={() => { infoIdRef.current = null; setInfo(null) }}>×</button>
      <h2>{info.name}{info.sleeping && <small> すやすや</small>}</h2>
      <dl>
        <dt>たべもの</dt>
        <dd className={styles.chips}>{info.eats.map(f => <span key={f}>{icons[`food:${f}`] && <img src={icons[`food:${f}`]} alt="" />}{foodName(f)}</span>)}</dd>
        <dt>すきな もの</dt>
        <dd className={styles.chips}>{info.likes.map(o => <span key={o}>{icons[`object:${o}`] && <img src={icons[`object:${o}`]} alt="" />}{objectDef(o).name}</span>)}</dd>
        <dt>おなか</dt>
        <dd><span className={styles.meter} aria-label={info.hunger > .7 ? 'ぺこぺこ' : info.hunger > .4 ? 'ふつう' : 'いっぱい'}><i style={{ width: `${Math.round((1 - info.hunger) * 100)}%` }} data-low={info.hunger > .7 || undefined} /></span></dd>
        <dt>ごきげん</dt>
        <dd className={styles.hearts} aria-label={`ごきげん ${Math.round(info.mood * 5)} / 5`}>{Array.from({ length: 5 }, (_, i) => <span key={i} data-on={i < Math.round(info.mood * 5) || undefined} aria-hidden="true">♥</span>)}</dd>
      </dl>
    </aside>}
  </main></GamePlaySurface>
}

// ---------------- タイトル ----------------

function TitleScreen({ hasSave, music, onMusic, onStart }: { hasSave: boolean; music: boolean; onMusic: () => void; onStart: (mode: 'continue' | 'starter' | 'empty') => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [confirmNew, setConfirmNew] = useState<null | 'starter' | 'empty'>(null)

  // うしろで どうぶつえんが ゆっくり まわる。
  useEffect(() => {
    const canvas = canvasRef.current
    let ctx: CanvasRenderingContext2D | null = null
    try { ctx = canvas?.getContext('2d') ?? null } catch { ctx = null }
    if (!canvas || !ctx) return undefined
    const world = starterZoo()
    const renderer = new ZooRenderer()
    let size = fitCanvas(canvas, 0)
    const view: View = { w: size.w, h: size.h, rot: 0, panX: 0, panY: 22, time: 0, squash: 1, still: reducedMotion() }
    const measure = () => { size = fitCanvas(canvas, 0); view.w = size.w; view.h = size.h }
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
        <p className={styles.logoSub}>〜 じぶんだけの どうぶつえんを つくろう 〜</p>
        <h1>{TITLE}</h1>
      </header>
      {confirmNew ? <div className={`${styles.window} ${styles.menu}`} role="group" aria-label="はじめから つくる">
        <p className={styles.menuNote}>いまの どうぶつえんは きえちゃうけど いい？</p>
        <button type="button" className={styles.menuButton} autoFocus onClick={() => onStart(confirmNew)}>▶ はい、あたらしく つくる</button>
        <button type="button" className={styles.menuButton} onClick={() => setConfirmNew(null)}>▶ やめる</button>
      </div> : <div className={`${styles.window} ${styles.menu}`} role="group" aria-label="メニュー">
        {hasSave && <button type="button" className={styles.menuButton} autoFocus onClick={() => onStart('continue')}>▶ つづきから</button>}
        <button type="button" className={styles.menuButton} autoFocus={!hasSave} onClick={() => (hasSave ? setConfirmNew('starter') : onStart('starter'))}>▶ どうぶつと はじめる</button>
        <button type="button" className={styles.menuButton} onClick={() => (hasSave ? setConfirmNew('empty') : onStart('empty'))}>▶ まっさらから つくる</button>
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
      <p>スマホを よこむきに すると<br />ひろい どうぶつえんを つくれるよ</p>
    </section>
  </main>
}

export default function DotZooPlay() {
  const portrait = usePortraitPhone()
  const [world, setWorld] = useState<World | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [music, setMusic] = useState(() => readMusic())
  const [hasSave, setHasSave] = useState(() => readZoo() !== null)
  const toggleMusic = () => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m })

  function start(mode: 'continue' | 'starter' | 'empty') {
    primeAudio()
    let next: World | null = null
    if (mode === 'continue') next = readZoo()
    if (!next && mode !== 'empty') { clearZoo(); next = starterZoo() }
    if (!next) { clearZoo(); next = createWorld(Date.now() & 0xffff) }
    writeZoo(next)
    setAttempt(a => a + 1)
    setWorld(next)
  }

  if (portrait) return <OrientationGuide />
  if (!world) return <TitleScreen hasSave={hasSave} music={music} onMusic={toggleMusic} onStart={start} />
  return <Zoo key={attempt} initial={world} music={music} onMusic={toggleMusic} onExit={() => { setHasSave(readZoo() !== null); setWorld(null) }} />
}
