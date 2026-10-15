import { memo, useId, type ReactNode } from 'react'
import type { FishId } from './fishingGame'

/**
 * 外部素材を使わない、グラデーション・うろこ・ひれの筋まで描いた魚のイラスト。
 * すべて右向き（viewBox 0 0 140 100）。尾びれは data-part="tail" で、泳ぎのアニメーションに使う。
 */

type Fin = { d: string; base: [number, number] }
type Look = {
  body: string
  tail: Fin
  dorsal: Fin
  anal: Fin
  pectoral: string
  eye: { cx: number; cy: number; r: number }
  mouth: string
  gill: string
  top: string
  mid: string
  belly: string
  fin: string
  finTip: string
  outline: string
  scales: boolean
  pattern: () => ReactNode
  front?: () => ReactNode
}

const LOOKS: Record<FishId, Look> = {
  clownfish: {
    body: 'M30 50 C34 22 70 16 96 24 C112 30 121 42 121 50 C121 60 112 70 96 76 C70 84 34 78 30 50Z',
    tail: { d: 'M36 50 C26 34 14 28 6 30 C11 42 11 58 6 70 C14 72 26 66 36 50Z', base: [36, 50] },
    dorsal: { d: 'M46 30 C48 14 62 8 72 16 C78 10 90 12 94 24 C80 22 60 24 46 30Z', base: [70, 28] },
    anal: { d: 'M60 76 C60 90 72 94 82 86 C84 82 82 78 80 74Z', base: [70, 74] },
    pectoral: 'M76 56 C64 54 58 64 61 72 C68 72 76 64 78 58Z',
    eye: { cx: 101, cy: 43, r: 8.5 },
    mouth: 'M113 57 Q117 60 120 55',
    gill: 'M88 32 Q80 50 88 68',
    top: '#f45d0c', mid: '#ff8a2a', belly: '#ffd39a', fin: '#ff8a2a', finTip: '#1f2633', outline: '#9c3a06',
    scales: true,
    pattern: () => (
      <g fill="#fffaf2" stroke="#1f2633" strokeWidth="2.4">
        <path d="M84 12 C77 32 77 68 84 88 L95 88 C88 68 88 32 95 12Z" />
        <path d="M58 10 C64 32 64 68 58 90 L69 90 C75 68 75 32 69 10Z" />
        <path d="M33 30 C40 40 40 60 33 70 L42 74 C49 60 49 40 42 26Z" />
      </g>
    ),
  },
  tang: {
    body: 'M28 50 C36 24 72 18 98 26 C114 32 123 44 123 50 C123 58 114 68 98 74 C72 82 36 76 28 50Z',
    tail: { d: 'M34 50 C24 38 14 30 6 26 C10 40 10 60 6 74 C14 70 24 62 34 50Z', base: [34, 50] },
    dorsal: { d: 'M38 34 C50 16 86 12 104 26 C90 22 60 22 38 34Z', base: [70, 26] },
    anal: { d: 'M40 64 C54 82 86 84 100 72 C84 76 58 74 40 64Z', base: [70, 72] },
    pectoral: 'M84 54 C74 50 66 58 68 66 C76 66 84 60 86 56Z',
    eye: { cx: 104, cy: 42, r: 8 },
    mouth: 'M117 55 Q120 57 122 53',
    gill: 'M94 31 Q87 50 94 69',
    top: '#1546b8', mid: '#2f7ff0', belly: '#8cc4ff', fin: '#2563d6', finTip: '#0f1b47', outline: '#0f2f80',
    scales: true,
    pattern: () => (
      <path d="M44 36 C58 24 88 26 100 33 C88 34 74 36 68 43 C78 49 90 48 96 45 C86 57 66 58 54 52 C48 48 45 42 44 36Z" fill="#141f45" />
    ),
  },
  puffer: {
    body: 'M32 50 C32 20 58 12 80 12 C104 12 120 30 120 50 C120 72 104 88 80 88 C58 88 32 80 32 50Z',
    tail: { d: 'M36 50 C26 40 16 36 10 38 C14 46 14 54 10 62 C16 64 26 60 36 50Z', base: [36, 50] },
    dorsal: { d: 'M48 24 C48 12 60 8 66 16Z', base: [56, 22] },
    anal: { d: 'M48 76 C48 88 60 92 66 84Z', base: [56, 78] },
    pectoral: 'M84 54 C74 50 68 58 70 66 C78 66 84 60 86 56Z',
    eye: { cx: 98, cy: 38, r: 10.5 },
    mouth: 'M115 55 C120 52 122 60 116 60 C114 59 114 56 115 55Z',
    gill: 'M90 28 Q83 46 90 64',
    top: '#d99a14', mid: '#f6cf4a', belly: '#fff6d6', fin: '#f0b93a', finTip: '#c98a12', outline: '#8a5c08',
    scales: false,
    pattern: () => (
      <g fill="#8a5a1d" opacity="0.7">
        {[[52, 30, 3.2], [66, 22, 2.6], [70, 36, 3], [56, 44, 2.6], [82, 24, 2.4], [44, 40, 2.2], [84, 36, 2]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    ),
    front: () => (
      <g fill="#fff3c4" stroke="#8a5c08" strokeWidth="1.4" strokeLinejoin="round">
        {[[60, 12, -12], [80, 10, 0], [100, 14, 14], [112, 28, 30], [48, 84, 200], [70, 90, 180], [96, 86, 160]].map(([x, y, r]) => (
          <path key={`${x}-${y}`} d="M-3 2 L0 -5 L3 2Z" transform={`translate(${x} ${y}) rotate(${r})`} />
        ))}
      </g>
    ),
  },
  butterflyfish: {
    body: 'M30 50 C44 26 62 12 78 12 C96 14 112 34 122 50 C112 64 96 86 78 88 C62 88 44 74 30 50Z',
    tail: { d: 'M36 50 C26 40 16 36 8 36 C12 44 12 56 8 64 C16 64 26 60 36 50Z', base: [36, 50] },
    dorsal: { d: 'M42 38 C48 18 62 6 76 8 C70 14 58 22 50 40Z', base: [54, 30] },
    anal: { d: 'M42 62 C48 82 62 94 76 92 C70 86 58 78 50 60Z', base: [54, 70] },
    pectoral: 'M84 56 C74 52 68 60 70 68 C78 68 84 62 86 58Z',
    eye: { cx: 101, cy: 44, r: 7.5 },
    mouth: 'M119 52 L124 51 L121 55',
    gill: 'M92 30 Q85 50 92 70',
    top: '#f2b40c', mid: '#ffd83b', belly: '#fff3ac', fin: '#ffd23a', finTip: '#f08a12', outline: '#9a6a04',
    scales: true,
    pattern: () => (
      <g>
        <path d="M95 14 C90 34 90 66 95 86 L106 82 C101 64 101 36 106 18Z" fill="#202a3a" />
        <path d="M106 18 C101 36 101 64 106 82 L114 70 C110 60 110 40 114 30Z" fill="#fffef4" />
        <circle cx="54" cy="38" r="7" fill="#fffef4" />
        <circle cx="54" cy="38" r="5" fill="#202a3a" />
        <path d="M44 58 L86 30 M48 68 L92 40 M56 76 L96 52" stroke="#f0a20f" strokeWidth="2" opacity="0.6" />
      </g>
    ),
  },
  bream: {
    body: 'M26 50 C36 22 66 12 92 18 C110 24 121 40 123 50 C119 62 106 72 90 76 C64 82 36 74 26 50Z',
    tail: { d: 'M32 50 C22 38 12 26 4 22 C10 38 14 46 18 50 C14 54 10 62 4 78 C12 74 22 62 32 50Z', base: [30, 50] },
    dorsal: { d: 'M40 30 C44 18 52 12 58 16 C64 8 74 8 80 12 C86 12 92 16 96 22 C78 18 58 22 40 30Z', base: [68, 22] },
    anal: { d: 'M56 74 C58 86 70 88 78 80 L80 74Z', base: [68, 74] },
    pectoral: 'M82 56 C70 52 62 60 64 70 C72 70 82 62 84 58Z',
    eye: { cx: 102, cy: 38, r: 8 },
    mouth: 'M116 54 Q120 57 123 52',
    gill: 'M90 26 Q82 46 90 66',
    top: '#d93c5c', mid: '#f27a92', belly: '#ffe4ea', fin: '#f2788f', finTip: '#c42a4a', outline: '#8e1f37',
    scales: true,
    pattern: () => (
      <g fill="#5fc4ff" stroke="#e6f7ff" strokeWidth="0.8">
        {[[48, 34], [58, 28], [68, 24], [62, 38], [74, 34], [84, 28], [52, 46], [80, 42], [92, 34]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="2.2" />
        ))}
      </g>
    ),
  },
  sunfish: {
    body: 'M36 26 C56 12 92 12 108 28 C118 38 121 44 121 52 C121 62 114 74 104 80 C88 90 56 90 36 76 C30 66 30 36 36 26Z',
    tail: { d: 'M40 26 C28 30 20 40 22 50 C20 60 28 70 40 78 C36 66 34 38 40 26Z', base: [40, 52] },
    dorsal: { d: 'M60 20 C58 6 66 2 76 4 C82 8 80 14 76 20Z', base: [68, 20] },
    anal: { d: 'M60 82 C58 94 66 98 76 96 C82 92 80 86 76 80Z', base: [68, 82] },
    pectoral: 'M88 54 C80 50 74 56 76 64 C82 64 88 60 90 56Z',
    eye: { cx: 102, cy: 44, r: 7.5 },
    mouth: 'M116 58 Q119 61 121 57',
    gill: 'M96 34 Q90 50 96 66',
    top: '#5f88a6', mid: '#9bc0d4', belly: '#eef7f8', fin: '#7ea7c0', finTip: '#4d7591', outline: '#36586f',
    scales: false,
    pattern: () => (
      <g fill="#ffffff" opacity="0.35">
        {[[52, 40, 4], [64, 34, 3], [70, 50, 4.5], [56, 60, 3.5], [82, 40, 3], [84, 64, 3.5]].map(([x, y, r]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r={r} />
        ))}
      </g>
    ),
  },
}

function FinRays({ fin, color }: { fin: Fin; color: string }) {
  const [bx, by] = fin.base
  return (
    <g stroke={color} strokeWidth="1.1" opacity="0.45" fill="none">
      {Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2
        return <line key={i} x1={bx} y1={by} x2={bx + Math.cos(angle) * 60} y2={by + Math.sin(angle) * 60} />
      })}
    </g>
  )
}

