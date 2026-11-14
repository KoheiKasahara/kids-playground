import {
  findPart, fitScale, isBuilding, isLarge, scalesOf, spanOf,
  type BuildingId, type NetworkId, type Scale, type TilePart, type ToolId,
} from './parts'

// まちの ちずの モデル。がめん（React）を もたない じゅんすいな かんすう だけを おく。

export const COLS = 14
export const ROWS = 14

export type Ground = 'grass' | 'water'
/**
 * 1マスの ようす。
 * - anchor: 2マス いじょうを つかう たてものの ひだりうえの マスの ばんごう。
 * - scale: おおきく おいた たてものの ばい（2・3）。ちいさい ときは ない。
 * 2マス いじょうの たてものが のる マスは ぜんぶ おなじ part・anchor・scale を もつ。1マスの ものには anchor が ない。
 */
export type Tile = { readonly ground: Ground; readonly part: TilePart | null; readonly anchor?: number; readonly scale?: Scale }
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

export const GRASS: Tile = { ground: 'grass', part: null }

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

/** その マスの たてものの おおきさ（ちいさい ときは 1）。 */
export function scaleOf(tile: Tile | undefined): Scale {
  return tile?.scale ?? 1
}

/** anchor（ひだりうえ）から part を scale ばいで おいた ときの マスの ばんごう。ちずから はみでる ときは null。 */
export function footprintOf(anchor: number, part: BuildingId, scale: Scale = 1): number[] | null {
  const [cols, rows] = spanOf(part, scale)
  const col = colOf(anchor)
  const row = rowOf(anchor)
  if (anchor < 0 || anchor >= COLS * ROWS || col + cols > COLS || row + rows > ROWS) return null
  const cells: number[] = []
  for (let dy = 0; dy < rows; dy += 1) for (let dx = 0; dx < cols; dx += 1) cells.push((row + dy) * COLS + col + dx)
  return cells
}

/** タップした マスを ひだりうえに して、ちずに おさまるよう ずらした anchor。 */
export function anchorFor(index: number, part: BuildingId, scale: Scale = 1): number {
  const [cols, rows] = spanOf(part, scale)
  const col = Math.max(0, Math.min(colOf(index), COLS - cols))
  const row = Math.max(0, Math.min(rowOf(index), ROWS - rows))
  return row * COLS + col
}

/** その マスの たてものが のって いる マス ぜんぶ（1マスの ものは そのマス だけ）。 */
export function buildingCells(town: Town, index: number): number[] {
  const tile = town[index]
  if (tile?.anchor === undefined || !isBuilding(tile.part)) return [index]
  return footprintOf(tile.anchor, tile.part, scaleOf(tile)) ?? [index]
}

