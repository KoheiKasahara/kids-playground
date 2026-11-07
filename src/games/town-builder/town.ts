import { findPart, isBuilding, type NetworkId, type TilePart, type ToolId } from './parts'

// まちの ちずの モデル。がめん（React）を もたない じゅんすいな かんすう だけを おく。

export const COLS = 14
export const ROWS = 14
export const SAVE_KEY = 'kids-playground:town-builder:v1'

export type Ground = 'grass' | 'water'
export type Tile = { readonly ground: Ground; readonly part: TilePart | null }
export type Town = readonly Tile[]

/** N・E・S・W の じゅん。マスクの ビットも この じゅん（N=1, E=2, S=4, W=8）。 */
export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const
export type Dir = 0 | 1 | 2 | 3

export const RANKS = [
  { min: 0, icon: '🌱', label: 'はらっぱ' },
  { min: 4, icon: '🏡', label: 'むら' },
  { min: 20, icon: '🏘️', label: 'まち' },
  { min: 60, icon: '🏙️', label: 'とし' },
  { min: 140, icon: '🌆', label: 'だいとし' },
  { min: 300, icon: '🌟', label: 'きらきら メガシティ' },
] as const

const GRASS: Tile = { ground: 'grass', part: null }

// はじめの まち。かわと はし、みちと おうちが すこし だけ ある。
const STARTER_MAP = [
  'tt.........~~.',
  't..........~~.',
  '...........~~.',
  '..k........~~.',
  '..........~~..',
  '..........~~.t',
  '....h.H...~~..',
  '..========bb==',
  '....t.s...~~..',
  '..........~~..',
  '.t.......~~...',
  '.........~~.tt',
  '....f...~~...t',
  '........~~....',
] as const

const STARTER_LEGEND: Record<string, Tile> = {
  '.': GRASS,
  '~': { ground: 'water', part: null },
  '=': { ground: 'grass', part: 'road' },
  b: { ground: 'water', part: 'road' },
  h: { ground: 'grass', part: 'house' },
  H: { ground: 'grass', part: 'house-blue' },
  s: { ground: 'grass', part: 'shop' },
  t: { ground: 'grass', part: 'tree' },
  k: { ground: 'grass', part: 'sakura' },
  f: { ground: 'grass', part: 'flowers' },
}

export function createTown(): Town {
  return STARTER_MAP.flatMap((row) => [...row].map((cell) => STARTER_LEGEND[cell]))
}

export function createEmptyTown(): Town {
  return Array.from({ length: COLS * ROWS }, () => GRASS)
}

export function colOf(index: number): number {
  return index % COLS
}

export function rowOf(index: number): number {
  return Math.floor(index / COLS)
}

export function neighborIndex(index: number, dir: Dir): number | null {
  const col = colOf(index) + DIRS[dir][0]
  const row = rowOf(index) + DIRS[dir][1]
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null
  return row * COLS + col
}

export function carriesRoad(part: TilePart | null): boolean {
  return part === 'road' || part === 'crossing'
}

export function carriesRail(part: TilePart | null): boolean {
  return part === 'rail' || part === 'crossing'
}

/** となりの マスが test を みたす むきを ビットで かえす（N=1, E=2, S=4, W=8）。 */
export function maskOf(town: Town, index: number, test: (tile: Tile) => boolean): number {
  let mask = 0
  for (let dir = 0 as Dir; dir < 4; dir = (dir + 1) as Dir) {
    const next = neighborIndex(index, dir)
    if (next !== null && test(town[next])) mask |= 1 << dir
  }
  return mask
}

export function roadMask(town: Town, index: number): number {
  return maskOf(town, index, (tile) => carriesRoad(tile.part))
}

export function railMask(town: Town, index: number): number {
  return maskOf(town, index, (tile) => carriesRail(tile.part))
}

export function waterMask(town: Town, index: number): number {
  return maskOf(town, index, (tile) => tile.ground === 'water')
}

/** となりに みち（ふみきりを ふくむ）が あるか。 */
export function isConnected(town: Town, index: number): boolean {
  return roadMask(town, index) !== 0
}

