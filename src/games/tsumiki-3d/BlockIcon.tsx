import type { BlockShapeId } from './blocks'

/** えらぶ ボタン の つみき えのぐ。ひかり と かげ の 3めん で たてもの ふうに みせる。 */
function shade(hex: string, amount: number) {
  const value = parseInt(hex.slice(1), 16)
  const channel = (shift: number) => {
    const c = (value >> shift) & 255
    const next = amount > 0 ? c + (255 - c) * amount : c * (1 + amount)
    return Math.round(Math.max(0, Math.min(255, next)))
  }
  return `rgb(${channel(16)} ${channel(8)} ${channel(0)})`
}

export default function BlockIcon({ shape, color, size = 44 }: { shape: BlockShapeId; color: string; size?: number }) {
  const top = shade(color, 0.35)
  const front = color
  const side = shade(color, -0.28)
  const stroke = shade(color, -0.5)
  const common = { stroke, strokeWidth: 1.6, strokeLinejoin: 'round' as const }
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <ellipse cx="24" cy="43" rx="17" ry="3.2" fill="rgba(80,50,20,.16)" />
      {shape === 'cube' && <>
        <path d="M10 17 L24 10 L38 17 L24 24 Z" fill={top} {...common} />
        <path d="M10 17 L24 24 L24 40 L10 33 Z" fill={front} {...common} />
        <path d="M38 17 L24 24 L24 40 L38 33 Z" fill={side} {...common} />
      </>}
      {shape === 'plank' && <>
        <path d="M3 25 L27 15 L45 22 L21 32 Z" fill={top} {...common} />
        <path d="M3 25 L21 32 L21 39 L3 32 Z" fill={front} {...common} />
        <path d="M45 22 L21 32 L21 39 L45 29 Z" fill={side} {...common} />
      </>}
      {shape === 'pillar' && <>
        <path d="M13 11 L13 37 A11 4.5 0 0 0 35 37 L35 11 Z" fill={front} {...common} />
        <path d="M24 11 L35 11 L35 37 A11 4.5 0 0 1 24 41.5 Z" fill={side} stroke="none" />
        <path d="M13 11 L13 37 A11 4.5 0 0 0 35 37 L35 11" fill="none" {...common} />
        <ellipse cx="24" cy="11" rx="11" ry="4.5" fill={top} {...common} />
      </>}
      {shape === 'roof' && <>
        <path d="M15 14 L33 6 L43 30 L25 38 Z" fill={top} {...common} />
        <path d="M5 38 L15 14 L25 38 Z" fill={front} {...common} />
      </>}
      {shape === 'arch' && <>
        <path d="M4 20 L26 12 L44 18 L22 26 Z" fill={top} {...common} />
        <path d="M4 20 L22 26 L22 41 L17 39 L17 35 A4.5 5 0 0 0 9 32 L9 36 L4 34 Z" fill={front} {...common} />
        <path d="M44 18 L22 26 L22 41 L44 33 Z" fill={side} {...common} />
      </>}
      {shape === 'cone' && <>
        <path d="M24 5 L36 36 A12 5 0 0 1 12 36 Z" fill={front} {...common} />
        <path d="M24 5 L36 36 A12 5 0 0 1 24 41 Z" fill={side} stroke="none" />
        <path d="M24 5 L36 36 A12 5 0 0 1 12 36 Z" fill="none" {...common} />
      </>}
    </svg>
  )
}
