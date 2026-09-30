import styles from './AnimalBathPlay.module.css'

/** Shared gradients for the bath scene. The bath SVG is the only one on screen, so fixed ids are safe. */
export function BathDefs() {
  return <defs>
    <linearGradient id="bath-wall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#dff7f6" /><stop offset="1" stopColor="#b3e2e6" />
    </linearGradient>
    <pattern id="bath-tiles" width="50" height="50" patternUnits="userSpaceOnUse">
      <rect x="2" y="2" width="46" height="46" rx="7" fill="#fff" opacity=".32" />
      <path d="M8 9 Q9 5 14 5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".7" />
    </pattern>
    <linearGradient id="bath-floor" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#8fcbd0" /><stop offset="1" stopColor="#77b8be" />
    </linearGradient>
    <linearGradient id="bath-tub" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stopColor="#e5eff0" /><stop offset=".25" stopColor="#fffdf8" /><stop offset=".7" stopColor="#fbf5ea" /><stop offset="1" stopColor="#dae8ea" />
    </linearGradient>
    <linearGradient id="bath-water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#c9f3ff" stopOpacity=".7" /><stop offset="1" stopColor="#5fc0dd" stopOpacity=".8" />
    </linearGradient>
    <radialGradient id="bath-foam" cx=".38" cy=".32" r=".75">
      <stop offset="0" stopColor="#fff" /><stop offset=".65" stopColor="#f7fbfd" /><stop offset="1" stopColor="#d4e8ef" />
    </radialGradient>
    <radialGradient id="bath-bubble" cx=".5" cy=".5" r=".5">
      <stop offset="0" stopColor="#fff" stopOpacity=".08" /><stop offset=".78" stopColor="#e8f8ff" stopOpacity=".28" />
      <stop offset=".93" stopColor="#b4e1f3" stopOpacity=".75" /><stop offset="1" stopColor="#9ed3ea" stopOpacity=".9" />
    </radialGradient>
    <linearGradient id="bath-drop" x1=".2" y1="0" x2=".8" y2="1">
      <stop offset="0" stopColor="#e4f9ff" stopOpacity=".85" /><stop offset="1" stopColor="#58b9e6" stopOpacity=".9" />
    </linearGradient>
    <radialGradient id="bath-glow">
      <stop offset="0" stopColor="#fff6c2" stopOpacity=".95" /><stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
    </radialGradient>
    <linearGradient id="bath-soap" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#fbd3e4" /><stop offset="1" stopColor="#e99bbd" />
    </linearGradient>
    <linearGradient id="bath-chrome" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor="#f4fafc" /><stop offset=".5" stopColor="#b9cdd4" /><stop offset="1" stopColor="#8aa3ac" />
    </linearGradient>
  </defs>
}

/** One see-through soap bubble with a rim, a window highlight and a faint rainbow sheen. */
export function Bubble({ x, y, r }: { x: number; y: number; r: number }) {
  return <g>
    <circle cx={x} cy={y} r={r} fill="url(#bath-bubble)" />
    <path d={`M${x - r * 0.62} ${y - r * 0.2} A${r * 0.66} ${r * 0.66} 0 0 1 ${x - r * 0.1} ${y - r * 0.64}`} fill="none" stroke="#fff" strokeWidth={Math.max(1.2, r * 0.18)} strokeLinecap="round" opacity=".9" />
    <path d={`M${x + r * 0.72} ${y + r * 0.1} A${r * 0.74} ${r * 0.74} 0 0 1 ${x + r * 0.1} ${y + r * 0.72}`} fill="none" stroke="#f2b7e6" strokeWidth={Math.max(1, r * 0.1)} strokeLinecap="round" opacity=".55" />
  </g>
}

