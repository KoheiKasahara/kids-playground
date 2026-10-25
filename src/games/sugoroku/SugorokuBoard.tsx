import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CELL, boardSize, cameraFor, gridToBoard, pieceOffset, roadPath, scatterScenery, squareCenter, viewSize } from './boardLayout'
import { PIECES, squareAt, type Course, type PieceId, type Square } from './courses'
import PieceArt from './PieceArt'
import { LandmarkArt, SceneryArt } from './SceneryArt'
import styles from './SugorokuPlay.module.css'

/** マスの おおきさ（CELL の なかで すこし すきまを あける）。 */
const SQUARE = CELL * 0.84
/** おおきさを はかれない ときの よこ ÷ たて（スマートフォンの たてむき くらい）。 */
const FALLBACK_ASPECT = 0.75

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
  /** ちかくで みる ときに まんなかに おく マス。 */
  focus?: number
  /** ばんめん ぜんたいを ちぢめて みせる。 */
  overview?: boolean
  label: string
  /** わかれみちで えらべる みちの さいしょの マスに だす なふだ。 */
  routeHints?: readonly { square: number; label: string }[]
  /** コースえらびの ちいさな みほん。ぜんたいを みせ、もじは かかない。 */
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
    const radius = index % 2 === 0 ? 17 : 8
    const angle = (Math.PI / 5) * index - Math.PI / 2
    return `${(Math.cos(angle) * radius).toFixed(1)},${(Math.sin(angle) * radius - 10).toFixed(1)}`
  }).join(' ')
  return (
    <g>
      <polygon points={points} fill="#ffd23f" stroke="#c0567f" strokeWidth={2.4} strokeLinejoin="round" />
      <text className={styles.squareWord} y={-4} fontSize={15}>?</text>
    </g>
  )
}

function TwoDice() {
  return (
    <g>
      {[-11, 11].map((x) => (
        <g key={x} transform={`translate(${x} ${x === -11 ? -14 : -6}) rotate(${x === -11 ? -10 : 10})`}>
          <rect x={-10} y={-10} width={20} height={20} rx={5} fill="#fffdf8" stroke="#4a3a33" strokeWidth={2.2} />
          <circle cx={-4} cy={-4} r={2.4} fill="#4a3a33" />
          <circle cx={4} cy={4} r={2.4} fill="#4a3a33" />
        </g>
      ))}
    </g>
  )
}

function Signpost() {
  return (
    <g>
      <path d="M0 -4 L0 -36" stroke="#7a5534" strokeWidth={4} strokeLinecap="round" />
      <path d="M-2 -34 L-24 -34 L-30 -28 L-24 -22 L-2 -22 Z" fill="#ffe08a" stroke="#7a5534" strokeWidth={2.4} strokeLinejoin="round" />
      <path d="M2 -20 L24 -20 L30 -14 L24 -8 L2 -8 Z" fill="#bfe6ff" stroke="#7a5534" strokeWidth={2.4} strokeLinejoin="round" />
    </g>
  )
}

