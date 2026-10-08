import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type Dispatch, type KeyboardEvent, type RefObject } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import { BRUSHES, GLAZES, glazeHex, shownHex } from './paint'
import { canStretch, classifyPot, createLump, POT_KINDS, silhouettePath, similarity, starsForScore, type Profile } from './pottery'
import { BAKE_MS, createRokuroScene, type RokuroCallbacks, type RokuroSceneHandle, type RokuroView } from './rokuroScene'
import { initialRokuroState, rokuroReducer, type RokuroAction, type RokuroState, type Tool } from './rokuroState'
import { addToShelf, readShelf, type ShelfItem } from './shelf'
import { findTarget, TARGETS, type TargetId } from './targets'
import { playDipSound, playDoneSound, playKilnSound, playSelectSound, playShelfSound, playStretchSound, playUndoSound } from './sounds'
import styles from './KurukuruRokuroPlay.module.css'

const TITLE = 'くるくる ろくろ'
const PROGRESS_KEY = 'kids-playground:kurukuru-rokuro:progress'
const progressStore = createStageProgressStore(PROGRESS_KEY, id => TARGETS.some(target => target.id === id))
const NUDGE = 0.08

const TOOLS: readonly { id: Tool; icon: string; name: string }[] = [
  { id: 'all', icon: '🪣', name: 'ぜんぶ ぬる' },
  ...BRUSHES.map(brush => ({ id: brush.id, icon: brush.id === 'thick' ? '🖌️' : brush.id === 'thin' ? '✏️' : '⚪', name: brush.name })),
]

