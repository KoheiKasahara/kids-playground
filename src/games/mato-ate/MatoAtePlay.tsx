import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { DIFFICULTIES, FEATURE_LABELS, LEVELS, levelFeatures, starsFor, type Feature } from './levels'
import { createFx, drawScene, makeView, spawnFx, toWorld, updateFx, type View } from './render'
import { readProgress, recordStars, type MatoProgress } from './progress'
import { angleTo, clampAngle, createGame, muzzle, type Game, type GameState, type Point } from './world'
import { playBlockSound, playBounceSound, playClearSound, playFailSound, playHitSound, playMissSound, playShootSound } from './sounds'
import styles from './MatoAtePlay.module.css'

const TITLE = 'ねらって！まとあて'
const FRAME_MS = 1000 / 60
/** クリア・ざんねんの カードを だすまでの ま（フレーム）。われる えんしゅつを 見せてから だす。 */
const RESULT_DELAY = 55
/** けっかを だしてから この フレーム数 たったら 絵を とめて 電池を まもる。 */
const REST_AFTER_RESULT = 150
/** うてない あいだ（つぎの たまの じゅんび中）に タップしたら、これだけ まって うつ。 */
const QUEUE_SECONDS = .45
/** キーボードで ねらう ときの 1回の まわる かくど。 */
const KEY_TURN = .05

// かみふぶきは 毎回 同じ ばらつきで ふらせる（テストでも ゆれない）。
const CONFETTI: CSSProperties[] = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { left: `${r(1) * 100}%`, background: `hsl(${Math.round(r(2) * 360)} 90% 62%)`, animationDuration: `${1.8 + r(3) * 1.6}s`, animationDelay: `${-r(4) * 3}s`, width: `${6 + r(5) * 6}px` }
})

type Hud = { state: GameState; score: number; ammo: number; left: number; shots: number }
type Result = { kind: 'clear'; stars: number; score: number; hits: number; shots: number } | { kind: 'fail'; left: number }

const hudOf = (game: Game): Hud => ({ state: game.state, score: game.score, ammo: game.ammo, left: game.targetsLeft, shots: game.shots })
const hudChanged = (hud: Hud, game: Game) => hud.state !== game.state || hud.score !== game.score || hud.ammo !== game.ammo || hud.left !== game.targetsLeft || hud.shots !== game.shots

function reducedMotionQuery() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

const difficultyOf = (index: number) => DIFFICULTIES.find(d => d.id === LEVELS[index].difficulty)!

