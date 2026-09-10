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
        <rect x={gate.x - 1} y={gate.y} width={gate.width + 2} height={gate.height} rx="1" fill="#164d62" fillOpacity="0.1" stroke="#37657b" strokeWidth="0.7" />
        <g clipPath={`url(#${clipId})`}>
          <g transform={`translate(0 ${-gate.height * lift})`}>
            <rect x={gate.x} y={gate.y} width={gate.width} height={gate.height} fill="#f6ac45" stroke="#a95729" strokeWidth="0.8" />
            {Array.from({ length: Math.ceil(gate.height / 5) }, (_, i) => <path key={i} d={`M${gate.x + 0.6} ${gate.y + i * 5 + 1} h${gate.width - 1.2}`} stroke="#ffe5ac" strokeWidth="1.6" />)}
            <rect x={gate.x} y={gate.y + gate.height - 2} width={gate.width} height="2" fill="#af6234" />
          </g>
        </g>
        <rect x={gate.x - 2} y={gate.y - 3} width={gate.width + 4} height="5" rx="1.5" fill="#456f7d" />
        <circle cx={cx} cy={cy} r="7" fill={open ? '#d9fff0' : '#fff8df'} stroke="#2c6477" strokeWidth="1" />
        <path d={open ? `M${cx - 3} ${cy - 1.5} l3 3 l3 -3` : `M${cx - 3} ${cy + 1.5} l3 -3 l3 3`} fill="none" stroke="#247b83" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <foreignObject x={cx - HIT_WIDTH / 2} y={cy - HIT_HEIGHT / 2} width={HIT_WIDTH} height={HIT_HEIGHT}>
        <button type="button" className={styles.gateHit} disabled={disabled}
          aria-label={open ? 'ゲートの すいもん。あいています。おすと さがります' : 'ゲートの すいもん。とじています。おすと あがります'}
          aria-pressed={open} onClick={onToggle} />
      </foreignObject>
    </g>
  )
}
