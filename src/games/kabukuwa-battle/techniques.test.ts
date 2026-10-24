import { describe, expect, test } from 'vitest'
import { SPECIES } from './species'
import { moveRepertoire, techniqueFor, type Technique } from './techniques'

describe('むしごとの わざ', () => {
  test('どの むしも とくいわざを ふくむ 3しゅるいを もち、うっちゃりは べつに する', () => {
    const all = new Set<Technique>()
    for (const sp of SPECIES) {
      const moves = moveRepertoire(sp)
      expect(moves, sp.id).toHaveLength(3)
      expect(new Set(moves).size, sp.id).toBe(moves.length)
      expect(moves).toContain(sp.move.kind)
      expect(moves).not.toContain('utchari')
      expect(techniqueFor(sp, sp.move.kind).name).toBe(sp.move.name)
      for (const move of moves) {
        all.add(move)
        const info = techniqueFor(sp, move)
        expect(info.name).not.toBe('')
        expect(info.description).not.toBe('')
        expect(info.cue).not.toBe('')
      }
    }
    expect(all).toEqual(new Set(['scoop', 'lift', 'pinch', 'charge', 'sweep', 'rush', 'toss']))
  })

  test('ツノは かちあげ、あごは よこなげ、すばやい むしは れんぞくづきを つかう', () => {
    for (const sp of SPECIES) {
      expect(moveRepertoire(sp)).toContain(sp.group === 'kabuto' ? 'toss' : 'sweep')
      if (sp.stats.speed >= 6) expect(moveRepertoire(sp)).toContain('rush')
    }
  })
})
