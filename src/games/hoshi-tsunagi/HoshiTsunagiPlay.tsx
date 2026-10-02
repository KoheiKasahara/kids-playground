import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import {
  centerOf,
  courseConstellations,
  createBoard,
  findStarNear,
  isComplete,
  tapStar,
  type BoardState,
  type Constellation,
  type HoshiCourse,
} from './hoshiGame'
import { playCompleteSound, playConnectSound, playWrongSound } from './sounds'
import StageClearBadge from '../../components/StageClearBadge'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import styles from './HoshiTsunagiPlay.module.css'

/** コースごとの クリア記録と ★（Issue #784 A6）。まちがいが すくないほど ★が ふえる。 */
const hoshiProgress = createStageProgressStore('hoshi-tsunagi-progress-v1', (id) => Object.hasOwn(COURSE_LABELS, id))

function courseStars(mistakes: number): 1 | 2 | 3 {
  return mistakes === 0 ? 3 : mistakes <= 3 ? 2 : 1
}

const COURSE_LABELS: Record<HoshiCourse, { name: string; hint: string }> = {
  easy: { name: 'かんたん', hint: 'ほしが すくない' },
  normal: { name: 'ふつう', hint: 'ほしが ちょっと おおい' },
  hard: { name: 'むずかしい', hint: 'ほしが たくさん' },
}

/** SVGの表示範囲。星の番号が外側にはみ出しても切れないよう、0〜100の座標より少し広くとる。 */
const VIEW_MIN = -8
const VIEW_SIZE = 116

/** なぞっている指が、この距離（0〜100座標）まで近づいたら星にふれたとみなす。 */
const TOUCH_RADIUS = 7

const MOTION_CLASS: Record<Constellation['motion'], string | undefined> = {
  spin: styles.motionSpin,
  hop: styles.motionHop,
  swim: styles.motionSwim,
  sail: styles.motionSail,
  beat: styles.motionBeat,
  fly: styles.motionFly,
  nod: styles.motionNod,
  flutter: styles.motionFlutter,
}

/** 背景でまたたく小さな星。毎回同じ並びになるよう、固定の種から作る。 */
const BACKGROUND_STARS = (() => {
  let seed = 7
  const next = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
  return Array.from({ length: 28 }, () => ({
    x: VIEW_MIN + next() * VIEW_SIZE,
    y: VIEW_MIN + next() * VIEW_SIZE,
    r: 0.25 + next() * 0.45,
    delay: next() * 3,
  }))
})()

/** 番号の文字を、形の中心から見て星の外側へ少しずらして置く（線と重なりにくくする）。 */
function labelPosition(point: readonly [number, number], center: [number, number]): [number, number] {
  const dx = point[0] - center[0]
  const dy = point[1] - center[1]
  const length = Math.hypot(dx, dy) || 1
  return [point[0] + (dx / length) * 6, point[1] + (dy / length) * 6 + 1.6]
}

type Phase = 'select' | 'play' | 'finished'

