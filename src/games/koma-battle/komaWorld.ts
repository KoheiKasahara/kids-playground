/**
 * Rapierの世界とコマの剛体を組み立てる。
 *
 * Hookとheadlessテストが完全に同じ世界を作れるよう、
 * Three.jsにもDOMにも依存させていない。
 * これにより「本当に物理で戦っているか」をvitestの中で実際に回して確認できる。
 */

import type { RigidBody, World } from '@dimforge/rapier3d-compat'
import {
  ANGULAR_DAMPING,
  DISK_CENTER_Y,
  DISK_FRICTION,
  DISK_HALF_HEIGHT,
  DISK_RADIUS,
  DISK_RESTITUTION,
  FLOOR_FRICTION,
  FLOOR_RESTITUTION,
  GRAVITY_Y,
  KOMA_DENSITY,
  KOMA_CONTACT_MARGIN,
  KOMA_KNOCKBACK_MAX_CLOSING_SPEED,
  KOMA_KNOCKBACK_MAX_IMPULSE,
  KOMA_KNOCKBACK_MIN_CLOSING_SPEED,
  KOMA_KNOCKBACK_MIN_IMPULSE,
  LINEAR_DAMPING,
  MAX_ANGULAR_SPEED,
  MAX_LINEAR_SPEED,
  PHYSICS_TIMESTEP,
  SHAFT_CENTER_Y,
  SHAFT_HALF_HEIGHT,
  SHAFT_RADIUS,
  START_INWARD_SPEED,
  START_ORBIT_SPEED,
  START_RADIUS,
  START_SPIN_SPEED,
  TIP_FRICTION,
  TIP_RADIUS,
  TIP_RESTITUTION,
  WALL_FRICTION,
  WALL_REDIRECT_MAX_IMPULSE,
  WALL_REDIRECT_MIN_IMPULSE,
  WALL_REDIRECT_MIN_OUTWARD_SPEED,
  WALL_RESTITUTION,
  CONTACT_RELEASE_MARGIN,
} from './komaPhysics'
import {
  BUMPER_FRICTION,
  BUMPER_RESTITUTION,
  BUMPER_RADIUS,
  BUMPER_HEIGHT,
  createStadiumHeightfield,
  createWallSegments,
  HEIGHTFIELD_SEGMENTS,
  fieldHeightAt,
  getKomaField,
  WALL_INNER_RADIUS,
  type KomaField,
  type KomaFieldId,
} from './komaStadium'
import type { KomaSpec } from './komaSpecs'
import {
  clampedVector,
  spinSpeedOf,
  stabilizationTorque,
  tiltAngleOf,
  upVectorOf,
  type Vector3,
} from './komaSpin'

/** Hookとheadlessテストが同じRapierコンストラクタを共有するための最小インターフェース。 */
export type RapierModule = Pick<
  typeof import('@dimforge/rapier3d-compat'),
  'World' | 'RigidBodyDesc' | 'ColliderDesc'
>

export type KomaEntry = {
  spec: KomaSpec
  body: RigidBody
  /** 低速時のふらつきの位相。コマごとにずらして同じ方向へ倒れないようにする。 */
  wobblePhase: number
}

export type KomaBattleWorld = {
  world: World
  komas: KomaEntry[]
  /** 接触開始時だけ補正するための試合単位状態。世界の再生成で必ず初期化される。 */
  contactAssist: KomaContactAssistState
}

export type KomaContactAssistState = {
  activeKomaPair: boolean
  activeWalls: Set<number>
}

export type KomaContactAssistResult = {
  komaKnockbacks: number
  wallRedirects: number
  maxAppliedImpulse: number
}

