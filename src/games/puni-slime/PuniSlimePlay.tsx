import { useEffect, useId, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { beginGrab, center, createSlime, HEIGHT, lift, outline, poke, squish, stepSlime, WIDTH, type Feel, type Grab } from './slimeSimulation'
import styles from './PuniSlimePlay.module.css'

const COLORS = [
  { name: 'みどり', light: '#daffb1', main: '#78dc93', dark: '#2baa8b' },
  { name: 'ももいろ', light: '#ffe0f0', main: '#f797ca', dark: '#d157a6' },
  { name: 'そらいろ', light: '#d2f8ff', main: '#75ccef', dark: '#448fda' },
] as const

export default function PuniSlimePlay() {
  useGameIntroPlaying(true)
  const [color, setColor] = useState(0)
  const [feel, setFeel] = useState<Feel>('soft')
  const [hint, setHint] = useState('ゆびで ひっぱって はなしてみよう')
  const body = useRef(createSlime())
  const grabs = useRef(new Map<number, Grab>())
  const feelRef = useRef<Feel>('soft')
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  const clip = useRef<SVGPathElement>(null)
  const face = useRef<SVGGElement>(null)
  const shine = useRef<SVGEllipseElement>(null)
  const shadow = useRef<SVGEllipseElement>(null)
  const id = useId().replace(/:/g, '')
  const palette = COLORS[color]

  function clearGrabs() {
    for (const pointerId of grabs.current.keys()) {
      if (svg.current?.hasPointerCapture?.(pointerId)) svg.current.releasePointerCapture(pointerId)
    }
    grabs.current.clear()
  }

  useEffect(() => {
    let frame = 0, last = 0, accumulator = 0
    const draw = () => {
      const shape = outline(body.current)
      path.current?.setAttribute('d', shape)
      clip.current?.setAttribute('d', shape)
      const c = center(body.current)
      const stretch = Math.max(...body.current.points.map((p) => p.x)) - Math.min(...body.current.points.map((p) => p.x))
      face.current?.setAttribute('transform', `translate(${c.x} ${c.y + 8}) scale(${Math.max(0.8, Math.min(1.2, stretch / 290))} 1)`)
      shine.current?.setAttribute('cx', String(c.x - 47))
      shine.current?.setAttribute('cy', String(c.y - 55))
      shadow.current?.setAttribute('cx', String(c.x))
      shadow.current?.setAttribute('rx', String(Math.max(65, 150 - (340 - c.y) * 0.25)))
      shadow.current?.setAttribute('opacity', String(Math.max(0.08, Math.min(0.2, c.y / 2000))))
    }
    const tick = (now: number) => {
      if (!document.hidden) {
        accumulator += last ? Math.min((now - last) / 1000, 0.05) : 0
        while (accumulator >= 1 / 60) {
          stepSlime(body.current, [...grabs.current.values()], feelRef.current)
          accumulator -= 1 / 60
        }
        draw()
      }
      last = now
      frame = requestAnimationFrame(tick)
    }
    const stop = () => { clearGrabs(); last = 0; accumulator = 0 }
    draw()
    frame = requestAnimationFrame(tick)
    window.addEventListener('blur', stop)
    window.addEventListener('resize', stop)
    document.addEventListener('visibilitychange', stop)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('blur', stop)
      window.removeEventListener('resize', stop)
      document.removeEventListener('visibilitychange', stop)
      clearGrabs()
    }
  }, [])

  function point(event: PointerEvent<SVGSVGElement>) {
    // SVG is letterboxed, so use the actual viewBox transform, not the element's bounding box.
    const matrix = svg.current?.getScreenCTM()
    if (!matrix) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    return { x: Math.max(0, Math.min(WIDTH, p.x)), y: Math.max(0, Math.min(HEIGHT, p.y)) }
  }
  function down(event: PointerEvent<SVGSVGElement>) {
    if (event.button !== 0 || grabs.current.size >= 2) return
    const p = point(event)
    if (!p) return
    const grab = beginGrab(body.current, p, [...grabs.current.values()])
    if (!grab) return
    event.preventDefault()
    poke(body.current, grab.index)
    grabs.current.set(event.pointerId, grab)
    event.currentTarget.setPointerCapture(event.pointerId)
    setHint('びよ〜ん！ はなすと ぷるぷる')
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const grab = grabs.current.get(event.pointerId)
    const p = point(event)
    if (grab && p) { event.preventDefault(); grab.target = p }
  }
  function up(event: PointerEvent<SVGSVGElement>) {
    grabs.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function action(kind: 'squish' | 'lift' | 'reset') {
    clearGrabs()
    if (kind === 'reset') { body.current = createSlime(); setHint('まんまる！ また さわってね') }
    else if (kind === 'squish') { squish(body.current); setHint('ぺったん！ ぷるんと もどるよ') }
    else { lift(body.current); setHint('ぽとん！ おちると どうなるかな？') }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1>ぷにぷにスライム</h1>
    </header>
    <div className={styles.workspace}>
      <section className={styles.stage} aria-label="スライムあそび">
        <p className={styles.hint} aria-live="polite">{hint}</p>
        <svg ref={svg} className={styles.slime} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="ひっぱって あそべる スライム" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={(event) => grabs.current.delete(event.pointerId)}>
          <defs>
            <linearGradient id={`${id}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop stopColor={palette.light} /><stop offset=".45" stopColor={palette.main} /><stop offset="1" stopColor={palette.dark} />
            </linearGradient>
            <clipPath id={`${id}-clip`}><path ref={clip} d={outline(createSlime())} /></clipPath>
          </defs>
          <ellipse cx="300" cy="470" rx="270" ry="20" fill="#dce9df" />
          <ellipse ref={shadow} cx="300" cy="463" rx="130" ry="13" fill="#396d62" opacity=".15" />
          <path ref={path} d={outline(createSlime())} fill={`url(#${id}-body)`} stroke={palette.dark} strokeWidth="3" />
          <g clipPath={`url(#${id}-clip)`} pointerEvents="none">
            <ellipse ref={shine} cx="253" cy="210" rx="52" ry="19" fill="white" opacity=".48" transform="rotate(-12 300 265)" />
            <g ref={face} transform="translate(300 273)">
              <ellipse cx="-51" cy="16" rx="18" ry="10" fill="#fff" opacity=".3" />
              <ellipse cx="51" cy="16" rx="18" ry="10" fill="#fff" opacity=".3" />
              <ellipse cx="-30" cy="0" rx="8" ry="12" fill="#24483f" />
              <ellipse cx="30" cy="0" rx="8" ry="12" fill="#24483f" />
              <circle cx="-32" cy="-4" r="2.5" fill="white" /><circle cx="28" cy="-4" r="2.5" fill="white" />
              <path d="M-12 20 Q0 36 12 20" fill="none" stroke="#24483f" strokeWidth="5" strokeLinecap="round" />
            </g>
          </g>
        </svg>
        <span className={styles.note}>2ほんの ゆびでも あそべるよ</span>
      </section>
      <aside className={styles.tools} aria-label="スライムのどうぐ">
        <div className={styles.colors} aria-label="いろ">
          {COLORS.map((c, i) => <button key={c.name} aria-label={c.name} aria-pressed={i === color} onClick={() => setColor(i)} style={{ background: c.main }}><span aria-hidden="true">{i === color ? '✓' : ''}</span></button>)}
        </div>
        <div className={styles.feels} aria-label="やわらかさ">
          <button aria-pressed={feel === 'soft'} onClick={() => { setFeel('soft'); feelRef.current = 'soft' }}>🫠 とろ〜り</button>
          <button aria-pressed={feel === 'bouncy'} onClick={() => { setFeel('bouncy'); feelRef.current = 'bouncy' }}>🟢 ぷるぷる</button>
        </div>
        <div className={styles.actions}>
          <button onClick={() => action('squish')}>🖐️<span>ぺったん</span></button>
          <button onClick={() => action('lift')}>🫳<span>ぽとん</span></button>
          <button onClick={() => action('reset')}>↻<span>もとにもどす</span></button>
        </div>
      </aside>
    </div>
  </main>
}
