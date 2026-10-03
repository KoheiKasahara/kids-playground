import { useEffect, useId, useState, type CSSProperties, type ReactNode } from 'react'
import { bounds, centroid, reflect, type Face, type FoldFrame, type Point } from './origamiEngine'
import { origamiSequence, type OrigamiId, type PaperColor } from './origamiTemplates'
import { FOLD_MS } from './origamiState'
import { paperView } from './origamiView'
import styles from './OrigamiPaper.module.css'

function path(points: readonly Point[]) {
  return `M${points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join('L')}Z`
}

type Fills = { front: string; back: string; grain: string; leaf: string }

function Sheet({ face, fills, side = face.side }: { face: Face; fills: Fills; side?: Face['side'] }) {
  const d = path(face.points)
  return <g>
    <path d={d} fill={side === 'front' ? fills.front : fills.back} stroke="rgba(100, 66, 57, .28)" strokeWidth="1.1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    <path d={d} fill={fills.grain} />
    <path d={d} fill="none" stroke="rgba(255, 255, 255, .4)" strokeWidth="1" strokeLinejoin="round" vectorEffect="non-scaling-stroke" transform="translate(.6 .6)" />
  </g>
}

function Sheets({ faces, fills }: { faces: readonly Face[]; fills: Fills }) {
  return <>{faces.map((face) => <Sheet key={face.id} face={face} fills={fills} />)}</>
}

function FoldingFlap({ frame, fills }: { frame: FoldFrame; fills: Fills }) {
  const flap = frame.before.filter((face) => frame.moving.has(face.id))
  const [[ax, ay], [bx, by]] = frame.axis
  const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI
  return <g transform={`translate(${ax} ${ay}) rotate(${angle})`}>
    <g className={styles.foldingFlap}>
      <g transform={`rotate(${-angle}) translate(${-ax} ${-ay})`}>
        <g className={styles.firstHalf}>{flap.map((face) => <Sheet key={face.id} face={face} fills={fills} />)}</g>
        <g className={styles.secondHalf}>{[...flap].reverse().map((face) =>
          <Sheet key={face.id} face={face} fills={fills} side={face.side === 'front' ? 'back' : 'front'} />)}</g>
        <g className={styles.foldShade}>{flap.map((face) => <path key={face.id} d={path(face.points)} />)}</g>
      </g>
    </g>
  </g>
}

/** The still layers with the moving flap drawn where it ends up in the stack. */
function Folding({ frame, fills }: { frame: FoldFrame; fills: Fills }) {
  const still = frame.before.filter((face) => !frame.moving.has(face.id))
  return <>
    <Sheets faces={still.slice(0, frame.layer)} fills={fills} />
    <FoldingFlap frame={frame} fills={fills} />
    <Sheets faces={still.slice(frame.layer)} fills={fills} />
  </>
}

/** Several folds made in one movement (a squash or petal fold) play one after another. */
function Collapsing({ parts, fills }: { parts: readonly FoldFrame[]; fills: Fills }) {
  const [part, setPart] = useState(0)
  const duration = FOLD_MS / parts.length
  useEffect(() => {
    if (part >= parts.length - 1) return
    const timer = window.setTimeout(() => setPart(part + 1), duration)
    return () => window.clearTimeout(timer)
  }, [part, parts.length, duration])
  return <g key={part} style={{ '--fold-duration': `${duration}ms` } as CSSProperties}>
    <Folding frame={parts[part]!} fills={fills} />
  </g>
}

function Arrow({ from, to, scale }: { from: Point; to: Point; scale: number }) {
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1
  const bend = Math.min(22 / scale, distance * .3)
  const control: Point = [
    (from[0] + to[0]) / 2 + (to[1] - from[1]) / distance * bend,
    (from[1] + to[1]) / 2 - (to[0] - from[0]) / distance * bend,
  ]
  const angle = Math.atan2(to[1] - control[1], to[0] - control[0]) * 180 / Math.PI
  const d = `M${from.join(',')}Q${control.join(',')} ${to.join(',')}`
  return <>
    <path d={d} fill="none" stroke="#fffdf7" strokeWidth="6" strokeLinecap="round" opacity=".8" vectorEffect="non-scaling-stroke" />
    <path d={d} fill="none" stroke="#9c7955" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    <path d="M0 0-9-5-9 5Z" transform={`translate(${to.join(' ')}) rotate(${angle}) scale(${1 / scale})`} fill="#9c7955" />
  </>
}

