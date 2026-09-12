/**
 * クレーンゲームの物理世界。
 *
 * Three.js にもDOMにも依存させていないので、vitest の中で本物の物理を回して
 * 「ねらった景品をつかめるか」「おもい景品はすべり落ちるか」「景品がケースから出ないか」を確かめられる。
 * アームの姿勢は craneRig.ts が決め、ここはそれを kinematic な剛体へ写して結果だけを返す。
 *
 * つかむ力は、指とのあたりに加えて「アームと景品をつなぐばね」で表している。
 * ばねが支えられる力（machine.grip.hold）を超えた負荷がかかると手がすべる、という
 * 実際のクレーンゲームと同じ理由で景品が落ちる。
 */
import RAPIER from '@dimforge/rapier3d-compat'
import { BIN, CHUTE, prizeSpawns, type CraneMachine, type PrizeSpecies } from './craneMachines'
import {
  CLAW,
  FINGER_AZIMUTHS,
  FINGER_SHUT,
  fingerDepth,
  fingerPose,
  gripSlips,
  multiplyQuaternion,
  quaternionY,
  quaternionZ,
  type Quat,
  type Rig,
  type RigEvent,
  type Vec3,
} from './craneRig'

const PRIZE_GROUP = 0x0001ffff
const CABINET_GROUP = 0x00020001
const CLAW_GROUP = 0x00040001
const TIMESTEP = 1 / 120
/** 景品をぶら下げる位置。指先のあたりからぶら下がって揺れる。 */
const GRIP_ANCHOR_Y = fingerDepth(FINGER_SHUT) + 0.02
/** 受け皿へ落ちたと判定する高さ。ケースの床より十分下。 */
const CAUGHT_Y = -0.08
/** 受け皿で止まった景品を片づけるまでの時間[s]。 */
const CLEAR_DELAY = 1.1

export type PrizeView = { id: string; species: string; position: Vec3; rotation: Quat; held: boolean; caught: boolean }
export type FingerView = { position: Vec3; rotation: Quat; angle: number }

export type CraneEvent =
  | { kind: 'grip'; prize: string; label: string; emoji: string }
  | { kind: 'miss' }
  | { kind: 'slip'; prize: string; label: string; position: Vec3 }
  | { kind: 'caught'; prize: string; label: string; emoji: string; species: string; position: Vec3 }
  | { kind: 'bump'; position: Vec3; strength: number }

type PrizeEntry = {
  id: string
  species: PrizeSpecies
  body: RAPIER.RigidBody
  collider: RAPIER.Collider
  caught: boolean
  caughtAt: number
  speed: number
  bumpedAt: number
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)
}

