import { describe, expect, it } from 'vitest'
import { charts, shoreDistance } from './charts'
import { cycleTarget, emptyHelm, fireWater, newVoyage, steerToward, tickVoyage, voyageStars, type Helm, type Voyage } from './voyage'

function sail(index = 0) {
  const voyage = newVoyage(charts[index])
  voyage.phase = 'sailing'
  return voyage
}

function advance(v: Voyage, seconds: number, helm: Helm = emptyHelm()) {
  for (let i = 0; i < Math.round(seconds * 60); i++) tickVoyage(v, helm, 1 / 60)
}

describe('しおかぜせんたい', () => {
  it.each(charts)('$name の船は海上から出発し、水でっぽうで最後まで遊べる', chart => {
    const v = newVoyage(chart)
    for (const s of [v.player, ...v.pirates]) expect(shoreDistance(s.x, s.y, chart.islands)).toBeGreaterThan(10)
    expect(fireWater(v)).toBe(false)
    v.phase = 'sailing'
    advance(v, 60, { ...emptyHelm(), firing: true })
    expect(v.phase).toBe('won')
    expect(voyageStars(v)).toBeGreaterThanOrEqual(1)
    if (v.mail) expect(v.mail.x).toBeGreaterThanOrEqual(535)
    else expect(v.pirates.every(s => s.hp === 0)).toBe(true)
  })

  it('狙った相手へ発射し、着水するまでは命中せず、給水中は連射しない', () => {
    const v = sail()
    cycleTarget(v)
    const target = v.pirates[1]
    expect(fireWater(v)).toBe(false)
    expect(v.closingIn).toBe(true)
    const origin = { ...v.player }
    while (v.closingIn && v.time < 4) advance(v, 1 / 60)
    expect(v.player.x).toBeGreaterThan(origin.x + 20)
    expect(v.shots.some(s => s.friendly)).toBe(true)
    expect(v.closingIn).toBe(false)
    expect(fireWater(v)).toBe(false)
    expect(target.hp).toBe(2)
    advance(v, 0.74)
    expect(target.hp).toBe(1)
    expect(v.pirates[0].hp).toBe(2)
    advance(v, 0.05)
    expect(fireWater(v)).toBe(true)
    advance(v, 0.85)
    expect(target.hp).toBe(0)
    expect(v.target).toBe(2)
  })

  it('着水の予告を見て船を動かせばよけられる', () => {
    const dodge = sail(), stay = sail()
    for (const v of [dodge, stay]) {
      advance(v, 3.6)
      expect(v.shots.some(s => !s.friendly)).toBe(true)
    }
    steerToward(dodge, { x: 270, y: 201 })
    advance(dodge, 2); advance(stay, 2)
    expect(dodge.player.hp).toBe(5)
    expect(stay.player.hp).toBe(4)
  })

  it('島の中をタッチしても座礁せず、矢印で新しい針路を取れる', () => {
    const v = sail()
    steerToward(v, v.chart.islands[0])
    for (let i = 0; i < 400; i++) {
      tickVoyage(v, emptyHelm(), 1 / 60)
      expect(shoreDistance(v.player.x, v.player.y, v.chart.islands)).toBeGreaterThan(10)
    }
    const { x, y } = v.player
    advance(v, 1.5, { ...emptyHelm(), dx: 1, dy: 1 })
    expect(v.course).toBeNull()
    expect(v.player.x + v.player.y).toBeGreaterThan(x + y)
  })

  it('護衛の成功には郵便船の到着が必要で、げんきが切れたら帰港する', () => {
    const v = sail(1)
    advance(v, 10, { ...emptyHelm(), firing: true })
    expect(v.phase).toBe('sailing')
    expect(v.pirates.every(s => !s.hp)).toBe(true)
    advance(v, 15)
    expect(v.phase).toBe('won')

    const lost = sail(1)
    lost.mail!.hp = 1
    advance(lost, 6)
    expect(lost.mail!.hp).toBe(0)
    expect(lost.phase).toBe('lost')
    const ended = lost.time
    advance(lost, 2)
    expect(lost.time).toBe(ended)
  })
})
