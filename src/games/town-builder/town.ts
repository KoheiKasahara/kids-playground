import { findPart, isBuilding, isGroundTool, type NetworkId, type TilePart, type ToolId } from './parts'

// まちの ちずの モデル。がめん（React）を もたない じゅんすいな かんすう だけを おく。

/** ちずの おおきさ。まえの 14×14 の まちは まんなかに おいて よみこむ。 */
export const COLS = 48
export const ROWS = 48
export const SAVE_KEY = 'kids-playground:town-builder:v1'

export type Ground = 'grass' | 'water' | 'sand' | 'snow'
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
  { min: 700, icon: '🚀', label: 'みらいの とし' },
  { min: 1500, icon: '👑', label: 'ゆめの おうこく' },
] as const

const GRASS: Tile = { ground: 'grass', part: null }

export const GROUND_LABELS: Record<Ground, string> = { grass: 'くさはら', water: 'みず', sand: 'すな', snow: 'ゆき' }

/** ちずの まんなかの マス。はじめに みえる ばしょで、どの せかいも ここに むらが ある。 */
export const CENTER_INDEX = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2)

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
  if (tool === 'erase') {
    if (tile.part) return { ground: tile.ground, part: null }
    return tile.ground === 'grass' ? tile : GRASS
  }
  if (isGroundTool(tool)) {
    // みちや せんろの したに みずを つくると はしに なる。たてものは みずの うえに たてない。
    const keep = tool === 'water' && isBuilding(tile.part) ? null : tile.part
    if (tile.ground === tool && tile.part === keep) return tile
    return { ground: tool, part: keep }
  }
  if (tool === 'road' || tool === 'rail') {
    const part = combineNetwork(tile.part, tool)
    return part === tile.part ? tile : { ground: tile.ground, part }
  }
  // たてものや しぜんは みずを うめたてて おく。おなじ ものなら かわらない。
  const ground = tile.ground === 'water' ? 'grass' : tile.ground
  if (tile.ground === ground && tile.part === tool) return tile
  return { ground, part: tool }
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

/** tiles は「じめん[:パーツ]」。おなじ マスが つづく ときは「*かず」を つけて まとめる。 */
type SavedTown = { version: 1 | 2; cols: number; rows: number; tiles: string[] }

const GROUND_CODES: Record<Ground, string> = { grass: 'g', water: 'w', sand: 's', snow: 'n' }
const GROUND_BY_CODE = new Map<string, Ground>(Object.entries(GROUND_CODES).map(([ground, code]) => [code, ground as Ground]))
const TILE_PARTS = new Set<string>(['road', 'rail', 'crossing'])

function isTilePart(value: string): value is TilePart {
  if (TILE_PARTS.has(value)) return true
  const part = findPart(value)
  return part !== undefined && !isGroundTool(part.id) && part.id !== 'road' && part.id !== 'rail'
}

function tileCode(tile: Tile): string {
  return `${GROUND_CODES[tile.ground]}${tile.part ? `:${tile.part}` : ''}`
}

export function encodeTown(town: Town): string {
  const tiles: string[] = []
  let run = 0
  for (let index = 0; index < town.length; index += 1) {
    run += 1
    const code = tileCode(town[index])
    if (index + 1 < town.length && tileCode(town[index + 1]) === code) continue
    tiles.push(run > 1 ? `${code}*${run}` : code)
    run = 0
  }
  const saved: SavedTown = { version: 2, cols: COLS, rows: ROWS, tiles }
  return JSON.stringify(saved)
}

function decodeTile(value: string): Tile | null {
  const [code, part, ...rest] = value.split(':')
  const ground = GROUND_BY_CODE.get(code)
  if (rest.length || !ground) return null
  if (part === undefined) return ground === 'grass' ? GRASS : { ground, part: null }
  if (!isTilePart(part)) return null
  if (ground === 'water' && isBuilding(part)) return null
  return { ground, part }
}

function decodeTiles(values: readonly unknown[], count: number, runs: boolean): Tile[] | null {
  const tiles: Tile[] = []
  for (const value of values) {
    if (typeof value !== 'string') return null
    const [code, length, ...rest] = value.split('*')
    if (rest.length || (length !== undefined && (!runs || !/^[1-9]\d*$/.test(length)))) return null
    const tile = decodeTile(code)
    const run = length === undefined ? 1 : Number(length)
    if (!tile || tiles.length + run > count) return null
    for (let n = 0; n < run; n += 1) tiles.push(tile)
  }
  return tiles.length === count ? tiles : null
}

/** こわれた データは null（はじめの まちで あそぶ）。ちいさい ちずの データは くさはらの まんなかに おく。 */
export function decodeTown(raw: string | null): Town | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const saved = data as Partial<SavedTown>
  if ((saved.version !== 1 && saved.version !== 2) || !Array.isArray(saved.tiles)) return null
  const { cols, rows } = saved
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || !cols || !rows || cols < 1 || rows < 1 || cols > COLS || rows > ROWS) return null
  const tiles = decodeTiles(saved.tiles, cols * rows, saved.version === 2)
  if (!tiles) return null
  if (cols === COLS && rows === ROWS) return tiles
  const town = createEmptyTown().slice()
  const left = Math.floor((COLS - cols) / 2)
  const top = Math.floor((ROWS - rows) / 2)
  tiles.forEach((tile, index) => { town[(top + Math.floor(index / cols)) * COLS + left + (index % cols)] = tile })
  return town
}
