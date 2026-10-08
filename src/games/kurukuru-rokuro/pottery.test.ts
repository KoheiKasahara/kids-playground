import { describe, expect, test } from 'vitest'
import {
  BASE_MIN_RADIUS, canStretch, classifyPot, createLump, isProfile, MAX_HEIGHT, MAX_RADIUS, MIN_HEIGHT, MIN_RADIUS, nudgeProfile,
  radiusAt, radiusAtWallFraction, RING_COUNT, roundProfile, sculptRadii, silhouettePath, similarity, starsForScore, stretchProfile,
  wallFractionAtHeight, wallMetrics, type Profile,
} from './pottery'
import { TARGETS } from './targets'

/** こどもが おてほんを みながら ゆびで なぞった ときの かたちを まねる。 */
function shapeLike(target: Profile): Profile {
  let profile = createLump()
  const direction = target.height > profile.height ? 1 : -1
  while (canStretch(profile, direction)) {
    const next = stretchProfile(profile, direction)
    if (Math.abs(next.height - target.height) >= Math.abs(profile.height - target.height)) break
    profile = next
  }
  const radii = [...profile.radii]
  for (let sweep = 0; sweep < 30; sweep++) {
    for (let y = 0; y <= profile.height; y += 0.04) {
      sculptRadii(radii, profile.height, { y, radius: radiusAt(target, (y / profile.height) * target.height) }, 0.03)
    }
  }
  return { height: profile.height, radii }
}

describe('かたちを かえる', () => {
  test('ゆびを うちがわへ おくと ゆびの たかさの まわりだけ ほそくなる', () => {
    const lump = createLump()
    const radii = [...lump.radii]
    for (let i = 0; i < 30; i++) sculptRadii(radii, lump.height, { y: 0.65, radius: 0.4 }, 1 / 60)
    const middle = Math.round((0.65 / lump.height) * (RING_COUNT - 1))
    expect(radii[middle]).toBeLessThan(0.6)
    expect(radii[0]).toBeCloseTo(0.85, 2)
    expect(radii[RING_COUNT - 1]).toBeCloseTo(0.85, 2)
  })

  test('そとがわへ ひっぱると ふとくなるが、上限と下限を こえない', () => {
    const lump = createLump()
    const radii = [...lump.radii]
    for (let i = 0; i < 400; i++) sculptRadii(radii, lump.height, { y: 1.2, radius: 9 }, 0.05)
    for (let i = 0; i < 400; i++) sculptRadii(radii, lump.height, { y: 0, radius: 0 }, 0.05)
    expect(Math.max(...radii)).toBeLessThanOrEqual(MAX_RADIUS)
    expect(Math.min(...radii)).toBeGreaterThanOrEqual(MIN_RADIUS)
    expect(radii[0]).toBeGreaterThanOrEqual(BASE_MIN_RADIUS)
  })

  test('1フレームで うごく りょうは かぎられ、かたちの そとを さわっても かわらない', () => {
    const lump = createLump()
    const radii = [...lump.radii]
    sculptRadii(radii, lump.height, { y: 0.6, radius: 1.7 }, 1)
    expect(Math.max(...radii) - 0.85).toBeLessThan(0.12)
    const untouched = [...lump.radii]
    expect(sculptRadii(untouched, lump.height, { y: 3, radius: 0.3 }, 0.05)).toBe(false)
    expect(untouched).toEqual(lump.radii)
  })

  test('のばすと たかく ほそく、つぶすと ひくく ふとく なり、ねんどの りょうは ほぼ おなじ', () => {
    const volume = (profile: Profile) => profile.radii.reduce((sum, radius) => sum + radius * radius, 0) * profile.height
    const lump = createLump()
    const tall = stretchProfile(lump, 1)
    const short = stretchProfile(lump, -1)
    expect(tall.height).toBeGreaterThan(lump.height)
    expect(tall.radii[5]).toBeLessThan(lump.radii[5]!)
    expect(short.height).toBeLessThan(lump.height)
    expect(short.radii[5]).toBeGreaterThan(lump.radii[5]!)
    expect(volume(tall) / volume(lump)).toBeCloseTo(1, 2)
  })

  test('たかさは 上限・下限で とまり、それ以上は おせない', () => {
    let profile = createLump()
    for (let i = 0; i < 20; i++) profile = stretchProfile(profile, 1)
    expect(profile.height).toBe(MAX_HEIGHT)
    expect(canStretch(profile, 1)).toBe(false)
    expect(stretchProfile(profile, 1)).toBe(profile)
    for (let i = 0; i < 30; i++) profile = stretchProfile(profile, -1)
    expect(profile.height).toBe(MIN_HEIGHT)
    expect(canStretch(profile, -1)).toBe(false)
  })

  test('キーボードの nudge は えらんだ たかさを ふとく／ほそく する', () => {
    const lump = createLump()
    const wider = nudgeProfile(lump, 0.5, 0.08)
    const thinner = nudgeProfile(lump, 0.5, -0.08)
    expect(radiusAt(wider, lump.height / 2)).toBeCloseTo(0.93, 2)
    expect(radiusAt(thinner, lump.height / 2)).toBeCloseTo(0.77, 2)
    expect(lump.radii.every(radius => radius === 0.85)).toBe(true)
  })
})

