import RAPIER from '@dimforge/rapier3d-compat'
import type { BufferGeometry } from 'three'
import { BALL_RADIUS, launchPose, rotate, SEESAW_ANGLE, SEESAW_PIVOT, SPINNER_ANGLE, SPINNER_DROP, toLocal, toWorld, type Course, type MarblePart, type PartKind, type Vec3 } from './marbleModel'

export type RunStatus = 'rolling' | 'goal' | 'ready'
export type MechanismPose = { id: string; position: Vec3; rotation: { x: number; y: number; z: number; w: number } }
export type MarbleEvent = { id: string; kind: 'takeoff' | 'land' | 'boost' | 'hit'; position: Vec3 }
const yaw = (angle: number) => ({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
/** How quickly a bowl bleeds a swirling ball's energy: a few laps, not a minute of orbiting. */
const FUNNEL_DRAG = 1.2

/** All paths remain physical surfaces. Only the motor and a bounded, contact-triggered boost supply energy. */
export function createMarbleWorld(course: Course, geometries: Record<PartKind, BufferGeometry>, offset = 0) {
  const pose = launchPose(course, offset)
  if (!pose) return null
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = 1 / 120
  const surfaces = new Map<string, RAPIER.Collider>()
  const mechanisms = new Map<string, RAPIER.RigidBody>()
  const bars = new Map<string, RAPIER.Collider>()
  const spinners = course.parts.filter(part => part.kind === 'spinner')
  // Only the motor and the tipping board legitimately hold a nearly still ball; a funnel has
  // nothing left to move it, so a ball resting there is stuck and must end the run like any track.
  const gadgets = course.parts.filter(part => ['spinner', 'seesaw'].includes(part.kind))
  for (const part of course.parts) {
    const vertices = new Float32Array(geometries[part.kind].getAttribute('position').array)
    const indices = Uint32Array.from({ length: vertices.length / 3 }, (_, i) => i)
    const angle = -part.rotation * Math.PI / 2
    // The funnel swallows the drop from its raised mouth instead of turning it into more
    // orbiting: a lively bounce there keeps a ball circling the bowl long after it should
    // have drained.
    const funnel = part.kind === 'funnel'
    surfaces.set(part.id, world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices)
      .setTranslation(part.position.x, part.position.y, part.position.z)
      .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
      .setCollisionGroups(0x00020001)
      .setRestitutionCombineRule(funnel ? RAPIER.CoefficientCombineRule.Min : RAPIER.CoefficientCombineRule.Average)
      .setFriction(funnel ? 0.28 : 0.18).setRestitution(funnel ? 0.02 : 0.12)))
    if (part.kind === 'spinner') {
      const p = toWorld(part, { x: 0, y: 0.34 - SPINNER_DROP / 2, z: 0.3 })
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(p.x, p.y, p.z).setRotation(yaw(angle + SPINNER_ANGLE)))
      bars.set(part.id, world.createCollider(RAPIER.ColliderDesc.capsule(0.9, 0.16).setRotation({ x: 0, y: 0, z: Math.SQRT1_2, w: Math.SQRT1_2 }).setFriction(0.15).setRestitution(0.1), body))
      world.createCollider(RAPIER.ColliderDesc.cylinder(0.36, 0.14).setTranslation(p.x, p.y, p.z))
      mechanisms.set(part.id, body)
    }
    if (part.kind === 'seesaw') {
      // The mouths overlap the board to cover the seam. Only the ball collides with the board;
      // the revolute joint supplies its stops, so those overlapping fixed lips cannot jam it.
      const p = toWorld(part, { x: 0, y: SEESAW_PIVOT, z: 0 })
      const anchor = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(yaw(angle)))
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(yaw(angle)).setAngularDamping(2.5).setCcdEnabled(true))
      world.createCollider(RAPIER.ColliderDesc.cuboid(1.95, 0.09, 0.82).setTranslation(0, -0.09, 0).setMass(0.12).setFriction(0.18).setRestitution(0.05).setCollisionGroups(0x00040001), body)
      for (const z of [-0.77, 0.77]) world.createCollider(RAPIER.ColliderDesc.cuboid(1.95, 0.22, 0.05).setTranslation(0, 0.21, z).setMass(0.01).setFriction(0.18).setCollisionGroups(0x00040001), body)
      const joint = world.createImpulseJoint(RAPIER.JointData.revolute({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }), anchor, body, true) as RAPIER.RevoluteImpulseJoint
      joint.setLimits(-SEESAW_ANGLE, SEESAW_ANGLE)
      // Place at the inlet-down stop after defining the level joint reference frame.
      const half = SEESAW_ANGLE / 2, q = yaw(angle)
      body.setRotation({ x: q.y * Math.sin(half), y: q.y * Math.cos(half), z: q.w * Math.sin(half), w: q.w * Math.cos(half) }, true)
      mechanisms.set(part.id, body)
    }
  }
  world.createCollider(RAPIER.ColliderDesc.cuboid(60, 0.2, 60).setTranslation(0, -0.3, 0).setFriction(0.45).setRestitution(0.25))
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(pose.position.x, pose.position.y, pose.position.z)
    .setLinvel(pose.velocity.x, pose.velocity.y, pose.velocity.z)
    .setAngularDamping(0.035).setLinearDamping(0.015).setCcdEnabled(true))
  const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(BALL_RADIUS).setDensity(1.4).setFriction(0.18).setRestitution(0.2).setCollisionGroups(0x0001ffff), ball)
  let elapsed = 0
  let still = 0
  let grounded = 0
  let status: RunStatus = 'rolling'
  const goals = course.parts.filter(part => part.kind === 'goal')
  const boosters = course.parts.filter(part => part.kind === 'booster')
  const jumps = course.parts.filter(part => part.kind === 'jump')
  const funnels = course.parts.filter(part => part.kind === 'funnel')
  const boosted = new Set<string>()
  const airborne = new Set<string>()
  const lastHit = new Map<string, number>()
  let events: MarbleEvent[] = []
  const emit = (part: MarblePart, kind: MarbleEvent['kind']) => events.push({ id: part.id, kind, position: { ...ball.translation() } })
  const touching = (collider: RAPIER.Collider, topOf?: MarblePart): boolean => {
    let contact = false
    world.contactPair(ballCollider, collider, manifold => {
      for (let i = 0; i < manifold.numSolverContacts(); i++) {
        if (!topOf) { contact = true; break }
        const p = toLocal(topOf, manifold.solverContactPoint(i))
        // The narrow, level center floor excludes the sidewalls and underside.
        if (Math.abs(p.z) < 0.6 && Math.abs(p.x) < 1.85 && p.y > -0.025 && p.y < 0.06) contact = true
      }
    })
    return contact
  }
  return {
    world, ball,
    mechanismPoses(): MechanismPose[] { return [...mechanisms].map(([id, body]) => ({ id, position: body.translation(), rotation: body.rotation() })) },
    consumeEvents(): MarbleEvent[] { const next = events; events = []; return next },
    step(): RunStatus {
      if (status !== 'rolling') return status
      for (const part of spinners) {
        const speed = (part.settings.speed === 'fast' ? 1.4 : 0.65) * (part.settings.reverse ? -1 : 1)
        mechanisms.get(part.id)!.setNextKinematicRotation(yaw(-part.rotation * Math.PI / 2 + SPINNER_ANGLE + (elapsed + world.timestep) * speed))
      }
      world.step()
      elapsed += world.timestep
      const p = ball.translation()
      // Rolling resistance inside a bowl. A polished sphere on a polished bowl keeps orbiting for
      // far longer than a child will watch, and nothing else in the funnel takes that energy away.
      const swirling = funnels.some(part => {
        const local = toLocal(part, p)
        return Math.hypot(local.x, local.z) < 2.5 && local.y > -0.9 && local.y < 0.7
      })
      ball.setAngularDamping(swirling ? FUNNEL_DRAG : 0.035)
      for (const part of boosters) {
        const local = toLocal(part, p)
        if (Math.abs(local.x) > 2.5 || Math.abs(local.z) > 1.2 || local.y > 1.2 || local.y < -0.5) boosted.delete(part.id)
        if (!boosted.has(part.id) && local.y > 0.15 && touching(surfaces.get(part.id)!, part)) {
          boosted.add(part.id)
          const velocity = rotate(ball.linvel(), -part.rotation)
          const speed = Math.hypot(velocity.x, velocity.z)
          if (speed < 5.2) {
            const next = rotate({ ...velocity, x: Math.min(5.2, Math.sqrt(5.2 ** 2 - velocity.z ** 2), velocity.x + 3.8) }, part.rotation)
            ball.setLinvel(next, true)
            emit(part, 'boost')
          }
        }
      }
      for (const part of jumps) {
        const local = toLocal(part, p)
        if (local.x > -0.5 && local.x < 0.2 && local.y > 0 && Math.abs(local.z) < 1.4 && !airborne.has(part.id) && !touching(surfaces.get(part.id)!)) { airborne.add(part.id); emit(part, 'takeoff') }
        if (airborne.has(part.id) && local.x >= 0.2 && touching(surfaces.get(part.id)!)) { airborne.delete(part.id); emit(part, 'land') }
      }
      for (const part of spinners) if (elapsed - (lastHit.get(part.id) ?? -1) > 0.35 && touching(bars.get(part.id)!)) { lastHit.set(part.id, elapsed); emit(part, 'hit') }
      const velocity = ball.linvel()
      if (goals.some(part => {
        const local = toLocal(part, p)
        return Math.hypot(local.x - 0.55, local.z) < 0.94 && local.y < 0.03 && local.y > -0.6
      })) return status = 'goal'
      const waitingForGadget = gadgets.some(part => { const local = toLocal(part, p); return Math.abs(local.x) < 3.3 && Math.abs(local.z) < 2.6 && local.y > -1.9 && local.y < 1.5 })
      still = !waitingForGadget && Math.hypot(velocity.x, velocity.y, velocity.z) < 0.10 ? still + world.timestep : 0
      grounded = p.y < BALL_RADIUS + 0.04 ? grounded + world.timestep : 0
      if (elapsed > 40 || still > 1.5 || grounded > 1.2 || p.y < -2 || Math.abs(p.x) > 50 || Math.abs(p.z) > 50) status = 'ready'
      return status
    },
    dispose() { world.free() },
  }
}

export type MarbleWorld = NonNullable<ReturnType<typeof createMarbleWorld>>
