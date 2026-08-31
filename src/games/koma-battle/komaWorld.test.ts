import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  applyKomaAssist,
  clampKomaMotion,
  createKomaBattleWorld,
  readKoma,
  startPlacement,
  type KomaBattleWorld,
} from './komaWorld'
import { komaSpecsForCount } from './komaSpecs'
import { MAX_ANGULAR_SPEED, MAX_LINEAR_SPEED, PHYSICS_TIMESTEP, START_RADIUS } from './komaPhysics'
import { BOWL_RADIUS, bowlHeightAt, OUT_RADIUS, WALL_INNER_RADIUS } from './komaStadium'
import {
  createKomaJudgeState,
  decideMatchOutcome,
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

  for (let step = 0; step < steps; step += 1) {
    for (const koma of world.komas) applyKomaAssist(koma, PHYSICS_TIMESTEP)
    world.world.step()
    for (const koma of world.komas) clampKomaMotion(koma)
    elapsedMs += stepMs

    const readings = world.komas.map(readKoma)
    for (const reading of readings) {
      const angular = Math.hypot(
        ...(Object.values(world.komas[0]!.body.angvel()) as number[]),
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

    if (readings.length === 2) {
      const gap = Math.hypot(
        readings[0]!.position.x - readings[1]!.position.x,
        readings[0]!.position.z - readings[1]!.position.z,
      )
      const near = gap < 0.62
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
      world.world.free()
    }
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