function FoldGuide({ templateId, step, scale }: { templateId: OrigamiId; step: number; scale: number }) {
  const { states, frames } = origamiSequence(templateId)
  const next = frames[step]!
  if (next.type === 'flip') {
    const box = bounds(states[step]!)
    const y = box.minY - 14 / scale
    const x = (box.maxX - box.minX) * .32
    const mid = (box.minX + box.maxX) / 2
    return <g className={styles.guide}><Arrow from={[mid - x, y]} to={[mid + x, y]} scale={scale} /></g>
  }
  // A squash or petal fold starts with its first movement; show that one.
  const frame = next.type === 'collapse' ? next.parts[0]! : next
  const flap = frame.before.filter((face) => frame.moving.has(face.id))
  const [a, b] = frame.axis
  const length = Math.hypot(b[0] - a[0], b[1] - a[1])
  const direction: Point = [(b[0] - a[0]) / length, (b[1] - a[1]) / length]
  let low = Infinity
  let high = -Infinity
  for (const face of flap) {
    for (const point of face.points) {
      const offset = (point[0] - a[0]) * direction[1] - (point[1] - a[1]) * direction[0]
      if (Math.abs(offset) > .5) continue
      const along = (point[0] - a[0]) * direction[0] + (point[1] - a[1]) * direction[1]
      low = Math.min(low, along)
      high = Math.max(high, along)
    }
  }
  const start: Point = [a[0] + direction[0] * low, a[1] + direction[1] * low]
  const end: Point = [a[0] + direction[0] * high, a[1] + direction[1] * high]
  const source = centroid(flap)
  const dash = frame.type === 'mountain' ? '9 4 2 4' : '5 6'
  return <g className={styles.guide}>
    {flap.map((face) => <path key={face.id} d={path(face.points.map((point) => reflect(point, frame.axis)))} fill="none" stroke="#fffdf7" opacity=".6" strokeWidth="2" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
    {Number.isFinite(low) && <>
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke="#fffdf7" strokeWidth="5" opacity=".85" vectorEffect="non-scaling-stroke" />
      <line x1={start[0]} y1={start[1]} x2={end[0]} y2={end[1]} stroke="#78675e" strokeWidth="2" strokeDasharray={dash} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </>}
    <Arrow from={source} to={reflect(source, frame.axis)} scale={scale} />
  </g>
}

function Finish({ templateId, color, fills, faces }: { templateId: OrigamiId; color: PaperColor; fills: Fills; faces: readonly Face[] }): ReactNode {
  const ink = '#624b47'
  const eye = (x: number, y: number, r = 5) => <g key={`${x}`}>
    <ellipse cx={x} cy={y} rx={r} ry={r * 1.25} fill={ink} /><circle cx={x - r * .3} cy={y - r * .45} r={r * .34} fill="white" />
  </g>
  const cheek = (x: number, y: number) => <ellipse key={`c${x}`} cx={x} cy={y} rx="9" ry="5" fill="#f29f9e" opacity=".55" />
  switch (templateId) {
    case 'fox':
      return <g className={styles.eyes}>{eye(-30, 42)}{eye(30, 42)}{cheek(-48, 60)}{cheek(48, 60)}
        <path d="M-8 106Q0 101 8 106L1 113Q0 114-1 113Z" fill={ink} /></g>
    case 'dog':
      return <g className={styles.eyes}>{eye(-26, 50)}{eye(26, 50)}{cheek(-44, 70)}
        {cheek(44, 70)}<ellipse cx="0" cy="98" rx="9" ry="6.5" fill={ink} />
        <path d="M0 104v6m0 0q-6 5-11 0m11 0q6 5 11 0" fill="none" stroke={ink} strokeWidth="2" strokeLinecap="round" /></g>
    case 'tulip':
      return <>
        <path d="M-4 -2h8V148h-8z" fill="#73a17a" />
        <path d="M0 130Q-50 110-52 60Q-10 80 0 130Z" fill={fills.leaf} />
        <path d="M0 118Q46 104 50 66Q8 78 0 118Z" fill={fills.leaf} />
      </>
    case 'boat':
      return <g fill="none" strokeLinecap="round" className={styles.water}>
        <path d="M-120 40q24 9 48 0t48 0t48 0t48 0t48 0" stroke="#abd5dc" strokeWidth="5" />
        <path d="M-90 56q20 7 40 0m85 0q25 7 50 0" stroke="#cce5e6" strokeWidth="4" />
      </g>
    case 'cicada':
      return <>{eye(-20, -84, 4.5)}{eye(20, -84, 4.5)}</>
    case 'crane': {
      const [x, y] = centroid(faces.filter((face) => face.tags.includes('head')))
      return <circle cx={x} cy={y} r="2.4" fill={ink} />
    }
    case 'cup':
      return <g opacity=".75"><path d="M-40 -64q10 -6 20 0t20 0t20 0t20 0" fill="none" stroke={color.light} strokeWidth="3" strokeLinecap="round" /></g>
    default:
      return null
  }
}

export default function OrigamiPaper({ templateId, color, step, folding = false, preview = false }: {
  templateId: OrigamiId; color: PaperColor; step: number; folding?: boolean; preview?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const { states, frames } = origamiSequence(templateId)
  const total = frames.length
  const current = preview ? total : Math.max(0, Math.min(total, step))
  const complete = current === total
  const frame = folding && !complete ? frames[current]! : null
  const view = paperView(templateId, current)
  const fills: Fills = { front: `url(#${id}-front)`, back: `url(#${id}-back)`, grain: `url(#${id}-grain)`, leaf: `url(#${id}-leaf)` }
  const faces = states[current]!

  let paper: ReactNode
  if (frame?.type === 'flip') {
    paper = <>
      <g className={styles.flipOut}><Sheets faces={faces} fills={fills} /></g>
      <g className={styles.flipIn}><Sheets faces={states[current + 1]!} fills={fills} /></g>
    </>
  } else if (frame?.type === 'collapse') {
    paper = <Collapsing parts={frame.parts} fills={fills} />
  } else if (frame) {
    paper = <Folding frame={frame} fills={fills} />
  } else {
    paper = <Sheets faces={faces} fills={fills} />
  }

  return <svg viewBox="0 0 400 360" className={`${styles.paper} ${preview ? styles.preview : ''}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-front`} x1=".1" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor={color.light} /><stop offset=".4" stopColor={color.main} /><stop offset="1" stopColor={color.dark} />
      </linearGradient>
      <linearGradient id={`${id}-back`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fffdf2" /><stop offset="1" stopColor="#efe2cc" />
      </linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#abd6a0" /><stop offset="1" stopColor="#5f9c72" />
      </linearGradient>
      <pattern id={`${id}-grain`} width="18" height="21" patternUnits="userSpaceOnUse">
        <path d="M2 3h1M12 8h2M5 16h1M15 19h1" stroke="#fff" strokeOpacity=".34" strokeWidth="1" />
        <path d="M7 6h1M16 13h1M1 19h2" stroke="#805b45" strokeOpacity=".09" strokeWidth=".7" />
      </pattern>
      <filter id={`${id}-shadow`} x="-35%" y="-35%" width="170%" height="180%">
        <feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#9c8467" floodOpacity=".2" />
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#785f49" floodOpacity=".12" />
      </filter>
    </defs>
    <ellipse cx="200" cy="318" rx={complete ? 82 : 110} ry="9" fill="#a99576" opacity=".1" className={complete ? styles.groundShadow : undefined} />
    <g className={preview ? undefined : styles.view} style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}>
      <g className={complete && !preview ? styles[templateId] ?? styles.alive : undefined}>
        {complete && templateId === 'tulip' && <Finish templateId={templateId} color={color} fills={fills} faces={faces} />}
        <g filter={`url(#${id}-shadow)`} key={frame ? `fold-${current}` : `still-${current}`}>{paper}</g>
        {complete && templateId !== 'tulip' && <g className={styles.finishingDetails}><Finish templateId={templateId} color={color} fills={fills} faces={faces} /></g>}
      </g>
      {!complete && !frame && !preview && <FoldGuide key={current} templateId={templateId} step={current} scale={view.scale} />}
    </g>
  </svg>
}
