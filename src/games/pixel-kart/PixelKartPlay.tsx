import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { COURSES, sampleTrack } from './courses'
import { createRace, getRank, stepRace } from './engine'
import { KartRenderer, drawCoursePreview } from './render'
import { KartAudio } from './audio'
import ItemGlyph from './ItemGlyph'
import { ITEM_LABELS } from './items'
import type { Course, CourseId, ItemId, Racer, RaceState } from './types'
import styles from './PixelKartPlay.module.css'

type Options = { assist: boolean; sound: boolean }
const SETTINGS_KEY = 'kids:pixel-kart:settings:v1'
const PROGRESS_KEY = 'kids:pixel-kart:cleared:v1'
const ITEMS: ItemId[] = ['boost', 'jump', 'star', 'bomb', 'puddle']
function readOptions(): Options {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}')
    return { assist: value?.assist !== false, sound: value?.sound !== false }
  } catch { return { assist: true, sound: true } }
}
function readCleared(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch { return [] }
}
function usePortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia?.('(orientation: portrait)').matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.('(orientation: portrait)')
    if (!mq) return
    const update = () => setPortrait(mq.matches)
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return portrait
}

function CoursePreview({ course }: { course: Course }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawCoursePreview(ref.current, course) }, [course])
  return <canvas ref={ref} width={320} height={180} className={styles.preview} aria-hidden="true" />
}

function Settings({ options, onChange }: { options: Options; onChange: (value: Options) => void }) {
  return <div className={styles.settings}>
    <button type="button" role="switch" aria-checked={options.assist} onClick={() => onChange({ ...options, assist: !options.assist })}>
      <span><strong>みちから はみださない</strong><small>かべの まえで やさしく まがるよ</small></span>
      <b className={options.assist ? styles.switchOn : styles.switchOff}>{options.assist ? 'ON' : 'OFF'}</b>
    </button>
    <button type="button" role="switch" aria-checked={options.sound} onClick={() => onChange({ ...options, sound: !options.sound })}>
      <span><strong>おんがくと おと</strong><small>コースごとの メロディ♪</small></span>
      <b className={options.sound ? styles.switchOn : styles.switchOff}>{options.sound ? 'ON' : 'OFF'}</b>
    </button>
  </div>
}

type MapRacer = Pick<Racer, 'id' | 'distance' | 'color'>
function MiniMap({ course, racers }: { course: Course; racers: MapRacer[] }) {
  const bounds = useMemo(() => {
    const xs = course.points.map(p => p.x), ys = course.points.map(p => p.y)
    const minX = Math.min(...xs), minY = Math.min(...ys)
    const scale = 88 / Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY)
    return { minX, minY, scale, line: course.points.map(p => `${(p.x - minX) * scale + 6},${(p.y - minY) * scale + 6}`).join(' ') }
  }, [course])
  return <svg viewBox="0 0 100 100" className={styles.minimap} aria-label="コースマップ">
    <polygon points={bounds.line} fill="none" stroke="#101e35" strokeWidth="8" strokeLinejoin="round" />
    <polygon points={bounds.line} fill="none" stroke="#eadfb0" strokeWidth="4" strokeLinejoin="round" />
    {racers.map(racer => {
      const p = sampleTrack(course, racer.distance)
      return <circle key={racer.id} cx={(p.x - bounds.minX) * bounds.scale + 6} cy={(p.y - bounds.minY) * bounds.scale + 6} r={racer.id === 0 ? 5 : 3} fill={racer.color} stroke="white" strokeWidth="1.5" />
    })}
  </svg>
}

