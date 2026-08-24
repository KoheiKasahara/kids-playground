import { describe, expect, test } from 'vitest'
import { CELL_SIZE } from './boardLayout'
import { PART_DEFINITIONS, partDefinition, type PartDefinition } from './partTypes'

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
  test('Phase 1のパーツは 横板・斜め板2種 の3つ', () => {
    expect(PART_DEFINITIONS.map((definition) => definition.id)).toEqual(['plank', 'slopeLeft', 'slopeRight'])
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

  test('未知のパーツ種類は例外にする（データ不整合に早く気付くため）', () => {
    // 型では弾かれる値を、あえて実行時に渡す
    expect(() => partDefinition('unknown' as never)).toThrow(/不明なパーツ種類/)
  })
})
