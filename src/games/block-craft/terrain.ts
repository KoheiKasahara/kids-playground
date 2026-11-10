import {
  definitionAt, materialCode, materialId, treasureColumns, treeBlocks, World, type Block, type Dimensions, type Material, type Position,
} from './world'

/** あたらしく つくる せかいの おおきさ。 */
export const NEW_WORLD: Dimensions = { size: 96, height: 32 }
/** みずの たかさ。ひくい りくも おなじ たかさで、みずから あるいて あがれる。 */
export const SEA = 2

/** いつも おなじ ならびに なる らんすう。 */
export function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function lattice(seed: number, x: number, z: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(seed + 1, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** なめらかな でこぼこ（0〜1、まんなかの 0.5 あたりが おおい）。scale が おおきいほど ゆるやか。 */
export function createNoise(seed: number) {
  const smooth = (x: number, z: number, salt: number) => {
    const x0 = Math.floor(x), z0 = Math.floor(z)
    const fx = x - x0, fz = z - z0
    const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz)
    const a = lattice(seed + salt, x0, z0), b = lattice(seed + salt, x0 + 1, z0)
    const c = lattice(seed + salt, x0, z0 + 1), d = lattice(seed + salt, x0 + 1, z0 + 1)
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz
  }
  return (x: number, z: number, scale: number, salt = 0) => {
    let sum = 0, amplitude = 1, total = 0, frequency = 1 / scale
    for (let octave = 0; octave < 3; octave++) {
      sum += smooth(x * frequency, z * frequency, salt * 31 + octave * 101) * amplitude
      total += amplitude
      amplitude /= 2
      frequency *= 2
    }
    return sum / total
  }
}

const WATER = materialCode('water'), LAVA = materialCode('lava'), SNOW = materialCode('snow')
const ICE = materialCode('ice'), SAND = materialCode('sand')
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as const

/** つくりかけの せかい。はみだした ばしょへの かきこみは すてる。 */
export class Draft {
  readonly size: number
  readonly height: number
  readonly #cells: Uint8Array
  readonly #tops: Int16Array

  constructor({ size, height }: Dimensions) {
    this.size = size
    this.height = height
    this.#cells = new Uint8Array(size * size * height)
    this.#tops = new Int16Array(size * size).fill(-1)
  }

  inside(x: number, y: number, z: number) {
    return x >= 0 && x < this.size && z >= 0 && z < this.size && y >= 0 && y < this.height
  }
  code(x: number, y: number, z: number) {
    return this.inside(x, y, z) ? this.#cells[x + z * this.size + y * this.size * this.size] : 0
  }
  at(x: number, y: number, z: number) { return materialId(this.code(x, y, z)) }

  set(x: number, y: number, z: number, material: Material | null) {
    if (!this.inside(x, y, z)) return
    const column = x + z * this.size
    this.#cells[column + y * this.size * this.size] = material ? materialCode(material) : 0
    if (material) this.#tops[column] = Math.max(this.#tops[column], y)
    else if (this.#tops[column] === y) {
      let top = y - 1
      while (top >= 0 && !this.code(x, top, z)) top--
      this.#tops[column] = top
    }
  }
  /** あいている ばしょにだけ おく。 */
  put(x: number, y: number, z: number, material: Material) {
    if (!this.code(x, y, z)) this.set(x, y, z, material)
  }
  fill(x: number, z: number, from: number, to: number, material: Material | null) {
    for (let y = from; y <= to; y++) this.set(x, y, z, material)
  }
  stamp(blocks: readonly Block[]) {
    for (const b of blocks) this.put(b.x, b.y, b.z, b.material)
  }
  /** いちばん うえの ブロックの たかさ（そとは -1）。 */
  top(x: number, z: number) {
    return x >= 0 && x < this.size && z >= 0 && z < this.size ? this.#tops[x + z * this.size] : -1
  }
  topMaterial(x: number, z: number) { return this.at(x, this.top(x, z), z) }

  /** ひとりでに かわる ところを なくす：うく すな、ゆきの そばの みず、みずの そばの ようがん。 */
  settle() {
    const touches = (x: number, y: number, z: number, ...codes: number[]) =>
      NEIGHBORS.some(([dx, dy, dz]) => codes.includes(this.code(x + dx, y + dy, z + dz)))
    const each = (code: number, fix: (x: number, y: number, z: number) => void) => {
      for (let y = 1; y < this.height; y++) for (let z = 0; z < this.size; z++) for (let x = 0; x < this.size; x++) {
        if (this.code(x, y, z) === code) fix(x, y, z)
      }
    }
    each(SAND, (x, y, z) => { if (!this.code(x, y - 1, z)) this.set(x, y, z, 'sandstone') })
    each(WATER, (x, y, z) => { if (touches(x, y, z, SNOW)) this.set(x, y, z, 'ice') })
    each(LAVA, (x, y, z) => { if (touches(x, y, z, WATER, ICE)) this.set(x, y, z, 'obsidian') })
  }

  *blocks(): IterableIterator<Block> {
    const area = this.size * this.size
    for (let i = 0; i < this.#cells.length; i++) {
      const material = materialId(this.#cells[i])
      if (material) yield { x: i % this.size, y: Math.floor(i / area), z: Math.floor(i / this.size) % this.size, material }
    }
  }
}

export type Spot = { x: number; z: number }
/** 1れつの つくり：h が じめんの たかさ、water まで みずを はる。 */
export type Column = { h: number; top: Material; mid?: Material; base?: Material; water?: number; liquid?: Material }
export type Gen = {
  d: Draft
  size: number
  height: number
  /** せかいの まんなか（はじめに いる ばしょ）。 */
  c: number
  rng: () => number
  n: ReturnType<typeof createNoise>
  /** たかさの よゆう（ひくい せかいでは やまを ひくく する）。0〜1。 */
  lift: number
  /** じめんの たかさの じょうげん。 */
  cap: number
  /** 96×96 の ときの かずを、ひろさに あわせる。 */
  count: (base: number) => number
  far: (x: number, z: number) => number
  /** まんなかから はなれた ばしょを えらぶ（near・far は せかいの はんぶんに たいする わりあい）。 */
  spots: (count: number, near: number, far: number, gap?: number) => Spot[]
  /** でたらめな ばしょを count かい ためす（まんなかの すぐ そばは のぞく）。 */
  scatter: (count: number, visit: (x: number, z: number, top: number, material: Material) => void) => void
}
export type Plan = {
  /** まんなかの ひろばの じめん。 */
  homeTop?: Material
  floor?: Material
  /** たからの うえを かくす ざいりょう。 */
  cover?: Material
  shape: (x: number, z: number) => Column
  decorate?: () => void
}

const smoothstep = (t: number) => { const s = Math.max(0, Math.min(1, t)); return s * s * (3 - 2 * s) }

/** ちけいを つくり、かざりを おき、たからを かくして、あんていした せかいに する。 */
export function generate(dimensions: Dimensions, seed: number, plan: (g: Gen) => Plan): World {
  const { size, height } = dimensions
  const d = new Draft(dimensions)
  const rng = seeded(seed * 7919 + 17)
  const c = Math.floor(size / 2)
  const far = (x: number, z: number) => Math.hypot(x - c, z - c)
  const g: Gen = {
    d, size, height, c, rng, far,
    n: createNoise(seed),
    lift: Math.max(0, Math.min(1, (height - 10) / 22)),
    cap: Math.max(2, height - 8),
    count: base => Math.max(1, Math.round(base * size * size / NEW_WORLD.size ** 2)),
    spots(count, near, farthest, gap = 0) {
      const found: Spot[] = []
      const margin = Math.min(4, Math.floor(size / 8))
      for (let tries = 0; tries < count * 40 && found.length < count; tries++) {
        const angle = rng() * Math.PI * 2
        const radius = (near + rng() * (farthest - near)) * size / 2
        const x = Math.round(c + Math.cos(angle) * radius), z = Math.round(c + Math.sin(angle) * radius)
        if (x < margin || z < margin || x >= size - margin || z >= size - margin) continue
        if (found.some(s => Math.hypot(s.x - x, s.z - z) < gap)) continue
        found.push({ x, z })
      }
      return found
    },
    scatter(count, visit) {
      for (let i = 0; i < count; i++) {
        const x = Math.floor(rng() * size), z = Math.floor(rng() * size)
        if (far(x, z) < 4) continue
        const top = d.top(x, z)
        visit(x, z, top, d.at(x, top, z)!)
      }
    },
  }
  const { homeTop, floor = 'stone', cover = 'sand', shape, decorate } = plan(g)
  for (let x = 0; x < size; x++) for (let z = 0; z < size; z++) {
    const column = shape(x, z)
    let { top, water } = column
    let h = column.h
    if (homeTop) {
      // まんなかは たいらな ひろば
      const home = smoothstep((22 - far(x, z)) / 14)
      h += (SEA - h) * home
      if (home > 0.5) { top = homeTop; water = undefined }
    }
    h = Math.max(1, Math.min(g.cap, Math.round(h)))
    d.set(x, 0, z, floor)
    for (let y = 1; y < h; y++) d.set(x, y, z, h - y > 3 ? column.base ?? 'stone' : column.mid ?? 'dirt')
    d.set(x, h, z, top)
    if (water !== undefined) d.fill(x, z, h + 1, water, column.liquid ?? 'water')
  }
  decorate?.()
  for (const [index, material] of treasureColumns(size)) {
    const x = index % size, z = Math.floor(index / size)
    d.set(x, 1, z, material)
    const above = d.code(x, 2, z)
    if (!above || above === WATER || definitionAt(above).plant) d.set(x, 2, z, cover)
  }
  d.settle()
  return new World(dimensions, d.blocks())
}

/* ---- かざり ---- */

const disc = (radius: number, visit: (dx: number, dz: number, distance: number) => void) => {
  const r = Math.ceil(radius)
  for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
    const distance = Math.hypot(dx, dz)
    if (distance <= radius) visit(dx, dz, distance)
  }
}
const square = (half: number, visit: (dx: number, dz: number, ring: number) => void) => {
  for (let dx = -half; dx <= half; dx++) for (let dz = -half; dz <= half; dz++) visit(dx, dz, Math.max(Math.abs(dx), Math.abs(dz)))
}
/** じめんから level まで つちだいを つみ、その うえを あける。 */
function level(d: Draft, x: number, z: number, to: number, material: Material, clear = 7) {
  for (let y = d.top(x, z) + 1; y <= to; y++) d.set(x, y, z, material)
  d.fill(x, z, to + 1, to + clear, null)
}

export function oak(d: Draft, x: number, z: number, big = false) {
  const y = d.top(x, z) + 1
  if (!big) return d.stamp(treeBlocks({ x, y, z }))
  d.fill(x, z, y, y + 4, 'wood')
  for (const [dy, r] of [[3, 2], [4, 2], [5, 1]] as const) square(r, (dx, dz, ring) => {
    if (ring < 2 || Math.abs(dx) !== Math.abs(dz)) d.put(x + dx, y + dy, z + dz, 'leaf')
  })
  d.put(x, y + 6, z, 'leaf')
}

/** もみの き：ほそながい はっぱの うえに ゆき。 */
export function spruceBlocks({ x, y, z }: Position, snowy = true): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 4; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  for (const dy of [2, 3]) for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
    if (dx || dz) blocks.push({ x: x + dx, y: y + dy, z: z + dz, material: 'leaf' })
  }
  blocks.push({ x, y: y + 4, z, material: 'leaf' }, { x, y: y + 5, z, material: snowy ? 'snow' : 'leaf' })
  return blocks
}
export const spruce = (d: Draft, x: number, z: number, snowy = true) => d.stamp(spruceBlocks({ x, y: d.top(x, z) + 1, z }, snowy))