/** 開始位置。2個なら向かい合わせ、1個なら中心寄り。 */
export function startPlacement(
  index: number,
  count: number,
  /**
   * すり鉢をどちら回りに周回させるか。2個対戦では逆向きにして、
   * 半周ごとに正面ですれ違うようにする。
   */
  orbitDirection: 1 | -1 = 1,
  /** 毎回まったく同じ試合にならないよう、開始角をずらす量[rad]。既定0で完全に決定的。 */
  angleOffset = 0,
  /** タイプごとの周回速度倍率。内向き速度は固定して外周への逃走を防ぐ。 */
  orbitSpeedScale = 1,
  field: KomaField | KomaFieldId | string = 'basic',
): { position: Vector3; velocity: Vector3 } {
  const selectedField = getKomaField(field)
  if (count <= 1) {
    // 1個モードは相手がいないので、周回させず中央付近へ置く。
    // 高速回転→失速→ぐらつき→停止までをそのまま観察できる配置。
    const y = fieldHeightAt(selectedField, 0.35)
    return {
      position: { x: 0.35, y: y + 0.02, z: 0 },
      velocity: { x: 0, y: 0, z: 0 },
    }
  }
  const angle = (index / count) * Math.PI * 2 + angleOffset
  const x = Math.cos(angle) * START_RADIUS
  const z = Math.sin(angle) * START_RADIUS
  // 接線方向（周回）＋わずかな内向き。
  const tangentX = -Math.sin(angle) * orbitDirection
  const tangentZ = Math.cos(angle) * orbitDirection
  return {
    position: { x, y: fieldHeightAt(selectedField, START_RADIUS) + 0.02, z },
    velocity: {
      x: tangentX * START_ORBIT_SPEED * orbitSpeedScale - Math.cos(angle) * START_INWARD_SPEED,
      y: 0,
      z: tangentZ * START_ORBIT_SPEED * orbitSpeedScale - Math.sin(angle) * START_INWARD_SPEED,
    },
  }
}

/** タイプ定義が将来増えても、物理へ渡す倍率を安全域へ留める。 */
function safeTypeScale(value: number, minimum: number, maximum: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(value, minimum), maximum) : 1
}

/**
 * スタジアムとコマを作る。
 *
 * 固定物（すり鉢の高さ場・外周壁）は親RigidBodyを持たないColliderにしているため、
 * 剛体はコマの数（最大2個）だけで済む。
 */
