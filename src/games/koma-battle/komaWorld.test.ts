import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyKomaAssist,
  applyKomaBoost,
  applyKomaContactAssist,
  clampKomaMotion,
  createKomaBattleWorld,
  readKoma,
  startPlacement,
  type KomaBattleWorld,
} from './komaWorld'
import { KOMA_TYPE_CONFIGS, komaSpecsForCount, komaSpecsForSelection } from './komaSpecs'
import {
  DISK_FRICTION,
  DISK_RADIUS,
  DISK_RESTITUTION,
  KOMA_CONTACT_MARGIN,
  KOMA_DENSITY,
  KOMA_BOOST_MAX_SPIN_SPEED,
  KOMA_BOOST_MIN_SPIN_SPEED,
  MAX_ANGULAR_SPEED,
  MAX_LINEAR_SPEED,
  PHYSICS_TIMESTEP,
  START_RADIUS,
  START_SPIN_SPEED,
} from './komaPhysics'
import {
  BOWL_RADIUS,
  bowlHeightAt,
  fieldHeightAt,
  KOMA_FIELD_DEFINITIONS,
  OUT_RADIUS,
  WALL_INNER_RADIUS,
  WALL_SEGMENTS,
} from './komaStadium'
import {
  createKomaJudgeState,
  decideMatchOutcome,
  START_GRACE_MS,
  updateKomaJudge,
  type KomaJudgeState,
  type MatchOutcome,
} from './komaOutcome'

/**
 * 実際にRapierを回して1試合ぶん進める。
 *
 * 物理挙動そのものを細かい数値へ固定すると、Rapierの更新で簡単に壊れる脆いテストになる。
 * ここで確かめるのは「高速回転中は安定し、失速するとぐらついて倒れる」という
 * 流れが成立していることと、異常な状態が起きないことに絞っている。
 */
function simulate(
  world: KomaBattleWorld,
  seconds: number,
): {
  outcome: MatchOutcome | null
  outcomeAtMs: number
  maxTiltWhileFast: number
  maxTiltAtEnd: number
  minSpinAtEnd: number
  sawFiniteAlways: boolean
  maxLinearSpeed: number
  maxAngularSpeed: number
  maxRadius: number
  endRadius: number
  contacts: number
  knockbacks: number
  wallRedirects: number
} {
  const steps = Math.round(seconds / PHYSICS_TIMESTEP)
  const stepMs = PHYSICS_TIMESTEP * 1000
  let states: KomaJudgeState[] = world.komas.map(() => createKomaJudgeState())
  let elapsedMs = 0
  let outcome: MatchOutcome | null = null
  let outcomeAtMs = -1
  let maxTiltWhileFast = 0
  let maxTiltAtEnd = 0
  let minSpinAtEnd = Number.POSITIVE_INFINITY
  let sawFiniteAlways = true
  let maxLinearSpeed = 0
  let maxAngularSpeed = 0
  let maxRadius = 0
  let endRadius = 0
  let contacts = 0
  let touching = false
  let knockbacks = 0
  let wallRedirects = 0

  for (let step = 0; step < steps; step += 1) {
    for (const koma of world.komas) applyKomaAssist(koma, PHYSICS_TIMESTEP)
    const assist = applyKomaContactAssist(world, outcome === null)
    knockbacks += assist.komaKnockbacks
    wallRedirects += assist.wallRedirects
    world.world.step()
    for (const koma of world.komas) clampKomaMotion(koma)
    elapsedMs += stepMs

    const readings = world.komas.map(readKoma)
    for (const [index, reading] of readings.entries()) {
      const angularVelocity = world.komas[index]!.body.angvel()
      const angular = Math.hypot(
        angularVelocity.x,
        angularVelocity.y,
        angularVelocity.z,
      )
      if (
        !Number.isFinite(reading.position.x) ||
        !Number.isFinite(reading.position.y) ||
        !Number.isFinite(reading.tiltRad) ||
        !Number.isFinite(reading.spinSpeed)
      ) {
        sawFiniteAlways = false
      }
      maxLinearSpeed = Math.max(maxLinearSpeed, reading.linearSpeed)
      maxAngularSpeed = Math.max(maxAngularSpeed, angular)
      maxRadius = Math.max(maxRadius, reading.radius)
      endRadius = reading.radius
      // 「高速回転中は比較的安定」を、回転が速い間の最大の傾きで測る。
      if (Math.abs(reading.spinSpeed) > 55) {
        maxTiltWhileFast = Math.max(maxTiltWhileFast, reading.tiltRad)
      }
      maxTiltAtEnd = Math.max(maxTiltAtEnd, reading.tiltRad)
      minSpinAtEnd = Math.min(minSpinAtEnd, Math.abs(reading.spinSpeed))
    }

    if (outcome === null && readings.length === 2) {
      const gap = Math.hypot(
        readings[0]!.position.x - readings[1]!.position.x,
        readings[0]!.position.z - readings[1]!.position.z,
      )
      const near =
        gap <=
        DISK_RADIUS *
          (world.komas[0]!.spec.type.visual.diskRadiusScale +
            world.komas[1]!.spec.type.visual.diskRadiusScale) +
          KOMA_CONTACT_MARGIN
      if (near && !touching) contacts += 1
      touching = near
    }

    if (outcome === null) {
      states = states.map((state, index) =>
        updateKomaJudge(
          state,
          { ...readings[index]!, y: readings[index]!.position.y },
          stepMs,
          elapsedMs,
        ),
      )
      outcome = decideMatchOutcome(states, elapsedMs)
      if (outcome !== null) outcomeAtMs = elapsedMs
    }
  }

  return {
    outcome,
    outcomeAtMs,
    maxTiltWhileFast,
    maxTiltAtEnd,
    minSpinAtEnd,
    sawFiniteAlways,
    maxLinearSpeed,
    maxAngularSpeed,
    maxRadius,
    endRadius,
    contacts,
    knockbacks,
    wallRedirects,
  }
}

