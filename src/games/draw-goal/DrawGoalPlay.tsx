import { useEffect, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import DominoCompleteConfetti from '../domino-flag/DominoCompleteConfetti'
import { primeAudio, playCorrectSound } from '../../utils/quizSound'
import { playStarSound, playWarpSound } from './sounds'
import { BALL_RADIUS, HEIGHT, LINE_WIDTH, STAGES, STAR_RADIUS, WARP_RADIUS, WIDTH, type Stage } from './stages'
import { appendPoint, createWorld, MAX_LINES, type World } from './world'
import type { Point } from './stroke'
import styles from './DrawGoalPlay.module.css'

const path = (points: Point[]) => points.map(p => `${p.x},${p.y}`).join(' ')
const STAR_SHAPE = Array.from({ length: 10 }, (_, i) => {
  const radius = i % 2 ? STAR_RADIUS * .45 : STAR_RADIUS
  const angle = -Math.PI / 2 + i * Math.PI / 5
  return `${(radius * Math.cos(angle)).toFixed(1)},${(radius * Math.sin(angle)).toFixed(1)}`
}).join(' ')

// Wind is invisible, so the box shows a few arrows that lean the way it blows.
function WindBox({ wind }: { wind: NonNullable<Stage['winds']>[number] }) {
  const angle = Math.atan2(wind.push.y, wind.push.x) * 180 / Math.PI
  const columns = Math.max(2, Math.round(wind.width / 90))
  const rows = Math.max(2, Math.round(wind.height / 80))
  return <g>
    <rect x={wind.x - wind.width / 2} y={wind.y - wind.height / 2} width={wind.width} height={wind.height} rx="22" fill="#bfe7f6" opacity=".45" stroke="#7cc6e2" strokeWidth="3" strokeDasharray="10 8" />
    {Array.from({ length: columns * rows }, (_, i) => {
      const x = wind.x + ((i % columns) + .5 - columns / 2) * wind.width / columns
      const y = wind.y + (Math.floor(i / columns) + .5 - rows / 2) * wind.height / rows
      return <path key={i} className={styles.breeze} style={{ animationDelay: `${(i % 3) * .3}s` }} d="M-9 -8 L1 0 L-9 8" transform={`translate(${x} ${y}) rotate(${angle})`} fill="none" stroke="#3f9dc4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    })}
  </g>
}

function WarpRings({ warp }: { warp: NonNullable<Stage['warp']> }) {
  return <g>
    <g transform={`translate(${warp.from.x} ${warp.from.y})`}>
      <circle r={WARP_RADIUS} fill="#dceffb" stroke="#3f8fd0" strokeWidth="5" strokeDasharray="12 9" className={styles.spin} />
      <circle r={WARP_RADIUS * .5} fill="#3f8fd0" opacity=".25" />
      <text y="7" textAnchor="middle" fill="#2c6ea6" fontSize="20" fontWeight="bold">IN</text>
    </g>
    <g transform={`translate(${warp.to.x} ${warp.to.y})`}>
      <circle r={WARP_RADIUS} fill="#f0e2fb" stroke="#8f5cc4" strokeWidth="5" strokeDasharray="12 9" className={styles.spin} />
      <path d="M0 -9 v13 M-8 -3 L0 9 L8 -3" fill="none" stroke="#7a45b4" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  </g>
}

function Board({ index, back, next }: { index: number; back: () => void; next: () => void }) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const world = useRef<World | null>(null)
  const ball = useRef<SVGGElement>(null)
  const gesture = useRef<{ id: number; points: Point[] } | null>(null)
  const [lines, setLines] = useState<Point[][]>([])
  const [preview, setPreview] = useState<Point[]>([])
  const [status, setStatus] = useState<World['state']>('ready')
  const [notice, setNotice] = useState('')
  const [picked, setPicked] = useState<boolean[]>(() => (stage.stars ?? []).map(() => false))
  const stars = stage.stars ?? []

  useEffect(() => {
    const game = createWorld(stage)
    world.current = game
    let frame = 0, previous = 0, accumulator = 0
    let lastStatus = game.state
    let lastPicked = 0
    let lastWarps = 0
    function tick(now: number) {
      const elapsed = previous ? Math.min(50, now - previous) : 0
      previous = now
      if (!document.hidden && !gesture.current) {
        accumulator += elapsed
        while (accumulator >= 1000 / 60) { game.step(); accumulator -= 1000 / 60 }
      } else accumulator = 0
      ball.current?.setAttribute('transform', `translate(${game.ball.position.x} ${game.ball.position.y}) rotate(${game.ball.angle * 180 / Math.PI})`)
      const count = game.collected.filter(Boolean).length
      if (lastPicked !== count) {
        if (lastPicked < count) playStarSound()
        lastPicked = count
        setPicked([...game.collected])
      }
      if (lastWarps !== game.warps) {
        if (lastWarps < game.warps) playWarpSound()
        lastWarps = game.warps
      }
      if (lastStatus !== game.state) {
        lastStatus = game.state
        setStatus(game.state)
        // Cheer the moment the ball enters the cup; it keeps rolling until it rests.
        if (game.state === 'scored') playCorrectSound()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    // Canceled gestures are discarded, never turned into an unintended wall.
    const cancel = () => { gesture.current = null; setPreview([]); previous = 0; accumulator = 0 }
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      document.removeEventListener('visibilitychange', cancel)
      game.destroy()
      world.current = null
    }
  }, [stage])

  function point(event: PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    return { x: (event.clientX - box.left) * WIDTH / box.width, y: (event.clientY - box.top) * HEIGHT / box.height }
  }
  function begin(event: PointerEvent<SVGSVGElement>) {
    const game = world.current
    if (!game || gesture.current || !event.isPrimary || event.button !== 0 || game.state === 'scored' || game.state === 'goal' || game.state === 'retry') return
    event.preventDefault()
    primeAudio()
    if (game.lines.length >= MAX_LINES) { setNotice('「1ぽん もどす」で かきなおそう'); return }
    const points: Point[] = []
    appendPoint(points, point(event))
    gesture.current = { id: event.pointerId, points }
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview([...points])
    setNotice('')
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    if (gesture.current?.id !== event.pointerId) return
    event.preventDefault()
    appendPoint(gesture.current.points, point(event))
    setPreview([...gesture.current.points])
  }
  function finish(event: PointerEvent<SVGSVGElement>, commit: boolean) {
    const active = gesture.current
    if (!active || active.id !== event.pointerId) return
    if (commit) appendPoint(active.points, point(event))
    gesture.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setPreview([])
    if (commit && world.current) {
      if (!world.current.addStroke(active.points)) setNotice('ボールから はなして、せんを かこう')
      setLines(world.current.lines.map(l => l.points))
      setStatus(world.current.state)
    }
  }
  function reset(clear: boolean) {
    gesture.current = null
    setPreview([])
    world.current?.retry(clear)
    setLines(world.current?.lines.map(l => l.points) ?? [])
    setStatus('ready')
    setNotice('')
  }
  return <GamePlaySurface><main className={styles.page}>
    <GameBackButton onBack={back} />
    <header className={styles.header}>
      <h1>かいてゴール！</h1>
      <span>{index + 1} / {STAGES.length}</span>
      {stars.length > 0 && <span className={styles.score} aria-label={`ほし ${picked.filter(Boolean).length} / ${stars.length}`}>{'★'.repeat(picked.filter(Boolean).length)}{'☆'.repeat(stars.length - picked.filter(Boolean).length)}</span>}
    </header>
    <p className={styles.hint} role="status">{notice || (status === 'goal' || status === 'scored' ? '🎉 ゴール！' : status === 'retry' ? 'もういちど やってみよう！' : status === 'running' ? 'せんを たしても いいよ' : lines.length ? '▶ スタートを おそう！' : stage.hint)}</p>
    <div className={styles.boardArea}>
      <div className={styles.board}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="せんを かく ばしょ" className={styles.svg}
          onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e, true)} onPointerCancel={e => finish(e, false)} onLostPointerCapture={e => finish(e, false)}>
          <defs><pattern id="draw-goal-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.3" fill="#d8e4e3" /></pattern></defs>
          <rect width={WIDTH} height={HEIGHT} fill="#fffdf5" /><rect width={WIDTH} height={HEIGHT} fill="url(#draw-goal-dots)" />
          <text x="200" y="35" textAnchor="middle" fill="#607b81" fontSize="18" fontWeight="bold">{stage.name}</text>
          {stage.winds?.map((wind, i) => <WindBox key={i} wind={wind} />)}
          {stage.platforms.map((p, i) => <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${(p.angle ?? 0) * 180 / Math.PI})`}><rect x={-p.width / 2} y={-(p.height ?? 18) / 2} width={p.width} height={p.height ?? 18} rx="6" fill={p.bounce ? '#ee82a2' : '#9db6bc'} /><path d={`M${-p.width / 2 + 8} ${-(p.height ?? 18) / 2 + 5} H${p.width / 2 - 8}`} stroke="#fff8" strokeWidth="3" /></g>)}
          {stage.warp && <WarpRings warp={stage.warp} />}
          <path d={`M${stage.goal.x - 60} ${stage.goal.y} v80 h120 v-80`} fill="#c9f1d0" stroke="#368969" strokeWidth="12" strokeLinejoin="round" />
          <text x={stage.goal.x} y={stage.goal.y + 55} textAnchor="middle" fill="#246b51" fontSize="23" fontWeight="bold">ゴール</text>
          {stars.map((star, i) => <polygon key={i} className={picked[i] ? styles.starDone : styles.star} points={STAR_SHAPE} transform={`translate(${star.x} ${star.y})`} fill={picked[i] ? '#e4e9e4' : '#ffd23f'} stroke={picked[i] ? '#c3cec6' : '#d9932a'} strokeWidth="3" strokeLinejoin="round" />)}
          {lines.map((points, i) => <polyline key={i} points={path(points)} fill="none" stroke="#f1ab39" strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />)}
          <polyline points={path(preview)} fill="none" stroke="#e49420" opacity=".6" strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
          <g ref={ball} transform={`translate(${stage.ball.x} ${stage.ball.y})`}>
            <circle r={BALL_RADIUS} fill="#68bddd" stroke="#347994" strokeWidth="2" /><circle cx="-5" cy="-3" r="2" fill="#23485c" /><circle cx="5" cy="-3" r="2" fill="#23485c" /><path d="M-5 4 Q0 10 5 4" fill="none" stroke="#23485c" strokeWidth="2" />
          </g>
        </svg>
        {status === 'goal' && <div className={styles.overlay}><DominoCompleteConfetti /><div className={styles.card}>
          <h2>🎉 ゴール！</h2>
          {stars.length > 0 && <p className={styles.cardStars}>{'★'.repeat(picked.filter(Boolean).length)}{'☆'.repeat(stars.length - picked.filter(Boolean).length)}</p>}
          <p>{stars.length && picked.every(Boolean) ? 'ほし ぜんぶ ゲット！' : 'すてきな みちが できたね！'}</p>
          <button autoFocus onClick={next}>{index === STAGES.length - 1 ? 'ステージを えらぶ' : 'つぎへ →'}</button>
        </div></div>}
        {status === 'retry' && <div className={styles.retry}><button onClick={() => reset(false)}>↻ ボールを もどす</button></div>}
      </div>
    </div>
    <div className={styles.tools}>
      <button onClick={() => reset(true)}>↻ やりなおし</button>
      <button disabled={!lines.length || status === 'scored' || status === 'goal'} onClick={() => { gesture.current = null; setPreview([]); world.current?.undo(); setLines(world.current?.lines.map(l => l.points) ?? []); setStatus('ready'); setNotice('') }}>↶ 1ぽん もどす</button>
      <button disabled={status === 'scored' || status === 'goal'} onClick={() => { primeAudio(); reset(false); world.current?.start(); setStatus('running') }}>{status === 'ready' ? '▶ スタート' : '▶ もういちど'}</button>
    </div>
    <p className={styles.tip}>せんを かいたら ▶ スタート！</p>
  </main></GamePlaySurface>
}

export default function DrawGoalPlay() {
  const [index, setIndex] = useState<number | null>(null)
  if (index !== null) return <Board key={index} index={index} back={() => setIndex(null)} next={() => setIndex(index + 1 < STAGES.length ? index + 1 : null)} />
  return <main className={styles.select}>
    <GameBackButton to="/" />
    <h1>かいてゴール！</h1><p>せんを かいて、ボールを ゴールへ！</p>
    <div className={styles.stageGrid}>{STAGES.map((s, i) => <button key={s.name} aria-label={`${i + 1} ${s.name}`} onClick={() => { primeAudio(); setIndex(i) }}><span>{i + 1}</span>{s.name}</button>)}</div>
    <p>せんは そのまま みちに なるよ。<br />なんぼんでも かいてから、スタートで ボールが うごくよ。</p>
    <p className={styles.legend}><span>★ ほしを ひろおう</span><span>💨 かぜで ふわり</span><span>🌀 ワープで ひとっとび</span></p>
  </main>
}
