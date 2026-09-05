import { describe, expect, test } from 'vitest'
import { CAR_CATEGORIES, DEFAULT_CAR_CONFIG, selectCarOption, type CarConfig } from './carConfig'
import {
  CAR_WHEEL_RATIOS,
  carBoundingRadius,
  computeCarAttachments,
  computeCarDimensions,
  resolveWheelSpec,
} from './carDimensions'
import { CAR_VEHICLES, CAR_VEHICLE_ORDER } from './carVehicles'

/** 寸法に効く3カテゴリ（ボディ・タイヤ・車高）の全組み合わせ。 */
function dimensionCombinations(): CarConfig[] {
  const configs: CarConfig[] = []
  for (const body of CAR_CATEGORIES.body.options) {
    for (const wheel of CAR_CATEGORIES.wheel.options) {
      for (const rideHeight of CAR_CATEGORIES.rideHeight.options) {
        configs.push({ ...DEFAULT_CAR_CONFIG, body: body.id, wheel: wheel.id, rideHeight: rideHeight.id })
      }
    }
  }
  return configs
}

describe('computeCarDimensions（GLB実測値から寸法を作る）', () => {
  const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
  const vehicle = CAR_VEHICLES[DEFAULT_CAR_CONFIG.body]

  test('全長・車幅・ホイールベースが車種カタログの実測値から決まる', () => {
    expect(dimensions.bodyType).toBe(vehicle.id)
    expect(dimensions.length).toBe(vehicle.size.length)
    expect(dimensions.width).toBe(vehicle.size.width)
    expect(dimensions.wheelbase).toBeCloseTo(vehicle.wheels.front.z - vehicle.wheels.rear.z, 6)
    expect(dimensions.cabinWidth).toBe(vehicle.cabin.width)
    expect(dimensions.cabinLength).toBe(vehicle.cabin.length)
    expect(dimensions.cabinCenterZ).toBe(vehicle.cabin.centerZ)
  })

  test('採用7車種すべてが寸法を持ち、ホイールベースが全長に収まる', () => {
    expect(CAR_CATEGORIES.body.options).toHaveLength(7)
    for (const option of CAR_CATEGORIES.body.options) {
      const measured = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id))
      expect(measured.bodyType, option.id).toBe(option.id)
      expect(measured.length, option.id).toBeGreaterThan(0)
      expect(measured.width, option.id).toBeGreaterThan(0)
      expect(measured.height, option.id).toBeGreaterThan(0)
      expect(measured.wheelbase, option.id).toBeGreaterThan(0)
      expect(measured.wheelbase, option.id).toBeLessThan(measured.length)
    }
  })

  test('車種ごとの実寸差を残す（全車を同じ全長へ正規化しない）', () => {
    const lengths = CAR_VEHICLE_ORDER.map((id) => CAR_VEHICLES[id].size.length)
    // 幼児が車種を見分ける手がかりなので、全長は車種ごとに違っていること。
    expect(new Set(lengths).size).toBe(lengths.length)

    const byId = Object.fromEntries(
      CAR_VEHICLE_ORDER.map((id) => [id, computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', id))]),
    )
    // 大きい特殊車両 > 乗用車、という関係が保たれている。
    expect(byId.schoolBus?.length).toBeGreaterThan(byId.suv?.length ?? 0)
    expect(byId.ambulance?.length).toBeGreaterThan(byId.car?.length ?? 0)
    expect(byId.suv?.height).toBeGreaterThan(byId.sportsCar?.height ?? 0)
    expect(byId.car?.length).toBeLessThan(byId.suv?.length ?? 0)
  })

  test('最低地上高がボディ底面高さと一致し、そこから各段の高さが積み上がる', () => {
    expect(dimensions.bodyFloorY).toBe(dimensions.groundClearance)
    expect(dimensions.hullTopY).toBeCloseTo(dimensions.groundClearance + dimensions.hullHeight, 6)
    expect(dimensions.roofTopY).toBeCloseTo(dimensions.hullTopY + dimensions.cabinHeight, 6)
    expect(dimensions.height).toBe(dimensions.roofTopY)
  })

  test('bodyLift は素のGLBの車体下端との差になる', () => {
    expect(dimensions.bodyLift).toBeCloseTo(dimensions.groundClearance - vehicle.bodyFloor, 6)
  })

  test('キャビンは窓の実測から作られ、全長・全高の中に収まる', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      const measured = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', id))
      expect(measured.cabinLength, id).toBeGreaterThan(0)
      expect(measured.cabinLength, id).toBeLessThanOrEqual(measured.length)
      expect(measured.cabinWidth, id).toBeGreaterThan(0)
      expect(measured.cabinWidth, id).toBeLessThanOrEqual(measured.width)
      expect(measured.hullHeight, id).toBeGreaterThan(0)
      expect(measured.cabinHeight, id).toBeGreaterThan(0)
    }
  })
})

