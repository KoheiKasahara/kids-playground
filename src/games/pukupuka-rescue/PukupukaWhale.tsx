import type { WhaleDefinition } from './types'
import styles from './PukupukaRescuePlay.module.css'

// くじらの見た目と入力。タップすると しおふき が起き、真上の水の柱で浮いている隊長を打ち上げる
// （打ち上げそのものは pukupukaGame.ts が持つ）。隊長が柱の上にいるときは、くじらのまわりを
// 光らせて「いま おして」を知らせる。

const HIT_WIDTH = 26
const HIT_HEIGHT = 20
/** しおの柱のてっぺん（水そうのふちより上まで吹き上げる）。 */
const JET_TOP_Y = 4

type Props = {
  whale: WhaleDefinition
  /** しおふき中か。 */
  jetting: boolean
  /** 隊長が柱の上に浮いていて、いま吹けば打ち上がるか。 */
  ready: boolean
  /** 柱の根もと（水面）。しおは水面から上だけに見せる。 */
  surfaceY: number
  disabled: boolean
  onTap: () => void
}

export default function PukupukaWhale({ whale, jetting, ready, surfaceY, disabled, onTap }: Props) {
  const spoutX = whale.x + 2.4
  const spoutY = whale.y - 5.6
  const jetWidth = whale.halfWidth * 1.5
  return (
    <g data-testid="pukupuka-whale" data-jetting={jetting} data-ready={ready}>
      <g aria-hidden="true" pointerEvents="none">
        {jetting ? (
          <g className={styles.whaleJet}>
            {/* 水中の太い水流と、水面から上に吹き上がるしお */}
            <rect x={spoutX - jetWidth / 2} y={surfaceY} width={jetWidth} height={Math.max(0, spoutY - surfaceY)} rx={jetWidth / 2} fill="#e7f8ff" opacity="0.55" />
            <path
              d={`M${spoutX - jetWidth / 2} ${surfaceY} Q${spoutX - jetWidth * 0.7} ${(surfaceY + JET_TOP_Y) / 2} ${spoutX - jetWidth * 0.3} ${JET_TOP_Y + 3}
                Q${spoutX} ${JET_TOP_Y - 3} ${spoutX + jetWidth * 0.3} ${JET_TOP_Y + 3}
                Q${spoutX + jetWidth * 0.7} ${(surfaceY + JET_TOP_Y) / 2} ${spoutX + jetWidth / 2} ${surfaceY} Z`}
              fill="#d0f0ff"
              stroke="#4dabf7"
              strokeWidth="0.9"
              opacity="0.95"
            />
            <ellipse cx={spoutX} cy={JET_TOP_Y + 3} rx={jetWidth * 0.9} ry="3" fill="#ffffff" stroke="#74c0fc" strokeWidth="0.6" />
            <ellipse cx={spoutX} cy={surfaceY} rx={jetWidth * 0.9} ry="1.8" fill="#ffffff" opacity="0.8" />
            <path className={styles.whaleJetStreak} d={`M${spoutX} ${surfaceY} V${JET_TOP_Y + 4}`} stroke="#ffffff" strokeWidth={jetWidth * 0.35} strokeLinecap="round" strokeDasharray="3 4" />
            {[-1, 1].map((side) => (
              <g key={side} className={styles.whaleDrops}>
                <circle cx={spoutX + side * jetWidth * 0.8} cy={JET_TOP_Y + 6} r="1.3" fill="#a5d8ff" />
                <circle cx={spoutX + side * jetWidth * 1.1} cy={JET_TOP_Y + 12} r="1" fill="#d0ebff" />
              </g>
            ))}
          </g>
        ) : null}
        {ready && !jetting && !disabled ? (
          <ellipse className={styles.whaleReady} cx={whale.x} cy={whale.y} rx="13" ry="9" fill="none" stroke="#ffd43b" strokeWidth="1.1" strokeDasharray="2.4 1.6" />
        ) : null}
        <g transform={`translate(${whale.x} ${whale.y})`}>
          <g className={jetting ? styles.whaleBlow : styles.whaleIdle}>
          <path d="M-8.4 1.4 Q-12 -2.6 -14.6 -5.8 Q-12.4 -1 -13.6 2.8 Q-11 0.8 -8.4 3.8 Z" fill="url(#pukupuka-whale)" stroke="#0b4f8a" strokeWidth="0.55" strokeLinejoin="round" />
          <path
            d="M-9.4 2.4 Q-9.8 -6.4 0.4 -6.6 Q7.8 -6.6 9.8 -1.2 Q10.8 2.6 8.2 4.6 Q2 6.6 -4.4 5.6 Q-8.2 5 -9.4 2.4 Z"
            fill="url(#pukupuka-whale)"
            stroke="#0b4f8a"
            strokeWidth="0.6"
            strokeLinejoin="round"
          />
          <path d="M-7.6 3.2 Q0 7.4 8.6 3 Q7.6 5.2 2 6 Q-3.8 6.6 -7.6 3.2 Z" fill="#d0ebff" />
          <path d="M-5 -4.6 Q-1 -6 3 -5.4" fill="none" stroke="#a5d8ff" strokeWidth="0.9" strokeLinecap="round" />
          <path d="M-1.2 3 Q-3.4 6 -0.4 6.4 Q0.6 4.6 -1.2 3 Z" fill="#1c7ed6" stroke="#0b4f8a" strokeWidth="0.4" />
          <ellipse cx="5.2" cy="-1.4" rx="0.95" ry="1.2" fill="#1b1f24" />
          <circle cx="5.5" cy="-1.8" r="0.35" fill="#ffffff" />
          <path d="M5.6 1.4 Q7.6 2.4 9.2 0.8" fill="none" stroke="#0b4f8a" strokeWidth="0.55" strokeLinecap="round" />
          <ellipse cx="3.6" cy="0.8" rx="1.1" ry="0.7" fill="#ff8fa3" opacity="0.6" />
          <ellipse cx="2.4" cy="-6.4" rx="1.2" ry="0.5" fill="#0b4f8a" />
          </g>
        </g>
      </g>
      <foreignObject x={whale.x - HIT_WIDTH / 2} y={whale.y - HIT_HEIGHT / 2 - 2} width={HIT_WIDTH} height={HIT_HEIGHT}>
        <button
          type="button"
          className={styles.whaleHit}
          disabled={disabled}
          aria-label={jetting ? 'くじら。しおを ふいています' : 'くじら。おすと しおを ふいて うえの なかまを とばします'}
          aria-pressed={jetting}
          onClick={onTap}
        />
      </foreignObject>
    </g>
  )
}
