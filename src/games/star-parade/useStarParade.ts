import { useEffect, useRef, useState } from 'react'
import { observeGameActivity } from '../../utils/gameActivity'
import { vibrate } from '../../utils/haptics'
import { createCourse } from './course'
import { initialRun, jumpHeight, jumpRun, stepRun } from './game'
import { playFinish, playGrow, playHit, playJump, playShrink, playStart } from './sounds'
import { drawWorld, type WorldFrame } from './world'

type Side = -1 | 1
type Steering = { x: number; held: Set<Side>; sampledAt: number }

function clearSteering(x: number): Steering {
  return { x, held: new Set(), sampledAt: 0 }
}

// Sample at both input edges as well as on animation frames. Even a very short
// tap contributes only the distance corresponding to the time it was held.
function sampleSteering(input: Steering, now: number) {
  const seconds = Math.min(0.1, Math.max(0, now - input.sampledAt) / 1000)
  const direction = Number(input.held.has(1)) - Number(input.held.has(-1))
  input.x += direction * seconds * 1.45
  input.sampledAt = Math.max(input.sampledAt, now)
}

export function useStarParade() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [course, setCourse] = useState(() => createCourse())
  const [phase, setPhase] = useState<WorldFrame['phase']>('ready')
  const [paused, setPaused] = useState(false)
  // Keep continuous movement out of React. Only gate crossings change the HUD.
  const [hud, setHud] = useState(() => ({ count: initialRun().count, passed: 0, delta: 0, hit: false }))
  const run = useRef(initialRun())
  const steering = useRef(clearSteering(0))
  const finish = course.length + 1

  function resetRun() {
    const start = initialRun()
    run.current = start
    steering.current = clearSteering(start.playerX)
    setHud({ count: start.count, passed: start.passed, delta: 0, hit: false })
    setPaused(false)
  }

  function start() {
    if (phase === 'finished') setCourse(createCourse())
    resetRun()
    playStart()
    vibrate('tap')
    setPhase('running')
  }

  function backToStart() {
    resetRun()
    setCourse(createCourse())
    setPhase('ready')
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let ctx: CanvasRenderingContext2D | null = null
    let width = 0
    let height = 0
    let elapsed = 0
    let raf = 0
    let last: number | undefined
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

    function paint() {
      if (!ctx || !width || !height) return
      drawWorld(ctx, width, height, {
        ...run.current, gates: course, phase, finish, jump: jumpHeight(run.current),
        time: reduceMotion ? 0 : elapsed,
        celebration: phase === 'finished' ? (reduceMotion ? 1 : elapsed) : 0,
      })
    }

    function resize() {
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      width = rect.width
      height = rect.height
      if (!width || !height) return
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      ctx = canvas.getContext('2d', { alpha: false })
      ctx?.setTransform(scale, 0, 0, scale, 0, 0)
      paint()
    }

    function frame(now: number) {
      raf = 0
      if (last === undefined) last = now
      const ms = now - last
      if (phase === 'running' || ms >= 1000 / 24) {
        const dt = Math.min(ms / 1000, 0.1)
        elapsed += dt
        last = now
        if (phase === 'running') {
          const previous = run.current
          const input = steering.current
          sampleSteering(input, now)
          const next = stepRun(previous, dt, input.x, course)
          // While held, advance from the actual position, including at a road edge.
          if (input.held.size > 0 && dt > 0) input.x = next.playerX
          run.current = next
          if (next.passed !== previous.passed) {
            const delta = next.count - previous.count
            const hit = next.lastEvent === 'hit'
            setHud({ count: next.count, passed: next.passed, delta, hit })
            if (hit) playHit()
            if (next.lastEvent === 'shrink') playShrink()
            if (next.lastEvent === 'grow') playGrow()
            if (hit || delta !== 0) vibrate(hit ? 'impact' : 'tap')
          }
          if (next.finished) {
            playFinish()
            vibrate('celebrate')
            setPhase('finished')
            return
          }
        }
        paint()
      }
      raf = requestAnimationFrame(frame)
    }

    resize()
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null
    observer?.observe(canvas)
    window.addEventListener('resize', resize)
    const unsubscribe = observeGameActivity(active => {
      cancelAnimationFrame(raf)
      last = undefined
      if (!active || paused) steering.current = clearSteering(run.current.playerX)
      if (active && !paused && (!reduceMotion || phase === 'running')) {
        raf = requestAnimationFrame(frame)
      }
    })
    return () => {
      unsubscribe()
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', resize)
    }
  }, [course, finish, paused, phase])

  function steer(x: number) {
    if (phase === 'running' && !paused) steering.current = clearSteering(x)
  }

  function hold(side: Side, down: boolean) {
    if (phase !== 'running' || paused) return
    const input = steering.current
    if (input.held.has(side) === down) return
    if (down && input.held.size === 0) input.x = run.current.playerX
    sampleSteering(input, performance.now())
    if (down) input.held.add(side)
    else input.held.delete(side)
  }

  function nudge(side: Side) {
    steer(run.current.playerX + side * 0.12)
  }

  function jump() {
    if (phase !== 'running' || paused) return
    const next = jumpRun(run.current)
    if (next === run.current) return
    run.current = next
    playJump()
    vibrate('tap')
  }

  return { canvasRef, course, phase, paused, setPaused, hud, start, backToStart, steer, hold, nudge, jump }
}
