import { Body, Query, type Body as PhysicsBody } from 'matter-js'
import { BALL_RADIUS, CELL_SIZE } from './boardLayout'
import { cellCenter } from './grid'
import { FAN_ANGLES } from './partTypes'
import type { PlacedPart } from './placement'

/** All state belongs to one run; each ball has its own lift and re-entry cooldown. */
export function createAirToyRuntime(parts: readonly PlacedPart[]) {
  const fans = parts.filter(p => p.typeId in FAN_ANGLES)
  const lifts = parts.filter(p => p.typeId === 'bubbleLift')
  const entrances = parts.filter(p => p.typeId === 'warpIn')
  const exits = parts.filter(p => p.typeId === 'warpOut')
  const carried = new Map<string, { partId: string; top: number; until: number }>()
  const cooldown = new Map<string, number>()
  return {
    cancel(ballId: string) { carried.delete(ballId) },
    step(ballId: string, ball: PhysicsBody, time: number, obstacles: readonly PhysicsBody[]) {
      let reactedPartId: string | undefined
      const lift = carried.get(ballId)
      if (lift) {
        // Let Matter resolve walls/rails normally. Pop against a ceiling instead of crossing it.
        if (ball.position.y <= lift.top || time >= lift.until || Query.collides(ball, [...obstacles]).length > 0) {
          carried.delete(ballId)
          cooldown.set(ballId, time + 900)
          Body.setVelocity(ball, { x: 3, y: -1 })
          return { carried: false, reactedPartId: lift.partId }
        }
        Body.setVelocity(ball, { x: 0, y: -2.5 })
        return { carried: true }
      }
      for (const fan of fans) {
        const center = cellCenter(fan.cell)
        // Dashed square on the piece is the exact center-of-ball influence area.
        if (Math.abs(ball.position.x - center.x) > 26 || Math.abs(ball.position.y - center.y) > 26) continue
        const angle = FAN_ANGLES[fan.typeId as keyof typeof FAN_ANGLES] * Math.PI / 180
        const direction = { x: Math.cos(angle), y: Math.sin(angle) }
        const along = ball.velocity.x * direction.x + ball.velocity.y * direction.y
        const boost = Math.max(0, Math.min(0.8, 6 - along))
        Body.setVelocity(ball, { x: ball.velocity.x + boost * direction.x, y: ball.velocity.y + boost * direction.y })
        reactedPartId = fan.id
      }
      if (time < (cooldown.get(ballId) ?? -Infinity)) return { carried: false, reactedPartId }
      // Multiple entrances share the one orange exit. Incomplete pairs are harmless pass-throughs.
      if (exits.length === 1) {
        const entrance = entrances.find(p => {
          const c = cellCenter(p.cell)
          return Math.hypot(ball.position.x - c.x, ball.position.y - c.y) <= 25
        })
        if (entrance) {
          const destination = cellCenter(exits[0].cell)
          Body.setPosition(ball, destination)
          Body.setVelocity(ball, { x: 0, y: 3 })
          Body.setAngularVelocity(ball, 0)
          cooldown.set(ballId, time + 650)
          return { carried: false, reactedPartId: exits[0].id }
        }
      }
      const source = lifts.find(p => {
        const c = cellCenter(p.cell)
        return Math.hypot(ball.position.x - c.x, ball.position.y - c.y) <= 25
      })
      if (source) {
        carried.set(ballId, { partId: source.id, top: Math.max(BALL_RADIUS + 8, ball.position.y - CELL_SIZE * 2), until: time + 1800 })
        Body.setVelocity(ball, { x: 0, y: -2.5 })
        return { carried: true, reactedPartId: source.id }
      }
      return { carried: false, reactedPartId }
    },
  }
}