describe('なにが できたか・にている ど', () => {
  test('おだいの おてほんは それぞれの しゅるいに みえる', () => {
    for (const target of TARGETS) expect(classifyPot(target.profile), target.id).toBe(target.kind)
    expect(classifyPot(createLump())).toBe('cup')
  })

  test('ひくくて ひらいたら おさら、くびが ほそくて たかいと はないれ', () => {
    expect(classifyPot({ height: 0.5, radii: Array(RING_COUNT).fill(1.4) })).toBe('plate')
    const neck = Array.from({ length: RING_COUNT }, (_, i) => (i > 28 && i < 36 ? 0.4 : 1))
    expect(classifyPot({ height: 2.6, radii: neck })).toBe('vase')
    expect(classifyPot({ height: 1.5, radii: neck })).toBe('jar')
    expect(classifyPot({ height: 0.9, radii: Array.from({ length: RING_COUNT }, (_, i) => 0.6 + i * 0.02) })).toBe('bowl')
  })

  test('おなじ かたちは 1、さいしょの ねんどは どの おだいとも ★1', () => {
    for (const target of TARGETS) {
      expect(similarity(target.profile, target.profile)).toBeCloseTo(1, 6)
      expect(starsForScore(similarity(createLump(), target.profile)), target.id).toBe(1)
    }
  })

  test('おてほんを ゆびで なぞれば どの おだいも ★3 に とどく', () => {
    for (const target of TARGETS) {
      const made = shapeLike(target.profile)
      expect(starsForScore(similarity(made, target.profile)), target.id).toBe(3)
      expect(classifyPot(made), target.id).toBe(target.kind)
    }
  })

  test('のばす・ちぢめる だけでは むずかしい おだいの ★3 には とどかない', () => {
    for (const target of TARGETS.filter(entry => entry.id !== 'cup')) {
      for (const direction of [1, -1] as const) {
        let profile = createLump()
        while (canStretch(profile, direction)) {
          profile = stretchProfile(profile, direction)
          expect(starsForScore(similarity(profile, target.profile)), target.id).toBeLessThan(3)
        }
      }
    }
  })

  test('★の さかいめ', () => {
    expect(starsForScore(0.95)).toBe(3)
    expect(starsForScore(0.8)).toBe(2)
    expect(starsForScore(0.2)).toBe(1)
  })
})

describe('かべに そった ながさ（もようの たて）', () => {
  test('まっすぐな つつでは たかさの わりあいと おなじ', () => {
    const lump = createLump()
    const { fractions, length } = wallMetrics(lump)
    expect(length).toBeCloseTo(lump.height, 6)
    expect(fractions[0]).toBe(0)
    expect(fractions.at(-1)).toBe(1)
    expect(wallFractionAtHeight(lump, 0.3)).toBeCloseTo(0.3, 6)
    expect(radiusAtWallFraction(lump, 0.7)).toBeCloseTo(0.85, 6)
  })

  test('ひらいた おさらでは ふちの ほうが ながく、はんけいは そこ→ふちへ ふえる', () => {
    const plate = TARGETS.find(target => target.id === 'plate')!.profile
    const { fractions, length } = wallMetrics(plate)
    expect(length).toBeGreaterThan(plate.height * 1.5)
    for (let i = 1; i < fractions.length; i++) expect(fractions[i]).toBeGreaterThan(fractions[i - 1]!)
    expect(radiusAtWallFraction(plate, 0)).toBeCloseTo(plate.radii[0]!, 6)
    expect(radiusAtWallFraction(plate, 1)).toBeCloseTo(plate.radii.at(-1)!, 6)
    expect(radiusAtWallFraction(plate, 0.5)).toBeGreaterThan(plate.radii[0]!)
  })
})

describe('保存と えの データ', () => {
  test('シルエットの path は 閉じていて 0〜100 に おさまる', () => {
    for (const target of TARGETS) {
      const path = silhouettePath(target.profile)
      expect(path.startsWith('M')).toBe(true)
      expect(path.endsWith('Z')).toBe(true)
      const numbers = path.match(/-?\d+(\.\d+)?/g)!.map(Number)
      expect(Math.min(...numbers)).toBeGreaterThanOrEqual(0)
      expect(Math.max(...numbers)).toBeLessThanOrEqual(100)
    }
  })

  test('まるめた かたちも かたちとして よめ、こわれた データは はじく', () => {
    const rounded = roundProfile(shapeLike(TARGETS[4]!.profile))
    expect(isProfile(rounded)).toBe(true)
    expect(isProfile({ height: 1, radii: [1, 2] })).toBe(false)
    expect(isProfile({ height: 99, radii: Array(RING_COUNT).fill(1) })).toBe(false)
    expect(isProfile({ height: 1, radii: Array(RING_COUNT).fill('x') })).toBe(false)
    expect(isProfile(null)).toBe(false)
  })
})
