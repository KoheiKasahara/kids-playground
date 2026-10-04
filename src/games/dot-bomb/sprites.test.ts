import { describe, expect, test } from 'vitest'
import {
  EGG, ENEMY_ART, HERO_CHEER, HERO_OUCH, HERO_PAL, ITEM_ICONS, ITEM_PAL, RIDE_BACK, RIDE_FRONT, RIDE_SIDE, RIDE_SIDE_HOP, heroRows, ridePalette,
} from './sprites'

function check(name: string, rows: readonly string[], pal: Record<string, string>, size?: [number, number]) {
  const width = rows[0].length
  rows.forEach((r, y) => expect(r.length, `${name} row ${y}: "${r}"`).toBe(width))
  if (size) expect([width, rows.length], name).toEqual(size)
  for (const r of rows) for (const ch of r) if (ch !== '.') expect(pal[ch], `${name}: いろ "${ch}" が ない`).toBeDefined()
}

describe('dot-bomb の ドット絵', () => {
  test('ポンの え は 16×16 で、いろが ぜんぶ ある', () => {
    for (const facing of ['front', 'back', 'side'] as const) {
      for (const step of ['stand', 'a', 'b'] as const) check(`hero ${facing} ${step}`, heroRows(facing, step), HERO_PAL, [16, 16])
    }
    check('cheer', HERO_CHEER, HERO_PAL, [16, 16])
    check('ouch', HERO_OUCH, HERO_PAL, [16, 16])
  })

  test('ピョンタ・たまご・アイテム・てきの え', () => {
    const pal = ridePalette('green')
    for (const [name, rows] of Object.entries({ RIDE_SIDE, RIDE_SIDE_HOP, RIDE_FRONT, RIDE_BACK })) check(name, rows, pal, [16, 16])
    check('egg', EGG, { ...pal, W: '#ccc' })
    for (const [name, rows] of Object.entries(ITEM_ICONS)) check(name, rows, ITEM_PAL, [10, 10])
    for (const [name, art] of Object.entries(ENEMY_ART)) check(name, art.rows, art.pal, [16, 16])
  })
})
