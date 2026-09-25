import { describe, expect, test } from 'vitest'
import { DECOR, MAX_CREATURES, MAX_DECOR, SPECIES, hiki } from './data'
import {
  DAY_SECONDS, SURFACE, addCreature, addDecor, checkCreature, checkDecor, checkFood, createWorld, creatureAt, drainEvents,
  dropFood, floorY, poke, rating, resizeWorld, sandTop, skipTime, startle, stepWorld, touchDecor, wipe, type World,
} from './sim'

function run(world: World, seconds: number) {
  for (let t = 0; t < seconds; t += .05) stepWorld(world, .05)
}

describe('data', () => {
  test('なまえと しゅるいが かさならない', () => {
    expect(new Set(SPECIES.map(s => s.id)).size).toBe(SPECIES.length)
    expect(new Set(DECOR.map(d => d.kind)).size).toBe(DECOR.length)
    expect(SPECIES.find(s => s.id === 'shark')?.limit).toBe(1)
  })

  test('かぞえかた', () => {
    expect([1, 2, 3, 6, 10, 20].map(hiki)).toEqual(['1ぴき', '2ひき', '3びき', '6ぴき', '10ぴき', '20ぴき'])
  })
})

describe('おく きまり', () => {
  test('サメは 1ぴき まで', () => {
    const w = createWorld()
    expect(checkCreature(w, 'shark', 200, 80).ok).toBe(true)
    addCreature(w, 'shark', 200, 80)
    const c = checkCreature(w, 'shark', 100, 80)
    expect(c.ok).toBe(false)
    if (!c.ok) expect(c.reason).toBe('サメは 1ぴき までだよ')
  })

  test('いきものは ぜんぶで きまった かず まで', () => {
    const w = createWorld()
    for (let i = 0; i < MAX_CREATURES; i++) addCreature(w, i % 2 ? 'neon' : 'clown', 50 + i * 10, 80)
    const c = checkCreature(w, 'tang', 200, 80)
    expect(c.ok).toBe(false)
  })

  test('ものは ちかすぎると おけない。ぜんぶで きまった かず まで', () => {
    const w = createWorld()
    const y = floorY(w, .5)
    addDecor(w, 'rock', 100, y)
    expect(checkDecor(w, 'coral', 104, y).ok).toBe(false)
    expect(checkDecor(w, 'coral', 104, floorY(w, 1)).ok).toBe(true)
    expect(checkDecor(w, 'coral', 200, y).ok).toBe(true)
    const full = createWorld(1, 2000)
    for (let i = 0; i < MAX_DECOR; i++) addDecor(full, 'kelp', 30 + i * 60, y)
    expect(checkDecor(full, 'rock', 1500, y).ok).toBe(false)
  })

  test('たべる いきものが いない えさは いれられない', () => {
    const w = createWorld()
    addCreature(w, 'neon', 100, 80)
    expect(checkFood(w, 'flake').ok).toBe(true)
    expect(checkFood(w, 'shrimp').ok).toBe(false)
  })

  test('カニと チンアナゴは すなの うえ', () => {
    const w = createWorld()
    const crab = addCreature(w, 'crab', 100, 30)
    const eel = addCreature(w, 'eel', 200, floorY(w, .8))
    expect(crab.y).toBeGreaterThan(sandTop(w) - 10)
    expect(eel.z).toBeCloseTo(.8)
    expect(checkCreature(w, 'eel', 203, floorY(w, .8)).ok).toBe(false)
  })
})

describe('うごき', () => {
  test('えさを いれると すきな いきものが たべる', () => {
    const w = createWorld(3)
    const c = addCreature(w, 'clown', 200, 60)
    c.hunger = .8
    dropFood(w, 'flake', 200)
    run(w, 25)
    const events = drainEvents(w)
    expect(events.some(e => e.type === 'eat')).toBe(true)
    expect(c.hunger).toBeLessThan(.8)
  })

  test('しずんだ えさは カニが たべる', () => {
    const w = createWorld(4)
    const crab = addCreature(w, 'crab', 200, floorY(w, .5))
    crab.hunger = .9
    dropFood(w, 'pellet', 220)
    run(w, 30)
    expect(crab.hunger).toBeLessThan(.9)
  })

  test('いきものは すいそうの そとに でない', () => {
    const w = createWorld(5)
    for (const s of SPECIES) addCreature(w, s.id, 50 + Math.random() * 300, 40 + Math.random() * 120)
    run(w, 60)
    for (const c of w.creatures) {
      expect(c.x).toBeGreaterThanOrEqual(0)
      expect(c.x).toBeLessThanOrEqual(w.W)
      expect(c.y).toBeGreaterThanOrEqual(SURFACE)
      expect(c.y).toBeLessThanOrEqual(w.H)
      expect(Number.isFinite(c.hunger)).toBe(true)
    }
  })

  test('ハリセンボンを さわると ふくらむ', () => {
    const w = createWorld()
    const p = addCreature(w, 'puffer', 200, 100)
    poke(w, p)
    run(w, 1)
    expect(p.puff).toBeGreaterThan(.5)
    expect(creatureAt(w, p.x, p.y)).toBe(p)
  })

  test('ガラスを たたくと ちかくの さかなが にげる', () => {
    const w = createWorld()
    const c = addCreature(w, 'tang', 200, 100)
    expect(startle(w, 190, 100)).toBe(1)
    run(w, .5)
    expect(c.x).toBeGreaterThan(200)
  })

  test('よるに なって あさが くる', () => {
    const w = createWorld()
    addCreature(w, 'neon', 100, 80)
    skipTime(w)
    expect(w.night).toBe(true)
    expect(drainEvents(w).some(e => e.type === 'night')).toBe(true)
    run(w, DAY_SECONDS * .31)
    expect(w.night).toBe(false)
  })

  test('シャコガイが ひらいたら しんじゅが とれる', () => {
    const w = createWorld(9)
    const d = addDecor(w, 'clam', 200, floorY(w, .5))
    expect(touchDecor(w, d)).toBe('closed')
    d.timer = 0
    run(w, 2)
    d.pearl = true
    expect(touchDecor(w, d)).toBe('pearl')
    expect(w.pearls).toBe(1)
    expect(touchDecor(w, d)).toBe('closed')
  })

  test('コケが はえて、ふくと きえる', () => {
    const w = createWorld()
    addCreature(w, 'neon', 100, 80)
    w.mossTimer = 0
    run(w, 30)
    expect(w.moss.length).toBe(1)
    const m = w.moss[0]
    for (let i = 0; i < 3; i++) wipe(w, m.x, m.y)
    expect(w.moss.length).toBe(0)
  })

  test('ひょうかは いきものが いないと 0、いると 1〜5', () => {
    const w = createWorld()
    expect(rating(w)).toBe(0)
    addCreature(w, 'clown', 100, 80)
    expect(rating(w)).toBeGreaterThanOrEqual(1)
    expect(rating(w)).toBeLessThanOrEqual(5)
  })

  test('がめんの はばが かわると ならびも のびる', () => {
    const w = createWorld(1, 400, 225)
    const c = addCreature(w, 'clown', 200, 100)
    const d = addDecor(w, 'rock', 100, floorY(w, .5))
    resizeWorld(w, 800, 225)
    expect(c.x).toBeCloseTo(400)
    expect(d.x).toBeCloseTo(200)
  })
})