/** となりに みち（ふみきりを ふくむ）が あるか。おおきな たてものは どこかの マスが つながれば よい。 */
export function isConnected(town: Town, index: number): boolean {
  return buildingCells(town, index).some((cell) => roadMask(town, cell) !== 0)
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

/** おおきな たてものを まるごと どけて くさはらに する（copy を かきかえる）。 */
function clearLarge(copy: Tile[], index: number): void {
  for (const cell of buildingCells(copy, index)) copy[cell] = GRASS
}

function placeLarge(town: Town, index: number, part: BuildingId, scale: Scale): Town {
  // おなじ たてものを おなじ おおきさで タップしても うごかさない。
  const tile = town[index]
  if (tile.part === part && tile.anchor !== undefined && scaleOf(tile) === scale) return town
  const anchor = anchorFor(index, part, scale)
  const cells = footprintOf(anchor, part, scale)
  if (!cells) return town
  // かさなる ものは うわがき。ほかの おおきな たてものに かかれば それも まるごと どける。
  const copy = town.slice()
  for (const cell of cells) if (copy[cell].anchor !== undefined) clearLarge(copy, cell)
  const placed: Tile = scale > 1 ? { ground: 'grass', part, anchor, scale } : { ground: 'grass', part, anchor }
  for (const cell of cells) copy[cell] = placed
  return copy
}

/**
 * どうぐを つかった あとの まち。かわらない ときは おなじ town を かえす。
 * scale は たてものを おく ときの おおきさ（えらべない どうぐや おおきさでは えらべる いちばん ちかい もの）。
 */
export function applyTool(town: Town, index: number, tool: ToolId, scale: Scale = 1): Town {
  const tile = town[index]
  if (!tile) return town
  const fitted = fitScale(tool, scale)
  if (isLarge(tool, fitted)) return placeLarge(town, index, tool, fitted)
  if (tile.anchor !== undefined) {
    // おおきな たてものの うえに ほかの ものを おく・けす ときは、まず まるごと どける。
    const copy = town.slice()
    clearLarge(copy, index)
    if (tool !== 'erase') copy[index] = placeTile(copy[index], tool)
    return copy
  }
  const next = placeTile(tile, tool)
  if (next === tile) return town
  const copy = town.slice()
  copy[index] = next
  return copy
}

export function residentsAt(town: Town, index: number): number {
  const tile = town[index]
  const part = tile?.part ?? null
  if (!isBuilding(part)) return 0
  // おおきな たてものは ひだりうえの マスで 1かい だけ かぞえる。おおきく おくと つかう マスの かずの ぶん すめる。
  if (tile.anchor !== undefined && tile.anchor !== index) return 0
  const residents = (findPart(part)?.residents ?? 0) * scaleOf(tile) ** 2
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

// ---- ほぞんの かたち ---------------------------------------------------------
// マスは「g」「w:road」「g:stadium:31」「g:house:31:2」のように じめん・もの・ひだりうえの ばんごう・おおきさ を ならべる。
// version 1 は おおきさの ない ふるい かたち。よみこみ だけ できる。

type SavedTown = { version: 1 | 2; cols: number; rows: number; tiles: string[] }

const TILE_PARTS = new Set<string>(['road', 'rail', 'crossing'])

function isTilePart(value: string): value is TilePart {
  if (TILE_PARTS.has(value)) return true
  const part = findPart(value)
  return part !== undefined && part.id !== 'water' && part.id !== 'road' && part.id !== 'rail'
}

export function encodeTile(tile: Tile): string {
  let text = tile.ground === 'water' ? 'w' : 'g'
  if (tile.part) text += `:${tile.part}`
  if (tile.anchor !== undefined) text += `:${tile.anchor}`
  if (tile.scale !== undefined && tile.scale > 1) text += `:${tile.scale}`
  return text
}

export function encodeTown(town: Town): string {
  const saved: SavedTown = { version: 2, cols: COLS, rows: ROWS, tiles: town.map(encodeTile) }
  return JSON.stringify(saved)
}

function decodeTile(value: unknown, version: 1 | 2): Tile | null {
  if (typeof value !== 'string') return null
  const [ground, part, anchor, scaleText, ...rest] = value.split(':')
  if (rest.length || (ground !== 'g' && ground !== 'w')) return null
  if (part === undefined) return ground === 'w' ? { ground: 'water', part: null } : GRASS
  if (!isTilePart(part)) return null
  if (ground === 'w' && isBuilding(part)) return null
  let scale: Scale = 1
  if (scaleText !== undefined) {
    // おおきさは 2 か 3 だけ かく（ちいさい ときは かかない）。
    if (version === 1 || (scaleText !== '2' && scaleText !== '3')) return null
    scale = Number(scaleText) as Scale
    if (!isBuilding(part) || !scalesOf(part).includes(scale)) return null
  }
  // 2マス いじょうの たてものには anchor が かならず いる。1マスの ものには いらない。
  if (isLarge(part, scale) !== (anchor !== undefined)) return null
  if (anchor === undefined) return { ground: ground === 'w' ? 'water' : 'grass', part }
  if (!/^\d+$/.test(anchor)) return null
  return scale > 1 ? { ground: 'grass', part, anchor: Number(anchor), scale } : { ground: 'grass', part, anchor: Number(anchor) }
}

/** おおきな たてものの マスが そろって いるか（かけたり ずれたり して いない）。 */
function largeBuildingsFit(tiles: readonly Tile[]): boolean {
  return tiles.every((tile, index) => {
    if (tile.anchor === undefined || !isBuilding(tile.part)) return true
    const cells = footprintOf(tile.anchor, tile.part, scaleOf(tile))
    return cells !== null && cells.includes(index)
      && cells.every((cell) => tiles[cell].part === tile.part && tiles[cell].anchor === tile.anchor && scaleOf(tiles[cell]) === scaleOf(tile))
  })
}

/** こわれた データや ちがう おおきさの データは null（その ちずの さいしょの まちで あそぶ）。 */
export function decodeTown(raw: string | null): Town | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const saved = data as Partial<SavedTown>
  if ((saved.version !== 1 && saved.version !== 2) || saved.cols !== COLS || saved.rows !== ROWS || !Array.isArray(saved.tiles)) return null
  if (saved.tiles.length !== COLS * ROWS) return null
  const tiles: Tile[] = []
  for (const value of saved.tiles) {
    const tile = decodeTile(value, saved.version)
    if (!tile) return null
    tiles.push(tile)
  }
  return largeBuildingsFit(tiles) ? tiles : null
}