function PotSilhouette({ profile, color, className }: { profile: Profile; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <path d={silhouettePath(profile)} fill={color} stroke="#7a4b2c" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}

function Stars({ count, label }: { count: number; label: string }) {
  return (
    <span className={styles.stars} role="img" aria-label={label}>
      {[0, 1, 2].map(index => <b key={index} aria-hidden="true" className={index < count ? styles.starOn : styles.starOff}>★</b>)}
    </span>
  )
}

// ---------------- メニュー ----------------

const HERO_PROFILE = TARGETS.find(target => target.id === 'jar')!.profile

function Menu({ onStart }: { onStart: (targetId: TargetId | null) => void }) {
  const [shelf] = useState<ShelfItem[]>(readShelf)
  const [progress] = useState(() => progressStore.read())
  return (
    <main className={styles.menu}>
      <header className={styles.menuHeader}><GameBackButton to="/" /></header>
      <div className={styles.hero} aria-hidden="true">
        <svg viewBox="0 0 100 100" className={styles.heroPot}>
          <defs>
            <clipPath id="rokuro-hero-clip"><path d={silhouettePath(HERO_PROFILE)} /></clipPath>
          </defs>
          <ellipse cx="50" cy="97" rx="44" ry="6" fill="#8f9aa4" />
          <g clipPath="url(#rokuro-hero-clip)">
            <rect x="0" y="0" width="100" height="100" fill="#c48a5e" />
            <g className={styles.heroStripes}>
              {Array.from({ length: 12 }, (_, index) => <rect key={index} x={index * 16 - 96} y="0" width="6" height="100" fill="#a36a43" opacity="0.35" />)}
            </g>
            <rect x="0" y="40" width="100" height="7" fill="#5cbfe0" />
            <rect x="0" y="52" width="100" height="3" fill="#f2c936" />
          </g>
        </svg>
        <span className={styles.heroHand}>👆</span>
      </div>
      <h1 className={styles.title}>{TITLE}</h1>
      <p className={styles.lead}>ねんどを ゆびで おして<br />じぶんだけの うつわを つくろう</p>
      <button type="button" className={styles.startButton} onClick={() => { primeAudio(); onStart(null) }}>
        ▶ じゆうに つくる
      </button>
      <section className={styles.menuSection} aria-labelledby="rokuro-odai">
        <h2 id="rokuro-odai">おだいに ちょうせん</h2>
        <ul className={styles.targets}>
          {TARGETS.map(target => (
            <li key={target.id}>
              <button type="button" className={styles.targetCard} aria-label={`${target.name}を つくる`} onClick={() => { primeAudio(); onStart(target.id) }}>
                <StageClearBadge stars={progress[target.id] ?? 0} corner />
                <PotSilhouette profile={target.profile} color="#e9c9a8" className={styles.targetShape} />
                <span>{target.emoji} {target.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {shelf.length > 0 && (
        <section className={styles.menuSection} aria-labelledby="rokuro-shelf">
          <h2 id="rokuro-shelf">🏺 たな</h2>
          <ul className={styles.shelf}>
            {shelf.map(item => (
              <li key={item.id}>
                {item.thumbnail
                  ? <img src={item.thumbnail} alt={POT_KINDS[item.kind].name} />
                  : <span role="img" aria-label={POT_KINDS[item.kind].name}><PotSilhouette profile={item.profile} color={glazeHex(item.base)} /></span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}

// ---------------- 3D の まど ----------------

function RokuroCanvas({ view, callbacks, handleRef, label, onKeyDown, onBlur }: {
  view: RokuroView
  callbacks: RokuroCallbacks
  handleRef: RefObject<RokuroSceneHandle | null>
  label: string
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void
  onBlur: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const initial = useRef({ view, callbacks })
  useEffect(() => {
    if (!host.current) return
    const handle = createRokuroScene(host.current, initial.current.view, initial.current.callbacks)
    handleRef.current = handle
    return () => { handleRef.current = null; handle.dispose() }
  }, [handleRef])
  useEffect(() => { handleRef.current?.sync(view) }, [view, handleRef])
  return <div ref={host} className={styles.canvas} tabIndex={0} role="application" aria-label={label} onKeyDown={onKeyDown} onBlur={onBlur} />
}

// ---------------- こうぼう（つくる がめん） ----------------

const STEPS = [
  { screen: 'shape', label: 'かたち' },
  { screen: 'paint', label: 'いろ' },
  { screen: 'bake', label: 'やく' },
] as const

function Workshop({ state, dispatch }: { state: RokuroState; dispatch: Dispatch<RokuroAction> }) {
  useGameIntroPlaying(true)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [generation, setGeneration] = useState(0)
  const [sound, toggleSound] = useSoundToggle()
  const [keyboard, setKeyboard] = useState(false)
  const [shaped, setShaped] = useState(false)
  const [painted, setPainted] = useState(false)
  const sceneRef = useRef<RokuroSceneHandle | null>(null)
  const target = findTarget(state.targetId)
  const kind = classifyPot(state.profile)
  const score = target ? similarity(state.profile, target.profile) : null
  const stars = score === null ? 0 : starsForScore(score)
  const ready = status === 'ready'
  const phase = state.screen === 'menu' ? 'shape' : state.screen

  const view = useMemo<RokuroView>(() => ({
    phase,
    profile: state.profile,
    paint: state.paint,
    brush: state.tool === 'all' ? null : state.tool,
    brushColor: state.color,
    target: target?.profile ?? null,
    kind,
    cursor: keyboard ? state.cursor : null,
  }), [phase, state.profile, state.paint, state.tool, state.color, state.cursor, target, kind, keyboard])

  const callbacks = useMemo<RokuroCallbacks>(() => ({
    status: setStatus,
    profile: profile => { setShaped(true); dispatch({ type: 'profile', profile }) },
    stroke: stroke => { setPainted(true); dispatch({ type: 'stroke', stroke }) },
  }), [dispatch])

  useEffect(() => {
    if (state.screen !== 'bake') return
    playKilnSound()
    const timer = window.setTimeout(() => {
      if (target) progressStore.record(target.id, stars)
      playDoneSound(stars)
      vibrate(stars >= 3 ? 'celebrate' : 'success')
      dispatch({ type: 'baked' })
    }, BAKE_MS)
    return () => window.clearTimeout(timer)
  }, [state.screen, target, stars, dispatch])

  const act = (action: RokuroAction, sound?: () => void) => () => {
    primeAudio()
    sound?.()
    dispatch(action)
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const keys: Record<string, RokuroAction | undefined> = {
      ArrowUp: { type: 'cursor', step: 1 },
      ArrowDown: { type: 'cursor', step: -1 },
      ArrowLeft: state.screen === 'shape' ? { type: 'nudge', delta: -NUDGE } : undefined,
      ArrowRight: state.screen === 'shape' ? { type: 'nudge', delta: NUDGE } : undefined,
      Enter: state.screen === 'paint' ? { type: 'paintRing' } : undefined,
      ' ': state.screen === 'paint' ? { type: 'paintRing' } : undefined,
    }
    const action = keys[event.key]
    if (!action) return
    event.preventDefault()
    primeAudio()
    setKeyboard(true)
    if (action.type === 'nudge') setShaped(true)
    if (action.type === 'paintRing') setPainted(true)
    dispatch(action)
  }

  const save = () => {
    primeAudio()
    const thumbnail = sceneRef.current?.capture() ?? undefined
    addToShelf({ kind, base: state.paint.base, profile: state.profile, thumbnail })
    playShelfSound()
    vibrate('tap')
    dispatch({ type: 'saved' })
  }

  const label = state.screen === 'shape'
    ? 'ろくろの ねんど。ゆびで さわって よこに うごかすと かたちが かわるよ。やじるしキーの うえ・したで たかさを えらび、ひだりで ほそく、みぎで ふとく できるよ'
    : state.screen === 'paint'
      ? 'ろくろの うつわ。ふでを えらんで さわると くるっと せんが かけるよ。やじるしキーの うえ・したで たかさを えらび、エンターで せんを ひけるよ'
      : 'ろくろの うつわ'

  const hint = !ready ? null
    : state.screen === 'shape' && !shaped ? { icon: '👆', text: 'ねんどを ゆびで おしてみよう', sub: 'うちへ → ほそく・そとへ → ふとく' }
      : state.screen === 'paint' && state.tool === 'all' && state.paint.base === null ? { icon: '🪣', text: 'いろを えらぶと ぜんぶ ぬれるよ', sub: '' }
        : state.screen === 'paint' && state.tool !== 'all' && !painted ? { icon: '🖌️', text: 'うつわに さわると くるっと せんが かけるよ', sub: '' }
          : null

  const message = state.screen === 'shape'
    ? 'ゆびで おして かたちを つくろう'
    : state.screen === 'paint'
      ? state.paintFull ? 'もう いっぱい かいたよ。かまで やこう！' : state.tool === 'all' ? 'うつわ ぜんたいの いろを えらぼう' : 'ふでの いろを えらんで かこう'
      : state.screen === 'bake' ? 'かまで やいているよ… ごうごう🔥' : ''

  const back = () => {
    primeAudio()
    dispatch({ type: 'back' })
  }

  return (
    <GamePlaySurface>
      <main className={styles.workshop}>
        <header className={styles.header}>
          <GameBackButton onBack={back} ariaLabel={state.screen === 'shape' || state.screen === 'done' ? 'メニューへ もどる' : 'まえへ もどる'} />
          <h1>{TITLE}</h1>
          <button type="button" className={styles.soundButton} aria-label="こうかおん" aria-pressed={sound} onClick={toggleSound}>{sound ? '🔊' : '🔇'}</button>
        </header>

        <section className={styles.stage} aria-label="ろくろ">
          <RokuroCanvas key={generation} view={view} callbacks={callbacks} handleRef={sceneRef} label={label} onKeyDown={onKeyDown} onBlur={() => setKeyboard(false)} />

          {target && (state.screen === 'shape' || state.screen === 'paint') && ready && (
            <div className={styles.targetHud}>
              <PotSilhouette profile={target.profile} color="#bfe8fa" className={styles.hudShape} />
              <span className={styles.hudText}>
                <small>おだい</small>
                <strong>{target.name}</strong>
                <Stars count={stars} label={`にてる ほし ${stars}こ`} />
              </span>
            </div>
          )}

          {hint && (
            <div className={styles.hint} aria-hidden="true">
              <span className={styles.hintIcon}>{hint.icon}</span>
              <span>{hint.text}{hint.sub && <><br /><small>{hint.sub}</small></>}</span>
            </div>
          )}

          {state.screen === 'done' && ready && (
            <div className={styles.celebration}>
              <span className={styles.sparkles} aria-hidden="true">✦ ✧ ✦</span>
              <h2>{POT_KINDS[kind].emoji} {POT_KINDS[kind].name}が できた！</h2>
              {target && <Stars count={stars} label={`ほし ${stars}こ`} />}
            </div>
          )}

          {status !== 'ready' && (
            <div className={styles.overlay} role={status === 'error' ? 'alert' : 'status'}>
              {status === 'loading' ? <p>ろくろを じゅんびちゅう…</p> : (
                <>
                  <p>3Dを ひょうじ できなかったよ</p>
                  <button type="button" className={styles.primary} onClick={() => { setStatus('loading'); setGeneration(value => value + 1) }}>もういちど</button>
                </>
              )}
            </div>
          )}
        </section>

        <section className={styles.panel} aria-label="どうぐ">
          <ol className={styles.steps} aria-label="つくる じゅんばん">
            {STEPS.map((step, index) => {
              const current = state.screen === step.screen || (step.screen === 'bake' && state.screen === 'done')
              return <li key={step.screen} aria-current={current ? 'step' : undefined} className={current ? styles.stepCurrent : undefined}>{index + 1} {step.label}</li>
            })}
          </ol>
          {message && <p className={styles.message} role="status">{message}</p>}

          {state.screen === 'shape' && (
            <>
              <div className={styles.toolRow}>
                <button type="button" disabled={!ready || !canStretch(state.profile, 1)} onClick={act({ type: 'stretch', direction: 1 }, () => playStretchSound(1))}><span aria-hidden="true">⬆️</span>のばす</button>
                <button type="button" disabled={!ready || !canStretch(state.profile, -1)} onClick={act({ type: 'stretch', direction: -1 }, () => playStretchSound(-1))}><span aria-hidden="true">⬇️</span>ちぢめる</button>
                <button type="button" disabled={!ready || state.shapeHistory.length === 0} onClick={act({ type: 'undoShape' }, playUndoSound)}><span aria-hidden="true">↩️</span>もどす</button>
                <button type="button" disabled={!ready || sameProfile(state.profile, LUMP)} onClick={act({ type: 'resetShape' }, playUndoSound)}><span aria-hidden="true">🔄</span>さいしょから</button>
              </div>
              <button type="button" className={styles.primary} disabled={!ready} onClick={act({ type: 'toPaint' }, () => playSelectSound(4))}>🎨 いろを ぬる →</button>
            </>
          )}

          {state.screen === 'paint' && (
            <>
              <div className={styles.tools} role="radiogroup" aria-label="どうぐ">
                {TOOLS.map((tool, index) => (
                  <button key={tool.id} type="button" role="radio" aria-checked={state.tool === tool.id} disabled={!ready}
                    onClick={act({ type: 'tool', tool: tool.id }, () => playSelectSound(index))}>
                    <span aria-hidden="true">{tool.icon}</span>{tool.name}
                  </button>
                ))}
              </div>
              <div className={styles.swatches} role="radiogroup" aria-label={state.tool === 'all' ? 'うつわの いろ' : 'ふでの いろ'}>
                {state.tool === 'all' && (
                  <button type="button" role="radio" aria-checked={state.paint.base === null} aria-label="つち" disabled={!ready}
                    className={styles.swatch} style={{ '--swatch': shownHex(null, false) } as CSSProperties}
                    onClick={act({ type: 'base', base: null }, playDipSound)} />
                )}
                {GLAZES.map((glaze, index) => {
                  const checked = state.tool === 'all' ? state.paint.base === glaze.id : state.color === glaze.id
                  return (
                    <button key={glaze.id} type="button" role="radio" aria-checked={checked} aria-label={glaze.name} disabled={!ready}
                      className={styles.swatch} style={{ '--swatch': glaze.hex } as CSSProperties}
                      onClick={state.tool === 'all'
                        ? act({ type: 'base', base: glaze.id }, playDipSound)
                        : act({ type: 'color', color: glaze.id }, () => playSelectSound(index))} />
                  )
                })}
              </div>
              <div className={styles.toolRow}>
                <button type="button" disabled={!ready || state.paintHistory.length === 0} onClick={act({ type: 'undoPaint' }, playUndoSound)}><span aria-hidden="true">↩️</span>もどす</button>
                <button type="button" className={styles.primary} disabled={!ready} onClick={act({ type: 'bake' })}>🔥 かまで やく →</button>
              </div>
            </>
          )}

          {state.screen === 'bake' && <div className={styles.bakeBar} aria-hidden="true"><span style={{ animationDuration: `${BAKE_MS}ms` }} /></div>}

          {state.screen === 'done' && (
            <div className={styles.toolRow}>
              <button type="button" disabled={!ready || state.saved} onClick={save}>
                <span aria-hidden="true">{state.saved ? '✅' : '🏺'}</span>{state.saved ? 'かざったよ' : 'たなに かざる'}
              </button>
              <button type="button" className={styles.primary} onClick={act({ type: 'restart' }, () => playSelectSound(7))}>🔁 もう1こ つくる</button>
            </div>
          )}
        </section>
      </main>
    </GamePlaySurface>
  )
}

const LUMP = createLump()
function sameProfile(a: Profile, b: Profile) {
  return a.height === b.height && a.radii.every((radius, index) => Math.abs(radius - b.radii[index]!) < 1e-6)
}

export default function KurukuruRokuroPlay() {
  const [state, dispatch] = useReducer(rokuroReducer, initialRokuroState)
  const start = useCallback((targetId: TargetId | null) => {
    window.scrollTo?.(0, 0)
    dispatch({ type: 'start', targetId })
  }, [])
  if (state.screen === 'menu') return <Menu onStart={start} />
  return <Workshop state={state} dispatch={dispatch} />
}
