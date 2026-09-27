import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { LEVELS, SLING, starsFor, type BallKind } from './levels'
import { follow, makeView, toWorld, type View } from './camera'
import { createFx, drawScene, spawnFx, updateFx } from './render'
import { readProgress, recordStars, type RoboProgress } from './progress'
import { clampPull, createGame, MAX_PULL, predictPath, type Game, type GameState, type Point } from './world'
import { playBlastSound, playBreakSound, playClearSound, playFailSound, playHitSound, playLaunchSound, playRobotSound, playSplitSound, playStretchSound } from './sounds'
import styles from './RoboKuzushiPlay.module.css'

const TITLE = 'とばせ！ロボくずし'
const FRAME_MS = 1000 / 60
/** さいしょに ロボットの おしろを 見せてから パチンコへ もどるまでの フレーム数。 */
const INTRO_FRAMES = 80
/** うち おわってから パチンコへ カメラを もどすまで まつ フレーム数。 */
const RETURN_HOLD = 45
/** クリア・ざんねんの カードを だすまでの ま。 */
const RESULT_DELAY = 40

// かみふぶきは 毎回 同じ ばらつきで ふらせる（テストでも ゆれない）。
const CONFETTI: CSSProperties[] = Array.from({ length: 26 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x) }
  return { left: `${r(1) * 100}%`, background: `hsl(${Math.round(r(2) * 360)} 90% 62%)`, animationDuration: `${1.8 + r(3) * 1.6}s`, animationDelay: `${-r(4) * 3}s`, width: `${6 + r(5) * 6}px` }
})

const BALL_NAMES: Record<BallKind, string> = { normal: 'あか', heavy: 'てつ', split: 'あお' }

type Hud = { state: GameState; score: number; queue: readonly BallKind[]; robots: number; shots: number }
type Result = { kind: 'clear'; stars: number; score: number } | { kind: 'fail'; robots: number }

function hudOf(game: Game): Hud {
  return { state: game.state, score: game.score, queue: [...game.queue], robots: game.robotsLeft, shots: game.shots }
}
/** 毎フレーム あたらしい オブジェクトを つくらずに、かわったかだけを しらべる。 */
const hudChanged = (hud: Hud, game: Game) => hud.state !== game.state || hud.score !== game.score || hud.queue.length !== game.queue.length || hud.robots !== game.robotsLeft || hud.shots !== game.shots
/** けっかの カードを だしてから この フレーム数 たったら、うごきを とめて 電池を まもる。 */
const REST_AFTER_RESULT = 150
/** 1フレームで ならす ぶつかる音の かず。いっきに くずれても 音が われない。 */
const HIT_SOUNDS_PER_FRAME = 3

/** ピアノと おなじ: スマホを たてに もっている ときだけ よこむきを おねがいする。 */
const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (pointer: coarse) and (orientation: portrait)'

function isMobilePortrait() {
  return typeof matchMedia === 'function' && matchMedia(MOBILE_PORTRAIT_QUERY).matches
}

/** たてむきの スマホかどうかを 見はる。むきを かえたら すぐに かわる。 */
function useMobilePortrait() {
  const [portrait, setPortrait] = useState(isMobilePortrait)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const query = matchMedia(MOBILE_PORTRAIT_QUERY)
    const update = () => setPortrait(query.matches)
    update()
    query.addEventListener?.('change', update)
    return () => query.removeEventListener?.('change', update)
  }, [])
  return portrait
}

function reducedMotionQuery() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function pullFromKeys(angle: number, power: number): Point {
  const a = angle * Math.PI / 180
  return { x: -Math.cos(a) * power * MAX_PULL, y: Math.sin(a) * power * MAX_PULL }
}

