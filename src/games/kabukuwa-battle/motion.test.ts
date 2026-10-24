import { describe, expect, test } from 'vitest'
import { createBattle, type FighterState } from './battle'
import { fighterMotion, motionPosition } from './motion'
import { SPECIES, speciesById } from './species'
import { RUSH_HIT_INTERVAL, strikeDuration, windupDuration, type Technique } from './techniques'

const MOVES: readonly Technique[] = ['scoop', 'lift', 'pinch', 'charge', 'sweep', 'rush', 'toss', 'utchari']
const fighter = () => createBattle(SPECIES[0], SPECIES[1], 'stump', 42).f[0]

function attack(move: Technique, state: 'windup' | 'strike', t: number) {
  const f = fighter()
  f.move = move; f.state = state; f.t = t; f.orbit = 1
  f.rushHits = move === 'rush' && state === 'strike' ? Math.min(3, 1 + Math.floor(t / RUSH_HIT_INTERVAL)) : 0
  return fighterMotion(f)
}

describe('わざごとの うごき', () => {
  test('よこなげは よこへ ひねり、かちあげは たかく、たいあたりは まえへ すすむ', () => {
    const sweep = attack('sweep', 'strike', .03)
    const toss = attack('toss', 'strike', .03)
    const charge = attack('charge', 'strike', .03)
    const scoop = attack('scoop', 'strike', .03)
    expect(Math.abs(sweep.yaw)).toBeGreaterThan(.6)
    expect(Math.abs(sweep.sideways)).toBeGreaterThan(4)
    expect(toss.height).toBeGreaterThan(scoop.height * 2)
    expect(toss.pitch).toBeGreaterThan(scoop.pitch)
    expect(charge.forward).toBeGreaterThan(scoop.forward)
    expect(charge.height).toBe(0)
  })

  test('れんぞくづきは 3かいの あたりと おなじ タイミングで つきだす', () => {
    for (const t of [0, RUSH_HIT_INTERVAL, RUSH_HIT_INTERVAL * 2]) {
      expect(attack('rush', 'strike', t).forward).toBeGreaterThan(7)
      expect(attack('rush', 'strike', t + .15).forward).toBe(0)
    }
    expect(attack('rush', 'strike', strikeDuration('rush')).forward).toBe(0)
  })

  test('れんぞくづきを とめられたら、2はつめ・3はつめを ふりださない', () => {
    const f = fighter()
    f.move = 'rush'; f.state = 'strike'; f.rushHits = 0
    expect(fighterMotion(f).forward).toBeGreaterThan(7)
    for (const t of [RUSH_HIT_INTERVAL, RUSH_HIT_INTERVAL * 2]) {
      f.t = t
      expect(fighterMotion(f).forward).toBe(0)
    }
  })

  test('はさみは あごを とじて もちこたえ、はさみあげは もちあげる', () => {
    const pinch = attack('pinch', 'strike', .12)
    const lift = attack('lift', 'strike', .12)
    expect(pinch.pose.jaw).toBe(0)
    expect(lift.pose.jaw).toBe(0)
    expect(pinch.height).toBe(0)
    expect(lift.height).toBeGreaterThan(2)
  })

  test.each(MOVES)('%s: ためてから うちこみ、ずれは わざの おわりに おさまる', move => {
    const f = fighter()
    const windup = attack(move, 'windup', windupDuration(f.sp, move))
    expect(windup.forward).toBeLessThan(0)
    const end = attack(move, 'strike', strikeDuration(move))
    expect([end.forward, end.sideways, end.height, end.yaw, end.pitch].every(n => Math.abs(n) < 1e-10)).toBe(true)
  })

  test('むきに あわせて うごき、たたかいの ざひょうと ポーズを かきかえない', () => {
    const f = fighter()
    f.move = 'charge'; f.state = 'strike'; f.t = 0; f.heading = Math.PI / 2
    const before = structuredClone(f)
    const motion = fighterMotion(f)
    const pos = motionPosition(f, motion)
    expect(pos.u).toBeCloseTo(f.u)
    expect(pos.v).toBeCloseTo(f.v + motion.forward)
    expect(f).toEqual(before)
    expect(motion.pose).not.toBe(f.pose)
    expect(fighterMotion(f)).toEqual(motion)
  })
})

describe('うけみ・よろこびと うごきを へらす せってい', () => {
  test('ふらつきが おさまり、カブトと クワガタは ちがう よろこびかたを する', () => {
    const f = fighter()
    f.state = 'stagger'; f.t = 0
    expect(fighterMotion(f).forward).toBeLessThan(0)
    f.t = .55
    expect(fighterMotion(f).forward).toBeCloseTo(0)
    f.state = 'win'; f.t = .3
    const kabuto = fighterMotion(f)
    f.sp = speciesById('nokogiri')!
    const kuwagata = fighterMotion(f)
    expect(kabuto.height).toBeGreaterThan(0)
    expect(kuwagata.height).toBe(0)
    expect(Math.abs(kuwagata.yaw)).toBeGreaterThan(0)
  })

  test.each(['windup', 'strike', 'stagger', 'flipped', 'cling', 'win'] as FighterState[])('%s: ゆれと とびはねを とめても、もとの じょうたいを こわさない', state => {
    const f = fighter()
    f.state = state; f.move = 'toss'; f.t = .2
    f.pose.flipped = state === 'flipped'
    const m = fighterMotion(f, true)
    expect([m.forward, m.sideways, m.height, m.yaw, m.pitch]).toEqual([0, 0, 0, 0, 0])
    expect(m.pose.flipped).toBe(f.pose.flipped)
    expect(motionPosition(f, m)).toEqual({ u: f.u, v: f.v, z: f.z })
    if (state === 'strike') expect(m.pose.lift).toBeGreaterThan(0)
  })

  test('うごきを へらした ときの よろこびは じかんで ゆれない', () => {
    const f = fighter()
    f.state = 'win'
    const first = fighterMotion(f, true)
    f.t = 3; f.pose.lift = .3; f.pose.leg = 4
    expect(fighterMotion(f, true)).toEqual(first)
  })
})
