import { describe, expect, it } from 'vitest'
import {
  BALL_RADIUS,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  LAUNCH_DELAYS_MS,
  OBSTACLES,
  SCORE_ZONES,
  WALLS,
  ZONE_DIVIDER_WIDTH,
  ZONE_DIVIDERS,
  ZONE_TOP,
  zoneAtX,
} from './boardLayout'
import { BALL_COUNT } from './types'

describe('SCORE_ZONES', () => {
  it('5つあり、得点が左から [100, 300, 1000, 300, 100]', () => {
    expect(SCORE_ZONES).toHaveLength(5)
    expect(SCORE_ZONES.map((z) => z.score)).toEqual([100, 300, 1000, 300, 100])
  })

  it('隙間なく盤面幅全体を覆う（xが連続し、合計幅がBOARD_WIDTHと一致する）', () => {
    const sorted = [...SCORE_ZONES].sort((a, b) => a.x - b.x)
    expect(sorted[0].x).toBe(0)
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i].x).toBe(sorted[i - 1].x + sorted[i - 1].width)
    }
    const totalWidth = sorted.reduce((sum, z) => sum + z.width, 0)
    expect(totalWidth).toBe(BOARD_WIDTH)
  })

  it('中央のゾーンが最高得点で、中央から外側へ単調非増加になる', () => {
    const scores = SCORE_ZONES.map((z) => z.score)
    const centerIndex = Math.floor(scores.length / 2)
    const maxScore = Math.max(...scores)
    expect(scores[centerIndex]).toBe(maxScore)
    for (let i = centerIndex; i < scores.length - 1; i += 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i + 1])
    }
    for (let i = centerIndex; i > 0; i -= 1) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1])
    }
  })
})

describe('OBSTACLES', () => {
  it('8〜12個で、idに重複がない', () => {
    expect(OBSTACLES.length).toBeGreaterThanOrEqual(8)
    expect(OBSTACLES.length).toBeLessThanOrEqual(12)
    const ids = OBSTACLES.map((o) => o.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('すべて盤面内（半径ぶん含めて 0..BOARD_WIDTH / 0..ZONE_TOP の内側）にある', () => {
    for (const o of OBSTACLES) {
      expect(o.x - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.x + o.radius).toBeLessThanOrEqual(BOARD_WIDTH)
      expect(o.y - o.radius).toBeGreaterThanOrEqual(0)
      expect(o.y + o.radius).toBeLessThanOrEqual(ZONE_TOP)
    }
  })

  it('障害物同士の中心距離が「半径の和 + ボール直径」以上あり、ボールが詰まらない', () => {
    for (let i = 0; i < OBSTACLES.length; i += 1) {
      for (let j = i + 1; j < OBSTACLES.length; j += 1) {
        const a = OBSTACLES[i]
        const b = OBSTACLES[j]
        const distance = Math.hypot(a.x - b.x, a.y - b.y)
        const required = a.radius + b.radius + BALL_RADIUS * 2
        expect(distance).toBeGreaterThanOrEqual(required)
      }
    }
  })
})

describe('zoneAtX', () => {
  it('各ゾーンの中央でそのゾーンを返す', () => {
    for (const zone of SCORE_ZONES) {
      const center = zone.x + zone.width / 2
      expect(zoneAtX(center).index).toBe(zone.index)
    }
  })

  it('ゾーン境界（次ゾーンの左端）では次のゾーンを返す', () => {
    for (let i = 0; i < SCORE_ZONES.length - 1; i += 1) {
      const boundary = SCORE_ZONES[i + 1].x
      expect(zoneAtX(boundary).index).toBe(i + 1)
    }
  })

  it('盤面外（負の値）は一番左のゾーンに丸める', () => {
    expect(zoneAtX(-100).index).toBe(0)
  })

  it('盤面外（BOARD_WIDTH超）は一番右のゾーンに丸める', () => {
    expect(zoneAtX(BOARD_WIDTH + 100).index).toBe(SCORE_ZONES.length - 1)
  })
})

describe('WALLS', () => {
  it('wall-bottom が存在する（底の壁がないとボールが盤外へ落ち続けてしまう）', () => {
    const bottom = WALLS.find((w) => w.id === 'wall-bottom')
    expect(bottom).toBeDefined()
  })
})

describe('ZONE_DIVIDERS', () => {
  it('ちょうど4本あり、xがゾーン境界（左から2〜5番目のゾーンの左端）と一致する', () => {
    expect(ZONE_DIVIDERS).toHaveLength(4)
    const boundaries = SCORE_ZONES.slice(1).map((z) => z.x)
    expect(ZONE_DIVIDERS.map((d) => d.x)).toEqual(boundaries)
  })

  it('ZONE_TOPから盤面下端までの高さを持つ', () => {
    for (const divider of ZONE_DIVIDERS) {
      expect(divider.height).toBe(BOARD_HEIGHT - ZONE_TOP)
    }
  })

  it('隣接ゾーンの内寸（ゾーン幅 - 仕切り幅）がボール直径より広く、ボールが必ず入れる', () => {
    const zoneWidth = SCORE_ZONES[0].width
    const innerWidth = zoneWidth - ZONE_DIVIDER_WIDTH
    expect(innerWidth).toBeGreaterThan(BALL_RADIUS * 2)
  })
})

describe('LAUNCH_DELAYS_MS', () => {
  it('BALL_COUNTと同じ長さで、狭義単調増加である', () => {
    expect(LAUNCH_DELAYS_MS).toHaveLength(BALL_COUNT)
    for (let i = 1; i < LAUNCH_DELAYS_MS.length; i += 1) {
      expect(LAUNCH_DELAYS_MS[i]).toBeGreaterThan(LAUNCH_DELAYS_MS[i - 1])
    }
  })
})
