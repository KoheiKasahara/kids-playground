import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { Cell, Sandbox, renderSandbox, type Material, type Point } from './sandboxSimulation'

type Brush = { material: Material; radius: number }
type Gesture = Brush & { point: Point; pointerId: number }
export function useSandbox(canvasRef: RefObject<HTMLCanvasElement | null>, brush: Brush, paused: boolean, onFlower: () => void) {
  const [world] = useState(() => { const result = new Sandbox(); result.prepare(); return result })
  const [crabCount, setCrabCount] = useState(0)
  const [turtleCount, setTurtleCount] = useState(0)
  const [creatureMessage, setCreatureMessage] = useState('')
  const active = useRef<Gesture | null>(null)
  const keyboardPoint = useRef<Point>({ x: 72, y: 30 })
  const draw = useRef<() => void>(() => {})
  const [unavailable, setUnavailable] = useState(false)
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
    draw.current = () => { renderSandbox(world, pixels.data); context.putImageData(pixels, 0, 0) }
    let request = 0, last = 0, emitted = 0, flowers = world.flowers
    const frame = (time: number) => {
      if (document.hidden) return
      if (time - last >= 1000 / 30) {
        last = time
        const gesture = active.current
        if (gesture && (gesture.material !== Cell.Seed || emitted++ % 6 === 0)) world.paint(gesture.point, gesture.material, gesture.radius)
        if (!paused) { world.step(); world.step() }
        if (world.flowers > flowers) onFlower()
        flowers = world.flowers
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
  }, [canvasRef, world, paused, onFlower, stop])

  const point = (event: PointerEvent<HTMLCanvasElement>): Point | null => {
    const box = event.currentTarget.getBoundingClientRect()
    if (!box.width || !box.height || event.clientX < box.left || event.clientX >= box.right || event.clientY < box.top || event.clientY >= box.bottom) return null
    return { x: (event.clientX - box.left) / box.width * world.width, y: (event.clientY - box.top) / box.height * world.height }
  }
  const begin = (event: PointerEvent<HTMLCanvasElement>) => {
    if (active.current || event.button !== 0 || event.isPrimary === false) return
    if (!event.currentTarget.getContext('2d')) { setUnavailable(true); return }
    const p = point(event)
    if (!p) return
    event.preventDefault()
    event.currentTarget.focus({ preventScroll: true })
    if (world.tapCrab(p) || world.tapTurtle(p)) { draw.current(); return }
    event.currentTarget.setPointerCapture(event.pointerId)
    active.current = { ...brush, point: p, pointerId: event.pointerId }
    world.paint(p, brush.material, brush.radius)
    draw.current()
  }
  const move = (event: PointerEvent<HTMLCanvasElement>) => {
    const gesture = active.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    const p = point(event)
    // End on leaving the play area; never clamp an outside drag into a stream at its edge.
    if (!p) { stop(); return }
    event.preventDefault()
    if (gesture.material === Cell.Seed) {
      if (Math.hypot(p.x - gesture.point.x, p.y - gesture.point.y) >= 6) world.paint(p, Cell.Seed, 0)
    } else world.stroke(gesture.point, p, gesture.material, gesture.radius)
    gesture.point = p
    draw.current()
  }
  const end = (event: PointerEvent<HTMLCanvasElement>) => { if (active.current?.pointerId === event.pointerId) stop() }
  const keyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const p = keyboardPoint.current
    const directions: Record<string, Point> = { ArrowLeft: { x: -5, y: 0 }, ArrowRight: { x: 5, y: 0 }, ArrowUp: { x: 0, y: -5 }, ArrowDown: { x: 0, y: 5 } }
    const direction = directions[event.key]
    if (direction) {
      event.preventDefault()
      p.x = Math.max(0, Math.min(world.width - 1, p.x + direction.x))
      p.y = Math.max(0, Math.min(world.height - 1, p.y + direction.y))
      event.currentTarget.style.setProperty('--cursor-x', `${p.x / world.width * 100}%`)
      event.currentTarget.style.setProperty('--cursor-y', `${p.y / world.height * 100}%`)
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault()
      if (!world.tapCrab(p) && !world.tapTurtle(p)) world.paint(p, brush.material, brush.radius)
      draw.current()
    }
  }
  return {
    unavailable, stop, crabCount, turtleCount, creatureMessage,
    dismissCreatureMessage: () => setCreatureMessage(''),
    addCrab: () => {
      stop()
      const added = world.addCrab()
      setCrabCount(world.crabs.length)
      setCreatureMessage(added ? '🦀 おはなを たべると おおきくなるよ' : 'カニの はいる ばしょを あけてね')
      draw.current()
    },
    addTurtle: () => {
      stop()
      const added = world.addTurtle()
      setTurtleCount(world.turtles.length)
      setCreatureMessage(added ? '🐢 おはなを たべると おおきくなるよ' : 'カメの はいる ばしょを あけてね')
      draw.current()
    },
    canvasProps: { width: world.width, height: world.height, onPointerDown: begin, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onKeyDown: keyDown },
    clear: () => { stop(); world.clear(); setCrabCount(0); setTurtleCount(0); setCreatureMessage(''); draw.current() },
    shake: () => { stop(); world.shake(); draw.current() },
  }
}
