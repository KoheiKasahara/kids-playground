import { describe, expect, test } from 'vitest'
import { createBattle, type Battle, type BattleEvent, type Technique } from './battle'
import { ambient, burst, createFx, spawnFx, updateFx } from './fx'
import { SPECIES } from './species'

const techniques: Technique[] = ['scoop', 'lift', 'pinch', 'charge', 'sweep', 'rush', 'toss', 'utchari']
const battle = () => createBattle(SPECIES[0], SPECIES[1], 'stump', 7)
const hit = (move: Technique, side: 0 | 1 = 0): Extract<BattleEvent, { type: 'hit' }> => ({
  type: 'hit', side, move, u: 10, v: 20, z: 10, big: false,
})

function hitFx(move: Technique, b: Battle = battle()) {
  const fx = createFx(12)
  spawnFx(fx, hit(move), b)
  return fx
}

describe('わざの ひかりと すじ', () => {
  test('どの わざも ちがう かたちの ひかりが でる', () => {
    const shapes = techniques.map(move => JSON.stringify(hitFx(move).parts.map(p => [p.kind, p.u, p.v, p.z, p.vu, p.vv, p.vz])))
    expect(new Set(shapes).size).toBe(techniques.length)
  })

  test.each([0, Math.PI / 2, Math.PI, -Math.PI / 2])('れんぞくづきの 3ぼんの すじは せめる むき %s に すすむ', heading => {
    const b = battle()
    b.f[0].heading = heading
    const trail = hitFx('rush', b).parts.filter(p => p.color === '#b5efff')
    expect(trail.length).toBeGreaterThan(6)
    const across = trail.map(p => Math.round(-(p.u - 10) * Math.sin(heading) + (p.v - 20) * Math.cos(heading)))
    expect(new Set(across).size).toBe(3)
    for (const p of trail) {
      expect(p.vu * Math.cos(heading) + p.vv * Math.sin(heading)).toBeGreaterThan(60)
      expect((p.u - 10) * Math.cos(heading) + (p.v - 20) * Math.sin(heading)).toBeLessThanOrEqual(.00001)
    }
  })

  test('よこなげは あいての まわりを よこぎる ゆみと わが でる', () => {
    const trail = hitFx('sweep').parts.filter(p => p.color === '#a9f4dc')
    expect(trail.some(p => p.kind === 'ring')).toBe(true)
    const arc = trail.filter(p => p.kind === 'spark')
    expect(Math.min(...arc.map(p => p.v))).toBeLessThan(0)
    expect(Math.max(...arc.map(p => p.v))).toBeGreaterThan(40)
    expect(arc.every(p => p.z === arc[0].z)).toBe(true)
    expect(arc.some(p => p.vu < 0)).toBe(true)
    expect(arc.some(p => p.vu > 0)).toBe(true)
  })

  test.each(['sweep', 'utchari'] as const)('%s の ひかりは からだを ひねる ほうへ まわる', move => {
    const heading = .7
    const b = battle()
    b.f[0].heading = heading
    const color = move === 'sweep' ? '#a9f4dc' : '#ffbd78'
    b.f[0].orbit = 1
    const left = hitFx(move, b).parts.filter(p => p.kind === 'spark' && p.color === color)
    b.f[0].orbit = -1
    const right = hitFx(move, b).parts.filter(p => p.kind === 'spark' && p.color === color)
    const along = (u: number, v: number) => u * Math.cos(heading) + v * Math.sin(heading)
    const across = (u: number, v: number) => -u * Math.sin(heading) + v * Math.cos(heading)
    expect(left.length).toBeGreaterThan(1)
    expect(right).toHaveLength(left.length)
    left.forEach((p, i) => {
      const q = right[i]
      expect(along(p.u - 10, p.v - 20)).toBeCloseTo(along(q.u - 10, q.v - 20))
      expect(across(p.u - 10, p.v - 20)).toBeCloseTo(-across(q.u - 10, q.v - 20))
      expect(along(p.vu, p.vv)).toBeCloseTo(along(q.vu, q.vv))
      expect(across(p.vu, p.vv)).toBeCloseTo(-across(q.vu, q.vv))
      expect(p.z).toBe(q.z)
      expect(p.vz).toBe(q.vz)
    })
  })

  test('かちあげは たかさの ちがう わと うえむきの ひかりが のぼる', () => {
    const fx = hitFx('toss')
    const trail = fx.parts.filter(p => p.color === '#c7d0ff')
    const rings = trail.filter(p => p.kind === 'ring')
    expect(rings).toHaveLength(3)
    expect(new Set(rings.map(p => p.z)).size).toBe(3)
    expect(trail.every(p => p.vz > 60)).toBe(true)
    expect(trail.every(p => p.vz > Math.hypot(p.vu, p.vv))).toBe(true)
    const heights = trail.map(p => p.z)
    updateFx(fx, .1)
    expect(trail.every((p, i) => p.z > heights[i])).toBe(true)
  })

  test('はさみの ひかりは あごの りょうがわから まんなかへ とじる', () => {
    const trail = hitFx('pinch').parts.filter(p => p.color === '#ffb6c9')
    expect(trail.some(p => p.v > 20)).toBe(true)
    expect(trail.some(p => p.v < 20)).toBe(true)
    expect(trail.every(p => (p.v - 20) * p.vv < 0)).toBe(true)
  })

  test('わざを ためると ツノ・あごの さきへ ひかりが あつまる', () => {
    const b = battle()
    const fx = createFx(2)
    spawnFx(fx, { type: 'windup', side: 0, move: 'toss' }, b)
    const center = { u: b.f[0].u + b.f[0].front * .6, z: b.f[0].z + 14 }
    const distances = fx.parts.map(p => Math.hypot(p.u - center.u, p.z - center.z))
    expect(fx.parts.length).toBeGreaterThan(1)
    updateFx(fx, .1)
    expect(fx.parts.every((p, i) => Math.hypot(p.u - center.u, p.z - center.z) < distances[i])).toBe(true)
  })

  test('よけた ときは せめる むきと ちがう よこの すじが でる', () => {
    const b = battle()
    const fx = createFx(2)
    spawnFx(fx, { type: 'dodge', side: 0 }, b)
    expect(fx.parts.length).toBeGreaterThan(0)
    expect(fx.parts.every(p => p.vu === 0 && p.vv > 0)).toBe(true)
  })
})

