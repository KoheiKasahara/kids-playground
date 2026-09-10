import { useEffect, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import DominoCompleteConfetti from '../domino-flag/DominoCompleteConfetti'
import { primeAudio, playCorrectSound } from '../../utils/quizSound'
import { BALL_RADIUS, HEIGHT, LINE_WIDTH, STAGES, WIDTH } from './stages'
import { appendPoint, createWorld, MAX_LINES, type World } from './world'
import type { Point } from './stroke'
import styles from './DrawGoalPlay.module.css'

const path = (points: Point[]) => points.map(p => `${p.x},${p.y}`).join(' ')

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

  useEffect(() => {
    const game = createWorld(stage)
    world.current = game
    let frame = 0, previous = 0, accumulator = 0
    let lastStatus = game.state
    function tick(now: number) {
      const elapsed = previous ? Math.min(50, now - previous) : 0
      previous = now
      if (!document.hidden && !gesture.current) {
        accumulator += elapsed
        while (accumulator >= 1000 / 60) { game.step(); accumulator -= 1000 / 60 }
      } else accumulator = 0
      ball.current?.setAttribute('transform', `translate(${game.ball.position.x} ${game.ball.position.y}) rotate(${game.ball.angle * 180 / Math.PI})`)
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
    <header className={styles.header}><h1>かいてゴール！</h1><span>{index + 1} / {STAGES.length}</span></header>
    <p className={styles.hint} role="status">{notice || (status === 'goal' || status === 'scored' ? '🎉 ゴール！' : status === 'retry' ? 'もういちど やってみよう！' : status === 'running' ? 'せんを たしても いいよ' : lines.length ? '▶ スタートを おそう！' : stage.hint)}</p>
    <div className={styles.boardArea}>
      <div className={styles.board}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-label="せんを かく ばしょ" className={styles.svg}
          onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e, true)} onPointerCancel={e => finish(e, false)} onLostPointerCapture={e => finish(e, false)}>
          <defs><pattern id="draw-goal-dots" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="12" cy="12" r="1.3" fill="#d8e4e3" /></pattern></defs>
          <rect width={WIDTH} height={HEIGHT} fill="#fffdf5" /><rect width={WIDTH} height={HEIGHT} fill="url(#draw-goal-dots)" />
          <text x="200" y="35" textAnchor="middle" fill="#607b81" fontSize="18" fontWeight="bold">{stage.name}</text>
          {stage.platforms.map((p, i) => <g key={i} transform={`translate(${p.x} ${p.y}) rotate(${(p.angle ?? 0) * 180 / Math.PI})`}><rect x={-p.width / 2} y="-9" width={p.width} height="18" rx="6" fill={p.bounce ? '#ee82a2' : '#9db6bc'} /><path d={`M${-p.width / 2 + 8} -4 H${p.width / 2 - 8}`} stroke="#fff8" strokeWidth="3" /></g>)}
          <path d={`M${stage.goal.x - 60} ${stage.goal.y} v80 h120 v-80`} fill="#c9f1d0" stroke="#368969" strokeWidth="12" strokeLinejoin="round" />
          <text x={stage.goal.x} y={stage.goal.y + 55} textAnchor="middle" fill="#246b51" fontSize="23" fontWeight="bold">ゴール</text>
          {lines.map((points, i) => <polyline key={i} points={path(points)} fill="none" stroke="#f1ab39" strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />)}
          <polyline points={path(preview)} fill="none" stroke="#e49420" opacity=".6" strokeWidth={LINE_WIDTH} strokeLinecap="round" strokeLinejoin="round" />
          <g ref={ball} transform={`translate(${stage.ball.x} ${stage.ball.y})`}>
            <circle r={BALL_RADIUS} fill="#68bddd" stroke="#347994" strokeWidth="2" /><circle cx="-5" cy="-3" r="2" fill="#23485c" /><circle cx="5" cy="-3" r="2" fill="#23485c" /><path d="M-5 4 Q0 10 5 4" fill="none" stroke="#23485c" strokeWidth="2" />
          </g>
        </svg>
        {status === 'goal' && <div className={styles.overlay}><DominoCompleteConfetti /><div className={styles.card}><h2>🎉 ゴール！</h2><p>すてきな みちが できたね！</p><button autoFocus onClick={next}>{index === STAGES.length - 1 ? 'ステージを えらぶ' : 'つぎへ →'}</button></div></div>}
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
  </main>
}
