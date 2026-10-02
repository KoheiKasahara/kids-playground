import { useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { createWorld, getInteraction, getObjective, interact, POIS, STAGES, targetPoi, targetPoint, updateWorld, type PoiId, type World } from './model'
import { drawScene } from './render'
import { drawIcon, type IconKind } from './art'
import { playDeliverySound } from './sounds'
import styles from './ForestDeliveryPlay.module.css'

const progressStore = createStageProgressStore('forest-delivery-progress-v1', (id) => STAGES.some((stage) => stage.id === id))

function Icon({ kind, className = '' }: { kind: IconKind; className?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (ctx) { ctx.clearRect(0, 0, 24, 24); drawIcon(ctx, kind, 24) }
  }, [kind])
  return <canvas ref={canvas} width={24} height={24} className={`${styles.icon} ${className}`} aria-hidden="true" />
}

function Preview() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) drawScene(ctx, createWorld(0), 0, true)
  }, [])
  return <canvas ref={ref} width={320} height={288} className={styles.preview} role="img" aria-label="こぎつねの ゆうびんやさんと、かわが ながれる もりの むら" />
}

function Adventure({ index, sound, onExit, onComplete, onNext, onRetry }: {
  index: number; sound: boolean; onExit: () => void; onComplete: (id: string) => void; onNext: () => void; onRetry: () => void
}) {
  const world = useRef<World>(createWorld(index))
  const [snapshot, setSnapshot] = useState(() => createWorld(index))
  const canvas = useRef<HTMLCanvasElement>(null)
  const resultButton = useRef<HTMLButtonElement>(null)
  const stage = STAGES[index]
  const objective = getObjective(snapshot)
  const interaction = getInteraction(snapshot)
  const objectivePoi = POIS.find((poi) => poi.id === objective.targetId)
  useGameIntroPlaying(true)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previous = 0
    let elapsed = 0
    const animate = (now: number) => {
      frame = requestAnimationFrame(animate)
      const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0
      previous = now
      if (document.hidden) return
      elapsed += dt
      const walking = world.current.player.walking
      updateWorld(world.current, dt)
      if (walking !== world.current.player.walking) {
        const arrival = POIS.find((poi) => poi.id === world.current.targetId)
        if (arrival) world.current.message = `${arrival.name}に ついたよ！`
        setSnapshot(structuredClone(world.current))
      }
      drawScene(ctx, world.current, elapsed, media?.matches ?? false)
    }
    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (snapshot.completed) resultButton.current?.focus()
  }, [snapshot.completed])

  const goTo = (id: PoiId) => {
    if (world.current.completed) return
    primeAudio()
    targetPoi(world.current, id)
    setSnapshot(structuredClone(world.current))
  }
  const act = () => {
    primeAudio()
    const event = interact(world.current)
    if (event.type === 'none') return
    if (sound) playDeliverySound(event.type)
    vibrate(event.type === 'complete' ? 'celebrate' : event.type === 'deliver' ? 'success' : 'tap')
    setSnapshot(structuredClone(world.current))
    if (world.current.completed) onComplete(stage.id)
  }
  const inventory = (['parcel', 'wood', 'carrot', 'apple'] as const).filter((kind) => snapshot.inventory[kind])

  return <GamePlaySurface><div className={styles.adventure}>
    <div className={styles.journey}>
      <span className={styles.stageLabel}>{stage.name}</span>
      <div className={styles.stamps} aria-label={`${snapshot.delivered.length} / ${stage.deliveries.length} にんに おとどけ`}>
        {stage.deliveries.map((id) => <span key={id} className={`${styles.stamp} ${snapshot.delivered.includes(id) ? styles.delivered : ''}`}>
          <Icon kind={id} />
          <span aria-hidden="true">{snapshot.delivered.includes(id) ? '♥' : '·'}</span>
        </span>)}
      </div>
    </div>
    <div className={styles.playLayout}>
      <div className={styles.mapFrame}>
        <canvas ref={canvas} width={320} height={288} className={styles.map} role="img" aria-label="もりの ちず。いきたい ところを タッチ。したの ボタンでも いどうできるよ" onPointerDown={(event) => {
          if (world.current.completed) return
          const rect = event.currentTarget.getBoundingClientRect()
          targetPoint(world.current, (event.clientX - rect.left) / rect.width * 320, (event.clientY - rect.top) / rect.height * 288)
          setSnapshot(structuredClone(world.current))
        }} />
        <div className={styles.mapCaption} aria-hidden="true"><span>FOREST POST</span><span>{index === 2 ? '☾' : '✦'} {String(index + 1).padStart(2, '0')}</span></div>
      </div>
      <div className={styles.controlPanel}>
        {snapshot.completed ? <section className={styles.result} aria-labelledby="delivery-result">
          <div className={styles.resultStars} aria-label="ほし 3こ">★ ★ ★</div>
          <h2 id="delivery-result">みんなに とどいた！</h2>
          <p>やさしい おてつだい、ありがとう。</p>
          <div className={styles.resultAnimals}><Icon kind="fox" /><Icon kind="rabbit" /><Icon kind="squirrel" /><Icon kind="bear" /></div>
          <button ref={resultButton} className={styles.primary} onClick={onNext}>{index < STAGES.length - 1 ? 'つぎの もりへ →' : 'もりを えらぶ'}</button>
          <button className={styles.secondary} onClick={onRetry}>もういちど あそぶ</button>
        </section> : <>
          <div className={styles.objective}>
            <span className={styles.noteIcon}><Icon kind="parcel" /></span>
            <div><span className={styles.eyebrow}>つぎの おてつだい</span><p>{objective.text}</p></div>
          </div>
          <div className={styles.actionRow}>
            <button className={styles.guide} disabled={!objective.targetId || snapshot.player.walking} onClick={() => objective.targetId && goTo(objective.targetId)}>
              <span aria-hidden="true">➜</span><span>{snapshot.player.walking ? 'てくてく…' : `${objectivePoi?.name ?? 'つぎの ばしょ'}へ`}</span>
            </button>
            <button className={styles.primary} disabled={!interaction.enabled || snapshot.player.walking} onClick={act}>{snapshot.player.walking ? 'あるいているよ' : interaction.label}</button>
          </div>
          <p className={styles.message} role="status" aria-live="polite">{snapshot.message || 'いきたい ところを タッチしてね'}</p>
          <div className={styles.bag} aria-label="かばんの なか">
            <span>かばん</span>{inventory.length ? inventory.map((kind) => <span key={kind} className={styles.bagItem} aria-label={{ parcel: 'こづつみ', wood: 'きざい', carrot: 'にんじん', apple: 'りんご' }[kind]}><Icon kind={kind} /></span>) : <span className={styles.emptyBag}>からっぽ</span>}
          </div>
          <nav className={styles.destinations} aria-label="いきさき">
            {POIS.map((poi) => <button key={poi.id} className={styles.destination} aria-label={`${poi.name}へ いく`} onClick={() => goTo(poi.id)}>{poi.name}</button>)}
          </nav>
          <p className={styles.helper}>タッチでも ボタンでも あそべるよ</p>
        </>}
        <button className={styles.textButton} onClick={onExit}>もりを えらびなおす</button>
      </div>
    </div>
  </div></GamePlaySurface>
}

