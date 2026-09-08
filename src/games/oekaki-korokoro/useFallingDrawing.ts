import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { PAPER_HEIGHT, PAPER_WIDTH } from './rollerData'
import type { Point } from './rollerStroke'
import { appendDrawingPoint, BASKET, createDrawingWorld, LINE_WIDTH, type DrawingWorld } from './fallingDrawingWorld'

type Stroke = { id: number; points: Point[]; color: string; ball: boolean }

function drawLine(ctx: CanvasRenderingContext2D, points: Point[], color: string) {
  if (!points.length) return
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = LINE_WIDTH
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const p of points.slice(1)) ctx.lineTo(p.x, p.y)
  ctx.stroke()
  if (points.length === 1) { ctx.beginPath(); ctx.arc(points[0].x, points[0].y, LINE_WIDTH / 2, 0, Math.PI * 2); ctx.fill() }
}

function drawBall(ctx: CanvasRenderingContext2D, radius: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#fff9'
  ctx.beginPath(); ctx.arc(-radius * .3, -radius * .35, radius * .2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = '#514739'
  for (const x of [-7, 7]) { ctx.beginPath(); ctx.arc(x, -1, 2.5, 0, Math.PI * 2); ctx.fill() }
  ctx.lineWidth = 2.5; ctx.strokeStyle = '#514739'
  ctx.beginPath(); ctx.arc(0, 3, 8, .2, Math.PI - .2); ctx.stroke()
}

function paint(ctx: CanvasRenderingContext2D, world: DrawingWorld, stroke: Stroke | null) {
  ctx.clearRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
  ctx.fillStyle = '#fffdf8'; ctx.fillRect(0, 0, PAPER_WIDTH, PAPER_HEIGHT)
  ctx.fillStyle = '#eadfca'
  for (let y = 30; y < 690; y += 45) for (let x = 30; x < PAPER_WIDTH; x += 45) { ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill() }
  if (!world.draining) {
    ctx.fillStyle = '#c3ddbb'; ctx.fillRect(0, 690, PAPER_WIDTH, 30)
    ctx.fillStyle = world.celebration ? '#ffe494' : '#f2d6a1'
    ctx.fillRect(BASKET.left, BASKET.top, BASKET.right - BASKET.left, BASKET.bottom - BASKET.top)
    ctx.strokeStyle = '#c29355'; ctx.lineWidth = 3
    for (let x = BASKET.left + 20; x < BASKET.right; x += 22) { ctx.beginPath(); ctx.moveTo(x, BASKET.top); ctx.lineTo(x, BASKET.bottom); ctx.stroke() }
    for (let y = BASKET.top + 20; y < BASKET.bottom; y += 20) { ctx.beginPath(); ctx.moveTo(BASKET.left, y); ctx.lineTo(BASKET.right, y); ctx.stroke() }
    ctx.lineWidth = 14; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(BASKET.left, BASKET.top); ctx.lineTo(BASKET.left, BASKET.bottom); ctx.lineTo(BASKET.right, BASKET.bottom); ctx.lineTo(BASKET.right, BASKET.top); ctx.stroke()
  }
  for (const item of world.items) {
    ctx.save()
    ctx.translate(item.body.position.x, item.body.position.y)
    ctx.rotate(item.body.angle)
    if (item.radius) drawBall(ctx, item.radius, item.color)
    else drawLine(ctx, item.points, item.color)
    ctx.restore()
  }
  if (stroke) {
    ctx.save(); ctx.globalAlpha = .7
    if (stroke.ball) {
      const p = stroke.points.at(-1)!
      ctx.translate(p.x, p.y); drawBall(ctx, 23, stroke.color)
    } else drawLine(ctx, stroke.points, stroke.color)
    ctx.restore()
  }
  if (world.celebration) {
    const t = 1 - world.celebration / 1800
    for (let i = 0; i < 18; i++) {
      const a = i * Math.PI * 2 / 18
      ctx.fillStyle = ['#e95482', '#36a784', '#ed9234'][i % 3]
      ctx.beginPath(); ctx.arc(730 + Math.cos(a) * (30 + t * 150), 600 + Math.sin(a) * t * 150 - t * 110, 6 * (1 - t), 0, Math.PI * 2); ctx.fill()
    }
  }
}

export function useFallingDrawing(active: boolean, color: string, ball: boolean) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const world = useRef<DrawingWorld | null>(null)
  const stroke = useRef<Stroke | null>(null)
  const [status, setStatus] = useState({ canUndo: false, draining: false, goals: 0 })

  function publish() {
    const w = world.current
    if (!w) return
    setStatus(old => old.canUndo === w.canUndo && old.draining === w.draining && old.goals === w.goals ? old : { canUndo: w.canUndo, draining: w.draining, goals: w.goals })
  }

  function release() {
    const current = stroke.current
    stroke.current = null
    if (current && canvas.current?.hasPointerCapture(current.id)) canvas.current.releasePointerCapture(current.id)
    return current
  }

  useEffect(() => {
    const w = createDrawingWorld()
    world.current = w
    const cancel = () => { release() }
    window.addEventListener('blur', cancel)
    window.addEventListener('resize', cancel)
    document.addEventListener('visibilitychange', cancel)
    return () => {
      window.removeEventListener('blur', cancel)
      window.removeEventListener('resize', cancel)
      document.removeEventListener('visibilitychange', cancel)
      release(); w.destroy(); world.current = null
    }
  }, [])

  useEffect(() => {
    if (!active) { release(); return }
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    let frame = 0, previous = 0, accumulator = 0
    const tick = (now: number) => {
      const w = world.current
      if (!w) return
      if (document.hidden) { previous = 0; accumulator = 0 }
      else {
        accumulator += previous ? Math.min(now - previous, 50) : 0
        previous = now
        while (accumulator >= 1000 / 60) { w.step(); accumulator -= 1000 / 60 }
        paint(ctx, w, stroke.current)
        publish()
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [active])

  function point(event: { clientX: number; clientY: number }): Point | null {
    const box = canvas.current?.getBoundingClientRect()
    if (!box?.width || !box.height) return null
    return { x: Math.max(12, Math.min(948, (event.clientX - box.left) * PAPER_WIDTH / box.width)), y: Math.max(12, Math.min(660, (event.clientY - box.top) * PAPER_HEIGHT / box.height)) }
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (!active || world.current?.draining || stroke.current || !event.isPrimary || event.button !== 0) return
    const p = point(event)
    if (!p) return
    event.preventDefault()
    stroke.current = { id: event.pointerId, points: [p], color, ball }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const current = stroke.current
    if (!current || current.id !== event.pointerId) return
    event.preventDefault()
    const events = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of events.length ? events : [event]) {
      const p = point(sample)
      if (!p) continue
      if (current.ball) current.points = [p]
      else appendDrawingPoint(current.points, p)
    }
  }

  function finish(event: PointerEvent<HTMLCanvasElement>, canceled = false) {
    if (stroke.current?.id !== event.pointerId) return
    if (!canceled) move(event)
    const current = release()
    if (!current || canceled) return
    if (current.ball) world.current?.addBall(current.points[0], current.color)
    else world.current?.addStroke(current.points, current.color)
    publish()
  }

  return {
    canvas, status, begin, move, finish,
    undo() { release(); world.current?.undo(); publish() },
    drain() { release(); world.current?.drain(); publish() },
  }
}
