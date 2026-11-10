import { ANIMAL_SPAWNS, type Spawn } from './animals'
import { createWorld, DEFAULT_WORLD, landmark, treasureColumns, treeBlocks, World, type Block, type Dimensions, type Material, type Position } from './world'

export type BiomeId = 'meadow' | 'desert' | 'snow' | 'island'
export type Biome = {
  id: BiomeId; label: string; emoji: string
  /** ひるの そらの いろ。 */
  sky: string
  spawns: readonly Spawn[]
  create: (dimensions?: Dimensions) => World
}

/** した（y=0）から じゅんに つんだ 1れつ。 */
const stack = (x: number, z: number, layers: readonly Material[]): Block[] => layers.map((material, y) => ({ x, y, z, material }))
const each = (size: number, fn: (x: number, z: number) => Block[]) => {
  const blocks: Block[] = []
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) blocks.push(...fn(x, z))
  return blocks
}
const chebyshev = (x: number, z: number, cx: number, cz: number) => Math.max(Math.abs(x - cx), Math.abs(z - cz))
const within = (x: number, z: number, [x0, x1]: readonly [number, number], [z0, z1]: readonly [number, number]) => x >= x0 && x <= x1 && z >= z0 && z <= z1

/** さばく：すなの じめんに ピラミッド・オアシス・ようがんの いけ。 */
function createDesert(dimensions = DEFAULT_WORLD): World {
  const { size } = dimensions
  const at = (n: number) => landmark(n, size)
  const treasures = treasureColumns(size)
  const blocks = each(size, (x, z) => {
    const top: Material = within(x, z, [at(3), at(5)], [at(4), at(6)]) ? 'water' : within(x, z, [at(13), at(14)], [at(2), at(3)]) ? 'lava' : 'sand'
    const layers: Material[] = ['stone', treasures.get(x + z * size) ?? 'sand', top]
    const step = chebyshev(x, z, at(11), at(10))
    for (let h = 0; h <= 2 - step; h++) layers.push('sandstone')
    return stack(x, z, layers)
  })
  blocks.push(...treeBlocks({ x: at(7), y: 3, z: at(3) }))
  for (const [x, z, height] of [[2, 10, 2], [8, 14, 1], [14, 13, 2], [1, 3, 1]] as const) {
    for (let y = 3; y < 3 + height; y++) blocks.push({ x: at(x), y, z: at(z), material: 'cactus' })
  }
  return new World(dimensions, blocks)
}

/** もみの き：ほそながい はっぱの うえに ゆき。 */
function spruceBlocks({ x, y, z }: Position): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 4; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  for (const dy of [2, 3]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (dx || dz) blocks.push({ x: x + dx, y: y + dy, z: z + dz, material: 'leaf' })
  }
  blocks.push({ x, y: y + 4, z, material: 'leaf' }, { x, y: y + 5, z, material: 'snow' })
  return blocks
}

/** ゆきやま：おおきな やまと、こおった みずうみ。 */
function createSnow(dimensions = DEFAULT_WORLD): World {
  const { size } = dimensions
  const at = (n: number) => landmark(n, size)
  const treasures = treasureColumns(size)
  const blocks = each(size, (x, z) => {
    const lake = within(x, z, [at(2), at(6)], [at(1), at(4)])
    const layers: Material[] = ['stone', treasures.get(x + z * size) ?? (lake ? 'water' : 'dirt'), lake ? 'ice' : 'snow']
    const rise = Math.max(0, 5 - Math.round(Math.hypot(x - at(11), z - at(11))))
    if (rise) {
      layers[2] = 'stone'
      for (let y = 3; y <= 2 + rise; y++) layers.push(y === 2 + rise ? 'snow' : 'stone')
    }
    return stack(x, z, layers)
  })
  for (const [x, z] of [[3, 9], [5, 13], [13, 3]] as const) blocks.push(...spruceBlocks({ x: at(x), y: 3, z: at(z) }))
  blocks.push({ x: at(4), y: 3, z: at(7), material: 'mushroom' }, { x: at(8), y: 3, z: at(6), material: 'mushroom' })
  return new World(dimensions, blocks)
}

