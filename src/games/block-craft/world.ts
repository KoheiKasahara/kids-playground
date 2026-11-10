export const DEFAULT_WORLD = { size: 16, height: 12 }
export const MAX_WORLD = { size: 128, height: 64 }
export type Dimensions = { readonly size: number; readonly height: number }

export type WoolColor = 'white' | 'pink' | 'yellow' | 'blue'
export type MaterialDef = {
  id: string; label: string; color: string; emoji: string
  opacity?: number; glow?: boolean; falls?: boolean
  /** くさばなのように ちいさく、とおりぬけられる。 */
  plant?: boolean
  /** くさばなの たかさ（ブロック 1つぶんが 1）。 */
  height?: number
  /** パレットには ださない（はたけや そだつ とちゅうの さくもつ）。ながおしでは pickAs を えらぶ。 */
  hidden?: boolean
  pickAs?: string
  /** ひつじの けを とると つかえる けいと。 */
  wool?: WoolColor
}
export const MATERIALS = [
  { id: 'grass', label: 'くさ', color: '#78ba50', emoji: '🌱' },
  { id: 'dirt', label: 'つち', color: '#ae7950', emoji: '🟫' },
  { id: 'stone', label: 'いし', color: '#9da9b5', emoji: '🪨' },
  { id: 'wood', label: 'き', color: '#bf894c', emoji: '🪵' },
  { id: 'leaf', label: 'はっぱ', color: '#398d56', emoji: '🌳' },
  { id: 'sand', label: 'すな', color: '#efd58d', emoji: '🏖️', falls: true },
  { id: 'brick', label: 'れんが', color: '#d46e59', emoji: '🧱' },
  { id: 'water', label: 'みず', color: '#53b9e4', emoji: '💧' },
  { id: 'plank', label: 'いた', color: '#e0b46c', emoji: '🪚' },
  { id: 'glass', label: 'ガラス', color: '#d9f4ff', emoji: '🪟', opacity: 0.4 },
  { id: 'snow', label: 'ゆき', color: '#f7fbff', emoji: '❄️' },
  { id: 'cactus', label: 'サボテン', color: '#4f9a3c', emoji: '🌵' },
  { id: 'pumpkin', label: 'かぼちゃ', color: '#ef8a1f', emoji: '🎃' },
  { id: 'lamp', label: 'ひかり', color: '#ffd84d', emoji: '💡', glow: true },
  { id: 'gold', label: 'きん', color: '#f4c430', emoji: '🪙' },
  { id: 'diamond', label: 'ダイヤ', color: '#5ee3e0', emoji: '💎' },
  { id: 'sapling', label: 'なえぎ', color: '#5fae3e', emoji: '🌿', plant: true },
  { id: 'flower', label: 'はな', color: '#f06fa4', emoji: '🌷', plant: true },
  { id: 'lava', label: 'ようがん', color: '#ff6a1a', emoji: '🌋', glow: true },
  { id: 'obsidian', label: 'くろいし', color: '#3d3150', emoji: '⬛' },
  { id: 'ice', label: 'こおり', color: '#a9dcf6', emoji: '🧊', opacity: 0.8 },
  { id: 'sandstone', label: 'さばくいし', color: '#e2c07e', emoji: '🏜️' },
  { id: 'seed', label: 'たね', color: '#9cc25a', emoji: '🌾', plant: true, height: 0.25 },
  { id: 'mushroom', label: 'きのこ', color: '#dc4a3c', emoji: '🍄', plant: true, height: 0.45 },
  { id: 'coral', label: 'さんご', color: '#ff7f8f', emoji: '🪸' },
  { id: 'shell', label: 'かいがら', color: '#fbe0cc', emoji: '🐚', plant: true, height: 0.3 },
  { id: 'wool_white', label: 'しろ', color: '#f4f1ea', emoji: '🧶', wool: 'white' },
  { id: 'wool_pink', label: 'ピンク', color: '#f5a8c8', emoji: '🧶', wool: 'pink' },
  { id: 'wool_yellow', label: 'きいろ', color: '#f3d75e', emoji: '🧶', wool: 'yellow' },
  { id: 'wool_blue', label: 'みずいろ', color: '#8fcdf2', emoji: '🧶', wool: 'blue' },
  { id: 'sprout', label: 'め', color: '#79c94c', emoji: '🌱', plant: true, height: 0.5, hidden: true, pickAs: 'seed' },
  { id: 'wheat', label: 'こむぎ', color: '#e8c25a', emoji: '🌾', plant: true, height: 0.85, hidden: true, pickAs: 'seed' },
  { id: 'farmland', label: 'はたけ', color: '#7b5233', emoji: '🟫', hidden: true, pickAs: 'dirt' },
] as const satisfies readonly MaterialDef[]
export const MATERIAL_DEFS: readonly MaterialDef[] = MATERIALS
export type Material = typeof MATERIALS[number]['id']
export type Position = { x: number; y: number; z: number }
export type Block = Position & { material: Material }
export const key = ({ x, y, z }: Position) => `${x},${y},${z}`
const ids = [undefined, ...MATERIALS.map(m => m.id)]
const codes = new Map<string, number>(MATERIALS.map((m, index) => [m.id, index + 1]))
export const materialCode = (id: unknown) => typeof id === 'string' ? codes.get(id) ?? 0 : 0
export const materialId = (code: number) => ids[code]
export const materialDef = (id: Material): MaterialDef => MATERIAL_DEFS[materialCode(id) - 1]
export const definitionAt = (code: number) => MATERIAL_DEFS[code - 1]