describe('組み合わせ耐性（7ボディ×タイヤ×車高の全パターン）', () => {
  test.each(dimensionCombinations())(
    'body=$body wheel=$wheel rideHeight=$rideHeight でタイヤが車体へめり込まない',
    (config) => {
      const dimensions = computeCarDimensions(config)
      const wheelTop = dimensions.wheelRadius * 2
      expect(dimensions.hullTopY).toBeGreaterThanOrEqual(wheelTop * 0.92 - 1e-9)
      expect(dimensions.groundClearance).toBeLessThanOrEqual(dimensions.wheelRadius * 1.05 + 1e-9)
      expect(dimensions.bodyFloorY).toBeGreaterThan(0)
    },
  )

  test.each(dimensionCombinations())(
    'body=$body wheel=$wheel rideHeight=$rideHeight で4輪が軸位置どおりに接地する',
    (config) => {
      const dimensions = computeCarDimensions(config)
      const attachments = computeCarAttachments(dimensions)
      expect(attachments.wheels).toHaveLength(4)
      for (const wheel of attachments.wheels) {
        const axle = wheel.end === 1 ? dimensions.axles.front : dimensions.axles.rear
        expect(wheel.position.y).toBeCloseTo(dimensions.wheelRadius, 6)
        expect(Math.abs(wheel.position.x)).toBeCloseTo(axle.halfTrack, 6)
        expect(wheel.position.z).toBeCloseTo(axle.z, 6)
        expect([wheel.position.x, wheel.position.y, wheel.position.z].every(Number.isFinite)).toBe(true)
      }
      const ids = attachments.wheels.map((wheel) => wheel.id)
      expect(new Set(ids).size).toBe(4)
    },
  )

  test('車種の実測比率に収まるタイヤは、ふつうの車高では車体を持ち上げない', () => {
    // Phase 3 の再調整後は、タイヤが車体へめり込む危険がないかぎり
    // 無駄に車体を持ち上げない（＝以前のように一律の絶対サイズで強制的に
    // 持ち上げていた挙動をやめた）。
    const small = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const big = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'big'))
    expect(big.bodyFloorY).toBeCloseTo(small.bodyFloorY, 6)
  })

  test('低い車高で大きいタイヤを選ぶと、車体へめり込まないよう持ち上がる', () => {
    const base = selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'low')
    const small = computeCarDimensions(base)
    const offroad = computeCarDimensions(selectCarOption(base, 'wheel', 'offroad'))
    expect(offroad.bodyFloorY).toBeGreaterThan(small.bodyFloorY)
    expect(offroad.bodyLift).toBeGreaterThan(small.bodyLift)
  })

  test('車高「たかい」は同じタイヤなら最低地上高が上がる', () => {
    const small = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const high = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'high'))
    expect(high.groundClearance).toBeGreaterThan(small.groundClearance)
    expect(high.roofTopY).toBeGreaterThan(small.roofTopY)
  })

  test('車高「ひくい」はボディを下げるが、最低クリアランスを下回らない', () => {
    const normal = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const low = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'low'))
    expect(low.groundClearance).toBeLessThanOrEqual(normal.groundClearance)
    expect(low.hullTopY).toBeGreaterThanOrEqual(low.wheelRadius * 2 * 0.92 - 1e-9)
    expect(low.groundClearance).toBeGreaterThanOrEqual(low.wheelRadius * 0.35 - 1e-9)
  })

  test('オフロードは最も太く、レーシングは小径側でもワイドな寸法を持つ', () => {
    const small = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const offroad = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'offroad'))
    const racing = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'racing'))

    expect(offroad.wheelRadius).toBeGreaterThan(small.wheelRadius)
    expect(offroad.wheelWidth).toBeGreaterThan(racing.wheelWidth)
    expect(racing.wheelWidth).toBeGreaterThan(small.wheelWidth)
    expect(racing.wheelRadius).toBeLessThan(offroad.wheelRadius)
    expect(CAR_WHEEL_RATIOS.small.radiusRatio).toBeLessThan(CAR_WHEEL_RATIOS.big.radiusRatio)
  })

  test('タイヤの大きさは車種ごとの元タイヤ実測値からの倍率で決まる（固定の絶対値を使わない）', () => {
    // 元タイヤ半径が最も違う2車種（SUVが最大、SchoolBusが最小）で確かめる。
    for (const type of ['small', 'big', 'offroad', 'racing'] as const) {
      const suv = resolveWheelSpec(CAR_VEHICLES.suv, type)
      const schoolBus = resolveWheelSpec(CAR_VEHICLES.schoolBus, type)
      expect(suv.radius, type).toBeGreaterThan(schoolBus.radius)
    }
  })

  test('オフロードタイヤでも元タイヤの1.3倍以内に収まり、ホイールアーチから大きくはみ出さない', () => {
    // Phase 1 #534 の調査で、固定サイズだと元タイヤの約2倍になる車種があると分かった。
    // 車種ごとの倍率にしたことで、どの車種でも極端な拡大にならないことを保証する。
    for (const id of CAR_VEHICLE_ORDER) {
      const vehicle = CAR_VEHICLES[id]
      const nativeRadius = (vehicle.wheels.front.radius + vehicle.wheels.rear.radius) / 2
      const offroad = resolveWheelSpec(vehicle, 'offroad')
      expect(offroad.radius, id).toBeLessThanOrEqual(nativeRadius * 1.3)
    }
  })

  test('全車種×4タイヤ種で寸法が有限かつ正の値になる', () => {
    for (const id of CAR_VEHICLE_ORDER) {
      for (const type of ['small', 'big', 'offroad', 'racing'] as const) {
        const spec = resolveWheelSpec(CAR_VEHICLES[id], type)
        expect(spec.radius, `${id}/${type}`).toBeGreaterThan(0)
        expect(spec.width, `${id}/${type}`).toBeGreaterThan(0)
        expect(Number.isFinite(spec.radius), `${id}/${type}`).toBe(true)
        expect(Number.isFinite(spec.width), `${id}/${type}`).toBe(true)
      }
    }
  })

  test('ボディを変えても4輪・前後端・ルーフのattachmentが寸法に追従する', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      const config = selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id)
      const dimensions = computeCarDimensions(config)
      const attachments = computeCarAttachments(dimensions)

      expect(attachments.front.position.z, option.id).toBeCloseTo(dimensions.frontFaceZ, 6)
      expect(attachments.rear.position.z, option.id).toBeCloseTo(-dimensions.length / 2, 6)
      expect(attachments.roof.position.y, option.id).toBeCloseTo(dimensions.roofTopY, 6)
      expect(attachments.roof.position.z, option.id).toBeCloseTo(dimensions.cabinCenterZ, 6)
      for (const wheel of attachments.wheels) {
        expect(wheel.position.z, option.id).toBeLessThan(dimensions.length / 2)
        expect(wheel.position.z, option.id).toBeGreaterThan(-dimensions.length / 2)
      }
    }
  })
})