/** やしの き：ながい みきの うえに ひろがる はっぱ。 */
export function palmBlocks({ x, y, z }: Position): Block[] {
  const blocks: Block[] = []
  for (let dy = 0; dy < 4; dy++) blocks.push({ x, y: y + dy, z, material: 'wood' })
  blocks.push({ x, y: y + 4, z, material: 'leaf' })
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    blocks.push({ x: x + dx, y: y + 4, z: z + dz, material: 'leaf' }, { x: x + dx * 2, y: y + 3, z: z + dz * 2, material: 'leaf' })
  }
  return blocks
}
export const palm = (d: Draft, x: number, z: number) => d.stamp(palmBlocks({ x, y: d.top(x, z) + 1, z }))

/** 2×2 の ふとい みきの おおきな き。stairs で みきを まわる かいだんと みはらしだいを つける。 */
export function giantTree(d: Draft, x: number, z: number, tall: number, stairs = false) {
  const ground = Math.min(d.top(x, z), d.top(x + 1, z), d.top(x, z + 1), d.top(x + 1, z + 1))
  for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) d.fill(x + dx, z + dz, ground + 1, ground + tall, 'wood')
  const top = ground + tall
  for (let dy = -3; dy <= 3; dy++) disc(4.6, (dx, dz, distance) => {
    if (Math.hypot(distance, dy * 1.3) <= 4.6) d.put(x + (dx > 0 ? dx + 1 : dx), top + dy, z + (dz > 0 ? dz + 1 : dz), 'leaf')
  })
  if (!stairs) return
  // みきの まわりを 1だんずつ のぼる
  const ring: Spot[] = []
  for (let i = -1; i <= 2; i++) ring.push({ x: x + i, z: z - 1 })
  for (let i = 0; i <= 2; i++) ring.push({ x: x + 2, z: z + i })
  for (let i = 1; i >= -1; i--) ring.push({ x: x + i, z: z + 2 })
  for (let i = 1; i >= 0; i--) ring.push({ x: x - 1, z: z + i })
  const deck = Math.max(2, Math.min(ring.length - 1, tall - 5))
  ring.forEach((cell, step) => {
    // かいだんの うえは あけておき、のこりは みはらしだいの ゆかに する
    const y = ground + 1 + Math.min(step, deck - 1)
    d.fill(cell.x, cell.z, d.top(cell.x, cell.z) + 1, step < deck ? y : ground, 'plank')
    d.fill(cell.x, cell.z, (step < deck ? y : ground) + 1, ground + deck + 2, null)
    if (step >= deck) d.set(cell.x, ground + deck, cell.z, 'plank')
  })
  for (let dx = -2; dx <= 3; dx++) for (let dz = -2; dz <= 3; dz++) {
    if (dx > -2 && dx < 3 && dz > -2 && dz < 3) continue
    d.set(x + dx, ground + deck, z + dz, 'plank')
    d.fill(x + dx, z + dz, ground + deck + 1, ground + deck + 2, null)
  }
  d.set(x - 2, ground + deck + 1, z - 2, 'lamp')
  d.set(x + 3, ground + deck + 1, z + 3, 'lamp')
}

