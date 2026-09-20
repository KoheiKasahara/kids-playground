import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { findCourse, GOLF_BALLS, GOLF_COURSES, type CourseDefinition, type CourseId, type Gadget, type GolfBallId, type HoleDefinition } from './golfCourses'
import { roundOutline } from './golfGeometry'
import { createRound, finishHole, loadBestStars, nextHole, recordShot, restartHole, roundTotals, saveBestStars, STAMP_TEXT, stampFor, type RoundState } from './golfRound'
import { golfSound, type GolfSoundKind } from './golfSound'
import { usePutterGolfEngine, type EngineEvent, type GolfCamera, type GolfFeedback, type GolfStatus } from './usePutterGolfEngine'
import styles from './PutterGolfPlay.module.css'

const EMPTY: GolfFeedback = { phase: 'ready', strokes: 0, power: 0.5, aiming: false, returning: false }

/** コースの そとへ 落ちたときの ひとこと。コースごとに 落ちる先が ちがう。 */
const SPLASH_TEXT: Partial<Record<CourseId, string>> = {
  moon: 'ひゅーん！ もとの ばしょに もどるよ',
  snow: 'ゆきに ぼふっ！ もとの ばしょに もどるよ',
  candy: 'ミルクに ぽちゃん！ もとの ばしょに もどるよ',
  dino: 'したへ おっこちた！ もとの ばしょに もどるよ',
}

/** ホールを上から見た線。ミニマップとコースえらびの見本に使う。 */
function holeShape(hole: HoleDefinition) {
  const outlines = hole.floors.map(piece => roundOutline(piece).points)
  const xs = outlines.flat().map(point => point.x)
  const zs = outlines.flat().map(point => point.z)
  const pad = 0.8
  const minX = Math.min(...xs) - pad
  const minZ = Math.min(...zs) - pad
  return {
    viewBox: `${minX.toFixed(2)} ${minZ.toFixed(2)} ${(Math.max(...xs) - minX + pad).toFixed(2)} ${(Math.max(...zs) - minZ + pad).toFixed(2)}`,
    polygons: outlines.map(points => points.map(point => `${point.x.toFixed(2)},${point.z.toFixed(2)}`).join(' ')),
  }
}

function HoleMap({ hole, course, markerRef }: { hole: HoleDefinition; course: CourseDefinition; markerRef?: (element: SVGCircleElement | null) => void }) {
  const shape = useMemo(() => holeShape(hole), [hole])
  return (
    <svg viewBox={shape.viewBox} aria-hidden="true" focusable="false">
      {shape.polygons.map(points => <polygon key={points} points={points} fill={course.look.felt} stroke={course.look.wall} strokeWidth="0.32" strokeLinejoin="round" />)}
      {(hole.zones ?? []).map(zone => <circle key={`${zone.kind}:${zone.x}:${zone.z}`} cx={zone.x} cy={zone.z} r={zone.radius} fill={zone.kind === 'sand' ? course.look.sand : zone.kind === 'ice' ? course.look.ice : course.look.rough} />)}
      {(hole.gadgets ?? []).map(gadget => <GadgetMark key={gadget.id} gadget={gadget} course={course} />)}
      <circle cx={hole.cup.x} cy={hole.cup.z} r="0.42" fill="#2b332d" stroke="#ffffff" strokeWidth="0.14" />
      <path d={`M${hole.cup.x} ${hole.cup.z}V${hole.cup.z - 1.5}l1 0.35l-1 0.35`} fill="#ff4f5e" stroke="#ffffff" strokeWidth="0.1" />
      {markerRef && <circle ref={markerRef} cx={hole.tee.x} cy={hole.tee.z} r="0.4" fill="#ffffff" stroke="#e8505b" strokeWidth="0.16" />}
    </svg>
  )
}