function Stage({ index, onExit, onRetry, onNext }: { index: number; onExit: () => void; onRetry: () => void; onNext: () => void }) {
  useGameIntroPlaying(true)
  const level = LEVELS[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<Game | null>(null)
  const viewRef = useRef<View | null>(null)
  const pullRef = useRef<Point | null>(null)
  const pathRef = useRef<Point[]>([])
  /** ひっぱりが かわった フレームだけ みちすじを けいさんしなおす。 */
  const pathDirty = useRef(false)
  const keyAim = useRef({ angle: 35, power: .8, active: false })
  const gesture = useRef<{ id: number; mode: 'aim' | 'pan'; origin: Point; center: number } | null>(null)
  const camera = useRef({ center: level.width, manual: false, intro: INTRO_FRAMES, hold: 0 })
  const [hud, setHud] = useState<Hud>(() => ({ state: 'aim', score: 0, queue: level.balls, robots: level.pieces.filter(p => p.type === 'robot').length, shots: 0 }))
  const [result, setResult] = useState<Result | null>(null)
  const [aiming, setAiming] = useState(false)
  const showHint = useRef(index === 0 && !reducedMotionQuery())
  const portrait = useMobilePortrait()
  /** たてむきの あいだは ゲームを とめておく（よこにしたら つづきから）。 */
  const paused = useRef(portrait)
  useEffect(() => { paused.current = portrait }, [portrait])

  useEffect(() => {
    const game = createGame(level)
    gameRef.current = game
    const fx = createFx()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    const reducedMotion = reducedMotionQuery()
    let size = { w: 0, h: 0, dpr: 1 }
    let resting = false
    const measure = () => {
      if (!canvas) return
      const box = canvas.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      size = { w: box.width || 800, h: box.height || 500, dpr }
      canvas.width = Math.round(size.w * dpr)
      canvas.height = Math.round(size.h * dpr)
      // とまった あとでも 大きさが かわったら かきなおす（canvasは 大きさを かえると きえる）。
      if (resting) draw()
    }
    measure()
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(canvas!)
    window.addEventListener('resize', measure)
    const cancelGesture = () => {
      if (gesture.current?.mode === 'aim') { pullRef.current = null; pathRef.current = [] ; setAiming(false) }
      gesture.current = null
    }
    window.addEventListener('blur', cancelGesture)

    let frame = 0, previous = 0, accumulator = 0, time = 0
    let lastHud = hudOf(game)
    let lastState = game.state
    let resultTimer = -1
    let restTimer = -1
    function draw() {
      const view = viewRef.current
      if (!ctx || !view) return
      if (pathDirty.current) {
        pathDirty.current = false
        const pull = pullRef.current
        pathRef.current = pull && game.queue.length ? predictPath(pull, game.queue[0]) : []
      }
      drawScene(ctx, {
        view, dpr: size.dpr, time, levelWidth: level.width,
        pieces: game.pieces, projectiles: game.projectiles, queue: game.queue,
        pull: game.state === 'aim' ? pullRef.current : null, path: pathRef.current,
        trail: game.trail, currentTrail: game.currentTrail, fx, reducedMotion,
        showDragHint: showHint.current && game.state === 'aim' && game.shots === 0 && !pullRef.current && camera.current.intro <= 0,
      })
    }
    function tick(now: number) {
      const elapsed = previous ? Math.min(100, now - previous) : 0
      previous = now
      let frames = 0
      if (!document.hidden && !paused.current) {
        accumulator += elapsed
        while (accumulator >= FRAME_MS && frames < 6) {
          game.step()
          updateFx(fx)
          accumulator -= FRAME_MS
          frames++
        }
        if (frames === 6) accumulator = 0
      }
      time += frames / 60
      let hits = 0
      for (const event of game.drainEvents()) {
        if (event.type === 'hit' && ++hits > HIT_SOUNDS_PER_FRAME) continue
        spawnFx(fx, event)
        if (event.type === 'launch') playLaunchSound()
        else if (event.type === 'robot') playRobotSound()
        else if (event.type === 'break') playBreakSound(event.material)
        else if (event.type === 'blast') playBlastSound()
        else if (event.type === 'split') playSplitSound()
        else if (event.type === 'hit') playHitSound(event.material, event.strength)
      }
      if (game.state !== lastState) {
        if (lastState === 'flying' && game.state === 'aim') camera.current.hold = RETURN_HOLD
        if (game.state === 'clear' || game.state === 'fail') resultTimer = RESULT_DELAY
        lastState = game.state
      }
      if (resultTimer > 0) {
        resultTimer -= frames
        if (resultTimer <= 0) {
          resultTimer = -1
          if (game.state === 'clear') {
            const stars = starsFor(game.queue.length)
            recordStars(index, stars)
            playClearSound()
            setResult({ kind: 'clear', stars, score: game.score })
          } else {
            playFailSound()
            setResult({ kind: 'fail', robots: game.robotsLeft })
          }
          restTimer = REST_AFTER_RESULT
        }
      }
      // カメラ: さいしょは おしろ → パチンコ、とんでいる あいだは たまを おいかける。
      const cam = camera.current
      let view = makeView(size.w, size.h, cam.center, level.width)
      let target = cam.center
      if (cam.intro > 0) { cam.intro -= frames; target = cam.intro > 30 ? level.width : 0 }
      else if (game.state === 'flying' && game.projectiles.length) target = Math.max(...game.projectiles.map(p => p.body.position.x)) + view.width * .12
      else if (game.state === 'clear' || game.state === 'fail') target = cam.center
      else if (cam.hold > 0) cam.hold -= frames
      else if (!cam.manual) target = 0
      cam.center = follow(cam.center, target, frames, game.state === 'flying' ? .1 : .06)
      view = makeView(size.w, size.h, cam.center, level.width)
      cam.center = view.left + view.width / 2
      viewRef.current = view
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
      window.removeEventListener('blur', cancelGesture)
      game.destroy()
      gameRef.current = null
    }
  }, [level, index])

  function screenPoint(event: PointerEvent<HTMLCanvasElement>): Point {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - box.left, y: event.clientY - box.top }
  }

  function setPull(pull: Point | null) {
    const game = gameRef.current
    const previous = pullRef.current
    pullRef.current = pull
    pathDirty.current = true
    if (!pull || !game?.queue.length) { setAiming(false); return }
    const clamped = clampPull(pull)
    const power = Math.round(Math.hypot(clamped.x, clamped.y) / MAX_PULL * 100)
    setAiming(true)
    const before = previous ? Math.floor(Math.hypot(previous.x, previous.y) / 24) : 0
    if (Math.floor(Math.hypot(clamped.x, clamped.y) / 24) > before) playStretchSound(power / 100)
  }

  function shoot() {
    const game = gameRef.current
    const pull = pullRef.current
    if (!game || !pull) return
    if (game.launch(pull)) camera.current.manual = false
    setPull(null)
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    const game = gameRef.current
    const view = viewRef.current
    if (!game || !view || paused.current || !event.isPrimary || event.button !== 0 || gesture.current) return
    event.preventDefault()
    primeAudio()
    event.currentTarget.focus({ preventScroll: true })
    if (game.state !== 'aim') return
    const cam = camera.current
    if (cam.intro > 0) cam.intro = 0
    cam.hold = 0
    keyAim.current.active = false
    const origin = screenPoint(event)
    const world = toWorld(view, origin.x, origin.y)
    const nearSling = Math.hypot(world.x - SLING.x, world.y - SLING.y) < 130
    // パチンコの ちかく、または 画面の 左がわなら どこからでも ひっぱれる。
    const mode = nearSling || origin.x < view.width * view.scale * .45 ? 'aim' : 'pan'
    gesture.current = { id: event.pointerId, mode, origin, center: cam.center }
    if (mode === 'pan') cam.manual = true
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const active = gesture.current
    const view = viewRef.current
    if (!active || active.id !== event.pointerId || !view) return
    event.preventDefault()
    const p = screenPoint(event)
    const dx = (p.x - active.origin.x) / view.scale, dy = (p.y - active.origin.y) / view.scale
    if (active.mode === 'pan') camera.current.center = active.center - dx
    else setPull(clampPull({ x: dx, y: dy }))
  }

  function up(event: PointerEvent<HTMLCanvasElement>, commit: boolean) {
    const active = gesture.current
    if (!active || active.id !== event.pointerId) return
    gesture.current = null
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    if (active.mode !== 'aim') return
    if (commit) shoot()
    else setPull(null)
  }

  function key(event: KeyboardEvent<HTMLCanvasElement>) {
    const game = gameRef.current
    if (!game || paused.current) return
    const aim = keyAim.current
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      primeAudio()
      if (game.state === 'aim' && aim.active) { aim.active = false; shoot() }
      else if (game.state === 'aim') { camera.current.intro = 0; aim.active = true; setPull(pullFromKeys(aim.angle, aim.power)) }
      return
    }
    const change: Record<string, [number, number]> = { ArrowUp: [5, 0], ArrowDown: [-5, 0], ArrowRight: [0, .05], ArrowLeft: [0, -.05] }
    const delta = change[event.key]
    if (!delta || game.state !== 'aim') return
    event.preventDefault()
    camera.current.intro = 0
    aim.angle = Math.max(-20, Math.min(80, aim.angle + delta[0]))
    aim.power = Math.max(.3, Math.min(1, aim.power + delta[1]))
    aim.active = true
    setPull(pullFromKeys(aim.angle, aim.power))
  }

  const next = hud.queue[0]
  const hint = hud.state === 'aim' && hud.shots === 0 && !aiming ? level.hint : ''
  return <GamePlaySurface><main className={styles.play}>
    <h1 className={styles.srOnly}>{TITLE}</h1>
    <GameBackButton onBack={onExit} />
    <canvas ref={canvasRef} className={styles.canvas} tabIndex={0}
      aria-label={`ステージ ${index + 1} ${level.name}。たまを うしろへ ひっぱって はなすと とぶよ。やじるしキーで ねらって スペースで うてるよ`}
      onPointerDown={down} onPointerMove={move} onPointerUp={e => up(e, true)} onPointerCancel={e => up(e, false)} onLostPointerCapture={e => up(e, false)}
      onKeyDown={key} onBlur={() => { if (keyAim.current.active) { keyAim.current.active = false; setPull(null) } }} />
    <div className={styles.hud}>
      <div className={styles.levelTag}><span className={styles.levelNumber}>{index + 1}</span><span className={styles.levelName}>{level.name}</span></div>
      <div className={styles.stats}>
        <span className={styles.stat} aria-label={`のこりの ロボット ${hud.robots}たい`}><RobotIcon />×{hud.robots}</span>
        <span className={styles.stat} aria-label={`のこりの たま ${hud.queue.length}こ`}><span className={`${styles.ballDot} ${styles[next ?? 'normal']}`} />×{hud.queue.length}</span>
        <span className={`${styles.stat} ${styles.score}`} aria-label={`${hud.score}てん`}>{hud.score.toLocaleString('ja-JP')}<small>てん</small></span>
      </div>
      <button type="button" className={styles.iconButton} onClick={onRetry} aria-label="さいしょから やりなおす">↻</button>
    </div>
    <p className={styles.bubble} role="status" data-show={Boolean(hint) || undefined}>
      {hint}
      {hud.state === 'aim' && next && hint && <span className={styles.nextBall}>つぎは {BALL_NAMES[next]}の たま</span>}
    </p>
    {portrait && <section className={styles.orientationGuide} aria-label="よこむきで あそぶ あんない">
      <div className={styles.orientationCard}>
        <span className={styles.orientationIcon} aria-hidden="true">↻</span>
        <h2>よこにして<br />あそんでね</h2>
        <p>スマホを よこむきにすると<br />ひろい ばしょで あそべるよ</p>
      </div>
    </section>}
    {result && <div className={styles.overlay}>
      {result.kind === 'clear' ? <div className={styles.card} role="dialog" aria-label="クリア">
        <div className={styles.confetti} aria-hidden="true">{CONFETTI.map((style, i) => <i key={i} style={style} />)}</div>
        <h2>クリア！</h2>
        <p className={styles.resultLead}>ロボットを ぜんぶ たおしたよ</p>
        <div className={styles.stars} aria-label={`ほし ${result.stars}こ`}>{[0, 1, 2].map(i => <span key={i} className={i < result.stars ? styles.starOn : styles.starOff} style={{ animationDelay: `${.25 + i * .28}s` }}>★</span>)}</div>
        <p className={styles.resultScore}>{result.score.toLocaleString('ja-JP')} てん</p>
        <p className={styles.resultNote}>{result.stars === 3 ? 'すごい！ たまを のこして クリア！' : 'のこした たまが おおいほど ほしが ふえるよ'}</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onRetry}>↻ もういちど</button>
          <button type="button" className={styles.primary} autoFocus onClick={onNext}>{index === LEVELS.length - 1 ? 'ステージを えらぶ' : 'つぎへ →'}</button>
        </div>
      </div> : <div className={styles.card} role="dialog" aria-label="ざんねん">
        <h2>おしい！</h2>
        <p className={styles.resultNote}>ロボットが あと {result.robots}たい のこっているよ</p>
        <p className={styles.resultNote}>ねらう ばしょを かえて もういちど！</p>
        <div className={styles.cardButtons}>
          <button type="button" onClick={onExit}>ステージを えらぶ</button>
          <button type="button" className={styles.primary} autoFocus onClick={onRetry}>↻ もういちど</button>
        </div>
      </div>}
    </div>}
  </main></GamePlaySurface>
}

