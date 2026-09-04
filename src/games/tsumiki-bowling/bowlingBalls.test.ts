import { describe, expect, it } from 'vitest'
import {
  ballMass,
  BOWLING_BALL_SPECS,
  DEFAULT_BOWLING_BALL_ID,
  getBowlingBall,
} from './bowlingBalls'

describe('玉のBallSpec', () => {
  it('3種類あり、IDが重複しない', () => {
    expect(BOWLING_BALL_SPECS).toHaveLength(3)
    const ids = BOWLING_BALL_SPECS.map((ball) => ball.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('未知のIDは既定の玉（どっしりだま）へ落ちる', () => {
    expect(getBowlingBall('nonexistent').id).toBe(DEFAULT_BOWLING_BALL_ID)
    expect(getBowlingBall(undefined).id).toBe(DEFAULT_BOWLING_BALL_ID)
  })

  it('どっしりだまが3種類の中でいちばん大きく、いちばん重い', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    expect(heavy.radius).toBeGreaterThan(bouncy.radius)
    expect(bouncy.radius).toBeGreaterThan(small.radius)
    expect(ballMass(heavy)).toBeGreaterThan(ballMass(bouncy))
    expect(ballMass(bouncy)).toBeGreaterThan(ballMass(small))
  })

  it('はずむだまが3種類の中でいちばん反発する', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    expect(bouncy.restitution).toBeGreaterThan(heavy.restitution)
    expect(bouncy.restitution).toBeGreaterThan(small.restitution)
    // 単に「少し上げた」ではなく、体感できるレベルの高反発にする。
    expect(bouncy.restitution).toBeGreaterThanOrEqual(0.6)
  })

  it('はずむだまの発射位置は他より高い（着地のバウンドを見せるため）', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    expect(bouncy.launchHeightOffset).toBeGreaterThan(heavy.launchHeightOffset)
    expect(bouncy.launchHeightOffset).toBeGreaterThan(small.launchHeightOffset)
  })

  it('ちいさいだまが3種類の中でいちばん速い倍率を持つ', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    const small = getBowlingBall('small')
    expect(small.launchSpeedScale).toBeGreaterThan(heavy.launchSpeedScale)
    expect(small.launchSpeedScale).toBeGreaterThan(bouncy.launchSpeedScale)
    // 「一段速い」と体感できる差（1割程度では足りない）。
    expect(small.launchSpeedScale / heavy.launchSpeedScale).toBeGreaterThanOrEqual(1.15)
  })

  it('どっしり・はずむの基準速度は変えない（重い/はずむ玉を遅くしない）', () => {
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    expect(heavy.launchSpeedScale).toBeGreaterThanOrEqual(1)
    expect(bouncy.launchSpeedScale).toBeGreaterThanOrEqual(1)
  })

  it('ちいさいだまは単純な最強にしない（質量はいちばん軽い）', () => {
    const small = getBowlingBall('small')
    const heavy = getBowlingBall('heavy')
    const bouncy = getBowlingBall('bouncy')
    expect(ballMass(small)).toBeLessThan(ballMass(heavy))
    expect(ballMass(small)).toBeLessThan(ballMass(bouncy))
  })

  it('見た目（色・アイコン）が3種類とも異なる', () => {
    const colors = new Set(BOWLING_BALL_SPECS.map((ball) => ball.color))
    const icons = new Set(BOWLING_BALL_SPECS.map((ball) => ball.icon))
    expect(colors.size).toBe(3)
    expect(icons.size).toBe(3)
  })

  it('ballMassはdensityと半径から求めた球の質量になる', () => {
    const heavy = getBowlingBall('heavy')
    const expected = heavy.density * ((4 / 3) * Math.PI * heavy.radius ** 3)
    expect(ballMass(heavy)).toBeCloseTo(expected, 6)
  })
})