export function createKomaBattleWorld(
  rapier: RapierModule,
  specs: readonly KomaSpec[],
  options: {
    heightfieldSegments?: number
    startAngleOffset?: number
    /** コマごとの初速倍率。未指定なら全て1で完全に決定的になる（テスト用）。 */
    spinScales?: readonly number[]
    /** フィールド定義のID（未知の値はbasicへ戻る）。 */
    fieldId?: KomaFieldId | string
    /** 定義オブジェクトを直接渡す場合の別名。テスト・headless利用にも便利。 */
    field?: KomaField | KomaFieldId | string
  } = {},
): KomaBattleWorld {
  const world = new rapier.World({ x: 0, y: GRAVITY_Y, z: 0 })
  world.timestep = PHYSICS_TIMESTEP

  const selectedField = getKomaField(options.field ?? options.fieldId)

  const heightfield = createStadiumHeightfield(
    options.heightfieldSegments ?? HEIGHTFIELD_SEGMENTS,
    selectedField,
  )
  world.createCollider(
    rapier.ColliderDesc.heightfield(heightfield.segments, heightfield.segments, heightfield.heights, {
      x: heightfield.size,
      y: 1,
      z: heightfield.size,
    })
      .setFriction(FLOOR_FRICTION)
      .setRestitution(FLOOR_RESTITUTION),
  )

  for (const segment of createWallSegments(undefined, selectedField.wallHeight)) {
    world.createCollider(
      rapier.ColliderDesc.cuboid(segment.halfWidth, segment.halfHeight, segment.halfDepth)
        .setTranslation(segment.center.x, segment.center.y, segment.center.z)
        .setRotation({
          x: 0,
          y: Math.sin(segment.yaw / 2),
          z: 0,
          w: Math.cos(segment.yaw / 2),
        })
        .setFriction(WALL_FRICTION)
        .setRestitution(WALL_RESTITUTION),
    )
  }

  // バンパーは固定Colliderだけ。動的な剛体を増やさず、少数の丸い障害物で
  // 軌道だけを変える。床に埋め込むことで隙間に永久拘束されにくくする。
  for (const obstacle of selectedField.obstacles) {
    if (obstacle.type !== 'bumper') continue
    const radius = Number.isFinite(obstacle.radius) ? Math.max(0.08, obstacle.radius) : BUMPER_RADIUS
    const height = Number.isFinite(obstacle.height) ? Math.max(0.12, obstacle.height) : BUMPER_HEIGHT
    const floorY = fieldHeightAt(selectedField, Math.hypot(obstacle.x, obstacle.z))
    world.createCollider(
      rapier.ColliderDesc.cylinder(height / 2, radius)
        .setTranslation(obstacle.x, floorY + height / 2, obstacle.z)
        .setFriction(BUMPER_FRICTION)
        .setRestitution(BUMPER_RESTITUTION),
    )
  }

  const komas: KomaEntry[] = []
  specs.forEach((spec, index) => {
    const type = spec.type
    const densityScale = safeTypeScale(type.densityScale, 0.75, 1.25)
    const diskRadiusScale = safeTypeScale(type.visual.diskRadiusScale, 0.9, 1.12)
    const diskThicknessScale = safeTypeScale(type.visual.diskThicknessScale, 0.8, 1.25)
    const frictionScale = safeTypeScale(type.diskFrictionScale, 0.7, 1.3)
    const restitutionScale = safeTypeScale(
      type.diskRestitutionScale * type.collisionImpulseScale,
      0.65,
      1.25,
    )
    const angularDampingScale = safeTypeScale(type.angularDampingScale, 0.65, 1.3)
    const initialSpinScale = safeTypeScale(type.initialSpinScale, 0.8, 1.2)
    const orbitSpeedScale = safeTypeScale(type.orbitSpeedScale, 0.8, 1.2)

    // 自転の向きと周回の向きをそろえ、2個が必ず逆回りですれ違うようにする。
    const placement = startPlacement(
      index,
      specs.length,
      spec.spinDirection,
      options.startAngleOffset ?? 0,
      orbitSpeedScale,
      selectedField,
    )
    const body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(placement.position.x, placement.position.y, placement.position.z)
        .setLinearDamping(LINEAR_DAMPING)
        .setAngularDamping(ANGULAR_DAMPING * angularDampingScale)
        // 高速で弾かれたコマが壁や床を1ステップで飛び越えないようにする。
        .setCcdEnabled(true)
        // 回転が止まるまで判定を続けたいので、途中でsleepさせない。
        .setCanSleep(false),
    )

    // 先端。ほぼ点接触にして、床とのねじれ摩擦で自転が不自然に殺されないようにする。
    world.createCollider(
      rapier.ColliderDesc.ball(TIP_RADIUS)
        .setTranslation(0, TIP_RADIUS, 0)
        .setDensity(KOMA_DENSITY * densityScale)
        .setFriction(TIP_FRICTION)
        .setRestitution(TIP_RESTITUTION),
      body,
    )
    // 軸。傾いたコマ同士が円盤の下をすり抜けるのを防ぐ。
    world.createCollider(
      rapier.ColliderDesc.cylinder(SHAFT_HALF_HEIGHT, SHAFT_RADIUS)
        .setTranslation(0, SHAFT_CENTER_Y, 0)
        .setDensity(KOMA_DENSITY * densityScale)
        .setFriction(TIP_FRICTION)
        .setRestitution(TIP_RESTITUTION),
      body,
    )
    // 円盤部。相手とぶつかる本体で、慣性モーメントの大半もここが持つ。
    world.createCollider(
      rapier.ColliderDesc.cylinder(
        DISK_HALF_HEIGHT * diskThicknessScale,
        DISK_RADIUS * diskRadiusScale,
      )
        .setTranslation(0, DISK_CENTER_Y, 0)
        .setDensity(KOMA_DENSITY * densityScale)
        .setFriction(DISK_FRICTION * frictionScale)
        .setRestitution(
          Math.min(0.9, Math.max(0.05, DISK_RESTITUTION * restitutionScale)),
        ),
      body,
    )

    body.setLinvel(placement.velocity, true)
    const spinScale = options.spinScales?.[index] ?? 1
    body.setAngvel(
      {
        x: 0,
        y: START_SPIN_SPEED * initialSpinScale * spinScale * spec.spinDirection,
        z: 0,
      },
      true,
    )

    komas.push({
      spec,
      body,
      // 2個が同じ向きへ倒れないよう、位相をコマごとにずらす。
      wobblePhase: (index * Math.PI * 2) / Math.max(1, specs.length),
    })
  })

  return {
    world,
    komas,
    contactAssist: {
      activeKomaPair: false,
      activeWalls: new Set<number>(),
    },
  }
}