/** ミニマップの しかけの しるし。しかけの種類ごとに 形を 変える。 */
function GadgetMark({ gadget, course }: { gadget: Gadget; course: CourseDefinition }) {
  switch (gadget.kind) {
    case 'windmill':
      return <rect x={gadget.x - 1.3} y={gadget.z - 0.7} width="2.6" height="1.4" rx="0.3" fill="#fbf5e6" stroke="#d9573f" strokeWidth="0.2" />
    case 'booster':
      return <rect x={gadget.x - 0.55} y={gadget.z - 0.6} width="1.1" height="1.2" rx="0.2" fill="#ffb13b" />
    case 'gate': {
      const length = Math.hypot(gadget.axis.x, gadget.axis.z) || 1
      const half = { x: (gadget.axis.x / length) * gadget.halfWidth, z: (gadget.axis.z / length) * gadget.halfWidth }
      return <line x1={gadget.x - half.x} y1={gadget.z - half.z} x2={gadget.x + half.x} y2={gadget.z + half.z} stroke={course.look.bumper} strokeWidth="0.42" strokeLinecap="round" />
    }
    case 'critter':
      return <g>
        <line x1={gadget.x} y1={gadget.z} x2={gadget.to.x} y2={gadget.to.z} stroke={course.look.bumper} strokeWidth="0.12" strokeDasharray="0.3 0.3" />
        <circle cx={(gadget.x + gadget.to.x) / 2} cy={(gadget.z + gadget.to.z) / 2} r="0.3" fill={course.look.bumper} />
      </g>
    case 'warp':
      return <g>
        <line x1={gadget.x} y1={gadget.z} x2={gadget.exit.x} y2={gadget.exit.z} stroke={course.look.bumperCap} strokeWidth="0.12" strokeDasharray="0.4 0.4" />
        <circle cx={gadget.x} cy={gadget.z} r={gadget.radius} fill="#2b2f52" stroke={course.look.bumper} strokeWidth="0.18" />
      </g>
    default:
      return <circle cx={gadget.x} cy={gadget.z} r={gadget.radius} fill={gadget.kind === 'rock' ? course.look.rock : course.look.bumper} />
  }
}

function stars(count: number, total = 3) {
  return '★'.repeat(count) + '☆'.repeat(Math.max(0, total - count))
}

