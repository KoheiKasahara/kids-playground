import { describe, expect, test } from 'vitest'
import { CAR_CATEGORIES, DEFAULT_CAR_CONFIG, selectCarOption, type CarConfig } from './carConfig'
import {
  CAR_BODY_SPECS,
  CAR_WHEEL_SPECS,
  carBoundingRadius,
  computeCarAttachments,
  computeCarDimensions,
} from './carDimensions'

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

describe('computeCarDimensions（5ボディ）', () => {
  const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
  const body = CAR_BODY_SPECS.sports
  const wheel = CAR_WHEEL_SPECS.normal

  test('全長・車幅・ホイールベースがボディ定義から決まる', () => {
    expect(dimensions.bodyType).toBe('sports')
    expect(dimensions.bodyStyle).toBe('sports')
    expect(dimensions.length).toBe(body.length)
    expect(dimensions.width).toBe(body.width)
    expect(dimensions.wheelbase).toBeCloseTo(body.length * body.wheelbaseRatio, 6)
    expect(dimensions.cabinWidth).toBeCloseTo(body.width * body.cabinWidthRatio, 6)
    expect(dimensions.hoodLength).toBeCloseTo(body.length * body.hoodLengthRatio, 6)
  })

  test('5種類すべてが寸法定義を持ち、長さ・高さ・幅で車種差がある', () => {
    const dimensionsByBody = Object.fromEntries(
      CAR_CATEGORIES.body.options.map((option) => [
        option.id,
        computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id)),
      ]),
    )

    for (const option of CAR_CATEGORIES.body.options) {
      const dimensions = dimensionsByBody[option.id]
      expect(dimensions, option.id).toBeDefined()
      expect(dimensions?.bodyType, option.id).toBe(option.id)
      expect(dimensions?.bodyStyle, option.id).toBe(option.id)
      expect(dimensions?.length, option.id).toBeGreaterThan(0)
      expect(dimensions?.width, option.id).toBeGreaterThan(0)
      expect(dimensions?.height, option.id).toBeGreaterThan(0)
      expect(dimensions?.wheelbase, option.id).toBeGreaterThan(0)
      expect(dimensions?.wheelbase, option.id).toBeLessThan(dimensions?.length ?? 0)
    }

    expect(dimensionsByBody.bus?.length).toBeGreaterThan(dimensionsByBody.sports?.length ?? 0)
    expect(dimensionsByBody.truck?.length).toBeGreaterThan(dimensionsByBody.suv?.length ?? 0)
    expect(dimensionsByBody.suv?.height).toBeGreaterThan(dimensionsByBody.sports?.height ?? 0)
  })

  test('最低地上高がボディ底面高さと一致し、そこから各段の高さが積み上がる', () => {
    expect(dimensions.bodyFloorY).toBe(dimensions.groundClearance)
    expect(dimensions.hullTopY).toBeCloseTo(dimensions.groundClearance + body.hullHeight, 6)
    expect(dimensions.roofTopY).toBeCloseTo(dimensions.hullTopY + body.cabinHeight, 6)
    expect(dimensions.height).toBe(dimensions.roofTopY)
  })

  test('スポーツカーの寸法は低くワイドで、キャビンが小さく設計されている', () => {
    expect(dimensions.width / dimensions.length).toBeGreaterThan(0.4)
    expect(dimensions.height / dimensions.length).toBeLessThan(0.3)
    expect(dimensions.cabinLength).toBeLessThan(dimensions.length * 0.45)
    expect(dimensions.cabinHeight).toBeLessThan(dimensions.hullHeight)
  })

  test('スポーツカーは低さを保ちながら、タイヤの下端とキャビンの厚みを確保する', () => {
    expect(dimensions.bodyFloorY).toBeGreaterThanOrEqual(0.15)
    expect(dimensions.cabinHeight).toBeGreaterThanOrEqual(0.4)
    expect(dimensions.hullTopY).toBeLessThanOrEqual(dimensions.wheelRadius * 2)
    expect(dimensions.roofTopY - dimensions.hullTopY).toBeGreaterThanOrEqual(0.4)
  })

  test('トレッドは車幅とタイヤ厚から決まり、タイヤは車体の外側に出る', () => {
    expect(dimensions.track).toBeCloseTo(body.width + wheel.width - 0.16, 6)
    expect(dimensions.track / 2).toBeGreaterThan(body.width / 2)
    expect(dimensions.overallWidth).toBeGreaterThan(dimensions.width)
  })
})

