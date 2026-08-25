import { describe, expect, test } from 'vitest'
import { CELL_SIZE } from './boardLayout'
import {
  PART_DEFINITIONS,
  TRAY_PART_DEFINITIONS,
  nextRotationType,
  isRotatablePart,
  partDefinition,
  type PartDefinition,
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
  test('置き場には基本板とPhase 3の4系統を出し、回転後の向きは出さない', () => {
    expect(TRAY_PART_DEFINITIONS.map((definition) => definition.id)).toEqual([
      'plank', 'slopeLeft', 'slopeRight', 'curveLeft', 'curveRight',
      'bumper', 'guideLeft', 'guideRight', 'longPlank',
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

  test('横板は水平、斜め板は左右で逆向きに傾いている', () => {
    expect(partDefinition('plank').segments[0].angleDeg).toBe(0)
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
    expect(bumper.restitution).toBeGreaterThan(partDefinition('plank').restitution)
    expect(bumper.restitution).toBeGreaterThanOrEqual(0.95)
    expect(nextRotationType('bumper')).toBeNull()
    expect(isRotatablePart('bumper')).toBe(false)
  })

  test('長い板は2マスを占有し、回転すると縦の2マスへ切り替わる', () => {
    expect(partDefinition('longPlank').cells).toEqual([{ col: 0, row: 0 }, { col: 1, row: 0 }])
    expect(partDefinition('longPlankVertical').cells).toEqual([{ col: 0, row: 0 }, { col: 0, row: 1 }])
    expect(nextRotationType('longPlank')).toBe('longPlankVertical')
    expect(partDefinition('longPlank').previewScale).toBeLessThan(1)
    expect(partDefinition('longPlank').segments[0].width).toBe(114)
  })

  test('未知のパーツ種類は例外にする（データ不整合に早く気付くため）', () => {
    // 型では弾かれる値を、あえて実行時に渡す
    expect(() => partDefinition('unknown' as never)).toThrow(/不明なパーツ種類/)
  })
})
