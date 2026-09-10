import type { DrainDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

const HIT_WIDTH = 22
const HIT_HEIGHT = 22

type Props = { drain: DrainDefinition; open: boolean; disabled: boolean; onToggle: () => void }

/** 壁に付けた栓は横へ抜く。操作の輪と鎖は閉じている間も見える。 */
export default function PukupukaDrain({ drain, open, disabled, onToggle }: Props) {
  const angle = drain.orientation === 'left-wall' ? 90 : drain.orientation === 'right-wall' ? -90 : 0
  const dx = drain.orientation === 'left-wall' ? 5 : drain.orientation === 'right-wall' ? -5 : 0
  const dy = dx ? 0 : -4
  return (
    <g data-testid="pukupuka-drain" data-drain-open={open} data-orientation={drain.orientation ?? 'floor'}>
      <g aria-hidden="true" pointerEvents="none" transform={`translate(${drain.x} ${drain.y}) rotate(${angle})`}>
        <ellipse className={!open && !disabled ? styles.plugPulse : undefined} cx="0" cy="-3" rx="9" ry="8" fill="#fff5cb" fillOpacity="0.8" stroke="#ffbd54" strokeWidth="0.8" />
        <ellipse cx="0" cy="0" rx="7" ry="3.2" fill="#a2c6c9" stroke="#3a6777" strokeWidth="0.8" />
        <ellipse cx="0" cy="-0.3" rx="5.4" ry="2.4" fill="#16475b" />
        {open ? <ellipse className={styles.drainSwirl} cx="0" cy="-0.4" rx="3.8" ry="1.6" fill="none" stroke="#b9f5ff" strokeWidth="1.2" strokeDasharray="3 2" /> : null}
        <path d="M6 0 Q12 -5 5 -9" fill="none" stroke="#d0a552" strokeWidth="0.9" strokeDasharray="1.3 0.8" />
        <g className={styles.plugCap} style={{ transform: `translateY(${open ? -8 : 0}px)` }}>
          <ellipse cx="0" cy="-1.3" rx="5.2" ry="2.1" fill="#faac45" stroke="#a96228" strokeWidth="0.7" />
          <circle cx="0" cy="-4.7" r="2.7" fill="none" stroke="#c97623" strokeWidth="1.7" />
          <path d="M-1.5 -6 Q0 -7.3 1.5 -6" fill="none" stroke="#fff2c1" strokeWidth="0.6" />
        </g>
      </g>
      <foreignObject x={drain.x + dx - HIT_WIDTH / 2} y={drain.y + dy - HIT_HEIGHT / 2} width={HIT_WIDTH} height={HIT_HEIGHT}>
        <button type="button" className={styles.drainHit} disabled={disabled}
          aria-label={open ? 'せん。あけています。みずが ぬけています' : 'せん。おすと みずが ぬけます'}
          aria-pressed={open} onClick={onToggle} />
      </foreignObject>
    </g>
  )
}
