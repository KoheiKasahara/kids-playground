import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { createJourneyCourse, defaultRoutes, MAP_ORDER, MAPS, nextRoute, routePreview, ROUTES, TRAINS, type JourneyCourse, type JourneyRoute, type MapId, type TrainId } from './journeyModel'
import { journeySound } from './journeySound'
import { useTrainJourneyEngine, type JourneyCamera, type JourneyFeedback, type JourneyStatus } from './useTrainJourneyEngine'
import styles from './TrainJourneyPlay.module.css'

const courses = new Map<MapId, JourneyCourse>()
function courseFor(id: MapId) {
  let course = courses.get(id)
  if (!course) { course = createJourneyCourse(id); courses.set(id, course) }
  return course
}
// The course map frames each board's rails.
const MAP_VIEWS: Record<MapId, string> = { island: '-26 -28 52 51', downtown: '-26 -28 54 50' }
const NUMBERS = ['①', '②', '③']

/** The point sign, drawn as one trunk with a branch per destination. */
function pointPath(index: number, count: number) {
  const x = pointKnob(index, count)
  return x === 27 ? 'M27 47V30V10' : `M27 47V30Q27 21 ${x} 11`
}
function pointKnob(index: number, count: number) {
  return count < 2 ? 27 : 10 + 34 * index / (count - 1)
}

