import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import {
  MAX_TOPPINGS, NETAS, PLATES, PLATES_PER_GACHA, PRIZES, RICES, STYLES, TOPPINGS, animalDef, netaDef, plateDef, prizeDef,
  type AnimalId, type NetaId, type PrizeId,
} from './data'
import { pickPrize } from './gacha'
import {
  SPEEDS, addRecipe, createLane, drainEvents, expressSeat, laneRecipes, lanePlates, plateAt, sendExpress, stepLane, spendTicket,
  type CustomerPhase, type LaneEvent, type LaneWorld, type Reaction, type SpeedId,
} from './lane'
import { CUSTOMER_BOTTOM, SCENE_H, SCENE_W, SEATS } from './layout'
import { DEFAULT_RECIPE, randomRecipe, recipeDetail, recipeKey, recipeName, toggleTopping, type Recipe } from './recipe'
import { LaneRenderer, chipUrl, context2d, dishUrl, drawPreview, spriteUrl } from './render'
import { readSave, writeSave, type SushiSave } from './save'
import { playSushiSound, type SushiSound } from './sounds'
import { drawCapsule, drawChef, drawCustomer, drawGacha, drawPrize, silhouette } from './sprites'
import { drawPlate, drawRiceIcon, drawStyleIcon, drawSushi, drawToppingIcon, iconRecipe } from './sushiArt'
import styles from './KaitenSushiPlay.module.css'

const TITLE = 'にぎにぎ かいてんずし'

type Screen = 'title' | 'build' | 'lane'
type Step = 'style' | 'rice' | 'neta' | 'topping' | 'plate'

const STEPS: readonly { id: Step; label: string }[] = [
  { id: 'style', label: 'かたち' },
  { id: 'rice', label: 'シャリ' },
  { id: 'neta', label: 'ネタ' },
  { id: 'topping', label: 'のせる' },
  { id: 'plate', label: 'おさら' },
]

const SPEED_LABEL: Record<SpeedId, string> = { slow: 'ゆっくり', normal: 'ふつう', fast: 'はやい' }
const REACTION_WORD: Record<Reaction, string> = { yummy: 'おいしい！', spicy: 'ツーン！', sparkle: 'キラキラ！' }

/** はじめて きた ときに ながれている おみせの おすし。 */
const STARTER: readonly Recipe[] = [
  { style: 'nigiri', rice: 'shiro', neta: 'maguro', toppings: [], plate: 'ao' },
  { style: 'gunkan', rice: 'shiro', neta: 'ikura', toppings: [], plate: 'aka' },
  { style: 'maki', rice: 'shiro', neta: 'kyuri', toppings: [], plate: 'midori' },
]

type CustomerHud = { seat: number; animal: AnimalId; wish: NetaId | null; phase: CustomerPhase; reaction: Reaction | null }
type Hud = { customers: CustomerHud[]; tickets: number; eaten: number; lane: { id: number; recipe: Recipe }[]; served: number[] }

function hudOf(world: LaneWorld): Hud {
  return {
    customers: world.customers.map(({ seat, animal, wish, phase, reaction }) => ({ seat, animal, wish, phase, reaction })),
    tickets: world.tickets,
    eaten: world.eaten,
    lane: lanePlates(world).map(p => ({ id: p.id, recipe: p.recipe })),
    served: world.customers.map(c => c.stack.length),
  }
}

const hudKey = (hud: Hud) => JSON.stringify([hud.customers, hud.tickets, hud.eaten, hud.lane.map(p => p.id), hud.served])

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const nameOf = (animal: AnimalId) => `${animalDef(animal).name}さん`

