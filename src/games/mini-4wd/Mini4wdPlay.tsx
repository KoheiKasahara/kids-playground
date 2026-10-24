import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { COLORS, COURSES, PARTS, getStats } from './data'
import { drawCoursePreview, drawGarage, drawPartPreview } from './render'
import { progressStore, readBuild, writeBuild } from './save'
import { playMiniSound, startMiniBgm, stopMiniSounds } from './sounds'
import { useMiniRace } from './useMiniRace'
import type { Build, Course, PartCategory } from './types'
import styles from './Mini4wdPlay.module.css'

const TITLE = 'ドット ミニよんく'
const CATEGORIES: { id: PartCategory; name: string; icon: string }[] = [
  { id: 'body', name: 'ボディ', icon: '🏎' }, { id: 'motor', name: 'モーター', icon: '⚡' },
  { id: 'tires', name: 'タイヤ', icon: '◉' }, { id: 'rollers', name: 'ローラー', icon: '⚙' },
]

function GarageArt({ build, selected }: { build: Build; selected: PartCategory }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawGarage(ref.current, build, selected) }, [build, selected])
  return <canvas ref={ref} width={640} height={420} className={styles.garageCanvas} role="img" aria-label="くみたてた マシン。えらんだ パーツと いろが かわるよ" />
}
function PartArt({ build, category }: { build: Build; category: PartCategory }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawPartPreview(ref.current, build, category) }, [build, category])
  return <canvas ref={ref} width={160} height={110} className={styles.partArt} aria-hidden="true" />
}
function CourseArt({ course }: { course: Course }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => { if (ref.current) drawCoursePreview(ref.current, course) }, [course])
  return <canvas ref={ref} width={720} height={440} aria-hidden="true" />
}
function Stats({ build }: { build: Build }) {
  const stats = getStats(build)
  return <div className={styles.stats} aria-label="マシンの とくいなこと">
    {([['speed', 'はやさ', '⚡'], ['grip', 'まがりやすさ', '↪'], ['stability', 'あんてい', '◆']] as const).map(([key, label, icon]) =>
      <div key={key}><span>{icon} {label}</span><meter min={0} max={5} value={stats[key]} aria-label={label} /><b>{stats[key].toFixed(1)}</b></div>)}
  </div>
}

