import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { beginGrab, bodyPath, center, CONTAINERS, createSlime, FEELS, GHOST_LIFE, HEIGHT, lift, morph, poke, shapePreview, SHAPE_IDS, SHAPES, squish, stepSlime, WIDTH, type ContainerId, type Feel, type Grab, type ShapeId } from './slimeSimulation'
import { playSlimeSound } from './slimeSound'
import styles from './PuniSlimePlay.module.css'

const COLORS = [
  { name: 'みどり', light: '#daffb1', main: '#78dc93', dark: '#2baa8b' },
  { name: 'ももいろ', light: '#ffe0f0', main: '#f797ca', dark: '#d157a6' },
  { name: 'そらいろ', light: '#d2f8ff', main: '#75ccef', dark: '#448fda' },
] as const
const DRIP_SLOTS = Math.max(...Object.values(FEELS).map((params) => params.drip.max))

export default function PuniSlimePlay() {
  useGameIntroPlaying(true)
  const [color, setColor] = useState(0)
  const [feel, setFeel] = useState<Feel>('soft')
  const [shape, setShape] = useState<ShapeId>('round')
  const [placed, setPlaced] = useState<readonly ContainerId[]>([])
  const [sound, setSound] = useState(true)
  const [hint, setHint] = useState('ゆびで ひっぱって はなしてみよう')
  const body = useRef(createSlime())
  const grabs = useRef(new Map<number, Grab>())
  const feelRef = useRef<Feel>('soft')
  const soundRef = useRef(true)
  const svg = useRef<SVGSVGElement>(null)
  const path = useRef<SVGPathElement>(null)
  const clip = useRef<SVGPathElement>(null)
  const face = useRef<SVGGElement>(null)
  const shine = useRef<SVGEllipseElement>(null)
  const gloss = useRef<SVGCircleElement>(null)
  const shadow = useRef<SVGEllipseElement>(null)
  const ghost = useRef<SVGPathElement>(null)
  const drips = useRef<(SVGCircleElement | null)[]>([])
  const id = useId().replace(/:/g, '')
  const palette = COLORS[color]
  const look = FEELS[feel].look
  const thumbs = useMemo(() => SHAPE_IDS.map((key) => shapePreview(key, 34)), [])
  const holders = useMemo(() => CONTAINERS.filter((holder) => placed.includes(holder.id)), [placed])
  // 描画ループはrefだけを読む。置いた容器が変わってもアニメーションを組み直さない。
  const holdersRef = useRef(holders)
  useEffect(() => { holdersRef.current = holders }, [holders])

  function clearGrabs() {
    for (const pointerId of grabs.current.keys()) {
      if (svg.current?.hasPointerCapture?.(pointerId)) svg.current.releasePointerCapture(pointerId)
    }
    grabs.current.clear()
  }
  function play(cue: Parameters<typeof playSlimeSound>[0]) {
    playSlimeSound(cue, feelRef.current, soundRef.current)
  }

  useEffect(() => {
    let frame = 0, last = 0, accumulator = 0
    const draw = () => {
      const shell = bodyPath(body.current)
      path.current?.setAttribute('d', shell)
      clip.current?.setAttribute('d', shell)
      const c = center(body.current)
      // 顔は今の体の広がりに合わせて縮める。容器に押し込まれても顔がはみ出さない。
      const spot = body.current.shape.face
      const span = (axis: 'x' | 'y', rest: number) => {
        const values = body.current.points.map((p) => p[axis])
        return Math.max(0.5, Math.min(1.2, (Math.max(...values) - Math.min(...values)) / rest)) * spot.scale
      }
      const wide = span('x', body.current.shape.restWidth), tall = span('y', body.current.shape.restHeight)
      face.current?.setAttribute('transform', `translate(${c.x} ${c.y + spot.y * tall}) scale(${wide} ${tall})`)
      shine.current?.setAttribute('cx', String(c.x - 47))
      shine.current?.setAttribute('cy', String(c.y - 55))
      // 回転の中心も一緒に運ぶ。固定点まわりに回すと、体が離れるほど光沢がずれていく。
      shine.current?.setAttribute('transform', `rotate(-12 ${c.x - 47} ${c.y - 55})`)
      gloss.current?.setAttribute('cx', String(c.x - 62))
      gloss.current?.setAttribute('cy', String(c.y - 68))
      shadow.current?.setAttribute('cx', String(c.x))
      shadow.current?.setAttribute('rx', String(Math.max(65, 150 - (340 - c.y) * 0.25)))
      shadow.current?.setAttribute('opacity', String(Math.max(0.08, Math.min(0.2, c.y / 2000))))
      const trace = body.current.ghost
      ghost.current?.setAttribute('d', trace?.d ?? '')
      ghost.current?.setAttribute('opacity', String(trace ? trace.life / GHOST_LIFE * 0.5 : 0))
      drips.current.forEach((drop, i) => {
        const state = body.current.drips[i]
        if (!drop) return
        drop.setAttribute('opacity', String(state ? Math.min(1, state.life / 26) * 0.85 : 0))
        if (!state) return
        drop.setAttribute('cx', String(state.x))
        drop.setAttribute('cy', String(state.y))
        drop.setAttribute('r', String(state.r))
      })
    }
    const tick = (now: number) => {
      if (!document.hidden) {
        accumulator += last ? Math.min((now - last) / 1000, 0.05) : 0
        while (accumulator >= 1 / 60) {
          stepSlime(body.current, [...grabs.current.values()], feelRef.current, holdersRef.current)
          if (body.current.event === 'fit') { play('fit'); setHint('すっぽり はいった！') }
          else if (body.current.event === 'free') { play('release'); setHint('ぬけた！ もとの かたちに もどるよ') }
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
    play('grab')
    setHint('びよ〜ん！ はなすと ぷるぷる')
  }
  function move(event: PointerEvent<SVGSVGElement>) {
    const grab = grabs.current.get(event.pointerId)
    const p = point(event)
    if (grab && p) { event.preventDefault(); grab.target = p }
  }
  function up(event: PointerEvent<SVGSVGElement>) {
    if (grabs.current.delete(event.pointerId)) play('release')
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  function action(kind: 'squish' | 'lift' | 'reset') {
    clearGrabs()
    if (kind === 'reset') { body.current = createSlime(shape); setHint('まんまる！ また さわってね') }
    else if (kind === 'squish') { squish(body.current); setHint('ぺったん！ ぷるんと もどるよ') }
    else { lift(body.current); setHint('ぽとん！ おちると どうなるかな？') }
    play(kind === 'reset' ? 'poke' : kind === 'squish' ? 'squish' : 'drop')
  }
  function chooseShape(next: ShapeId) {
    clearGrabs()
    setShape(next)
    morph(body.current, next)
    play('poke')
    setHint(`${SHAPES[next].label}に へんしん！`)
  }
  function chooseFeel(next: Feel) {
    setFeel(next)
    feelRef.current = next
    playSlimeSound('poke', next, soundRef.current)
    setHint(next === 'soft' ? 'とろ〜り のびて ゆっくり もどるよ' : 'ぷるぷる はずんで ふるえるよ')
  }
  function toggleContainer(holder: ContainerId) {
    setPlaced((current) => current.includes(holder) ? current.filter((k) => k !== holder) : [...current, holder])
    play('fit')
    setHint(placed.includes(holder) ? 'いれものを かたづけたよ' : 'スライムを のせると かたちが かわるよ')
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1>ぷにぷにスライム</h1>
      <button className={styles.sound} aria-pressed={sound} aria-label={sound ? 'おとを けす' : 'おとを だす'} onClick={() => { setSound(!sound); soundRef.current = !sound }}>{sound ? '🔊' : '🔇'}</button>
    </header>
    <div className={styles.workspace}>
      <section className={styles.stage} aria-label="スライムあそび">
        <p className={styles.hint} aria-live="polite">{hint}</p>
        <svg ref={svg} className={styles.slime} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="ひっぱって あそべる スライム" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onLostPointerCapture={(event) => grabs.current.delete(event.pointerId)}>
          <defs>
            <linearGradient id={`${id}-body`} x1="0.2" y1="0" x2="0.8" y2="1">
              <stop stopColor={palette.light} /><stop offset=".45" stopColor={palette.main} /><stop offset="1" stopColor={palette.dark} />
            </linearGradient>
            <filter id={`${id}-soften`} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={Math.max(0.01, look.blur)} /></filter>
            <clipPath id={`${id}-clip`}><path ref={clip} d={bodyPath(createSlime())} /></clipPath>
          </defs>
          <ellipse cx="300" cy="470" rx="270" ry="20" fill="#dce9df" />
          <g aria-hidden="true" pointerEvents="none">
            {holders.map((holder) => <path key={holder.id} d={holder.wall} fill="#fff" fillOpacity=".62" fillRule="evenodd" stroke="#a6c9cd" strokeWidth="3" strokeLinejoin="round" />)}
          </g>
          <ellipse ref={shadow} cx="300" cy="463" rx="130" ry="13" fill="#396d62" opacity=".15" />
          <g aria-hidden="true" pointerEvents="none">
            <path ref={ghost} d="" fill="none" stroke={palette.dark} strokeWidth="4" strokeDasharray="10 8" strokeLinecap="round" opacity="0" />
          </g>
          <path ref={path} d={bodyPath(createSlime())} fill={`url(#${id}-body)`} fillOpacity={look.body} stroke={palette.dark} strokeWidth={look.stroke} strokeOpacity={look.body} />
          <g clipPath={`url(#${id}-clip)`} pointerEvents="none">
            <ellipse ref={shine} cx="253" cy="210" rx="52" ry="19" fill="white" opacity={look.shine} transform="rotate(-12 300 265)" filter={look.blur ? `url(#${id}-soften)` : undefined} />
            <circle ref={gloss} cx="238" cy="197" r="11" fill="white" opacity={look.gloss} />
            <g ref={face} transform="translate(300 273)">
              <ellipse cx="-51" cy="16" rx="18" ry="10" fill="#fff" opacity=".3" />
              <ellipse cx="51" cy="16" rx="18" ry="10" fill="#fff" opacity=".3" />
              <ellipse cx="-30" cy="0" rx="8" ry="12" fill="#24483f" />
              <ellipse cx="30" cy="0" rx="8" ry="12" fill="#24483f" />
              <circle cx="-32" cy="-4" r="2.5" fill="white" /><circle cx="28" cy="-4" r="2.5" fill="white" />
              <path d="M-12 20 Q0 36 12 20" fill="none" stroke="#24483f" strokeWidth="5" strokeLinecap="round" />
            </g>
          </g>
          <g aria-hidden="true" pointerEvents="none">
            {Array.from({ length: DRIP_SLOTS }, (_, i) => <circle key={i} ref={(node) => { drips.current[i] = node }} cx="-40" cy="-40" r="5" fill={palette.main} stroke={palette.dark} strokeWidth="2" opacity="0" />)}
          </g>
        </svg>
        <span className={styles.note}>2ほんの ゆびでも あそべるよ</span>
      </section>
      <aside className={styles.tools} aria-label="スライムのどうぐ">
        <div className={styles.shapes} aria-label="かたち">
          {SHAPE_IDS.map((key, i) => <button key={key} aria-label={SHAPES[key].label} aria-pressed={key === shape} onClick={() => chooseShape(key)}>
            <svg viewBox="0 0 34 34" aria-hidden="true"><path d={thumbs[i]} fill={key === shape ? palette.main : '#c9dcd0'} stroke="#31554c" strokeWidth="1.5" /></svg>
          </button>)}
        </div>
        <div className={styles.colors} aria-label="いろ">
          {COLORS.map((c, i) => <button key={c.name} aria-label={c.name} aria-pressed={i === color} onClick={() => setColor(i)} style={{ background: c.main }}><span aria-hidden="true">{i === color ? '✓' : ''}</span></button>)}
        </div>
        <div className={styles.feels} aria-label="やわらかさ">
          {(Object.keys(FEELS) as Feel[]).map((key) => <button key={key} aria-pressed={feel === key} onClick={() => chooseFeel(key)}>{FEELS[key].emoji} {FEELS[key].label}</button>)}
        </div>
        <div className={styles.holders} aria-label="いれもの">
          {CONTAINERS.map((holder) => <button key={holder.id} aria-pressed={placed.includes(holder.id)} onClick={() => toggleContainer(holder.id)}>{holder.emoji}<span>{holder.label}</span></button>)}
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
