import {
  currentPartId, findPart, fitScale, isBuilding, isGroundTool, isLarge, scalesOf, spanOf,
  type BuildingId, type NetworkId, type Scale, type TilePart, type ToolId,
} from './parts'

// まちの ちずの モデル。がめん（React）を もたない じゅんすいな かんすう だけを おく。

/** ちずの おおきさ。まえの 14×14 の まちや ちずは まんなかに おいて よみこむ。 */
export const COLS = 48
export const ROWS = 48

export type Ground = 'grass' | 'water' | 'sand' | 'snow'
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
  { min: 700, icon: '🚀', label: 'みらいの とし' },
  { min: 1500, icon: '👑', label: 'ゆめの おうこく' },
] as const

export const GRASS: Tile = { ground: 'grass', part: null }

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

/** じめん だけの マス（なにも のって いない）。 */
function bare(ground: Ground): Tile {
  return ground === 'grass' ? GRASS : { ground, part: null }
}

/** おおきな たてものを まるごと どけて、じめん だけに する（copy を かきかえる）。 */
function clearLarge(copy: Tile[], index: number): void {
  for (const cell of buildingCells(copy, index)) copy[cell] = bare(copy[cell].ground)
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
  // すな・ゆきの うえは その じめんの まま、みずは うめたてて くさはらに する。
  for (const cell of cells) {
    const ground = copy[cell].ground === 'water' ? 'grass' : copy[cell].ground
    copy[cell] = scale > 1 ? { ground, part, anchor, scale } : { ground, part, anchor }
  }
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

// ---- ちいさい ちずを まんなかに おく ------------------------------------------

/** かけたり ずれたり した おおきな たてものを とりのぞく（ちずを かさねた ときの さかいめ）。 */
function dropBrokenLarge(tiles: Tile[]): void {
  tiles.forEach((tile, index) => {
    if (tile.anchor === undefined || !isBuilding(tile.part)) return
    const cells = footprintOf(tile.anchor, tile.part, scaleOf(tile))
    const intact = cells !== null && cells.includes(index)
      && cells.every((cell) => tiles[cell].part === tile.part && tiles[cell].anchor === tile.anchor && scaleOf(tiles[cell]) === scaleOf(tile))
    if (!intact) tiles[index] = bare(tile.ground)
  })
}

/** cols×rows の ちいさな ちず（anchor は その ちずの ばんごう）を、base の まんなかに おいた まち。 */
export function centerTown(base: Town, tiles: readonly Tile[], cols: number, rows: number): Town {
  if (cols === COLS && rows === ROWS) return tiles
  const town = base.slice()
  const left = Math.floor((COLS - cols) / 2)
  const top = Math.floor((ROWS - rows) / 2)
  const place = (index: number) => (top + Math.floor(index / cols)) * COLS + left + (index % cols)
  tiles.forEach((tile, index) => {
    town[place(index)] = tile.anchor === undefined ? tile : { ...tile, anchor: place(tile.anchor) }
  })
  dropBrokenLarge(town)
  return town
}

// ---- ほぞんの かたち ---------------------------------------------------------
// マスは「g」「w:road」「s:palm」「g:stadium:31」「g:house:31:2」のように じめん・もの・ひだりうえの ばんごう・おおきさ を ならべ、
// おなじ マスが つづく ときは「g*20」のように「*かず」で まとめる。
// よめる かたち:
// - version 1: おおきさを えらべなかった ころ。じめん・もの（と 2マス いじょうの たてものの ひだりうえ）。
// - version 2: ひろい ちずの「*かず」の かたちと、おおきな たてものの「ひだりうえ・おおきさ」の かたちの どちらも。
// - version 3: いまの かたち（ぜんぶ まぜて つかえる）。

type SavedTown = { version: 1 | 2 | 3; cols: number; rows: number; tiles: string[] }

const SAVE_VERSION = 3
const GROUND_CODES: Record<Ground, string> = { grass: 'g', water: 'w', sand: 's', snow: 'n' }
const GROUND_BY_CODE = new Map<string, Ground>(Object.entries(GROUND_CODES).map(([ground, code]) => [code, ground as Ground]))
const TILE_PARTS = new Set<string>(['road', 'rail', 'crossing'])

function isTilePart(value: string): value is TilePart {
  if (TILE_PARTS.has(value)) return true
  const part = findPart(value)
  return part !== undefined && !isGroundTool(part.id) && part.id !== 'road' && part.id !== 'rail'
}

export function encodeTile(tile: Tile): string {
  let text = GROUND_CODES[tile.ground]
  if (tile.part) text += `:${tile.part}`
  if (tile.anchor !== undefined) text += `:${tile.anchor}`
  if (tile.scale !== undefined && tile.scale > 1) text += `:${tile.scale}`
  return text
}

export function encodeTown(town: Town): string {
  const tiles: string[] = []
  let run = 0
  for (let index = 0; index < town.length; index += 1) {
    run += 1
    const code = encodeTile(town[index])
    if (index + 1 < town.length && encodeTile(town[index + 1]) === code) continue
    tiles.push(run > 1 ? `${code}*${run}` : code)
    run = 0
  }
  const saved: SavedTown = { version: SAVE_VERSION, cols: COLS, rows: ROWS, tiles }
  return JSON.stringify(saved)
}

/** 1マスを よむ。anchor は その ほぞんの ちずの ばんごう（count より ちいさい）。 */
function decodeTile(value: string, version: 1 | 2 | 3, count: number): Tile | null {
  const [code, partText, anchor, scaleText, ...rest] = value.split(':')
  const ground = GROUND_BY_CODE.get(code)
  if (rest.length || !ground || (version === 1 && ground !== 'grass' && ground !== 'water')) return null
  if (partText === undefined) return bare(ground)
  const part = currentPartId(partText)
  if (!isTilePart(part)) return null
  if (ground === 'water' && isBuilding(part)) return null
  let scale: Scale = 1
  if (scaleText !== undefined) {
    // おおきさは 2 か 3 だけ かく（ちいさい ときは かかない）。version 1 には おおきさが ない。
    if (version === 1 || (scaleText !== '2' && scaleText !== '3')) return null
    scale = Number(scaleText) as Scale
    if (!isBuilding(part) || !scalesOf(part).includes(scale)) return null
  }
  // 2マス いじょうの たてものには anchor が かならず いる。1マスの ものには いらない。
  if (isLarge(part, scale) !== (anchor !== undefined)) return null
  if (anchor === undefined) return { ground, part }
  if (!/^\d+$/.test(anchor) || Number(anchor) >= count) return null
  return scale > 1 ? { ground, part, anchor: Number(anchor), scale } : { ground, part, anchor: Number(anchor) }
}

function decodeTiles(values: readonly unknown[], count: number, version: 1 | 2 | 3): Tile[] | null {
  const tiles: Tile[] = []
  for (const value of values) {
    if (typeof value !== 'string') return null
    const [code, length, ...rest] = value.split('*')
    if (rest.length || (length !== undefined && (version === 1 || !/^[1-9]\d*$/.test(length)))) return null
    const tile = decodeTile(code, version, count)
    const run = length === undefined ? 1 : Number(length)
    if (!tile || tiles.length + run > count) return null
    for (let n = 0; n < run; n += 1) tiles.push(tile)
  }
  return tiles.length === count ? tiles : null
}

/** おおきな たてものの マスが そろって いるか（かけたり ずれたり して いない）。 */
function largeBuildingsFit(tiles: readonly Tile[], cols: number, rows: number): boolean {
  return tiles.every((tile, index) => {
    if (tile.anchor === undefined || !isBuilding(tile.part)) return true
    const [width, height] = spanOf(tile.part, scaleOf(tile))
    const col = tile.anchor % cols
    const row = Math.floor(tile.anchor / cols)
    if (col + width > cols || row + height > rows) return false
    let inside = false
    for (let dy = 0; dy < height; dy += 1) {
      for (let dx = 0; dx < width; dx += 1) {
        const cell = (row + dy) * cols + col + dx
        const other = tiles[cell]
        if (other.part !== tile.part || other.anchor !== tile.anchor || scaleOf(other) !== scaleOf(tile)) return false
        if (cell === index) inside = true
      }
    }
    return inside
  })
}

/**
 * こわれた データは null（その ちずの さいしょの まちで あそぶ）。
 * ちいさい ちずの データは base（ない ときは くさはら）の まんなかに おく。
 */
export function decodeTown(raw: string | null, base: () => Town = createEmptyTown): Town | null {
  if (!raw) return null
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  if (!data || typeof data !== 'object') return null
  const saved = data as Partial<SavedTown>
  const version = saved.version
  if ((version !== 1 && version !== 2 && version !== 3) || !Array.isArray(saved.tiles)) return null
  const { cols, rows } = saved
  if (!Number.isInteger(cols) || !Number.isInteger(rows) || !cols || !rows || cols < 1 || rows < 1 || cols > COLS || rows > ROWS) return null
  const tiles = decodeTiles(saved.tiles, cols * rows, version)
  if (!tiles || !largeBuildingsFit(tiles, cols, rows)) return null
  return cols === COLS && rows === ROWS ? tiles : centerTown(base(), tiles, cols, rows)
}
