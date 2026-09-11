import RAPIER from '@dimforge/rapier3d-compat'
import type { BufferGeometry } from 'three'
import { BALL_RADIUS, launchPose, toLocal, type Course, type PartKind } from './marbleModel'

export type RunStatus = 'rolling' | 'goal' | 'ready'

/** No path following or junction switches: a single dynamic sphere contacts static triangle surfaces. */
export function createMarbleWorld(course: Course, geometries: Record<PartKind, BufferGeometry>, offset = 0) {
  const pose = launchPose(course, offset)
  if (!pose) return null
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / 120
  for (const part of course.parts) {
    const vertices = new Float32Array(geometries[part.kind].getAttribute('position').array)
    const indices = Uint32Array.from({ length: vertices.length / 3 }, (_, i) => i)
    const angle = -part.rotation * Math.PI / 2
    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setTranslation(part.position.x, part.position.y, part.position.z)
      .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
      .setFriction(0.18).setRestitution(0.12))
  }
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.2, 60).setTranslation(0, -0.3, 0).setFriction(0.45).setRestitution(0.25))
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pose.position.x, pose.position.y, pose.position.z)
    .setLinvel(pose.velocity.x, pose.velocity.y, pose.velocity.z)
    .setAngularDamping(0.035).setLinearDamping(0.015).setCcdEnabled(true))
  world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setDensity(1.4).setFriction(0.18).setRestitution(0.2), ball)
  let elapsed = 0
  let still = 0
  let grounded = 0
  let status: RunStatus = 'rolling'
  const goals = course.parts.filter(part => part.kind === 'goal')
  return {
    world, ball,
    step(): RunStatus {
      if (status !== 'rolling') return status
      world.step()
      elapsed += world.timestep
      const p = ball.translation()
      const velocity = ball.linvel()
      if (goals.some(part => {
        const local = toLocal(part, p)
        return Math.hypot(local.x - 0.55, local.z) < 0.94 && local.y < 0.03 && local.y > -0.6
      })) return status = 'goal'
      still = Math.hypot(velocity.x, velocity.y, velocity.z) < 0.10 ? still + world.timestep : 0
      grounded = p.y < BALL_RADIUS + 0.04 ? grounded + world.timestep : 0
      if (elapsed > 24 || still > 1.5 || grounded > 1.2 || p.y < -2 || Math.abs(p.x) > 50 || Math.abs(p.z) > 50) status = 'ready'
      return status
    },
    dispose() { world.free() },
  }
}

export type MarbleWorld = NonNullable<ReturnType<typeof createMarbleWorld>>
