import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { createJourneyCourse, routePreview, ROUTES, TRAINS, type JourneyRoute, type TrainId } from './journeyModel'
import { journeySound } from './journeySound'
import { useTrainJourneyEngine, type JourneyCamera, type JourneyFeedback, type JourneyStatus } from './useTrainJourneyEngine'
import styles from './TrainJourneyPlay.module.css'

export default function TrainJourneyPlay() {
  const course = useMemo(() => createJourneyCourse(), [])
  const previews = useMemo(() => ({ common: routePreview(course, 'common'), bridge: routePreview(course, 'bridge'), forest: routePreview(course, 'forest') }), [course])
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
    setRoute(current => current === 'bridge' ? 'forest' : 'bridge')
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
            <div className={styles.sceneCaption}>{phase === 'select' ? 'はしも、もりも。すきな でんしゃで！' : paused ? 'ひとやすみ ☕' : feedback.boosting ? 'びゅーん！ はやい はやい！' : feedback.location}</div>
            <button type="button" ref={registerSwitchMarker} className={styles.pointMarker} onClick={changeRoute} aria-label="コースの ポイントを きりかえる">
              <span aria-hidden="true">↔ {destination.icon}</span><small>ポイント</small>
            </button>
          </>}
          {phase === 'play' && status === 'ready' && <aside className={styles.map} aria-label={`コースマップ。つぎは ${destination.label}`}>
            <svg viewBox="-26 -28 52 51" aria-hidden="true">
              <polyline points={previews.common} fill="none" stroke="#d2b57a" strokeWidth="1.5" />
              <polyline points={previews.forest} fill="none" stroke={route === 'forest' ? '#398258' : '#bdcdb7'} strokeWidth={route === 'forest' ? '2.2' : '1.2'} />
              <polyline points={previews.bridge} fill="none" stroke={route === 'bridge' ? '#3986cb' : '#b6c8d0'} strokeWidth={route === 'bridge' ? '2.2' : '1.2'} />
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
                <path d="M27 47V31Q27 23 10 9M27 31Q27 23 44 9" fill="none" stroke="#c8d3d4" strokeWidth="7" strokeLinecap="round" />
                <path d={route === 'bridge' ? 'M27 47V31Q27 23 10 9' : 'M27 47V31Q27 23 44 9'} fill="none" stroke="var(--route-color)" strokeWidth="7" strokeLinecap="round" />
                <circle cx="10" cy="8" r="7" fill="#287fca" /><circle cx="44" cy="8" r="7" fill="#328555" />
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
          <p className={styles.hint} aria-live="polite">{route === 'bridge' ? '🌉 あおい みちで はしへ' : '🌲 みどりの みちで トンネルへ'}<span>ポイントを すぎたら つぎの いっしゅう</span></p>
        </section>}
      </main>
    </GamePlaySurface>
  )
}