describe('startPlacement', () => {
  it('2個は向かい合わせに置かれる', () => {
    const first = startPlacement(0, 2)
    const second = startPlacement(1, 2)
    expect(Math.hypot(first.position.x, first.position.z)).toBeCloseTo(START_RADIUS, 6)
    expect(Math.hypot(second.position.x, second.position.z)).toBeCloseTo(START_RADIUS, 6)
    const gap = Math.hypot(
      first.position.x - second.position.x,
      first.position.z - second.position.z,
    )
    expect(gap).toBeCloseTo(START_RADIUS * 2, 6)
  })

  it('床の上に置かれ、めり込んだ状態から始まらない', () => {
    for (const count of [1, 2]) {
      for (let index = 0; index < count; index += 1) {
        const placement = startPlacement(index, count)
        const radius = Math.hypot(placement.position.x, placement.position.z)
        expect(placement.position.y).toBeGreaterThan(bowlHeightAt(radius))
      }
    }
  })

  it('2個は互いに逆向きに周回し、必ずすれ違うようにする', () => {
    const clockwise = startPlacement(0, 2, 1)
    const counter = startPlacement(0, 2, -1)
    // 同じ位置でも周回の向きが逆になる。
    expect(clockwise.velocity.z).toBeCloseTo(-counter.velocity.z, 6)
  })

  it('1個モードは周回させず、中央付近へ静かに置く', () => {
    const solo = startPlacement(0, 1)
    expect(Math.hypot(solo.velocity.x, solo.velocity.z)).toBe(0)
    expect(Math.hypot(solo.position.x, solo.position.z)).toBeLessThan(BOWL_RADIUS)
  })
})

