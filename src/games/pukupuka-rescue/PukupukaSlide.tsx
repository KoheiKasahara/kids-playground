import type { SlideDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// すべりだい（すきとおったチューブ）の見た目だけを持つ。すべる動きは pukupukaGame.ts が
// 道すじ(path)にそって決め、ここでは同じ道すじを太い管として描く。
// 奥側（back）は浮遊物より先に、手前のつや（front）は浮遊物の後に描き、中を通っているように見せる。

/** 点列を、角の丸いなめらかな曲線（Catmull-Rom → 3次ベジェ）にする。 */
function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length < 2) return ''
  let d = `M${points[0].x} ${points[0].y}`
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[Math.min(points.length - 1, index + 2)]
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += ` C${c1x.toFixed(2)} ${c1y.toFixed(2)} ${c2x.toFixed(2)} ${c2y.toFixed(2)} ${p2.x} ${p2.y}`
  }
  return d
}

type Props = {
  slide: SlideDefinition
  layer: 'back' | 'front'
  /** 隊長がすべっている最中か。水の流れを速く見せる。 */
  active: boolean
}

export default function PukupukaSlide({ slide, layer, active }: Props) {
  const entryX = slide.entry.x + slide.entry.width / 2
  const entryY = slide.entry.y + slide.entry.height / 2
  const path = smoothPath([{ x: entryX - 3, y: entryY }, ...slide.path])
  const end = slide.path[slide.path.length - 1]
  const before = slide.path[slide.path.length - 2] ?? end
  const exitAngle = (Math.atan2(end.y - before.y, end.x - before.x) * 180) / Math.PI
  if (layer === 'front') {
    return (
      <g aria-hidden="true" pointerEvents="none">
        <path d={path} fill="none" stroke="#e7f5ff" strokeWidth="9.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.18" />
        <path d={path} fill="none" stroke="#ffffff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.75" transform="translate(-1.6 -2.4)" />
      </g>
    )
  }
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="pukupuka-slide" data-active={active}>
      {/* 管の柱 */}
      {slide.path.filter((_, index) => index % 5 === 2).map((point) => (
        <rect key={`${point.x}-${point.y}`} x={point.x - 0.7} y={point.y + 5} width="1.4" height="5" rx="0.6" fill="#5c7591" opacity="0.6" />
      ))}
      <path d={path} fill="none" stroke="#1971c2" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" opacity="0.32" />
      <path d={path} fill="none" stroke="#d0ebff" strokeWidth="9.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
      <path
        className={active ? styles.slideStreamFast : styles.slideStream}
        d={path}
        fill="none"
        stroke="#4dabf7"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="4 5"
        opacity="0.75"
      />
      {/* 入口のラッパ */}
      <g transform={`translate(${entryX - 3} ${entryY})`}>
        <path d="M0 -5.6 L-6.4 -8.4 Q-8.2 0 -6.4 8.4 L0 5.6 Z" fill="#ffd43b" stroke="#e67700" strokeWidth="0.6" strokeLinejoin="round" />
        <path d="M-6 -7.2 Q-7.4 0 -6 7.2" fill="none" stroke="#fff3bf" strokeWidth="0.8" strokeLinecap="round" />
      </g>
      {/* 出口 */}
      <g transform={`translate(${end.x} ${end.y}) rotate(${exitAngle})`}>
        <rect x="-2" y="-6.6" width="3.4" height="13.2" rx="1.2" fill="#ffd43b" stroke="#e67700" strokeWidth="0.55" />
      </g>
    </g>
  )
}
