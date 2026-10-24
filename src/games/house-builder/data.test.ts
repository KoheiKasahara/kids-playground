import { describe, expect, test } from 'vitest'
import { DOGHOUSES, DOORS, EXTERIOR_STYLES, EXTRAS, GARDENS, HOUSE_TYPES, PARKINGS, POOLS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, WALLS, WINDOWS } from './data'

const unique = (ids: readonly string[]) => new Set(ids).size === ids.length

describe('house-builder data', () => {
  test('いえの しゅるいは ひらやから 4かいだてまで', () => {
    expect(HOUSE_TYPES.map((t) => t.floors)).toEqual([1, 2, 3, 4])
    expect(unique(HOUSE_TYPES.map((t) => t.id))).toBe(true)
  })

  test('かたちは ながしかくの マスで、どの かたちにも ゆかが ある', () => {
    expect(unique(SHAPES.map((s) => s.id))).toBe(true)
    for (const shape of SHAPES) {
      expect(shape.mask).toHaveLength(shape.height)
      for (const row of shape.mask) expect(row, shape.id).toHaveLength(shape.width)
      // いちばん おもての ぎょうには ゆかが ある（げんかんを つけられる）。
      expect(shape.mask[shape.height - 1].some(Boolean), shape.id).toBe(true)
    }
  })

  test('へやは しゅるいごとに 3つ いじょうの みためから えらべる', () => {
    expect(unique(ROOM_TYPES.map((t) => t.id))).toBe(true)
    for (const type of ROOM_TYPES) {
      expect(type.styles.length, type.id).toBeGreaterThanOrEqual(3)
      expect(unique(type.styles.map((s) => s.id)), type.id).toBe(true)
      expect(unique(type.styles.map((s) => s.name)), type.id).toBe(true)
      for (const style of type.styles) {
        for (const color of [style.base, style.line, style.main, style.accent]) expect(color, style.name).toMatch(/^#[0-9a-f]{6}$/i)
      }
    }
    // みための なまえは ゲーム ぜんたいで かぶらない（タップした へやの なまえで みわけられる）。
    expect(unique(ROOM_TYPES.flatMap((t) => t.styles.map((s) => s.name)))).toBe(true)
  })

  test('まどりの きほんの へやが そろっている', () => {
    const ids = ROOM_TYPES.map((t) => t.id)
    for (const id of ['living', 'kitchen', 'dining', 'bath', 'toilet', 'washitsu', 'stairs', 'entrance'] as const) expect(ids).toContain(id)
  })

  test('どの へやも いちばん せまい かたちに おさまり、おおきさは だんだん おおきく なる', () => {
    const narrow = Math.min(...SHAPES.map((s) => s.width))
    const short = Math.min(...SHAPES.map((s) => s.height))
    for (const type of ROOM_TYPES) {
      const areas = ROOM_SIZES.map(({ id }) => type.sizes[id][0] * type.sizes[id][1])
      expect(areas[0], type.id).toBeLessThan(areas[1])
      expect(areas[1], type.id).toBeLessThan(areas[2])
      for (const { id } of ROOM_SIZES) {
        const [w, h] = type.sizes[id]
        expect(Math.min(w, h), `${type.id} ${id}`).toBeLessThanOrEqual(Math.min(narrow, short))
        expect(Math.max(w, h), `${type.id} ${id}`).toBeLessThanOrEqual(Math.max(narrow, short))
      }
    }
  })

  test('そとがわの えらべる ものは なまえも id も かぶらない', () => {
    for (const options of [WALLS, ROOFS, WINDOWS, DOORS, PARKINGS, DOGHOUSES, GARDENS, POOLS, EXTRAS] as const) {
      expect(unique(options.map((o) => o.id))).toBe(true)
      expect(unique(options.map((o) => o.name))).toBe(true)
      expect(options.length).toBeGreaterThanOrEqual(3)
    }
    // ちゅうしゃじょう・いぬごや・にわ・プールは「なし」も えらべる。
    for (const options of [PARKINGS, DOGHOUSES, GARDENS, POOLS]) expect(options[0].id).toBe('none')
  })

  test('おうちセットは それぞれ ちがう くみあわせで、えらべる そとがわを つかう', () => {
    expect(unique(EXTERIOR_STYLES.map((style) => style.id))).toBe(true)
    expect(unique(EXTERIOR_STYLES.map((style) => style.name))).toBe(true)
    expect(unique(EXTERIOR_STYLES.map((style) => JSON.stringify(style.facade)))).toBe(true)
    for (const style of EXTERIOR_STYLES) {
      expect(Object.keys(style.facade).sort(), style.id).toEqual(['door', 'roof', 'wall', 'window'])
      for (const [key, options] of Object.entries({ wall: WALLS, roof: ROOFS, window: WINDOWS, door: DOORS })) {
        expect(options.map((option) => option.id), `${style.id}/${key}`).toContain(style.facade[key as keyof typeof style.facade])
      }
    }
  })
})