describe('createKomaBattleWorld', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('剛体はコマの数だけで、スタジアムは固定Colliderで作る', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    // 最大2個という前提を、剛体数そのもので守る。
    expect(world.world.bodies.len()).toBe(2)
    world.world.free()
  })

  it('1体あたりのColliderは3つ（先端・軸・円盤）だけ', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    expect(world.komas[0]!.body.numColliders()).toBe(3)
    world.world.free()
  })

  it('フィールドごとの固定Collider数を小さく保つ（bumperだけ3つ増え、開口ぶん壁が減る）', () => {
    for (const field of KOMA_FIELD_DEFINITIONS) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), { fieldId: field.id })
      expect(world.world.bodies.len()).toBe(2)
      // 場外ポイント（開口）ぶんだけ壁Colliderが既定の24枚から減っている。
      expect(world.world.colliders.len()).toBe(field.id === 'bumper' ? 26 : 23)
      world.world.free()
    }
  })

  it('bumperへ当たるとコマの進行方向が変わる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1), { fieldId: 'bumper' })
    const koma = world.komas[0]!
    const bumper = KOMA_FIELD_DEFINITIONS.find((field) => field.id === 'bumper')!.obstacles[0]!
    const startX = bumper.x - 0.62
    const startZ = bumper.z
    koma.body.setTranslation(
      { x: startX, y: fieldHeightAt('bumper', Math.hypot(startX, startZ)) + 0.02, z: startZ },
      true,
    )
    koma.body.setLinvel({ x: 4, y: 0, z: 0 }, true)
    let maxSideVelocity = 0
    let maxSpeed = 0
    for (let step = 0; step < 180; step += 1) {
      applyKomaAssist(koma, PHYSICS_TIMESTEP)
      world.world.step()
      clampKomaMotion(koma)
      const velocity = koma.body.linvel()
      maxSideVelocity = Math.max(maxSideVelocity, Math.abs(velocity.z))
      maxSpeed = Math.max(maxSpeed, Math.hypot(velocity.x, velocity.y, velocity.z))
    }
    expect(maxSideVelocity).toBeGreaterThan(0.02)
    expect(maxSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
    world.world.free()
  })

  it('コマは開始時に自転しており、2個は互いに逆回りになる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    const [first, second] = world.komas
    expect(Math.abs(first!.body.angvel().y)).toBeGreaterThan(10)
    expect(Math.sign(first!.body.angvel().y)).toBe(-Math.sign(second!.body.angvel().y))
    world.world.free()
  })

  it('初速のばらつきを渡すと、その割合だけ自転速度が変わる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
      spinScales: [1.1, 0.9],
    })
    const base = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    expect(Math.abs(world.komas[0]!.body.angvel().y)).toBeCloseTo(
      Math.abs(base.komas[0]!.body.angvel().y) * 1.1,
      4,
    )
    world.world.free()
    base.world.free()
  })

  it('タイプ定義の密度・接触・初速が物理へ反映される', () => {
    for (const type of KOMA_TYPE_CONFIGS) {
      const world = createKomaBattleWorld(
        RAPIER,
        komaSpecsForSelection([type.id], 1),
      )
      const body = world.komas[0]!.body
      const disk = body.collider(2)
      expect(Number.isFinite(body.mass())).toBe(true)
      expect(body.mass()).toBeGreaterThan(0)
      expect(disk.density()).toBeCloseTo(KOMA_DENSITY * type.densityScale, 6)
      expect(disk.friction()).toBeCloseTo(DISK_FRICTION * type.diskFrictionScale, 6)
      expect(disk.restitution()).toBeCloseTo(
        Math.min(
          0.9,
          Math.max(
            0.05,
            DISK_RESTITUTION * type.diskRestitutionScale * type.collisionImpulseScale,
          ),
        ),
        6,
      )
      expect(body.angvel().y).toBeCloseTo(START_SPIN_SPEED * type.initialSpinScale, 6)
      world.world.free()
    }
  })
})

