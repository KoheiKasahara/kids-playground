import type { IconKind, ItemKind } from './art'
import { bridgeCells } from './maps'
import { getMap, getPois, REQUESTS, ITEM_NAMES, TILE_SIZE, type GameEvent, type Point, type PoiId, type RecipientId, type World } from './model'

/**
 * Short celebrations layered on top of the map. They are purely visual: the world has
 * already changed when an effect starts, so skipping them (reduced motion) never blocks play.
 */
export type EffectKind = 'get' | 'water' | 'repair' | 'deliver' | 'confetti'
export type Effect = {
  kind: EffectKind
  poiId: PoiId
  item: ItemKind
  /** Where the thing appears (a tree, a door, the courier's paws). */
  from: Point
  /** Where it ends up (above the courier, at a recipient). */
  to: Point
  /** Seconds on the scene clock. */
  start: number
  /** A harvest throws up soil before the carrot pops out. */
  dig?: boolean
}

export const EFFECT_SECONDS: Record<EffectKind, number> = {
  get: 1.45,
  water: 1.4,
  repair: 1.6,
  deliver: 1.7,
  confetti: 3.6,
}

/** Item-get timing: hop up to the courier, hold it high, then tuck it into the bag. */
export const GET_RISE = 0.3
export const GET_HOLD = 1.1

function head(world: World): Point {
  return { x: Math.round(world.player.x), y: Math.round(world.player.y) - 40 }
}

export function bridgeCenter(world: Pick<World, 'stageIndex'>): Point {
  const cells = bridgeCells(getMap(world))
  const xs = cells.map((cell) => cell.column * TILE_SIZE + TILE_SIZE / 2)
  const ys = cells.map((cell) => cell.row * TILE_SIZE + TILE_SIZE / 2)
  return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 }
}

export function createEffects(world: World, event: GameEvent, now: number): Effect[] {
  if (event.type === 'none' || !event.poiId) return []
  const poi = getPois(world).find((point) => point.id === event.poiId)!
  const base = { poiId: poi.id, start: now }
  switch (event.type) {
    case 'collect': {
      const item: ItemKind = poi.id === 'post' ? 'parcel' : poi.id === 'wood' ? 'wood' : 'apple'
      // Parcels come out of the door, apples drop from the canopy, sticks lift off the pile.
      const lift = poi.id === 'post' ? 22 : poi.id === 'apple' ? 36 : 10
      return [{ ...base, kind: 'get', item, from: { x: poi.x, y: poi.y - lift }, to: head(world) }]
    }
    case 'harvest':
      return [{ ...base, kind: 'get', item: 'carrot', from: { x: poi.x - 6, y: poi.y - 19 }, to: head(world), dig: true }]
    case 'water':
      return [{ ...base, kind: 'water', item: 'water', from: { x: poi.x - 6, y: poi.y - 26 }, to: { x: poi.x - 6, y: poi.y - 26 } }]
    case 'repair': {
      const center = bridgeCenter(world)
      return [{ ...base, kind: 'repair', item: 'bridge', from: center, to: center }]
    }
    case 'deliver':
    case 'complete': {
      const gift: Effect = {
        ...base, kind: 'deliver', item: REQUESTS[poi.id as RecipientId],
        from: { x: Math.round(world.player.x), y: Math.round(world.player.y) - 18 },
        to: { x: poi.x, y: poi.y - 10 },
      }
      if (event.type === 'deliver') return [gift]
      return [gift, { ...base, kind: 'confetti', item: 'star', from: { x: 160, y: 0 }, to: { x: 160, y: 288 } }]
    }
  }
}

export function effectAge(effect: Effect, now: number): number {
  return now - effect.start
}

export function isEffectActive(effect: Effect, now: number): boolean {
  const age = effectAge(effect, now)
  return age >= 0 && age < EFFECT_SECONDS[effect.kind]
}

export function pruneEffects(effects: readonly Effect[], now: number): Effect[] {
  return effects.filter((effect) => isEffectActive(effect, now))
}

/** Age of the newest running effect that matches, so scenery can join in (shake, hop, build). */
export function activeAge(effects: readonly Effect[], now: number, kind: EffectKind, poiId?: PoiId): number | null {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index]
    if (effect.kind === kind && (poiId === undefined || effect.poiId === poiId) && isEffectActive(effect, now)) return effectAge(effect, now)
  }
  return null
}

export type Celebration = { icon: IconKind; text: string }

/** The banner that pops up over the map. Every change in the world gets one. */
export function celebrationFor(event: GameEvent): Celebration | null {
  if (event.type === 'none' || !event.poiId) return null
  switch (event.type) {
    case 'collect': {
      const item = event.poiId === 'post' ? 'parcel' : event.poiId === 'wood' ? 'wood' : 'apple'
      return { icon: item, text: `${ITEM_NAMES[item]} ゲット！` }
    }
    case 'harvest': return { icon: 'carrot', text: `${ITEM_NAMES.carrot} ゲット！` }
    case 'water': return { icon: 'water', text: 'すくすく そだったよ！' }
    case 'repair': return { icon: 'bridge', text: 'はしが なおった！' }
    case 'deliver': return { icon: event.poiId as RecipientId, text: 'おとどけ できた！' }
    case 'complete': return { icon: 'star', text: 'ぜんぶ とどいた！' }
  }
}
