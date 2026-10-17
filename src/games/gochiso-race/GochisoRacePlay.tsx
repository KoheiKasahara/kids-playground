import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { totalStageStars, type StageProgress } from '../shared/progress/stageProgress'
import { ANIMALS, findAnimal, pickRival, type AnimalId } from './animals'
import { RUN_FRAMES, animalSprite, foodSprite, type AnimalState } from './art'
import { COURSES, type Course } from './courses'
import { progressStore, isUnlocked, readAnimal, writeAnimal } from './progress'
import {
  GOAL_BONUS, createRace, drainEvents, pressJump, progressOf, setStop, stepRace,
  type Race, type RaceEvent, type RaceResult, type Score,
} from './race'
import { createFx, drawPortrait, drawScene, followCamera, makeView, cameraTarget, spawnFx, updateFx, type Cam, type View } from './render'
import {
  playBump, playEat, playFall, playGoal, playJump, playLose, playReady, playRespawn, playRivalEat, playTap, playWin, startBgm,
} from './sounds'
import styles from './GochisoRacePlay.module.css'

const TITLE = 'ぱくぱく ごちそうレース'
const FRAME_MS = 1000 / 60
/** おわってから この じかん[s] たったら 絵を とめて 電池を まもる。 */
const REST_AFTER_DONE = 3
const JUMP_KEYS = new Set(['ArrowUp', 'w', 'W'])
const STOP_KEYS = new Set(['ArrowDown', 'ArrowLeft', 's', 'S'])

type Banner = 'ready' | 'go' | null
type Callout = { key: number; text: string; tone: 'win' | 'info' }

// かみふぶきは 毎回 同じ ばらつきで ふらせる（テストでも ゆれない）。
const CONFETTI: CSSProperties[] = Array.from({ length: 24 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { left: `${r(1) * 100}%`, background: `hsl(${Math.round(r(2) * 360)} 90% 62%)`, animationDuration: `${1.8 + r(3) * 1.6}s`, animationDelay: `${-r(4) * 3}s`, width: `${6 + r(5) * 6}px` }
})

function reducedMotionQuery() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function nameOf(id: AnimalId) {
  return findAnimal(id)?.name ?? ''
}

function Portrait({ animal, size, state = 'stand', crop = false, className }: { animal: AnimalId; size: number; state?: AnimalState; crop?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const px = Math.round(size * Math.min(3, window.devicePixelRatio || 1))
    canvas.width = px
    canvas.height = px
    drawPortrait(ctx, animal, px, state, crop)
  }, [animal, size, state, crop])
  return <canvas ref={ref} className={className ?? styles.portrait} style={{ width: size, height: size }} aria-hidden="true" />
}

/** タイトルの 絵（どうぶつが ごちそうを おいかける）。 */
function TitleArt() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    // 1ドットの え（112 x 40）を つくって、そのまま おおきく みせる。
    canvas.width = 112
    canvas.height = 40
    ctx.imageSmoothingEnabled = false
    ctx.fillStyle = '#3f8f2e'
    ctx.fillRect(2, 35, 108, 5)
    ctx.fillStyle = '#6cc24a'
    ctx.fillRect(3, 35, 106, 3)
    const foods = ['strawberry', 'onigiri', 'cake', 'donut'] as const
    foods.forEach((kind, i) => {
      const img = foodSprite(kind)
      if (img) ctx.drawImage(img, 58 + i * 13, 16 - (i % 2) * 7)
    })
    for (const [id, x, frame] of [['cat', 6, 2], ['dog', 28, 0]] as const) {
      const animal = findAnimal(id)
      const img = animal && animalSprite(animal, { state: 'run', frame: frame % RUN_FRAMES, eyes: 'open', munch: false })
      if (img) ctx.drawImage(img, x, 0)
    }
  }, [])
  return <canvas ref={ref} className={styles.titleArt} aria-hidden="true" />
}

function JumpIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={styles.controlIcon}>
    <path d="M24 6 L38 22 H29 V34 H19 V22 H10 Z" fill="currentColor" />
    <path d="M12 42 H36" stroke="currentColor" strokeWidth="4" strokeLinecap="round" opacity=".6" />
  </svg>
}