describe('タップブースト', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('4タイプすべてを同じルールで低速からすぐ安定回転へ戻す', () => {
    for (const type of KOMA_TYPE_CONFIGS) {
      const world = createKomaBattleWorld(
        RAPIER,
        komaSpecsForSelection([type.id], 1),
      )
      const koma = world.komas[0]!
      koma.body.setAngvel({ x: 0, y: 4 * koma.spec.spinDirection, z: 0 }, true)
      koma.body.setLinvel({ x: 0, y: 0, z: 0 }, true)

      const result = applyKomaBoost(koma)

      expect(Math.abs(result.spinAfter)).toBeGreaterThanOrEqual(KOMA_BOOST_MIN_SPIN_SPEED)
      expect(Math.abs(result.spinAfter)).toBeLessThanOrEqual(KOMA_BOOST_MAX_SPIN_SPEED)
      expect(Math.sign(result.spinAfter)).toBe(koma.spec.spinDirection)
      expect(result.moveImpulseApplied).toBe(true)
      world.world.free()
    }
  })

  it('触った1体だけをブーストし、もう1体の速度は変えない', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    const [first, second] = world.komas
    first!.body.setAngvel({ x: 0, y: 8, z: 0 }, true)
    const secondAngularBefore = { ...second!.body.angvel() }
    const secondLinearBefore = { ...second!.body.linvel() }

    applyKomaBoost(first!)

    expect(second!.body.angvel()).toEqual(secondAngularBefore)
    expect(second!.body.linvel()).toEqual(secondLinearBefore)
    world.world.free()
  })

  it('高速時と連打時も専用上限・全体上限を超えず有限値を保つ', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    koma.body.setAngvel({ x: 0, y: 84 * koma.spec.spinDirection, z: 0 }, true)
    koma.body.setLinvel({ x: 5, y: 0, z: 0 }, true)
    expect(applyKomaBoost(koma).moveImpulseApplied).toBe(false)

    for (let tap = 0; tap < 100; tap += 1) applyKomaBoost(koma)

    const reading = readKoma(koma)
    const angular = koma.body.angvel()
    expect(Math.abs(reading.spinSpeed)).toBeLessThanOrEqual(KOMA_BOOST_MAX_SPIN_SPEED)
    expect(Math.hypot(angular.x, angular.y, angular.z)).toBeLessThanOrEqual(MAX_ANGULAR_SPEED)
    expect(reading.linearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
    expect([
      reading.spinSpeed,
      reading.linearSpeed,
      reading.position.x,
      reading.position.y,
    ].every(Number.isFinite)).toBe(true)
    world.world.free()
  })

  it('傾きかけた低速状態でもコマ自身の軸方向へ回転を戻す', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    const angle = 0.55
    koma.body.setRotation(
      { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) },
      true,
    )
    koma.body.setAngvel({ x: 0, y: 3, z: 0 }, true)

    const result = applyKomaBoost(koma)

    expect(Math.abs(result.spinAfter)).toBeGreaterThanOrEqual(KOMA_BOOST_MIN_SPIN_SPEED)
    expect(Number.isFinite(result.spinAfter)).toBe(true)
    world.world.free()
  })
})

describe('コマ1個の一生（実際にRapierを回して確認する）', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('高速回転中は安定し、失速すると倒れて終了する', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const result = simulate(world, 30)

    // 1. 高速回転中は比較的安定（傾きが小さいまま保たれる）。
    expect(result.maxTiltWhileFast).toBeLessThan(0.15)
    // 2. 最終的には大きく傾いて倒れる。
    expect(result.maxTiltAtEnd).toBeGreaterThan(0.6)
    // 3. 回転も止まる。
    expect(result.minSpinAtEnd).toBeLessThan(1)
    // 4. 勝敗ではなく「終了」として扱われる。
    expect(result.outcome?.kind).toBe('soloFinished')
    // 5. すぐ終わらず、かといって延々と続かないテンポ。
    expect(result.outcomeAtMs).toBeGreaterThan(4000)
    expect(result.outcomeAtMs).toBeLessThan(25000)

    expect(result.sawFiniteAlways).toBe(true)
    world.world.free()
  })

  it('開始直後に倒れない', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    // 最初の2秒間は直立を保つ。
    const result = simulate(world, 2)
    expect(result.maxTiltAtEnd).toBeLessThan(0.15)
    expect(result.outcome).toBeNull()
    world.world.free()
  })

  it('4種類すべてが1個モードでも異常なく終了する', () => {
    for (const type of KOMA_TYPE_CONFIGS) {
      const world = createKomaBattleWorld(
        RAPIER,
        komaSpecsForSelection([type.id], 1),
      )
      const result = simulate(world, 30)

      expect(result.outcome?.kind).toBe('soloFinished')
      expect(result.outcomeAtMs).toBeGreaterThan(4000)
      expect(result.outcomeAtMs).toBeLessThan(25000)
      expect(result.sawFiniteAlways).toBe(true)
      expect(result.maxLinearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
      expect(result.maxAngularSpeed).toBeLessThanOrEqual(MAX_ANGULAR_SPEED)
      world.world.free()
    }
  })

  it('3フィールドすべてで1個モードが有限値のまま完走する', () => {
    for (const field of KOMA_FIELD_DEFINITIONS) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1), { fieldId: field.id })
      const result = simulate(world, 18)
      expect(result.outcome?.kind).toBe('soloFinished')
      expect(result.sawFiniteAlways).toBe(true)
      expect(result.maxLinearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
      expect(result.maxRadius).toBeLessThan(OUT_RADIUS)
      world.world.free()
    }
  })
})