/** Soft, lumpy lather: an outline pass under gradient-filled puffs gives one merged silhouette. */
export function Foam({ seed = 0, puffs }: { seed?: number; puffs?: readonly (readonly [number, number, number])[] }) {
  const lumps = puffs ?? [[-14, 3, 15], [8, 7, 16], [-1, -10, 15], [19, -6, 11], [-24, -7, 9], [4, 18, 10], [-12, 16, 9]] as const
  return <g transform={`rotate(${seed * 53 % 40 - 20}) scale(${seed % 2 ? -1 : 1} 1)`}>
    <ellipse cx="2" cy="12" rx="30" ry="14" fill="#6aa3b8" opacity=".16" />
    {lumps.map(([x, y, r], index) => <circle key={`o${index}`} cx={x} cy={y} r={r + 1.8} fill="#bcdbe6" />)}
    {lumps.map(([x, y, r], index) => <circle key={index} cx={x} cy={y} r={r} fill="url(#bath-foam)" />)}
    <Bubble x={20} y={-19} r={7} /><Bubble x={-26} y={-19} r={4.5} /><Bubble x={27} y={9} r={4} />
    <circle cx="-6" cy="-15" r="3.2" fill="#fff" /><circle cx="-18" cy="-2" r="2" fill="#fff" />
  </g>
}

const DROP = 'M0 -20 C-4 -10 -13 -2 -13 7 C-13 15 -7 20 0 20 C7 20 13 15 13 7 C13 -2 4 -10 0 -20 Z'

function Drop({ x, y, s }: { x: number; y: number; s: number }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path d={DROP} fill="url(#bath-drop)" stroke="#3f9fcf" strokeWidth={1.6 / s} />
    <path d="M-6 3 Q-7 11 -1 13" fill="none" stroke="#fff" strokeWidth={3 / s} strokeLinecap="round" opacity=".9" />
  </g>
}

/** Rinsed fur: a darker damp patch with a few beads of water instead of one big cartoon drop. */
export function Wet({ seed = 0 }: { seed?: number }) {
  const flip = seed % 2 ? -1 : 1
  return <g transform={`scale(${flip} 1)`}>
    <ellipse cx="0" cy="2" rx="24" ry="18" fill="#1d5a78" opacity=".1" />
    <ellipse cx="-7" cy="-4" rx="10" ry="4" fill="#fff" opacity=".35" transform="rotate(-25 -7 -4)" />
    <Drop x={9} y={-2} s={0.5} /><Drop x={-10} y={12} s={0.36} />
    <circle cx="10" cy="15" r="2.6" fill="#8fd6f2" stroke="#3f9fcf" strokeWidth="1" />
  </g>
}

export function Sparkle({ seed = 0 }: { seed?: number }) {
  const star = (size: number) => `M0 ${-size} Q${size * 0.18} ${-size * 0.18} ${size} 0 Q${size * 0.18} ${size * 0.18} 0 ${size} Q${-size * 0.18} ${size * 0.18} ${-size} 0 Q${-size * 0.18} ${-size * 0.18} 0 ${-size} Z`
  return <g className={styles.sparkle}>
    <circle r="22" fill="url(#bath-glow)" />
    <path d={star(17)} fill="#ffd54d" stroke="#f0a91a" strokeWidth="1.5" strokeLinejoin="round" />
    <circle r="3.5" fill="#fffbe6" />
    <path d={star(6)} transform={`translate(${seed % 2 ? -16 : 16} -14)`} fill="#fff4b8" stroke="#f0b73a" strokeWidth="1" />
  </g>
}