describe('組み合わせ耐性（5ボディ×タイヤ×車高の全パターン）', () => {
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
    'body=$body wheel=$wheel rideHeight=$rideHeight で4輪が対称に接地する',
    (config) => {
      const dimensions = computeCarDimensions(config)
      const attachments = computeCarAttachments(dimensions)
      expect(attachments.wheels).toHaveLength(4)
      for (const wheel of attachments.wheels) {
        expect(wheel.position.y).toBeCloseTo(dimensions.wheelRadius, 6)
        expect(Math.abs(wheel.position.x)).toBeCloseTo(dimensions.track / 2, 6)
        expect(Math.abs(wheel.position.z)).toBeCloseTo(dimensions.wheelbase / 2, 6)
        expect([wheel.position.x, wheel.position.y, wheel.position.z].every(Number.isFinite)).toBe(true)
      }
      const ids = attachments.wheels.map((wheel) => wheel.id)
      expect(new Set(ids).size).toBe(4)
    },
  )

  test('タイヤを大きくすると車体が持ち上がる（低い車高でも同じ）', () => {
    const normal = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const big = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'wheel', 'big'))
    expect(big.bodyFloorY).toBeGreaterThan(normal.bodyFloorY)
  })

  test('車高「たかい」は同じタイヤなら最低地上高が上がる', () => {
    const normal = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const high = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'rideHeight', 'high'))
    expect(high.groundClearance).toBeGreaterThan(normal.groundClearance)
    expect(high.roofTopY).toBeGreaterThan(normal.roofTopY)
  })

  test('ボディを変えても4輪・前後端・ルーフのattachmentが寸法に追従する', () => {
    for (const option of CAR_CATEGORIES.body.options) {
      const config = selectCarOption(DEFAULT_CAR_CONFIG, 'body', option.id)
      const dimensions = computeCarDimensions(config)
      const attachments = computeCarAttachments(dimensions)

      expect(attachments.front.position.z).toBeCloseTo(dimensions.length / 2, 6)
      expect(attachments.rear.position.z).toBeCloseTo(-dimensions.length / 2, 6)
      expect(attachments.roof.position.y).toBeCloseTo(dimensions.roofTopY, 6)
      expect(attachments.roof.position.z).toBeCloseTo(dimensions.cabinCenterZ, 6)
      expect(attachments.wheels[0]?.position.z).toBeLessThan(dimensions.length / 2)
      expect(attachments.wheels[0]?.position.z).toBeGreaterThan(-dimensions.length / 2)
      expect(attachments.wheels.every((wheel) =>
        [wheel.position.x, wheel.position.y, wheel.position.z].every(Number.isFinite),
      )).toBe(true)
    }
  })
})

describe('computeCarAttachments', () => {
  const dimensions = computeCarDimensions(DEFAULT_CAR_CONFIG)
  const attachments = computeCarAttachments(dimensions)

  test('フロント／リアが車体の前後端にあり、外向きの法線を持つ', () => {
    expect(attachments.front.position.z).toBeCloseTo(dimensions.length / 2, 6)
    expect(attachments.front.normal).toEqual({ x: 0, y: 0, z: 1 })
    expect(attachments.rear.position.z).toBeCloseTo(-dimensions.length / 2, 6)
    expect(attachments.rear.normal).toEqual({ x: 0, y: 0, z: -1 })
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
})

describe('carBoundingRadius', () => {
  test('車体より大きく、大きい車ほど大きくなる', () => {
    const normal = computeCarDimensions(DEFAULT_CAR_CONFIG)
    const bus = computeCarDimensions(selectCarOption(DEFAULT_CAR_CONFIG, 'body', 'bus'))
    expect(carBoundingRadius(normal)).toBeGreaterThan(normal.length / 2)
    expect(carBoundingRadius(bus)).toBeGreaterThan(carBoundingRadius(normal))
  })
})