function RaceScreen({ course, build, sound, active, onBack, onRetry, onNext, onFinish }: {
  course: Course; build: Build; sound: boolean; active: boolean; onBack: () => void; onRetry: () => void; onNext: () => void; onFinish: (stars: number) => void
}) {
  const [paused, setPaused] = useState(false)
  const { canvasRef, hud, cheer } = useMiniRace(course, build, paused)
  const finishRef = useRef(onFinish)
  useEffect(() => { finishRef.current = onFinish }, [onFinish])
  useEffect(() => { if (hud.finished) finishRef.current(4 - hud.rank) }, [hud.finished, hud.rank])
  useEffect(() => {
    const pause = () => setPaused(true)
    const visibility = () => { if (document.hidden) pause() }
    window.addEventListener('blur', pause)
    document.addEventListener('visibilitychange', visibility)
    return () => { window.removeEventListener('blur', pause); document.removeEventListener('visibilitychange', visibility) }
  }, [])
  useEffect(() => {
    if (sound && active && !paused && !hud.finished) return startMiniBgm('race', course.theme)
  }, [sound, active, paused, hud.finished, course.theme])
  useEffect(() => { if (paused) stopMiniSounds() }, [paused])
  useEffect(() => () => stopMiniSounds(), [])
  const encourage = () => {
    if (paused || hud.finished || !cheer()) return
    playMiniSound('cheer')
    vibrate('impact')
  }
  const cheerState = hud.boosting ? 'boost' : hud.charge < 1 ? 'charge' : 'ready'
  return <div className={styles.raceLayout}>
    <div className={styles.trackPanel}>
      <div className={styles.raceHud}><strong>★ {hud.rank} い</strong><span>{hud.lap} / 3 しゅう</span><time>{hud.time.toFixed(1)}<small>びょう</small></time></div>
      <div className={styles.raceArt}>
        <canvas ref={canvasRef} width={720} height={440} role="img" aria-label={`${course.name}を はしる 3だいの ミニよんく`} />
        {hud.countdown > 0 && !paused && <div className={styles.countdown} aria-live="polite">{hud.countdown}<small>ようい！</small></div>}
        {paused && !hud.finished && <div className={styles.pauseOverlay}><strong>ひとやすみ</strong><button className={styles.primary} onClick={() => { primeAudio(); setPaused(false) }}>▶ つづける</button></div>}
      </div>
      <div className={styles.raceProgress} role="progressbar" aria-label="ゴールまで" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hud.progress * 100)}><span style={{ width: `${hud.progress * 100}%` }} /></div>
    </div>
    <aside className={styles.raceSidebar}>
      {hud.finished ? <div className={styles.result} role="status">
        <span className={styles.eyebrow}>FINISH!</span><h2>{hud.rank === 1 ? 'やったね！ 1い！' : `${hud.rank}い！ がんばったね！`}</h2>
        <div className={styles.resultStars} aria-label={`ほし ${4 - hud.rank}こ`}>{'★'.repeat(4 - hud.rank)}<span>{'☆'.repeat(hud.rank - 1)}</span></div>
        <p>{hud.time.toFixed(2)} びょう</p><p className={styles.hint}>パーツを かえると はしりも かわるよ</p>
        <button className={styles.primary} onClick={onRetry}>↻ もういちど</button>
        <button className={styles.secondary} onClick={onNext}>つぎの コースへ →</button>
        <button className={styles.textButton} onClick={onBack}>🔧 くみかえる</button>
      </div> : <>
        <div><span className={styles.eyebrow}>RACE DAY</span><h2>{course.name}</h2><p className={styles.hint}>じどうで はしるよ。おうえんしよう！</p></div>
        <p className={styles.callout} aria-live="polite">{hud.message}</p>
        <button className={styles.cheer} data-state={cheerState} disabled={paused || hud.countdown > 0} onClick={encourage} style={{ '--charge': hud.charge } as CSSProperties}>
          <span className={styles.cheerFill} aria-hidden="true" />
          {cheerState === 'boost' ? '🔥 パワーアップ！' : '⚑ がんばれー！'}
          <small>{cheerState === 'boost' ? 'ぐーんと はやく なったよ' : cheerState === 'charge' ? 'パワーを ためてるよ…' : 'おすと はやく なるよ'}</small>
        </button>
        <button className={styles.secondary} onClick={() => setPaused(true)} disabled={paused}>Ⅱ ひとやすみ</button>
      </>}
    </aside>
  </div>
}