function finiteUnitOrNull(x: number, z: number): { x: number; z: number } | null {
  const length = Math.hypot(x, z)
  if (!Number.isFinite(length) || length < 1e-6) return null
  return { x: x / length, z: z / length }
}

function scaledBetween(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value) || maximum <= minimum) return 0
  return Math.min(1, Math.max(0, (value - minimum) / (maximum - minimum)))
}

/**
 * 接触開始時だけ、ゲーム向けの小さなimpulseを加える。
 *
 * Rapier本来の接触解決は残し、円盤同士には等大反対向きのimpulse、壁際には
 * 中央向きのimpulseだけを足す。位置・姿勢は書き換えず、質量差もRapierへ任せる。
 * `active=false` は決着後の補正停止に使い、状態も解除して再発火を防ぐ。
 */
export function applyKomaContactAssist(
  battle: KomaBattleWorld,
  active = true,
): KomaContactAssistResult {
  const result: KomaContactAssistResult = {
    komaKnockbacks: 0,
    wallRedirects: 0,
    maxAppliedImpulse: 0,
  }
  const state = battle.contactAssist
  if (!active) {
    state.activeKomaPair = false
    state.activeWalls.clear()
    return result
  }

  if (battle.komas.length === 2) {
    const [a, b] = battle.komas
    const ta = a!.body.translation()
    const tb = b!.body.translation()
    const radiusA = DISK_RADIUS * a!.spec.type.visual.diskRadiusScale
    const radiusB = DISK_RADIUS * b!.spec.type.visual.diskRadiusScale
    const contactDistance = radiusA + radiusB + KOMA_CONTACT_MARGIN
    const releaseDistance = contactDistance + CONTACT_RELEASE_MARGIN
    const verticalContactDistance =
      DISK_HALF_HEIGHT *
        (a!.spec.type.visual.diskThicknessScale + b!.spec.type.visual.diskThicknessScale) +
      0.08
    const offsetX = tb.x - ta.x
    const offsetZ = tb.z - ta.z
    const distance = Math.hypot(offsetX, offsetZ)

    if (distance > releaseDistance) state.activeKomaPair = false
    if (
      !state.activeKomaPair &&
      distance <= contactDistance &&
      Math.abs(tb.y - ta.y) <= verticalContactDistance
    ) {
      const normal = finiteUnitOrNull(offsetX, offsetZ)
      const va = a!.body.linvel()
      const vb = b!.body.linvel()
      if (normal !== null) {
        const closingSpeed = Math.max(
          0,
          -((vb.x - va.x) * normal.x + (vb.z - va.z) * normal.z),
        )
        if (closingSpeed >= KOMA_KNOCKBACK_MIN_CLOSING_SPEED) {
          const intensity = scaledBetween(
            closingSpeed,
            KOMA_KNOCKBACK_MIN_CLOSING_SPEED,
            KOMA_KNOCKBACK_MAX_CLOSING_SPEED,
          )
          const baseImpulse =
            KOMA_KNOCKBACK_MIN_IMPULSE +
            (KOMA_KNOCKBACK_MAX_IMPULSE - KOMA_KNOCKBACK_MIN_IMPULSE) *
              Math.sqrt(intensity)
          const typeScale = safeTypeScale(
            (a!.spec.type.collisionImpulseScale + b!.spec.type.collisionImpulseScale) / 2,
            0.85,
            1.15,
          )
          const impulse = Math.min(KOMA_KNOCKBACK_MAX_IMPULSE, baseImpulse * typeScale)
          a!.body.applyImpulse({ x: -normal.x * impulse, y: 0, z: -normal.z * impulse }, true)
          b!.body.applyImpulse({ x: normal.x * impulse, y: 0, z: normal.z * impulse }, true)
          state.activeKomaPair = true
          result.komaKnockbacks = 1
          result.maxAppliedImpulse = impulse
        }
      }
    }
  }

  battle.komas.forEach((koma, index) => {
    const translation = koma.body.translation()
    const radius = Math.hypot(translation.x, translation.z)
    const diskRadius = DISK_RADIUS * koma.spec.type.visual.diskRadiusScale
    const contactRadius = WALL_INNER_RADIUS - diskRadius * 0.72
    if (radius < contactRadius - CONTACT_RELEASE_MARGIN) state.activeWalls.delete(index)
    if (state.activeWalls.has(index) || radius < contactRadius) return

    const outward = finiteUnitOrNull(translation.x, translation.z)
    if (outward === null) return
    const velocity = koma.body.linvel()
    const outwardSpeed = velocity.x * outward.x + velocity.z * outward.z
    if (!Number.isFinite(outwardSpeed) || outwardSpeed < WALL_REDIRECT_MIN_OUTWARD_SPEED) return

    const intensity = scaledBetween(outwardSpeed, WALL_REDIRECT_MIN_OUTWARD_SPEED, 4.5)
    const impulse =
      WALL_REDIRECT_MIN_IMPULSE +
      (WALL_REDIRECT_MAX_IMPULSE - WALL_REDIRECT_MIN_IMPULSE) * Math.sqrt(intensity)
    koma.body.applyImpulse({ x: -outward.x * impulse, y: 0, z: -outward.z * impulse }, true)
    state.activeWalls.add(index)
    result.wallRedirects += 1
    result.maxAppliedImpulse = Math.max(result.maxAppliedImpulse, impulse)
  })

  return result
}

