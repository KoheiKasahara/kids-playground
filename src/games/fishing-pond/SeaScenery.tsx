import { memo, type CSSProperties } from 'react'
import styles from './FishingPondPlay.module.css'
import { BOAT_BOX } from './sceneLayout'

const boatStyle: CSSProperties = {
  left: `${BOAT_BOX.left * 100}%`,
  top: `${BOAT_BOX.top * 100}%`,
  width: `${BOAT_BOX.width * 100}%`,
  height: `${BOAT_BOX.height * 100}%`,
}

function Boat() {
  return (
    <svg className={styles.boat} style={boatStyle} viewBox="0 0 200 120" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="fp-hull" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6a65c" />
          <stop offset="1" stopColor="#b8642f" />
        </linearGradient>
        <linearGradient id="fp-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6fb8ff" />
          <stop offset="1" stopColor="#3a7fd6" />
        </linearGradient>
      </defs>
      {/* 竿（体の後ろ） */}
      <path d="M86 84 L150 40" stroke="#7a4b26" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M150 40 L196 6" stroke="#9b6a3c" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="196" cy="6" r="2" fill="#ff6b6b" />
      {/* バケツ */}
      <path d="M30 60 L34 80 H52 L56 60Z" fill="#7cc4e8" stroke="#3d7896" strokeWidth="2" strokeLinejoin="round" />
      <ellipse cx="43" cy="60" rx="13" ry="3.5" fill="#bfe6f7" stroke="#3d7896" strokeWidth="2" />
      <path d="M38 58 Q36 48 30 46 Q36 44 40 50 Q42 46 46 44 Q44 50 42 58Z" fill="#ff9b4d" stroke="#9c4a12" strokeWidth="1.4" />
      {/* こども（くま） */}
      <ellipse cx="88" cy="70" rx="17" ry="15" fill="url(#fp-shirt)" stroke="#2c5f9e" strokeWidth="2" />
      <circle cx="73" cy="26" r="6" fill="#f2c79a" stroke="#9a6a42" strokeWidth="2" />
      <circle cx="101" cy="26" r="6" fill="#f2c79a" stroke="#9a6a42" strokeWidth="2" />
      <circle cx="87" cy="40" r="17" fill="#f6d2a8" stroke="#9a6a42" strokeWidth="2" />
      <ellipse cx="92" cy="47" rx="8" ry="6" fill="#fff0dc" />
      <circle cx="82" cy="38" r="2.4" fill="#3b2a20" />
      <circle cx="96" cy="38" r="2.4" fill="#3b2a20" />
      <circle cx="82.8" cy="37.2" r="0.8" fill="#fff" />
      <circle cx="96.8" cy="37.2" r="0.8" fill="#fff" />
      <ellipse cx="92" cy="44" rx="2.6" ry="2" fill="#5a3a28" />
      <path d="M88 49 Q92 52 96 49" fill="none" stroke="#5a3a28" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="77" cy="45" rx="3.5" ry="2.2" fill="#ff9aa8" opacity="0.6" />
      <ellipse cx="102" cy="45" rx="3.5" ry="2.2" fill="#ff9aa8" opacity="0.6" />
      {/* むぎわらぼうし */}
      <ellipse cx="87" cy="25" rx="26" ry="6" fill="#f7d67a" stroke="#b88a2a" strokeWidth="2" />
      <path d="M72 24 Q72 8 87 8 Q102 8 102 24Z" fill="#f9e08f" stroke="#b88a2a" strokeWidth="2" />
      <path d="M72.5 20 H101.5" stroke="#e8555b" strokeWidth="3.5" />
      {/* うで */}
      <path d="M98 66 Q110 66 116 62" fill="none" stroke="#3a7fd6" strokeWidth="7" strokeLinecap="round" />
      <circle cx="117" cy="61" r="5" fill="#f6d2a8" stroke="#9a6a42" strokeWidth="1.8" />
      <circle cx="108" cy="72" r="4.5" fill="#e0e6ea" stroke="#6d7c86" strokeWidth="1.8" />
      {/* ふね */}
      <path d="M6 76 H176 Q170 102 148 112 H40 Q16 104 6 76Z" fill="url(#fp-hull)" stroke="#7a4220" strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 88 H170 M20 100 H160" stroke="#a65a2a" strokeWidth="1.6" opacity="0.6" />
      <path d="M4 72 H178 V80 H4Z" fill="#ffdca8" stroke="#7a4220" strokeWidth="2.4" strokeLinejoin="round" />
      <path d="M10 92 H168" stroke="#fff4dc" strokeWidth="5" opacity="0.85" />
      <circle cx="150" cy="96" r="5" fill="#fff4dc" stroke="#7a4220" strokeWidth="2" />
      <circle cx="150" cy="96" r="2" fill="#7a4220" />
    </svg>
  )
}

