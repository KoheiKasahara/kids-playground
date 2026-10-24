import { useId } from 'react'
import { CELL, boardSize, pieceOffset, squareCenter } from './boardLayout'
import { PIECES, squareAt, type Course, type PieceId, type Square } from './courses'
import PieceArt from './PieceArt'
import styles from './SugorokuPlay.module.css'

/** マスの おおきさ（CELL の なかで すこし すきまを あける）。 */
const SQUARE = CELL * 0.84

export type BoardMover = {
  player: number
  /** 1マス うごく たびに ふえる。コマの ぴょんを やりなおす ために つかう。 */
  hop: number
  /** コマの うえに だす かぞえの かず。 */
  count: number | null
  flying: boolean
}

type Props = {
  course: Course
  pieces?: readonly PieceId[]
  positions?: readonly number[]
  turn?: number | null
  mover?: BoardMover | null
  label: string
  compact?: boolean
  className?: string
}

const pieceColor = (id: PieceId) => PIECES.find((piece) => piece.id === id)?.color ?? '#888'

function SmallDie() {
  return (
    <g transform="translate(0 -10)">
      <rect x={-13} y={-13} width={26} height={26} rx={6} fill="#fffdf8" stroke="#4a3a33" strokeWidth={2.4} />
      <circle cx={-5} cy={-5} r={3.2} fill="#4a3a33" />
      <circle cx={5} cy={5} r={3.2} fill="#4a3a33" />
    </g>
  )
}

function Star() {
  const points = Array.from({ length: 10 }, (_, index) => {
    const radius = index % 2 === 0 ? 16 : 7
    const angle = (Math.PI / 5) * index - Math.PI / 2
    return `${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius - 10).toFixed(1)}`
  }).join(' ')
  return <polygon points={points} fill="#ffd23f" stroke="#c0567f" strokeWidth={2.4} strokeLinejoin="round" />
}

function SquareLabel({ square, index }: { square: Square; index: number }) {
  switch (square.kind) {
    case 'start':
      return <text className={styles.squareWord} y={7} fontSize={17}>スタート</text>
    case 'goal':
      return (
        <g>
          <path d="M-12 -30 L-12 -2" stroke="#4a3a33" strokeWidth={3} strokeLinecap="round" />
          <path d="M-11 -30 L14 -23 L-11 -15 Z" fill="#e0473f" stroke="#4a3a33" strokeWidth={2} strokeLinejoin="round" />
          <text className={styles.squareWord} y={22} fontSize={20}>ゴール</text>
        </g>
      )
    case 'normal':
      return <text className={styles.squareNumber} y={9} fontSize={24}>{index}</text>
    case 'forward':
      return (
        <g>
          <text className={styles.squareBig} y={4} fontSize={30}>+{square.steps}</text>
          <text className={styles.squareWord} y={28} fontSize={15}>すすむ</text>
        </g>
      )
    case 'back':
      return (
        <g>
          <text className={styles.squareBig} y={4} fontSize={30}>−{square.steps}</text>
          <text className={styles.squareWord} y={28} fontSize={15}>もどる</text>
        </g>
      )
    case 'rest':
      return (
        <g>
          <text className={styles.squareBig} y={2} fontSize={26}>Zz</text>
          <text className={styles.squareWord} y={28} fontSize={15}>やすみ</text>
        </g>
      )
    case 'again':
      return (
        <g>
          <SmallDie />
          <text className={styles.squareWord} y={28} fontSize={13}>もう1かい</text>
        </g>
      )
    case 'warp':
      return (
        <g>
          <Star />
          <text className={styles.squareWord} y={28} fontSize={15}>ワープ</text>
        </g>
      )
  }
}

/** すごろくの ばんめん。ひだりうえの スタートから ジグザグに すすみ、みぎ（または ひだり）したが ゴール。 */
export default function SugorokuBoard({ course, pieces = [], positions = [], turn = null, mover = null, label, compact = false, className }: Props) {
  // url(#…) で さんしょう するので、つかえない もじを のぞいておく。
  const arrowId = `sugoroku-warp-${useId().replace(/[^\w-]/g, '')}`
  const { width, height } = boardSize(course)
  const squares = Array.from({ length: course.length }, (_, index) => index)
  const road = squares.map((index) => {
    const { x, y } = squareCenter(course, index)
    return `${x},${y}`
  }).join(' ')
  const warps = Object.entries(course.events).flatMap(([key, event]) => (event.kind === 'warp' ? [[Number(key), event.to] as const] : []))

  const order = pieces.map((_, index) => index).sort((a, b) => Number(a === turn) - Number(b === turn))

  return (
    <svg className={className} viewBox={`-8 -8 ${width + 16} ${height + 16}`} role="img" aria-label={label} data-course={course.id}>
      <defs>
        <marker id={arrowId} viewBox="0 0 10 10" refX={6} refY={5} markerWidth={4} markerHeight={4} orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill="#d6458f" />
        </marker>
      </defs>
      <polyline className={styles.road} points={road} strokeWidth={compact ? 46 : 34} />
      {squares.map((index) => {
        const square = squareAt(course, index)
        const { x, y } = squareCenter(course, index)
        return (
          <g key={index} transform={`translate(${x} ${y})`} data-square={index} data-kind={square.kind}>
            <rect className={`${styles.square} ${styles[`kind-${square.kind}`] ?? ''}`}
              x={-SQUARE / 2} y={-SQUARE / 2} width={SQUARE} height={SQUARE} rx={18} />
            {!compact && <SquareLabel square={square} index={index} />}
          </g>
        )
      })}
      {warps.map(([from, to]) => {
        const a = squareCenter(course, from)
        const b = squareCenter(course, to)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1
        const bend = Math.min(70, length * 0.35)
        const cx = mx + ((b.y - a.y) / length) * bend
        const cy = my - ((b.x - a.x) / length) * bend
        return (
          <path key={from} className={styles.warpLine} d={`M${a.x} ${a.y - 18} Q${cx} ${cy} ${b.x} ${b.y - 18}`}
            markerEnd={`url(#${arrowId})`} strokeWidth={compact ? 9 : 6} />
        )
      })}
      {order.map((player) => {
        const id = pieces[player]!
        const position = positions[player] ?? 0
        const sharing = pieces.map((_, index) => index).filter((index) => (positions[index] ?? 0) === position)
        const slot = sharing.indexOf(player)
        const scale = sharing.length > 1 ? 0.6 : 0.92
        const center = squareCenter(course, position)
        const offset = pieceOffset(slot, sharing.length)
        const moving = mover?.player === player
        const color = pieceColor(id)
        return (
          <g key={id} className={`${styles.piece} ${moving && mover.flying ? styles.flying : ''}`}
            style={{ transform: `translate(${center.x + offset.x}px, ${center.y + offset.y + 4}px)` }}
            data-player={player} data-position={position}>
            <g key={moving ? mover.hop : 0} className={moving && mover.hop > 0 ? (mover.flying ? styles.fly : styles.hop) : undefined}>
              {player === turn && <ellipse className={styles.turnRing} cy={17 * scale} rx={27 * scale} ry={11 * scale} stroke={color} />}
              <g transform={`scale(${scale})`}>
                <PieceArt id={id} color={color} />
              </g>
            </g>
            {moving && mover.count !== null && (
              <g className={styles.countBubble} transform={`translate(0 ${-46 * scale - 14})`} aria-hidden="true">
                <circle r={17} fill="#fffdf8" stroke={color} strokeWidth={4} />
                <text y={8} fontSize={23}>{mover.count}</text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