/** 判定と描画の両方が使う、1体ぶんの観測値。 */
export type KomaReading = {
  position: Vector3
  up: Vector3
  tiltRad: number
  spinSpeed: number
  linearSpeed: number
  radius: number
}

export function readKoma(entry: KomaEntry): KomaReading {
  const translation = entry.body.translation()
  const up = upVectorOf(entry.body.rotation())
  const linear = entry.body.linvel()
  const angular = entry.body.angvel()
  return {
    position: { x: translation.x, y: translation.y, z: translation.z },
    up,
    tiltRad: tiltAngleOf(up),
    spinSpeed: spinSpeedOf(angular, up),
    linearSpeed: Math.hypot(linear.x, linear.y, linear.z),
    radius: Math.hypot(translation.x, translation.z),
  }
}

/**
 * 1物理ステップぶんの補正を加える。world.step()の直前に呼ぶ。
 *
 * ここで行うのは「トルクを足す」ことと「異常値を安全域へ丸める」ことだけで、
 * 位置や姿勢を直接書き換えることはしない。
 */
export function applyKomaAssist(entry: KomaEntry, dt: number): void {
  const body = entry.body
  const up = upVectorOf(body.rotation())
  const angular = body.angvel()
  const spinSpeed = spinSpeedOf(angular, up)

  const torque = stabilizationTorque({
    up,
    angularVelocity: angular,
    spinSpeed,
    wobblePhase: entry.wobblePhase,
  })
  const stabilizationScale = safeTypeScale(entry.spec.type.stabilizationScale, 0.7, 1.3)
  body.applyTorqueImpulse(
    {
      x: torque.x * dt * stabilizationScale,
      y: torque.y * dt * stabilizationScale,
      z: torque.z * dt * stabilizationScale,
    },
    true,
  )
}

/**
 * 速度が安全域を超えていれば丸める。world.step()の直後に呼ぶ。
 * 「宇宙まで吹き飛ぶ」「NaNが伝播する」状態を常態化させないための最後の砦。
 */
export function clampKomaMotion(entry: KomaEntry): void {
  const body = entry.body
  const linear = clampedVector(body.linvel(), MAX_LINEAR_SPEED)
  if (linear !== null) body.setLinvel(linear, true)
  const angular = clampedVector(body.angvel(), MAX_ANGULAR_SPEED)
  if (angular !== null) body.setAngvel(angular, true)
}