export function validDimensions({ size, height }: Dimensions) {
  return Number.isInteger(size) && size >= DEFAULT_WORLD.size && size <= MAX_WORLD.size
    && Number.isInteger(height) && height >= DEFAULT_WORLD.height && height <= MAX_WORLD.height
}

export function inside({ size, height }: Dimensions, { x, y, z }: Position) {
  return Number.isInteger(x) && x >= 0 && x < size && Number.isInteger(z) && z >= 0 && z < size
    && Number.isInteger(y) && y >= 0 && y < height
}

/** パレットに ならぶ ブロック（けいとは ひつじの けを とるまで「？」）。 */
export const PALETTE = MATERIALS.filter(m => !('hidden' in m))
/** ながおしで えらぶ ざいりょう（そだつ とちゅうの さくもつは たね、はたけは つち）。 */
export const pickAs = (id: Material): Material => (materialDef(id).pickAs ?? id) as Material
export const woolMaterial = (color: WoolColor): Material => MATERIALS.find(m => 'wool' in m && m.wool === color)!.id
/** たね → め → こむぎ。タッチするたびに そだち、こむぎは とれて また たねに なる。 */
export const CROP_STAGES = ['seed', 'sprout', 'wheat'] as const satisfies readonly Material[]
export const isCrop = (material: Material) => (CROP_STAGES as readonly Material[]).includes(material)
/** たねを うえられる じめん（うえると はたけに なる）。 */
const TILLABLE: readonly Material[] = ['dirt', 'grass', 'farmland']

/** Scale landmarks from the original meadow coordinates. */
export const landmark = (coordinate: number, size: number) => Math.round(coordinate * (size - 1) / (DEFAULT_WORLD.size - 1))

export const TREASURES: readonly Block[] = ([
  [4, 9, 'diamond'], [11, 14, 'diamond'], [7, 4, 'diamond'],
  [2, 13, 'gold'], [9, 10, 'gold'], [14, 9, 'gold'], [5, 5, 'gold'],
] as const).map(([x, z, material]) => ({ x, y: 1, z, material }))

const treasuresFor = (size: number) => TREASURES.map(t => ({ ...t, x: landmark(t.x, size), z: landmark(t.z, size) }))
export const treasureColumns = (size: number) => new Map(treasuresFor(size).map(t => [t.x + t.z * size, t.material]))

export function flatColumn(x: number, z: number, shore = 2, treasure: Material | null | undefined = TREASURES.find(t => t.x === x && t.z === z)?.material): Block[] {
  return [
    { x, y: 0, z, material: 'stone' },
    { x, y: 1, z, material: z <= shore ? 'sand' : treasure ?? 'dirt' },
    { x, y: 2, z, material: z < shore ? 'water' : z === shore ? 'sand' : 'grass' },
  ]
}

