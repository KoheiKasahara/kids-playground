import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { createJourneyCourse, nextRoute, routePreview, ROUTE_ORDER, ROUTES, TRAINS, type JourneyRoute, type TrainId } from './journeyModel'
import { journeySound } from './journeySound'
import { useTrainJourneyEngine, type JourneyCamera, type JourneyFeedback, type JourneyStatus } from './useTrainJourneyEngine'
import styles from './TrainJourneyPlay.module.css'

// The point sign, drawn as one trunk with a branch per destination.
const POINT_PATHS: Record<JourneyRoute, string> = {
  bridge: 'M27 47V30Q27 21 10 11',
  forest: 'M27 47V30V10',
  city: 'M27 47V30Q27 21 44 11',
}
const POINT_KNOBS: Record<JourneyRoute, number> = { bridge: 10, forest: 27, city: 44 }
const MAP_STROKES: Record<JourneyRoute, readonly [on: string, off: string]> = {
  bridge: ['#3986cb', '#b6c8d0'],
  forest: ['#398258', '#bdcdb7'],
  city: ['#c4702c', '#d8c5ae'],
}

export default function TrainJourneyPlay() {
  const course = useMemo(() => createJourneyCourse(), [])
  const previews = useMemo(() => ({ common: routePreview(course, 'common'), bridge: routePreview(course, 'bridge'), forest: routePreview(course, 'forest'), city: routePreview(course, 'city') }), [course])
  const [train, setTrain] = useState<TrainId>('bullet')
  const [route, setRoute] = useState<JourneyRoute>('bridge')
  const [phase, setPhase] = useState<'select' | 'play'>('select')
  const [paused, setPaused] = useState(false)
  const [camera, setCamera] = useState<JourneyCamera>('overview')
  const [status, setStatus] = useState<JourneyStatus>('loading')
  const [sound, setSound] = useState(true)
  const [reducedMotion] = useState(() => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [feedback, setFeedback] = useState<JourneyFeedback>({ location: 'にじいろえきで ひとやすみ', boosting: false, atStation: true })
  const { registerContainer, registerMapMarker, registerSwitchMarker, retry, boost, overview } = useTrainJourneyEngine({ course, train, route, running: phase === 'play' && !paused && status === 'ready', camera, sound, reducedMotion, onStatus: setStatus, onFeedback: setFeedback })
  const playSound = useCallback((kind: Parameters<typeof journeySound>[0]) => { if (sound) journeySound(kind) }, [sound])
  const changeRoute = useCallback(() => {
    setRoute(nextRoute)
    playSound('switch')
  }, [playSound])
  const begin = () => {
    if (sound) primeAudio()
    setPaused(false)
    setCamera(reducedMotion ? 'overview' : 'follow')
    setPhase('play')
    playSound('horn')
  }
  const destination = ROUTES[route]
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
            <div className={styles.sceneCaption}>{phase === 'select' ? 'はしも、もりも、まちも。すきな でんしゃで！' : paused ? 'ひとやすみ ☕' : feedback.boosting ? 'びゅーん！ はやい はやい！' : feedback.location}</div>
            <button type="button" ref={registerSwitchMarker} className={styles.pointMarker} onClick={changeRoute} aria-label="コースの ポイントを きりかえる">
              <span aria-hidden="true">↔ {destination.icon}</span><small>ポイント</small>
            </button>
          </>}
          {phase === 'play' && status === 'ready' && <aside className={styles.map} aria-label={`コースマップ。つぎは ${destination.label}`}>
            <svg viewBox="-26 -28 52 51" aria-hidden="true">
              <polyline points={previews.common} fill="none" stroke="#d2b57a" strokeWidth="1.5" />
              {[...ROUTE_ORDER.filter(id => id !== route), route].map(id =>
                <polyline key={id} points={previews[id]} fill="none" stroke={MAP_STROKES[id][id === route ? 0 : 1]} strokeWidth={id === route ? '2.2' : '1.2'} />)}
              <circle cx="-12" cy="-3" r="2.1" fill="#ffdf6e" stroke="#8a743c" strokeWidth="0.6" />
              <rect x="-7" y="20" width="8" height="2.4" rx="0.5" fill="#bf7052" />
              <circle ref={registerMapMarker} cx="-4" cy="18" r="2.2" fill="#ef7854" stroke="white" strokeWidth="1" />
            </svg>
            <span>つぎは {destination.icon} {destination.label}</span>
          </aside>}
          {phase === 'play' && camera === 'overview' && status === 'ready' && <button type="button" className={styles.fitButton} onClick={overview}>▣ ぜんたいに もどす</button>}
        </div>
        {phase === 'select' ? <section className={styles.selection} aria-label="でんしゃを えらぶ">
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
          <div className={styles.primaryActions}>
            <button type="button" className={styles.routeButton} disabled={status !== 'ready'} onClick={changeRoute} aria-label="ポイントを きりかえる">
              <svg viewBox="0 0 54 52" aria-hidden="true">
                <path d={ROUTE_ORDER.map(id => POINT_PATHS[id]).join('')} fill="none" stroke="#c8d3d4" strokeWidth="7" strokeLinecap="round" />
                <path d={POINT_PATHS[route]} fill="none" stroke="var(--route-color)" strokeWidth="7" strokeLinecap="round" />
                {ROUTE_ORDER.map(id => <circle key={id} cx={POINT_KNOBS[id]} cy="8" r="6" fill={ROUTES[id].color} />)}
              </svg>
              <span><small>ポイント ↔</small><strong>{destination.icon} {destination.label}</strong><small>つぎは こっち！</small></span>
            </button>
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
          <p className={styles.hint} aria-live="polite">{destination.hint}<span>ポイントを すぎたら つぎの いっしゅう</span></p>
        </section>}
      </main>
    </GamePlaySurface>
  )
}
