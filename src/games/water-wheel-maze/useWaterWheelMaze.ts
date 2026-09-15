import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { DISC, GRID_HEIGHT, GRID_WIDTH } from './scene'
import { buildRingShapes } from './rings'
import { WaterMaze } from './waterMaze'
import { drawScene } from './render'
import { TOTAL_RIDERS, easeAngle, ridersDelivered, toyAngle, wheelAngle } from './wheelDrive'
import { playDropSound, playRiderSound, playWheelClearSound } from './sounds'
import type { Stage } from './stages'

/** 1こまで まわせる 角度の上限。はやく はらっても かべが 水を すり抜けないようにする。 */
const MAX_ROTATE_PER_FRAME = 15
/** ボタンを おしっぱなしに した ときの 1こまぶんの 角度。 */
const BUTTON_SPIN = 4
/** ボタンを 1回 タップ／Enterした ときの 角度。 */
const TAP_SPIN = 20
/** やじるしキー 1回ぶんの 角度。 */
const KEY_SPIN = 8
/** まんなかに 近すぎる ゆびは 角度が あばれるので うけつけない。 */
const GRIP_RADIUS = 10
/** これだけの こま すべてが とまっていたら「まわしてね」と つたえる。 */
const SETTLED_FRAMES = 70
/** ゴールしても みずが とまらない ときに、クリア画面を 出すまでの こま数。 */
const GOAL_GRACE_FRAMES = 420

export type Spin = -1 | 1

/** −180..180 の さしひき。0度を またいでも 近いほうへ まわす。 */
export function shortestTurn(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180
}

/**
 * 1ステージぶんの 円形めいろを 持ち、えがくのは canvas へ 直接、
 * Reactへ返すのは かぞえた けっかだけにする。水つぶ 1こごとに 再レンダリングしない。
 */