export default function Mini4wdPlay() {
  const [build, setBuild] = useState(readBuild)
  const [category, setCategory] = useState<PartCategory>('body')
  const [stage, setStage] = useState<'garage' | 'courses' | 'race'>('garage')
  const [course, setCourse] = useState(COURSES[0])
  const [raceId, setRaceId] = useState(0)
  const [progress, setProgress] = useState(progressStore.read)
  const [sound, toggleSound] = useSoundToggle()
  const [active, setActive] = useState(false)
  const [visible, setVisible] = useState(true)
  useGameIntroPlaying(stage !== 'garage')
  useEffect(() => () => stopMiniSounds(), [])
  useEffect(() => { if (!sound || !visible) stopMiniSounds() }, [sound, visible])
  useEffect(() => {
    const update = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])
  useEffect(() => {
    if (active && sound && visible && stage !== 'race') return startMiniBgm('garage')
  }, [active, sound, visible, stage])
  const interact = (kind: 'select' | 'assemble' | 'start' = 'select') => { primeAudio(); setActive(true); playMiniSound(kind) }
  const updateBuild = (next: Build) => { interact('assemble'); setBuild(next); writeBuild(next); vibrate('tap') }
  const start = () => { interact('start'); setRaceId(id => id + 1); setStage('race') }
  const back = () => { interact(); setStage(stage === 'race' ? 'courses' : 'garage') }
  return <GamePlaySurface><main className={`${styles.page} ${stage === 'race' ? styles.racing : ''}`}>
    <header className={styles.header}>
      {stage === 'garage' ? <GameBackButton to="/" /> : <GameBackButton onBack={back} />}
      <h1>{TITLE}</h1>
      <button className={styles.sound} aria-label={sound ? 'おとを けす' : 'おとを つける'} aria-pressed={sound} onClick={() => { setActive(true); toggleSound() }}>{sound ? '♪' : '♩'}<small>{sound ? 'ON' : 'OFF'}</small></button>
    </header>
    <nav className={styles.steps} aria-label="あそびの じゅんばん">
      <span data-current={stage === 'garage'}>01 <b>つくる</b></span><i>›</i><span data-current={stage === 'courses'}>02 <b>えらぶ</b></span><i>›</i><span data-current={stage === 'race'}>03 <b>レース！</b></span>
    </nav>
    {stage === 'garage' && <div className={styles.garageLayout}>
      <section className={styles.machinePanel} aria-label="きみの マシン">
        <div className={styles.panelHeading}><span className={styles.eyebrow}>MY LITTLE GARAGE</span><span className={styles.saved}>✓ じどうで ほぞん</span></div>
        <GarageArt build={build} selected={category} />
        <div className={styles.paint} aria-label="ボディの いろ">{COLORS.map(color => <button key={color.id} aria-label={color.name} aria-pressed={build.color === color.id} onClick={() => updateBuild({ ...build, color: color.id })} style={{ '--paint': color.hex } as CSSProperties}><span>{build.color === color.id ? '✓' : ''}</span></button>)}</div>
        <Stats build={build} />
      </section>
      <section className={styles.partsPanel} aria-label="パーツを えらぶ">
        <div className={styles.categories} role="tablist" aria-label="パーツの しゅるい">{CATEGORIES.map((item, index) => <button key={item.id} role="tab" tabIndex={category === item.id ? 0 : -1} aria-selected={category === item.id} aria-controls="mini-parts" id={`mini-tab-${item.id}`} onClick={() => { interact(); setCategory(item.id) }} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % 4 : event.key === 'ArrowLeft' ? (index + 3) % 4 : event.key === 'Home' ? 0 : event.key === 'End' ? 3 : null
          if (next === null) return
          event.preventDefault(); interact(); setCategory(CATEGORIES[next].id)
          event.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus()
        }}><span aria-hidden="true">{item.icon}</span>{item.name}</button>)}</div>
        <div className={styles.parts} role="tabpanel" id="mini-parts" aria-labelledby={`mini-tab-${category}`}>
          {PARTS[category].map(part => <button className={styles.part} key={part.id} aria-pressed={build[category] === part.id} onClick={() => updateBuild({ ...build, [category]: part.id })}>
            <PartArt build={{ ...build, [category]: part.id }} category={category} /><span className={styles.partName}>{part.name}<small>{part.description}</small></span>
          </button>)}
        </div>
        <button className={styles.primary} onClick={() => { interact(); setStage('courses') }}>できた！ コースへ →</button>
      </section>
    </div>}
    {stage === 'courses' && <section className={styles.courseSection}>
      <div className={styles.sectionHeading}><span className={styles.eyebrow}>CHOOSE YOUR CIRCUIT</span><h2>どこを はしろう？</h2><p>どの コースも あそべるよ。3しゅうで しょうぶ！</p></div>
      <div className={styles.courses}>{COURSES.map((item, index) => <button className={styles.course} key={item.id} aria-pressed={course.id === item.id} onClick={() => { interact(); setCourse(item) }}>
        <CourseArt course={item} /><div className={styles.courseText}><span className={styles.eyebrow}>CIRCUIT 0{index + 1} {course.id === item.id ? '✓' : ''}</span><strong>{item.name}</strong><small>{item.subtitle}</small><StageClearBadge stars={progress[item.id] ?? 0} /></div>
      </button>)}</div>
      <div className={styles.courseFooter}><p>★ {course.name}</p><button className={styles.primary} onClick={start}>この コースで レース！ →</button></div>
    </section>}
    {stage === 'race' && <RaceScreen key={raceId} course={course} build={build} sound={sound} active={active && visible} onBack={() => { interact(); setStage('garage') }} onRetry={start} onNext={() => { interact(); setCourse(COURSES[(COURSES.indexOf(course) + 1) % COURSES.length]); setStage('courses') }} onFinish={stars => { setProgress(progressStore.record(course.id, stars)); vibrate('celebrate') }} />}
  </main></GamePlaySurface>
}
