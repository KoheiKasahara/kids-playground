import type { PieceId } from './courses'

const INK = '#4a3a33'

function Eyes({ y = -2, gap = 7 }: { y?: number; gap?: number }) {
  return (
    <g fill={INK}>
      <circle cx={-gap} cy={y} r={2.6} />
      <circle cx={gap} cy={y} r={2.6} />
      <circle cx={-gap + 0.9} cy={y - 0.9} r={0.9} fill="#fff" />
      <circle cx={gap + 0.9} cy={y - 0.9} r={0.9} fill="#fff" />
    </g>
  )
}

function Cheeks({ y = 5, gap = 11, color = '#f6a3b6' }: { y?: number; gap?: number; color?: string }) {
  return (
    <g fill={color} opacity={0.8}>
      <ellipse cx={-gap} cy={y} rx={3.6} ry={2.4} />
      <ellipse cx={gap} cy={y} rx={3.6} ry={2.4} />
    </g>
  )
}

function Face({ id }: { id: PieceId }) {
  switch (id) {
    case 'usagi':
      return (
        <g stroke={INK} strokeWidth={2}>
          <ellipse cx={-7.5} cy={-25} rx={6} ry={15} fill="#fff7f8" transform="rotate(-8 -7.5 -25)" />
          <ellipse cx={7.5} cy={-25} rx={6} ry={15} fill="#fff7f8" transform="rotate(8 7.5 -25)" />
          <ellipse cx={-7.5} cy={-24} rx={2.6} ry={10} fill="#f7b3c3" stroke="none" transform="rotate(-8 -7.5 -24)" />
          <ellipse cx={7.5} cy={-24} rx={2.6} ry={10} fill="#f7b3c3" stroke="none" transform="rotate(8 7.5 -24)" />
          <circle r={18} fill="#fff7f8" />
          <g stroke="none"><Eyes /><Cheeks /></g>
          <path d="M-2.5 4 L2.5 4 L0 7 Z" fill="#e0587f" stroke="none" />
          <path d="M0 7 Q-3 10 -5 9 M0 7 Q3 10 5 9" fill="none" strokeWidth={1.4} />
        </g>
      )
    case 'kuma':
      return (
        <g stroke={INK} strokeWidth={2}>
          <circle cx={-13} cy={-13} r={7} fill="#b9814f" />
          <circle cx={13} cy={-13} r={7} fill="#b9814f" />
          <circle cx={-13} cy={-13} r={3.4} fill="#e8c39a" stroke="none" />
          <circle cx={13} cy={-13} r={3.4} fill="#e8c39a" stroke="none" />
          <circle r={18} fill="#b9814f" />
          <ellipse cy={6} rx={9} ry={7} fill="#f0d6b4" />
          <g stroke="none"><Eyes y={-4} /></g>
          <ellipse cy={3} rx={3.4} ry={2.4} fill={INK} stroke="none" />
          <path d="M0 5.5 L0 8 M0 8 Q-3 10.5 -5 9 M0 8 Q3 10.5 5 9" fill="none" strokeWidth={1.4} />
        </g>
      )
    case 'neko':
      return (
        <g stroke={INK} strokeWidth={2} strokeLinejoin="round">
          <path d="M-17 -6 L-14 -24 L-3 -15 Z" fill="#f4b04c" />
          <path d="M17 -6 L14 -24 L3 -15 Z" fill="#f4b04c" />
          <path d="M-13.5 -10 L-12.5 -19 L-7 -14.5 Z" fill="#f7c9b8" stroke="none" />
          <path d="M13.5 -10 L12.5 -19 L7 -14.5 Z" fill="#f7c9b8" stroke="none" />
          <circle r={18} fill="#f4b04c" />
          <path d="M-6 -17 L-4 -10 M0 -18 L0 -11 M6 -17 L4 -10" stroke="#d98a24" strokeWidth={2.4} strokeLinecap="round" />
          <g stroke="none"><Eyes /><Cheeks color="#f39a8a" /></g>
          <path d="M-2.2 3.5 L2.2 3.5 L0 6 Z" fill="#d9706a" stroke="none" />
          <path d="M0 6 Q-3 9 -5.5 7.5 M0 6 Q3 9 5.5 7.5 M-8 3 L-19 1 M-8 6 L-19 7 M8 3 L19 1 M8 6 L19 7" fill="none" strokeWidth={1.2} strokeLinecap="round" />
        </g>
      )
    case 'kaeru':
      return (
        <g stroke={INK} strokeWidth={2}>
          <circle cx={-9} cy={-14} r={8} fill="#7ccf6a" />
          <circle cx={9} cy={-14} r={8} fill="#7ccf6a" />
          <ellipse cy={1} rx={20} ry={16} fill="#7ccf6a" />
          <circle cx={-9} cy={-14} r={4.6} fill="#fff" stroke="none" />
          <circle cx={9} cy={-14} r={4.6} fill="#fff" stroke="none" />
          <circle cx={-8.4} cy={-13.4} r={2.5} fill={INK} stroke="none" />
          <circle cx={9.6} cy={-13.4} r={2.5} fill={INK} stroke="none" />
          <g stroke="none"><Cheeks y={4} gap={12} /></g>
          <path d="M-9 4 Q0 12 9 4" fill="none" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )
  }
}

/**
 * すごろくの コマ（どうぶつの かおと、プレイヤーの いろの だいざ）。
 * まんなかが (0, 0) で、だいざを ふくめて たかさ およそ 60。
 */
export default function PieceArt({ id, color }: { id: PieceId; color: string }) {
  return (
    <g data-piece-art={id}>
      <ellipse cy={20} rx={21} ry={8} fill="rgb(0 0 0 / .18)" />
      <ellipse cy={17} rx={20} ry={7.5} fill={color} stroke={INK} strokeWidth={2} />
      <Face id={id} />
    </g>
  )
}

/** ボタンや ふだの なかに おく ちいさな コマ。 */
export function PieceIcon({ id, color, className }: { id: PieceId; color: string; className?: string }) {
  return (
    <svg className={className} viewBox="-26 -42 52 72" aria-hidden="true">
      <PieceArt id={id} color={color} />
    </svg>
  )
}
