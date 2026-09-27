import type { CSSProperties } from 'react'
import type { GameEffect } from './pukupukaGame'
import styles from './PukupukaRescuePlay.module.css'

// 一度だけ流れる演出（しぶき・ハート・ベルの音の輪・ほしのきらめき・打ち上げのしぶき）。
// 位置と種類は pukupukaGame.ts の effects が持ち、ここは CSS アニメーションで描くだけ。
// 各演出はIDをキーにしているので、フレームごとに描き直してもアニメーションは1回だけ再生される。

type Spark = { dx: number; dy: number }

const SPLASH_DROPS: Spark[] = [
  { dx: -7, dy: -7 }, { dx: -4, dy: -10 }, { dx: 0, dy: -11 }, { dx: 4, dy: -10 }, { dx: 7, dy: -7 },
]
const STAR_SPARKS: Spark[] = [
  { dx: 0, dy: -8 }, { dx: 7, dy: -3 }, { dx: 5, dy: 6 }, { dx: -5, dy: 6 }, { dx: -7, dy: -3 },
]

function moveStyle({ dx, dy }: Spark, delayMs = 0): CSSProperties {
  return { '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${delayMs}ms` } as CSSProperties
}

function Heart() {
  return <path d="M0 1.6 C-3.2 -0.8 -2.6 -3.4 -1.2 -3.4 C-0.4 -3.4 0 -2.8 0 -2.2 C0 -2.8 0.4 -3.4 1.2 -3.4 C2.6 -3.4 3.2 -0.8 0 1.6 Z" fill="#ff6b8b" stroke="#ffffff" strokeWidth="0.4" />
}

function Effect({ effect }: { effect: GameEffect }) {
  if (effect.kind === 'join') {
    return (
      <g transform={`translate(${effect.x} ${effect.y})`}>
        <circle className={styles.fxRing} r="6" fill="none" stroke="#ffd43b" strokeWidth="1.2" />
        {[{ dx: -5, dy: -12 }, { dx: 0, dy: -15 }, { dx: 5, dy: -12 }].map((spark, index) => (
          <g key={index} className={styles.fxFloat} style={moveStyle(spark, index * 90)}>
            <Heart />
          </g>
        ))}
      </g>
    )
  }
  if (effect.kind === 'splash' || effect.kind === 'launch') {
    return (
      <g transform={`translate(${effect.x} ${effect.y})`}>
        <ellipse className={styles.fxRing} rx="7" ry="2" fill="none" stroke="#ffffff" strokeWidth="1" />
        {SPLASH_DROPS.map((drop, index) => (
          <circle key={index} className={styles.fxDrop} style={moveStyle(effect.kind === 'launch' ? { dx: drop.dx * 1.3, dy: drop.dy * 0.8 } : drop)} r={index % 2 ? 1.1 : 1.5} fill="#d0ebff" stroke="#74c0fc" strokeWidth="0.3" />
        ))}
      </g>
    )
  }
  if (effect.kind === 'bell') {
    return (
      <g transform={`translate(${effect.x} ${effect.y})`}>
        <circle className={styles.fxRing} r="7" fill="none" stroke="#ffd43b" strokeWidth="1.1" />
        <circle className={styles.fxRing} style={{ animationDelay: '160ms' }} r="7" fill="none" stroke="#ffe066" strokeWidth="0.8" />
      </g>
    )
  }
  return (
    <g transform={`translate(${effect.x} ${effect.y})`}>
      {STAR_SPARKS.map((spark, index) => (
        <path key={index} className={styles.fxDrop} style={moveStyle(spark)} d="M0 -1.6 L0.5 -0.5 L1.6 0 L0.5 0.5 L0 1.6 L-0.5 0.5 L-1.6 0 L-0.5 -0.5 Z" fill="#ffe066" stroke="#f08c00" strokeWidth="0.25" />
      ))}
    </g>
  )
}

export default function PukupukaEffects({ effects }: { effects: readonly GameEffect[] }) {
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid="pukupuka-effects">
      {effects.map((effect) => <Effect key={effect.id} effect={effect} />)}
    </g>
  )
}