describe('コマ2個の対戦（実際にRapierを回して確認する）', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  // 開始角を変えて複数回まわし、たまたま成立しただけの結果にならないようにする。
  const offsets = [0, 0.7, 1.4, 2.1, 2.8]

  it('毎回きちんと決着し、値が壊れない', () => {
    for (const offset of offsets) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
        startAngleOffset: offset,
        spinScales: [1.07, 0.93],
      })
      const result = simulate(world, 30)

      expect(result.outcome).not.toBeNull()
      expect(['win', 'draw']).toContain(result.outcome!.kind)
      // 幼児が最後まで見ていられる長さに収まる。
      expect(result.outcomeAtMs).toBeGreaterThan(4000)
      expect(result.outcomeAtMs).toBeLessThan(25000)

      // NaN・宇宙まで吹き飛ぶ・床を突き抜ける、が起きない。
      expect(result.sawFiniteAlways).toBe(true)
      expect(result.maxLinearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
      expect(result.maxAngularSpeed).toBeLessThanOrEqual(MAX_ANGULAR_SPEED)
      // 壁の外へ勝手に抜けない。
      expect(result.maxRadius).toBeLessThan(OUT_RADIUS)

      world.world.free()
    }
  })

  it('2個が離れたまま戦わない状態にならない', () => {
    for (const offset of offsets) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
        startAngleOffset: offset,
        spinScales: [1.07, 0.93],
      })
      const result = simulate(world, 30)
      // 1試合の中で必ず複数回ぶつかる。
      expect(result.contacts).toBeGreaterThanOrEqual(2)
      expect(result.knockbacks).toBeGreaterThanOrEqual(1)
      world.world.free()
    }
  })

  it('強い衝突ほど大きく弾き、接触中は追加impulseを多重発火しない', () => {
    function runContact(speed: number) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
      const [first, second] = world.komas
      first!.body.setTranslation({ x: -0.29, y: 0.02, z: 0 }, true)
      second!.body.setTranslation({ x: 0.29, y: 0.02, z: 0 }, true)
      first!.body.setLinvel({ x: speed, y: 0, z: 0 }, true)
      second!.body.setLinvel({ x: -speed, y: 0, z: 0 }, true)

      const before = first!.body.linvel().x
      const firstResult = applyKomaContactAssist(world)
      const delta = before - first!.body.linvel().x
      const repeated = applyKomaContactAssist(world)
      return { world, firstResult, repeated, delta }
    }

    const weak = runContact(0.3)
    const strong = runContact(2.2)
    expect(weak.firstResult.komaKnockbacks).toBe(1)
    expect(strong.firstResult.komaKnockbacks).toBe(1)
    expect(strong.delta).toBeGreaterThan(weak.delta)
    expect(strong.firstResult.maxAppliedImpulse).toBeGreaterThan(
      weak.firstResult.maxAppliedImpulse,
    )
    expect(weak.repeated.komaKnockbacks).toBe(0)
    expect(strong.repeated.komaKnockbacks).toBe(0)
    weak.world.world.free()
    strong.world.world.free()
  })

  it('強い正面衝突では中央付近から両方のコマが外周壁際まで弾かれる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    const [first, second] = world.komas
    const startRadius = 0.29
    const startY = fieldHeightAt('basic', startRadius) + 0.02
    first!.body.setTranslation({ x: -startRadius, y: startY, z: 0 }, true)
    second!.body.setTranslation({ x: startRadius, y: startY, z: 0 }, true)
    first!.body.setLinvel({ x: 2.4, y: 0, z: 0 }, true)
    second!.body.setLinvel({ x: -2.4, y: 0, z: 0 }, true)

    const initialAssist = applyKomaContactAssist(world)
    expect(initialAssist.komaKnockbacks).toBe(1)
    const maxRadii = [startRadius, startRadius]
    for (let step = 0; step < Math.round(2.5 / PHYSICS_TIMESTEP); step += 1) {
      for (const koma of world.komas) applyKomaAssist(koma, PHYSICS_TIMESTEP)
      applyKomaContactAssist(world)
      world.world.step()
      for (const [index, koma] of world.komas.entries()) {
        clampKomaMotion(koma)
        maxRadii[index] = Math.max(maxRadii[index]!, readKoma(koma).radius)
      }
    }

    for (const maxRadius of maxRadii) {
      expect(maxRadius).toBeGreaterThan(WALL_INNER_RADIUS - 0.3)
      expect(maxRadius).toBeLessThan(OUT_RADIUS)
    }
    world.world.free()
  })

  it('いったん離れた後の再衝突では追加impulseを再び1回だけ適用する', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    const [first, second] = world.komas
    first!.body.setTranslation({ x: -0.29, y: 0.02, z: 0 }, true)
    second!.body.setTranslation({ x: 0.29, y: 0.02, z: 0 }, true)
    first!.body.setLinvel({ x: 1, y: 0, z: 0 }, true)
    second!.body.setLinvel({ x: -1, y: 0, z: 0 }, true)
    expect(applyKomaContactAssist(world).komaKnockbacks).toBe(1)

    first!.body.setTranslation({ x: -0.8, y: 0.02, z: 0 }, true)
    second!.body.setTranslation({ x: 0.8, y: 0.02, z: 0 }, true)
    applyKomaContactAssist(world)
    first!.body.setTranslation({ x: -0.29, y: 0.02, z: 0 }, true)
    second!.body.setTranslation({ x: 0.29, y: 0.02, z: 0 }, true)
    first!.body.setLinvel({ x: 1, y: 0, z: 0 }, true)
    second!.body.setLinvel({ x: -1, y: 0, z: 0 }, true)
    expect(applyKomaContactAssist(world).komaKnockbacks).toBe(1)
    expect(applyKomaContactAssist(world).komaKnockbacks).toBe(0)
    world.world.free()
  })

  it('壁接触開始時だけ中央へ戻すimpulseを与え、決着後は補正しない', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    koma.body.setTranslation({ x: WALL_INNER_RADIUS - 0.15, y: 0.02, z: 0 }, true)
    koma.body.setLinvel({ x: 3, y: 0, z: 1 }, true)
    const before = koma.body.linvel().x
    const first = applyKomaContactAssist(world)
    expect(first.wallRedirects).toBe(1)
    expect(koma.body.linvel().x).toBeLessThan(before)
    expect(applyKomaContactAssist(world).wallRedirects).toBe(0)

    const velocityBeforeFinish = koma.body.linvel()
    expect(applyKomaContactAssist(world, false)).toEqual({
      komaKnockbacks: 0,
      wallRedirects: 0,
      maxAppliedImpulse: 0,
    })
    expect(koma.body.linvel()).toEqual(velocityBeforeFinish)
    world.world.free()
  })

  it('再戦用に世界を作り直すと接触状態も初期化される', () => {
    const firstRun = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    firstRun.contactAssist.activeKomaPair = true
    firstRun.contactAssist.activeWalls.add(0)
    const replay = createKomaBattleWorld(RAPIER, komaSpecsForCount(2))
    expect(replay.contactAssist.activeKomaPair).toBe(false)
    expect(replay.contactAssist.activeWalls.size).toBe(0)
    firstRun.world.free()
    replay.world.free()
  })

  it('外周付近まで使って戦い、最後は内側へ寄ってくる', () => {
    for (const offset of offsets) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
        startAngleOffset: offset,
        spinScales: [1.07, 0.93],
      })
      const result = simulate(world, 30)
      // 開始直後はスタジアムの外周寄りをまわる（中央へ一直線に落ちない）。
      expect(result.maxRadius).toBeGreaterThan(START_RADIUS * 0.9)
      // 失速すると谷へ寄る。壁沿いを永遠に周回したままにはならない。
      expect(result.endRadius).toBeLessThan(result.maxRadius)
      world.world.free()
    }
  })

  it('外周壁がコマを受け止め、勝手にすり抜けない', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    // 壁へ向かって水平に強く撃ち出す。壁を越える上向きの成分は与えない。
    koma.body.setTranslation({ x: 1.5, y: bowlHeightAt(1.5) + 0.02, z: 0 }, true)
    koma.body.setLinvel({ x: 8, y: 0, z: 0 }, true)

    let maxRadius = 0
    let bounced = false
    for (let step = 0; step < 240; step += 1) {
      applyKomaAssist(koma, PHYSICS_TIMESTEP)
      world.world.step()
      clampKomaMotion(koma)
      const reading = readKoma(koma)
      maxRadius = Math.max(maxRadius, reading.radius)
      // 壁に当たって内側へ戻される。
      if (koma.body.linvel().x < 0) bounced = true
    }
    expect(maxRadius).toBeGreaterThan(WALL_INNER_RADIUS - 0.35)
    expect(maxRadius).toBeLessThan(OUT_RADIUS)
    expect(bounced).toBe(true)
    world.world.free()
  })

  it('開口部（場外ポイント）を狙って強く弾くと、壁に止められず場外まで飛び出す', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1), { fieldId: 'basic' })
    const koma = world.komas[0]!
    // basicの既定開口（DEFAULT_WALL_GAPS）はセグメント3・4を含む＝角度45〜60度の間が開いている。
    // その中心付近を狙う。
    const gapAngle = (3.5 / WALL_SEGMENTS) * Math.PI * 2
    const startRadius = WALL_INNER_RADIUS - 0.2
    koma.body.setTranslation(
      {
        x: Math.cos(gapAngle) * startRadius,
        y: fieldHeightAt('basic', startRadius) + 0.02,
        z: Math.sin(gapAngle) * startRadius,
      },
      true,
    )
    koma.body.setLinvel({ x: Math.cos(gapAngle) * 8, y: 0, z: Math.sin(gapAngle) * 8 }, true)

    let maxRadius = 0
    let judgeState = createKomaJudgeState()
    let elapsedMs = 5000
    const stepMs = PHYSICS_TIMESTEP * 1000
    for (let step = 0; step < 240; step += 1) {
      applyKomaAssist(koma, PHYSICS_TIMESTEP)
      world.world.step()
      clampKomaMotion(koma)
      elapsedMs += stepMs
      const reading = readKoma(koma)
      maxRadius = Math.max(maxRadius, reading.radius)
      judgeState = updateKomaJudge(
        judgeState,
        { ...reading, y: reading.position.y },
        stepMs,
        elapsedMs,
      )
      if (judgeState.defeatReason !== null) break
    }

    // 既存の場外判定（isOutOfArena・updateKomaJudge）をそのまま使って場外が成立する。
    expect(maxRadius).toBeGreaterThanOrEqual(OUT_RADIUS)
    expect(judgeState.defeatReason).toBe('outOfArena')
    world.world.free()
  })

  it('壁が残っている向きへ同じ強さで弾いても、壁に止められて場外にならない', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1), { fieldId: 'basic' })
    const koma = world.komas[0]!
    // 角度0度（セグメント0）はDEFAULT_WALL_GAPSの対象外＝壁が残る向き。
    const startRadius = WALL_INNER_RADIUS - 0.9
    koma.body.setTranslation(
      { x: startRadius, y: fieldHeightAt('basic', startRadius) + 0.02, z: 0 },
      true,
    )
    koma.body.setLinvel({ x: 8, y: 0, z: 0 }, true)

    let maxRadius = 0
    for (let step = 0; step < 240; step += 1) {
      applyKomaAssist(koma, PHYSICS_TIMESTEP)
      world.world.step()
      clampKomaMotion(koma)
      maxRadius = Math.max(maxRadius, readKoma(koma).radius)
    }
    expect(maxRadius).toBeLessThan(OUT_RADIUS)
    world.world.free()
  })

  it('勝敗がつく場合、勝ったコマと負けたコマが必ず異なる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
      spinScales: [1.07, 0.93],
    })
    const result = simulate(world, 30)
    if (result.outcome?.kind === 'win') {
      expect(result.outcome.winnerIndex).not.toBe(result.outcome.loserIndex)
      expect([0, 1]).toContain(result.outcome.winnerIndex)
    }
    world.world.free()
  })

  it('4種類の全組み合わせ（同タイプを含む）で決着まで安全に進む', () => {
    for (const first of KOMA_TYPE_CONFIGS) {
      for (const second of KOMA_TYPE_CONFIGS) {
        const world = createKomaBattleWorld(
          RAPIER,
          komaSpecsForSelection([first.id, second.id], 2),
          {
            // 組み合わせごとに開始条件を少しだけ変え、特定の角度だけに依存しないことも見る。
            startAngleOffset: (first.id.length + second.id.length) * 0.17,
            spinScales: [1.04, 0.96],
          },
        )
        const result = simulate(world, 30)
        const outcome = result.outcome!
        // 場外で決着した場合は、既存の「壁の外へ勝手に抜けない」「4秒未満では終わらない」という
        // 前提そのものが今回の変更で意図的に崩れる（それがIssue #425の狙い）。
        // 場外以外の決着では、既存どおりのテンポと境界を引き続き守る。
        const isFieldOut = outcome.kind === 'win' && outcome.reason === 'outOfArena'

        expect(result.outcome).not.toBeNull()
        expect(['win', 'draw']).toContain(outcome.kind)
        expect(result.outcomeAtMs).toBeGreaterThan(isFieldOut ? START_GRACE_MS : 4000)
        expect(result.outcomeAtMs).toBeLessThan(25000)
        expect(result.sawFiniteAlways).toBe(true)
        // 場外後は壁の外を自由落下し続けるため、丸め誤差ぶん(浮動小数点の再正規化)だけ
        // クランプ値をわずかに超えて観測されることがある。安全弁自体は既存のまま。
        expect(result.maxLinearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED + 1e-4)
        expect(result.maxAngularSpeed).toBeLessThanOrEqual(MAX_ANGULAR_SPEED + 1e-4)
        if (!isFieldOut) expect(result.maxRadius).toBeLessThan(OUT_RADIUS)
        expect(result.contacts).toBeGreaterThanOrEqual(1)

        world.world.free()
      }
    }
  }, 60_000)

  it('3フィールドすべてで2個対戦が完走し、bumper接触でも値が壊れない', () => {
    for (const field of KOMA_FIELD_DEFINITIONS) {
      const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(2), {
        fieldId: field.id,
        spinScales: [1.07, 0.93],
      })
      const result = simulate(world, 18)
      expect(result.outcome).not.toBeNull()
      expect(result.sawFiniteAlways).toBe(true)
      expect(result.maxLinearSpeed).toBeLessThanOrEqual(MAX_LINEAR_SPEED)
      expect(result.maxAngularSpeed).toBeLessThanOrEqual(MAX_ANGULAR_SPEED)
      expect(result.maxRadius).toBeLessThan(OUT_RADIUS)
      world.world.free()
    }
  }, 60_000)
})