export function giantMushroom(d: Draft, x: number, z: number, tall: number) {
  const ground = d.top(x, z)
  d.fill(x, z, ground + 1, ground + tall, 'plank')
  const radius = tall > 5 ? 3.2 : 2.3
  disc(radius, (dx, dz, distance) => {
    d.put(x + dx, ground + tall + (distance < radius - 1.2 ? 1 : 0), z + dz, 'mushcap')
    if (distance > radius - 1) d.put(x + dx, ground + tall - 1, z + dz, 'mushcap')
  })
}

/** いたの いえ：まど・とびら・あかり・れんがの やね。door は とびらの むき。 */
export function cabin(d: Draft, x: number, z: number, door: Spot = { x: 0, z: 1 }, wall: Material = 'plank', roof: Material = 'brick') {
  const floor = d.top(x, z)
  square(3, (dx, dz) => level(d, x + dx, z + dz, floor, 'stone'))
  square(2, (dx, dz, ring) => {
    d.set(x + dx, floor, z + dz, 'plank')
    if (ring < 2) return
    const entrance = dx === door.x * 2 && dz === door.z * 2
    const window = (dx === 0 || dz === 0) && !entrance
    for (let dy = 1; dy <= 3; dy++) {
      if (entrance && dy < 3) continue
      d.set(x + dx, floor + dy, z + dz, window && dy === 2 ? 'glass' : wall)
    }
  })
  for (let k = 0; k <= 3; k++) square(3 - k, (dx, dz, ring) => { if (ring === 3 - k) d.set(x + dx, floor + 4 + k, z + dz, roof) })
  d.set(x, floor + 4, z, 'lamp')
}

