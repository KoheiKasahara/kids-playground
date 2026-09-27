import { useId } from 'react'
import type { OrigamiId, PaperColor } from './origamiTemplates'
import styles from './OrigamiPaper.module.css'

type Point = readonly [number, number]
type Polygon = readonly Point[]
type Fold = { points: Polygon; axis: readonly [Point, Point] }

const FOX_FOLDS: readonly Fold[] = [
  { points: [[60, 155], [200, 30], [340, 155]], axis: [[60, 155], [340, 155]] },
  { points: [[60, 155], [108, 155], [168, 251]], axis: [[108, 155], [168, 251]] },
  { points: [[340, 155], [292, 155], [232, 251]], axis: [[292, 155], [232, 251]] },
]
const TULIP_FOLDS: readonly Fold[] = [
  { points: [[80, 210], [200, 330], [320, 210]], axis: [[80, 210], [320, 210]] },
  { points: [[80, 210], [109, 181], [170, 210]], axis: [[109, 181], [170, 210]] },
  { points: [[320, 210], [291, 181], [230, 210]], axis: [[291, 181], [230, 210]] },
]
const BOAT_FOLDS: readonly Fold[] = [
  { points: [[112, 230], [200, 318], [288, 230]], axis: [[112, 230], [288, 230]] },
  { points: [[64, 182], [143, 103], [143, 182]], axis: [[143, 103], [143, 182]] },
  { points: [[336, 182], [271, 117], [247, 182]], axis: [[271, 117], [247, 182]] },
]

function path(points: Polygon) {
  return `M${points.map(([x, y]) => `${x},${y}`).join('L')}Z`
}

function reflect([x, y]: Point, [[ax, ay], [bx, by]]: Fold['axis']): Point {
  const dx = bx - ax
  const dy = by - ay
  const distance = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)
  return [2 * (ax + distance * dx) - x, 2 * (ay + distance * dy) - y]
}

function PaperShape({ points, fill, grain }: { points: Polygon; fill: string; grain: string }) {
  return <g>
    <path d={path(points)} fill={fill} stroke="rgba(100, 66, 57, .12)" strokeWidth="1" strokeLinejoin="round" />
    <path d={path(points)} fill={grain} />
    <path d={path(points)} fill="none" stroke="rgba(255, 255, 255, .35)" strokeWidth="1.2" strokeLinejoin="round" />
  </g>
}

function PaperFlap({ fold, folded, folding, fill, grain }: {
  fold: Fold; folded: boolean; folding: boolean; fill: string; grain: string
}) {
  if (folded) return <PaperShape points={fold.points.map((point) => reflect(point, fold.axis))} fill={fill} grain={grain} />
  if (!folding) return <PaperShape points={fold.points} fill={fill} grain={grain} />
  const [[ax, ay], [bx, by]] = fold.axis
  const angle = Math.atan2(by - ay, bx - ax) * 180 / Math.PI
  return <g transform={`translate(${ax} ${ay}) rotate(${angle})`}>
    <g className={styles.foldingFlap}>
      <g transform={`rotate(${-angle}) translate(${-ax} ${-ay})`}>
        <PaperShape points={fold.points} fill={fill} grain={grain} />
        <path d={path(fold.points)} className={styles.foldShade} />
      </g>
    </g>
  </g>
}

function FoldGuide({ fold }: { fold: Fold }) {
  const [[ax, ay], [bx, by]] = fold.axis
  const source: Point = [
    fold.points.reduce((sum, point) => sum + point[0], 0) / fold.points.length,
    fold.points.reduce((sum, point) => sum + point[1], 0) / fold.points.length,
  ]
  const target = reflect(source, fold.axis)
  const distance = Math.hypot(target[0] - source[0], target[1] - source[1])
  const control: Point = [
    (source[0] + target[0]) / 2 + (target[1] - source[1]) / distance * 22,
    (source[1] + target[1]) / 2 - (target[0] - source[0]) / distance * 22,
  ]
  const arrowAngle = Math.atan2(target[1] - control[1], target[0] - control[0])
  return <g className={styles.guide}>
    <path d={path(fold.points.map((point) => reflect(point, fold.axis)))} fill="none" stroke="#fffdf7" opacity=".5" strokeWidth="2" strokeDasharray="3 5" />
    <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#fffdf7" strokeWidth="5" opacity=".85" />
    <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#78675e" strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round" />
    <circle cx={ax} cy={ay} r="4" fill="#fffdf7" stroke="#b6a18a" strokeWidth="1.5" />
    <circle cx={bx} cy={by} r="4" fill="#fffdf7" stroke="#b6a18a" strokeWidth="1.5" />
    <path d={`M${source.join(',')}Q${control.join(',')} ${target.join(',')}`} fill="none" stroke="#fffdf7" strokeWidth="6" strokeLinecap="round" opacity=".8" />
    <path d={`M${source.join(',')}Q${control.join(',')} ${target.join(',')}`} fill="none" stroke="#9c7955" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M0 0-8-4-8 4Z" transform={`translate(${target.join(' ')}) rotate(${arrowAngle * 180 / Math.PI})`} fill="#9c7955" />
  </g>
}