/** ドット絵の <img>。え が つくれない ところでは もじ で かわりに。 */
function Pixel({ src, alt = '', fallback, className }: { src: string; alt?: string; fallback?: string; className?: string }) {
  if (!src) return <span className={`${styles.pixelFallback} ${className ?? ''}`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{fallback ?? '🍣'}</span>
  return <img className={`${styles.pixel} ${className ?? ''}`} src={src} alt={alt} draggable={false} />
}

type GachaState = { phase: 'ready' | 'spin' | 'drop' } | { phase: 'open'; prize: PrizeId; isNew: boolean }

export default function KaitenSushiPlay() {
  const [boot] = useState(() => {
    const save = readSave()
    const recipes = save.lane.length > 0 || save.eaten > 0 ? save.lane : [...STARTER]
    return { save, world: createLane({ seed: Date.now() % 100000, recipes, eaten: save.eaten, tickets: save.tickets }) }
  })
  const worldRef = useRef<LaneWorld>(boot.world)
  const [screen, setScreen] = useState<Screen>('title')
  const screenRef = useRef<Screen>('title')
  const [recipe, setRecipe] = useState<Recipe>(DEFAULT_RECIPE)
  const [step, setStep] = useState<Step>('style')
  const [done, setDone] = useState<{ express: number | null } | null>(null)
  const [hud, setHud] = useState<Hud>(() => hudOf(boot.world))
  const [message, setMessage] = useState('')
  const [speed, setSpeed] = useState<SpeedId>('normal')
  const [viewing, setViewing] = useState<Recipe | null>(null)
  const [prizes, setPrizes] = useState<PrizeId[]>(boot.save.prizes)
  const prizesRef = useRef<PrizeId[]>(boot.save.prizes)
  const [gacha, setGacha] = useState<GachaState | null>(null)
  const [collection, setCollection] = useState(false)
  const [sound, toggleSound] = useSoundToggle()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const renderer = useMemo(() => new LaneRenderer(), [])
  const [still] = useState(reducedMotion)
  const timers = useRef<number[]>([])
  const playing = screen !== 'title'
  useGameIntroPlaying(playing)

  useEffect(() => {
    screenRef.current = screen
    // がめんを きりかえたら いちばん うえから みせる。
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [screen])

  const sfx = useCallback((kind: SushiSound) => {
    if (screenRef.current !== 'title') playSushiSound(kind)
  }, [])

  const persist = useCallback(() => {
    const world = worldRef.current
    const save: SushiSave = { lane: laneRecipes(world), eaten: world.eaten, tickets: world.tickets, prizes: prizesRef.current }
    writeSave(save)
  }, [])

  const onEvents = useCallback((events: LaneEvent[]) => {
    const world = worldRef.current
    let save = false
    for (const e of events) {
      if (e.type === 'placed') {
        sfx('placed')
        const plate = world.plates.find(p => p.id === e.id)
        if (plate) setMessage(`${recipeName(plate.recipe)}が ながれてきたよ！`)
        save = true
      } else if (e.type === 'removed') {
        sfx('removed')
        setMessage('レーンが いっぱい！ ふるい おすしを さげたよ')
        save = true
      } else if (e.type === 'wish') {
        sfx('wish')
        setMessage(`${nameOf(world.customers[e.seat].animal)}「${netaDef(e.neta).name}が たべたいな」`)
      } else if (e.type === 'grab') {
        sfx('grab')
        if (screenRef.current === 'lane') vibrate('tap')
        setMessage(`${nameOf(world.customers[e.seat].animal)}が ${recipeName(e.recipe)}を とったよ！`)
      } else if (e.type === 'bite') {
        sfx('bite')
      } else if (e.type === 'eaten') {
        sfx(e.reaction === 'spicy' ? 'spicy' : e.reaction === 'sparkle' ? 'sparkle' : 'yummy')
        if (screenRef.current === 'lane') vibrate(e.ticket ? 'celebrate' : 'success')
        const who = nameOf(world.customers[e.seat].animal)
        const line = e.reaction === 'spicy' ? `${who}「ツーン！ わさびが きいてる〜」` : e.reaction === 'sparkle' ? `${who}「キラキラで うれしい！」` : `${who}「おいしい！」`
        setMessage(e.ticket ? `${line} おさら ${PLATES_PER_GACHA}まいで ガチャが まわせるよ！` : line)
        save = true
      } else if (e.type === 'train') {
        sfx(e.phase === 'go' ? 'train' : 'placed')
        if (e.phase === 'go') setMessage('しんかんせんで おとどけ！')
      }
    }
    if (save) persist()
  }, [persist, sfx])

  const onEventsRef = useRef(onEvents)
  useEffect(() => { onEventsRef.current = onEvents }, [onEvents])

  // レーンは どの がめんでも まわりつづける（かいていない ときは え だけ やすむ）。
  useEffect(() => {
    let raf = 0
    let last: number | null = null
    let hudAt = 0
    let lastHud = ''
    const frame = (now: number) => {
      const dt = last === null ? 1 / 60 : Math.min(.1, Math.max(0, (now - last) / 1000))
      last = now
      const world = worldRef.current
      stepLane(world, dt)
      const events = drainEvents(world)
      if (events.length > 0) onEventsRef.current(events)
      const canvas = canvasRef.current
      const ctx = canvas ? context2d(canvas) : null
      if (ctx) renderer.draw(ctx, world, { still })
      if (events.length > 0 || now - hudAt > 250) {
        hudAt = now
        const next = hudOf(world)
        const key = hudKey(next)
        if (key !== lastHud) {
          lastHud = key
          setHud(next)
        }
      }
      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(raf)
  }, [renderer, still])

  useEffect(() => {
    const list = timers.current
    return () => {
      list.forEach(id => window.clearTimeout(id))
      persist()
    }
  }, [persist])

  // canvas の ドットを がめんの こまかさに あわせる（せいすうばいで くっきり）。
  const observeCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node
    if (!node) return undefined
    const fit = () => {
      const width = node.getBoundingClientRect().width || SCENE_W
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      const k = Math.max(1, Math.round((width * dpr) / SCENE_W))
      if (node.width !== SCENE_W * k) node.width = SCENE_W * k
      if (node.height !== SCENE_H * k) node.height = SCENE_H * k
    }
    fit()
    if (typeof ResizeObserver === 'undefined') return () => { canvasRef.current = null }
    const observer = new ResizeObserver(fit)
    observer.observe(node)
    return () => {
      observer.disconnect()
      canvasRef.current = null
    }
  }, [])

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms))
  }, [])

  function go(next: Screen) {
    primeAudio()
    setDone(null)
    setViewing(null)
    setScreen(next)
    vibrate('tap')
    if (next === 'build') playSushiSound('tap')
  }

  function changeRecipe(next: Recipe) {
    primeAudio()
    setRecipe(next)
    playSushiSound('pick')
    vibrate('tap')
  }

  function finish() {
    primeAudio()
    setDone({ express: expressSeat(worldRef.current, recipe.neta) })
    playSushiSound('make')
    vibrate('success')
  }

  function sendToLane(express: number | null) {
    const world = worldRef.current
    if (express !== null) sendExpress(world, recipe, express)
    else addRecipe(world, recipe)
    playSushiSound('send')
    setMessage(express !== null ? `しんかんせんが ${nameOf(world.customers[express].animal)}へ むかうよ！` : 'たいしょうが レーンに のせるよ！')
    go('lane')
  }

  function changeSpeed(id: SpeedId) {
    setSpeed(id)
    worldRef.current.speed = SPEEDS[id]
    playSushiSound('tap')
  }

  function handleScenePointer(event: PointerEvent<HTMLCanvasElement>) {
    if (screenRef.current !== 'lane') return
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const x = ((event.clientX - rect.left) / rect.width) * SCENE_W
    const y = ((event.clientY - rect.top) / rect.height) * SCENE_H
    const plate = plateAt(worldRef.current, x, y)
    if (plate) {
      primeAudio()
      setViewing(plate.recipe)
      playSushiSound('pick')
    }
  }

  function openGacha() {
    primeAudio()
    setGacha({ phase: 'ready' })
    playSushiSound('tap')
  }

  function spinGacha() {
    if (gacha?.phase !== 'ready' || !spendTicket(worldRef.current)) return
    primeAudio()
    setGacha({ phase: 'spin' })
    playSushiSound('gacha')
    vibrate('impact')
    later(700, () => setGacha({ phase: 'drop' }))
    later(1500, () => {
      const owned = prizesRef.current
      const prize = pickPrize(owned)
      const isNew = !owned.includes(prize)
      if (isNew) {
        prizesRef.current = [...owned, prize]
        setPrizes(prizesRef.current)
      }
      setGacha({ phase: 'open', prize, isNew })
      playSushiSound('prize')
      vibrate('celebrate')
      persist()
      setHud(hudOf(worldRef.current))
    })
  }

  function back() {
    if (gacha) { if (gacha.phase === 'ready' || gacha.phase === 'open') setGacha(null); return }
    if (viewing) { setViewing(null); return }
    if (collection) { setCollection(false); return }
    if (done) { setDone(null); return }
    go('title')
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (viewing) setViewing(null)
      else if (collection) setCollection(false)
      else if (done) setDone(null)
      else if (gacha && gacha.phase !== 'spin' && gacha.phase !== 'drop') setGacha(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing, collection, done, gacha])

  const orders = hud.customers.filter(c => c.wish && (c.phase === 'idle' || c.phase === 'waitTrain'))
  const toNext = PLATES_PER_GACHA - (hud.eaten % PLATES_PER_GACHA)

  const scene = (
    <div className={styles.sceneWrap}>
      <canvas
        ref={observeCanvas}
        className={styles.scene}
        width={SCENE_W}
        height={SCENE_H}
        role="img"
        aria-label={`かいてんレーン。おすしが ${hud.lane.length}さら ながれているよ`}
        onPointerDown={handleScenePointer}
      />
      {hud.customers.filter(c => c.phase === 'react' && c.reaction).map(c => (
        <span
          key={`${c.seat}-${hud.served[c.seat]}`}
          className={`${styles.reaction} ${c.reaction === 'spicy' ? styles.reactionSpicy : ''}`}
          style={{ left: `${(SEATS[c.seat] / SCENE_W) * 100}%`, top: `${((CUSTOMER_BOTTOM - 50) / SCENE_H) * 100}%` }}
          aria-hidden="true"
        >
          {REACTION_WORD[c.reaction!]}
        </span>
      ))}
    </div>
  )

  let body: ReactNode
  if (screen === 'title') {
    body = (
      <div className={styles.titleLayout}>
        {scene}
        <section className={styles.titlePanel} aria-label="はじめる">
          <p className={styles.lead}>すきな おすしを つくって、くるくる レーンで ながそう！</p>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} onClick={() => go('build')}>
            <span aria-hidden="true">🍣</span> おすしを つくる
          </button>
          <div className={styles.titleRow}>
            <button type="button" className={styles.btn} onClick={() => go('lane')}>
              <span aria-hidden="true">🔄</span> レーンを みる
            </button>
            <button type="button" className={styles.btn} onClick={() => { primeAudio(); setCollection(true); playSushiSound('tap') }}>
              <span aria-hidden="true">🎁</span> たからもの {prizes.length}/{PRIZES.length}
            </button>
          </div>
        </section>
      </div>
    )
  } else if (screen === 'build') {
    body = (
      <BuildScreen
        recipe={recipe}
        step={step}
        orders={orders}
        onStep={(s) => { setStep(s); playSushiSound('tap') }}
        onChange={changeRecipe}
        onRandom={() => { changeRecipe(randomRecipe()); playSushiSound('make') }}
        onFinish={finish}
        onLane={() => go('lane')}
      />
    )
  } else {
    body = (
      <div className={styles.laneLayout}>
        {scene}
        <section className={styles.lanePanel} aria-label="レーンの そうさ">
          <p className={styles.message} role="status" aria-live="polite">{message || 'おすしを タップすると おおきく みられるよ'}</p>
          <div className={styles.laneButtons}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => go('build')}>
              <span aria-hidden="true">＋</span> おすしを つくる
            </button>
            {hud.tickets > 0 ? (
              <button type="button" className={`${styles.btn} ${styles.btnGacha}`} onClick={openGacha}>
                <span aria-hidden="true">🎁</span> ガチャ ×{hud.tickets}
              </button>
            ) : null}
          </div>
          <div className={styles.meter} aria-label={`たべた おさら ${hud.eaten}まい。ガチャまで あと ${toNext}まい`} role="img">
            <span className={styles.meterLabel} aria-hidden="true">おさら {hud.eaten}まい</span>
            <span className={styles.meterDots} aria-hidden="true">
              {Array.from({ length: PLATES_PER_GACHA }, (_, i) => (
                <span key={i} className={i < hud.eaten % PLATES_PER_GACHA ? styles.dotOn : styles.dot} />
              ))}
            </span>
          </div>
          <div className={styles.speed} role="group" aria-label="レーンの はやさ">
            {(Object.keys(SPEEDS) as SpeedId[]).map(id => (
              <button key={id} type="button" className={styles.chip} aria-pressed={speed === id} onClick={() => changeSpeed(id)}>
                {SPEED_LABEL[id]}
              </button>
            ))}
          </div>
          {hud.lane.length > 0 ? (
            <ul className={styles.thumbs} aria-label="レーンの おすし">
              {hud.lane.map(p => (
                <li key={p.id}>
                  <button type="button" className={styles.thumb} aria-label={`${recipeName(p.recipe)}を みる`} onClick={() => { primeAudio(); setViewing(p.recipe); playSushiSound('pick') }}>
                    <Pixel src={dishUrl(p.recipe)} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>レーンは からっぽ。おすしを つくって ながそう！</p>
          )}
        </section>
      </div>
    )
  }

  const content = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" onBack={playing || collection ? back : undefined} />
        <h1 className={styles.title}>{TITLE}</h1>
        <button type="button" className={styles.soundButton} aria-label={sound ? 'おとを けす' : 'おとを だす'} aria-pressed={sound} onClick={toggleSound}>
          <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        </button>
      </header>
      {body}

      {done ? (
        <DoneDialog
          recipe={recipe}
          express={done.express}
          expressName={done.express !== null ? nameOf(hud.customers[done.express].animal) : ''}
          onLane={() => sendToLane(null)}
          onExpress={() => sendToLane(done.express)}
          onEdit={() => setDone(null)}
        />
      ) : null}

      {viewing ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="sushi-view-title" onClick={() => setViewing(null)}>
          <div className={styles.card} onClick={e => e.stopPropagation()}>
            <p className={styles.cardKicker}>ながれている おすし</p>
            <div className={styles.viewStage}><Pixel src={dishUrl(viewing)} className={styles.bigDish} /></div>
            <h2 id="sushi-view-title" className={styles.cardTitle}>{recipeName(viewing)}</h2>
            <p className={styles.cardText}>{recipeDetail(viewing)}・{plateDef(viewing.plate).name}の おさら</p>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setViewing(null)} autoFocus>とじる</button>
          </div>
        </div>
      ) : null}

      {gacha ? <GachaDialog state={gacha} tickets={hud.tickets} onSpin={spinGacha} onClose={() => setGacha(null)} /> : null}

      {collection ? (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="collection-title" onClick={() => setCollection(false)}>
          <div className={styles.card} onClick={e => e.stopPropagation()}>
            <h2 id="collection-title" className={styles.cardTitle}>たからもの {prizes.length}/{PRIZES.length}</h2>
            <p className={styles.cardText}>おさらを {PLATES_PER_GACHA}まい たべてもらうと ガチャが まわせるよ</p>
            <ul className={styles.prizeGrid}>
              {PRIZES.map(p => {
                const got = prizes.includes(p.id)
                return (
                  <li key={p.id} className={got ? styles.prizeGot : styles.prizeMissing} aria-label={got ? p.name : 'まだ'}>
                    <Pixel src={spriteUrl(`prize:${p.id}:${got}`, () => (got ? drawPrize(p.id) : silhouette(drawPrize(p.id))))} fallback={got ? '🎁' : '？'} />
                    <span aria-hidden="true">{got ? p.name : '？'}</span>
                  </li>
                )
              })}
            </ul>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setCollection(false)} autoFocus>とじる</button>
          </div>
        </div>
      ) : null}
    </main>
  )

  return playing ? <GamePlaySurface>{content}</GamePlaySurface> : content
}

