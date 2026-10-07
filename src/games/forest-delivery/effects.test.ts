import { describe, expect, test } from 'vitest'
import {
  activeAge,
  bridgeCenter,
  celebrationFor,
  createEffects,
  EFFECT_SECONDS,
  pruneEffects,
  type Effect,
} from './effects'
import { createWorld, getObjective, getPois, interact, STAGES, targetPoi, updateWorld, type GameEvent, type PoiId, type World } from './model'

function visit(world: World, id: PoiId): GameEvent {
  expect(targetPoi(world, id)).toBe(true)
  for (let frame = 0; world.path.length > 0 && frame < 1000; frame += 1) updateWorld(world, 0.1)
  return interact(world)
}

describe('おてつだいの えんしゅつ', () => {
  test.each(STAGES.map((stage, index) => [stage.name, index] as const))('%s では、できごと ひとつごとに演出と見出しが出る', (_, index) => {
    const world = createWorld(index)
    const kinds: string[] = []
    const banners: string[] = []
    for (let step = 0; !world.completed && step < 20; step += 1) {
      const event = visit(world, getObjective(world).targetId!)
      const effects = createEffects(world, event, step)
      expect(effects.length).toBeGreaterThan(0)
      expect(effects.every((effect) => effect.start === step && effect.poiId === event.poiId)).toBe(true)
      kinds.push(...effects.map((effect) => effect.kind))
      banners.push(celebrationFor(event)!.text)
    }
    expect(new Set(kinds)).toEqual(new Set(['get', 'water', 'repair', 'deliver', 'confetti']))
    expect(kinds.filter((kind) => kind === 'confetti')).toHaveLength(1)
    expect(banners).toContain('にもつ ゲット！')
    expect(banners).toContain('きのえだ ゲット！')
    expect(banners).toContain('にんじん ゲット！')
    expect(banners).toContain('すくすく そだったよ！')
    expect(banners).toContain('はしが なおった！')
    expect(banners).toContain('おとどけ できた！')
    expect(banners.at(-1)).toBe('ぜんぶ とどいた！')
    if (STAGES[index].deliveries.includes('bear')) expect(banners).toContain('りんご ゲット！')
  })

  test('拾ったものは見つけた場所から、きつねの頭の上へ持ち上がる', () => {
    const world = createWorld()
    const event = visit(world, 'post')
    const [effect] = createEffects(world, event, 3)
    const post = getPois(world).find((poi) => poi.id === 'post')!
    expect(effect).toMatchObject({ kind: 'get', item: 'parcel', start: 3 })
    expect(effect.from).toEqual({ x: post.x, y: post.y - 22 })
    expect(effect.to.x).toBe(Math.round(world.player.x))
    expect(effect.to.y).toBeLessThan(world.player.y - 30)
  })

  test('にんじんを抜くと土が舞い、届けると品物がどうぶつへ飛んでいく', () => {
    const world = createWorld()
    visit(world, 'post')
    visit(world, 'wood')
    const repair = createEffects(world, visit(world, 'bridge'), 0)
    expect(repair).toEqual([expect.objectContaining({ kind: 'repair', from: bridgeCenter(world) })])
    expect(bridgeCenter(world)).toEqual({ x: 160, y: 152 })
    const gift = createEffects(world, visit(world, 'squirrel'), 1)[0]
    const squirrel = getPois(world).find((poi) => poi.id === 'squirrel')!
    expect(gift).toMatchObject({ kind: 'deliver', item: 'parcel', to: { x: squirrel.x, y: squirrel.y - 10 } })
    expect(gift.from.y).toBeGreaterThan(gift.to.y)
    createEffects(world, visit(world, 'garden'), 2)
    const [harvest] = createEffects(world, interact(world), 3)
    expect(harvest).toMatchObject({ kind: 'get', item: 'carrot', dig: true })
  })

  test('何も起きなかったときは演出も見出しも出さない', () => {
    const world = createWorld()
    const none = interact(createWorld())
    expect(createEffects(world, { type: 'none', text: '' }, 0)).toEqual([])
    expect(celebrationFor({ type: 'none', text: '' })).toBeNull()
    expect(none.type).toBe('collect')
    expect(createEffects(world, { type: 'collect', text: '' }, 0)).toEqual([])
  })

  test('時間が過ぎた演出は消え、いちばん新しいものの経過時間を返す', () => {
    const effect = (kind: Effect['kind'], start: number, poiId: PoiId = 'post'): Effect => ({ kind, start, poiId, item: 'parcel', from: { x: 0, y: 0 }, to: { x: 0, y: 0 } })
    const effects = [effect('get', 0), effect('get', 1, 'apple'), effect('confetti', 0.5)]
    expect(activeAge(effects, 1.2, 'get')).toBeCloseTo(0.2)
    expect(activeAge(effects, 1.2, 'get', 'post')).toBeCloseTo(1.2)
    expect(activeAge(effects, 1.2, 'repair')).toBeNull()
    expect(activeAge(effects, 0.5, 'get', 'apple')).toBeNull()
    const later = EFFECT_SECONDS.get + 0.5
    expect(pruneEffects(effects, later).map((item) => item.kind)).toEqual(['get', 'confetti'])
    expect(pruneEffects(effects, 100)).toEqual([])
  })
})
