import { describe, expect, test } from 'vitest'
import { SPECIES, SPECIES_ORDER, type SpeciesId } from '../species'
import { ATHLETES } from './athletes'
import { pointAt } from './course'
import { coursePath } from './raceSim'
import { isRaceId, raceById, RACES, terrainAt } from './races'

describe('どうぶつレースの種目と会場', () => {
  test('動物園の どうぶつが みんな、どれかの種目に 1回ずつ出る', () => {
    const all = RACES.flatMap(r => r.runners)
    expect(new Set(all).size).toBe(all.length)
    expect([...all].sort()).toEqual([...SPECIES_ORDER].sort())
    expect(Object.keys(ATHLETES).sort()).toEqual([...SPECIES_ORDER].sort())
  })

  test('種目ごとに 5〜6頭が走り、名前と会場が ちがう', () => {
    expect(new Set(RACES.map(r => r.id)).size).toBe(RACES.length)
    expect(new Set(RACES.map(r => r.name)).size).toBe(RACES.length)
    expect(new Set(RACES.map(r => r.course.name)).size).toBe(RACES.length)
    for (const r of RACES) {
      expect(r.runners.length, r.id).toBeGreaterThanOrEqual(5)
      expect(r.runners.length, r.id).toBeLessThanOrEqual(6)
      expect(raceById(r.id)).toBe(r)
      expect(isRaceId(r.id)).toBe(true)
    }
    expect(isRaceId('moon')).toBe(false)
  })

  test('よりみちの とくいわざは、その動物の とくいわざで、モーションがある', () => {
    for (const id of SPECIES_ORDER) {
      const { clip, chance } = ATHLETES[id].quirk
      expect(SPECIES[id].specials.map(s => s.clip), id).toContain(clip)
      expect(SPECIES[id].specials.find(s => s.clip === clip)?.atPond, `${id} は池がないと できない`).toBeFalsy()
      expect(SPECIES[id].manifest.clips[clip], id).toBeDefined()
      expect(chance).toBeGreaterThan(0)
      expect(chance).toBeLessThan(0.5)
      expect(ATHLETES[id].note.length, id).toBeLessThanOrEqual(28)
    }
  })

  test('コースは、ゴールの先に止まる道があり、ハードル・地面の区間が コースの中にある', () => {
    for (const r of RACES) {
      const c = r.course
      const path = coursePath(c)
      if (c.closed) expect(c.distance, r.id).toBeCloseTo(path.length, 0)
      else expect(path.length - c.distance, `${r.id} の止まる道`).toBeGreaterThanOrEqual(12)
      for (const j of c.jumps) {
        expect(j).toBeGreaterThan(5)
        expect(j).toBeLessThan(c.distance - 5)
        // ハードルの上で地面が変わらない
        expect(terrainAt(c, j - 1.5)).toBe(terrainAt(c, j + 1.5))
      }
      for (const z of c.zones) {
        expect(z.from).toBeGreaterThan(5)
        expect(z.to).toBeLessThan(c.distance)
        expect(z.to).toBeGreaterThan(z.from)
      }
    }
  })

  test('レーンは、いちばん大きな動物が となりと ぶつからない はば', () => {
    for (const r of RACES) {
      const widest = Math.max(...r.runners.map((id: SpeciesId) => SPECIES[id].manifest.bounds.width))
      expect(r.course.laneWidth, r.id).toBeGreaterThanOrEqual(widest * 1.6)
    }
  })

  test('コースは、レーンの はばの外側でも 自分と重ならない（くねくね道の 内側が交わらない）', () => {
    for (const r of RACES) {
      const c = r.course
      const path = coursePath(c)
      const half = (r.runners.length * c.laneWidth) / 2 + 1
      const end = c.closed ? c.distance : c.distance + 10
      for (let s = 0; s < end; s += 2) {
        for (let u = s + half * 4; u < end; u += 2) {
          if (c.closed && end - u + s < half * 4) continue
          const a = pointAt(path, s)
          const b = pointAt(path, u)
          expect(Math.hypot(a.x - b.x, a.z - b.z), `${r.id} ${s}m と ${u}m`).toBeGreaterThan(half * 2)
        }
      }
    }
  })
})