export function useWaterWheelMaze(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  stage: Stage,
  onCleared: (perfect: boolean) => void,
) {
  const [maze] = useState(() => new WaterMaze(stage.rings))
  const [rings] = useState(() => buildRingShapes(stage.rings))
  const [caught, setCaught] = useState(0)
  const [riders, setRiders] = useState(0)
  const [reachedGoal, setReachedGoal] = useState(false)
  const [cleared, setCleared] = useState(false)
  const [started, setStarted] = useState(false)
  const [settled, setSettled] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  /** ゆびや ボタンから たまった「まだ まわしていない 角度」。 */
  const pending = useRef(0)
  const holding = useRef<Spin | 0>(0)
  const grip = useRef<{ pointerId: number; angle: number } | null>(null)
  /** ゴールに とどいたか。とどいても そのまま あそび続けられる。 */
  const goal = useRef(false)
  /** クリア画面を 出したか。ここから さきは まわせない。 */
  const carded = useRef(false)
  const perfect = useRef(false)
  const redraw = useRef<() => void>(() => {})
  /** えがくためだけの うごき。やりなおしで もとに もどせるよう ref にまとめて持つ。 */
  const anim = useRef({ tick: 0, wheel: 0, toy: 0, splash: 0, caught: 0, riders: 0, resting: 0, sinceGoal: 0 })

  const release = useCallback(() => {
    const pointer = grip.current?.pointerId
    grip.current = null
    holding.current = 0
    if (pointer !== undefined && canvasRef.current?.hasPointerCapture(pointer)) canvasRef.current.releasePointerCapture(pointer)
  }, [canvasRef])

  const turn = useCallback((degrees: number) => {
    if (carded.current) return
    pending.current += degrees
    setStarted(true)
  }, [])

  useEffect(() => {
    const element = canvasRef.current
    const context = element?.getContext('2d')
    if (!element || !context) { setUnavailable(true); return }

    let unit = 3
    const resize = () => {
      const density = Math.min(window.devicePixelRatio || 1, 2.5)
      const width = Math.max(1, Math.round((element.clientWidth || GRID_WIDTH * 3) * density))
      element.width = width
      element.height = Math.round(width * GRID_HEIGHT / GRID_WIDTH)
      unit = width / GRID_WIDTH
    }
    resize()

    redraw.current = () => {
      const view = anim.current
      context.setTransform(unit, 0, 0, unit, 0, 0)
      drawScene(context, {
        rings, rotation: maze.rotation, water: maze.water,
        wheelAngle: view.wheel, toyAngle: view.toy, splash: view.splash,
        riders: ridersDelivered(maze.caught, stage.need), tick: view.tick,
      })
    }

    let request = 0
    let last = 0
    const frame = (time: number) => {
      if (document.hidden) return
      if (time - last >= 1000 / 60) {
        last = time
        const view = anim.current
        view.tick++
        if (holding.current) pending.current += holding.current * BUTTON_SPIN
        const waiting = pending.current
        if (waiting !== 0) {
          const applied = Math.sign(waiting) * Math.min(Math.abs(waiting), MAX_ROTATE_PER_FRAME)
          maze.rotate(applied)
          pending.current = waiting - applied
        }
        maze.step()

        if (maze.caught !== view.caught) {
          playDropSound()
          view.caught = maze.caught
          view.splash = 1
          setCaught(view.caught)
        }
        view.splash = Math.max(0, view.splash - 0.05)
        view.wheel = easeAngle(view.wheel, wheelAngle(maze.caught, stage.need))
        view.toy = easeAngle(view.toy, toyAngle(maze.caught, stage.need))

        const delivered = ridersDelivered(maze.caught, stage.need)
        if (delivered !== view.riders) {
          if (delivered > view.riders && delivered < TOTAL_RIDERS) playRiderSound(delivered, TOTAL_RIDERS)
          view.riders = delivered
          setRiders(delivered)
        }
        if (!goal.current && delivered >= TOTAL_RIDERS) {
          goal.current = true
          perfect.current = maze.remaining === 0
          playWheelClearSound()
          setReachedGoal(true)
          onCleared(perfect.current)
        } else if (goal.current && !perfect.current && maze.remaining === 0) {
          // ゴールの あとに のこりの水が 入りきることがある。そのぶんも 記録する。
          perfect.current = true
          onCleared(true)
        }
        // すべて とまったら、まわす操作を うながす。
        view.resting = maze.activity > 0 || pending.current !== 0 ? 0 : view.resting + 1
        setSettled(!goal.current && view.resting > SETTLED_FRAMES)
        // ゴールしても すぐには 止めず、のこりの みずを とどけきる時間を のこす。
        if (goal.current) view.sinceGoal++
        if (goal.current && !carded.current
          && (maze.remaining === 0 || view.resting > SETTLED_FRAMES || view.sinceGoal > GOAL_GRACE_FRAMES)) {
          carded.current = true
          release()
          setCleared(true)
        }
        redraw.current()
      }
      request = requestAnimationFrame(frame)
    }

    const observer = typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => { resize(); redraw.current() })
      : null
    observer?.observe(element)
    const suspend = () => {
      release()
      cancelAnimationFrame(request)
      if (!document.hidden) { last = 0; request = requestAnimationFrame(frame) }
    }
    redraw.current()
    if (!document.hidden) request = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', suspend)
    window.addEventListener('blur', release)
    return () => {
      release()
      cancelAnimationFrame(request)
      redraw.current = () => {}
      observer?.disconnect()
      document.removeEventListener('visibilitychange', suspend)
      window.removeEventListener('blur', release)
    }
  }, [canvasRef, maze, rings, stage.need, onCleared, release])

  /** ゆびの いちを、円盤の まんなかから見た 角度に なおす。 */
  const angleAt = (event: PointerEvent<HTMLCanvasElement>): number | null => {
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width || !box.height) return null
    const x = (event.clientX - box.left) / box.width * GRID_WIDTH - DISC.x
    const y = (event.clientY - box.top) / box.height * GRID_HEIGHT - DISC.y
    if (Math.hypot(x, y) < GRIP_RADIUS) return null
    return Math.atan2(y, x) * 180 / Math.PI
  }

  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    if (grip.current || carded.current || event.button !== 0 || event.isPrimary === false) return
    const angle = angleAt(event)
    if (angle === null) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    grip.current = { pointerId: event.pointerId, angle }
  }
  const drag = (event: PointerEvent<HTMLCanvasElement>) => {
    const held = grip.current
    if (!held || held.pointerId !== event.pointerId) return
    const angle = angleAt(event)
    if (angle === null) return
    event.preventDefault()
    turn(shortestTurn(held.angle, angle))
    held.angle = angle
  }
  const finish = (event: PointerEvent<HTMLCanvasElement>) => {
    if (grip.current?.pointerId === event.pointerId) release()
  }
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const direction = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0
    if (!direction) return
    event.preventDefault()
    turn(direction * KEY_SPIN)
  }

  return {
    maze, caught, riders, reachedGoal, cleared, started, settled, unavailable,
    /** ボタンを おしている あいだ まわしつづける。 */
    hold: (direction: Spin) => { if (!carded.current) holding.current = direction },
    stop: () => { holding.current = 0 },
    /** ボタンを 1回だけ おした／Enterした ときの ひとまわし。 */
    nudge: (direction: Spin) => turn(direction * TAP_SPIN),
    retry: () => {
      release()
      maze.reset()
      anim.current = { tick: 0, wheel: 0, toy: 0, splash: 0, caught: 0, riders: 0, resting: 0, sinceGoal: 0 }
      pending.current = 0
      goal.current = false
      carded.current = false
      perfect.current = false
      setCaught(0)
      setRiders(0)
      setReachedGoal(false)
      setCleared(false)
      setStarted(false)
      setSettled(false)
      redraw.current()
    },
    canvasProps: {
      onPointerDown: begin,
      onPointerMove: drag,
      onPointerUp: finish,
      onPointerCancel: finish,
      onLostPointerCapture: finish,
      onKeyDown: keyDown,
    },
  }
}
