import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { totalStageStars, type StageProgress } from '../shared/progress/stageProgress'
import { PITCHER_HEIGHT, drawPitcher } from './characters'
import { createDerby, drainEvents, stepDerby, swingBat, type Derby, type DerbyEvent, type Outcome } from './derby'
import { createFx, drawScene, makeFlyView, makeView, spawnFx, updateFx } from './render'
import { isUnlocked, progressStore } from './progress'
import { playDerbySound } from './sounds'
import { BALLS, STAGES, type PitcherId } from './stages'
import styles from './HomerunDerbyPlay.module.css'

const TITLE = 'かっとばせ！ホームランダービー'
const FRAME_MS = 1000 / 60
/** おわってから この じかん[s] たったら 絵を とめて 電池を まもる。 */
const REST_AFTER_DONE = 3
/** かんばんが きえない ときの ための よび[ms]（CSSの 2.1s より すこし あと）。 */
const BANNER_FALLBACK_MS = 2400
/** とんでいる がめんで、うえの おびに かからない よう あける たかさ[px]。 */
const HUD_ROOM = 104

type Hud = { homeruns: number; results: Outcome[] }
type Callout = { key: number; outcome: Outcome; title: string; sub: string }
type Result = { homeruns: number; stars: number }

const BALL_MARK: Record<Outcome, string> = { homerun: '★', hit: '●', foul: '▲', miss: '✕' }
const BALL_WORD: Record<Outcome, string> = { homerun: 'ホームラン', hit: 'ヒット', foul: 'ファウル', miss: 'ストライク' }

// かみふぶきは 毎回 同じ ばらつきで ふらせる（テストでも ゆれない）。
const CONFETTI: CSSProperties[] = Array.from({ length: 24 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { left: `${r(1) * 100}%`, background: `hsl(${Math.round(r(2) * 360)} 90% 62%)`, animationDuration: `${1.8 + r(3) * 1.6}s`, animationDelay: `${-r(4) * 3}s`, width: `${6 + r(5) * 6}px` }
})

function reducedMotionQuery() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** うった けっかの おおきな もじ。 */
function calloutFor(event: DerbyEvent): Omit<Callout, 'key'> | null {
  if (event.type === 'land') {
    const { hit } = event
    if (hit.outcome === 'homerun') return { outcome: 'homerun', title: 'ホームラン！', sub: `${hit.distance}メートル${hit.timing === 'just' ? ' ぴったり！' : ''}` }
    if (hit.outcome === 'hit') return { outcome: 'hit', title: 'ヒット！', sub: `${hit.distance}メートル おしい！` }
    return { outcome: 'foul', title: 'ファウル', sub: hit.timing === 'early' ? 'ちょっと はやかった' : 'ちょっと おそかった' }
  }
  if (event.type === 'miss') {
    if (event.reason === 'looking') return { outcome: 'miss', title: 'みのがし', sub: 'ボールが きたら タップ！' }
    if (event.reason === 'early') return { outcome: 'miss', title: 'からぶり', sub: 'はやすぎ！ もうすこし まってね' }
    return { outcome: 'miss', title: 'からぶり', sub: 'おそかった！ もうすこし はやく' }
  }
  return null
}

function PitcherPortrait({ pitcher, size = 84 }: { pitcher: PitcherId; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = size * dpr
    canvas.height = size * dpr
    const scale = (size * .86) / PITCHER_HEIGHT[pitcher]
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * size / 2, dpr * size * .95)
    drawPitcher(ctx, pitcher, { arm: 1.95, holding: true, time: 0, fire: 0, stopped: false })
  }, [pitcher, size])
  return <canvas ref={ref} className={styles.portrait} style={{ width: size, height: size }} aria-hidden="true" />
}