describe('安全弁', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('極端な速度を与えても安全域へ丸められる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    koma.body.setLinvel({ x: 5000, y: 0, z: 0 }, true)
    koma.body.setAngvel({ x: 0, y: 9000, z: 0 }, true)
    clampKomaMotion(koma)

    const linear = koma.body.linvel()
    const angular = koma.body.angvel()
    expect(Math.hypot(linear.x, linear.y, linear.z)).toBeCloseTo(MAX_LINEAR_SPEED, 4)
    expect(Math.hypot(angular.x, angular.y, angular.z)).toBeCloseTo(MAX_ANGULAR_SPEED, 4)
    world.world.free()
  })

  it('外へ強く弾き出されたコマは場外として判定できる', () => {
    const world = createKomaBattleWorld(RAPIER, komaSpecsForCount(1))
    const koma = world.komas[0]!
    // 壁を越える高さと速度を直接与え、場外の経路が実際に成立することを確かめる。
    koma.body.setTranslation({ x: 2.3, y: 0.6, z: 0 }, true)
    koma.body.setLinvel({ x: 6, y: 1.5, z: 0 }, true)

    let state = createKomaJudgeState()
    let elapsedMs = 5000
    const stepMs = PHYSICS_TIMESTEP * 1000
    for (let step = 0; step < 360; step += 1) {
      applyKomaAssist(koma, PHYSICS_TIMESTEP)
      world.world.step()
      clampKomaMotion(koma)
      elapsedMs += stepMs
      const reading = readKoma(koma)
      state = updateKomaJudge(
        state,
        { ...reading, y: reading.position.y },
        stepMs,
        elapsedMs,
      )
      if (state.defeatReason !== null) break
    }
    expect(state.defeatReason).toBe('outOfArena')
    world.world.free()
  })
})
