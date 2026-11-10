import { decodeHerd, spawnHerd, WOOL_COLORS, type Herd } from './animals'
import { biome, isBiomeId, type BiomeId } from './biomes'
import { NEW_WORLD } from './terrain'
import { MAX_WORLD, type Dimensions, type WoolColor, type World } from './world'
import { decodeGrid, decodeLegacyWorld, encodeGrid, LEGACY_SAVE_KEY } from './saveCodec'

export const SAVE_KEY = 'kids-playground:block-craft:v2'
// Maximum raw grid, Base64 overhead, and room for the small palette and farm metadata.
const MAX_RECORD_LENGTH = 4 * Math.ceil(MAX_WORLD.size ** 2 * MAX_WORLD.height / 3) + 8192

/** せかいと いっしょに ほぞんする ちけい・こむぎ・どうぶつ。 */
export const EXTRA_KEY = 'kids-playground:block-craft:extra:v1'
/** あつめた けいとの いろ（せかいを かえても のこる）。 */
export const WOOL_KEY = 'kids-playground:block-craft:wool:v1'
export const MAX_WHEAT = 999

/** seed は せかいの かたちを きめる かず。「はじめの せかい」で おなじ せかいに もどせる。 */
export type Game = { world: World; biome: BiomeId; wheat: number; herd: Herd; seed: number }
const MAX_SEED = 0xffffffff
const validSeed = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= MAX_SEED
export const randomSeed = () => Math.floor(Math.random() * 1_000_000)

/** あたらしい せかい。seed を わたさなければ、まいかい ちがう かたちに なる。 */
export function newGame(id: BiomeId, dimensions: Dimensions = NEW_WORLD, seed = randomSeed()): Game {
  const land = biome(id)
  const world = land.create({ size: dimensions.size, height: dimensions.height }, seed)
  return { world, biome: id, wheat: 0, herd: spawnHerd(world, land.animals, seed), seed }
}

/** ちけいなどが ない・こわれている ときは、くさはらの はじめの どうぶつで つづける（まえの ばんの ほぞんも よめる）。 */
export function decodeExtra(raw: string | null, world: World): Omit<Game, 'world'> {
  let data: unknown = null
  try { data = raw ? JSON.parse(raw) : null } catch { /* こわれていたら はじめの ようすで */ }
  const value = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  const id = isBiomeId(value.biome) ? value.biome : 'meadow'
  const wheat = Number.isInteger(value.wheat) && (value.wheat as number) >= 0 ? Math.min(MAX_WHEAT, value.wheat as number) : 0
  return { biome: id, wheat, herd: decodeHerd(value.herd, world.size) ?? spawnHerd(world, biome(id).animals), seed: 0 }
}

export function encodeGame({ world, ...extra }: Game) {
  return JSON.stringify({ version: 2, ...encodeGrid(world), ...extra })
}

export function decodeGame(raw: string | null): Game | null {
  if (!raw || raw.length > MAX_RECORD_LENGTH) return null
  try {
    const data = JSON.parse(raw) as Record<string, unknown> | null
    if (!data || data.version !== 2 || !isBiomeId(data.biome) || typeof data.wheat !== 'number'
      || !Number.isInteger(data.wheat) || data.wheat < 0 || data.wheat > MAX_WHEAT) return null
    const world = decodeGrid(data)
    const herd = world && decodeHerd(data.herd, world.size)
    // まえの ばんの ほぞんには seed が ない
    return world && herd ? { world, biome: data.biome, wheat: data.wheat, herd, seed: validSeed(data.seed) ? data.seed : 0 } : null
  } catch { return null }
}

export function readGame(): Game | null {
  try {
    const current = decodeGame(localStorage.getItem(SAVE_KEY))
    if (current) return current
    // Keep both old keys for recovery. A corrupt v2 can fall back to the last readable v1.
    const world = decodeLegacyWorld(localStorage.getItem(LEGACY_SAVE_KEY))
    return world && { world, ...decodeExtra(localStorage.getItem(EXTRA_KEY), world) }
  } catch { return null }
}

export function writeGame(game: Game): boolean {
  try {
    const raw = encodeGame(game)
    if (!decodeGame(raw)) return false
    localStorage.setItem(SAVE_KEY, raw)
    return true
  } catch { return false }
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