export default function PutterGolfPlay() {
  const [phase, setPhase] = useState<'select' | 'play' | 'finished'>('select')
  const [courseId, setCourseId] = useState<CourseId>('meadow')
  const [ballId, setBallId] = useState<GolfBallId>('white')
  const [bigCup, setBigCup] = useState(false)
  const [round, setRound] = useState<RoundState>(() => createRound('meadow'))
  const [attempt, setAttempt] = useState(0)
  const [camera, setCamera] = useState<GolfCamera>('ball')
  const [sound, setSound] = useState(true)
  const [status, setStatus] = useState<GolfStatus>('loading')
  const [feedback, setFeedback] = useState<GolfFeedback>(EMPTY)
  const [message, setMessage] = useState<string | null>(null)
  const [holed, setHoled] = useState(false)
  const [best, setBest] = useState(() => loadBestStars())
  const [newBest, setNewBest] = useState(false)
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const course = findCourse(courseId) ?? GOLF_COURSES[0]!
  const holeIndex = phase === 'select' ? 0 : round.holeIndex
  const hole = course.holes[holeIndex] ?? course.holes[0]!
  // カップインの音は、そのホールで何回うったかで変える。state更新の中で音を鳴らさないよう、最新の値を覚えておく。
  const strokesRef = useRef(round.strokes)
  useEffect(() => { strokesRef.current = round.strokes }, [round.strokes])

  const play = useCallback((kind: GolfSoundKind, strength = 1, delay = 0) => { if (sound) golfSound(kind, strength, delay) }, [sound])
  const onEvent = useCallback((event: EngineEvent) => {
    switch (event.kind) {
      case 'shot': setRound(current => recordShot(current)); setMessage(null); play('putt', 0.5 + event.power * 0.5); break
      case 'wall': play('wall', event.strength); break
      case 'rock': play('rock', event.strength); break
      case 'bumper': play('bumper'); setMessage('ぽよーん！'); break
      case 'gate': play('gate', event.strength); setMessage('とびらに あたった！ あくのを まとう'); break
      case 'critter': play('critter'); setMessage('どうぶつに ぽーん！'); break
      case 'warp': play('warp'); setMessage('しゅーん！ むこうがわへ！'); break
      case 'windmill': play('windmill'); setMessage('はねに あたった！ タイミングを みて もういちど'); break
      case 'boost': play('boost'); setMessage('びゅーん！'); break
      case 'takeoff': play('jump'); setMessage('ジャンプ！'); break
      case 'land': play('land', event.strength); break
      case 'surface':
        if (event.surface === 'ice') { play('ice'); setMessage('つるつる すべるよ！') }
        else { play('sand'); setMessage(event.surface === 'sand' ? 'すなばで ザザッ' : 'ふかふかで とまりやすいよ') }
        break
      case 'splash': play('splash'); setMessage(SPLASH_TEXT[courseId] ?? 'ぽちゃん！ もとの ばしょに もどるよ'); break
      case 'lost': setMessage('おっと！ もとの ばしょに もどるよ'); break
      case 'returned': setMessage('ここから もういちど！'); break
      case 'assisted': play('click'); setMessage('カップの ちかくに おいたよ！'); break
      case 'hint': play('click'); setMessage('てんてんの ほうへ うってみよう'); break
      case 'aimed': play('click'); break
      case 'rest': {
        const near = Math.hypot(event.position.x - hole.cup.x, event.position.z - hole.cup.z) < 1.1
        setMessage(near ? 'おしい！ あと すこし！' : null)
        break
      }
      case 'cup': {
        play('cup')
        play(strokesRef.current <= 1 ? 'hole-in-one' : 'cheer', 1, 0.3)
        setRound(current => finishHole(current, hole))
        setHoled(true)
        setMessage(null)
        break
      }
    }
  }, [courseId, hole, play])

  const { registerContainer, registerMapMarker, retry } = usePutterGolfEngine({
    course, holeIndex, attempt, ballStyle: ballId, bigCup, camera,
    active: phase === 'play', reducedMotion,
    onStatus: setStatus, onFeedback: setFeedback, onEvent,
  })

  const begin = () => {
    if (sound) primeAudio()
    setRound(createRound(courseId))
    setAttempt(value => value + 1)
    setHoled(false)
    setMessage(null)
    setNewBest(false)
    setCamera('ball')
    setPhase('play')
    play('click')
  }
  const backToSelect = () => { setPhase('select'); setHoled(false); setMessage(null) }
  const advance = () => {
    if (round.holeIndex < course.holes.length - 1) {
      setRound(current => nextHole(current))
      setHoled(false)
      setMessage(null)
      play('click')
      return
    }
    const totals = roundTotals(round.scores)
    setNewBest(totals.stars > (best[courseId] ?? 0))
    setBest(saveBestStars(courseId, totals.stars))
    setHoled(false)
    setPhase('finished')
    play('hole-in-one')
  }
  const restart = () => {
    setRound(current => restartHole(current))
    setAttempt(value => value + 1)
    setHoled(false)
    setMessage(null)
    play('click')
  }

  const ready = status === 'ready'
  const lastScore = round.scores[round.holeIndex]
  const totals = roundTotals(round.scores)
  const caption = phase === 'select'
    ? 'すきな コースを えらんでね'
    : message ?? (feedback.phase === 'rolling' ? 'ころころ…' : feedback.aiming ? 'はなすと うつよ！' : round.strokes === 0 ? hole.tip : 'ひっぱって はなすと うてるよ')

  return (
    <GamePlaySurface>
      <main className={styles.page} style={{ '--course-color': course.color } as CSSProperties}>
        <header className={styles.header}>
          {phase === 'select' ? <GameBackButton to="/" /> : <GameBackButton onBack={backToSelect} />}
          <h1>パターゴルフ</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={() => { if (!sound) primeAudio(); setSound(value => !value) }}>
            <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
          </button>
        </header>

        <div className={styles.scene} ref={registerContainer} role="application" aria-label="パターゴルフの 3Dコース" data-testid="golf-scene">
          {status !== 'ready' && <div className={styles.sceneStatus} role={status === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">{status === 'error' ? '🚧' : '⛳'}</span>
            <strong>{status === 'error' ? 'コースを よみこめなかったよ' : 'コースの じゅんびちゅう…'}</strong>
            {status === 'error' ? <button type="button" onClick={retry}>もういちど</button> : <span className={styles.loadingDots} aria-hidden="true">● ● ●</span>}
          </div>}
          {ready && <>
            <p className={styles.sceneCaption} role="status">{caption}</p>
            {phase !== 'select' && <aside className={styles.map} aria-label={`ホール ${holeIndex + 1}/${course.holes.length}「${hole.name}」の ちず`}>
              <HoleMap hole={hole} course={course} markerRef={registerMapMarker} />
              <span>ホール {holeIndex + 1}/{course.holes.length}</span>
            </aside>}
            {phase === 'play' && feedback.aiming && <div className={styles.powerMeter} aria-hidden="true"><span style={{ height: `${Math.round(feedback.power * 100)}%` }} /></div>}
            {phase === 'play' && holed && lastScore && <section className={styles.holeResult} aria-label="カップイン" data-stamp={lastScore.stamp}>
              <strong>{lastScore.stamp === 'hole-in-one' ? 'ホールインワン！' : 'カップイン！'}</strong>
              <span className={styles.resultStars} aria-label={`ほし ${lastScore.stars}こ`}>{stars(lastScore.stars)}</span>
              <span>{lastScore.strokes}かいで はいったよ。{STAMP_TEXT[lastScore.stamp]}</span>
              <button type="button" className={styles.nextButton} onClick={advance}>
                {round.holeIndex < course.holes.length - 1 ? 'つぎの ホールへ ▶' : 'けっかを みる ▶'}
              </button>
            </section>}
          </>}
        </div>

        {phase === 'select' && <section className={styles.panel} aria-label="コースを えらぶ">
          <h2>どの コースで あそぶ？</h2>
          <div className={styles.courses}>
            {GOLF_COURSES.map(item => <button
              key={item.id}
              type="button"
              className={styles.courseButton}
              style={{ '--card-color': item.color } as CSSProperties}
              aria-label={`${item.label}コースを えらぶ`}
              aria-pressed={courseId === item.id}
              onClick={() => { setCourseId(item.id); play('click') }}
            >
              <span className={styles.check} aria-hidden="true">{courseId === item.id ? '✓' : ''}</span>
              <span className={styles.courseIcon} aria-hidden="true">{item.icon}</span>
              <strong>{item.label}</strong>
              <small>{item.description}</small>
              <span className={styles.holeThumbs} aria-hidden="true">{item.holes.map(entry => <HoleMap key={entry.id} hole={entry} course={item} />)}</span>
              {best[item.id] ? <small className={styles.best}>さいこう {best[item.id]}/{item.holes.length * 3} ★</small> : null}
            </button>)}
          </div>
          <div className={styles.options}>
            <div className={styles.balls} role="group" aria-label="ボールを えらぶ">
              {GOLF_BALLS.map(item => <button key={item.id} type="button" className={styles.ballButton} style={{ '--ball': item.color, '--accent': item.accent } as CSSProperties} aria-label={`${item.label}の ボール`} aria-pressed={ballId === item.id} onClick={() => { setBallId(item.id); play('click') }}>
                <span aria-hidden="true" />
              </button>)}
            </div>
            <button type="button" className={styles.bigCupButton} aria-pressed={bigCup} onClick={() => { setBigCup(value => !value); play('click') }}>
              <span aria-hidden="true">{bigCup ? '⭕' : '⚪'}</span><strong>おおきい カップ</strong><small>{bigCup ? 'はいりやすいよ' : 'ふつうの おおきさ'}</small>
            </button>
          </div>
          <button type="button" className={styles.beginButton} disabled={!ready} onClick={begin}><span aria-hidden="true">▶</span> スタート！</button>
        </section>}

        {phase === 'play' && <section className={styles.panel} aria-label="ゴルフの そうさ">
          <div className={styles.scoreRow}>
            <span className={styles.holeName}>ホール{holeIndex + 1} <strong>{hole.name}</strong></span>
            <span aria-label={`うった かず ${round.strokes}`}>うった かず <strong>{round.strokes}</strong></span>
            <span aria-label={`めやす ${hole.par}かい`}>めやす <strong>{hole.par}</strong></span>
          </div>
          <div className={styles.tools}>
            <button type="button" aria-pressed={camera === 'ball'} aria-label="ボールを みる" onClick={() => setCamera('ball')}><span aria-hidden="true">⚪</span>ボール</button>
            <button type="button" aria-pressed={camera === 'overview'} aria-label="ホール ぜんたいを みる" onClick={() => setCamera('overview')}><span aria-hidden="true">🗺️</span>ぜんたい</button>
            <button type="button" disabled={!ready} aria-label="この ホールを やりなおす" onClick={restart}><span aria-hidden="true">↺</span>やりなおす</button>
          </div>
        </section>}

        {phase === 'finished' && <section className={styles.panel} aria-label="けっか">
          <h2>{course.icon} {course.label}コース クリア！</h2>
          <p className={styles.totalStars} aria-label={`ほし ${totals.stars}こ`}>{stars(totals.stars, course.holes.length * 3)}</p>
          {newBest && <p className={styles.newBest}>🎉 さいこう きろく！</p>}
          <table className={styles.scorecard}>
            <thead><tr><th scope="col">ホール</th><th scope="col">うった かず</th><th scope="col">めやす</th><th scope="col">ほし</th></tr></thead>
            <tbody>
              {course.holes.map((entry, index) => {
                const score = round.scores.find(item => item.holeId === entry.id)
                return <tr key={entry.id}>
                  <th scope="row">{index + 1} {entry.name}</th>
                  <td>{score?.strokes ?? '-'}</td>
                  <td>{entry.par}</td>
                  <td aria-label={`ほし ${score?.stars ?? 0}こ`}>{score ? stars(score.stars) : '-'}{score ? <small> {STAMP_TEXT[stampFor(score.strokes, score.par)]}</small> : null}</td>
                </tr>
              })}
            </tbody>
          </table>
          <div className={styles.finishActions}>
            <button type="button" className={styles.beginButton} onClick={begin}><span aria-hidden="true">↺</span> もういちど</button>
            <button type="button" className={styles.secondaryButton} onClick={backToSelect}>コースを えらぶ</button>
          </div>
        </section>}
      </main>
    </GamePlaySurface>
  )
}
