import { useId } from 'react'
import type { GateDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

const HIT_WIDTH = 22
const HIT_HEIGHT = 22

type Props = {
  gate: GateDefinition
  open: boolean
  lift?: number
  disabled: boolean
  onToggle: () => void
}

/** 引き上がる扉を開口でクリップする。表示と衝突は同じliftを使う。 */
export default function PukupukaGate({ gate, open, lift = open ? 1 : 0, disabled, onToggle }: Props) {
  const clipId = useId()
  const cx = gate.x + gate.width / 2
  const cy = gate.y + gate.height / 2
  return (
    <g data-testid="pukupuka-gate" data-gate-open={open} data-gate-lift={lift}>
      <defs><clipPath id={clipId}><rect x={gate.x} y={gate.y} width={gate.width} height={gate.height} /></clipPath></defs>
      <g aria-hidden="true" pointerEvents="none">
        {/* 開口部の奥。扉が上がると、ここから向こうの水が見える。 */}
        <rect x={gate.x - 1} y={gate.y} width={gate.width + 2} height={gate.height} rx="1" fill="#164d62" fillOpacity="0.12" />
        <rect x={gate.x - 1.6} y={gate.y} width="1.6" height={gate.height} fill="#456f7d" />
        <rect x={gate.x + gate.width} y={gate.y} width="1.6" height={gate.height} fill="#456f7d" />
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(0 ${-gate.height * lift})`}>
            <rect x={gate.x} y={gate.y} width={gate.width} height={gate.height} fill="url(#pukupuka-gate-panel)" stroke="#a24f1c" strokeWidth="0.7" />
            {Array.from({ length: Math.ceil(gate.height / 6) }, (_, i) => (
              <g key={i}>
                <path d={`M${gate.x + 0.5} ${gate.y + i * 6 + 5.6} h${gate.width - 1}`} stroke="#a24f1c" strokeWidth="0.5" opacity="0.7" />
                <path d={`M${gate.x + 0.8} ${gate.y + i * 6 + 1.2} h${gate.width - 1.6}`} stroke="#ffe3b0" strokeWidth="0.8" strokeLinecap="round" opacity="0.8" />
                <circle cx={gate.x + 1.4} cy={gate.y + i * 6 + 3.2} r="0.45" fill="#8f3f12" />
                <circle cx={gate.x + gate.width - 1.4} cy={gate.y + i * 6 + 3.2} r="0.45" fill="#8f3f12" />
              </g>
            ))}
            <rect x={gate.x} y={gate.y + gate.height - 2.2} width={gate.width} height="2.2" fill="#8f3f12" />
          </g>
        </g>
        <rect x={gate.x - 2.4} y={gate.y - 3} width={gate.width + 4.8} height="5" rx="1.6" fill="#456f7d" stroke="#2c4f5c" strokeWidth="0.5" />
        <path d={`M${gate.x - 1.4} ${gate.y - 1.8} H${gate.x + gate.width + 1.4}`} stroke="#9fc5d3" strokeWidth="0.6" strokeLinecap="round" />
        {/* 押すと扉が上下するボタン。矢印が「つぎに押すとどうなるか」を示す。 */}
        <circle cx={cx} cy={cy + 0.8} r="7.4" fill="#0b3a4a" opacity="0.18" />
        <circle cx={cx} cy={cy} r="7.2" fill={open ? '#d3f9d8' : '#fff9db'} stroke="#2c6477" strokeWidth="1.1" />
        <circle cx={cx} cy={cy} r="5.6" fill="none" stroke={open ? '#8ce99a' : '#ffe066'} strokeWidth="0.8" />
        <path d={open ? `M${cx - 3} ${cy - 1.5} l3 3 l3 -3` : `M${cx - 3} ${cy + 1.5} l3 -3 l3 3`} fill="none" stroke="#1f6f78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <foreignObject x={cx - HIT_WIDTH / 2} y={cy - HIT_HEIGHT / 2} width={HIT_WIDTH} height={HIT_HEIGHT}>
        <button type="button" className={styles.gateHit} disabled={disabled}
          aria-label={open ? 'ゲートの すいもん。あいています。おすと さがります' : 'ゲートの すいもん。とじています。おすと あがります'}
          aria-pressed={open} onClick={onToggle} />
      </foreignObject>
    </g>
  )
}