describe('computeCarAttachments', () => {
  const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
  const attachments = computeCarAttachments(dimensions)

  test('フロント／リアが車体の前後端にあり、外向きの法線を持つ', () => {
    expect(attachments.front.position.z).toBeCloseTo(dimensions.frontFaceZ, 6)
    expect(attachments.front.normal).toEqual({ x: 0, y: 0, z: 1 })
    expect(attachments.rear.position.z).toBeCloseTo(-dimensions.length / 2, 6)
    expect(attachments.rear.normal).toEqual({ x: 0, y: 0, z: -1 })
  })

  test('フロントの取り付け基準は、ボディ全長の最先端より内側にある', () => {
    // ヘッドライトの高さでの前面は、バンパー角など全長の最先端そのものより
    // 内側に入り込んでいる車種が多い。ここが全長の半分と同じ（またはそれより前）
    // になっていると、ライト・グリル・ナンバーが前面から浮いて見える。
    for (const id of CAR_VEHICLE_ORDER) {
      const measured = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', id))
      expect(measured.frontFaceZ, id).toBeGreaterThan(0)
      expect(measured.frontFaceZ, id).toBeLessThanOrEqual(measured.length / 2)
    }
  })

  test('ルーフ基準がルーフ天面の高さにあり、キャビン中心へ乗る', () => {
    expect(attachments.roof.position.y).toBeCloseTo(dimensions.roofTopY, 6)
    expect(attachments.roof.position.z).toBeCloseTo(dimensions.cabinCenterZ, 6)
    expect(attachments.roof.normal).toEqual({ x: 0, y: 1, z: 0 })
    expect(attachments.roof.size.extent).toBeCloseTo(dimensions.cabinLength, 6)
    expect(attachments.roof.size.width).toBeCloseTo(dimensions.cabinWidth, 6)
  })

  test('左右の側面基準が車体側面にあり、左右対称になっている', () => {
    expect(attachments.sideLeft.position.x).toBeCloseTo(dimensions.width / 2, 6)
    expect(attachments.sideRight.position.x).toBeCloseTo(-dimensions.width / 2, 6)
    expect(attachments.sideLeft.size.width).toBeCloseTo(dimensions.length, 6)
  })

  test('前後面の取り付け基準はボディ下段の中に収まる', () => {
    expect(attachments.front.position.y).toBeGreaterThan(dimensions.bodyFloorY)
    expect(attachments.front.position.y).toBeLessThan(dimensions.hullTopY)
  })

  test('前後でトレッドが違う車種でも、左右対称に配置される', () => {
    const ambulance = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'ambulance'))
    expect(ambulance.axles.front.halfTrack).not.toBe(ambulance.axles.rear.halfTrack)
    const wheels = computeCarAttachments(ambulance).wheels
    const front = wheels.filter((wheel) => wheel.end === 1)
    expect(front[0]?.position.x).toBeCloseTo(-(front[1]?.position.x ?? 0), 6)
  })
})

describe('carBoundingRadius', () => {
  test('車体より大きく、大きい車ほど大きくなる', () => {
    const compact = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const bus = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'schoolBus'))
    expect(carBoundingRadius(compact)).toBeGreaterThan(compact.length / 2)
    expect(carBoundingRadius(bus)).toBeGreaterThan(carBoundingRadius(compact))
  })
})
