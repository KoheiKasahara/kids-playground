import { decodeHerd, herdFrom, WOOL_COLORS, type Herd } from './animals'
import { biome, isBiomeId, type BiomeId } from './biomes'
import { decodeWorld, SAVE_KEY, type WoolColor, type World } from './world'

/** せかいと いっしょに ほぞんする ちけい・こむぎ・どうぶつ。 */
export const EXTRA_KEY = 'kids-playground:block-craft:extra:v1'
/** あつめた けいとの いろ（せかいを かえても のこる）。 */
export const WOOL_KEY = 'kids-playground:block-craft:wool:v1'
export const MAX_WHEAT = 999

export type Game = { world: World; biome: BiomeId; wheat: number; herd: Herd }

export function newGame(id: BiomeId): Game {
  const land = biome(id)
  return { world: land.create(), biome: id, wheat: 0, herd: herdFrom(land.spawns) }
}

/** ちけいなどが ない・こわれている ときは、くさはらの はじめの どうぶつで つづける（まえの ばんの ほぞんも よめる）。 */
export function decodeExtra(raw: string | null): Omit<Game, 'world'> {
  let data: unknown = null
  try { data = raw ? JSON.parse(raw) : null } catch { /* こわれていたら はじめの ようすで */ }
  const value = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const id = isBiomeId(value.biome) ? value.biome : 'meadow'
  const wheat = Number.isInteger(value.wheat) && (value.wheat as number) >= 0 ? Math.min(MAX_WHEAT, value.wheat as number) : 0
  return { biome: id, wheat, herd: decodeHerd(value.herd) ?? herdFrom(biome(id).spawns) }
}

export function readGame(): Game | null {
  try {
    const world = decodeWorld(localStorage.getItem(SAVE_KEY))
    return world && { world, ...decodeExtra(localStorage.getItem(EXTRA_KEY)) }
  } catch { return null }
}

export function writeGame({ world, ...extra }: Game) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world))
    localStorage.setItem(EXTRA_KEY, JSON.stringify(extra))
  } catch { /* ほぞんできなくても このまま あそべる */ }
}

export function readWool(): WoolColor[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(WOOL_KEY) ?? '[]')
    return Array.isArray(data) ? WOOL_COLORS.filter(color => data.includes(color)) : []
  } catch { return [] }
}

export function writeWool(colors: readonly WoolColor[]) {
  try { localStorage.setItem(WOOL_KEY, JSON.stringify(colors)) } catch { /* ほぞんできなくても このまま つかえる */ }
}