export function lampPost(d: Draft, x: number, z: number) {
  const y = d.top(x, z)
  d.fill(x, z, y + 1, y + 2, 'wood')
  d.set(x, y + 3, z, 'lamp')
}

/** はたけ：すぐ とれる こむぎと そだつ とちゅうの め。 */
export function farm(d: Draft, x: number, z: number, width: number, depth: number, rng: () => number) {
  const ground = d.top(x, z)
  for (let dx = 0; dx < width; dx++) for (let dz = 0; dz < depth; dz++) {
    level(d, x + dx, z + dz, ground - 1, 'dirt', 3)
    d.set(x + dx, ground, z + dz, 'farmland')
    d.set(x + dx, ground + 1, z + dz, rng() < 0.6 ? 'wheat' : 'sprout')
  }
}

/** なかに へやと きんの ある ピラミッド。いりぐちは +z がわ。 */
export function pyramid(d: Draft, x: number, z: number, radius: number, material: Material = 'sandstone') {
  const base = d.top(x, z)
  square(radius, (dx, dz) => level(d, x + dx, z + dz, base, material, radius + 2))
  const room = radius >= 5
  for (let k = 0; k <= radius; k++) square(radius - k, (dx, dz, ring) => {
    const inRoom = room && k < 3 && ring <= 2
    const inTunnel = room && k < 2 && dx === 0 && dz > 2
    if (!inRoom && !inTunnel) d.set(x + dx, base + 1 + k, z + dz, material)
  })
  d.set(x, base + radius + 1, z, 'gold')
  if (!room) return
  for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) d.set(x + dx, base + 1, z + dz, 'gold')
  d.set(x, base + 3, z, 'lamp')
}