export default function ForestDeliveryPlay() {
  const [selected, setSelected] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [sound, setSound] = useState(true)
  const [progress, setProgress] = useState(progressStore.read)
  const start = (index: number) => { primeAudio(); setSelected(index); setAttempt((value) => value + 1) }
  return <main className={`${styles.page} ${selected !== null ? styles.playing : ''}`}>
    <header className={styles.header}>
      {selected === null ? <GameBackButton to="/" /> : <GameBackButton onBack={() => setSelected(null)} />}
      <h1>もりの おとどけやさん</h1>
      <button className={styles.sound} aria-label={sound ? 'おとを けす' : 'おとを だす'} aria-pressed={sound} onClick={() => { primeAudio(); setSound(!sound) }}>{sound ? '♪' : '♪̸'}<small>{sound ? 'おと' : 'なし'}</small></button>
    </header>
    {selected === null ? <div className={styles.start}>
      <div className={styles.intro}><span className={styles.eyebrow}>FOREST POST · もりの ゆうびんきょく</span><h2>きょうは、だれに<br />とどけよう？</h2><p>こぎつねと いっしょに、おてつだいの ぼうけん。</p></div>
      <div className={styles.startContent}>
        <div className={styles.hero}><Preview /><div className={styles.heroLabel}><Icon kind="fox" /><span>ちいさな かばんに<br /><strong>やさしさを つめて。</strong></span></div></div>
        <div className={styles.stagePicker}>
          <p className={styles.pickLabel}>あそぶ もりを えらんでね</p>
          {STAGES.map((stage, index) => <button key={stage.id} className={`${styles.stageCard} ${styles[`season${index}`]}`} onClick={() => start(index)} aria-label={`${stage.name}で あそぶ`}>
            <span className={styles.stageNumber}>0{index + 1}</span><Icon kind={index === 0 ? 'parcel' : index === 1 ? 'apple' : 'star'} />
            <span className={styles.stageText}><strong>{stage.name}</strong><small>{stage.subtitle}</small><StageClearBadge stars={progress[stage.id] ?? 0} /></span><span aria-hidden="true">→</span>
          </button>)}
          <p className={styles.reassurance}>じかんは たっぷり。ゆっくり あそぼう。</p>
        </div>
      </div>
    </div> : <Adventure key={`${selected}-${attempt}`} index={selected} sound={sound} onExit={() => setSelected(null)} onComplete={(id) => setProgress(progressStore.record(id, 3))} onRetry={() => start(selected)} onNext={() => selected < STAGES.length - 1 ? start(selected + 1) : setSelected(null)} />}
  </main>
}
