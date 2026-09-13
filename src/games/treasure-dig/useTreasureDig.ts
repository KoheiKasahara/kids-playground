import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { TreasureWorld, renderWorld, type Point, type Tool } from './treasureWorld'
import { buildLayout, type Stage } from './stages'
import { playDigClearSound, playDigSound, playTreasureSound } from './sounds'

export type Brush = { tool: Tool; radius: number }
export type DigStatus = 'playing' | 'cleared' | 'stuck'
type Gesture = Brush & { point: Point; pointerId: number }

/**
 * 1ステージぶんの ばんめんを持ち、えがくのは canvas へ直接、
 * Reactへ返すのは「あつめた数」と「状態」だけにする。
 * つぶ1個ごとに再レンダリングしないので、砂が流れていても画面が重くならない。
 */
export function useTreasureDig(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  stage: Stage,
  brush: Brush,
  paused: boolean,
  onCleared: (perfect: boolean) => void,
) {
  const [world] = useState(() => new TreasureWorld(buildLayout(stage), stage.need))
  const [collected, setCollected] = useState(0)
  const [status, setStatus] = useState<DigStatus>('playing')
  const [idle, setIdle] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const active = useRef<Gesture | null>(null)
  const cursor = useRef<Point>({ x: Math.round(world.width / 2), y: Math.round(world.height / 4) })
  const draw = useRef<() => void>(() => {})
  const finished = useRef(false)
  const celebrated = useRef(false)
  const touched = useRef(false)

  const stop = useCallback(() => {
    const pointer = active.current?.pointerId
    active.current = null
    if (pointer !== undefined && canvasRef.current?.hasPointerCapture(pointer)) canvasRef.current.releasePointerCapture(pointer)
  }, [canvasRef])

  useEffect(() => {
    const element = canvasRef.current
    const context = element?.getContext('2d')
    if (!context) return
    const pixels = context.createImageData(world.width, world.height)
    let tick = 0
    draw.current = () => { renderWorld(world, pixels.data, tick); context.putImageData(pixels, 0, 0) }
    let request = 0, last = 0, shown = world.collected, resting = 0
    const frame = (time: number) => {
      if (document.hidden) return
      if (time - last >= 1000 / 30) {
        last = time
        tick++
        // おしっぱなしの あいだは ふり続ける。みずを かけて ながす遊びは これで成り立つ。
        const gesture = active.current
        if (gesture && world.apply(gesture.point, gesture.tool, gesture.radius) && gesture.tool === 'dig') playDigSound()

        if (!paused) { world.step(); world.step() }
        if (world.collected !== shown) {
          if (world.collected > shown) playTreasureSound(world.collected, world.need)
          shown = world.collected
          setCollected(shown)
        }
        if (!finished.current && world.cleared) {
          finished.current = true
          celebrated.current = world.perfect
          stop()
          setStatus('cleared')
          playDigClearSound()
          onCleared(world.perfect)
        } else if (finished.current && !celebrated.current && world.perfect) {
          // クリア直後に のこりの つぶが 入りきる ことがある。そのぶんも記録する。
          celebrated.current = true
          onCleared(true)
        } else if (!finished.current && world.hopeless) setStatus('stuck')
        // すべての つぶが とまったら、つぎの ひと ほりを うながす。
        resting = paused || world.activity > 0 || !touched.current ? 0 : resting + 1
        setIdle(!finished.current && resting > 45)
        draw.current()
      }
      request = requestAnimationFrame(frame)
    }
    const suspend = () => {
      stop()
      cancelAnimationFrame(request)
      if (!document.hidden) { last = 0; request = requestAnimationFrame(frame) }
    }
    draw.current()
    if (!document.hidden) request = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', suspend)
    window.addEventListener('blur', stop)
    window.addEventListener('resize', stop)
    return () => {
      stop()
      cancelAnimationFrame(request)
      draw.current = () => {}
      document.removeEventListener('visibilitychange', suspend)
      window.removeEventListener('blur', stop)
      window.removeEventListener('resize', stop)
    }
  }, [canvasRef, world, paused, onCleared, stop])

  const point = (event: PointerEvent<HTMLCanvasElement>): Point | null => {
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width || !box.height || event.clientX < box.left || event.clientX >= box.right || event.clientY < box.top || event.clientY >= box.bottom) return null
    return { x: (event.clientX - box.left) / box.width * world.width, y: (event.clientY - box.top) / box.height * world.height }
  }
  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    if (active.current || finished.current || event.button !== 0 || event.isPrimary === false) return
    if (!event.currentTarget.getContext('2d')) { setUnavailable(true); return }
    const p = point(event)
    if (!p) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current = { ...brush, point: p, pointerId: event.pointerId }
    cursor.current = p
    if (world.apply(p, brush.tool, brush.radius)) { touched.current = true; if (brush.tool === 'dig') playDigSound() }
    draw.current()
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const gesture = active.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const p = point(event)
    // ばんめんの外へ 出たら そこで やめる。はしで 線が たまらないようにする。
    if (!p) { stop(); return }
    event.preventDefault()
    if (world.stroke(gesture.point, p, gesture.tool, gesture.radius)) { touched.current = true; if (gesture.tool === 'dig') playDigSound() }
    gesture.point = p
    cursor.current = p
    draw.current()
  }
  const end = (event: PointerEvent<HTMLCanvasElement>) => { if (active.current?.pointerId === event.pointerId) stop() }
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const p = cursor.current
    const directions: Record<string, Point> = { ArrowLeft: { x: -4, y: 0 }, ArrowRight: { x: 4, y: 0 }, ArrowUp: { x: 0, y: -4 }, ArrowDown: { x: 0, y: 4 } }
    const direction = directions[event.key]
    if (direction) {
      event.preventDefault()
      p.x = Math.max(0, Math.min(world.width - 1, p.x + direction.x))
      p.y = Math.max(0, Math.min(world.height - 1, p.y + direction.y))
      event.currentTarget.style.setProperty('--cursor-x', `${p.x / world.width * 100}%`)
      event.currentTarget.style.setProperty('--cursor-y', `${p.y / world.height * 100}%`)
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (finished.current) return
      if (world.apply(p, brush.tool, brush.radius)) { touched.current = true; if (brush.tool === 'dig') playDigSound() }
      draw.current()
    }
  }

  return {
    world, collected, status, idle, unavailable, stop,
    retry: () => {
      stop()
      world.reset()
      finished.current = false
      celebrated.current = false
      touched.current = false
      setCollected(0)
      setStatus('playing')
      setIdle(false)
      draw.current()
    },
    canvasProps: {
      width: world.width, height: world.height,
      onPointerDown: begin, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onKeyDown: keyDown,
    },
  }
}