/** ようがんの ふきだす やま。ながれる ようがんの すじも つける。 */
export function volcano(d: Draft, x: number, z: number, radius: number, tall: number, rng: () => number) {
  const base = Math.max(SEA, d.top(x, z))
  const crater = Math.min(2.4, radius / 3)
  disc(radius, (dx, dz, distance) => {
    const rim = distance < crater
    const peak = base + Math.round((1 - Math.max(distance, crater) / radius) * tall) - (rim ? 1 : 0)
    for (let y = d.top(x + dx, z + dz) + 1; y <= peak; y++) d.set(x + dx, y, z + dz, rng() < 0.12 ? 'obsidian' : 'stone')
    if (rim) d.set(x + dx, d.top(x + dx, z + dz), z + dz, 'lava')
  })
  for (let stream = 0; stream < 3; stream++) {
    const angle = rng() * Math.PI * 2
    for (let r = crater; r < radius - 1; r += 0.6) {
      const sx = Math.round(x + Math.cos(angle + Math.sin(r / 3) * 0.25) * r), sz = Math.round(z + Math.sin(angle + Math.sin(r / 3) * 0.25) * r)
      const top = d.top(sx, sz)
      if (top > SEA) d.set(sx, top, sz, 'lava')
    }
  }
}

/** ゆきの ドーム。なかに あかり。 */
export function igloo(d: Draft, x: number, z: number) {
  const ground = d.top(x, z)
  disc(3.6, (dx, dz) => level(d, x + dx, z + dz, ground, 'snow', 5))
  for (let dy = 1; dy <= 4; dy++) disc(3.4, (dx, dz) => {
    const r = Math.hypot(dx, dz, dy - 1)
    const entrance = dx === 0 && dz > 1 && dy <= 2
    if (r > 2.4 && r <= 3.5 && !entrance) d.set(x + dx, ground + dy, z + dz, 'snow')
  })
  d.set(x, ground + 3, z, 'lamp')
}

export function snowman(d: Draft, x: number, z: number) {
  const y = d.top(x, z)
  d.fill(x, z, y + 1, y + 2, 'snow')
  d.set(x, y + 3, z, 'pumpkin')
}

/** みずに うかぶ いたの ふね。 */
export function ship(d: Draft, x: number, z: number) {
  for (let dx = -4; dx <= 4; dx++) {
    const half = Math.abs(dx) === 4 ? 0 : Math.abs(dx) === 3 ? 1 : 2
    for (let dz = -half; dz <= half; dz++) {
      d.set(x + dx, SEA, z + dz, 'plank')
      d.fill(x + dx, z + dz, SEA + 1, SEA + 7, null)
      if (Math.abs(dz) === half || Math.abs(dx) === 3) d.set(x + dx, SEA + 1, z + dz, 'plank')
    }
  }
  d.set(x + 4, SEA + 1, z, 'plank')
  d.fill(x, z, SEA + 1, SEA + 6, 'wood')
  for (let dy = 3; dy <= 5; dy++) for (let dz = -2; dz <= 2; dz++) if (dz) d.set(x, SEA + dy, z + dz, 'cloud')
  d.set(x, SEA + 7, z, 'brick')
  d.set(x - 3, SEA + 2, z, 'lamp')
}

