import { WRESTLERS } from './sumoGame'

/** Original paper cutouts, drawn in a 160 × 180 local coordinate system. */
export default function PaperWrestler({ index, belt = '#c85f50' }: { index: number; belt?: string }) {
  const wrestler = WRESTLERS[index]!
  const shape = wrestler.shape
  const outline = shape === 'cloud'
    ? 'M26 85 Q9 63 30 48 Q24 22 50 20 Q69 0 88 20 Q123 10 124 40 Q151 43 142 76 L145 127 Q142 151 114 153 L42 153 Q13 142 26 85Z'
    : shape === 'bean'
      ? 'M30 69 Q18 17 68 14 Q120 1 132 48 Q146 80 135 107 L140 130 Q135 151 109 153 L45 153 Q16 143 25 116Z'
      : 'M25 74 Q20 23 80 20 Q140 23 135 74 L144 122 Q147 147 115 153 L45 153 Q13 147 16 122Z'
  return (
    <g stroke="#655346" strokeWidth="3" strokeLinejoin="round">
      {shape === 'bear' && <g fill={wrestler.color}><circle cx="37" cy="29" r="20" /><circle cx="121" cy="29" r="20" /></g>}
      <path d={outline} fill={wrestler.color} />
      <path d="M47 151 L35 169 L72 169 L79 153 M83 153 L91 169 L128 169 L116 151" fill={wrestler.color} />
      <path d="M24 106 Q80 116 138 106 L141 128 Q80 140 20 128Z" fill={belt} stroke="none" />
      <path d="M70 115 L89 115 L89 146 L70 146Z" fill={belt} stroke="none" />
      <path d="M27 82 Q9 74 7 94 Q8 108 29 104 M132 82 Q151 74 153 94 Q152 108 132 104" fill={wrestler.color} />
      <g fill="#51473f" stroke="none"><ellipse cx="59" cy="66" rx="4" ry="6" /><ellipse cx="101" cy="66" rx="4" ry="6" /></g>
      <g fill={wrestler.accent} opacity=".6" stroke="none"><ellipse cx="43" cy="82" rx="11" ry="6" /><ellipse cx="117" cy="82" rx="11" ry="6" /></g>
      <path d="M69 81 Q80 95 91 81" fill="none" strokeLinecap="round" />
      <path d="M81 25 L81 108 M81 137 L81 151" fill="none" stroke="#655346" strokeWidth="1.5" opacity=".13" />
      {shape === 'mochi' && <path d="M62 24 Q80 6 98 24" fill={wrestler.accent} stroke="none" />}
      {shape === 'bean' && <path d="M78 20 Q68 -2 95 1 Q107 17 78 20" fill={wrestler.accent} stroke="none" />}
    </g>
  )
}
