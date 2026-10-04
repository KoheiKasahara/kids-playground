import { useCallback, useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import StageClearBadge from '../../components/StageClearBadge'
import { primeAudio } from '../../audio/sound'
import { totalStageStars, type StageProgress } from '../shared/progress/stageProgress'
import { createAttract, stepAttract } from './attract'
import { drainEvents } from './world'
import { createWorld } from './world'
import { Scene, eggSprite, heroCheerImage, rideImage, stageThumbnail } from './render'
import { createFx, spawnFx, updateFx } from './fx'
import { BOSS_NAMES, STAGES, WORLDS, stagesOfWorld, type WorldId } from './stages'
import { STORY, sceneAfter, sceneBefore } from './story'
import { drawStory, STORY_H, STORY_W } from './storyArt'
import { isUnlocked, markSeen, nextStageIndex, progressStore, readMusic, readSeen, writeMusic } from './progress'
import { playSelect, startBgm, type SongId } from './sounds'
import { blit, fitCanvas, reducedMotion } from './view'
import PixelIcon from './PixelIcon'
import StageScreen from './StageScreen'
import StoryScreen from './StoryScreen'
import styles from './DotBomb.module.css'

const TITLE = 'ドットの ボンボンぼうけん'
const FRAME_MS = 1000 / 60
const MAX_STARS = STAGES.length * 3

/** おはなしの あとに いく ところ（すうじは ステージの ばんごう）。 */
type Then = number | 'map' | 'ending'
type Screen =
  | { kind: 'title' }
  | { kind: 'map'; world: number }
  | { kind: 'story'; scene: string; then: Then }
  | { kind: 'play'; index: number; attempt: number }
  | { kind: 'ending' }

const goldEgg = () => eggSprite('gold')
const greenRide = () => rideImage('green')
const cheer = () => heroCheerImage()

// ---------------- タイトル ----------------

function TitleScreen({ progress, music, onMusic, onStart, onMap }: {
  progress: StageProgress; music: boolean; onMusic: () => void; onStart: () => void; onMap: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const next = nextStageIndex(progress)
  const fresh = Object.keys(progress).length === 0
  const stars = totalStageStars(progress)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    let world = createAttract()
    let scene: Scene
    try { scene = new Scene(world) } catch { return undefined }
    let fx = createFx()
    let view = fitCanvas(canvas, 14 * 16, 9 * 16)
    const measure = () => { view = fitCanvas(canvas, 14 * 16, 9 * 16) }
    window.addEventListener('resize', measure)
    const still = reducedMotion()
    let frame = 0, previous = 0, acc = 0, time = 0
    const tick = (now: number) => {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      frame = requestAnimationFrame(tick)
      if (document.hidden) return
      acc += elapsed
      let steps = 0
      while (acc >= FRAME_MS && steps < 4) {
        stepAttract(world)
        for (const e of drainEvents(world)) spawnFx(fx, e, world, scene.theme)
        updateFx(fx, world, view.w, view.h, scene.theme)
        fx.shake = Math.min(fx.shake, 3)
        time += 1 / 60
        acc -= FRAME_MS
        steps++
      }
      if (steps === 4) acc = 0
      if (world.frame > 60 * 60) { world = createAttract(); fx = createFx() }
      blit(ctx, scene.draw(world, fx, time, view.w, view.h), view)
      if (still) cancelAnimationFrame(frame)
    }
    frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure) }
  }, [])

  return <main className={styles.title}>
    <canvas ref={canvasRef} className={styles.titleCanvas} aria-hidden="true" />
    <div className={styles.titleShade} aria-hidden="true" />
    <GameBackButton to="/" />
    <button type="button" className={`${styles.window} ${styles.titleMusic}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪ おんがく' : '× おんがく'}
    </button>
    <div className={styles.titleInner}>
      <header className={styles.logo}>
        <p className={styles.logoSub}>〜 ピョンタの たまごを とりもどせ！ 〜</p>
        <h1>{TITLE}</h1>
      </header>
      <div className={styles.titleHeroes} aria-hidden="true">
        <PixelIcon make={cheer} className={styles.titlePon} />
        <PixelIcon make={greenRide} className={styles.titlePyonta} />
        <PixelIcon make={goldEgg} className={styles.titleEgg} />
      </div>
      <div className={styles.titleButtons}>
        <button type="button" className={`${styles.window} ${styles.bigButton} ${styles.primaryWindow}`} autoFocus onClick={() => { primeAudio(); playSelect(); onStart() }}>
          {fresh ? '▶ ぼうけんを はじめる' : next >= 0 ? `▶ つづきから（${STAGES[next].no}）` : '▶ エンディングを みる'}
        </button>
        {!fresh && <button type="button" className={`${styles.window} ${styles.bigButton}`} onClick={() => { primeAudio(); playSelect(); onMap() }}>
          ステージを えらぶ
        </button>}
      </div>
      {!fresh && <p className={styles.titleStars} aria-label={`あつめた ほし ${stars} / ${MAX_STARS}`}><span aria-hidden="true">★</span> {stars} / {MAX_STARS}</p>}
      <p className={styles.titleFoot}><span>じゅうじで いどう、</span><span>ボンボタンで ボンを おいて</span><span>ブロックと てきを ドカーン！</span></p>
    </div>
  </main>
}

// ---------------- マップ ----------------

function MapScreen({ progress, focus, music, onMusic, onPick, onBack }: {
  progress: StageProgress; focus: number; music: boolean; onMusic: () => void; onPick: (index: number) => void; onBack: () => void
}) {
  const [thumbs, setThumbs] = useState<Partial<Record<WorldId, string>>>({})
  const listRef = useRef<HTMLOListElement>(null)
  const stars = totalStageStars(progress)

  useEffect(() => {
    let cancelled = false
    const timers = WORLDS.map((world, i) => setTimeout(() => {
      if (cancelled) return
      const stage = stagesOfWorld(world.id)[0]
      const url = stageThumbnail(createWorld(stage), 15 * 16, 12 * 16)
      if (url) setThumbs(t => ({ ...t, [world.id]: url }))
    }, 60 + i * 90))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [])

  useEffect(() => {
    // まえに あそんだ ワールドが みえる ところから はじめる。
    const card = listRef.current?.children[focus] as HTMLElement | undefined
    if (focus > 0) card?.scrollIntoView?.({ block: 'center' })
  }, [focus])

  return <main className={styles.map}>
    <GameBackButton onBack={onBack} />
    <button type="button" className={`${styles.window} ${styles.titleMusic}`} onClick={onMusic} aria-pressed={music} aria-label={music ? 'おんがくを けす' : 'おんがくを ながす'}>
      {music ? '♪' : '×'}
    </button>
    <header className={styles.mapHead}>
      <h1>ステージを えらぶ</h1>
      <p className={styles.mapStars} aria-label={`あつめた ほし ${stars} / ${MAX_STARS}`}><span aria-hidden="true">★</span> {stars} / {MAX_STARS}</p>
    </header>
    <ol ref={listRef} className={styles.worldList} aria-label="ワールド">
      {WORLDS.map(world => {
        const stages = stagesOfWorld(world.id)
        const first = STAGES.indexOf(stages[0])
        const open = isUnlocked(progress, first)
        return <li key={world.id}>
          <section className={`${styles.window} ${styles.worldCard}`} data-world={world.id} aria-label={`ワールド${world.no} ${world.name}`}>
            <div className={styles.worldThumb} data-world={world.id}>
              {thumbs[world.id] && <img src={thumbs[world.id]} alt="" />}
              {!open && <span className={styles.lock} aria-hidden="true">🔒</span>}
            </div>
            <h2><small>ワールド {world.no}</small>{world.name}</h2>
            <p className={styles.worldLead}>{world.lead}</p>
            <div className={styles.stageButtons}>
              {stages.map(stage => {
                const index = STAGES.indexOf(stage)
                const unlocked = isUnlocked(progress, index)
                const got = progress[stage.id] ?? 0
                return <button key={stage.id} type="button" className={`${styles.stageButton} ${stage.boss ? styles.bossButton : ''}`} disabled={!unlocked}
                  aria-label={`${stage.no} ${stage.boss ? `ボス ${BOSS_NAMES[stage.boss]}` : stage.name}${got ? ` クリアずみ ほし${got}こ` : ''}${unlocked ? '' : ' まだ えらべない'}`}
                  onClick={() => { primeAudio(); playSelect(); onPick(index) }}>
                  <span className={styles.stageNo}>{stage.boss ? 'BOSS' : stage.no}</span>
                  <span className={styles.stageName}>{stage.name}</span>
                  {unlocked ? <span className={styles.badgeFit}><StageClearBadge stars={got} /></span> : <span className={styles.lockSmall} aria-hidden="true">🔒</span>}
                </button>
              })}
            </div>
          </section>
        </li>
      })}
    </ol>
  </main>
}

// ---------------- エンディング ----------------

function EndingScreen({ progress, onTitle, onMap }: { progress: StageProgress; onTitle: () => void; onMap: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stars = totalStageStars(progress)
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    canvas.width = STORY_W
    canvas.height = STORY_H
    ctx.imageSmoothingEnabled = false
    let frame = 0
    const start = performance.now()
    const draw = (now: number) => {
      try { drawStory(ctx, 'ending', ['pon', 'king', 'elder'], null, 'green', (now - start) / 1000, false) } catch { /* え なしで つづける */ }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])
  return <main className={styles.ending}>
    <GameBackButton onBack={onTitle} />
    <div className={styles.storyStage}><canvas ref={canvasRef} className={styles.storyCanvas} aria-hidden="true" /></div>
    <section className={`${styles.window} ${styles.endCard}`}>
      <h1>おしまい</h1>
      <p>ピョンタの たまごを ぜんぶ とりもどしたよ！ ありがとう、ポン！</p>
      <p className={styles.endStars} aria-label={`あつめた ほし ${stars} / ${MAX_STARS}`}><span aria-hidden="true">★</span> {stars} / {MAX_STARS}</p>
      {stars < MAX_STARS && <p className={styles.tip}>ハートを へらさず、ほしの かけらを みつけると ★が ふえるよ</p>}
      <div className={styles.cardButtons}>
        <button type="button" onClick={onMap}>ステージを えらぶ</button>
        <button type="button" className={styles.primary} autoFocus onClick={onTitle}>タイトルへ</button>
      </div>
    </section>
  </main>
}

// ---------------- ぜんたい ----------------

function songFor(screen: Screen): SongId | null {
  switch (screen.kind) {
    case 'title': return 'title'
    case 'map': return 'map'
    case 'story': return STORY[screen.scene]?.music ?? 'map'
    case 'ending': return 'ending'
    default: return null
  }
}

export default function DotBombPlay() {
  const [screen, setScreen] = useState<Screen>({ kind: 'title' })
  const [progress, setProgress] = useState(() => progressStore.read())
  const [music, setMusic] = useState(() => readMusic())
  const attempt = useRef(0)
  const toggleMusic = useCallback(() => setMusic(m => { writeMusic(!m); if (!m) primeAudio(); return !m }), [])

  const song = songFor(screen)
  useEffect(() => {
    if (!music || !song) return undefined
    return startBgm(song)
  }, [music, song])

  const refresh = () => setProgress(progressStore.read())
  const play = (index: number) => {
    refresh()
    attempt.current++
    setScreen({ kind: 'play', index, attempt: attempt.current })
  }
  /** ステージを はじめる（まだ みていない おはなしが あれば さきに みせる）。 */
  const begin = (index: number) => {
    const scene = sceneBefore(STAGES[index].id)
    if (scene && !readSeen().has(scene)) setScreen({ kind: 'story', scene, then: index })
    else play(index)
  }
  const goThen = (then: Then) => {
    if (then === 'map') { refresh(); setScreen({ kind: 'map', world: 0 }) }
    else if (then === 'ending') { refresh(); setScreen({ kind: 'ending' }) }
    else begin(then)
  }
  const worldIndexOf = (index: number) => WORLDS.findIndex(w => w.id === STAGES[index].world)
  const toMap = (index?: number) => { refresh(); setScreen({ kind: 'map', world: index === undefined ? Math.max(0, worldIndexOf(Math.max(0, nextStageIndex(progressStore.read())))) : worldIndexOf(index) }) }
  const afterClear = (index: number) => {
    const then: Then = index + 1 < STAGES.length ? index + 1 : 'ending'
    const scene = sceneAfter(STAGES[index].id)
    if (scene && (!readSeen().has(scene) || then === 'ending')) setScreen({ kind: 'story', scene, then })
    else goThen(then)
  }

  switch (screen.kind) {
    case 'title':
      return <TitleScreen progress={progress} music={music} onMusic={toggleMusic} onMap={() => toMap()}
        onStart={() => { const next = nextStageIndex(progressStore.read()); if (next >= 0) begin(next); else setScreen({ kind: 'story', scene: 'ending', then: 'ending' }) }} />
    case 'map':
      return <MapScreen progress={progress} focus={screen.world} music={music} onMusic={toggleMusic} onPick={begin} onBack={() => { refresh(); setScreen({ kind: 'title' }) }} />
    case 'story':
      return <StoryScreen key={screen.scene} sceneId={screen.scene}
        onDone={() => { markSeen(screen.scene); goThen(screen.then) }}
        onExit={() => { markSeen(screen.scene); toMap(typeof screen.then === 'number' ? screen.then : undefined) }} />
    case 'ending':
      return <EndingScreen progress={progress} onTitle={() => { refresh(); setScreen({ kind: 'title' }) }} onMap={() => toMap()} />
    case 'play':
      return <StageScreen key={`${screen.index}-${screen.attempt}`} index={screen.index} music={music} onMusic={toggleMusic}
        onExit={() => toMap(screen.index)}
        onRetry={() => play(screen.index)}
        onNext={() => afterClear(screen.index)} />
  }
}
