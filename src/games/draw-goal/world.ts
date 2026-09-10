import Matter from 'matter-js'
import { BALL_RADIUS, HEIGHT, LINE_WIDTH, STAR_RADIUS, WARP_RADIUS, WIDTH, type Stage } from './stages'
import { simplify, type Point } from './stroke'
const { Bodies, Body, Composite, Engine } = Matter
export const MAX_LINES = 12
export const MAX_POINTS = 120
export const MAX_SEGMENTS = 32
// The cup keeps the ball, so settling is capped only to guarantee the celebration appears.
export const SETTLE_FRAMES = 150
// Matter's own gravity force, so a wind push of 1 exactly holds the ball up.
const GRAVITY_FORCE = .001
// Long enough for the ball to leave the exit ring before the entrance can catch it again.
const WARP_COOLDOWN = 40

export function appendPoint(points: Point[], p: Point) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return
  const point = { x: Math.max(8, Math.min(WIDTH - 8, p.x)), y: Math.max(8, Math.min(HEIGHT - 8, p.y)) }
  const last = points.at(-1)
  if (last && Math.hypot(point.x - last.x, point.y - last.y) < 4) return
  // Stop at the limit instead of rewriting an already previewed path.
  if (points.length < MAX_POINTS) points.push(point)
}

export function createWorld(stage: Stage) {
  const engine = Engine.create({ positionIterations: 8 })
  const ball = Bodies.circle(stage.ball.x, stage.ball.y, BALL_RADIUS, { friction: .015, frictionAir: .008, restitution: .12 })
  const lines: { points: Point[]; bodies: Matter.Body[] }[] = []
  const goal = stage.goal
  const fixtures = [
    Bodies.rectangle(-10, HEIGHT / 2, 20, HEIGHT * 3, { isStatic: true }),
    Bodies.rectangle(WIDTH + 10, HEIGHT / 2, 20, HEIGHT * 3, { isStatic: true }),
    Bodies.rectangle(goal.x - 60, goal.y + 40, 12, 80, { isStatic: true }),
    Bodies.rectangle(goal.x + 60, goal.y + 40, 12, 80, { isStatic: true }),
    Bodies.rectangle(goal.x, goal.y + 80, 132, 12, { isStatic: true }),
    ...stage.platforms.map(p => Bodies.rectangle(p.x, p.y, p.width, p.height ?? 18, { isStatic: true, angle: p.angle ?? 0, restitution: p.bounce ? .8 : .1 })),
  ]
  Composite.add(engine.world, [...fixtures, ball])
  const stars = stage.stars ?? []
  const winds = stage.winds ?? []
  // Mutated in place so the render loop can read the picked stars without a new array each frame.
  const collected = stars.map(() => false)
  let state: 'ready' | 'running' | 'scored' | 'goal' | 'retry' = 'ready'
  let stillFrames = 0
  let settleFrames = 0
  let restFrames = 0
  let warpFrames = 0
  let warps = 0
  return {
    ball, lines, collected,
    get state() { return state },
    // Counts every trip through the warp so the screen can sound it without polling positions.
    get warps() { return warps },
    addStroke(input: Point[]) {
      if (lines.length >= MAX_LINES || state === 'scored' || state === 'goal' || state === 'retry') return false
      const sampled: Point[] = []
      input.forEach(p => appendPoint(sampled, p))
      let points = simplify(sampled)
      if (points.length < 2) return false
      if (points.length > MAX_SEGMENTS + 1) points = Array.from({ length: MAX_SEGMENTS + 1 }, (_, i) => points[Math.round(i * (points.length - 1) / MAX_SEGMENTS)])
      const bodies = points.slice(1).map((p, i) => {
        const a = points[i]
        return Bodies.rectangle((a.x + p.x) / 2, (a.y + p.y) / 2, Math.hypot(p.x - a.x, p.y - a.y) + LINE_WIDTH, LINE_WIDTH, { isStatic: true, angle: Math.atan2(p.y - a.y, p.x - a.x), friction: .015, chamfer: { radius: LINE_WIDTH / 2, quality: 4 } })
      })
      // Do not materialize a line through the ball and fling it out of the board.
      if (Matter.Query.collides(ball, bodies).length) return false
      lines.push({ points, bodies })
      Composite.add(engine.world, bodies)
      // Drawing never launches the ball: several roads can be drawn before start().
      return true
    },
    retry(clear = false) {
      if (clear) { lines.forEach(l => l.bodies.forEach(b => Composite.remove(engine.world, b))); lines.length = 0 }
      Body.setPosition(ball, stage.ball)
      Body.setVelocity(ball, { x: 0, y: 0 })
      Body.setAngularVelocity(ball, 0)
      Body.setAngle(ball, 0)
      stillFrames = settleFrames = restFrames = warpFrames = warps = 0
      collected.fill(false)
      state = 'ready'
    },
    start() { if (state === 'ready') state = 'running' },
    undo() {
      const line = lines.pop()
      line?.bodies.forEach(b => Composite.remove(engine.world, b))
      this.retry()
    },
    step() {
      if (state !== 'running' && state !== 'scored') return
      for (let i = 0; i < 2; i++) {
        for (const wind of winds) {
          if (Math.abs(ball.position.x - wind.x) > wind.width / 2 || Math.abs(ball.position.y - wind.y) > wind.height / 2) continue
          Body.applyForce(ball, ball.position, { x: ball.mass * GRAVITY_FORCE * wind.push.x, y: ball.mass * GRAVITY_FORCE * wind.push.y })
        }
        const speed = Math.hypot(ball.velocity.x, ball.velocity.y)
        if (speed > 6) Body.setVelocity(ball, { x: ball.velocity.x * 6 / speed, y: ball.velocity.y * 6 / speed })
        Engine.update(engine, 1000 / 120)
        if (state !== 'running') continue
        stars.forEach((star, index) => {
          if (!collected[index] && Math.hypot(ball.position.x - star.x, ball.position.y - star.y) < BALL_RADIUS + STAR_RADIUS) collected[index] = true
        })
        if (warpFrames > 0) warpFrames--
        else if (stage.warp && Math.hypot(ball.position.x - stage.warp.from.x, ball.position.y - stage.warp.from.y) < WARP_RADIUS) {
          // The exit always drops the ball straight down, so the route after it stays the same however it entered.
          Body.setPosition(ball, stage.warp.to)
          Body.setVelocity(ball, { x: 0, y: 1.5 })
          Body.setAngularVelocity(ball, 0)
          warpFrames = WARP_COOLDOWN
          warps++
        }
        const { x, y } = ball.position
        if (Math.abs(x - goal.x) < 60 - 6 - BALL_RADIUS && y > goal.y + BALL_RADIUS && y < goal.y + 80 - 6) { state = 'scored'; settleFrames = restFrames = 0; continue }
        if (!Number.isFinite(x) || !Number.isFinite(y) || y > HEIGHT + 30) { state = 'retry'; return }
      }
      if (state === 'scored') {
        // Keep simulating inside the cup so the ball rolls to a stop instead of freezing in mid-air.
        settleFrames++
        restFrames = ball.speed < .3 ? restFrames + 1 : 0
        if (restFrames > 10 || settleFrames > SETTLE_FRAMES) state = 'goal'
        return
      }
      stillFrames = ball.speed < .12 ? stillFrames + 1 : 0
      if (stillFrames > 180) state = 'retry'
    },
    destroy() { Composite.clear(engine.world, false); Engine.clear(engine) },
  }
}
export type World = ReturnType<typeof createWorld>
