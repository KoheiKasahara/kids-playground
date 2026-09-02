import { describe, expect, test } from 'vitest'
import { DEFAULT_PICTURE_ID, MIN_TAP_SIZE_UNITS, PAINT_PICTURES, findPaintPicture, type PaintArea } from './paintPictures'
import { shapeBounds } from './shapeBounds'

const VIEW_BOX_MIN = -1
const VIEW_BOX_MAX = 101

describe('paintPictures', () => {
  test('題材が3件、idが一意、DEFAULT_PICTURE_IDが実在する', () => {
    expect(PAINT_PICTURES).toHaveLength(3)
    const ids = PAINT_PICTURES.map((picture) => picture.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(findPaintPicture(DEFAULT_PICTURE_ID)).toBeDefined()
  })

  test('viewBoxはすべて "0 0 100 100"', () => {
    for (const picture of PAINT_PICTURES) {
      expect(picture.viewBox).toBe('0 0 100 100')
    }
  })

  test('各題材のareasのidが題材内で一意、labelが非空', () => {
    for (const picture of PAINT_PICTURES) {
      const areaIds = picture.areas.map((area) => area.id)
      expect(new Set(areaIds).size, `${picture.id}: areas idが重複`).toBe(areaIds.length)
      for (const area of picture.areas) {
        expect(area.label.length, `${picture.id}.${area.id}: labelが空`).toBeGreaterThan(0)
      }
    }
  })

  test('各題材のareasが2件以上ある', () => {
    for (const picture of PAINT_PICTURES) {
      expect(picture.areas.length, `${picture.id}: areasの件数`).toBeGreaterThanOrEqual(2)
    }
  })

  test('全題材の全areasについて、shapeBoundsのwidth/heightがともにMIN_TAP_SIZE_UNITS以上', () => {
    for (const picture of PAINT_PICTURES) {
      for (const area of picture.areas) {
        const bounds = shapeBounds(area.shape)
        expect(bounds.width, `${picture.id}.${area.id}: width`).toBeGreaterThanOrEqual(MIN_TAP_SIZE_UNITS)
        expect(bounds.height, `${picture.id}.${area.id}: height`).toBeGreaterThanOrEqual(MIN_TAP_SIZE_UNITS)
      }
    }
  })

  test('全shapeの座標がviewBox(0〜100)に概ね収まる', () => {
    for (const picture of PAINT_PICTURES) {
      for (const area of picture.areas) {
        const bounds = shapeBounds(area.shape)
        expect(bounds.minX, `${picture.id}.${area.id}: minX`).toBeGreaterThanOrEqual(VIEW_BOX_MIN)
        expect(bounds.minY, `${picture.id}.${area.id}: minY`).toBeGreaterThanOrEqual(VIEW_BOX_MIN)
        expect(bounds.maxX, `${picture.id}.${area.id}: maxX`).toBeLessThanOrEqual(VIEW_BOX_MAX)
        expect(bounds.maxY, `${picture.id}.${area.id}: maxY`).toBeLessThanOrEqual(VIEW_BOX_MAX)
      }
      picture.details.forEach((detail, index) => {
        const bounds = shapeBounds(detail.shape)
        expect(bounds.minX, `${picture.id}.details[${index}]: minX`).toBeGreaterThanOrEqual(VIEW_BOX_MIN)
        expect(bounds.minY, `${picture.id}.details[${index}]: minY`).toBeGreaterThanOrEqual(VIEW_BOX_MIN)
        expect(bounds.maxX, `${picture.id}.details[${index}]: maxX`).toBeLessThanOrEqual(VIEW_BOX_MAX)
        expect(bounds.maxY, `${picture.id}.details[${index}]: maxY`).toBeLessThanOrEqual(VIEW_BOX_MAX)
      })
    }
  })

  test('pathのdは絶対座標のM/L/C/Q/Zのみで構成される（不正なコマンドはshapeBoundsがthrowする）', () => {
    for (const picture of PAINT_PICTURES) {
      for (const area of picture.areas) {
        if (area.shape.kind !== 'path') continue
        expect(() => shapeBounds(area.shape)).not.toThrow()
        const letters = area.shape.d.match(/[a-zA-Z]/g) ?? []
        for (const letter of letters) {
          expect(['M', 'L', 'C', 'Q', 'Z'], `${picture.id}.${area.id}: "${letter}"`).toContain(letter)
        }
      }
      for (const detail of picture.details) {
        if (detail.shape.kind !== 'path') continue
        expect(() => shapeBounds(detail.shape)).not.toThrow()
      }
    }
  })

  test('PaintAreaはshape/id/labelのみを持ち、details相当のプロパティ(fill/stroke)を持たない', () => {
    const sampleArea: PaintArea = PAINT_PICTURES[0].areas[0]
    expect(Object.keys(sampleArea).sort()).toEqual(['id', 'label', 'shape'])
  })

  test('detailsはareasと独立した配列で、塗り対象(areas)には含まれない', () => {
    for (const picture of PAINT_PICTURES) {
      const areaShapes = new Set(picture.areas.map((area) => JSON.stringify(area.shape)))
      for (const detail of picture.details) {
        expect(areaShapes.has(JSON.stringify(detail.shape)), `${picture.id}: detailがareasと同一shapeを持つ`).toBe(false)
      }
    }
  })
})