function Race({ course, options, onOptions, portrait, onExit, onReplay, onNext, onClear }: {
  course: Course; options: Options; onOptions: (value: Options) => void; portrait: boolean
  onExit: () => void; onReplay: () => void; onNext: () => void; onClear: (id: CourseId) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raceRef = useRef<RaceState | null>(null)
  const input = useRef({ steer: 0, useItem: false })
  const keys = useRef(new Set<string>())
  const stickPointer = useRef<number | null>(null)
  const audioRef = useRef<KartAudio | null>(null)
  const optionsRef = useRef(options)
  const onClearRef = useRef(onClear)
  const pausedRef = useRef(false)
  const [paused, setPaused] = useState(false)
  const [hud, setHud] = useState(() => ({ rank: 4, lap: 1, countdown: 3, item: null as ItemId | null, speed: 0, distance: 0, lane: 0, drift: 0, finished: false, time: 0, message: '', racers: [] as MapRacer[] }))
  const [stick, setStick] = useState(0)
  const [error, setError] = useState(false)
  useEffect(() => { optionsRef.current = options; if (raceRef.current) raceRef.current.assist = options.assist }, [options])
  useEffect(() => { onClearRef.current = onClear }, [onClear])

  const resetInput = useCallback(() => {
    input.current = { steer: 0, useItem: false }
    keys.current.clear()
    stickPointer.current = null
    setStick(0)
  }, [])
  const pause = useCallback(() => { pausedRef.current = true; resetInput(); setPaused(true); audioRef.current?.stop() }, [resetInput])
  const resume = () => {
    if (options.sound) primeAudio()
    resetInput()
    pausedRef.current = false
    setPaused(false)
  }
  useEffect(() => {
    const mq = window.matchMedia?.('(orientation: portrait)')
    const orientation = () => { if (mq?.matches) pause() }
    const visibility = () => { if (document.hidden) pause() }
    mq?.addEventListener('change', orientation)
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    return () => { mq?.removeEventListener('change', orientation); window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility) }
  }, [pause])
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (options.sound && !paused && !portrait && !hud.finished) audio.start(course.id)
    else {
      audio.stop()
      if (hud.finished && options.sound) audio.effect('finish')
    }
    return () => audio.stop()
  }, [options.sound, paused, portrait, hud.finished, course.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let renderer: KartRenderer
    try { renderer = new KartRenderer(canvas) } catch {
      // Canvas capability can only be discovered when the real DOM canvas is mounted.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(true)
      return
    }
    const race = createRace(course, optionsRef.current.assist)
    raceRef.current = race
    const audio = new KartAudio()
    audioRef.current = audio
    if (optionsRef.current.sound && !pausedRef.current) audio.start(course.id)
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    let frame = 0, previous = 0, accumulator = 0, lastHud = 0, lastCount = 4, messageUntil = 0, message = '', reported = false
    const animate = (now: number) => {
      const dt = previous ? Math.min((now - previous) / 1000, .1) : 0
      previous = now
      if (!pausedRef.current && race.phase !== 'finished') {
        accumulator += dt
        while (accumulator >= 1 / 60) {
          const keySteer = (keys.current.has('ArrowRight') || keys.current.has('d') ? 1 : 0) - (keys.current.has('ArrowLeft') || keys.current.has('a') ? 1 : 0)
          stepRace(race, { steer: stickPointer.current !== null ? input.current.steer : keySteer, useItem: input.current.useItem }, 1 / 60)
          input.current.useItem = false
          accumulator -= 1 / 60
          for (const event of race.events) if (event.racer === 0) {
            if (optionsRef.current.sound) audio.effect(event.kind)
            message = event.kind === 'hit' ? 'だいじょうぶ！ すぐ はしれるよ' : event.kind === 'lap' ? 'あと 1しゅう！' : event.kind === 'pickup' ? 'アイテム ゲット！' : event.kind === 'finish' ? 'ゴール！' : ITEM_LABELS[event.kind]
            messageUntil = race.elapsed + 1.5
          }
        }
        const count = Math.ceil(race.countdown)
        if (count > 0 && count !== lastCount && optionsRef.current.sound) audio.effect('countdown')
        lastCount = count
      }
      renderer.draw(race, race.elapsed, reduced)
      if (!reported && (now - lastHud > 80 || race.phase === 'finished')) {
        const player = race.racers[0]
        setHud({ rank: getRank(race), lap: Math.min(race.lapCount, Math.floor(player.distance / course.length) + 1), countdown: Math.ceil(race.countdown), item: player.item, speed: player.speed, distance: player.distance, lane: player.lane, drift: player.drift, finished: race.phase === 'finished', time: player.finishTime ?? race.elapsed, message: race.elapsed < messageUntil ? message : '', racers: race.racers.map(({ id, distance, color }) => ({ id, distance, color })) })
        lastHud = now
      }
      if (race.phase === 'finished' && !reported) { reported = true; onClearRef.current(course.id) }
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(frame); renderer.dispose(); audio.stop(); audioRef.current = null; raceRef.current = null }
  }, [course])

  const triggerItem = useCallback(() => { if (!pausedRef.current) input.current.useItem = true }, [])
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { pause(); return }
      if (pausedRef.current) return
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      if (['ArrowLeft', 'ArrowRight', 'a', 'd'].includes(key)) { event.preventDefault(); keys.current.add(key) }
      if (event.code === 'Space' && !(event.target instanceof HTMLElement && event.target.closest('button'))) { event.preventDefault(); if (!event.repeat) triggerItem() }
    }
    const up = (event: KeyboardEvent) => { keys.current.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key) }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [pause, triggerItem])

  const moveStick = (event: PointerEvent<HTMLDivElement>) => {
    if (stickPointer.current !== event.pointerId) return
    const rect = event.currentTarget.getBoundingClientRect()
    const value = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * .32)))
    input.current.steer = value
    setStick(value)
  }
  const endStick = (event: PointerEvent<HTMLDivElement>) => { if (stickPointer.current === event.pointerId) { stickPointer.current = null; input.current.steer = 0; setStick(0) } }

  return <GamePlaySurface><section className={styles.race} aria-label={`${course.name}の レース`} data-phase={hud.finished ? 'finished' : hud.countdown > 0 ? 'countdown' : 'racing'} data-distance={Math.floor(hud.distance)} data-lane={Math.round(hud.lane)}>
    <canvas ref={canvasRef} width={480} height={270} className={styles.raceCanvas} aria-label="ドット絵の レースコース" />
    <GameBackButton onBack={onExit} />
    <div className={styles.raceTop}>
      <div className={styles.rank}><b>{hud.rank}</b><span>い</span><small>/ 4</small></div>
      <div className={styles.lap}><small>{course.name}</small><strong>{hud.lap}<span> / 2 しゅう</span></strong></div>
      <button type="button" className={styles.pauseButton} onClick={pause} aria-label="ひとやすみ">Ⅱ</button>
    </div>
    <MiniMap course={course} racers={hud.racers} />
    <div className={styles.announcement} role="status">{hud.message}</div>
    {!hud.finished && <>
      {hud.countdown > 0 && <div className={styles.countdown} aria-live="polite"><small>じゅんびは いい？</small><b>{hud.countdown}</b></div>}
      <div className={styles.stickArea}>
        <div className={styles.stick} role="slider" tabIndex={0} aria-label="ハンドル（左右の矢印キーでも操作）" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(stick * 100)} aria-orientation="horizontal"
          onPointerDown={event => { if (stickPointer.current !== null || pausedRef.current) return; event.preventDefault(); stickPointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); moveStick(event) }}
          onPointerMove={moveStick} onPointerUp={endStick} onPointerCancel={endStick} onLostPointerCapture={endStick}>
          <span className={styles.stickArrows} aria-hidden="true">◀{'\u2003\u2003\u2003'}▶</span><span className={styles.stickKnob} style={{ transform: `translateX(${stick * 34}%)` }} aria-hidden="true">✦</span>
        </div><span className={styles.controlLabel}>ハンドル <small>← → / A D</small></span>
      </div>
      <div className={styles.speed}><span>{Math.abs(hud.drift) > .05 ? '✧ ドリフト！' : 'じどうで はしるよ'}</span><i style={{ '--speed': `${Math.min(100, hud.speed / 3.3)}%` } as CSSProperties} /></div>
      <div className={styles.itemArea}><button type="button" className={`${styles.itemButton} ${hud.item ? styles.itemReady : ''}`} onPointerDown={event => { event.preventDefault(); triggerItem() }} onClick={event => { if (event.detail === 0) triggerItem() }} disabled={!hud.item || hud.countdown > 0} aria-label={hud.item ? `${ITEM_LABELS[hud.item]}を つかう` : 'アイテムを まってね'}><ItemGlyph item={hud.item} /></button><span className={styles.controlLabel}>{hud.item ? ITEM_LABELS[hud.item] : 'はこを とろう'}<small>SPACE</small></span></div>
    </>}
    {paused && !portrait && !hud.finished && <div className={styles.scrim}><section role="dialog" aria-modal="true" aria-label="ひとやすみ" className={styles.dialog}><span className={styles.eyebrow}>PIT STOP</span><h2>ひとやすみ</h2><Settings options={options} onChange={onOptions} /><button type="button" className={styles.primary} onClick={resume} autoFocus>▶ つづける</button><button type="button" className={styles.quiet} onClick={onExit}>コースを えらびなおす</button></section></div>}
    {hud.finished && <div className={styles.scrim}><section role="dialog" aria-modal="true" aria-label="レースの けっか" className={`${styles.dialog} ${styles.result}`}><span className={styles.eyebrow}>RACE COMPLETE</span><div className={styles.medal} aria-hidden="true">★</div><h2>ゴール！ おめでとう！</h2><p><b>{hud.rank}い</b> {Math.floor(hud.time / 60)}:{(hud.time % 60).toFixed(1).padStart(4, '0')} <span>2しゅう はしれたね</span></p><div className={styles.resultActions}><button type="button" className={styles.primary} onClick={onNext} autoFocus>つぎの コース →</button><button type="button" className={styles.secondary} onClick={onReplay}>もういちど</button></div><button type="button" className={styles.quiet} onClick={onExit}>コースを えらぶ</button></section></div>}
    {error && <div className={styles.scrim}><section className={styles.dialog} role="alert"><h2>えを ひょうじ できなかったよ</h2><button className={styles.primary} onClick={onReplay}>もういちど</button><button className={styles.quiet} onClick={onExit}>コースに もどる</button></section></div>}
  </section></GamePlaySurface>
}

