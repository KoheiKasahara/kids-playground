import { describe, expect, test } from 'vitest'
import { CELL_SIZE } from './boardLayout'
import {
  PART_DEFINITIONS,
  SPINNER_TYPE_IDS,
  TRAY_PART_DEFINITIONS,
  FAN_ANGLES,
  isSpinnerPart,
  nextRotationType,
  isRotatablePart,
  partDefinition,
  partFootprint,
  type PartDefinition,
  type PartTypeId,
} from './partTypes'

/** 回転させた長方形の外接矩形の半分の大きさ（中心からの張り出し量） */
function rotatedHalfExtents(width: number, height: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return {
    x: (width / 2) * cos + (height / 2) * sin,
    y: (width / 2) * sin + (height / 2) * cos,
  }
}

/** パーツが占有するマスの範囲（アンカーセル中心を原点とした px の矩形） */
function occupiedBounds(definition: PartDefinition) {
  const cols = definition.cells.map((cell) => cell.col)
  const rows = definition.cells.map((cell) => cell.row)
  return {
    left: (Math.min(...cols) - 0.5) * CELL_SIZE,
    right: (Math.max(...cols) + 0.5) * CELL_SIZE,
    top: (Math.min(...rows) - 0.5) * CELL_SIZE,
    bottom: (Math.max(...rows) + 0.5) * CELL_SIZE,
  }
}