describe('えんしゅつの せっていと かたづけ', () => {
  test.each(techniques)('うごきを へらす ときの %s は すくない ひかりだけで うごかない', move => {
    const b = battle()
    const fx = createFx(5, true)
    spawnFx(fx, { type: 'windup', side: 0, move }, b)
    spawnFx(fx, { ...hit(move), big: true }, b)
    expect(fx.parts.length).toBeGreaterThan(0)
    expect(fx.parts.length).toBeLessThanOrEqual(9)
    expect(fx.parts.some(p => ['ring', 'burst', 'lines', 'flash'].includes(p.kind))).toBe(false)
    const positions = fx.parts.map(p => [p.u, p.v, p.z])
    expect(fx.parts.every(p => p.vu === 0 && p.vv === 0 && p.vz === 0)).toBe(true)
    updateFx(fx, .1)
    expect(fx.parts.map(p => [p.u, p.v, p.z])).toEqual(positions)
  })

  test('うごきを へらす ときは よける すじと はいけいの はっぱを ださない', () => {
    const fx = createFx(1, true)
    spawnFx(fx, { type: 'dodge', side: 1 }, battle())
    ambient(fx, 'branch', 1, 0)
    ambient(fx, 'log', 3, 0)
    expect(fx.parts).toEqual([])
  })

  test('ふつうの おおわざは フラッシュと しゅうちゅうせんを だす', () => {
    const fx = createFx(1)
    spawnFx(fx, { ...hit('toss'), big: true }, battle())
    expect(fx.parts.map(p => p.kind)).toContain('flash')
    expect(fx.parts.map(p => p.kind)).toContain('lines')
  })

  test('れんぞくで わざが でても つぶが ふえつづけず、じかんが たつと すべて きえる', () => {
    const b = battle()
    const fx = createFx(4)
    for (let i = 0; i < 100; i++) spawnFx(fx, hit(techniques[i % techniques.length]), b)
    expect(fx.parts.length).toBeLessThanOrEqual(260)
    updateFx(fx, 10)
    expect(fx.parts).toEqual([])
  })

  test('うごきを へらす ときも ひかりは じかんで きえる', () => {
    const fx = createFx(1, true)
    burst(fx, 'star', 0, 0, 10, 20, ['#ffffff'], 80, .5)
    updateFx(fx, 2)
    expect(fx.parts).toEqual([])
  })
})