export default function HoshiTsunagiPlay() {
  const [phase, setPhase] = useState<Phase>('select')
  const [course, setCourse] = useState<HoshiCourse>('easy')
  const [stageIndex, setStageIndex] = useState(0)
  // まえ／つぎのボタンで好きな順に遊べるため、できた星座は番号で覚えておく。
  const [cleared, setCleared] = useState<ReadonlySet<number>>(() => new Set())
  const [soundOn, setSoundOn] = useState(true)
  const mistakesRef = useRef(0)
  const [progress, setProgress] = useState(hoshiProgress.read)
  // なぞる操作では1回の描画のあいだに複数の星へふれることがあるため、進行の正はrefに持つ。
  const [board, setBoard] = useState<BoardState>(createBoard)
  const boardRef = useRef<BoardState>(board)
  const [pointer, setPointer] = useState<[number, number] | null>(null)
  const draggingRef = useRef(false)
  // ちがう星をさわるたびに数を増やし、keyを変えて「ぷるぷる」を毎回最初から見せる。
  const [wrong, setWrong] = useState<{ index: number; count: number } | null>(null)

  useGameIntroPlaying(phase !== 'select')

  const constellations = courseConstellations(course)
  const constellation = constellations[stageIndex] ?? constellations[0]!
  const complete = isComplete(board, constellation)
  const isLastStage = stageIndex >= constellations.length - 1

  const commit = (next: BoardState) => {
    boardRef.current = next
    setBoard(next)
  }

  const startCourse = (nextCourse: HoshiCourse) => {
    primeAudio()
    setCourse(nextCourse)
    setStageIndex(0)
    setCleared(new Set())
    mistakesRef.current = 0
    commit(createBoard())
    setWrong(null)
    setPhase('play')
  }

  const backToSelect = () => {
    commit(createBoard())
    setWrong(null)
    setPointer(null)
    setPhase('select')
  }

  /** まえ／つぎのボタンで、えらんだ星座へ移動する。移動先は最初からつなぎなおす。 */
  const moveStage = (delta: number) => {
    const target = stageIndex + delta
    if (target < 0 || target >= constellations.length) return
    setPointer(null)
    setWrong(null)
    draggingRef.current = false
    commit(createBoard())
    setStageIndex(target)
  }

  const goNext = () => {
    setPointer(null)
    setWrong(null)
    if (isLastStage) {
      if (cleared.size >= constellations.length) {
        setProgress(hoshiProgress.record(course, courseStars(mistakesRef.current)))
        vibrate('celebrate')
      }
      setPhase('finished')
      return
    }
    commit(createBoard())
    setStageIndex((current) => current + 1)
  }

  /** mistakes=false のときは、なぞっている途中にほかの星をかすめてもまちがいにしない。 */
  const handleStar = (starIndex: number, mistakes: boolean) => {
    const { board: next, result } = tapStar(boardRef.current, constellation, starIndex)
    if (result === 'none') return
    if (result === 'wrong') {
      if (!mistakes) return
      commit(next)
      setWrong((current) => ({ index: starIndex, count: (current?.count ?? 0) + 1 }))
      mistakesRef.current += 1
      vibrate('error')
      if (soundOn) playWrongSound()
      return
    }
    commit(next)
    setWrong(null)
    if (result === 'complete') {
      setCleared((current) => new Set(current).add(stageIndex))
      vibrate('success')
    } else {
      vibrate('tap')
    }
    if (!soundOn) return
    if (result === 'complete') playCompleteSound()
    else playConnectSound(next.connected - 1)
  }

  /** 画面上の指の位置を、星の座標（0〜100）へ直す。大きさがわからないときは使わない。 */
  const toBoardPoint = (event: PointerEvent<SVGSVGElement>): [number, number] | null => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null
    return [
      VIEW_MIN + ((event.clientX - rect.left) / rect.width) * VIEW_SIZE,
      VIEW_MIN + ((event.clientY - rect.top) / rect.height) * VIEW_SIZE,
    ]
  }

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    if (complete) return
    primeAudio()
    const point = toBoardPoint(event)
    const starElement = (event.target as Element).closest('[data-star-index]')
    const starIndex = starElement
      ? Number(starElement.getAttribute('data-star-index'))
      : point
        ? findStarNear(constellation, point[0], point[1], TOUCH_RADIUS)
        : undefined
    if (starIndex !== undefined) handleStar(starIndex, true)
    draggingRef.current = true
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      /* ポインタを捕まえられない環境でも、タップだけで遊べる。 */
    }
    setPointer(point)
  }

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!draggingRef.current || complete) return
    const point = toBoardPoint(event)
    if (!point) return
    setPointer(point)
    const starIndex = findStarNear(constellation, point[0], point[1], TOUCH_RADIUS)
    if (starIndex !== undefined) handleStar(starIndex, false)
  }

  const endDrag = () => {
    draggingRef.current = false
    setPointer(null)
  }

  const handleStarKeyDown = (event: KeyboardEvent<SVGGElement>, starIndex: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    primeAudio()
    handleStar(starIndex, true)
  }

  const center = centerOf(constellation)
  const connectedPoints = constellation.points.slice(0, board.connected)
  const lastPoint = connectedPoints[connectedPoints.length - 1]
  const pointsAttribute = (points: readonly (readonly [number, number])[]) =>
    points.map(([x, y]) => `${x},${y}`).join(' ')
  const nextNumber = board.connected + 1

  const status = complete
    ? `${constellation.name}の せいざが できた！`
    : board.connected === 0
      ? '1の ほしから つなごう'
      : `つぎは ${nextNumber}の ほし`

  const page = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🌙</span> よぞらの ほしつなぎ
        </h1>
      </header>

      {phase === 'select' ? (
        <>
          <p id="hoshi-tsunagi-instruction" className={styles.instruction}>
            コースを えらんでね
          </p>
          <div className={styles.courseGrid} role="group" aria-labelledby="hoshi-tsunagi-instruction">
            {(Object.keys(COURSE_LABELS) as HoshiCourse[]).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.courseButton}
                aria-label={`${COURSE_LABELS[option].name} ${COURSE_LABELS[option].hint}`}
                onClick={() => startCourse(option)}
              >
                <span className={styles.courseEmojis} aria-hidden="true">
                  {courseConstellations(option)
                    .map((item) => item.emoji)
                    .join('')}
                </span>
                <span className={styles.courseName}>{COURSE_LABELS[option].name}</span>
                <span className={styles.courseHint}>{COURSE_LABELS[option].hint}</span>
                <StageClearBadge stars={progress[option] ?? 0} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {phase === 'play' ? (
        <>
          <div className={styles.statusRow}>
            <p className={styles.status} role="status">
              {status}
            </p>
            <div className={styles.stageNav}>
              <button
                type="button"
                className={styles.stageNavButton}
                aria-label="まえの せいざ"
                disabled={stageIndex === 0}
                onClick={() => moveStage(-1)}
              >
                <span aria-hidden="true">◀</span>
              </button>
              <ol className={styles.progress} aria-label={`${stageIndex + 1}こめ / ${constellations.length}こ`}>
                {constellations.map((item, index) => (
                  <li
                    key={item.id}
                    className={[
                      styles.progressDot,
                      cleared.has(index) ? styles.progressDone : '',
                      index === stageIndex ? styles.progressCurrent : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <span aria-hidden="true">
                      {cleared.has(index) ? item.emoji : '・'}
                    </span>
                  </li>
                ))}
              </ol>
              <button
                type="button"
                className={styles.stageNavButton}
                aria-label="つぎの せいざへ すすむ"
                disabled={isLastStage}
                onClick={() => moveStage(1)}
              >
                <span aria-hidden="true">▶</span>
              </button>
            </div>
          </div>

          <svg
            key={`${course}-${constellation.id}`}
            className={styles.sky}
            viewBox={`${VIEW_MIN} ${VIEW_MIN} ${VIEW_SIZE} ${VIEW_SIZE}`}
            role="group"
            aria-label={complete ? `${constellation.name}の せいざ` : 'よぞら'}
            data-connected={board.connected}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          >
            <g aria-hidden="true">
              {BACKGROUND_STARS.map((star, index) => (
                <circle
                  key={index}
                  className={styles.twinkle}
                  cx={star.x}
                  cy={star.y}
                  r={star.r}
                  style={{ animationDelay: `${star.delay}s` }}
                />
              ))}
            </g>

            {complete ? (
              <line className={styles.shootingStar} x1={-10} y1={4} x2={-2} y2={8} aria-hidden="true" />
            ) : null}

            <g className={complete ? `${styles.shape} ${MOTION_CLASS[constellation.motion] ?? ''}` : styles.shape}>
              {complete ? (
                <polygon
                  className={styles.fill}
                  points={pointsAttribute(constellation.points)}
                  style={{ fill: constellation.color }}
                  aria-hidden="true"
                />
              ) : null}
              {complete ? (
                <polygon className={styles.line} points={pointsAttribute(constellation.points)} aria-hidden="true" />
              ) : connectedPoints.length > 1 ? (
                <polyline className={styles.line} points={pointsAttribute(connectedPoints)} aria-hidden="true" />
              ) : null}

              {!complete && pointer && lastPoint ? (
                <line
                  className={styles.rubberBand}
                  x1={lastPoint[0]}
                  y1={lastPoint[1]}
                  x2={pointer[0]}
                  y2={pointer[1]}
                  aria-hidden="true"
                />
              ) : null}

              {constellation.points.map((point, index) => {
                const done = index < board.connected
                const isNext = !complete && index === board.connected
                const glowing = isNext && (board.hint || board.connected === 0)
                const [labelX, labelY] = labelPosition(point, center)
                const shaking = wrong?.index === index
                return (
                  <g
                    key={shaking ? `${index}-${wrong.count}` : index}
                    data-star-index={index}
                    className={[
                      styles.star,
                      done ? styles.starDone : '',
                      glowing ? styles.starHint : '',
                      shaking ? styles.starWrong : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    role="button"
                    tabIndex={complete ? -1 : 0}
                    aria-label={`${index + 1}の ほし${done ? ' つないだ' : ''}`}
                    onKeyDown={(event) => handleStarKeyDown(event, index)}
                  >
                    <circle className={styles.starHit} cx={point[0]} cy={point[1]} r={TOUCH_RADIUS} />
                    {glowing ? <circle className={styles.starRing} cx={point[0]} cy={point[1]} r={5} /> : null}
                    <circle className={styles.starGlow} cx={point[0]} cy={point[1]} r={3.6} />
                    <circle className={styles.starCore} cx={point[0]} cy={point[1]} r={2} />
                    {complete ? null : (
                      <text className={styles.starNumber} x={labelX} y={labelY} textAnchor="middle" aria-hidden="true">
                        {index + 1}
                      </text>
                    )}
                  </g>
                )
              })}

              {complete ? (
                <text
                  className={styles.emoji}
                  x={center[0]}
                  y={center[1]}
                  textAnchor="middle"
                  dominantBaseline="central"
                  aria-hidden="true"
                >
                  {constellation.emoji}
                </text>
              ) : null}
            </g>
          </svg>

          <div className={styles.actions}>
            {complete ? (
              <button type="button" className={`${styles.button} ${styles.next}`} onClick={goNext}>
                {isLastStage ? 'おしまい' : 'つぎの せいざ'}
              </button>
            ) : null}
            <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={backToSelect}>
              やめる
            </button>
          </div>
        </>
      ) : null}

      {phase === 'finished' ? (
        <>
          <p className={styles.resultEmojis} aria-hidden="true">
            {constellations.map((item) => item.emoji).join('')}
          </p>
          <p className={styles.resultMessage} role="status">
            ぜんぶの せいざが できたね！
          </p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.next}`} onClick={() => startCourse(course)}>
              もういちど
            </button>
            <button type="button" className={`${styles.button} ${styles.quiet}`} onClick={backToSelect}>
              コースを えらぶ
            </button>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={styles.soundToggle}
        aria-label={soundOn ? 'おとを けす' : 'おとを だす'}
        onClick={() => setSoundOn((current) => !current)}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
      </button>
    </main>
  )

  // 選択画面には長押しメニュー抑制をかけず、プレイ中・結果表示だけをGamePlaySurfaceで包む（Issue #166）。
  return phase === 'select' ? page : <GamePlaySurface>{page}</GamePlaySurface>
}