function Island() {
  return (
    <svg className={styles.island} viewBox="0 0 120 80" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <ellipse cx="62" cy="76" rx="56" ry="10" fill="#f1dc9f" />
      <ellipse cx="62" cy="74" rx="44" ry="7" fill="#f8e9bd" />
      <path d="M66 74 Q60 50 70 24" fill="none" stroke="#8a5a2e" strokeWidth="6" strokeLinecap="round" />
      <path d="M66 74 Q60 50 70 24" fill="none" stroke="#b07a44" strokeWidth="2" strokeDasharray="3 4" />
      <g fill="#3fae6a" stroke="#22744a" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M70 24 Q50 10 34 22 Q50 18 70 26Z" />
        <path d="M70 24 Q90 8 108 20 Q90 18 70 26Z" />
        <path d="M70 24 Q58 26 48 44 Q60 32 70 26Z" />
        <path d="M70 24 Q84 28 92 46 Q80 32 70 26Z" />
        <path d="M70 24 Q66 6 78 2 Q72 12 72 24Z" />
      </g>
      <circle cx="67" cy="27" r="3" fill="#8a5a2e" />
      <circle cx="73" cy="28" r="3" fill="#7a4b26" />
    </svg>
  )
}

function Cloud({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 100 40" aria-hidden="true" focusable="false">
      <path d="M12 34 Q2 34 4 26 Q6 18 16 20 Q18 8 32 10 Q40 0 54 6 Q66 2 70 14 Q84 10 88 22 Q98 24 94 32 Q92 36 84 36 H14Z" fill="#ffffff" opacity="0.92" />
      <path d="M14 34 H86" stroke="#d7eefb" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const SEAWEED = [
  { left: '6%', height: '24%', delay: '0s', color: '#3faf6a' },
  { left: '11%', height: '17%', delay: '-1.2s', color: '#5cc77f' },
  { left: '57%', height: '20%', delay: '-0.6s', color: '#2f9b5d' },
  { left: '90%', height: '26%', delay: '-1.8s', color: '#46b874' },
]
const BUBBLES = [
  { left: '22%', size: 8, delay: '0s', duration: '6s' },
  { left: '38%', size: 5, delay: '-2s', duration: '5s' },
  { left: '66%', size: 10, delay: '-3.5s', duration: '7s' },
  { left: '81%', size: 6, delay: '-1s', duration: '5.5s' },
  { left: '49%', size: 4, delay: '-4.4s', duration: '4.5s' },
]

function SeaScenery() {
  return (
    <div className={styles.scenery} aria-hidden="true">
      <span className={styles.sunGlow} />
      <span className={styles.sun} />
      <Cloud className={styles.cloudA} />
      <Cloud className={styles.cloudB} />
      <svg className={styles.gulls} viewBox="0 0 60 20" focusable="false">
        <path d="M2 10 Q8 2 14 10 Q20 2 26 10 M34 6 Q38 1 42 6 Q46 1 50 6" fill="none" stroke="#56707e" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <Island />
      <Boat />
      <span className={styles.water} />
      <span className={styles.rays} />
      <span className={styles.wavesBack} />
      <span className={styles.wavesFront} />
      <svg className={styles.sand} viewBox="0 0 100 20" preserveAspectRatio="none" focusable="false">
        <path d="M0 8 Q14 2 28 7 Q44 13 60 6 Q78 0 100 7 V20 H0Z" fill="#e9d79f" />
        <path d="M0 12 Q20 7 38 12 Q58 17 76 11 Q90 7 100 11 V20 H0Z" fill="#dcc485" />
      </svg>
      {SEAWEED.map((weed) => (
        <svg
          key={weed.left}
          className={styles.seaweed}
          style={{ left: weed.left, height: weed.height, '--delay': weed.delay } as CSSProperties}
          viewBox="0 0 30 100"
          preserveAspectRatio="xMidYMax meet"
          focusable="false"
        >
          <path d="M15 100 Q4 82 14 66 Q24 50 12 34 Q4 20 14 4" fill="none" stroke={weed.color} strokeWidth="7" strokeLinecap="round" />
          <path d="M15 100 Q24 84 18 70" fill="none" stroke={weed.color} strokeWidth="5" strokeLinecap="round" opacity="0.8" />
        </svg>
      ))}
      <svg className={styles.coral} viewBox="0 0 80 60" preserveAspectRatio="xMidYMax meet" focusable="false">
        <g fill="none" stroke="#ff7f9e" strokeWidth="7" strokeLinecap="round">
          <path d="M40 60 V30 M40 40 Q26 34 24 16 M40 34 Q54 28 56 12 M24 26 Q14 22 12 10 M56 22 Q66 18 68 8" />
        </g>
        <g fill="#ffb0c2">
          <circle cx="24" cy="16" r="4" /><circle cx="56" cy="12" r="4" /><circle cx="12" cy="10" r="3.5" /><circle cx="68" cy="8" r="3.5" />
        </g>
      </svg>
      <svg className={styles.fan} viewBox="0 0 60 50" preserveAspectRatio="xMidYMax meet" focusable="false">
        <path d="M30 50 Q4 40 6 18 Q18 2 30 4 Q44 2 54 18 Q56 40 30 50Z" fill="#ffa64d" stroke="#d26d1c" strokeWidth="2" />
        <path d="M30 50 L12 18 M30 50 L22 8 M30 50 L30 6 M30 50 L40 8 M30 50 L48 18" stroke="#d26d1c" strokeWidth="1.6" opacity="0.7" />
      </svg>
      <svg className={styles.shells} viewBox="0 0 100 24" preserveAspectRatio="xMidYMax meet" focusable="false">
        <path d="M10 22 Q4 10 14 6 Q24 10 18 22Z" fill="#ffe2d2" stroke="#d99a86" strokeWidth="1.4" />
        <path d="M14 22 L14 8 M11 21 L10 10 M17 21 L18 10" stroke="#d99a86" strokeWidth="1" />
        <path d="M62 20 L66 10 L70 20 L80 21 L72 26 L66 22 L58 26 L60 20Z" transform="translate(0 -4)" fill="#ff8f5a" stroke="#c2562a" strokeWidth="1.4" strokeLinejoin="round" />
        <ellipse cx="38" cy="20" rx="9" ry="5" fill="#9aa9b4" />
        <ellipse cx="45" cy="21" rx="6" ry="3.5" fill="#b9c5cd" />
      </svg>
      {BUBBLES.map((bubble) => (
        <span
          key={bubble.left}
          className={styles.bubble}
          style={{ left: bubble.left, width: bubble.size, height: bubble.size, animationDelay: bubble.delay, animationDuration: bubble.duration }}
        />
      ))}
    </div>
  )
}

export default memo(SeaScenery)