describe('partTypes', () => {
  test('置き場には残ったパーツ、ジャンプ台、キャノン・Spinner・シーソーの基本向きを出す', () => {
    expect(TRAY_PART_DEFINITIONS.map((definition) => definition.id)).toEqual([
      'slopeLeft', 'slopeRight', 'curveLeft', 'curveRight',
      'bumper', 'guideLeft', 'guideRight', 'jumpRampRight', 'cannon', 'spinner', 'spinnerLarge',
      'fanRight', 'bubbleLift', 'warpIn', 'warpOut', 'conveyorRight', 'seesaw',
    ])
  })

  test('種類IDが重複しない', () => {
    const ids = PART_DEFINITIONS.map((definition) => definition.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('どのパーツも、占有マスと形（セグメント）を必ず持つ', () => {
    for (const definition of PART_DEFINITIONS) {
      expect(definition.cells.length).toBeGreaterThan(0)
      expect(definition.segments.length).toBeGreaterThan(0)
      expect(definition.label.length).toBeGreaterThan(0)
    }
  })

  test('パーツの形は、占有するマスの内側に収まる（隣のマスへはみ出さない）', () => {
    for (const definition of PART_DEFINITIONS) {
      const bounds = occupiedBounds(definition)
      for (const segment of definition.segments) {
        const half = rotatedHalfExtents(segment.width, segment.height, segment.angleDeg)
        expect(segment.offsetX - half.x).toBeGreaterThanOrEqual(bounds.left)
        expect(segment.offsetX + half.x).toBeLessThanOrEqual(bounds.right)
        expect(segment.offsetY - half.y).toBeGreaterThanOrEqual(bounds.top)
        expect(segment.offsetY + half.y).toBeLessThanOrEqual(bounds.bottom)
      }
    }
  })

  test('斜め板は左右で逆向きに傾いている', () => {
    const left = partDefinition('slopeLeft').segments[0].angleDeg
    const right = partDefinition('slopeRight').segments[0].angleDeg
    expect(left).toBeLessThan(0)
    expect(right).toBeGreaterThan(0)
    expect(left).toBe(-right)
  })

  test('カーブは複数の短い板で近似し、左右とも4方向へ回せる', () => {
    expect(partDefinition('curveLeft').segments).toHaveLength(3)
    expect(partDefinition('curveRight').segments).toHaveLength(3)
    expect(nextRotationType('curveLeft')).toBe('curveLeft90')
    expect(nextRotationType('curveLeft90')).toBe('curveLeft180')
    expect(nextRotationType('curveLeft180')).toBe('curveLeft270')
    expect(nextRotationType('curveLeft270')).toBe('curveLeft')
  })

  test('バンパーは円形で通常板より明確に高い反発係数を持ち、回転しない', () => {
    const bumper = partDefinition('bumper')
    expect(bumper.segments[0].kind).toBe('circle')
    expect(bumper.restitution).toBeGreaterThan(partDefinition('slopeLeft').restitution)
    expect(bumper.restitution).toBeGreaterThanOrEqual(0.95)
    expect(nextRotationType('bumper')).toBeNull()
    expect(isRotatablePart('bumper')).toBe(false)
  })

  test('キャノンは8方向を循環する', () => {
    const cannonDirections = [
      'cannon', 'cannonDownRight', 'cannonDown', 'cannonDownLeft',
      'cannonLeft', 'cannonUpLeft', 'cannonUp', 'cannonUpRight',
    ] as const
    let current: PartTypeId = cannonDirections[0]
    for (const expected of cannonDirections.slice(1)) {
      current = nextRotationType(current)!
      expect(current).toBe(expected)
    }
    expect(nextRotationType(current)).toBe('cannon')
  })

  test('回転盤は「まわす」で逆回しへ切り替わり、置き場には順回しだけを出す', () => {
    expect(SPINNER_TYPE_IDS.every((id) => isSpinnerPart(id))).toBe(true)
    expect(isSpinnerPart('bumper')).toBe(false)

    for (const [forward, reverse] of [['spinner', 'spinnerReverse'], ['spinnerLarge', 'spinnerLargeReverse']] as const) {
      expect(isRotatablePart(forward)).toBe(true)
      expect(nextRotationType(forward)).toBe(reverse)
      expect(nextRotationType(reverse)).toBe(forward)
      // 逆回しは見た目が同じで、回る向きだけが違う。占有マスも形も揃える。
      expect(partDefinition(reverse).segments).toEqual(partDefinition(forward).segments)
      expect(partDefinition(reverse).cells).toEqual(partDefinition(forward).cells)
      expect(partDefinition(forward).inTray).toBe(true)
      expect(partDefinition(reverse).inTray).toBe(false)
    }
  })

  test('2×2の回転盤は4マスを占有し、羽根をその中心へ置く', () => {
    const small = partDefinition('spinner')
    const large = partDefinition('spinnerLarge')
    expect(small.cells).toHaveLength(1)
    expect(large.cells).toHaveLength(4)

    const footprint = partFootprint(large.cells)
    expect(footprint).toMatchObject({ cols: 2, rows: 2, center: { x: CELL_SIZE / 2, y: CELL_SIZE / 2 } })
    for (const segment of large.segments) {
      expect(segment.offsetX).toBe(footprint.center.x)
      expect(segment.offsetY).toBe(footprint.center.y)
    }

    const bladeLength = (definition: PartDefinition) =>
      Math.max(...definition.segments.filter((segment) => segment.role === 'blade').map((segment) => segment.width))
    expect(bladeLength(large)).toBeGreaterThan(bladeLength(small))
  })

  test('ジャンプ台は左右の向きを回転で切り替え、右向きは右上がりの斜面になる', () => {
    const right = partDefinition('jumpRampRight')
    const left = partDefinition('jumpRampLeft')
    expect(right.inTray).toBe(true)
    expect(left.inTray).toBe(false)
    expect(right.segments[0].angleDeg).toBeLessThan(0)
    expect(left.segments[0].angleDeg).toBeGreaterThan(0)
    expect(nextRotationType('jumpRampRight')).toBe('jumpRampLeft')
    expect(nextRotationType('jumpRampLeft')).toBe('jumpRampRight')
  })

  test('せんぷうきは台座を下に保つ左右2方向だけを切り替える', () => {
    expect(FAN_ANGLES).toEqual({ fanRight: 0, fanLeft: 180 })
    expect(nextRotationType('fanRight')).toBe('fanLeft')
    expect(nextRotationType('fanLeft')).toBe('fanRight')
  })

  test('ベルトコンベアは4方向へ回転し、基本向きだけ置き場に出る', () => {
    expect(partDefinition('conveyorRight').appearance).toBe('conveyor')
    expect(partDefinition('conveyorRight').inTray).toBe(true)
    expect(partDefinition('conveyorDown').inTray).toBe(false)
    expect(nextRotationType('conveyorRight')).toBe('conveyorDown')
    expect(nextRotationType('conveyorDown')).toBe('conveyorLeft')
    expect(nextRotationType('conveyorLeft')).toBe('conveyorUp')
    expect(nextRotationType('conveyorUp')).toBe('conveyorRight')
    expect(partDefinition('conveyorDown').segments[0].angleDeg).toBe(90)
    expect(partDefinition('conveyorLeft').segments[0].angleDeg).toBe(180)
    expect(partDefinition('conveyorUp').segments[0].angleDeg).toBe(270)
  })

  test('シーソーは横長のデッキと中央支点を持ち、回転対象外になる', () => {
    const seesaw = partDefinition('seesaw')
    expect(seesaw.appearance).toBe('seesaw')
    expect(seesaw.inTray).toBe(true)
    expect(seesaw.segments.some((segment) => segment.role === 'deck')).toBe(true)
    expect(seesaw.segments.some((segment) => segment.role === 'pivot' && segment.kind === 'circle')).toBe(true)
    expect(nextRotationType('seesaw')).toBeNull()
    expect(isRotatablePart('seesaw')).toBe(false)
  })

  test('未知のパーツ種類は例外にする（データ不整合に早く気付くため）', () => {
    // 型では弾かれる値を、あえて実行時に渡す
    expect(() => partDefinition('unknown' as never)).toThrow(/不明なパーツ種類/)
  })
})
