import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type RefObject } from 'react'
import { Sandbox, isSeed, renderSandbox, sandboxGrid, type Material, type Point } from './sandboxSimulation'

type Brush = { material: Material; radius: number }
type Gesture = Brush & { point: Point; pointerId: number }
export function useSandbox(canvasRef: RefObject<HTMLCanvasElement | null>, brush: Brush, paused: boolean, onFlower: () => void) {
  const [world] = useState(() => { const result = new Sandbox(); result.prepare(); return result })
  const [crabCount, setCrabCount] = useState(0)
  const [hermitCount, setHermitCount] = useState(0)
  const [turtleCount, setTurtleCount] = useState(0)
  const [butterflyCount, setButterflyCount] = useState(0)
  const [creatureMessage, setCreatureMessage] = useState('')
  const active = useRef<Gesture | null>(null)
  const keyboardPoint = useRef<Point>({ x: 72, y: 30 })
  const draw = useRef<() => void>(() => {})
  const untouched = useRef(true)
  // fit() owns the bitmap size from the first frame on; React keeps the attributes it
  // rendered, because re-setting width or height would blank the canvas mid-play.
  const [bitmap] = useState({ width: world.width, height: world.height })
  const [unavailable, setUnavailable] = useState(false)
  const stop = useCallback(() => {
    const pointer = active.current?.pointerId
    active.current = null
    if (pointer !== undefined && canvasRef.current?.hasPointerCapture(pointer)) canvasRef.current.releasePointerCapture(pointer)
  }, [canvasRef])
  useEffect(() => {
    const element = canvasRef.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    let pixels = context.createImageData(world.width, world.height)
    draw.current = () => { renderSandbox(world, pixels.data); context.putImageData(pixels, 0, 0) }
    // Give the grid the shape of the board. A portrait grid stretched across a
    // landscape board drew every crab, turtle and butterfly twice as wide as it is tall.
    const fit = () => {
      const box = element.getBoundingClientRect()
      const grid = sandboxGrid(box.width, box.height)
      if (!grid) return
      const fresh = untouched.current
      untouched.current = false
      // Leave a grain or two of play, so a creeping address bar cannot rebuild the world every frame.
      if (Math.abs(grid.width - world.width) <= 2 && Math.abs(grid.height - world.height) <= 2) return
      // A pour in flight holds a spot on the old grid, so let go of it before re-shaping.
      stop()
      if (!world.resize(grid.width, grid.height)) return
      // The first fit lands before anyone has drawn: start from dunes made for this shape.
      if (fresh) world.prepare()
      element.width = world.width
      element.height = world.height
      pixels = context.createImageData(world.width, world.height)
      const cursor = keyboardPoint.current
      cursor.x = Math.min(cursor.x, world.width - 1)
      cursor.y = Math.min(cursor.y, world.height - 1)
      draw.current()
    }
    let request = 0, last = 0, emitted = 0, flowers = world.flowers
    const frame = (time: number) => {
      if (document.hidden) return
      if (time - last >= 1000 / 30) {
        last = time
        const gesture = active.current
        if (gesture && (!isSeed(gesture.material) || emitted++ % 6 === 0)) world.paint(gesture.point, gesture.material, gesture.radius)
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
    const reshape = () => { stop(); fit() }
    fit()
    draw.current()
    if (!document.hidden) request = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', suspend)
    window.addEventListener('blur', stop)
    window.addEventListener('resize', reshape)
    // jsdom has no ResizeObserver; there the window resize above carries the change.
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(fit)
    observer?.observe(element)
    return () => {
      stop()
      cancelAnimationFrame(request)
      draw.current = () => {}
      observer?.disconnect()
      document.removeEventListener('visibilitychange', suspend)
      window.removeEventListener('blur', stop)
      window.removeEventListener('resize', reshape)
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
    if (world.tapButterfly(p) || world.tapCrab(p) || world.tapHermit(p) || world.tapTurtle(p)) { draw.current(); return }
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
    if (isSeed(gesture.material)) {
      if (Math.hypot(p.x - gesture.point.x, p.y - gesture.point.y) >= 6) world.paint(p, gesture.material, 0)
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
      if (!world.tapButterfly(p) && !world.tapCrab(p) && !world.tapHermit(p) && !world.tapTurtle(p)) world.paint(p, brush.material, brush.radius)
      draw.current()
    }
  }
  return {
    unavailable, stop, crabCount, hermitCount, turtleCount, butterflyCount, creatureMessage,
    setNight: (night: boolean) => { stop(); world.setNight(night); draw.current() },
    dismissCreatureMessage: () => setCreatureMessage(''),
    addCrab: () => {
      stop()
      const added = world.addCrab()
      setCrabCount(world.crabs.length)
      setCreatureMessage(added ? '🦀 おはなを たべると おおきくなるよ' : 'カニの はいる ばしょを あけてね')
      draw.current()
    },
    addHermit: () => {
      stop()
      const added = world.addHermit()
      setHermitCount(world.hermits.length)
      setCreatureMessage(added ? '🐚 おはなを たべると おおきくなるよ' : 'ヤドカリの はいる ばしょを あけてね')
      draw.current()
    },
    addTurtle: () => {
      stop()
      const added = world.addTurtle()
      setTurtleCount(world.turtles.length)
      setCreatureMessage(added ? '🐢 おはなを たべると おおきくなるよ' : 'カメの はいる ばしょを あけてね')
      draw.current()
    },
    addButterfly: () => {
      stop()
      const added = world.addButterfly()
      setButterflyCount(world.butterflies.length)
      setCreatureMessage(added ? '🦋 おはなに とまると たねが とぶよ' : 'ちょうちょの とぶ ばしょを あけてね')
      draw.current()
    },
    canvasProps: { width: bitmap.width, height: bitmap.height, onPointerDown: begin, onPointerMove: move, onPointerUp: end, onPointerCancel: end, onLostPointerCapture: end, onKeyDown: keyDown },
    clear: () => { stop(); world.clear(); setCrabCount(0); setHermitCount(0); setTurtleCount(0); setButterflyCount(0); setCreatureMessage(''); draw.current() },
    shake: () => { stop(); world.shake(); draw.current() },
  }
}