function RobotIcon() {
  return <svg className={styles.robotIcon} viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 1.5v3" stroke="#2a7a6f" strokeWidth="2" strokeLinecap="round" />
    <circle cx="12" cy="2" r="1.8" fill="#ff4d4d" />
    <rect x="3" y="5" width="18" height="17" rx="5" fill="#6fd3c4" stroke="#2a7a6f" strokeWidth="1.6" />
    <rect x="6" y="8.5" width="12" height="7" rx="2" fill="#26324a" />
    <circle cx="9.5" cy="12" r="1.6" fill="#6ff7ff" /><circle cx="14.5" cy="12" r="1.6" fill="#6ff7ff" />
  </svg>
}

function TitleArt() {
  return <svg className={styles.titleArt} viewBox="0 0 320 120" aria-hidden="true">
    <path d="M0 104 H320 V120 H0Z" fill="#6cc04f" />
    <path d="M40 104 V70 M40 76 L28 50 M40 76 L54 48" stroke="#a8672f" strokeWidth="8" strokeLinecap="round" fill="none" />
    <path d="M28 50 Q44 62 54 48" stroke="#4a2a14" strokeWidth="3" fill="none" />
    <path d="M80 44 Q150 -6 214 50" stroke="#fff" strokeWidth="3" strokeDasharray="2 9" strokeLinecap="round" fill="none" />
    <circle cx="80" cy="44" r="12" fill="#e53935" /><circle cx="76" cy="40" r="4" fill="#ffffff88" />
    <g transform="translate(236 80)">
      <rect x="-40" y="-2" width="80" height="10" rx="2" fill="#e2a55f" stroke="#7a4a1e" strokeWidth="2" />
      <rect x="-36" y="8" width="10" height="16" fill="#e2a55f" stroke="#7a4a1e" strokeWidth="2" /><rect x="26" y="8" width="10" height="16" fill="#e2a55f" stroke="#7a4a1e" strokeWidth="2" />
      <path d="M0 -26 v-8" stroke="#5e44a8" strokeWidth="2.5" /><circle cx="0" cy="-36" r="3.5" fill="#ff4d4d" />
      <rect x="-14" y="-28" width="28" height="26" rx="8" fill="#b69cff" stroke="#5e44a8" strokeWidth="2" />
      <rect x="-9" y="-23" width="18" height="11" rx="3" fill="#26324a" />
      <circle cx="-4" cy="-17.5" r="2.2" fill="#6ff7ff" /><circle cx="4" cy="-17.5" r="2.2" fill="#6ff7ff" />
    </g>
    <g transform="translate(292 90)">
      <rect x="-12" y="-12" width="24" height="24" rx="7" fill="#ffb35c" stroke="#9a5714" strokeWidth="2" />
      <rect x="-8" y="-8" width="16" height="9" rx="2.5" fill="#26324a" />
      <circle cx="-3.5" cy="-3.5" r="1.8" fill="#6ff7ff" /><circle cx="3.5" cy="-3.5" r="1.8" fill="#6ff7ff" />
    </g>
  </svg>
}