export function Backdrop() {
  return <g>
    {/* Painted past the viewBox so letterboxing on tall or wide screens still shows wall and floor. */}
    <rect x="-400" y="-400" width="1200" height="800" fill="#dff7f6" />
    <rect x="-400" width="1200" height="400" fill="url(#bath-wall)" />
    <rect x="-400" y="-400" width="1200" height="740" fill="url(#bath-tiles)" />
    <ellipse cx="70" cy="40" rx="120" ry="80" fill="#fff" opacity=".28" />
    <rect x="-400" y="338" width="1200" height="400" fill="url(#bath-floor)" />
    <path d="M-400 338 H800" stroke="#6eb0b6" strokeWidth="3" />
    <path d="M60 400 L90 338 M170 400 L180 338 M230 400 L220 338 M340 400 L310 338" stroke="#fff" strokeWidth="2" opacity=".25" />
    {/* shelf with shampoo */}
    <path d="M14 78 H84" stroke="#e8c79b" strokeWidth="7" strokeLinecap="round" />
    <path d="M24 74 V46 Q24 38 32 38 H42 Q50 38 50 46 V74 Z" fill="#9fdcb4" stroke="#5aa27a" strokeWidth="2.5" />
    <rect x="31" y="28" width="12" height="11" rx="2" fill="#ffd36e" stroke="#c99a36" strokeWidth="2" />
    <rect x="28" y="52" width="18" height="12" rx="3" fill="#fff" opacity=".75" />
    <path d="M56 74 V58 Q56 52 62 52 H70 Q76 52 76 58 V74 Z" fill="#f7b6cf" stroke="#c7759a" strokeWidth="2.5" />
    {/* shower on the wall */}
    <path d="M400 34 H356 Q344 34 344 46 V58" fill="none" stroke="url(#bath-chrome)" strokeWidth="8" strokeLinecap="round" />
    <path d="M326 60 H362 L356 72 H332 Z" fill="url(#bath-chrome)" stroke="#7d949c" strokeWidth="2" strokeLinejoin="round" />
    <g fill="#7d949c"><circle cx="338" cy="68" r="1.6" /><circle cx="344" cy="68" r="1.6" /><circle cx="350" cy="68" r="1.6" /></g>
    <g className={styles.floating}><Bubble x={46} y={132} r={12} /><Bubble x={360} y={150} r={16} /><Bubble x={378} y={112} r={7} /></g>
  </g>
}

export function TubBack() {
  return <g>
    <ellipse cx="200" cy="378" rx="176" ry="14" fill="#3f7f86" opacity=".22" />
    <ellipse cx="200" cy="322" rx="170" ry="20" fill="#fffdf8" stroke="#7fb5bf" strokeWidth="3.5" />
    <ellipse cx="200" cy="323" rx="160" ry="15" fill="#c3e8ee" />
  </g>
}

function Duck() {
  return <g transform="translate(78 318)">
    <ellipse cx="0" cy="9" rx="20" ry="4" fill="#3d8fa6" opacity=".25" />
    <path d="M-17 0 Q-18 10 -4 10 H12 Q20 9 19 -2 Q12 2 6 -1 Z" fill="#ffd43b" stroke="#d99a12" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="-9" cy="-9" r="9" fill="#ffd43b" stroke="#d99a12" strokeWidth="2" />
    <path d="M-17 -8 L-25 -6 L-17 -3 Z" fill="#ff9a3c" stroke="#d9711a" strokeWidth="1.5" strokeLinejoin="round" />
    <circle cx="-11" cy="-11" r="1.8" fill="#3f2f27" />
    <path d="M-2 1 Q4 -3 10 1" fill="none" stroke="#d99a12" strokeWidth="2" strokeLinecap="round" />
  </g>
}

/** Water, lather and the tub's front wall, drawn over the animal so it sits in the bath. */
export function TubFront({ finished }: { finished: boolean }) {
  return <g>
    <ellipse cx="200" cy="323" rx="160" ry="15" fill="url(#bath-water)" />
    <path d="M70 322 Q110 328 150 324 M250 326 Q290 328 330 321" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" opacity=".7" />
    <g transform="translate(62 322)"><Foam puffs={[[0, 0, 12], [18, 3, 10], [-12, 4, 8], [30, 6, 7]]} /></g>
    <g transform="translate(330 320)"><Foam seed={1} puffs={[[0, 0, 13], [-18, 4, 10], [14, 4, 9], [-30, 6, 6]]} /></g>
    <Duck />
    <path d="M30 322 A170 20 0 0 0 370 322 L354 368 Q200 396 46 368 Z" fill="url(#bath-tub)" stroke="#7fb5bf" strokeWidth="3.5" strokeLinejoin="round" />
    <path d="M34 324 A166 18 0 0 0 366 324" fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" />
    <path d="M62 350 Q200 372 338 350" fill="none" stroke="#bfe3e8" strokeWidth="3" strokeLinecap="round" opacity=".8" />
    <g fill="#f3c653" stroke="#c4922a" strokeWidth="2.5" strokeLinejoin="round">
      <path d="M70 372 Q66 388 58 392 H86 Q82 384 84 375 Z" /><path d="M330 372 Q334 388 342 392 H314 Q318 384 316 375 Z" />
    </g>
    {finished && <g className={styles.hearts} fill="#ff8fab" stroke="#e0567c" strokeWidth="2" strokeLinejoin="round">
      {[[74, 206, 1], [330, 190, 1.2], [94, 112, 0.8], [310, 96, 0.9]].map(([x, y, s], index) =>
        <path key={index} transform={`translate(${x} ${y}) scale(${s})`} d="M0 10 C-18 -2 -14 -18 -4 -16 C-1 -15 0 -12 0 -10 C0 -12 1 -15 4 -16 C14 -18 18 -2 0 10 Z" />)}
    </g>}
  </g>
}