export default function OrigamiPaper({ templateId, color, step, folding = false, preview = false }: {
  templateId: OrigamiId; color: PaperColor; step: number; folding?: boolean; preview?: boolean
}) {
  const id = useId().replaceAll(':', '')
  const currentStep = preview ? 3 : Math.max(0, Math.min(3, step))
  const complete = currentStep === 3
  const folds = templateId === 'fox' ? FOX_FOLDS : templateId === 'tulip' ? TULIP_FOLDS : BOAT_FOLDS
  const grain = `url(#${id}-grain)`
  const front = `url(#${id}-front)`
  const back = `url(#${id}-back)`
  const foldFill = `url(#${id}-fold)`
  const flap = (index: number, fill = foldFill) => <PaperFlap key={index} fold={folds[index]} folded={currentStep > index} folding={folding && currentStep === index} fill={fill} grain={grain} />
  const guide = !complete && !folding && !preview ? <FoldGuide fold={folds[currentStep]} /> : null

  return <svg viewBox="0 0 400 360" className={`${styles.paper} ${preview ? styles.preview : ''}`} aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${id}-front`} x1=".1" y1="0" x2=".8" y2="1">
        <stop offset="0" stopColor={color.light} /><stop offset=".38" stopColor={color.main} /><stop offset="1" stopColor={color.dark} />
      </linearGradient>
      <linearGradient id={`${id}-fold`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={color.light} /><stop offset=".8" stopColor={color.main} /><stop offset="1" stopColor={color.dark} />
      </linearGradient>
      <linearGradient id={`${id}-back`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fffdf2" /><stop offset="1" stopColor="#f0e4cf" />
      </linearGradient>
      <linearGradient id={`${id}-leaf`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#abd6a0" /><stop offset="1" stopColor="#5f9c72" />
      </linearGradient>
      <pattern id={`${id}-grain`} width="18" height="21" patternUnits="userSpaceOnUse">
        <path d="M2 3h1M12 8h2M5 16h1M15 19h1" stroke="#fff" strokeOpacity=".34" strokeWidth="1" />
        <path d="M7 6h1M16 13h1M1 19h2" stroke="#805b45" strokeOpacity=".09" strokeWidth=".7" />
      </pattern>
      <filter id={`${id}-shadow`} x="-35%" y="-35%" width="170%" height="180%">
        <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#9c8467" floodOpacity=".18" />
        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#785f49" floodOpacity=".12" />
      </filter>
    </defs>

    <ellipse cx="200" cy={templateId === 'boat' && complete ? '266' : '320'} rx={complete ? '82' : '102'} ry="9" fill="#a99576" opacity=".1" className={complete ? styles.groundShadow : undefined} />

    {templateId === 'fox' && <g className={complete ? styles.fox : undefined} filter={`url(#${id}-shadow)`}>
      <PaperShape points={[[108, 155], [292, 155], [232, 251], [200, 280], [168, 251]]} fill={currentStep === 0 ? back : front} grain={grain} />
      {flap(1, currentStep === 0 ? back : foldFill)}{flap(2, currentStep === 0 ? back : foldFill)}{currentStep === 0 && flap(0, front)}
      {currentStep > 0 && <path d="M200 161V257" stroke={color.dark} opacity=".18" strokeWidth="1.2" />}
      {complete && <g className={styles.finishingDetails}>
        <path d="M126 140 132 157 149 160Z M274 140 268 157 251 160Z" fill={color.dark} opacity=".58" />
        <PaperShape points={[[110, 164], [198, 218], [200, 269], [149, 227]]} fill={back} grain={grain} />
        <PaperShape points={[[290, 164], [202, 218], [200, 269], [251, 227]]} fill={back} grain={grain} />
        <g className={styles.eyes}>
          <ellipse cx="163" cy="196" rx="5.6" ry="7.2" fill="#624b47" />
          <ellipse cx="237" cy="196" rx="5.6" ry="7.2" fill="#624b47" />
          <circle cx="161.5" cy="193.5" r="1.8" fill="white" /><circle cx="235.5" cy="193.5" r="1.8" fill="white" />
        </g>
        <ellipse cx="145" cy="211" rx="10" ry="5.5" fill="#f29f9e" opacity=".6" />
        <ellipse cx="255" cy="211" rx="10" ry="5.5" fill="#f29f9e" opacity=".6" />
        <path d="M191 230Q200 225 209 230L201 238Q200 239 199 238Z" fill="#624b47" />
        <path d="M200 238v7m0 0q-6 5-11 0m11 0q6 5 11 0" fill="none" stroke="#624b47" strokeWidth="2" strokeLinecap="round" />
      </g>}
      {guide}
    </g>}

    {templateId === 'tulip' && <g className={complete ? styles.tulip : undefined}>
      {complete && <g className={styles.finishingDetails}>
        <path d="M195 197h10v121h-10z" fill="#73a17a" />
        <PaperShape points={[[195, 290], [130, 234], [151, 291], [195, 306]]} fill={`url(#${id}-leaf)`} grain={grain} />
        <PaperShape points={[[205, 267], [259, 222], [249, 272], [205, 292]]} fill={`url(#${id}-leaf)`} grain={grain} />
        <path d="m141 248 54 51m50-64-40 49" stroke="#4e8864" fill="none" opacity=".4" />
      </g>}
      <g filter={`url(#${id}-shadow)`}>
        <PaperShape points={[[200, 90], [291, 181], [230, 210], [170, 210], [109, 181]]} fill={currentStep === 0 ? back : front} grain={grain} />
        {flap(1, currentStep === 0 ? back : foldFill)}{flap(2, currentStep === 0 ? back : foldFill)}{currentStep === 0 && flap(0, front)}
        {currentStep > 0 && <path d="M200 97v105" stroke={color.dark} opacity=".25" strokeWidth="1" />}
        {complete && <g className={styles.finishingDetails}>
          <path d="m171 208 29-36 29 36" fill={color.light} opacity=".2" />
          <circle cx="183" cy="177" r="3.2" fill="#77505c" /><circle cx="217" cy="177" r="3.2" fill="#77505c" />
          <path d="M193 187q7 7 14 0" fill="none" stroke="#77505c" strokeWidth="2.4" strokeLinecap="round" />
          <ellipse cx="170" cy="184" rx="6" ry="3.5" fill="#fff6e9" opacity=".6" /><ellipse cx="230" cy="184" rx="6" ry="3.5" fill="#fff6e9" opacity=".6" />
        </g>}
        {guide}
      </g>
    </g>}

    {templateId === 'boat' && <>
      {complete && <g className={`${styles.water} ${styles.finishingDetails}`} fill="none" strokeLinecap="round">
        <path d="M82 255q24 9 48 0t48 0t48 0t48 0t44 0" stroke="#abd5dc" strokeWidth="5" />
        <path d="M112 277q20 7 40 0m85 0q25 7 50 0" stroke="#cce5e6" strokeWidth="4" />
      </g>}
      <g className={complete ? styles.boat : undefined} filter={`url(#${id}-shadow)`}>
        <PaperShape points={[[200, 46], [271, 117], [247, 182], [143, 182], [143, 103]]} fill={back} grain={grain} />
        {flap(1, back)}{flap(2, front)}
        <PaperShape points={[[64, 182], [336, 182], [288, 230], [112, 230]]} fill={front} grain={grain} />
        {flap(0)}
        {currentStep > 0 && <>
          <PaperShape points={[[64, 182], [200, 210], [336, 182], [288, 230], [112, 230]]} fill={front} grain={grain} />
          <path d="m71 184 129 27 129-27" fill="none" stroke={color.light} strokeWidth="2" opacity=".65" />
        </>}
        {complete && <g className={styles.finishingDetails}>
          <path d="M201 58v130" fill="none" stroke="#ae9c84" strokeWidth="2" opacity=".5" />
          <path d="m204 61 28 12-28 10z" fill={color.main} />
          <circle cx="164" cy="211" r="4" fill={back} /><circle cx="200" cy="217" r="4" fill={back} /><circle cx="236" cy="211" r="4" fill={back} />
          <path d="M121 222h158" stroke={color.dark} opacity=".25" fill="none" />
        </g>}
        {guide}
      </g>
    </>}
  </svg>
}
