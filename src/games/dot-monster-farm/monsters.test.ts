import { describe, expect, test } from 'vitest'
import { RARE_VARIANT, SNACKS, SPECIES, STAT_KEYS, VARIANTS, cleanWord, createMonster, monsterFromWord, stoneVariant } from './monsters'
import { rng } from './pixel'
import { BODY_H, BODY_W, SPRITE_DATA, bodyRows, eyeSpots } from './sprites'

describe('モンスターの しゅるい', () => {
  test('id・いし・わざが そろっている', () => {
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
    expect(new Set(SPECIES.map(s => s.stone)).size).toBe(SPECIES.length)
    const snackIds = SNACKS.map(s => s.id)
    for (const s of SPECIES) {
      expect(s.stoneColor).toMatch(/^#[0-9a-f]{6}$/)
      expect(snackIds).toContain(s.likes)
      expect(s.techs).toHaveLength(3)
      expect(s.techs.filter(t => t.big)).toHaveLength(1)
      expect(new Set(s.techs.map(t => t.name)).size).toBe(3)
      // ちかい わざ と とおい わざが どちらも ある。
      expect(new Set(s.techs.map(t => t.range))).toEqual(new Set(['near', 'far']))
      for (const key of STAT_KEYS) {
        expect(s.base[key]).toBeGreaterThan(0)
        expect(s.growth[key]).toBeGreaterThan(0)
      }
    }
  })

  test('うまれた ときの のうりょくは しゅるいの きほんに ちかい', () => {
    for (const s of SPECIES) {
      const m = createMonster(s, 1, 7)
      expect(m.species).toBe(s.id)
      expect(m.name).toBe(s.name)
      for (const key of STAT_KEYS) {
        expect(m.stats[key]).toBeGreaterThanOrEqual(Math.floor(s.base[key] * .9))
        expect(m.stats[key]).toBeLessThanOrEqual(Math.ceil(s.base[key] * 1.1))
      }
    }
  })

  test('いしからは たまに いろちがいが うまれる', () => {
    const r = rng(3)
    const variants = Array.from({ length: 400 }, () => stoneVariant(r))
    expect(variants.every(v => v >= 0 && v < VARIANTS)).toBe(true)
    const rare = variants.filter(v => v === RARE_VARIANT).length
    expect(rare).toBeGreaterThan(5)
    expect(rare).toBeLessThan(80)
  })
})

describe('ことばで よぶ', () => {
  test('おなじ ことばなら いつも おなじ モンスター', () => {
    expect(monsterFromWord('りんご')).toEqual(monsterFromWord('  りんご '))
    expect(monsterFromWord('りんご')).not.toEqual(monsterFromWord('ばなな'))
  })

  test('からっぽの ことばでは よべない', () => {
    expect(monsterFromWord('')).toBeNull()
    expect(monsterFromWord('   ')).toBeNull()
  })

  test('いろいろな ことばで いろいろな しゅるいが でる', () => {
    const words = Array.from({ length: 80 }, (_, i) => `ことば${i}`)
    const species = new Set(words.map(w => monsterFromWord(w)!.species))
    expect(species.size).toBe(SPECIES.length)
  })

  test('ながい ことばは 12もじまで', () => {
    expect([...cleanWord('あいうえおかきくけこさしすせそ')]).toHaveLength(12)
    expect(cleanWord(' a   b ')).toBe('a b')
  })
})

describe('ドット絵の データ', () => {
  test('かたちは 22×22 で、めは からだの うえに ある', () => {
    for (const s of SPECIES) {
      const rows = bodyRows(s.id)
      expect(rows).toHaveLength(BODY_H)
      for (const row of rows) expect(row).toHaveLength(BODY_W)
      for (const [x, y] of eyeSpots(s.id)) {
        for (let dy = 0; dy < 3; dy++) for (let dx = -1; dx < 3; dx++) {
          expect(rows[y + dy][x + dx], `${s.id} の め (${x + dx}, ${y + dy})`).not.toBe('.')
        }
      }
    }
  })

  test('いろちがいを ふくめて 4つの いろが あり、つかう もじの いろが ぜんぶ ある', () => {
    for (const s of SPECIES) {
      const looks = SPRITE_DATA.LOOKS[s.id]
      expect(looks).toHaveLength(VARIANTS)
      const letters = new Set(bodyRows(s.id).join('').replace(/[.kwpmx]/g, ''))
      for (const look of looks) {
        for (const ch of letters) expect(look.ramps[ch] ?? look.flat?.[ch], `${s.id} の '${ch}'`).toBeDefined()
      }
    }
  })
})