export function createWorld(dimensions = DEFAULT_WORLD): World {
  const { size } = dimensions
  const blocks: Block[] = []
  const at = (n: number) => landmark(n, size)
  const treasures = treasureColumns(size)
  const hillX = at(12), hillZ = at(6)
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
    const column = flatColumn(x, z, at(2), treasures.get(x + z * size) ?? null)
    const rise = Math.max(0, 3 - Math.max(Math.abs(x - hillX), Math.abs(z - hillZ)))
    if (rise) {
      column[2] = { x, y: 2, z, material: 'dirt' }
      for (let y = 3; y <= 2 + rise; y++) column.push({ x, y, z, material: y === 2 + rise ? (rise === 3 ? 'snow' : 'grass') : 'dirt' })
    }
    blocks.push(...column)
  }
  for (const [x, z] of [[3, 11], [13, 13], [2, 6]]) blocks.push(...treeBlocks({ x: at(x), y: 3, z: at(z) }))
  for (const [x, y, z, material] of [
    [14, 3, 2, 'cactus'], [14, 4, 2, 'cactus'], [7, 3, 12, 'pumpkin'],
    [6, 3, 9, 'flower'], [10, 3, 12, 'flower'], [5, 3, 7, 'sapling'],
  ] as const) blocks.push({ x: at(x), y, z: at(z), material })
  return new World(dimensions, blocks)
}

/** みきが 3だん、そのうえに はっぱ。 */
export function treeBlocks({ x, y, z }: Position): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 3; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) blocks.push({ x: x + dx, y: y + 3, z: z + dz, material: 'leaf' })
  blocks.push({ x, y: y + 4, z, material: 'leaf' })
  return blocks
}

const SIDES = [{ x: 1, y: 0, z: 0 }, { x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -1 }] as const
const AROUND = [...SIDES, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }]
const sand = materialCode('sand')
const water = materialCode('water')
const lava = materialCode('lava')
const snow = materialCode('snow')
const ice = materialCode('ice')
const obsidian = materialCode('obsidian')

export type CellChange = Readonly<Position & { before: number; after: number }>
export type Changes = readonly CellChange[]
type WriteCell = (p: Position, code: number) => void
type ChangeListener = (changes: Changes) => void

/** One mutable grid per game. Edits are synchronous and publish their net changes once. */
export class World implements Dimensions {
  readonly size: number
  readonly height: number
  readonly area: number
  readonly volume: number
  readonly treasures: readonly Block[]
  readonly #cells: Uint8Array
  readonly #tops: Int8Array
  readonly #surfaces: Int8Array
  readonly #treasureByIndex = new Map<number, Block>()
  readonly #missing = new Set<Block>()
  readonly #reactions = new Map<number, number>()
  readonly #falling = new Set<number>()
  readonly #listeners = new Set<ChangeListener>()

  constructor(dimensions: Dimensions, blocks: Iterable<Block> = []) {
    if (!validDimensions(dimensions)) throw new RangeError('Invalid world dimensions')
    this.size = dimensions.size
    this.height = dimensions.height
    this.area = this.size ** 2
    this.volume = this.area * this.height
    this.#cells = new Uint8Array(this.volume)
    this.#tops = new Int8Array(this.area).fill(-1)
    this.#surfaces = new Int8Array(this.area).fill(-1)
    this.treasures = treasuresFor(this.size)
    for (const t of this.treasures) this.#treasureByIndex.set(this.index(t), t)
    for (const block of blocks) {
      const index = this.index(block)
      const code = materialCode(block.material)
      if (index < 0 || !code || this.#cells[index]) throw new RangeError('Invalid or duplicate block')
      this.#cells[index] = code
    }
    // Initial generation and decoding are the only operations that build the indexes from scratch.
    for (let column = 0; column < this.area; column++) this.updateHeight(column)
    for (let i = 0; i < this.volume; i++) {
      const code = this.#cells[i]
      if (code === water || code === ice || code === lava) this.updateReaction(this.position(i))
      if (code === sand) this.updateFalling(i)
    }
    for (const [i, t] of this.#treasureByIndex) if (this.#cells[i] !== materialCode(t.material)) this.#missing.add(t)
  }

  index(p: Position) {
    return inside(this, p) ? p.x + p.z * this.size + p.y * this.area : -1
  }

  position(index: number): Position {
    return { x: index % this.size, y: Math.floor(index / this.area), z: Math.floor(index / this.size) % this.size }
  }

  codeAt(x: number, y: number, z: number) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(z)
      || x < 0 || x >= this.size || z < 0 || z >= this.size || y < 0 || y >= this.height) return 0
    return this.#cells[x + z * this.size + y * this.area] ?? 0
  }