function StopIcon() {
  return <svg viewBox="0 0 48 48" aria-hidden="true" className={styles.controlIcon}>
    <path d="M16 10 a3 3 0 0 1 6 0 V22 h1 V7 a3 3 0 0 1 6 0 V22 h1 V10 a3 3 0 0 1 6 0 V30 c0 8 -5 13 -12 13 c-6 0 -9 -3 -12 -8 L8 26 a3 3 0 0 1 5 -3 l3 4 Z" fill="currentColor" />
  </svg>
}

// ---------------- レース ----------------

function ResultRow({ label, mine, theirs, big }: { label: string; mine: string; theirs: string; big?: boolean }) {
  return <div className={styles.resultRow} data-big={big || undefined}>
    <span className={styles.resultMine}>{mine}</span>
    <span className={styles.resultLabel}>{label}</span>
    <span className={styles.resultTheirs}>{theirs}</span>
  </div>
}

function bonusText(score: Score) {
  return score.bonus > 0 ? `+${score.bonus}` : '0'
}

function RaceScreen({ course, index, animal, rival, seed, onExit, onRetry, onNext }: {
  course: Course; index: number; animal: AnimalId; rival: AnimalId; seed: number
  onExit: () => void; onRetry: () => void; onNext: () => void
}) {
  useGameIntroPlaying(true)
  const [sound, toggleSound] = useSoundToggle()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const hudRef = useRef<HTMLDivElement>(null)
  const meMarkerRef = useRef<HTMLSpanElement>(null)
  const rivalMarkerRef = useRef<HTMLSpanElement>(null)
  const raceRef = useRef<Race | null>(null)
  const stopPointers = useRef(new Set<number>())
  const stopKeys = useRef(new Set<string>())
  const stopLatch = useRef(false)
  const lastKeyJump = useRef(-1e9)
  const [banner, setBanner] = useState<Banner>('ready')
  const [running, setRunning] = useState(false)
  const [scores, setScores] = useState({ player: 0, rival: 0 })
  const [callout, setCallout] = useState<Callout | null>(null)
  const [message, setMessage] = useState(`よーい… ${course.name}`)
  const [stopping, setStopping] = useState(false)
  const [result, setResult] = useState<RaceResult | null>(null)
  const me = findAnimal(animal)
  const them = findAnimal(rival)

  useEffect(() => {
    if (!sound || !running) return undefined
    return startBgm()
  }, [sound, running])

  useEffect(() => {
    const race = createRace(course, { player: animal, rival, seed })
    raceRef.current = race
    const reducedMotion = reducedMotionQuery()
    const fx = createFx(reducedMotion)
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    let view: View = makeView(400, 600, 1, 100)
    let cam: Cam = cameraTarget(race, view)
    let time = 0
    let resting = false
    let calloutKey = 0
    const timers: ReturnType<typeof setTimeout>[] = []
    const draw = () => {
      if (ctx) drawScene(ctx, { view, cam, race, fx, time })
    }
    const measure = () => {
      if (!canvas) return
      const box = canvas.getBoundingClientRect()
      const hud = hudRef.current?.getBoundingClientRect()
      const dpr = Math.min(3, window.devicePixelRatio || 1)
      view = makeView(box.width || 400, box.height || 600, dpr, hud ? Math.max(0, hud.bottom - box.top) : 100)
      canvas.width = view.dw
      canvas.height = view.dh
      cam = cameraTarget(race, view)
      if (resting) draw()
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    playReady(false)

    const showCallout = (text: string, tone: Callout['tone']) => setCallout({ key: ++calloutKey, text, tone })
    const handle = (event: RaceEvent) => {
      spawnFx(fx, event, race, time)
      switch (event.type) {
        case 'go':
          playReady(true)
          setBanner('go')
          setRunning(true)
          setMessage('どん！ はしれ！')
          timers.push(setTimeout(() => setBanner(null), 900))
          break
        case 'jump':
          if (event.who === 'player') playJump(event.air)
          break
        case 'eat':
          if (event.who === 'player') {
            playEat(event.points)
            if (event.points >= 5) vibrate('success')
          } else playRivalEat()
          setScores({ player: race.player.food, rival: race.rival.food })
          break
        case 'bump':
          if (event.who === 'player') {
            playBump(event.cause)
            vibrate('impact')
            setMessage(event.cause === 'pounder' ? 'ぺちゃん！ ぺったんが あがったら すすもう' : 'いたっ！ はちに きをつけて')
          }
          break
        case 'fall':
          if (event.who === 'player') {
            playFall()
            vibrate('tap')
            setMessage('あなに おちちゃった。ジャンプで こえよう')
          }
          break
        case 'respawn':
          if (event.who === 'player') playRespawn()
          break
        case 'goal':
          if (event.who === 'player') {
            playGoal(event.place === 1)
            vibrate('success')
            showCallout(event.place === 1 ? 'いちばん！' : 'ゴール！', event.place === 1 ? 'win' : 'info')
            setMessage(event.place === 1 ? `さきに ゴール！ +${GOAL_BONUS}てん` : 'ゴール！')
          } else if (race.player.finishedAt === null) {
            showCallout(`${nameOf(rival)}が ゴール！`, 'info')
            setMessage(`${nameOf(rival)}が さきに ゴールしたよ。がんばれ！`)
          }
          break
        case 'timeup':
          setMessage('じかん ぎれ！')
          break
        case 'done': {
          const { stars, outcome } = event.result
          if (stars > 0) progressStore.record(course.id, stars)
          setRunning(false)
          setStop(race, false)
          if (outcome === 'win') {
            playWin()
            vibrate('celebrate')
          } else playLose()
          setResult(event.result)
          setMessage(outcome === 'win' ? 'かち！' : outcome === 'lose' ? 'おしい！' : 'ひきわけ')
          break
        }
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
          stepRace(race, FRAME_MS / 1000)
          updateFx(fx, FRAME_MS / 1000)
          followCamera(cam, race, view, FRAME_MS / 1000)
          accumulator -= FRAME_MS
          frames++
          for (const event of drainEvents(race)) handle(event)
        }
        if (frames === 6) accumulator = 0
      }
      time += frames / 60
      if (meMarkerRef.current) meMarkerRef.current.style.left = `${progressOf(race, race.player) * 100}%`
      if (rivalMarkerRef.current) rivalMarkerRef.current.style.left = `${progressOf(race, race.rival) * 100}%`
      draw()
      if (race.phase === 'done' && (restTimer -= frames / 60) <= 0) {
        resting = true
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const releaseAll = () => {
      stopPointers.current.clear()
      stopKeys.current.clear()
      stopLatch.current = false
      setStop(race, false)
      setStopping(false)
    }
    const isOwnControl = (target: EventTarget | null) => target instanceof HTMLElement && target.dataset.raceControl !== undefined
    const isOtherControl = (target: EventTarget | null) =>
      target instanceof HTMLElement && !isOwnControl(target) && Boolean(target.closest('button, a, input, select, textarea'))
    const onKeyDown = (event: KeyboardEvent) => {
      if (race.phase === 'done' || isOtherControl(event.target)) return
      const own = isOwnControl(event.target) ? (event.target as HTMLElement).dataset.raceControl : null
      const activate = event.key === ' ' || event.key === 'Enter'
      if (STOP_KEYS.has(event.key) || (activate && own === 'stop')) {
        event.preventDefault()
        stopKeys.current.add(event.key)
        setStop(race, true)
        setStopping(true)
      } else if (JUMP_KEYS.has(event.key) || activate) {
        event.preventDefault()
        if (event.repeat) return
        primeAudio()
        lastKeyJump.current = performance.now()
        pressJump(race)
      }
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (isOwnControl(event.target) && (event.key === ' ' || event.key === 'Enter')) event.preventDefault()
      if (!stopKeys.current.delete(event.key)) return
      if (stopKeys.current.size === 0 && stopPointers.current.size === 0 && !stopLatch.current) {
        setStop(race, false)
        setStopping(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', releaseAll)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', releaseAll)
      for (const timer of timers) clearTimeout(timer)
      raceRef.current = null
    }
  }, [course, animal, rival, seed])

  function jump() {
    const race = raceRef.current
    if (!race) return
    primeAudio()
    pressJump(race)
  }

  function syncStop() {
    const race = raceRef.current
    const on = stopPointers.current.size > 0 || stopKeys.current.size > 0 || stopLatch.current
    if (race) setStop(race, on)
    setStopping(on)
  }

  function stopDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button > 0) return
    event.preventDefault()
    primeAudio()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* つかえない ときも ある */ }
    stopPointers.current.add(event.pointerId)
    syncStop()
  }

  function stopUp(event: PointerEvent<HTMLButtonElement>) {
    if (!stopPointers.current.delete(event.pointerId)) return
    syncStop()
  }

  function stopClick(event: MouseEvent<HTMLButtonElement>) {
    // よみあげ ソフトなどの そうさでは、おすたびに とまる・はしるを きりかえる。
    if (event.detail !== 0 || performance.now() - lastKeyJump.current < 400 || stopKeys.current.size > 0) return
    stopLatch.current = !stopLatch.current
    syncStop()
  }

  function jumpDown(event: PointerEvent<HTMLElement>) {
    if (!event.isPrimary && event.pointerType === 'mouse') return
    if (event.button > 0) return
    event.preventDefault()
    jump()
  }

  function jumpClick(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail !== 0 || performance.now() - lastKeyJump.current < 400) return
    jump()
  }

  function stageDown(event: PointerEvent<HTMLDivElement>) {
    // がめんの どこを タップしても ジャンプ（ボタンの うえは のぞく）。
    if (event.target !== event.currentTarget) return
    jumpDown(event)
  }

  const last = index === COURSES.length - 1
  return <GamePlaySurface><main className={styles.race} data-theme={course.theme}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <div className={styles.stage} onPointerDown={stageDown} data-testid="race-stage">
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      <div ref={hudRef} className={styles.hud}>
        <div className={styles.hudRow}>
          <p className={styles.scores} aria-label={`ごちそう きみ ${scores.player}てん、${nameOf(rival)} ${scores.rival}てん`}>
            <span className={styles.scoreMe} aria-hidden="true">
              <Portrait animal={animal} size={36} crop className={styles.scoreFace} />
              <strong>{scores.player}</strong>
            </span>
            <span className={styles.scoreVs} aria-hidden="true">VS</span>
            <span className={styles.scoreThem} aria-hidden="true" style={{ '--rival': them?.color } as CSSProperties}>
              <strong>{scores.rival}</strong>
              <Portrait animal={rival} size={36} crop className={styles.scoreFace} />
            </span>
          </p>
          <button type="button" className={styles.iconButton} aria-label={sound ? 'おとを けす' : 'おとを だす'} aria-pressed={sound} onClick={toggleSound}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </div>
        <div className={styles.track} aria-hidden="true">
          <span className={styles.trackFlag}>🏁</span>
          <span ref={rivalMarkerRef} className={styles.trackRival} style={{ background: them?.color }} />
          <span ref={meMarkerRef} className={styles.trackMe} />
        </div>
      </div>
      {banner && <div className={styles.banner} data-banner={banner} data-testid="race-banner" aria-hidden="true">
        {banner === 'ready' ? <>
          <span className={styles.bannerSub}>{course.name}</span>
          <span className={styles.bannerVs}>
            <Portrait animal={animal} size={56} />
            <b>VS</b>
            <Portrait animal={rival} size={56} />
          </span>
          <span className={styles.bannerTitle}>よーい…</span>
          <span className={styles.bannerGoal}>さきに ゴールで +{GOAL_BONUS}てん</span>
        </> : <span className={styles.bannerGo}>どん！</span>}
      </div>}
      {callout && !result && <div key={callout.key} className={styles.callout} data-tone={callout.tone} aria-hidden="true">{callout.text}</div>}
    </div>
    <div className={styles.controls}>
      <button type="button" className={styles.stopButton} data-race-control="stop" aria-pressed={stopping}
        aria-label="ストップ。おしている あいだ とまる"
        onPointerDown={stopDown} onPointerUp={stopUp} onPointerCancel={stopUp} onLostPointerCapture={stopUp} onClick={stopClick}>
        <StopIcon />
        <span>ストップ</span>
      </button>
      <button type="button" className={styles.jumpButton} data-race-control="jump" aria-label="ジャンプ。くうちゅうで もう1かい とべる"
        onPointerDown={jumpDown} onClick={jumpClick}>
        <JumpIcon />
        <span>ジャンプ</span>
      </button>
    </div>
    <GameBackButton onBack={onExit} />
    <p className={styles.status} role="status">{message}</p>
    {result && <div className={styles.overlay}>
      <div className={styles.card} role="dialog" aria-label={result.outcome === 'win' ? 'かち' : result.outcome === 'lose' ? 'まけ' : 'ひきわけ'}>
        {result.outcome === 'win' && <div className={styles.confetti} aria-hidden="true">{CONFETTI.map((style, i) => <i key={i} style={style} />)}</div>}
        <h2 data-outcome={result.outcome}>{result.outcome === 'win' ? 'かち！' : result.outcome === 'lose' ? 'おしい！' : 'ひきわけ！'}</h2>
        <div className={styles.versus} aria-hidden="true">
          <span><Portrait animal={animal} size={64} state={result.outcome === 'lose' ? 'sad' : 'cheer'} />{me?.name}<small>きみ</small></span>
          <span><Portrait animal={rival} size={64} state={result.outcome === 'win' ? 'sad' : 'cheer'} />{them?.name}<small>あいて</small></span>
        </div>
        <div className={styles.resultTable} aria-hidden="true">
          <ResultRow label="ごちそう" mine={`${result.player.food}`} theirs={`${result.rival.food}`} />
          <ResultRow label="ゴール" mine={bonusText(result.player)} theirs={bonusText(result.rival)} />
          <ResultRow label="ごうけい" mine={`${result.player.total}`} theirs={`${result.rival.total}`} big />
        </div>
        <p className={styles.srOnly}>{`きみは ごちそう ${result.player.food}てん、ゴール ${bonusText(result.player)}、ごうけい ${result.player.total}てん。`
          + `${nameOf(rival)}は ごちそう ${result.rival.food}てん、ゴール ${bonusText(result.rival)}、ごうけい ${result.rival.total}てん。`}</p>
        {result.outcome === 'win' && <div className={styles.stars} aria-label={`ほし ${result.stars}こ`}>
          {[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.3 + i * .28}s` }}>★</span>)}
        </div>}
        <p className={styles.resultNote}>{
          result.outcome !== 'win' ? (result.player.place === 1 ? 'ごちそうを もっと たべよう！' : 'あなや ぺったんに きをつけて、さきに ゴールを めざそう！')
            : result.stars === 3 ? (last ? 'ぜんぶの コースで かったよ！ ごちそう チャンピオン！' : 'すごい！ ぱーふぇくと！')
              : result.player.place !== 1 ? 'さきに ゴールすると ★が ふえるよ' : 'ごちそうを たくさん たべると ★が ふえるよ'
        }</p>
        <div className={styles.cardButtons}>
          {result.outcome === 'win' ? <>
            <button type="button" onClick={onRetry}>↻ もういちど</button>
            <button type="button" className={styles.primary} autoFocus onClick={onNext}>{last ? 'コースを えらぶ' : 'つぎの コースへ →'}</button>
          </> : <>
            <button type="button" onClick={onExit}>コースを えらぶ</button>
            <button type="button" className={styles.primary} autoFocus onClick={onRetry}>↻ もういちど</button>
          </>}
        </div>
      </div>
    </div>}
  </main></GamePlaySurface>
}

// ---------------- えらぶ がめん ----------------

function AnimalSelect({ current, onPick }: { current: AnimalId | null; onPick: (id: AnimalId) => void }) {
  return <main className={styles.select}>
    <GameBackButton to="/" />
    <header className={styles.selectHeader}>
      <TitleArt />
      <h1>{TITLE}</h1>
      <p>ジャンプと ストップで はしって、ごちそうを たべながら ゴール！</p>
    </header>
    <h2 className={styles.selectTitle}>はしる どうぶつを えらぼう</h2>
    <ul className={styles.animalGrid} aria-label="どうぶつを えらぶ">
      {ANIMALS.map(animal => <li key={animal.id}>
        <button type="button" className={styles.animalCard} data-current={animal.id === current || undefined}
          style={{ '--animal': animal.color } as CSSProperties}
          onClick={() => { primeAudio(); playTap(); onPick(animal.id) }}>
          <Portrait animal={animal.id} size={72} />
          <span className={styles.animalName}>{animal.name}</span>
        </button>
      </li>)}
    </ul>
  </main>
}

function CourseSelect({ animal, progress, onPick, onBack }: { animal: AnimalId; progress: StageProgress; onPick: (index: number) => void; onBack: () => void }) {
  const total = totalStageStars(progress)
  return <main className={styles.select}>
    <GameBackButton onBack={onBack} />
    <header className={styles.selectHeader}>
      <div className={styles.chosen}>
        <Portrait animal={animal} size={96} state="cheer" />
        <p><b>{nameOf(animal)}</b>で はしるよ！</p>
      </div>
      <h1>{TITLE}</h1>
      <p className={styles.rule}>ごちそうの てんすう ＋ さきに ゴールで <b>+{GOAL_BONUS}てん</b>。ごうけいが おおい ほうの かち！</p>
      <p className={styles.totalStars} aria-label={`あつめた ほし ${total} / ${COURSES.length * 3}`}>★ {total} / {COURSES.length * 3}</p>
    </header>
    <h2 className={styles.selectTitle}>コースを えらぼう</h2>
    <ol className={styles.courseList} aria-label="コースを えらぶ">
      {COURSES.map((course, i) => {
        const unlocked = isUnlocked(progress, i)
        const stars = progress[course.id] ?? 0
        return <li key={course.id}>
          <button type="button" className={styles.courseCard} data-theme={course.theme} disabled={!unlocked}
            aria-label={`${i + 1} ${course.name}${stars ? ` ほし${stars}こ` : ''}${unlocked ? '' : ' まだ あそべないよ'}`}
            onClick={() => { primeAudio(); playTap(); onPick(i) }}>
            <span className={styles.cardNumber} aria-hidden="true">{i + 1}</span>
            <span className={styles.cardText}>
              <StageClearBadge stars={stars} />
              <span className={styles.cardName} aria-hidden="true">{course.name}</span>
              <span className={styles.cardLead} aria-hidden="true">{unlocked ? course.lead : 'まえの コースで かつと あそべるよ'}</span>
            </span>
            {!unlocked && <span className={styles.lock} aria-hidden="true">🔒</span>}
          </button>
        </li>
      })}
    </ol>
  </main>
}

type Match = { index: number; rival: AnimalId; seed: number; attempt: number }

function newSeed() {
  return Math.floor(Math.random() * 1e9)
}

export default function GochisoRacePlay() {
  const [current, setCurrent] = useState(readAnimal)
  const [animal, setAnimal] = useState<AnimalId | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [progress, setProgress] = useState<StageProgress>(() => progressStore.read())

  if (animal && match) {
    return <RaceScreen key={`${match.index}-${match.attempt}`} course={COURSES[match.index]} index={match.index} animal={animal}
      rival={match.rival} seed={match.seed}
      onExit={() => { setProgress(progressStore.read()); setMatch(null) }}
      onRetry={() => setMatch({ ...match, seed: newSeed(), attempt: match.attempt + 1 })}
      onNext={() => {
        const next = progressStore.read()
        setProgress(next)
        const nextIndex = match.index + 1
        setMatch(nextIndex < COURSES.length && isUnlocked(next, nextIndex)
          ? { index: nextIndex, rival: pickRival(animal), seed: newSeed(), attempt: match.attempt + 1 }
          : null)
      }} />
  }
  if (animal) {
    return <CourseSelect animal={animal} progress={progress} onBack={() => setAnimal(null)}
      onPick={index => setMatch({ index, rival: pickRival(animal), seed: newSeed(), attempt: 0 })} />
  }
  return <AnimalSelect current={current} onPick={id => { writeAnimal(id); setCurrent(id); setAnimal(id) }} />
}