export default function PixelKartPlay() {
  const [selected, setSelected] = useState<Course | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [options, setOptions] = useState(readOptions)
  const [cleared, setCleared] = useState(readCleared)
  const [settings, setSettings] = useState(false)
  const portrait = usePortrait()
  useGameIntroPlaying(selected !== null)
  const updateOptions = (value: Options) => {
    setOptions(value)
    if (value.sound) primeAudio()
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(value)) } catch { /* Private mode still plays. */ }
  }
  const start = (course: Course) => { if (options.sound) primeAudio(); setSelected(course); setAttempt(n => n + 1) }
  const clearCourse = useCallback((id: CourseId) => {
    setCleared(previous => {
      const next = [...new Set([...previous, id])]
      try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(next)) } catch { /* Optional save. */ }
      return next
    })
  }, [])
  return <main className={styles.page}>
    {selected ? <Race key={`${selected.id}:${attempt}`} course={selected} options={options} onOptions={updateOptions} portrait={portrait} onExit={() => setSelected(null)} onReplay={() => start(selected)} onNext={() => start(COURSES[(COURSES.indexOf(selected) + 1) % COURSES.length])} onClear={clearCourse} /> : <div className={styles.selection}>
      <header className={styles.header}><GameBackButton to="/" /><div><span className={styles.eyebrow}>LITTLE WHEELS · BIG ADVENTURE</span><h1>ドットカート<span aria-hidden="true">PIXEL KART</span></h1></div><button type="button" className={styles.settingsButton} onClick={() => setSettings(true)}>⚙ せってい</button></header>
      <div className={styles.courseHeading}><h2>どこを はしろう？</h2><span>4つの せかいを ぼうけんしよう</span></div>
      <div className={styles.courses}>{COURSES.map((course, index) => <button type="button" className={styles.courseCard} key={course.id} onClick={() => start(course)} style={{ '--accent': course.accent } as CSSProperties} aria-label={`${course.name}で あそぶ`}><CoursePreview course={course} /><div className={styles.cardNumber}>0{index + 1}{cleared.includes(course.id) && <span aria-label="クリアずみ">★</span>}</div><div className={styles.cardText}><span>{course.subtitle}</span><strong>{course.name}</strong><small>はしる <b>→</b></small></div></button>)}</div>
      <footer className={styles.selectionFooter}><p><b>← →</b> ひだりで まがる <span>＋</span> <b>✦</b> みぎで アイテム<small>アクセルは おまかせ！</small></p><div className={styles.itemLegend}>{ITEMS.map(item => <span key={item} title={ITEM_LABELS[item]}><ItemGlyph item={item} /><small>{ITEM_LABELS[item]}</small></span>)}</div></footer>
      {settings && <div className={styles.scrim}><section role="dialog" aria-modal="true" aria-label="せってい" className={styles.dialog}><span className={styles.eyebrow}>YOUR LITTLE ADVENTURE</span><h2>せってい</h2><Settings options={options} onChange={updateOptions} /><button type="button" className={styles.primary} onClick={() => setSettings(false)} autoFocus>これで あそぶ</button></section></div>}
    </div>}
    {portrait && <section className={styles.orientation} aria-label="横向きであそぶ案内"><GameBackButton to="/" /><span className={styles.rotateIcon} aria-hidden="true">▱ ↻</span><h1 className={styles.orientationTitle}>ドットカート</h1><h2>よこにして<br />あそんでね</h2><p>がめんを よこむきにすると<br />レースで あそべるよ</p></section>}
  </main>
}
