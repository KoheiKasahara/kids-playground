import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { SPECIES, SPECIES_ORDER } from './species'
import {
  addStamp, apparentSize, countStamps, discovered, hasStamp, loadSave, observe, parseSave, stampKinds, WATCH_SIZE, WATCH_TIME, writeSave,
  type Sighting, type WatchState,
} from './zukan'

function watchFor(state: WatchState, seconds: number, sightings: Sighting[], dt = 1 / 30) {
  const found: ReturnType<typeof observe> = []
  for (let t = 0; t < seconds; t += dt) found.push(...observe(state, dt, sightings))
  return found
}

/** node の環境で動かすので、ブラウザの localStorage の代わりを置く。 */
function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() { return data.size },
    clear: () => data.clear(),
    getItem: k => data.get(k) ?? null,
    key: i => [...data.keys()][i] ?? null,
    removeItem: k => { data.delete(k) },
    setItem: (k, v) => { data.set(k, String(v)) },
  }
}

describe('どうぶつ ずかん', () => {
  let localStorage: Storage
  beforeEach(() => {
    localStorage = memoryStorage()
    vi.stubGlobal('window', { localStorage })
  })
  afterEach(() => vi.unstubAllGlobals())

  test('どの動物にも、よく見る・えさ・ねがお・とくいわざのスタンプがある', () => {
    for (const id of SPECIES_ORDER) {
      const kinds = stampKinds(id)
      expect(kinds).toEqual(expect.arrayContaining(['see', 'feed', 'sleep', ...SPECIES[id].specials.map(s => s.clip)]))
      expect(new Set(kinds).size).toBe(kinds.length)
    }
  })

  test('スタンプは1回だけ押せて、数がたまる', () => {
    const z1 = addStamp({}, 'elephant', 'see')!
    expect(hasStamp(z1, 'elephant', 'see')).toBe(true)
    expect(discovered(z1, 'elephant')).toBe(true)
    expect(discovered(z1, 'lion')).toBe(false)
    expect(addStamp(z1, 'elephant', 'see')).toBeUndefined()
    expect(addStamp(z1, 'elephant', 'Roar')).toBeUndefined()
    const z2 = addStamp(z1, 'elephant', 'Trumpet')!
    expect(countStamps(z2, ['elephant'])).toEqual({ got: 2, total: stampKinds('elephant').length })
  })

  test('大きく映っている動物を見続けるとスタンプになり、とくいわざ・ねがおも見ていれば押せる', () => {
    const state: WatchState = new Map()
    const near: Sighting = { id: 'elephant-mom', species: 'elephant', size: WATCH_SIZE * 2 }
    expect(watchFor(state, WATCH_TIME.see * 0.5, [near])).toEqual([])
    expect(watchFor(state, WATCH_TIME.see, [near])).toEqual([{ species: 'elephant', kind: 'see', id: 'elephant-mom' }])
    // 同じものは何度も知らせない
    expect(watchFor(state, 2, [near])).toEqual([])
    const trumpet: Sighting = { ...near, doing: { kind: 'special', clip: 'Trumpet' } }
    expect(watchFor(state, 1, [trumpet])).toContainEqual({ species: 'elephant', kind: 'Trumpet', id: 'elephant-mom' })
    const sleeping: Sighting = { ...near, doing: { kind: 'sleep' } }
    expect(watchFor(state, 1.5, [sleeping])).toContainEqual({ species: 'elephant', kind: 'sleep', id: 'elephant-mom' })
  })

  test('小さくしか映っていない（遠い・画面の外）と、スタンプにならない', () => {
    const state: WatchState = new Map()
    const far: Sighting = { id: 'rabbit-mom', species: 'rabbit', size: WATCH_SIZE * 0.5, doing: { kind: 'special', clip: 'Binky' } }
    expect(watchFor(state, 5, [far])).toEqual([])
    // 見るのをやめると数え直す
    const near: Sighting = { ...far, size: WATCH_SIZE * 1.5 }
    watchFor(state, WATCH_TIME.see * 0.8, [near])
    watchFor(state, 0.2, [])
    expect(watchFor(state, WATCH_TIME.see * 0.8, [near]).filter(f => f.kind === 'see')).toEqual([])
  })

  test('画面に映る大きさは、遠いほど・視野が広いほど小さい', () => {
    expect(apparentSize(2, 5, 50)).toBeGreaterThan(apparentSize(2, 10, 50))
    expect(apparentSize(2, 5, 50)).toBeGreaterThan(apparentSize(2, 5, 70))
    expect(apparentSize(2, 10, 50)).toBeCloseTo(2 / (2 * 10 * Math.tan((25 * Math.PI) / 180)))
  })

  test('保存して読み直せる。へんなデータは捨てて、知っているスタンプだけ残す', () => {
    const zukan = addStamp(addStamp({}, 'lion', 'see')!, 'lion', 'Roar')!
    expect(writeSave({ zukan, area: 'wild' })).toBe(true)
    expect(loadSave()).toEqual({ zukan, area: 'wild' })
    expect(parseSave({ zukan: { lion: ['see', 'see', 'Fly', 3], dragon: ['see'], panda: 'see' }, area: 'moon' }))
      .toEqual({ zukan: { lion: ['see'] }, area: 'savanna' })
    expect(parseSave(null)).toEqual({ zukan: {}, area: 'savanna' })
    localStorage.setItem('zoo-3d-v1', '{こわれた')
    expect(loadSave()).toEqual({ zukan: {}, area: 'savanna' })
  })
})
