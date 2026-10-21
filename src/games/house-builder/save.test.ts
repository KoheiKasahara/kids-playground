import { afterEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_EXTERIOR } from './data'
import { addRoom, createDesign, type HouseDesign } from './plan'
import { parseDesign, readDesign, writeDesign } from './save'

function sample(): HouseDesign {
  const design = { ...createDesign('nikai', 'lshape'), exterior: { ...DEFAULT_EXTERIOR, wall: 'brick', parking: 'two', extras: ['chimney', 'fence'] } } as HouseDesign
  const a = addRoom(design, 0, { type: 'living', style: 'log', size: 'l', turned: false }, { x: 0, y: 0 })!
  return addRoom(a.design, 1, { type: 'toilet', style: 'flower', size: 'm', turned: true }, { x: 4, y: 0 })!.design
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('house-builder save', () => {
  test('ほぞんした おうちを そのまま もどせる', () => {
    const design = sample()
    expect(parseDesign(JSON.parse(JSON.stringify(design)))).toEqual(design)
  })

  test('こわれた データは つかわない', () => {
    expect(parseDesign(null)).toBeNull()
    expect(parseDesign('house')).toBeNull()
    expect(parseDesign({ houseType: 'castle', shape: 'square' })).toBeNull()
    expect(parseDesign({ houseType: 'nikai', shape: 'triangle' })).toBeNull()
  })

  test('おかしな へやや そとがわは すてて、つかえる ものだけ のこす', () => {
    const design = sample()
    const parsed = parseDesign({
      ...design,
      rooms: [
        ...design.rooms,
        { ...design.rooms[0], id: 50 }, // かさなる
        { id: 51, floor: 0, type: 'pool', style: 'x', size: 'm', turned: false, x: 0, y: 5 }, // ない しゅるい
        { id: 52, floor: 3, type: 'toilet', style: 'simple', size: 's', turned: false, x: 0, y: 0 }, // ない かい
        { id: 53, floor: 0, type: 'toilet', style: 'gold', size: 'huge', turned: 'yes', x: 0, y: 5 }, // みため・おおきさは もどす
        { id: 54, floor: 0, type: 'toilet', style: 'simple', size: 's', turned: false, x: 7, y: 6 }, // にわ
        { id: 1, floor: 0, type: 'toilet', style: 'simple', size: 's', turned: false, x: 1, y: 6 }, // id が かぶる
        { id: 1.5, floor: 0, type: 'toilet', style: 'simple', size: 's', turned: false, x: 2, y: 6 },
      ],
      exterior: { wall: 'gold', roof: 'kawara', parking: 'rocket', extras: ['solar', 'ufo', 'solar'] },
    })!
    expect(parsed.rooms.map((r) => r.id)).toEqual([1, 2, 53])
    expect(parsed.rooms[2]).toMatchObject({ style: 'simple', size: 'm', turned: false })
    expect(parsed.exterior).toEqual({ ...DEFAULT_EXTERIOR, roof: 'kawara', extras: ['solar'] })
  })

  test('ブラウザに かいて よめる。ほぞん できない ときも とまらない', () => {
    const store = new Map<string, string>()
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => { store.set(k, v) },
        removeItem: (k: string) => { store.delete(k) },
      },
    })
    expect(readDesign()).toBeNull()
    const design = sample()
    writeDesign(design)
    expect(readDesign()).toEqual(design)
    writeDesign(null)
    expect(readDesign()).toBeNull()

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('denied') },
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => { throw new Error('denied') },
      },
    })
    expect(() => writeDesign(design)).not.toThrow()
    expect(readDesign()).toBeNull()
  })
})
