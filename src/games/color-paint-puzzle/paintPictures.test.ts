import { describe, expect, test } from 'vitest'
import { DEFAULT_PICTURE_ID, MIN_TAP_SIZE_UNITS, PAINT_PICTURES, findPaintPicture } from './paintPictures'
import { shapeBounds } from './shapeBounds'

const VIEW_BOX_MIN = -1
const VIEW_BOX_MAX = 101

describe('paintPictures', () => {
  test('題材が6件、idが一意、DEFAULT_PICTURE_IDが実在する', () => {
    expect(PAINT_PICTURES).toHaveLength(6)
    const ids = PAINT_PICTURES.map((picture) => picture.id)
    expect(ids).toEqual(['car', 'fish', 'butterfly', 'robot', 'rocket', 'dinosaur'])
    expect(new Set(ids).size).toBe(ids.length)
    expect(findPaintPicture(DEFAULT_PICTURE_ID)).toBeDefined()
  })

  test('題材えらびの表示（label・emoji）がすべて埋まっていて重複しない', () => {
    const labels = PAINT_PICTURES.map((picture) => picture.label)
    const emojis = PAINT_PICTURES.map((picture) => picture.emoji)
    for (const picture of PAINT_PICTURES) {
      expect(picture.label.length, `${picture.id}: label`).toBeGreaterThan(0)
      expect(picture.emoji.length, `${picture.id}: emoji`).toBeGreaterThan(0)
    }
    expect(new Set(labels).size).toBe(labels.length)
    expect(new Set(emojis).size).toBe(emojis.length)
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

  test('各題材のareasが2件以上、かつ幼児が塗り切れる件数（10件以下）に収まる', () => {
    for (const picture of PAINT_PICTURES) {
      expect(picture.areas.length, `${picture.id}: areasの件数`).toBeGreaterThanOrEqual(2)
      expect(picture.areas.length, `${picture.id}: areasの件数`).toBeLessThanOrEqual(10)
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

  test('PaintAreaはid/label/shape/motionのみを持ち、details相当のプロパティ(fill/stroke)を持たない', () => {
    const allowedKeys = ['id', 'label', 'motion', 'shape']
    for (const picture of PAINT_PICTURES) {
      for (const area of picture.areas) {
        for (const key of Object.keys(area)) {
          expect(allowedKeys, `${picture.id}.${area.id}: "${key}"`).toContain(key)
        }
      }
    }
  })

  // --- Phase 2: 完成演出のグループ指定 ---

  test('各題材に、完成演出で動かす本体グループ(motion.group)がちょうど1つある', () => {
    for (const picture of PAINT_PICTURES) {
      const groups = new Set(
        [...picture.areas, ...picture.details]
          .map((item) => item.motion?.group)
          .filter((group): group is string => Boolean(group)),
      )
      expect(groups.size, `${picture.id}: motion.groupの種類`).toBe(1)
    }
  })

  test('題材をまたいでgroup名・part名が重複しない（CSSのdata属性セレクタが混ざらないため）', () => {
    const seenGroups = new Map<string, string>()
    const seenParts = new Map<string, string>()
    for (const picture of PAINT_PICTURES) {
      for (const item of [...picture.areas, ...picture.details]) {
        const { group, part } = item.motion ?? {}
        if (group) {
          expect(seenGroups.get(group) ?? picture.id).toBe(picture.id)
          seenGroups.set(group, picture.id)
        }
        if (part) {
          expect(seenParts.get(part) ?? picture.id).toBe(picture.id)
          seenParts.set(part, picture.id)
        }
      }
    }
  })

  test('背景（そら・みず・じめん）は本体グループに入っていない（絵だけが動く）', () => {
    const backgroundAreaIds = new Set(['sky', 'water', 'ground'])
    for (const picture of PAINT_PICTURES) {
      const backgrounds = picture.areas.filter((area) => backgroundAreaIds.has(area.id))
      expect(backgrounds.length, `${picture.id}: 背景エリア`).toBeGreaterThan(0)
      for (const area of backgrounds) {
        expect(area.motion?.group, `${picture.id}.${area.id}`).toBeUndefined()
      }
    }
  })

  test('追加した3題材にも、それぞれ動くパーツ(motion.part)がある', () => {
    for (const id of ['robot', 'rocket', 'dinosaur']) {
      const picture = findPaintPicture(id)!
      const parts = new Set(
        [...picture.areas, ...picture.details]
          .map((item) => item.motion?.part)
          .filter((part): part is string => Boolean(part)),
      )
      expect(parts.size, `${id}: motion.partの種類`).toBeGreaterThan(0)
    }
  })

  test('くるまの左右のタイヤは別のpartになっている（同じpartだと車体の真ん中を軸に回ってしまう）', () => {
    const car = findPaintPicture('car')!
    const back = car.areas.find((area) => area.id === 'wheelBack')!
    const front = car.areas.find((area) => area.id === 'wheelFront')!
    expect(back.motion?.part).toBeDefined()
    expect(front.motion?.part).toBeDefined()
    expect(back.motion?.part).not.toBe(front.motion?.part)
  })

  test('くるまの各タイヤに、回転が見えるスポークの装飾がある', () => {
    const car = findPaintPicture('car')!
    for (const part of ['wheelBack', 'wheelFront']) {
      const spokes = car.details.filter(
        (detail) => detail.motion?.part === part && detail.shape.kind === 'path',
      )
      expect(spokes.length, `${part}: スポーク`).toBeGreaterThan(0)
    }
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
