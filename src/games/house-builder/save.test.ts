import { afterEach, describe, expect, test, vi } from 'vitest'
import { DEFAULT_EXTERIOR, DOORS, EXTRAS, GARDENS, POOLS, ROOFS, WALLS, WINDOWS } from './data'
import { addRoom, createDesign, type HouseDesign } from './plan'
import {
  ALBUM_LIMIT, parseAlbum, parseDesign, putHouse, readAlbum, readDraft, removeHouse, sameDesign, writeAlbum, writeDraft,
} from './save'

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

  test('えらべる かべ・やね・まど・ドア・にわ・プール・おまけを すべて ほぞんできる', () => {
    const design = sample()
    // カテゴリごとに検査し、選択肢を増やしても保存側の登録漏れを見つける。
    for (const [key, options] of Object.entries({ wall: WALLS, roof: ROOFS, window: WINDOWS, door: DOORS, garden: GARDENS, pool: POOLS })) {
      for (const option of options) {
        const changed = { ...design, exterior: { ...design.exterior, [key]: option.id, extras: EXTRAS.map((extra) => extra.id) } }
        expect(parseDesign(JSON.parse(JSON.stringify(changed))), `${key}/${option.id}`).toEqual(changed)
      }
    }
  })

  test('プールが なかった ころの つくりかけ・アルバムを のこし、しらない プールだけ はずす', () => {
    stubStorage()
    const design = sample()
    const oldExterior = Object.fromEntries(Object.entries(design.exterior).filter(([key]) => key !== 'pool'))
    const legacy = { ...design, exterior: oldExterior }
    window.localStorage.setItem('house-builder-v1', JSON.stringify({ ...legacy, savedId: 9 }))
    window.localStorage.setItem('house-builder-album-v1', JSON.stringify([{ id: 9, savedAt: 1, design: legacy }]))
    const migrated: HouseDesign = { ...design, exterior: { ...design.exterior, pool: 'none' } }
    expect(readDraft()).toEqual({ design: migrated, savedId: 9 })
    expect(readAlbum()).toEqual([{ id: 9, savedAt: 1, design: migrated }])
    expect(parseDesign({ ...legacy, exterior: { ...oldExterior, pool: 'ocean' } })).toEqual(migrated)
    expect(sameDesign(design, migrated)).toBe(true)
  })

  test('プールと はたけを いっしょに ほぞんし、プールの へんこうも みわける', () => {
    stubStorage()
    const design: HouseDesign = { ...sample(), exterior: { ...DEFAULT_EXTERIOR, garden: 'strawberries', pool: 'rectangle', extras: ['picnic', 'fountain'] } }
    writeDraft({ design, savedId: 1 })
    writeAlbum([{ id: 1, savedAt: 10, design }])
    expect(readDraft()).toEqual({ design, savedId: 1 })
    expect(readAlbum()[0].design).toEqual(design)
    expect(sameDesign(design, { ...design, exterior: { ...design.exterior, pool: 'round' } })).toBe(false)
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
    stubStorage()
    expect(readDraft()).toBeNull()
    expect(readAlbum()).toEqual([])
    const design = sample()
    expect(writeDraft({ design, savedId: 3 })).toBe(true)
    expect(readDraft()).toEqual({ design, savedId: 3 })
    writeDraft({ design, savedId: null })
    expect(readDraft()).toEqual({ design, savedId: null })
    writeDraft(null)
    expect(readDraft()).toBeNull()
    const album = putHouse([], design, null, 100)!.album
    expect(writeAlbum(album)).toBe(true)
    expect(readAlbum()).toEqual(album)

    vi.stubGlobal('window', {
      localStorage: {
        getItem: () => { throw new Error('denied') },
        setItem: () => { throw new Error('QuotaExceededError') },
        removeItem: () => { throw new Error('denied') },
      },
    })
    expect(writeDraft({ design, savedId: null })).toBe(false)
    expect(readDraft()).toBeNull()
    expect(writeAlbum(album)).toBe(false)
    expect(readAlbum()).toEqual([])
  })

  test('ほぞんした おうちを ふやし、おなじ おうちは うわがきし、いっぱいなら ふやさない', () => {
    const design = sample()
    const first = putHouse([], design, null, 1)!
    expect(first).toEqual({ id: 1, album: [{ id: 1, savedAt: 1, design }] })

    const changed = { ...design, exterior: { ...design.exterior, wall: 'white' } } as HouseDesign
    const over = putHouse(first.album, changed, 1, 2)!
    expect(over.album).toEqual([{ id: 1, savedAt: 2, design: changed }])

    // けした おうちに つながって いたら、あたらしく ふやす。
    const second = putHouse(over.album, design, 9, 3)!
    expect(second.id).toBe(2)

    let album = second.album
    while (album.length < ALBUM_LIMIT) album = putHouse(album, design, null, 4)!.album
    expect(putHouse(album, design, null, 5)).toBeNull()
    expect(putHouse(album, changed, 2, 5)!.album.find((h) => h.id === 2)?.design).toEqual(changed)

    const removed = removeHouse(album, 1)
    expect(removed.map((h) => h.id)).toEqual(album.slice(1).map((h) => h.id))
    expect(putHouse(removed, design, null, 6)!.id).toBe(ALBUM_LIMIT + 1)
  })

  test('ほぞんした いちらんの こわれた ものは すてる', () => {
    const design = JSON.parse(JSON.stringify(sample()))
    expect(parseAlbum(null)).toEqual([])
    expect(parseAlbum({ id: 1 })).toEqual([])
    const parsed = parseAlbum([
      { id: 1, savedAt: 10, design },
      { id: 1, savedAt: 11, design }, // id が かぶる
      { id: 2, savedAt: 'きのう', design }, // ひづけは なくても よい
      { id: 3, savedAt: 12, design: { houseType: 'castle' } },
      { id: 'x', savedAt: 13, design },
      null,
      ...Array.from({ length: ALBUM_LIMIT }, (_, i) => ({ id: 10 + i, savedAt: 1, design })),
    ])
    expect(parsed.map((h) => h.id)).toEqual([1, 2, 10, 11, 12, 13].slice(0, ALBUM_LIMIT))
    expect(parsed[1].savedAt).toBe(0)
  })

  test('ならびじゅんが ちがっても おなじ おうちと みなす', () => {
    const design = sample()
    const shuffled = JSON.parse(JSON.stringify({ exterior: design.exterior, rooms: design.rooms.map((r) => ({ ...r })), shape: design.shape, houseType: design.houseType }))
    expect(sameDesign(design, shuffled)).toBe(true)
    expect(sameDesign(design, { ...design, rooms: design.rooms.slice(1) })).toBe(false)
  })
})

function stubStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    },
  })
}
