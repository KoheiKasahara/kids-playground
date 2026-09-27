import { useId } from 'react'
import type { BellDefinition, DoorDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// ベルとさく（とびら）の見た目。どちらもタップ操作は持たず、隊長がベルにふれると
// pukupukaGame.ts の状態が変わり、それに合わせて揺れる・持ち上がるだけの表示。
// ベルとさくの両方に同じ金色のベルのしるしを付け、「このベルでこのさくが開く」と結びつける。

/** 水そうの上のふち。ベルはここからひもでつるす。 */
const RIM_Y = 22

export function PukupukaBell({ bell, rung }: { bell: BellDefinition; rung: boolean }) {
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid={`pukupuka-bell-${bell.id}`} data-rung={rung}>
      <rect x={bell.x - 3} y={RIM_Y - 1.4} width="6" height="1.8" rx="0.9" fill="#5c7591" />
      <path d={`M${bell.x} ${RIM_Y} V${bell.y - 4.2}`} stroke="#8d6e4f" strokeWidth="0.7" />
      <g transform={`translate(${bell.x} ${bell.y})`}>
        {!rung ? <circle className={styles.bellHint} r="7.4" fill="none" stroke="#ffd43b" strokeWidth="0.9" strokeDasharray="2 1.6" /> : null}
        <g className={rung ? styles.bellSwing : styles.bellIdle}>
          <circle cy="-4.3" r="0.9" fill="none" stroke="#b07000" strokeWidth="0.6" />
          <path d="M-4 2.8 Q-4.2 -3.8 0 -3.9 Q4.2 -3.8 4 2.8 L5 3.9 H-5 Z" fill="url(#pukupuka-bell-gold)" stroke="#a86400" strokeWidth="0.55" strokeLinejoin="round" />
          <path d="M-2.2 -1.8 Q-2.6 0.6 -2.4 2.2" stroke="#fff8d6" strokeWidth="0.8" strokeLinecap="round" opacity="0.85" />
          <circle cy="4.5" r="1.1" fill="#a86400" />
        </g>
        {rung ? (
          <g className={styles.bellWaves}>
            <path d="M-7 -3 Q-8.6 0 -7 3 M7 -3 Q8.6 0 7 3" fill="none" stroke="#ffd43b" strokeWidth="0.8" strokeLinecap="round" />
          </g>
        ) : null}
      </g>
    </g>
  )
}

export function PukupukaDoor({ door, lift }: { door: DoorDefinition; lift: number }) {
  const clipId = useId()
  const bars = Math.max(2, Math.round(door.width / 2))
  const barGap = door.width / bars
  const emblemY = door.y + Math.min(door.height / 2, 14)
  return (
    <g aria-hidden="true" pointerEvents="none" data-testid={`pukupuka-door-${door.id}`} data-door-lift={lift.toFixed(2)}>
      <defs>
        <clipPath id={clipId}>
          <rect x={door.x - 1} y={door.y} width={door.width + 2} height={door.height} />
        </clipPath>
      </defs>
      {/* 上下するレール。開いても残して、さくが持ち上がったことを分かりやすくする。 */}
      <rect x={door.x - 0.9} y={door.y} width="0.9" height={door.height} fill="#5c7591" opacity="0.7" />
      <rect x={door.x + door.width} y={door.y} width="0.9" height={door.height} fill="#5c7591" opacity="0.7" />
      <g clipPath={`url(#${clipId})`}>
        <g transform={`translate(0 ${-door.height * lift})`}>
          {Array.from({ length: bars }, (_, index) => (
            <g key={index}>
              <rect x={door.x + barGap * (index + 0.5) - 0.65} y={door.y} width="1.3" height={door.height} rx="0.6" fill="#35667a" />
              <rect x={door.x + barGap * (index + 0.5) - 0.35} y={door.y} width="0.35" height={door.height} fill="#9fd3e3" opacity="0.8" />
            </g>
          ))}
          {[0.08, 0.5, 0.92].map((part) => (
            <rect key={part} x={door.x - 0.3} y={door.y + door.height * part - 1} width={door.width + 0.6} height="2" rx="0.8" fill="#2c5566" />
          ))}
          <g transform={`translate(${door.x + door.width / 2} ${emblemY})`}>
            <circle r="3" fill="#fff3bf" stroke="#a86400" strokeWidth="0.5" />
            <path d="M-1.6 1 Q-1.7 -1.6 0 -1.6 Q1.7 -1.6 1.6 1 L2 1.5 H-2 Z" fill="#fab005" />
          </g>
        </g>
      </g>
    </g>
  )
}