function SquareLabel({ square, index, branch }: { square: Square; index: number; branch: boolean }) {
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
      // わきみちの マスには おおどおりと かぶる ばんごうを かかない。
      return branch ? <circle r={7} className={styles.branchDot} /> : <text className={styles.squareNumber} y={9} fontSize={24}>{index}</text>
    case 'fork':
      return (
        <g>
          <Signpost />
          <text className={styles.squareWord} y={22} fontSize={13}>わかれみち</text>
        </g>
      )
    case 'double':
      return (
        <g>
          <TwoDice />
          <text className={styles.squareWord} y={28} fontSize={13}>サイコロ2こ</text>
        </g>
      )
    case 'swap':
      return (
        <g>
          <path d="M-15 -20 H13 M5 -27 L13 -20 L5 -13 M15 -2 H-13 M-5 -9 L-13 -2 L-5 5" fill="none" stroke="#4a3a33"
            strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
          <text className={styles.squareWord} y={28} fontSize={13}>いれかわり</text>
        </g>
      )
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

/** svg の よこ ÷ たてを はかる。はかれない あいだは FALLBACK_ASPECT。 */
function useAspect(enabled: boolean) {
  const ref = useRef<SVGSVGElement>(null)
  const [aspect, setAspect] = useState(FALLBACK_ASPECT)
  useLayoutEffect(() => {
    const element = ref.current
    if (!enabled || !element) return undefined
    const measure = () => {
      const { width, height } = element.getBoundingClientRect()
      if (width > 0 && height > 0) setAspect(Math.round((width / height) * 100) / 100)
    }
    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])
  return [ref, aspect] as const
}

/**
 * すごろくの ばんめん。コースは がめんより おおきいので、ふだんは コマの まわりだけを
 * うつし、うごきに あわせて カメラが ついていく。compact と overview は ぜんたいを みせる。
 */
export default function SugorokuBoard({ course, pieces = [], positions = [], turn = null, mover = null, focus = 0, overview = false, routeHints = [], label, compact = false, className }: Props) {
  const [svgRef, aspect] = useAspect(!compact)
  const board = boardSize(course)
  const roads = useMemo(() => course.roads.map((squares) => roadPath(course, squares)), [course])
  const scenery = useMemo(() => scatterScenery(course), [course])
  const squares = Array.from({ length: course.length }, (_, index) => index)

  const view = compact ? board : viewSize(aspect)
  const camera = compact ? { x: 0, y: 0, scale: 1 } : cameraFor(board, view, squareCenter(course, focus), overview)

  const order = pieces.map((_, index) => index).sort((a, b) => Number(a === turn) - Number(b === turn))

  return (
    <svg ref={svgRef} className={className} viewBox={`0 0 ${view.width} ${view.height}`} role="img" aria-label={label}
      data-course={course.id} data-overview={compact ? undefined : overview}>
      <g className={compact ? undefined : styles.camera}
        style={{ transform: `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})` }}>
        <rect className={styles.ground} width={board.width} height={board.height} rx={CELL * 0.4} />
        {course.landmarks.map((landmark) => {
          const corner = gridToBoard(course, landmark)
          return (
            <g key={`${landmark.kind}-${landmark.x}-${landmark.y}`} transform={`translate(${corner.x} ${corner.y})`} data-landmark={landmark.kind}>
              <LandmarkArt landmark={landmark} />
            </g>
          )
        })}
        {scenery.map((item) => (
          <g key={`${item.x},${item.y}`} transform={`translate(${item.x} ${item.y}) scale(${item.flip ? -1 : 1} 1)`}>
            <SceneryArt kind={item.kind} />
          </g>
        ))}
        {roads.map((road) => <path key={road} className={styles.road} d={road} strokeWidth={compact ? 46 : 34} />)}
        {squares.map((index) => {
          const square = squareAt(course, index)
          const { x, y } = squareCenter(course, index)
          return (
            <g key={index} transform={`translate(${x} ${y})`} data-square={index} data-kind={square.kind}>
              <rect className={`${styles.square} ${styles[`kind-${square.kind}`] ?? ''}`}
                x={-SQUARE / 2} y={-SQUARE / 2} width={SQUARE} height={SQUARE} rx={18} />
              {!compact && <SquareLabel square={square} index={index} branch={index in course.routeOf} />}
            </g>
          )
        })}
        {routeHints.map(({ square, label: hint }) => {
          const { x, y } = squareCenter(course, square)
          return (
            <g key={square} className={styles.routeHint} transform={`translate(${x} ${y})`} data-route-hint={square}>
              <rect x={-SQUARE / 2 - 4} y={-SQUARE / 2 - 4} width={SQUARE + 8} height={SQUARE + 8} rx={22} />
              <text y={-SQUARE / 2 - 12} fontSize={20}>{hint}</text>
            </g>
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
      </g>
    </svg>
  )
}