function combineNetwork(part: TilePart | null, tool: NetworkId): TilePart {
  const other: NetworkId = tool === 'road' ? 'rail' : 'road'
  if (part === tool || part === 'crossing') return part
  return part === other ? 'crossing' : tool
}

function placeTile(tile: Tile, tool: ToolId): Tile {
  switch (tool) {
    case 'erase':
      if (tile.part) return { ground: tile.ground, part: null }
      return tile.ground === 'water' ? GRASS : tile
    case 'water': {
      // みちや せんろの したに かわを つくると はしに なる。
      const keep = tile.part !== null && !isBuilding(tile.part) ? tile.part : null
      if (tile.ground === 'water' && tile.part === keep) return tile
      return { ground: 'water', part: keep }
    }
    case 'road':
    case 'rail': {
      const part = combineNetwork(tile.part, tool)
      return part === tile.part ? tile : { ground: tile.ground, part }
    }
    default:
      // たてものや しぜんは かわを うめたてて おく。おなじ ものなら かわらない。
      if (tile.ground === 'grass' && tile.part === tool) return tile
      return { ground: 'grass', part: tool }
  }
}

/** どうぐを つかった あとの まち。かわらない ときは おなじ town を かえす。 */
export function applyTool(town: Town, index: number, tool: ToolId): Town {
  const tile = town[index]
  if (!tile) return town
  const next = placeTile(tile, tool)
  if (next === tile) return town
  const copy = town.slice()
  copy[index] = next
  return copy
}

export function residentsAt(town: Town, index: number): number {
  const part = town[index]?.part ?? null
  if (!isBuilding(part)) return 0
  const residents = findPart(part)?.residents ?? 0
  return residents && isConnected(town, index) ? residents : 0
}

export function populationOf(town: Town): number {
  let total = 0
  for (let index = 0; index < town.length; index += 1) total += residentsAt(town, index)
  return total
}

export function rankOf(population: number): number {
  let rank = 0
  RANKS.forEach((item, index) => { if (population >= item.min) rank = index })
  return rank
}

/** みちが となりに ほしい たてものか（まだ つながって いない とき true）。 */
export function wantsRoad(town: Town, index: number): boolean {
  const part = town[index]?.part ?? null
  return isBuilding(part) && Boolean(findPart(part)?.needsRoad) && !isConnected(town, index)
}

// ---- ほぞん ---------------------------------------------------------------

type SavedTown = { version: 1; cols: number; rows: number; tiles: string[] }

const TILE_PARTS = new Set<string>(['road', 'rail', 'crossing'])

function isTilePart(value: string): value is TilePart {
  if (TILE_PARTS.has(value)) return true
  const part = findPart(value)
  return part !== undefined && part.id !== 'water' && part.id !== 'road' && part.id !== 'rail'
}

export function encodeTown(town: Town): string {
  const saved: SavedTown = {
    version: 1,
    cols: COLS,
    rows: ROWS,
    tiles: town.map((tile) => `${tile.ground === 'water' ? 'w' : 'g'}${tile.part ? `:${tile.part}` : ''}`),
  }
  return JSON.stringify(saved)
}

function decodeTile(value: unknown): Tile | null {
  if (typeof value !== 'string') return null
  const [ground, part, ...rest] = value.split(':')
  if (rest.length || (ground !== 'g' && ground !== 'w')) return null
  if (part === undefined) return ground === 'w' ? { ground: 'water', part: null } : GRASS
  if (!isTilePart(part)) return null
  if (ground === 'w' && isBuilding(part)) return null
  return { ground: ground === 'w' ? 'water' : 'grass', part }
}

/** こわれた データや ちがう おおきさの データは null（はじめの まちで あそぶ）。 */
export function decodeTown(raw: string | null): Town | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const saved = data as Partial<SavedTown>
  if (saved.version !== 1 || saved.cols !== COLS || saved.rows !== ROWS || !Array.isArray(saved.tiles)) return null
  if (saved.tiles.length !== COLS * ROWS) return null
  const tiles: Tile[] = []
  for (const value of saved.tiles) {
    const tile = decodeTile(value)
    if (!tile) return null
    tiles.push(tile)
  }
  return tiles
}