export default function TrainJourneyPlay() {
  const [mapId, setMapId] = useState<MapId>('island')
  const course = courseFor(mapId)
  const map = MAPS[mapId]
  const previews = useMemo(() => Object.fromEntries(Object.keys(course.curves).map(edge => [edge, routePreview(course, edge)])), [course])
  const junctions = useMemo(() => course.switches.map(point => course.curves[point.trunk].getPointAt(1)), [course])
  const station = useMemo(() => course.curves[course.stationEdge].getPointAt(course.stationDistance / course.lengths[course.stationEdge]), [course])
  const [train, setTrain] = useState<TrainId>('bullet')
  const [routes, setRoutes] = useState<JourneyRoute[]>(() => defaultRoutes(course))
  const [phase, setPhase] = useState<'select' | 'play'>('select')
  const [paused, setPaused] = useState(false)
  const [camera, setCamera] = useState<JourneyCamera>('overview')
  const [status, setStatus] = useState<JourneyStatus>('loading')
  const [sound, setSound] = useState(true)
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [feedback, setFeedback] = useState<JourneyFeedback>({ location: `${map.station}で ひとやすみ`, boosting: false, atStation: true, nextSwitch: 0 })
  const { registerContainer, registerMapMarker, registerSwitchMarker, retry, boost, overview } = useTrainJourneyEngine({ course, train, routes, running: phase === 'play' && !paused && status === 'ready', camera, sound, reducedMotion, onStatus: setStatus, onFeedback: setFeedback })
  const playSound = useCallback((kind: Parameters<typeof journeySound>[0]) => { if (sound) journeySound(kind) }, [sound])
  const changeRoute = useCallback((index: number) => {
    setRoutes(current => current.map((route, i) => i === index ? nextRoute(course.switches[i].branches, route) : route))
    playSound('switch')
  }, [course, playSound])
  const chooseMap = (id: MapId) => {
    if (id !== mapId) {
      setMapId(id)
      setRoutes(defaultRoutes(courseFor(id)))
      setFeedback({ location: `${MAPS[id].station}で ひとやすみ`, boosting: false, atStation: true, nextSwitch: 0 })
    }
    playSound('switch')
  }
  const begin = () => {
    if (sound) primeAudio()
    setPaused(false)
    setCamera(reducedMotion ? 'overview' : 'follow')
    setPhase('play')
    playSound('horn')
  }
  const nextSwitch = Math.min(feedback.nextSwitch, course.switches.length - 1)
  const pointName = (index: number) => map.points[index] ? `${map.points[index]}の ポイント` : 'ポイント'
  const destination = ROUTES[routes[nextSwitch]]
  return (
    <GamePlaySurface>
      <main className={styles.page} style={{ '--route-color': destination.color } as CSSProperties}>
        <header className={styles.header}>
          <h1>でんしゃの たび</h1>
          <button type="button" className={styles.soundButton} aria-label="おと" aria-pressed={sound} onClick={() => { if (!sound) primeAudio(); setSound(value => !value) }}><span aria-hidden="true">{sound ? '🔊' : '🔇'}</span></button>
        </header>
        <div className={styles.scene} ref={registerContainer} role="application" aria-label="でんしゃの 3Dコース" data-testid="journey-scene">
          {status !== 'ready' && <div className={styles.sceneStatus} role={status === 'error' ? 'alert' : 'status'}>
            <span aria-hidden="true">{status === 'error' ? '🚧' : '🚂'}</span>
            <strong>{status === 'error' ? 'でんしゃを よみこめなかったよ' : 'でんしゃの じゅんびちゅう…'}</strong>
            {status === 'error' ? <button type="button" onClick={retry}>もういちど</button> : <span className={styles.loadingDots} aria-hidden="true">● ● ●</span>}
          </div>}
          {status === 'ready' && <>
            <div className={styles.sceneCaption}>{phase === 'select' ? map.intro : paused ? 'ひとやすみ ☕' : feedback.boosting ? 'びゅーん！ はやい はやい！' : feedback.location}</div>
            {course.switches.map((_, index) => <button type="button" key={`${mapId}-${index}`} ref={registerSwitchMarker(index)} className={styles.pointMarker} style={{ '--route-color': ROUTES[routes[index]].color } as CSSProperties} onClick={() => changeRoute(index)} aria-label={`コースの ${pointName(index)}を きりかえる`}>
              <span aria-hidden="true">↔ {ROUTES[routes[index]].icon}</span><small>{course.switches.length > 1 ? `${NUMBERS[index]} ` : ''}ポイント</small>
            </button>)}
          </>}
          {phase === 'play' && status === 'ready' && <aside className={styles.map} aria-label={`コースマップ。つぎは ${destination.label}`}>
            <svg viewBox={MAP_VIEWS[mapId]} aria-hidden="true">
              {course.switches.map(point => <polyline key={point.trunk} points={previews[point.trunk]} fill="none" stroke="#d2b57a" strokeWidth="1.5" />)}
              {course.switches.flatMap((point, index) => [...point.branches.filter(id => id !== routes[index]), routes[index]].map(id =>
                <polyline key={id} points={previews[id]} fill="none" stroke={id === routes[index] ? ROUTES[id].color : ROUTES[id].faded} strokeWidth={id === routes[index] ? '2.2' : '1.2'} />))}
              {junctions.map((point, index) => <circle key={index} cx={point.x} cy={point.z} r={index === nextSwitch ? 2.1 : 1.6} fill="#ffdf6e" stroke="#8a743c" strokeWidth="0.6" />)}
              <rect x={station.x - 4} y={station.z + 2} width="8" height="2.4" rx="0.5" fill="#bf7052" />
              <circle ref={registerMapMarker} cx={station.x} cy={station.z} r="2.2" fill="#ef7854" stroke="white" strokeWidth="1" />
            </svg>
            <span>つぎは {destination.icon} {destination.label}</span>
          </aside>}
          {phase === 'play' && camera === 'overview' && status === 'ready' && <button type="button" className={styles.fitButton} onClick={overview}>▣ ぜんたいに もどす</button>}
        </div>
        {phase === 'select' ? <section className={styles.selection} aria-label="でんしゃを えらぶ">
          <div className={styles.maps} role="group" aria-label="コースを えらぶ">
            {MAP_ORDER.map(id => <button type="button" key={id} aria-label={`${MAPS[id].label}の コースを えらぶ`} aria-pressed={mapId === id} onClick={() => chooseMap(id)}>
              <span aria-hidden="true">{MAPS[id].icon}</span><strong>{MAPS[id].label}</strong><small>{MAPS[id].description}</small>
            </button>)}
          </div>
          <h2>どの でんしゃで いこう？</h2>
          <div className={styles.trains}>
            {TRAINS.map(item => <button type="button" key={item.id} aria-label={`${item.label}を えらぶ`} aria-pressed={train === item.id} className={styles.trainButton} style={{ '--train-color': item.color } as CSSProperties} onClick={() => { setTrain(item.id); playSound('switch') }}>
              <span className={styles.check} aria-hidden="true">{train === item.id ? '✓' : ''}</span>
              <img src={`${import.meta.env.BASE_URL}models/train-journey/previews/${item.models[0]}.png`} alt="" width="80" height="80" draggable={false} />
              <strong>{item.label}</strong><small>{item.description}</small>
            </button>)}
          </div>
          <button type="button" className={styles.beginButton} disabled={status !== 'ready'} onClick={begin}><span aria-hidden="true">▶</span> しゅっぱつ！</button>
        </section> : <section className={styles.controls} aria-label="でんしゃの そうさ">
          <div className={styles.primaryActions} data-points={course.switches.length}>
            {course.switches.map((point, index) => {
              const route = ROUTES[routes[index]]
              const selected = point.branches.indexOf(routes[index])
              return <button type="button" key={`${mapId}-${index}`} className={styles.routeButton} style={{ '--route-color': route.color } as CSSProperties} data-next={index === nextSwitch} disabled={status !== 'ready'} onClick={() => changeRoute(index)} aria-label={`${pointName(index)}を きりかえる`}>
                <svg viewBox="0 0 54 52" aria-hidden="true">
                  <path d={point.branches.map((_, i) => pointPath(i, point.branches.length)).join('')} fill="none" stroke="#c8d3d4" strokeWidth="7" strokeLinecap="round" />
                  <path d={pointPath(selected, point.branches.length)} fill="none" stroke="var(--route-color)" strokeWidth="7" strokeLinecap="round" />
                  {point.branches.map((id, i) => <circle key={id} cx={pointKnob(i, point.branches.length)} cy="8" r="6" fill={ROUTES[id].color} />)}
                </svg>
                <span><small>{course.switches.length > 1 ? `${NUMBERS[index]} ` : ''}ポイント ↔</small><strong>{route.icon} {route.label}</strong><small>{index === nextSwitch ? 'つぎは こっち！' : 'そのあと'}</small></span>
              </button>
            })}
            <button type="button" className={styles.boostButton} disabled={status !== 'ready'} data-active={feedback.boosting && !paused} aria-label="かそく！" onClick={() => { setPaused(false); boost(); playSound('boost') }}>
              <span aria-hidden="true">⚡</span><strong>かそく！</strong><small>{feedback.boosting && !paused ? 'びゅーん！' : 'おすと はやくなるよ'}</small>
            </button>
          </div>
          <div className={styles.tools}>
            <button type="button" aria-pressed={camera === 'follow'} onClick={() => setCamera('follow')}><span aria-hidden="true">🚃</span>おいかける</button>
            <button type="button" aria-pressed={camera === 'overview'} onClick={() => setCamera('overview')}><span aria-hidden="true">🗺️</span>ぜんたい</button>
            <button type="button" aria-label="ふえを ならす" disabled={status !== 'ready'} onClick={() => playSound('horn')}><span aria-hidden="true">📯</span>ふえ</button>
            <button type="button" aria-label={paused ? 'はしる' : 'とまる'} aria-pressed={paused} onClick={() => setPaused(value => !value)}><span aria-hidden="true">{paused ? '▶' : '⏸'}</span>{paused ? 'はしる' : 'とまる'}</button>
            <button type="button" aria-label="でんしゃを えらびなおす" onClick={() => { setPhase('select'); setCamera('overview') }}><span aria-hidden="true">🚂</span>えらぶ</button>
          </div>
          <p className={styles.hint} aria-live="polite">{destination.hint}<span>{map.tip}</span></p>
        </section>}
      </main>
    </GamePlaySurface>
  )
}
