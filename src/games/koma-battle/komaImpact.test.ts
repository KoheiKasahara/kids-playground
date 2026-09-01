import { describe, expect, it } from 'vitest'
import {
  createKomaImpactThrottle,
  impactIntensityForRelativeSpeed,
  impactLevelForRelativeSpeed,
  IMPACT_GLOBAL_COOLDOWN_MS,
  IMPACT_MIN_RELATIVE_SPEED,
  IMPACT_PAIR_COOLDOWN_MS,
} from './komaImpact'

describe('コマ衝突フィードバック', () => {
  it('弱い接触を無音・無演出にでき、速度が上がるほど強くなる', () => {
    expect(impactIntensityForRelativeSpeed(IMPACT_MIN_RELATIVE_SPEED - 0.01)).toBe(0)
    expect(impactIntensityForRelativeSpeed(IMPACT_MIN_RELATIVE_SPEED + 0.2)).toBeGreaterThan(0)
    expect(impactIntensityForRelativeSpeed(99)).toBe(1)
    expect(impactLevelForRelativeSpeed(0.1)).toBeNull()
    expect(impactLevelForRelativeSpeed(1.8)).toBe('normal')
    expect(impactLevelForRelativeSpeed(4.5)).toBe('strong')
  })

  it('同じ対象の接触連打を抑え、十分な間隔の後は再び通す', () => {
    const throttle = createKomaImpactThrottle()
    expect(throttle.tryEmit('koma:0-1', 1000)).toBe(true)
    expect(throttle.tryEmit('koma:0-1', 1000 + IMPACT_PAIR_COOLDOWN_MS - 1)).toBe(false)
    expect(throttle.tryEmit('koma:0-1', 1000 + IMPACT_PAIR_COOLDOWN_MS)).toBe(true)
  })

  it('異なる対象への短時間の衝突も全体間隔で間引き、resetで再戦できる', () => {
    const throttle = createKomaImpactThrottle()
    expect(throttle.tryEmit('bumper:0:0', 2000)).toBe(true)
    expect(throttle.tryEmit('bumper:0:1', 2000 + IMPACT_GLOBAL_COOLDOWN_MS - 1)).toBe(false)
    expect(throttle.tryEmit('bumper:0:1', 2000 + IMPACT_GLOBAL_COOLDOWN_MS)).toBe(true)
    throttle.reset()
    expect(throttle.tryEmit('bumper:0:0', 2000)).toBe(true)
  })
})