function StageSelect({ progress, onPick }: { progress: RoboProgress; onPick: (index: number) => void }) {
  const total = Object.values(progress).reduce((sum, n) => sum + n, 0)
  return <main className={styles.select}>
    <GameBackButton to="/" />
    <header className={styles.selectHeader}>
      <TitleArt />
      <h1>{TITLE}</h1>
      <p>パチンコで たまを とばして、いたずらロボットを ぜんぶ たおそう！</p>
      <p className={styles.totalStars} aria-label={`あつめた ほし ${total} / ${LEVELS.length * 3}`}>★ {total} / {LEVELS.length * 3}</p>
    </header>
    <ol className={styles.levelGrid}>
      {LEVELS.map((level, i) => {
        const stars = progress[i] ?? 0
        return <li key={level.name}>
          <button type="button" className={styles.levelCard} data-cleared={stars > 0 || undefined} aria-label={`${i + 1} ${level.name}${stars ? ` ほし${stars}こ` : ''}`} onClick={() => { primeAudio(); onPick(i) }}>
            <span className={styles.cardNumber}>{i + 1}</span>
            <span className={styles.cardName}>{level.name}</span>
            <span className={styles.cardStars} aria-hidden="true">{[0, 1, 2].map(s => <b key={s} data-on={s < stars || undefined}>★</b>)}</span>
            <span className={styles.cardBalls} aria-hidden="true">{level.balls.map((b, k) => <i key={k} className={`${styles.ballDot} ${styles[b]}`} />)}</span>
          </button>
        </li>
      })}
    </ol>
    <ul className={styles.legend}>
      <li><i className={`${styles.ballDot} ${styles.normal}`} />あか: ふつうの たま</li>
      <li><i className={`${styles.ballDot} ${styles.heavy}`} />てつ: おもくて つよい</li>
      <li><i className={`${styles.ballDot} ${styles.split}`} />あお: とちゅうで 3つに</li>
    </ul>
    <p className={styles.tip}>スマホは よこむきに して あそんでね</p>
  </main>
}

export default function RoboKuzushiPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [progress, setProgress] = useState<RoboProgress>(() => readProgress())
  if (index !== null) {
    return <Stage key={`${index}-${attempt}`} index={index}
      onExit={() => { setProgress(readProgress()); setIndex(null) }}
      onRetry={() => setAttempt(a => a + 1)}
      onNext={() => { setProgress(readProgress()); setIndex(index + 1 < LEVELS.length ? index + 1 : null) }} />
  }
  return <StageSelect progress={progress} onPick={setIndex} />
}