export function createCraneWorld(machine: CraneMachine, round = 0) {
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 })
  world.timestep = TIMESTEP
  const wall = 0.04

  function fixedBox(hx: number, hy: number, hz: number, x: number, y: number, z: number, friction = 0.5) {
    world.createCollider(RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(friction).setRestitution(0.04).setCollisionGroups(CABINET_GROUP))
  }

  // 床は穴を避けた2枚に分ける。穴の上で放した景品だけが下へ落ちる。
  fixedBox((BIN.x - CHUTE.maxX) / 2, wall / 2, BIN.z, (CHUTE.maxX + BIN.x) / 2, -wall / 2, 0, 0.42)
  fixedBox((CHUTE.maxX - CHUTE.minX) / 2, wall / 2, (BIN.z + CHUTE.minZ) / 2, (CHUTE.minX + CHUTE.maxX) / 2, -wall / 2, (CHUTE.minZ - BIN.z) / 2, 0.42)
  // ケースの4面。アームが上がりきる高さより高くして、景品が飛び出さないようにする。
  const sideHeight = (BIN.height + 0.5) / 2
  fixedBox(wall / 2, sideHeight, BIN.z + wall, -BIN.x - wall / 2, sideHeight - 0.5, 0)
  fixedBox(wall / 2, sideHeight, BIN.z + wall, BIN.x + wall / 2, sideHeight - 0.5, 0)
  fixedBox(BIN.x + wall, sideHeight, wall / 2, 0, sideHeight - 0.5, -BIN.z - wall / 2)
  fixedBox(BIN.x + wall, sideHeight, wall / 2, 0, sideHeight - 0.5, BIN.z + wall / 2)
  // 穴の下の受け皿。床より下だけを囲うので、ケースの床側には出てこない。
  const basketFloorY = CHUTE.floor - wall / 2
  fixedBox((CHUTE.maxX - CHUTE.minX) / 2 + 0.01, wall / 2, (CHUTE.maxZ - CHUTE.minZ) / 2 + 0.01, (CHUTE.minX + CHUTE.maxX) / 2, basketFloorY, (CHUTE.minZ + CHUTE.maxZ) / 2, 0.6)
  fixedBox(wall / 2, (0 - CHUTE.floor) / 2, (CHUTE.maxZ - CHUTE.minZ) / 2 + 0.01, CHUTE.maxX + wall / 2 - 0.01, CHUTE.floor / 2, (CHUTE.minZ + CHUTE.maxZ) / 2)
  fixedBox((CHUTE.maxX - CHUTE.minX) / 2 + 0.01, (0 - CHUTE.floor) / 2, wall / 2, (CHUTE.minX + CHUTE.maxX) / 2, CHUTE.floor / 2, CHUTE.minZ - wall / 2 + 0.01)

  // 並べている間だけ穴にふたをしておく。並べた景品が転がってそのまま落ちてしまうのを防ぐ。
  function createLid() {
    return world.createCollider(RAPIER.ColliderDesc
      .cuboid((CHUTE.maxX - CHUTE.minX) / 2, wall / 2, (CHUTE.maxZ - CHUTE.minZ) / 2)
      .setTranslation((CHUTE.minX + CHUTE.maxX) / 2, -wall / 2, (CHUTE.minZ + CHUTE.maxZ) / 2)
      .setFriction(0.42).setCollisionGroups(CABINET_GROUP))
  }
  let lid: RAPIER.Collider | null = createLid()

  const prizes = new Map<string, PrizeEntry>()
  /** 当たり判定から景品を引くための対応表。接触のたびに全景品を走査しないため。 */
  const byCollider = new Map<number, PrizeEntry>()
  let elapsed = 0
  let settledAt = 0
  let collected = 0
  let events: CraneEvent[] = []

  /** カプセル形はねかせて置く。立てると必ず倒れて転がってしまうため。 */
  function spawnRotation(species: PrizeSpecies, yaw: number): Quat {
    const upright = quaternionY(yaw)
    return species.body.form === 'capsule' ? multiplyQuaternion(upright, quaternionZ(Math.PI / 2)) : upright
  }

  function spawnPrizes(seed: number) {
    for (const spawn of prizeSpawns(machine, seed)) {
      const { species } = spawn
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(spawn.position.x, spawn.position.y, spawn.position.z)
        .setRotation(spawnRotation(species, spawn.yaw))
        .setLinearDamping(0.15)
        .setAngularDamping(0.3)
        .setCcdEnabled(true))
      const shape = species.body.form === 'ball'
        ? RAPIER.ColliderDesc.ball(species.body.radius)
        : species.body.form === 'capsule'
          ? RAPIER.ColliderDesc.capsule(species.body.half, species.body.radius)
          : RAPIER.ColliderDesc.roundCuboid(species.body.half.x, species.body.half.y, species.body.half.z, species.body.round)
      const collider = world.createCollider(shape
        .setMass(species.mass)
        .setFriction(species.friction)
        .setRestitution(species.restitution)
        .setCollisionGroups(PRIZE_GROUP), body)
      const entry: PrizeEntry = { id: spawn.id, species, body, collider, caught: false, caughtAt: 0, speed: 0, bumpedAt: -1 }
      prizes.set(spawn.id, entry)
      byCollider.set(collider.handle, entry)
    }
  }
  spawnPrizes(round)

  const head = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0))
  const hub = world.createCollider(RAPIER.ColliderDesc.cylinder(CLAW.hubHalf, CLAW.hubRadius).setFriction(0.4).setRestitution(0.02).setCollisionGroups(CLAW_GROUP), head)
  const fingers = FINGER_AZIMUTHS.map((_, index) => {
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(0, 1, 0))
    const colliders = [
      world.createCollider(RAPIER.ColliderDesc.capsule(CLAW.arm / 2, CLAW.armRadius).setTranslation(0, -CLAW.arm / 2, 0).setFriction(1.1).setRestitution(0.02).setCollisionGroups(CLAW_GROUP), body),
      world.createCollider(RAPIER.ColliderDesc.capsule(CLAW.tip / 2, CLAW.tipRadius)
        .setTranslation(-Math.sin(CLAW.tipBend) * CLAW.tip / 2, -CLAW.arm - Math.cos(CLAW.tipBend) * CLAW.tip / 2, 0)
        .setRotation(quaternionZ(-CLAW.tipBend))
        .setFriction(1.2).setRestitution(0.02).setCollisionGroups(CLAW_GROUP), body),
    ]
    return { index, body, colliders, locked: Number.NEGATIVE_INFINITY }
  })

  let grip: { prize: PrizeEntry; joint: RAPIER.ImpulseJoint; rest: number } | null = null
  let blocked = false

  function anchorPoint(): Vec3 {
    const p = head.translation()
    return { x: p.x, y: p.y + GRIP_ANCHOR_Y, z: p.z }
  }

  function touchesPrize(colliders: RAPIER.Collider[]): PrizeEntry | null {
    for (const collider of colliders) {
      let found: PrizeEntry | null = null
      world.contactPairsWith(collider, other => { found ??= byCollider.get(other.handle) ?? null })
      if (found) return found
    }
    return null
  }

  function releaseGrip() {
    if (!grip) return
    world.removeImpulseJoint(grip.joint, true)
    grip = null
  }

  function attemptGrip() {
    const axis = head.translation()
    const contacts = new Map<string, number>()
    for (const finger of fingers) {
      const prize = touchesPrize(finger.colliders)
      if (prize) contacts.set(prize.id, (contacts.get(prize.id) ?? 0) + 1)
    }
    let best: { prize: PrizeEntry; touches: number; gap: number } | null = null
    for (const [id, touches] of contacts) {
      const prize = prizes.get(id)
      if (!prize || prize.caught) continue
      const p = prize.body.translation()
      const gap = Math.hypot(p.x - axis.x, p.z - axis.z)
      // 指が当たっていても、中心から遠い景品は引っかかっただけなのでつかめない。
      if (gap > machine.grip.capture) continue
      if (!best || touches > best.touches || (touches === best.touches && gap < best.gap)) best = { prize, touches, gap }
    }
    if (!best) { events.push({ kind: 'miss' }); return }
    const prize = best.prize
    const anchor = anchorPoint()
    const center = prize.body.translation()
    const rest = Math.max(0.012, distance(anchor, center))
    const joint = world.createImpulseJoint(
      RAPIER.JointData.spring(rest, machine.grip.stiffness, machine.grip.damping, { x: 0, y: GRIP_ANCHOR_Y, z: 0 }, { x: 0, y: 0, z: 0 }),
      head, prize.body, true,
    )
    grip = { prize, joint, rest }
    // つかめたら、指をもう少しだけ閉じて景品を挟み込む（やわらかい景品がへこむぶん）。
    for (const finger of fingers) if (Number.isFinite(finger.locked)) finger.locked = Math.max(FINGER_SHUT, finger.locked - 0.09)
    prize.body.wakeUp()
    events.push({ kind: 'grip', prize: prize.id, label: prize.species.label, emoji: prize.species.emoji })
  }

  function applyClaw(rig: Rig) {
    head.setNextKinematicTranslation({ x: rig.x, y: rig.y, z: rig.z })
    for (const finger of fingers) {
      // 景品に当たった指はそこで止まる。閉じきる角度まで景品を押しつぶさない。
      const angle = rig.phase === 'idle' || rig.phase === 'descend' ? rig.finger : Math.max(rig.finger, finger.locked)
      const pose = fingerPose(rig, finger.index, angle)
      finger.body.setNextKinematicTranslation(pose.position)
      finger.body.setNextKinematicRotation(pose.rotation)
    }
  }

  return {
    world,
    get collected() { return collected },
    /** ケースに残っている景品の数。 */
    get remaining() { return [...prizes.values()].filter(prize => !prize.caught).length },
    get holding() { return grip?.prize.id ?? null },
    get blockedByPrize() { return blocked },
    clawPose(): { position: Vec3; fingers: FingerView[] } {
      return {
        position: { ...head.translation() },
        fingers: fingers.map(finger => ({ position: { ...finger.body.translation() }, rotation: { ...finger.body.rotation() }, angle: finger.locked })),
      }
    },
    prizes(): PrizeView[] {
      return [...prizes.values()].map(prize => ({
        id: prize.id,
        species: prize.species.id,
        position: { ...prize.body.translation() },
        rotation: { ...prize.body.rotation() },
        held: grip?.prize.id === prize.id,
        caught: prize.caught,
      }))
    },
    consumeEvents(): CraneEvent[] { const next = events; events = []; return next },
    /** 並べ直す。ケースの中の景品を片づけて、新しい並びで落とし込む。 */
    refill(seed: number) {
      releaseGrip()
      for (const prize of prizes.values()) world.removeRigidBody(prize.body)
      prizes.clear()
      byCollider.clear()
      lid ??= createLid()
      settledAt = elapsed
      spawnPrizes(seed)
    },
    /** 景品を並べ終えて遊べる状態かどうか。並べている間は穴にふたがある。 */
    get ready() { return lid === null },
    /** アームの姿勢を反映して1ステップ進める。起きたことは consumeEvents で受け取る。 */
    step(rig: Rig, rigEvents: readonly RigEvent[] = []): void {
      if (rigEvents.includes('release')) releaseGrip()
      if (rig.phase === 'idle') for (const finger of fingers) finger.locked = Number.NEGATIVE_INFINITY
      applyClaw(rig)
      // 眠っている景品はアームが近づいた時点で起こす。降りてきた指との接触を取りこぼさないため。
      if (rig.phase === 'descend' || rig.phase === 'close') {
        for (const prize of prizes.values()) {
          const p = prize.body.translation()
          if (Math.hypot(p.x - rig.x, p.z - rig.z) < 0.26) prize.body.wakeUp()
        }
      }
      world.step()
      elapsed += TIMESTEP
      // 景品が落ち着いたらふたを外す。これ以降、穴へ落ちた景品が「取れた景品」になる。
      if (lid) {
        const moving = [...prizes.values()].some(prize => {
          const velocity = prize.body.linvel()
          return Math.hypot(velocity.x, velocity.y, velocity.z) > 0.03
        })
        if ((!moving && elapsed - settledAt > 0.4) || elapsed - settledAt > 3) {
          world.removeCollider(lid, false)
          lid = null
        }
      }

      blocked = rig.phase === 'descend' && touchesPrize([hub]) !== null
      if (rig.phase === 'close') {
        for (const finger of fingers) {
          if (finger.locked > rig.finger) continue
          if (touchesPrize(finger.colliders)) finger.locked = Math.max(rig.finger, FINGER_SHUT)
        }
      }
      if (rigEvents.includes('grip') && !grip) attemptGrip()

      if (grip) {
        const anchor = anchorPoint()
        const center = grip.prize.body.translation()
        const stretch = distance(anchor, center) - grip.rest
        const sideways = Math.hypot(center.x - anchor.x, center.z - anchor.z)
        // ばねが支えきれない負荷、または指の外へ出てしまったとき手がすべる。
        if (gripSlips(stretch, machine.grip) || sideways > machine.grip.capture * 2.2) {
          const slipped = grip.prize
          releaseGrip()
          events.push({ kind: 'slip', prize: slipped.id, label: slipped.species.label, position: { ...center } })
        }
      }

      for (const prize of prizes.values()) {
        const p = prize.body.translation()
        const velocity = prize.body.linvel()
        const speed = Math.hypot(velocity.x, velocity.y, velocity.z)
        // 勢いよくぶつかって急に止まった景品だけを、音とほこりのきっかけにする。
        if (prize.speed > 0.55 && speed < prize.speed * 0.55 && elapsed - prize.bumpedAt > 0.22) {
          prize.bumpedAt = elapsed
          events.push({ kind: 'bump', position: { ...p }, strength: Math.min(1, prize.speed / 1.8) })
        }
        prize.speed = speed
        if (!prize.caught && p.y < CAUGHT_Y && p.x > CHUTE.minX && p.x < CHUTE.maxX && p.z > CHUTE.minZ && p.z < CHUTE.maxZ) {
          prize.caught = true
          prize.caughtAt = elapsed
          collected++
          if (grip?.prize.id === prize.id) releaseGrip()
          events.push({ kind: 'caught', prize: prize.id, label: prize.species.label, emoji: prize.species.emoji, species: prize.species.id, position: { ...p } })
        }
        // 受け皿で落ち着いた景品は取り除く。剛体の数を一定に保つ。
        if (prize.caught && elapsed - prize.caughtAt > CLEAR_DELAY) {
          byCollider.delete(prize.collider.handle)
          world.removeRigidBody(prize.body)
          prizes.delete(prize.id)
        }
      }
    },
    dispose() { world.free() },
  }
}

export type CraneWorld = ReturnType<typeof createCraneWorld>