/** しろと あかの しまの とうだい。 */
export function lighthouse(d: Draft, x: number, z: number) {
  const ground = d.top(x, z)
  for (let dy = 1; dy <= 8; dy++) square(1, (dx, dz, ring) => {
    if (ring === 1 && !(dy <= 2 && dx === 0 && dz === 1)) d.set(x + dx, ground + dy, z + dz, Math.floor((dy - 1) / 2) % 2 ? 'brick' : 'cloud')
  })
  square(2, (dx, dz) => d.set(x + dx, ground + 9, z + dz, 'stonebrick'))
  d.set(x, ground + 10, z, 'lamp')
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) d.set(x + dx, ground + 10, z + dz, 'glass')
  square(1, (dx, dz) => d.set(x + dx, ground + 11, z + dz, 'brick'))
}

/** まんなかが たかい、とがった はしらの あつまり。 */
export function spires(d: Draft, x: number, z: number, material: Material, tall: number, rng: () => number) {
  d.fill(x, z, d.top(x, z) + 1, d.top(x, z) + tall, material)
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]] as const) {
    const h = Math.floor(rng() * tall * 0.7)
    if (h) d.fill(x + dx, z + dz, d.top(x + dx, z + dz) + 1, d.top(x + dx, z + dz) + h, material)
  }
}

export function arch(d: Draft, x: number, z: number, material: Material, alongX = true) {
  const ground = Math.max(d.top(x, z), d.top(x + (alongX ? 4 : 0), z + (alongX ? 0 : 4)))
  for (let i = 0; i <= 4; i++) {
    const px = x + (alongX ? i : 0), pz = z + (alongX ? 0 : i)
    if (i === 0 || i === 4) d.fill(px, pz, d.top(px, pz) + 1, ground + 4, material)
    else d.fill(px, pz, ground + 5, ground + 7, null)
    d.set(px, ground + 5, pz, material)
  }
}

/** くずれた いしの とう。なかに あかり。 */
export function ruin(d: Draft, x: number, z: number, rng: () => number) {
  const ground = d.top(x, z)
  square(2, (dx, dz, ring) => {
    level(d, x + dx, z + dz, ground, 'stonebrick', 0)
    if (ring !== 2 || (dx === 0 && dz === 2)) return
    const tall = 2 + Math.floor(rng() * 4)
    d.fill(x + dx, z + dz, ground + 1, ground + tall, 'stonebrick')
  })
  d.set(x, ground + 1, z, 'lamp')
}

/** おほりと はねばしの ある おしろ。もんは +z がわ。じめんは たいらに しておく。 */
export function castle(d: Draft, x: number, z: number) {
  const ground = d.top(x, z)
  const wall = 8
  square(wall, (dx, dz, ring) => {
    if (ring !== wall) return
    const gate = dz === wall && Math.abs(dx) <= 1
    for (let dy = 1; dy <= 4; dy++) if (!gate || dy === 4) d.set(x + dx, ground + dy, z + dz, 'stonebrick')
    if ((dx + dz) % 2 === 0) d.set(x + dx, ground + 5, z + dz, 'stonebrick')
  })
  for (const [cx, cz] of [[-wall, -wall], [wall, -wall], [-wall, wall], [wall, wall]] as const) {
    square(1, (dx, dz, ring) => {
      d.fill(x + cx + dx, z + cz + dz, ground + 1, ground + 7, 'stonebrick')
      if (ring === 1 && (dx + dz) % 2 === 0) d.set(x + cx + dx, ground + 8, z + cz + dz, 'brick')
    })
    d.set(x + cx, ground + 8, z + cz, 'lamp')
  }
  // まんなかの やかた
  square(3, (dx, dz, ring) => {
    d.set(x + dx, ground, z + dz, 'plank')
    d.set(x + dx, ground + 7, z + dz, 'plank')
    if (ring !== 3) return
    const door = dx === 0 && dz === 3
    for (let dy = 1; dy <= 6; dy++) {
      if (door && dy <= 2) continue
      const window = (dx === 0 || dz === 0) && (dy === 3 || dy === 5)
      d.set(x + dx, ground + dy, z + dz, window ? 'glass' : 'stonebrick')
    }
    if ((dx + dz) % 2 === 0) d.set(x + dx, ground + 8, z + dz, 'stonebrick')
  })
  d.set(x, ground + 6, z, 'lamp')
  d.set(x, ground + 1, z - 2, 'gold')
  d.fill(x, z, ground + 8, ground + 11, 'wood')
  for (const dx of [1, 2]) d.fill(x + dx, z, ground + 10, ground + 11, 'brick')
}
