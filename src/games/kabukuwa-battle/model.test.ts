import { describe, expect, test } from 'vitest'
import { beetleSize, buildBeetle, lengthPx, REST } from './model'
import { SPECIES, speciesById, type Species } from './species'
import { cameraBasis, quantizePose, yawBucket, YAW_STEPS } from './sprite'

const sp = (id: string) => speciesById(id) as Species

describe('むしの もけい', () => {
  test('ずかんで ながい むしほど 画面でも ながい', () => {
    const sorted = [...SPECIES].sort((a, b) => a.lengthMm[1] - b.lengthMm[1])
    for (let i = 1; i < sorted.length; i++) expect(lengthPx(sorted[i])).toBeGreaterThanOrEqual(lengthPx(sorted[i - 1]))
    expect(lengthPx(sp('hercules')) / lengthPx(sp('niji'))).toBeGreaterThan(1.6)
  })

  test('まえ（ツノ・あご）と うしろの ながさを たすと ぜんぶの ながさに なる', () => {
    for (const s of SPECIES) {
      const size = beetleSize(s)
      expect(size.front, s.id).toBeGreaterThan(size.rear)
      expect(size.front + size.rear, s.id).toBeCloseTo(size.length, 5)
      expect(size.top, s.id).toBeGreaterThan(0)
    }
  })

  test('ツノを あげると まえが たかく なり、ひっくりかえると あしが うえを むく', () => {
    const hercules = sp('hercules')
    const top = (prims: ReturnType<typeof buildBeetle>['prims']) => Math.max(...prims.map(p => p.c[2]))
    const rest = buildBeetle(hercules, REST)
    const lifted = buildBeetle(hercules, { ...REST, lift: 1 })
    expect(top(lifted.prims)).toBeGreaterThan(top(rest.prims))
    const flipped = buildBeetle(hercules, { ...REST, flipped: true })
    const legZ = (prims: ReturnType<typeof buildBeetle>['prims']) => prims.filter(p => p.mat === 'leg').reduce((sum, p) => sum + p.c[2], 0)
    const shellZ = (prims: ReturnType<typeof buildBeetle>['prims']) => prims.find(p => p.mat === 'elytra')!.c[2]
    expect(legZ(rest.prims)).toBeLessThan(legZ(flipped.prims))
    expect(shellZ(flipped.prims)).toBeLessThan(shellZ(rest.prims))
  })

  test('クワガタの あごを ひらくと あごの さきが はなれる', () => {
    const giraffa = sp('giraffa')
    const spread = (jaw: number) => {
      const horns = buildBeetle(giraffa, { ...REST, jaw }).prims.filter(p => p.mat === 'horn')
      return Math.max(...horns.map(p => p.c[1])) - Math.min(...horns.map(p => p.c[1]))
    }
    expect(spread(1)).toBeGreaterThan(spread(0))
  })
})

describe('ドット絵の カメラ', () => {
  test('よこから・うえから の むき', () => {
    const side = cameraBasis({ yaw: 0, elevation: 0 })
    expect(side.R[0]).toBeCloseTo(1)
    expect(side.U[2]).toBeCloseTo(1)
    const top = cameraBasis({ yaw: 0, elevation: Math.PI / 2 })
    expect(top.F[2]).toBeCloseTo(-1)
    expect(top.U[1]).toBeCloseTo(1)
  })

  test('むきと ポーズは きまった だんかいに まるめて 絵を つかいまわす', () => {
    expect(yawBucket(0)).toBe(0)
    expect(yawBucket(Math.PI * 2)).toBe(0)
    expect(yawBucket(-Math.PI * 2 / YAW_STEPS)).toBe(YAW_STEPS - 1)
    expect(quantizePose({ leg: 1.3, lift: .8, jaw: .9, flipped: true })).toEqual({ leg: 1, lift: 2, jaw: 1, flipped: true })
    expect(quantizePose({ leg: -.1, lift: 0, jaw: 0, flipped: false })).toEqual({ leg: 3, lift: 0, jaw: 0, flipped: false })
  })
})