function FinPart({ fin, look, fill, part }: { fin: Fin; look: Look; fill: string; part?: string }) {
  const id = useId()
  return (
    <g data-part={part}>
      <defs><clipPath id={id}><path d={fin.d} /></clipPath></defs>
      <path d={fin.d} fill={fill} />
      <g clipPath={`url(#${id})`}><FinRays fin={fin} color={look.finTip} /></g>
      <path d={fin.d} fill="none" stroke={look.outline} strokeWidth="2" strokeLinejoin="round" />
    </g>
  )
}

function FishArt({ fishId }: { fishId: FishId }) {
  const base = useId().replace(/:/g, '')
  const look = LOOKS[fishId]
  const ids = { clip: `${base}c`, scale: `${base}s` }
  const bodyGrad = `${base}b`
  const finGrad = `${base}f`
  const sheen = `${base}h`
  const iris = `${base}i`
  const { cx, cy, r } = look.eye
  return (
    <svg viewBox="0 0 140 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={bodyGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={look.top} />
          <stop offset="0.45" stopColor={look.mid} />
          <stop offset="1" stopColor={look.belly} />
        </linearGradient>
        <linearGradient id={finGrad} x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" stopColor={look.fin} />
          <stop offset="0.75" stopColor={look.fin} stopOpacity="0.9" />
          <stop offset="1" stopColor={look.finTip} stopOpacity="0.95" />
        </linearGradient>
        <radialGradient id={sheen} cx="0.35" cy="0.3" r="0.6">
          <stop offset="0" stopColor="#fff" stopOpacity="0.75" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={iris} cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#5a4632" />
          <stop offset="0.55" stopColor="#1d1a22" />
          <stop offset="1" stopColor="#07070c" />
        </radialGradient>
        <pattern id={ids.scale} width="8" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q4 0 8 6" fill="none" stroke="#ffffff" strokeWidth="0.9" />
        </pattern>
        <clipPath id={ids.clip}><path d={look.body} /></clipPath>
      </defs>
      <FinPart fin={look.tail} look={look} fill={`url(#${finGrad})`} part="tail" />
      <FinPart fin={look.dorsal} look={look} fill={`url(#${finGrad})`} />
      <FinPart fin={look.anal} look={look} fill={`url(#${finGrad})`} />
      <path d={look.body} fill={`url(#${bodyGrad})`} />
      <g clipPath={`url(#${ids.clip})`}>
        {look.pattern()}
        {look.scales ? <rect x="0" y="0" width="140" height="100" fill={`url(#${ids.scale})`} opacity="0.3" /> : null}
        <ellipse cx="74" cy="92" rx="56" ry="20" fill={look.outline} opacity="0.18" />
        <ellipse cx="80" cy="30" rx="40" ry="14" fill={`url(#${sheen})`} />
      </g>
      <path d={look.body} fill="none" stroke={look.outline} strokeWidth="2.4" strokeLinejoin="round" />
      {look.front?.()}
      <path d={look.gill} fill="none" stroke={look.outline} strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <g data-part="pectoral">
        <path d={look.pectoral} fill={look.fin} opacity="0.9" stroke={look.outline} strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <ellipse cx={cx - 2} cy={cy + r + 5} rx={r * 0.7} ry={r * 0.35} fill="#ff8fa3" opacity="0.45" />
      <circle cx={cx} cy={cy} r={r} fill="#fffefa" stroke={look.outline} strokeWidth="1.8" />
      <circle cx={cx + r * 0.18} cy={cy + r * 0.08} r={r * 0.68} fill={`url(#${iris})`} />
      <circle cx={cx + r * 0.38} cy={cy - r * 0.25} r={r * 0.28} fill="#fff" />
      <circle cx={cx - r * 0.12} cy={cy + r * 0.32} r={r * 0.12} fill="#fff" opacity="0.85" />
      <path d={look.mouth} fill={fishId === 'puffer' ? '#c4566a' : 'none'} stroke={look.outline} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default memo(FishArt)
