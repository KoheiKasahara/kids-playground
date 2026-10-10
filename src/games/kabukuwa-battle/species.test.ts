import { describe, expect, test } from 'vitest'
import { LONGEST_MM, SPECIES, STAT_KEYS, STAT_MAX, sizeScore, speciesById, speciesOfGroup } from './species'

describe('カブクワの しゅるい', () => {
  test('id・なまえ・よびなが かさならない', () => {
    for (const key of ['id', 'name', 'short'] as const) {
      const values = SPECIES.map(sp => sp[key])
      expect(new Set(values).size, key).toBe(values.length)
    }
  })

  test('カブトムシと クワガタが おなじ かずずつ いて、にほんと せかいの むしが いる', () => {
    expect(speciesOfGroup('kabuto').length).toBe(speciesOfGroup('kuwagata').length)
    expect(speciesOfGroup('kabuto').length).toBeGreaterThanOrEqual(5)
    expect(SPECIES.some(sp => sp.area === 'japan')).toBe(true)
    expect(new Set(SPECIES.filter(sp => sp.area !== 'japan').map(sp => sp.area)).size).toBeGreaterThanOrEqual(3)
  })

  test('おおきさは ずかんの 最大体長から きまり、ちから・はやさは 1〜10', () => {
    for (const sp of SPECIES) {
      const [min, max] = sp.lengthMm
      expect(min, sp.id).toBeGreaterThan(0)
      expect(max, sp.id).toBeGreaterThan(min)
      expect(max, sp.id).toBeLessThanOrEqual(LONGEST_MM)
      expect(sp.stats.size, sp.id).toBe(sizeScore(max))
      for (const key of STAT_KEYS) {
        expect(Number.isInteger(sp.stats[key]), `${sp.id} ${key}`).toBe(true)
        expect(sp.stats[key], `${sp.id} ${key}`).toBeGreaterThanOrEqual(1)
        expect(sp.stats[key], `${sp.id} ${key}`).toBeLessThanOrEqual(STAT_MAX)
      }
    }
  })

  test('いちばん ながい ヘラクレスが おおきさ 10、からだが ながい ほど おおきさが ちいさく ならない', () => {
    expect(speciesById('hercules')?.stats.size).toBe(STAT_MAX)
    const byLength = [...SPECIES].sort((a, b) => a.lengthMm[1] - b.lengthMm[1])
    for (let i = 1; i < byLength.length; i++) expect(byLength[i].stats.size).toBeGreaterThanOrEqual(byLength[i - 1].stats.size)
  })

  test('カブトムシには ツノ、クワガタには 大あごが ある', () => {
    for (const sp of SPECIES) {
      if (sp.group === 'kabuto') expect(sp.look.horns?.length, sp.id).toBeGreaterThan(0)
      else expect(sp.look.jaw, sp.id).toBeDefined()
      expect(sp.look.elytra.length, sp.id).toBeGreaterThanOrEqual(3)
      if (sp.look.pattern && sp.look.pattern !== 'metal') expect(sp.look.accent, sp.id).toBeDefined()
    }
  })

  test('わからない id では なにも かえさない', () => {
    expect(speciesById('unknown')).toBeUndefined()
    expect(speciesById(null)).toBeUndefined()
  })
})
