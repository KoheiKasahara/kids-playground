import Matter from 'matter-js'
import { PAPER_HEIGHT, PAPER_WIDTH } from './rollerData'
import type { Point } from './rollerStroke'

const { Bodies, Body, Composite, Engine, Sleeping } = Matter
export const LINE_WIDTH = 20
export const MAX_OBJECTS = 20
export const MAX_SEGMENTS = 24
export const BASKET = { left: 654, right: 806, top: 606, bottom: 684 }
const STEP = 1000 / 120

export type DrawingObject = {
  body: Matter.Body
  points: Point[]
  color: string
  radius: number
  scored: boolean
}

/** Bound both pointer work and collider count, even for a long scribble. */
export function appendDrawingPoint(points: Point[], point: Point) {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
  const last = points.at(-1)
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 6) return
  if (points.length >= 128) points.splice(0, points.length, ...points.filter((_, i) => i % 2 === 0), points.at(-1)!)
  points.push({ x: Math.max(12, Math.min(PAPER_WIDTH - 12, point.x)), y: Math.max(12, Math.min(PAPER_HEIGHT - 40, point.y)) })
}

function simplify(points: Point[]): Point[] {
  if (points.length <= 2) return points
  const first = points[0], last = points.at(-1)!
  const dx = last.x - first.x, dy = last.y - first.y
  let furthest = 0, distance = 3
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const t = Math.max(0, Math.min(1, ((p.x - first.x) * dx + (p.y - first.y) * dy) / (dx * dx + dy * dy || 1)))
    const d = Math.hypot(p.x - first.x - t * dx, p.y - first.y - t * dy)
    if (d > distance) { distance = d; furthest = i }
  }
  if (!furthest) return [first, last]
  return [...simplify(points.slice(0, furthest + 1)).slice(0, -1), ...simplify(points.slice(furthest))]
}

export function createDrawingWorld() {
  const engine = Engine.create({ enableSleeping: true, positionIterations: 8 })
  const floor = Bodies.rectangle(PAPER_WIDTH / 2, 710, PAPER_WIDTH + 80, 40, { isStatic: true })
  const fixtures = [
    floor,
    Bodies.rectangle(-20, 360, 40, 1500, { isStatic: true }),
    Bodies.rectangle(PAPER_WIDTH + 20, 360, 40, 1500, { isStatic: true }),
    Bodies.rectangle(BASKET.left, 645, 14, 78, { isStatic: true }),
    Bodies.rectangle(BASKET.right, 645, 14, 78, { isStatic: true }),
    Bodies.rectangle((BASKET.left + BASKET.right) / 2, BASKET.bottom, 166, 14, { isStatic: true }),
  ]
  const items: DrawingObject[] = []
  let draining = 0
  let goals = 0
  let celebration = 0
  let undoId: number | null = null
  const options = { restitution: 0.22, friction: 0.45, frictionAir: 0.003, density: 0.002 }

  function remove(item: DrawingObject) {
    Composite.remove(engine.world, item.body)
    items.splice(items.indexOf(item), 1)
    if (undoId === item.body.id) undoId = null
    // Removing a support must also drop a stack that Matter has put to sleep.
    for (const remaining of items) Sleeping.set(remaining.body, false)
  }

  function add(item: DrawingObject) {
    while (items.length >= MAX_OBJECTS) remove(items[0])
    items.push(item)
    Composite.add(engine.world, item.body)
    undoId = item.body.id
    return item
  }

  function addBall(point: Point, color = '#efad38') {
    if (draining || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    const radius = 23
    const body = Bodies.circle(Math.max(radius, Math.min(PAPER_WIDTH - radius, point.x)), Math.max(radius, Math.min(660, point.y)), radius, { ...options, restitution: 0.5, friction: 0.08 })
    return add({ body, radius, points: [], color, scored: false })
  }

  function reset() {
    Composite.clear(engine.world, false)
    Engine.clear(engine)
    items.length = 0
    Composite.add(engine.world, fixtures)
    draining = 0
    goals = 0
    celebration = 0
    addBall({ x: 240, y: 100 })
    undoId = null
  }

  reset()
  return {
    items,
    get draining() { return draining > 0 },
    get goals() { return goals },
    get celebration() { return celebration },
    get canUndo() { return undoId !== null && !draining },
    addBall,
    addStroke(input: Point[], color: string) {
      if (draining) return
      const sampled: Point[] = []
      for (const p of input) appendDrawingPoint(sampled, p)
      let points = simplify(sampled)
      if (!points.length) return
      if (points.length > MAX_SEGMENTS + 1) {
        points = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => points[Math.round(i * (points.length - 1) / MAX_SEGMENTS)])
      }
      const parts = points.slice(1).map((p, i) => {
        const a = points[i]
        return Bodies.rectangle((a.x + p.x) / 2, (a.y + p.y) / 2, Math.hypot(p.x - a.x, p.y - a.y) + LINE_WIDTH, LINE_WIDTH, {
          ...options, angle: Math.atan2(p.y - a.y, p.x - a.x), chamfer: { radius: LINE_WIDTH / 2, quality: 4 },
        })
      })
      const body = parts.length ? Body.create({ ...options, parts }) : Bodies.circle(points[0].x, points[0].y, LINE_WIDTH / 2, options)
      const localPoints = points.map(p => ({ x: p.x - body.position.x, y: p.y - body.position.y }))
      return add({ body, points: localPoints, color, radius: 0, scored: false })
    },
    undo() {
      const item = items.find(item => item.body.id === undoId)
      if (item && !draining) remove(item)
    },
    drain() {
      if (draining) return
      draining = 1400
      celebration = 0
      undoId = null
      for (const fixture of fixtures) Composite.remove(engine.world, fixture)
      for (const item of items) {
        Sleeping.set(item.body, false)
        Body.setVelocity(item.body, { x: item.body.velocity.x * 0.2, y: 8 })
        // All pieces drop together, including a jammed pile or a sleeping ball.
        item.body.collisionFilter.mask = 0
      }
    },
    step() {
      // Two small fixed steps keep narrow drawn walls solid on slow devices.
      for (let n = 0; n < 2; n++) {
        for (const { body } of items) {
          const speed = Math.hypot(body.velocity.x, body.velocity.y)
          if (speed > 18) Body.setVelocity(body, { x: body.velocity.x * 18 / speed, y: body.velocity.y * 18 / speed })
        }
        Engine.update(engine, STEP)
      }
      celebration = Math.max(0, celebration - STEP * 2)
      if (draining) {
        draining -= STEP * 2
        if (draining <= 0) reset()
        return
      }
      for (const item of [...items]) {
        const { x, y } = item.body.position
        if (!Number.isFinite(x) || !Number.isFinite(y) || y > PAPER_HEIGHT + 200 || x < -200 || x > PAPER_WIDTH + 200) { remove(item); continue }
        if (item.radius && !item.scored && x > BASKET.left + 7 + item.radius && x < BASKET.right - 7 - item.radius && y > BASKET.top + item.radius && y < BASKET.bottom - 7) {
          item.scored = true
          goals++
          celebration = 1800
        }
      }
    },
    destroy() { Composite.clear(engine.world, false); Engine.clear(engine); items.length = 0 },
  }
}

export type DrawingWorld = ReturnType<typeof createDrawingWorld>