function Soap() {
  return <g>
    <rect x="-24" y="-16" width="48" height="32" rx="12" fill="url(#bath-soap)" stroke="#b9658b" strokeWidth="2.5" />
    <rect x="-16" y="-9" width="32" height="14" rx="7" fill="#fff" opacity=".35" />
    <path d="M-16 -10 Q-6 -14 6 -12" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".8" />
  </g>
}

function ShowerHead() {
  return <g>
    <path d="M22 -34 Q34 -44 44 -58" fill="none" stroke="url(#bath-chrome)" strokeWidth="9" strokeLinecap="round" />
    <path d="M-2 -30 Q10 -46 30 -34 L20 -18 Q10 -26 4 -16 Z" fill="url(#bath-chrome)" stroke="#6f878f" strokeWidth="2" strokeLinejoin="round" />
  </g>
}

function Towel() {
  return <g>
    <rect x="-26" y="-20" width="52" height="40" rx="8" fill="#f8bdd4" stroke="#b25f85" strokeWidth="2.5" />
    <path d="M-25 6 H25 M-25 12 H25" stroke="#fff" strokeWidth="3.5" />
    <path d="M-20 -14 Q-6 -18 8 -15" stroke="#fff" strokeWidth="3" strokeLinecap="round" fill="none" opacity=".7" />
    <path d="M-20 20 V25 M-12 20 V25 M-4 20 V25 M4 20 V25 M12 20 V25 M20 20 V25" stroke="#b25f85" strokeWidth="2" strokeLinecap="round" />
  </g>
}

/** Small control icon; its gradients resolve from the bath scene's defs, which is always mounted alongside. */
export function ToolArt({ step }: { step: number }) {
  return <svg viewBox="-30 -32 60 64" width="30" height="30" aria-hidden="true">
    {step === 0 ? <Soap /> : step === 1 ? <g transform="translate(-14 26) scale(.95)"><ShowerHead />
      <path d="M4 -12 L0 0 M12 -10 L10 2 M18 -6 L20 4" stroke="#56b4e0" strokeWidth="3" strokeLinecap="round" /></g> : <Towel />}
  </svg>
}

/** Tool that follows the finger; the shower rains onto the touched spot. */
export function ToolCursor({ step, x, y }: { step: number; x: number; y: number }) {
  return <g transform={`translate(${x} ${y})`} pointerEvents="none">
    <circle r="34" fill="#fff" opacity=".28" />
    {step === 0 ? <g transform="translate(26 -26) rotate(-14)">
      <Soap /><Bubble x={-26} y={-18} r={7} /><Bubble x={24} y={-20} r={5} /><Bubble x={-30} y={4} r={4} />
    </g> : step === 1 ? <g transform="translate(6 -30)">
      <g className={styles.stream} stroke="#7fd2f2" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="7 9" opacity=".9">
        <path d="M2 -18 L-6 26" /><path d="M10 -18 L6 30" /><path d="M18 -16 L18 28" /><path d="M24 -12 L28 24" />
      </g>
      <ShowerHead />
      <g fill="#bfeeff" stroke="#56b4e0" strokeWidth="1"><circle cx="-16" cy="34" r="3" /><circle cx="26" cy="36" r="2.5" /><circle cx="-4" cy="40" r="2" /></g>
    </g> : <g transform="translate(24 -30) rotate(12)"><Towel /></g>}
  </g>
}