function Match({ index, onExit, onRetry, onNext }: { index: number; onExit: () => void; onRetry: () => void; onNext: () => void }) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const [sound, toggleSound] = useSoundToggle()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const swingRef = useRef<HTMLButtonElement>(null)
  const derbyRef = useRef<Derby | null>(null)
  const [hud, setHud] = useState<Hud>({ homeruns: 0, results: [] })
  const [callout, setCallout] = useState<Callout | null>(null)
  const [message, setMessage] = useState(stage.lead)
  const [banner, setBanner] = useState(true)
  const [result, setResult] = useState<Result | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => setBanner(false), BANNER_FALLBACK_MS)
    swingRef.current?.focus({ preventScroll: true })
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const derby = createDerby(stage)
    derbyRef.current = derby
    const reducedMotion = reducedMotionQuery()
    const fx = createFx(reducedMotion)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    let size = { w: 400, h: 720, dpr: 1 }
    let view = makeView(size.w, size.h)
    let fly = makeFlyView(size.w, size.h, HUD_ROOM)
    let time = 0
    let resting = false
    let calloutKey = 0
    const draw = () => {
      if (ctx) drawScene(ctx, { view, fly, dpr: size.dpr, time, derby, fx, reducedMotion, hint: index === 0 })
    }
    const measure = () => {
      if (!canvas) return
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size = { w: box.width || 400, h: box.height || 720, dpr }
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      view = makeView(size.w, size.h)
      fly = makeFlyView(size.w, size.h, HUD_ROOM)
      // とまった あとでも 大きさが かわったら かきなおす（canvasは 大きさを かえると きえる）。
      if (resting) draw()
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)

    const handle = (event: DerbyEvent) => {
      spawnFx(fx, event, view, time)
      switch (event.type) {
        case 'windup':
          setCallout(null)
          if (derby.index > 0) setMessage(`${derby.index + 1}きゅうめ。ボールを よく みてね`)
          break
        case 'release':
          playDerbySound('pitch')
          break
        case 'pause':
          playDerbySound('stop')
          break
        case 'swing':
          playDerbySound('swing')
          break
        case 'contact':
          playDerbySound('hit')
          vibrate('impact')
          break
        case 'land':
          playDerbySound(event.hit.outcome === 'homerun' ? 'homerun' : event.hit.outcome === 'hit' ? 'safe' : 'foul')
          if (event.hit.outcome === 'homerun') vibrate('success')
          break
        case 'miss':
          playDerbySound('miss')
          vibrate('tap')
          break
        case 'done': {
          const stars = event.stars
          if (stars > 0) progressStore.record(stage.id, stars)
          playDerbySound(stars > 0 ? 'clear' : 'fail')
          vibrate(stars > 0 ? 'celebrate' : 'tap')
          setResult({ homeruns: event.homeruns, stars })
          break
        }
      }
      const shown = calloutFor(event)
      if (shown) {
        setCallout({ ...shown, key: ++calloutKey })
        setMessage(`${shown.title} ${shown.sub}`)
        setHud({ homeruns: derby.homeruns, results: [...derby.results] })
      }
    }

    let frame = 0, previous = 0, accumulator = 0, restTimer = REST_AFTER_DONE
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      let frames = 0
      if (!document.hidden) {
        accumulator += elapsed
        while (accumulator >= FRAME_MS && frames < 6) {
          stepDerby(derby, FRAME_MS / 1000)
          updateFx(fx, FRAME_MS / 1000, size.w, size.h)
          accumulator -= FRAME_MS
          frames++
        }
        if (frames === 6) accumulator = 0
      }
      time += frames / 60
      for (const event of drainEvents(derby)) handle(event)
      draw()
      if (derby.phase === 'done' && (restTimer -= frames / 60) <= 0) {
        resting = true
        return
      }
      frame = requestAnimationFrame(tick)
    }
    for (const event of drainEvents(derby)) handle(event)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      derbyRef.current = null
    }
  }, [stage, index])

  function swing() {
    const derby = derbyRef.current
    if (!derby || result) return
    primeAudio()
    setBanner(false)
    swingBat(derby)
  }

  function down(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button > 0) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    swing()
  }

  function key(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== ' ' && event.key !== 'Enter') return
    event.preventDefault()
    if (!event.repeat) swing()
  }

  function click(event: MouseEvent<HTMLButtonElement>) {
    // よみあげ ソフトなどの そうさ（ポインターも キーも つかわない おしかた）だけ ここで ふる。
    if (event.detail === 0) swing()
  }

  const current = hud.results.length
  const won = hud.homeruns >= stage.goal
  return <GamePlaySurface><main className={styles.play} data-sky={stage.sky}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
    <button ref={swingRef} type="button" className={styles.swingArea}
      aria-label={`バットを ふる。ボールが きたら おしてね。あいては ${stage.name}`}
      onPointerDown={down} onKeyDown={key} onClick={click} />
    <GameBackButton onBack={onExit} />
    <div className={styles.hud}>
      <div className={styles.versus}>
        <PitcherPortrait pitcher={stage.pitcher} size={40} />
        <span className={styles.versusName}>{stage.name}</span>
      </div>
      <p className={styles.score} data-won={won || undefined} aria-label={`ホームラン ${hud.homeruns}ほん。めあては ${stage.goal}ほん`}>
        <span className={styles.scoreLabel} aria-hidden="true">ホームラン</span>
        <span aria-hidden="true"><strong>{hud.homeruns}</strong> / {stage.goal}</span>
      </p>
      <button type="button" className={styles.iconButton} aria-label={sound ? 'おとを けす' : 'おとを だす'} aria-pressed={sound} onClick={toggleSound}>
        <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
      </button>
    </div>
    <ol className={styles.balls} aria-label={`のこりの ボール ${BALLS - current}こ`}>
      {Array.from({ length: BALLS }, (_, i) => {
        const outcome = hud.results[i]
        return <li key={i} data-result={outcome ?? (i === current ? 'now' : 'left')} aria-label={outcome ? `${i + 1}きゅうめ ${BALL_WORD[outcome]}` : undefined}>
          <span aria-hidden="true">{outcome ? BALL_MARK[outcome] : ''}</span>
        </li>
      })}
    </ol>
    {banner && <div className={styles.banner} aria-hidden="true" data-testid="stage-banner" onAnimationEnd={() => setBanner(false)}>
      <span className={styles.bannerSub}>あいて {index + 1}</span>
      <span className={styles.bannerTitle}>{stage.name}</span>
      <span className={styles.bannerGoal}>ホームラン {stage.goal}ほんで かち！</span>
    </div>}
    {callout && !result && <div key={callout.key} className={styles.callout} data-outcome={callout.outcome} aria-hidden="true">
      <strong>{callout.title}</strong>
      <span>{callout.sub}</span>
    </div>}
    <p className={styles.status} role="status">{message}</p>
    {result && <div className={styles.overlay}>
      {result.stars > 0 ? <div className={styles.card} role="dialog" aria-label="かち">
        <div className={styles.confetti} aria-hidden="true">{CONFETTI.map((style, i) => <i key={i} style={style} />)}</div>
        <h2>かち！</h2>
        <p className={styles.resultLead}>{stage.name}に かったよ</p>
        <div className={styles.stars} aria-label={`ほし ${result.stars}こ`}>
          {[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.25 + i * .28}s` }}>★</span>)}
        </div>
        <p className={styles.resultScore}>ホームラン {result.homeruns}ほん</p>
        <p className={styles.resultNote}>{index === STAGES.length - 1 ? 'ぜんぶの あいてに かったよ！ すごい！' : result.stars < 3 ? 'ホームランが おおいほど ほしが ふえるよ' : 'すごい！ ホームラン おう だ！'}</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onRetry}>↻ もういちど</button>
          <button type="button" className={styles.primary} autoFocus onClick={onNext}>{index === STAGES.length - 1 ? 'あいてを えらぶ' : 'つぎの あいてへ →'}</button>
        </div>
      </div> : <div className={styles.card} role="dialog" aria-label="おしい">
        <h2 className={styles.failTitle}>おしい！</h2>
        <p className={styles.resultScore}>ホームラン {result.homeruns}ほん</p>
        <p className={styles.resultNote}>あと {stage.goal - result.homeruns}ほんで かちだったよ</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>あいてを えらぶ</button>
          <button type="button" className={styles.primary} autoFocus onClick={onRetry}>↻ もういちど</button>
        </div>
      </div>}
    </div>}
  </main></GamePlaySurface>
}

function TitleArt() {
  return <svg className={styles.titleArt} viewBox="0 0 320 132" aria-hidden="true">
    <path d="M10 132 Q160 40 310 132Z" fill="#5fc252" />
    <path d="M40 132 Q160 66 280 132Z" fill="#6fd160" />
    <path d="M104 132 L160 96 L216 132Z" fill="#dba36b" />
    <path d="M150 118 L170 118 L170 126 L160 131 L150 126Z" fill="#fff" />
    <path d="M60 104 Q30 70 46 40" fill="none" stroke="#e2a85c" strokeWidth="11" strokeLinecap="round" />
    <path d="M46 40 L52 30" stroke="#3b2b5e" strokeWidth="9" strokeLinecap="round" />
    <path d="M98 96 Q170 4 262 30" fill="none" stroke="#fff" strokeWidth="3.5" strokeDasharray="2 10" strokeLinecap="round" />
    <circle cx="266" cy="32" r="14" fill="#fffdf6" stroke="#2d2a3e" strokeWidth="2.5" />
    <path d="M257 22 Q262 32 257 42 M275 22 Q270 32 275 42" fill="none" stroke="#e0453a" strokeWidth="2.5" />
    <path d="M238 10 l4 8 M286 6 l-3 9 M296 34 l-10 1 M246 52 l7 -6" stroke="#ffd23f" strokeWidth="4" strokeLinecap="round" />
    <path d="M128 30 l3 7 7 1 -5 5 1 7 -6 -4 -6 4 1 -7 -5 -5 7 -1Z" fill="#ffd23f" />
    <path d="M196 60 l2 5 5 .5 -4 3.5 1 5 -4 -3 -4 3 1 -5 -4 -3.5 5 -.5Z" fill="#fff6c8" />
  </svg>
}

function StageSelect({ progress, onPick }: { progress: StageProgress; onPick: (index: number) => void }) {
  const total = totalStageStars(progress)
  return <main className={styles.select}>
    <GameBackButton to="/" />
    <header className={styles.selectHeader}>
      <TitleArt />
      <h1>{TITLE}</h1>
      <p>ボールが きたら タップして、ホームランを ねらおう！</p>
      <p className={styles.totalStars} aria-label={`あつめた ほし ${total} / ${STAGES.length * 3}`}>★ {total} / {STAGES.length * 3}</p>
    </header>
    <ol className={styles.stageList} aria-label="あいてを えらぶ">
      {STAGES.map((stage, i) => {
        const unlocked = isUnlocked(progress, i)
        const stars = progress[stage.id] ?? 0
        return <li key={stage.id}>
          <button type="button" className={styles.stageCard} data-sky={stage.sky} disabled={!unlocked}
            aria-label={`${i + 1} ${stage.name}${stars ? ` ほし${stars}こ` : ''}${unlocked ? '' : ' まだ あそべないよ'}`}
            onClick={() => { primeAudio(); playDerbySound('tap'); onPick(i) }}>
            <span className={styles.cardNumber} aria-hidden="true">{i + 1}</span>
            <PitcherPortrait pitcher={stage.pitcher} />
            <span className={styles.cardText}>
              <StageClearBadge stars={stars} />
              <span className={styles.cardName} aria-hidden="true">{stage.name}</span>
              <span className={styles.cardPitch} aria-hidden="true">{stage.specialty}</span>
              <span className={styles.cardGoal} aria-hidden="true">{unlocked ? `ホームラン ${stage.goal}ほんで かち` : 'まえの あいてに かつと あそべるよ'}</span>
            </span>
            {!unlocked && <span className={styles.lock} aria-hidden="true">🔒</span>}
          </button>
        </li>
      })}
    </ol>
  </main>
}

export default function HomerunDerbyPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState<StageProgress>(() => progressStore.read())
  if (index !== null) {
    return <Match key={`${index}-${attempt}`} index={index}
      onExit={() => { setProgress(progressStore.read()); setIndex(null) }}
      onRetry={() => setAttempt(a => a + 1)}
      onNext={() => {
        const next = progressStore.read()
        setProgress(next)
        setIndex(index + 1 < STAGES.length && isUnlocked(next, index + 1) ? index + 1 : null)
      }} />
  }
  return <StageSelect progress={progress} onPick={setIndex} />
}
