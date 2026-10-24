import { CELL } from './boardLayout'
import type { Landmark, SceneryKind } from './courses'

const INK = '#4a3a33'

/** みちの あいだに ちらす こもの。まんなかが (0, 0) で、だいたい 60 くらいの おおきさ。 */
export function SceneryArt({ kind }: { kind: SceneryKind }) {
  switch (kind) {
    case 'tree':
      return (
        <g>
          <rect x={-5} y={6} width={10} height={20} rx={3} fill="#9a6a3f" />
          <circle cx={0} cy={-6} r={22} fill="#5daa4f" />
          <circle cx={-8} cy={-12} r={7} fill="#7cc46a" />
        </g>
      )
    case 'pine':
      return (
        <g>
          <rect x={-4} y={14} width={8} height={12} fill="#8a5d36" />
          <path d="M0 -30 L20 0 L10 0 L24 18 L-24 18 L-10 0 L-20 0 Z" fill="#3f8f4c" />
        </g>
      )
    case 'flower':
      return (
        <g>
          <path d="M0 4 Q-2 16 0 24" stroke="#4f9a45" strokeWidth={4} fill="none" strokeLinecap="round" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <circle key={angle} cx={Math.cos((angle * Math.PI) / 180) * 9} cy={Math.sin((angle * Math.PI) / 180) * 9 - 4} r={7} fill="#ff9fbf" />
          ))}
          <circle cx={0} cy={-4} r={6} fill="#ffd23f" />
        </g>
      )
    case 'mushroom':
      return (
        <g>
          <rect x={-7} y={0} width={14} height={18} rx={5} fill="#fff6e6" stroke="#c9a77d" strokeWidth={2} />
          <path d="M-22 4 Q-20 -22 0 -22 Q20 -22 22 4 Z" fill="#e0473f" />
          <circle cx={-8} cy={-10} r={4} fill="#fff" />
          <circle cx={8} cy={-6} r={3.5} fill="#fff" />
        </g>
      )
    case 'lollipop':
      return (
        <g>
          <rect x={-3} y={0} width={6} height={28} rx={3} fill="#fff" stroke="#e7c9d6" strokeWidth={1.5} />
          <circle cx={0} cy={-10} r={18} fill="#ff8fb8" />
          <path d="M0 -10 m-12 0 a12 12 0 1 1 12 12 a8 8 0 1 1 -8 -8" fill="none" stroke="#fff" strokeWidth={4} strokeLinecap="round" />
        </g>
      )
    case 'donut':
      return (
        <g>
          <circle r={20} fill="#e2a560" />
          <circle r={18} fill="#a8735a" />
          <circle r={6} fill="#ffd3e4" />
          {[20, 110, 200, 290].map((angle) => (
            <rect key={angle} x={-1.5} y={-14} width={3} height={7} rx={1.5} fill={angle % 180 === 20 ? '#fff38a' : '#8fe0ff'} transform={`rotate(${angle})`} />
          ))}
        </g>
      )
    case 'candy':
      return (
        <g>
          <path d="M-14 0 L-26 -10 L-26 10 Z M14 0 L26 -10 L26 10 Z" fill="#ffc24a" />
          <ellipse rx={15} ry={12} fill="#ffdf6b" />
          <path d="M-8 -9 L-2 9 M4 -10 L10 8" stroke="#ff8a3d" strokeWidth={3} />
        </g>
      )
    case 'cupcake':
      return (
        <g>
          <path d="M-16 0 L16 0 L11 22 L-11 22 Z" fill="#8fd0ff" />
          <path d="M-20 2 Q-22 -18 0 -20 Q22 -18 20 2 Z" fill="#fff4f8" />
          <circle cx={0} cy={-22} r={5} fill="#e0473f" />
        </g>
      )
    case 'wave':
      return <path d="M-26 4 Q-17 -8 -8 4 Q1 16 10 4 Q19 -8 28 4" fill="none" stroke="#ffffff" strokeWidth={5} strokeLinecap="round" opacity={0.75} />
    case 'fish':
      return (
        <g>
          <ellipse rx={16} ry={10} fill="#ffa34d" />
          <path d="M14 0 L28 -10 L28 10 Z" fill="#ffa34d" />
          <circle cx={-7} cy={-2} r={3} fill={INK} />
        </g>
      )
    case 'shell':
      return (
        <g>
          <path d="M-18 10 Q-20 -14 0 -16 Q20 -14 18 10 Z" fill="#ffd9c7" stroke="#e8a58a" strokeWidth={2} />
          <path d="M0 10 L0 -14 M-9 10 L-6 -12 M9 10 L6 -12" stroke="#e8a58a" strokeWidth={2} />
        </g>
      )
    case 'rock':
      return <path d="M-22 12 L-14 -10 L4 -16 L20 -2 L22 12 Z" fill="#9aa8b3" stroke="#7a8893" strokeWidth={2} strokeLinejoin="round" />
  }
}