/** やしの き：ながい みきの うえに ひろがる はっぱ。 */
function palmBlocks({ x, y, z }: Position): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 4; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  blocks.push({ x, y: y + 4, z, material: 'leaf' })
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    blocks.push({ x: x + dx, y: y + 4, z: z + dz, material: 'leaf' }, { x: x + dx * 2, y: y + 3, z: z + dz * 2, material: 'leaf' })
  }
  return blocks
}

/** しま：うみに うかぶ しまと、ようがんの ある かざん。 */
function createIsland(dimensions = DEFAULT_WORLD): World {
  const { size } = dimensions
  const at = (n: number) => landmark(n, size)
  const treasures = treasureColumns(size)
  const corals = new Set([[13, 4], [3, 3], [2, 10], [14, 12], [5, 14]].map(([x, z]) => at(x) + at(z) * size))
  const islandDistance = (x: number, z: number) => Math.hypot(x - at(8), z - at(8)) * (DEFAULT_WORLD.size - 1) / (size - 1)
  const blocks = each(size, (x, z) => {
    const distance = islandDistance(x, z)
    const layers: Material[] = ['stone', treasures.get(x + z * size) ?? 'sand']
    if (distance <= 4.5) layers.push('dirt', 'grass')
    else if (distance <= 5.6) layers.push('sand')
    else layers.push(corals.has(x + z * size) ? 'coral' : 'water')
    const ring = chebyshev(x, z, at(10), at(9))
    if (ring <= 2) {
      // かざん：まんなかの くぼみに ようがん
      layers.length = 3
      const top = ring === 2 ? 4 : 6
      for (let y = 3; y <= top; y++) layers.push(ring === 0 && y === top ? 'lava' : 'stone')
    }
    return stack(x, z, layers)
  })
  blocks.push(...palmBlocks({ x: at(5), y: 4, z: at(6) }), ...palmBlocks({ x: at(6), y: 4, z: at(11) }))
  for (const [lx, lz] of [[8, 13], [3, 8], [13, 8]]) {
    const x = at(lx), z = at(lz)
    blocks.push({ x, y: islandDistance(x, z) <= 4.5 ? 4 : 3, z, material: 'shell' })
  }
  return new World(dimensions, blocks)
}

export const BIOMES: readonly Biome[] = [
  { id: 'meadow', label: 'くさはら', emoji: '🌳', sky: '#c6eafa', spawns: ANIMAL_SPAWNS, create: createWorld },
  {
    id: 'desert', label: 'さばく', emoji: '🏜️', sky: '#f4dfae', create: createDesert,
    spawns: [{ kind: 'sheep', x: 3, z: 12, wool: 'yellow' }, { kind: 'sheep', x: 6, z: 14, wool: 'yellow' }, { kind: 'rabbit', x: 8, z: 6 }, { kind: 'rabbit', x: 12, z: 6 }],
  },
  {
    id: 'snow', label: 'ゆきやま', emoji: '🏔️', sky: '#dbe7f3', create: createSnow,
    spawns: [{ kind: 'sheep', x: 5, z: 7, wool: 'blue' }, { kind: 'sheep', x: 7, z: 6, wool: 'blue' }, { kind: 'sheep', x: 2, z: 11, wool: 'white' }, { kind: 'rabbit', x: 9, z: 2 }, { kind: 'rabbit', x: 1, z: 6 }],
  },
  {
    id: 'island', label: 'しま', emoji: '🏝️', sky: '#a5e0f8', create: createIsland,
    spawns: [{ kind: 'chicken', x: 6, z: 8 }, { kind: 'chicken', x: 7, z: 5 }, { kind: 'sheep', x: 4, z: 9, wool: 'white' }, { kind: 'sheep', x: 6, z: 4, wool: 'white' }],
  },
]
export const biome = (id: BiomeId): Biome => BIOMES.find(b => b.id === id)!
export const isBiomeId = (value: unknown): value is BiomeId => BIOMES.some(b => b.id === value)
