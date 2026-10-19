import { describe, expect, it } from 'vitest'
import { batPose, batterTwist, pitcherMotion, restingPitcherPose } from './motion'

const TAU = Math.PI * 2
/** かくどの ちがい（ひとまわりの ずれは おなじ むき とみる）。 */
const turn = (a: number, b: number) => Math.abs(((a - b) % TAU + TAU + Math.PI) % TAU - Math.PI)

describe('pitcherMotion', () => {
  it('かまえ から はじまり、なげたあとは おなじ かまえに もどる', () => {
    const rest = pitcherMotion(null)
    for (const since of [-5, -.9, .65, 3]) {
      const pose = pitcherMotion(since)
      expect(turn(pose.throwing.angle, rest.throwing.angle)).toBeLessThan(1e-6)
      expect(turn(pose.glove.angle, rest.glove.angle)).toBeLessThan(1e-6)
      expect(pose.kick).toBe(0)
      expect(pose.lean).toBe(0)
      expect(pose.swoosh).toBeNull()
    }
  })

  it('うごきが とちゅうで とばない（1コマごとの かわりが ちいさい）', () => {
    const dt = 1 / 60
    for (let s = -1; s < .8; s += dt) {
      const a = pitcherMotion(s), b = pitcherMotion(s + dt)
      expect(Math.abs(b.throwing.angle - a.throwing.angle)).toBeLessThan(.6)
      expect(Math.abs(b.glove.angle - a.glove.angle)).toBeLessThan(.6)
      expect(Math.abs(b.kick - a.kick)).toBeLessThan(.2)
    }
  })

  it('あしを あげてから ふみこみ、はなす ときは うでが うえで あしは ついている', () => {
    expect(pitcherMotion(-.4).kick).toBeGreaterThan(.9)
    const release = pitcherMotion(0)
    expect(release.kick).toBe(0)
    // ボールは あたまの みぎうえ（なげる うでの がわ）から でてくる。
    expect(Math.sin(release.throwing.angle)).toBeLessThan(-.9)
    expect(release.throwing.front).toBe(true)
    // うしろへ ひいた うでは からだの うしろに かくれる。
    expect(pitcherMotion(-.2).throwing.front).toBe(false)
  })

  it('うでを ふる あいだだけ すじが でる', () => {
    expect(pitcherMotion(-.5).swoosh).toBeNull()
    expect(pitcherMotion(-.05).swoosh?.alpha).toBeGreaterThan(.5)
    expect(pitcherMotion(.4).swoosh).toBeNull()
  })

  it('ストライクを とると りょうてを あげて とび、しばらくして かまえに もどる', () => {
    const cheer = pitcherMotion(null, .3)
    expect(cheer.hop).toBeGreaterThan(0)
    expect(Math.sin(cheer.throwing.angle)).toBeLessThan(-.5)
    expect(Math.sin(cheer.glove.angle)).toBeLessThan(-.5)
    const after = pitcherMotion(null, 2)
    expect(after.hop).toBe(0)
    expect(turn(after.throwing.angle, pitcherMotion(null).throwing.angle)).toBeLessThan(1e-6)
  })

  it('えらぶ がめんの かたちは ボールを もった かまえ', () => {
    const pose = restingPitcherPose()
    expect(pose.holding).toBe(true)
    expect(pose.kick).toBe(0)
  })
})

describe('batPose', () => {
  it('かまえでは うえ、ミートで ピッチャーの ほう（みぎ）、ふりおわりは ひだりうえ', () => {
    expect(Math.sin(batPose(null).angle)).toBeLessThan(-.8)
    const meet = batPose(.15)
    expect(Math.cos(meet.angle)).toBeGreaterThan(.9)
    const end = batPose(1)
    expect(Math.cos(end.angle)).toBeLessThan(-.5)
    expect(Math.sin(end.angle)).toBeLessThan(0)
  })

  it('こしは ふるに つれて まわり、かまえでは まわらない', () => {
    expect(batterTwist(null)).toBe(0)
    expect(batterTwist(0)).toBe(0)
    expect(batterTwist(.4)).toBeGreaterThan(batterTwist(.2))
    expect(batterTwist(1)).toBe(1)
  })
})