/** おおきな めじるし。ひだりうえが (0, 0) で、w × h マスぶんに おさめる。 */
export function LandmarkArt({ landmark }: { landmark: Landmark }) {
  const width = landmark.w * CELL
  const height = landmark.h * CELL
  const cx = width / 2
  const cy = height / 2
  switch (landmark.kind) {
    case 'bigTree':
      return (
        <g>
          <rect x={cx - 14} y={cy + 10} width={28} height={70} rx={8} fill="#8a5d36" />
          <circle cx={cx} cy={cy - 10} r={62} fill="#4f9d45" />
          <circle cx={cx - 34} cy={cy + 14} r={34} fill="#5daa4f" />
          <circle cx={cx + 36} cy={cy + 10} r={32} fill="#5daa4f" />
          <circle cx={cx - 18} cy={cy - 34} r={16} fill="#7cc46a" />
          <circle cx={cx + 20} cy={cy - 6} r={7} fill="#e0473f" />
          <circle cx={cx - 22} cy={cy + 18} r={7} fill="#e0473f" />
        </g>
      )
    case 'pond':
      return (
        <g>
          <ellipse cx={cx} cy={cy} rx={width / 2 - 14} ry={height / 2 - 18} fill="#7fc8ee" stroke="#5fa8d6" strokeWidth={5} />
          <ellipse cx={cx - 50} cy={cy - 12} rx={22} ry={9} fill="#5daa4f" />
          <ellipse cx={cx + 46} cy={cy + 18} rx={18} ry={8} fill="#5daa4f" />
          <path d={`M${cx - 20} ${cy + 4} q14 -12 28 0`} stroke="#fff" strokeWidth={4} fill="none" strokeLinecap="round" opacity={0.8} />
        </g>
      )
    case 'bearHouse':
      return (
        <g>
          <rect x={cx - 60} y={cy - 10} width={120} height={80} rx={6} fill="#d9a066" stroke={INK} strokeWidth={3} />
          <path d={`M${cx - 76} ${cy - 6} L${cx} ${cy - 72} L${cx + 76} ${cy - 6} Z`} fill="#c0503f" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <rect x={cx - 16} y={cy + 24} width={32} height={46} rx={14} fill="#8a5d36" stroke={INK} strokeWidth={3} />
          <rect x={cx + 26} y={cy + 6} width={24} height={22} rx={4} fill="#fff6c8" stroke={INK} strokeWidth={3} />
        </g>
      )
    case 'castle':
      return (
        <g>
          <rect x={cx - 150} y={cy - 20} width={300} height={90} rx={10} fill="#ffe6ef" stroke="#d987a6" strokeWidth={4} />
          {[-120, 120].map((dx) => (
            <g key={dx}>
              <rect x={cx + dx - 26} y={cy - 70} width={52} height={130} rx={8} fill="#fff4f8" stroke="#d987a6" strokeWidth={4} />
              <path d={`M${cx + dx - 34} ${cy - 66} L${cx + dx} ${cy - 112} L${cx + dx + 34} ${cy - 66} Z`} fill="#ff8fb8" stroke="#d987a6" strokeWidth={4} strokeLinejoin="round" />
            </g>
          ))}
          <path d={`M${cx - 60} ${cy - 20} L${cx} ${cy - 92} L${cx + 60} ${cy - 20} Z`} fill="#a8735a" stroke="#7d5240" strokeWidth={4} strokeLinejoin="round" />
          <path d={`M${cx - 150} ${cy - 10} q25 18 50 0 q25 18 50 0 q25 18 50 0 q25 18 50 0 q25 18 50 0 q25 18 50 0`} fill="none" stroke="#fff" strokeWidth={8} strokeLinecap="round" />
          <rect x={cx - 22} y={cy + 20} width={44} height={50} rx={20} fill="#c97a5a" stroke="#7d5240" strokeWidth={4} />
          <circle cx={cx} cy={cy - 96} r={10} fill="#e0473f" />
        </g>
      )
    case 'island':
    case 'palmIsland':
      return (
        <g>
          <ellipse cx={cx} cy={cy + 14} rx={width / 2 - 10} ry={height / 2 - 30} fill="#f3dca8" stroke="#e2bf86" strokeWidth={4} />
          <ellipse cx={cx} cy={cy + 6} rx={width / 2 - 30} ry={height / 2 - 46} fill="#8fd07a" />
          {landmark.kind === 'palmIsland' && (
            <g transform={`translate(${cx + 10} ${cy})`}>
              <path d="M0 10 Q-6 -30 6 -64" stroke="#8a5d36" strokeWidth={10} fill="none" strokeLinecap="round" />
              {[-150, -100, -40, 10].map((angle) => (
                <ellipse key={angle} cx={6} cy={-64} rx={34} ry={10} fill="#3f8f4c" transform={`rotate(${angle} 6 -64) translate(28 0)`} />
              ))}
            </g>
          )}
        </g>
      )
    case 'ship':
      return (
        <g>
          <path d={`M${cx - 70} ${cy + 20} L${cx + 70} ${cy + 20} L${cx + 50} ${cy + 56} L${cx - 50} ${cy + 56} Z`} fill="#c0503f" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M${cx} ${cy + 20} L${cx} ${cy - 70}`} stroke={INK} strokeWidth={5} />
          <path d={`M${cx + 4} ${cy - 66} L${cx + 60} ${cy + 8} L${cx + 4} ${cy + 8} Z`} fill="#fffdf8" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M${cx - 4} ${cy - 50} L${cx - 44} ${cy + 8} L${cx - 4} ${cy + 8} Z`} fill="#ffe58a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )
    case 'lighthouse':
      return (
        <g>
          <path d={`M${cx - 26} ${cy + 80} L${cx - 16} ${cy - 50} L${cx + 16} ${cy - 50} L${cx + 26} ${cy + 80} Z`} fill="#fffdf8" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
          <path d={`M${cx - 22} ${cy + 30} L${cx + 22} ${cy + 30} L${cx + 20} ${cy + 4} L${cx - 20} ${cy + 4} Z M${cx - 18} ${cy - 22} L${cx + 18} ${cy - 22} L${cx + 17} ${cy - 40} L${cx - 17} ${cy - 40} Z`} fill="#e0473f" />
          <rect x={cx - 18} y={cy - 74} width={36} height={24} rx={4} fill="#ffe58a" stroke={INK} strokeWidth={3} />
          <path d={`M${cx - 24} ${cy - 74} L${cx} ${cy - 92} L${cx + 24} ${cy - 74} Z`} fill="#c0503f" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        </g>
      )
  }
}