function Stage({ index, onExit, onRetry, onNext }: { index: number; onExit: () => void; onRetry: () => void; onNext: () => void }) {
  useGameIntroPlaying(true)
  const level = LEVELS[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const viewRef = useRef<View | null>(null)
  /** たいほうの むき と ねらって いる ばしょ（せかいの 座標）。 */
  const aim = useRef<{ angle: number; point: Point | null; pointer: number | null; pending: number }>({ angle: 0, point: null, pointer: null, pending: 0 })
  const [hud, setHud] = useState<Hud>(() => ({ state: 'play', score: 0, ammo: level.balls, left: level.targets.filter(t => t.kind !== 'gold').length, shots: 0 }))
  const [result, setResult] = useState<Result | null>(null)
  const [tip, setTip] = useState('')

  useEffect(() => {
    const game = createGame(level)
    gameRef.current = game
    const fx = createFx()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    const reducedMotion = reducedMotionQuery()
    let size = { w: 0, h: 0, dpr: 1 }
    let resting = false
    let time = 0
    const measure = () => {
      if (!canvas) return
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size = { w: box.width || 400, h: box.height || 720, dpr }
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      viewRef.current = makeView(size.w, size.h)
      // とまった あとでも 大きさが かわったら かきなおす（canvasは 大きさを かえると きえる）。
      if (resting) draw()
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    const cancelAim = () => { aim.current.point = null; aim.current.pointer = null }
    window.addEventListener('blur', cancelAim)

    let frame = 0, previous = 0, accumulator = 0
    let lastHud = hudOf(game)
    let lastState = game.state
    let resultTimer = -1, restTimer = -1, tipTimer = -1
    const say = (text: string) => { setTip(text); tipTimer = 110 }
    function draw() {
      const view = viewRef.current
      if (!ctx || !view) return
      drawScene(ctx, {
        view, dpr: size.dpr, time, game, angle: aim.current.angle, aim: aim.current.point, fx, reducedMotion,
        showHint: index === 0 && game.shots === 0 && !aim.current.point,
      })
    }
    function tick(now: number) {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      let frames = 0
      if (!document.hidden) {
        accumulator += elapsed
        while (accumulator >= FRAME_MS && frames < 6) {
          const a = aim.current
          if (a.pending > 0) {
            a.pending -= 1 / 60
            if (game.canFire()) { game.fire(a.angle); a.pending = 0 }
          }
          game.step()
          updateFx(fx)
          accumulator -= FRAME_MS
          frames++
        }
        if (frames === 6) accumulator = 0
      }
      time += frames / 60
      for (const event of game.drainEvents()) {
        spawnFx(fx, event)
        if (event.type === 'fire') playShootSound()
        else if (event.type === 'hit') playHitSound(event.kind, event.broken, event.combo)
        else if (event.type === 'block') { playBlockSound(); say('かべに あたったよ！ すきまを ねらおう') }
        else if (event.type === 'bounce') playBounceSound()
        else if (event.type === 'miss') playMissSound()
        if (event.type === 'fire' && game.ammo === 1 && game.targetsLeft > 1) say('のこり 1ぱつ！ よく ねらって')
      }
      if (tipTimer > 0 && (tipTimer -= frames) <= 0) setTip('')
      if (game.state !== lastState) {
        resultTimer = RESULT_DELAY
        lastState = game.state
        aim.current.point = null
        tipTimer = -1
        setTip('')
      }
      if (resultTimer > 0 && (resultTimer -= frames) <= 0) {
        resultTimer = -1
        if (game.state === 'clear') {
          const stars = starsFor(game.misses)
          recordStars(index, stars)
          playClearSound()
          setResult({ kind: 'clear', stars, score: game.score, hits: game.hits, shots: game.shots })
        } else {
          playFailSound()
          setResult({ kind: 'fail', left: game.targetsLeft })
        }
        restTimer = REST_AFTER_RESULT
      }
      draw()
      if (hudChanged(lastHud, game)) { lastHud = hudOf(game); setHud(lastHud) }
      if (restTimer > 0 && (restTimer -= frames) <= 0) { resting = true; return }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('blur', cancelAim)
      gameRef.current = null
    }
  }, [level, index])

  function worldPoint(event: PointerEvent<HTMLCanvasElement>): Point | null {
    const view = viewRef.current
    if (!view) return null
    const box = event.currentTarget.getBoundingClientRect()
    return toWorld(view, event.clientX - box.left, event.clientY - box.top)
  }

  function aimAt(point: Point) {
    aim.current.angle = angleTo(point)
    aim.current.point = point
  }

  /** たまを うつ。じゅんび中なら すこしだけ まって うつ。 */
  function shoot() {
    const game = gameRef.current
    if (!game || game.state !== 'play' || game.ammo <= 0) return
    if (!game.fire(aim.current.angle)) aim.current.pending = QUEUE_SECONDS
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    const game = gameRef.current
    if (!game || game.state !== 'play' || !event.isPrimary || event.button !== 0 || aim.current.pointer !== null) return
    event.preventDefault()
    primeAudio()
    event.currentTarget.focus({ preventScroll: true })
    const point = worldPoint(event)
    if (!point) return
    aim.current.pointer = event.pointerId
    aimAt(point)
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (aim.current.pointer !== event.pointerId) return
    event.preventDefault()
    const point = worldPoint(event)
    if (point) aimAt(point)
  }

  function up(event: PointerEvent<HTMLCanvasElement>, commit: boolean) {
    if (aim.current.pointer !== event.pointerId) return
    aim.current.pointer = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (commit) {
      const point = worldPoint(event)
      if (point) aimAt(point)
      shoot()
    }
    aim.current.point = null
  }

  function keyAimPoint(angle: number): Point {
    const start = muzzle(angle)
    return { x: start.x + Math.sin(angle) * 300, y: start.y - Math.cos(angle) * 300 }
  }

  function key(event: KeyboardEvent<HTMLCanvasElement>) {
    const game = gameRef.current
    if (!game || game.state !== 'play') return
    const turn = event.key === 'ArrowLeft' ? -KEY_TURN : event.key === 'ArrowRight' ? KEY_TURN : 0
    if (turn) {
      event.preventDefault()
      const angle = clampAngle(aim.current.angle + turn)
      aim.current.angle = angle
      aim.current.point = keyAimPoint(angle)
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      primeAudio()
      shoot()
    }
  }

  const difficulty = difficultyOf(index)
  const hint = hud.state !== 'play' ? '' : hud.shots === 0 ? level.hint : tip
  return <GamePlaySurface><main className={styles.play} data-difficulty={level.difficulty}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <GameBackButton onBack={onExit} />
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
      aria-label={`ステージ ${index + 1} ${level.name}。ねらう ところを タップすると たまが とんでいくよ。やじるしキーで ねらって スペースで うてるよ`}
      onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e, true)} onPointerCancel={e => up(e, false)} onLostPointerCapture={e => up(e, false)}
      onKeyDown={key} onBlur={() => { if (aim.current.pointer === null) aim.current.point = null }} />
    <div className={styles.hud}>
      <div className={styles.levelTag}>
        <span className={styles.levelNumber}>{index + 1}</span>
        <span className={styles.levelText}><small>{difficulty.label}</small><span className={styles.levelName}>{level.name}</span></span>
      </div>
      <div className={styles.stats}>
        <span className={styles.stat} aria-label={`のこりの まと ${hud.left}こ`}><TargetIcon />×{hud.left}</span>
        <span className={styles.stat} aria-label={`のこりの たま ${hud.ammo}こ`} data-low={hud.ammo <= 2 && hud.state === 'play' || undefined}><i className={styles.ballDot} />×{hud.ammo}</span>
      </div>
      <span className={`${styles.stat} ${styles.score}`} aria-label={`${hud.score}てん`}>{hud.score.toLocaleString('ja-JP')}<small>てん</small></span>
      <button type="button" className={styles.iconButton} onClick={onRetry} aria-label="さいしょから やりなおす">↻</button>
    </div>
    <div className={styles.banner} aria-hidden="true">
      <span className={styles.bannerSub}>{difficulty.label} ・ ステージ {index + 1}</span>
      <span className={styles.bannerTitle}>{level.name}</span>
    </div>
    <p className={styles.bubble} role="status" data-show={Boolean(hint) || undefined}>{hint}</p>
    {result && <div className={styles.overlay}>
      {result.kind === 'clear' ? <div className={styles.card} role="dialog" aria-label="クリア">
        <div className={styles.confetti} aria-hidden="true">{CONFETTI.map((style, i) => <i key={i} style={style} />)}</div>
        <h2>クリア！</h2>
        <p className={styles.resultLead}>まとを ぜんぶ わったよ</p>
        <div className={styles.stars} aria-label={`ほし ${result.stars}こ`}>{[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.25 + i * .28}s` }}>★</span>)}</div>
        <p className={styles.resultScore}>{result.score.toLocaleString('ja-JP')} てん</p>
        <p className={styles.resultNote}>めいちゅう {result.hits} / {result.shots}ぱつ</p>
        <p className={styles.resultNote}>{result.stars === 3 ? 'すごい！ ねらいが ばっちり！' : 'はずしが すくないほど ほしが ふえるよ'}</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onRetry}>↻ もういちど</button>
          <button type="button" className={styles.primary} autoFocus onClick={onNext}>{index === LEVELS.length - 1 ? 'ステージを えらぶ' : 'つぎへ →'}</button>
        </div>
      </div> : <div className={styles.card} role="dialog" aria-label="ざんねん">
        <h2 className={styles.failTitle}>おしい！</h2>
        <p className={styles.resultNote}>まとが あと {result.left}こ のこっているよ</p>
        <p className={styles.resultNote}>たまが とどく じかんを かんがえて ねらおう</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>ステージを えらぶ</button>
          <button type="button" className={styles.primary} autoFocus onClick={onRetry}>↻ もういちど</button>
        </div>
      </div>}
    </div>}
  </main></GamePlaySurface>
}

function TargetIcon() {
  return <svg className={styles.targetIcon} viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="11" fill="#e53935" stroke="#9c1f1b" strokeWidth="1.2" />
    <circle cx="12" cy="12" r="8" fill="#fff" />
    <circle cx="12" cy="12" r="5.2" fill="#e53935" />
    <circle cx="12" cy="12" r="2.4" fill="#ffc53d" />
  </svg>
}

function FeatureIcon({ feature }: { feature: Feature }) {
  return <i className={styles.featureIcon} data-feature={feature} aria-hidden="true" />
}

function TitleArt() {
  return <svg className={styles.titleArt} viewBox="0 0 320 132" aria-hidden="true">
    <path d="M0 112 Q80 96 160 108 T320 104 V132 H0Z" fill="#5bb343" />
    <path d="M84 84 Q150 -8 236 42" stroke="#fff" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" fill="none" />
    <circle cx="150" cy="24" r="9" fill="#ffc53d" stroke="#b35d00" strokeWidth="1.5" /><circle cx="147" cy="21" r="3" fill="#fff" />
    <g transform="translate(252 52)">
      <circle r="30" fill="#e53935" stroke="#9c1f1b" strokeWidth="2" /><circle r="24" fill="#fff" /><circle r="18" fill="#e53935" /><circle r="12" fill="#fff" /><circle r="6" fill="#ffc53d" />
      <path d="M-14 -34 l6 10 M16 -36 l-4 11 M34 -8 l-11 3" stroke="#ffd23f" strokeWidth="3" strokeLinecap="round" />
    </g>
    <g transform="translate(70 100) rotate(40)">
      <path d="M-15 6 L-12 -46 H12 L15 6Z" fill="#3d4bb0" stroke="#141a45" strokeWidth="2" />
      <rect x="-14" y="-50" width="28" height="9" rx="4" fill="#ffc53d" stroke="#a86b00" strokeWidth="1.5" />
    </g>
    <path d="M40 116 L50 90 Q70 80 90 90 L100 116Z" fill="#b97431" stroke="#5c3413" strokeWidth="2" />
    <circle cx="48" cy="114" r="11" fill="#e0a764" stroke="#6b3e19" strokeWidth="3" /><circle cx="92" cy="114" r="11" fill="#e0a764" stroke="#6b3e19" strokeWidth="3" />
  </svg>
}

function StageSelect({ progress, onPick }: { progress: MatoProgress; onPick: (index: number) => void }) {
  const total = Object.values(progress).reduce((sum, n) => sum + n, 0)
  return <main className={styles.select}>
    <GameBackButton to="/" />
    <header className={styles.selectHeader}>
      <TitleArt />
      <h1>{TITLE}</h1>
      <p>たまが とんでいく じかんを よんで、まとを ぜんぶ わろう！</p>
      <p className={styles.totalStars} aria-label={`あつめた ほし ${total} / ${LEVELS.length * 3}`}>★ {total} / {LEVELS.length * 3}</p>
    </header>
    {DIFFICULTIES.map(d => <section key={d.id} className={styles.tier} data-difficulty={d.id} aria-labelledby={`tier-${d.id}`}>
      <h2 id={`tier-${d.id}`} className={styles.tierTitle}><span>{d.label}</span><small>{d.lead}</small></h2>
      <ol className={styles.levelGrid}>
        {LEVELS.map((level, i) => {
          if (level.difficulty !== d.id) return null
          const stars = progress[i] ?? 0
          return <li key={level.name}>
            <button type="button" className={styles.levelCard} data-cleared={stars > 0 || undefined} aria-label={`${i + 1} ${level.name}${stars ? ` ほし${stars}こ` : ''}`} onClick={() => { primeAudio(); onPick(i) }}>
              <span className={styles.cardNumber}>{i + 1}</span>
              <span className={styles.cardName}>{level.name}</span>
              <span className={styles.cardStars} aria-hidden="true">{[0, 1, 2].map(s => <b key={s} data-on={s < stars || undefined}>★</b>)}</span>
              <span className={styles.cardFeatures} aria-hidden="true">{levelFeatures(level).map(f => <FeatureIcon key={f} feature={f} />)}</span>
            </button>
          </li>
        })}
      </ol>
    </section>)}
    <ul className={styles.legend} aria-label="しかけ">
      {(Object.keys(FEATURE_LABELS) as Feature[]).map(f => <li key={f}><FeatureIcon feature={f} />{FEATURE_LABELS[f]}</li>)}
    </ul>
  </main>
}

export default function MatoAtePlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState<MatoProgress>(() => readProgress())
  if (index !== null) {
    return <Stage key={`${index}-${attempt}`} index={index}
      onExit={() => { setProgress(readProgress()); setIndex(null) }}
      onRetry={() => setAttempt(a => a + 1)}
      onNext={() => { setProgress(readProgress()); setIndex(index + 1 < LEVELS.length ? index + 1 : null) }} />
  }
  return <StageSelect progress={progress} onPick={setIndex} />
}