  codeAtIndex(index: number) { return this.#cells[index] ?? 0 }
  materialAt(p: Position) { return materialId(this.codeAtIndex(this.index(p))) }

  *blocks(): IterableIterator<Block> {
    for (let i = 0; i < this.volume; i++) {
      const material = materialId(this.#cells[i])
      if (material) yield { ...this.position(i), material }
    }
  }

  topY(x: number, z: number, surface = false) {
    if (!Number.isInteger(x) || !Number.isInteger(z) || x < 0 || x >= this.size || z < 0 || z >= this.size) return -1
    return (surface ? this.#surfaces : this.#tops)[x + z * this.size] ?? -1
  }

  private updateHeight(column: number) {
    let y = this.height - 1
    while (y >= 0 && !this.codeAtIndex(column + y * this.area)) y--
    this.#tops[column] = y
    while (y >= 0) {
      const code = this.codeAtIndex(column + y * this.area)
      if (code && !definitionAt(code).plant) break
      y--
    }
    this.#surfaces[column] = y
  }

  get foundCount() { return this.#missing.size }
  get stable() { return this.#reactions.size === 0 }
  isFound(treasure: Block) { return this.#missing.has(treasure) }

  discovered(changes: Changes) {
    const found = new Set<Block>()
    for (const change of changes) {
      const t = this.#treasureByIndex.get(this.index(change))
      if (t && change.before === materialCode(t.material) && this.#missing.has(t)) found.add(t)
    }
    return found.size ? this.treasures.filter(t => found.has(t)) : []
  }

  subscribe(listener: ChangeListener) {
    this.#listeners.add(listener)
    return () => { this.#listeners.delete(listener) }
  }

  private updateReaction(p: Position) {
    const index = this.index(p)
    const code = this.codeAtIndex(index)
    if (code !== lava && code !== ice && code !== water) {
      this.#reactions.delete(index)
      return
    }
    const touches = (match: number) => AROUND.some(d => this.codeAt(p.x + d.x, p.y + d.y, p.z + d.z) === match)
    const next = code === lava && (touches(water) || touches(ice)) ? obsidian
      : code === ice && touches(lava) ? water : code === water && touches(snow) ? ice : 0
    if (next) this.#reactions.set(index, next)
    else this.#reactions.delete(index)
  }

  private updateFalling(index: number) {
    if (index >= 2 * this.area && this.codeAtIndex(index) === sand && !this.codeAtIndex(index - this.area)) this.#falling.add(index)
    else this.#falling.delete(index)
  }

  /** Also indexes unstable cells in imported saves, which the old full scan processed on the next edit. */
  change(apply: (write: WriteCell) => void, simulate = false): Changes {
    const before = new Map<number, number>()
    const columns = new Set<number>()
    const write: WriteCell = (p, code) => {
      const index = this.index(p)
      if (index < 0 || code === this.#cells[index]) return
      if (!before.has(index)) before.set(index, this.#cells[index])
      this.#cells[index] = code
      columns.add(index % this.area)
      this.updateReaction(p)
      for (const d of AROUND) this.updateReaction({ x: p.x + d.x, y: p.y + d.y, z: p.z + d.z })
      this.updateFalling(index)
      this.updateFalling(index + this.area)
    }
    apply(write)
    if (simulate && before.size) {
      // Snapshot only the active reactions. Each pass reads one state and applies its changes together.
      for (let pass = 0; pass < 4 && this.#reactions.size; pass++) {
        for (const [index, next] of [...this.#reactions]) write(this.position(index), next)
      }
      const fallingColumns = new Set<number>()
      for (const index of this.#falling) fallingColumns.add(index % this.area)
      for (const column of fallingColumns) {
        let destination = column + this.area
        for (let index = destination; index < this.volume; index += this.area) {
          const code = this.codeAtIndex(index)
          if (!code) continue
          if (code !== sand) destination = index
          else if (destination !== index) {
            write(this.position(index), 0)
            write(this.position(destination), sand)
          }
          destination += this.area
        }
      }
    }
    for (const column of columns) this.updateHeight(column)
    const changes: CellChange[] = []
    for (const [index, previous] of before) {
      const after = this.#cells[index]
      if (previous === after) continue
      const treasure = this.#treasureByIndex.get(index)
      if (treasure) {
        if (after === materialCode(treasure.material)) this.#missing.delete(treasure)
        else this.#missing.add(treasure)
      }
      changes.push({ ...this.position(index), before: previous, after })
    }
    if (changes.length) for (const listener of this.#listeners) listener(changes)
    return changes
  }
}

export function blockAt(world: World, position: Position): Block | undefined {
  const material = world.materialAt(position)
  return material && { ...position, material }
}

export function topBlock(world: World, x: number, z: number): Block {
  return blockAt(world, { x, y: world.topY(x, z), z })!
}

export const surfaceOf = (world: World) => (x: number, z: number) => blockAt(world, { x, y: world.topY(x, z, true), z })
export const isStable = (world: World) => world.stable
export const foundTreasures = (world: World) => world.treasures.filter(t => world.isFound(t))

export function undoChanges(world: World, changes: Changes) {
  world.change(write => { for (const cell of changes) write(cell, cell.before) })
}

export function netMaterialChange(changes: Changes, code: number) {
  return changes.reduce((net, c) => net + Number(c.after === code) - Number(c.before === code), 0)
}

/** みずが よこへ ひろがる マスの かず。 */
export const FLOW_REACH = 3
export const FLOW_LIMIT = 60

function flow(world: World, write: WriteCell, sources: readonly Position[]) {
  const open = (p: Position) => p.y > 0 && inside(world, p) && !world.codeAt(p.x, p.y, p.z)
  const queue = sources.map(p => ({ p, reach: 0 }))
  let added = 0
  const fill = (p: Position, reach: number) => {
    write(p, water)
    queue.push({ p, reach })
    added++
  }
  for (let i = 0; i < queue.length && added < FLOW_LIMIT; i++) {
    const { p, reach } = queue[i]
    const below = { ...p, y: p.y - 1 }
    if (open(below)) { fill(below, 0); continue }
    if (reach >= FLOW_REACH) continue
    for (const side of SIDES) {
      const next = { x: p.x + side.x, y: p.y, z: p.z + side.z }
      if (added < FLOW_LIMIT && open(next)) fill(next, reach + 1)
    }
  }
}

/** 「ひろく」の ときは、さわった めんに そった 3×3 を まとめて おく・こわす。 */
export function brushCells(center: Position, normal: Position, wide: boolean): Position[] {
  if (!wide) return [center]
  const cells = [center]
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue
    if (normal.x) cells.push({ x: center.x, y: center.y + a, z: center.z + b })
    else if (normal.z) cells.push({ x: center.x + a, y: center.y + b, z: center.z })
    else cells.push({ x: center.x + a, y: center.y, z: center.z + b })
  }
  return cells
}

export function editWorld(world: World, target: Position | readonly Position[], material: Material, mode: 'place' | 'remove'): Changes {
  const targets: readonly Position[] = Array.isArray(target) ? target : [target as Position]
  const valid = targets.filter(p => inside(world, p) && p.y > 0)
  const get = (p: Position) => world.codeAt(p.x, p.y, p.z)
  return world.change(write => {
    if (mode === 'remove') {
      const removed = valid.filter(p => get(p))
      const holes = removed.filter(p => get(p) !== water)
      for (const p of removed) write(p, 0)
      const flooded = holes.filter(p => world.codeAt(p.x, p.y + 1, p.z) === water || SIDES.some(s => world.codeAt(p.x + s.x, p.y, p.z + s.z) === water))
      for (const p of flooded) write(p, water)
      flow(world, write, flooded)
      // じめんが なくなった くさばなは いっしょに なくなる
      for (const p of removed) {
        const above = { ...p, y: p.y + 1 }
        if (definitionAt(get(above))?.plant) write(above, 0)
      }
      return
    }
    const code = materialCode(material)
    const placed: Position[] = []
    for (const p of valid) {
      const existing = get(p)
      if (existing && (existing !== water || code === water)) continue
      if (!AROUND.some(d => world.codeAt(p.x + d.x, p.y + d.y, p.z + d.z))) continue
      if (material === 'seed') {
        const ground = { ...p, y: p.y - 1 }
        const soil = world.materialAt(ground)
        if (!soil || !TILLABLE.includes(soil)) continue
        write(ground, materialCode('farmland'))
      }
      write(p, code)
      placed.push(p)
    }
    if (code === water) flow(world, write, placed)
  }, true)
}

/** さくもつを タッチすると 1だん そだち、こむぎは とれて たねに もどる。 */
export function tendCrops(world: World, targets: readonly Position[]) {
  let harvested = 0
  const changes = world.change(write => {
    for (const p of targets) {
      const material = world.materialAt(p)
      if (!material || !isCrop(material)) continue
      const stage = (CROP_STAGES as readonly Material[]).indexOf(material)
      if (material === 'wheat') harvested++
      write(p, materialCode(CROP_STAGES[(stage + 1) % CROP_STAGES.length]))
    }
  })
  return { changes, harvested }
}

/** こわすと とれる こむぎの かず。足場がなくなって消えたものは含めない。 */
export function wheatAt(world: World, targets: readonly Position[]) {
  const wheat = materialCode('wheat')
  return [...new Set(targets.map(p => world.index(p)))].filter(i => world.codeAtIndex(i) === wheat).length
}

export function growTree(world: World, sapling: Position): Changes {
  if (world.materialAt(sapling) !== 'sapling') return []
  const trunk = [1, 2].map(dy => ({ ...sapling, y: sapling.y + dy }))
  if (!trunk.every(p => inside(world, p) && !world.materialAt(p))) return []
  return world.change(write => {
    for (const block of treeBlocks(sapling)) {
      const existing = world.materialAt(block)
      if (!existing || existing === 'sapling') write(block, materialCode(block.material))
    }
  })
}

const solidAt = (world: World, x: number, y: number, z: number) => {
  const code = world.codeAt(x, y, z)
  return code !== 0 && code !== water && !definitionAt(code).plant
}

function fall(world: World, p: Position): Position {
  let y = p.y
  while (y > 1 && !solidAt(world, p.x, y - 1, p.z)) y--
  return { ...p, y }
}

const bodyFree = (world: World, { x, y, z }: Position) => !solidAt(world, x, y, z) && !solidAt(world, x, y + 1, z)

export function settleWalker(world: World, walker: Position): Position {
  let y = walker.y
  while (y < world.height - 1 && !bodyFree(world, { ...walker, y })) y++
  return fall(world, { ...walker, y })
}

export function startWalker(world: World, x: number, z: number): Position {
  return settleWalker(world, { x, y: 1, z })
}

export function walk(world: World, from: Position, dir: { x: number; z: number }): Position {
  const ground = ({ x, y, z }: Position) => world.codeAt(x, y - 1, z)
  const step = (at: Position, climb: boolean): Position | null => {
    const next = { x: at.x + dir.x, y: at.y, z: at.z + dir.z }
    if (!inside(world, next)) return null
    let to: Position | null = null
    if (bodyFree(world, next)) to = fall(world, next)
    else if (climb) {
      const up = { ...next, y: at.y + 1 }
      if (up.y < world.height && !solidAt(world, at.x, at.y + 2, at.z) && bodyFree(world, up)) to = up
    }
    return to && ground(to) !== lava ? to : null
  }
  let at = step(from, true)
  if (!at) return from
  for (let i = 0; i < world.size && ground(at) === ice; i++) {
    const next = step(at, false)
    if (!next) break
    at = next
  }
  return at
}