// ---------------- つくる がめん ----------------

type BuildProps = {
  recipe: Recipe
  step: Step
  orders: CustomerHud[]
  onStep: (step: Step) => void
  onChange: (recipe: Recipe) => void
  onRandom: () => void
  onFinish: () => void
  onLane: () => void
}

type Option = { key: string; label: string; selected: boolean; src: string; fallback: string; apply: () => Recipe }

function BuildScreen({ recipe, step, orders, onStep, onChange, onRandom, onFinish, onLane }: BuildProps) {
  const options: Option[] = (() => {
    switch (step) {
      case 'style':
        return STYLES.map(s => ({ key: s.id, label: s.name, selected: recipe.style === s.id, src: spriteUrl(`style:${s.id}`, () => drawStyleIcon(s.id)), fallback: '🍣', apply: () => ({ ...recipe, style: s.id }) }))
      case 'rice':
        return RICES.map(r => ({ key: r.id, label: `${r.name}シャリ`, selected: recipe.rice === r.id, src: spriteUrl(`rice:${r.id}`, () => drawRiceIcon(r.id)), fallback: '🍚', apply: () => ({ ...recipe, rice: r.id }) }))
      case 'neta':
        return NETAS.map(n => ({ key: n.id, label: n.name, selected: recipe.neta === n.id, src: spriteUrl(`neta:${n.id}`, () => drawSushi(iconRecipe(n.id))), fallback: '🐟', apply: () => ({ ...recipe, neta: n.id }) }))
      case 'topping':
        return TOPPINGS.map(t => ({ key: t.id, label: t.name, selected: recipe.toppings.includes(t.id), src: spriteUrl(`top:${t.id}`, () => drawToppingIcon(t.id)), fallback: '✨', apply: () => ({ ...recipe, toppings: toggleTopping(recipe.toppings, t.id) }) }))
      default:
        return PLATES.map(p => ({ key: p.id, label: p.name, selected: recipe.plate === p.id, src: spriteUrl(`plate:${p.id}`, () => drawPlate(p.id)), fallback: '🍽️', apply: () => ({ ...recipe, plate: p.id }) }))
    }
  })()
  const stepIndex = STEPS.findIndex(s => s.id === step)
  const next = STEPS[stepIndex + 1]
  const preview = spriteUrl(`preview:${recipeKey(recipe)}`, () => drawPreview(recipe))

  return (
    <div className={styles.buildLayout}>
      <section className={styles.previewCard} aria-label="できあがりの みほん">
        <div key={recipeKey(recipe)} className={styles.preview}>
          <Pixel src={preview} alt={recipeName(recipe)} className={styles.previewImg} />
        </div>
        <p className={styles.dishName}>{recipeName(recipe)}</p>
        <p className={styles.dishDetail}>{recipeDetail(recipe)}・{plateDef(recipe.plate).name}の おさら</p>
        {orders.length > 0 ? (
          <div className={styles.orders} aria-label="ちゅうもん">
            <span className={styles.ordersLabel} aria-hidden="true">ちゅうもん</span>
            {orders.map(o => (
              <button
                key={o.seat}
                type="button"
                className={styles.order}
                aria-pressed={recipe.neta === o.wish}
                aria-label={`${nameOf(o.animal)}の ちゅうもん ${netaDef(o.wish!).name}`}
                onClick={() => onChange({ ...recipe, neta: o.wish! })}
              >
                <Pixel src={spriteUrl(`face:${o.animal}`, () => drawCustomer(o.animal, 'idle'))} className={styles.orderFace} fallback="🐾" />
                <Pixel src={chipUrl(o.wish!)} className={styles.orderChip} fallback="🍣" />
              </button>
            ))}
          </div>
        ) : null}
      </section>

      <section className={styles.picker} aria-label="えらぶ">
        <div className={styles.steps} role="tablist" aria-label="つくる じゅんばん">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              id={`sushi-tab-${s.id}`}
              aria-selected={s.id === step}
              aria-controls="sushi-options"
              className={styles.stepTab}
              onClick={() => onStep(s.id)}
            >
              <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>{s.label}
            </button>
          ))}
        </div>
        {step === 'topping' ? <p className={styles.hint}>{MAX_TOPPINGS}つまで のせられるよ</p> : null}
        <div id="sushi-options" role="tabpanel" aria-labelledby={`sushi-tab-${step}`} className={styles.options}>
          {options.map(o => (
            <button key={o.key} type="button" className={styles.option} aria-pressed={o.selected} onClick={() => onChange(o.apply())}>
              <Pixel src={o.src} fallback={o.fallback} className={step === 'topping' ? styles.optionIconSmall : styles.optionIcon} />
              <span className={styles.optionLabel}>{o.label}</span>
              {o.selected ? <span className={styles.check} aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </div>
        <div className={styles.buildActions}>
          <button type="button" className={styles.btn} onClick={onRandom}>
            <span aria-hidden="true">🎲</span> おまかせ
          </button>
          {next ? (
            <button type="button" className={styles.btn} onClick={() => onStep(next.id)}>
              つぎ: {next.label} <span aria-hidden="true">▶</span>
            </button>
          ) : (
            <button type="button" className={styles.btn} onClick={onLane}>
              <span aria-hidden="true">🔄</span> レーンを みる
            </button>
          )}
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnWide}`} onClick={onFinish}>
            <span aria-hidden="true">✨</span> できあがり！
          </button>
        </div>
      </section>
    </div>
  )
}

function DoneDialog({ recipe, express, expressName, onLane, onExpress, onEdit }: {
  recipe: Recipe; express: number | null; expressName: string; onLane: () => void; onExpress: () => void; onEdit: () => void
}) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="sushi-done-title">
      <div className={`${styles.card} ${styles.doneCard}`}>
        <div className={styles.doneStage}>
          <span className={styles.burst} aria-hidden="true" />
          <Pixel src={spriteUrl('chef:wave', () => drawChef('wave'))} className={styles.doneChef} fallback="🐱" />
          <Pixel src={dishUrl(recipe)} className={styles.bigDish} alt={recipeName(recipe)} />
        </div>
        <p className={styles.cardKicker}>へい おまち！</p>
        <h2 id="sushi-done-title" className={styles.cardTitle}>{recipeName(recipe)}</h2>
        <p className={styles.cardText}>{recipeDetail(recipe)}・{plateDef(recipe.plate).name}の おさら</p>
        <div className={styles.doneButtons}>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} onClick={onLane} autoFocus>
            <span aria-hidden="true">🔄</span> レーンに ながす
          </button>
          {express !== null ? (
            <button type="button" className={`${styles.btn} ${styles.btnTrain}`} onClick={onExpress}>
              <span aria-hidden="true">🚄</span> しんかんせんで {expressName}へ
            </button>
          ) : null}
          <button type="button" className={styles.btn} onClick={onEdit}>
            <span aria-hidden="true">↩</span> つくりなおす
          </button>
        </div>
      </div>
    </div>
  )
}

function GachaDialog({ state, tickets, onSpin, onClose }: { state: GachaState; tickets: number; onSpin: () => void; onClose: () => void }) {
  const knob = state.phase === 'spin' ? 1 : state.phase === 'ready' ? 0 : 2
  const prize = state.phase === 'open' ? prizeDef(state.prize) : null
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="gacha-title">
      <div className={`${styles.card} ${styles.gachaCard}`}>
        <h2 id="gacha-title" className={styles.cardTitle}>{prize ? `${prize.name}が でた！` : 'おさらガチャ'}</h2>
        <div className={styles.gachaStage}>
          {state.phase === 'open' && prize ? (
            <div className={styles.prizeShow}>
              <span className={styles.burst} aria-hidden="true" />
              <Pixel src={spriteUrl(`prize:${prize.id}:true`, () => drawPrize(prize.id))} alt={prize.name} className={styles.prizeImg} fallback="🎁" />
              <Pixel src={spriteUrl('capsule:open', () => drawCapsule(2, true))} className={styles.capsuleOpen} fallback="" />
            </div>
          ) : (
            <>
              <Pixel src={spriteUrl(`gacha:${knob}`, () => drawGacha(knob))} className={`${styles.gachaImg} ${state.phase === 'spin' ? styles.shake : ''}`} alt="ガチャの きかい" fallback="🎰" />
              {state.phase === 'drop' ? <Pixel src={spriteUrl('capsule:closed', () => drawCapsule(2))} className={styles.capsuleDrop} fallback="🔴" /> : null}
            </>
          )}
        </div>
        <p className={styles.cardText} role="status">
          {state.phase === 'open' ? (state.isNew ? 'あたらしい たからもの！' : 'もう もってる たからもの だったよ')
            : state.phase === 'ready' ? `ガチャけん ${tickets}まい` : 'ガラガラ…'}
        </p>
        {state.phase === 'ready' ? (
          <div className={styles.doneButtons}>
            <button type="button" className={`${styles.btn} ${styles.btnGacha} ${styles.btnBig}`} onClick={onSpin} autoFocus>
              <span aria-hidden="true">🎁</span> まわす！
            </button>
            <button type="button" className={styles.btn} onClick={onClose}>あとで</button>
          </div>
        ) : state.phase === 'open' ? (
          <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} onClick={onClose} autoFocus>やったね！</button>
        ) : null}
      </div>
    </div>
  )
}
