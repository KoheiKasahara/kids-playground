import type { BuildingId, NetworkId, TilePart } from './parts'
import { COLS, ROWS, type Ground, type Tile, type Town } from './town'

// はじめの せかいを つくる。たね（seed）が おなじなら おなじ せかい、ちがえば ちがう かたちに なる。
// どの せかいも ちずの まんなかに ちいさな むらと、でんしゃが まわる せんろの わと えきが あり、
// とおくに みつけて うれしい ものを かくして おく。まっさらな ちずは maps.ts が もつ。

export type WorldId = 'river' | 'island' | 'forest' | 'city' | 'rail' | 'castle' | 'snow' | 'desert'

export const WORLDS: readonly { id: WorldId; icon: string; label: string }[] = [
  { id: 'river', icon: '🏞️', label: 'かわの まち' },
  { id: 'island', icon: '🏝️', label: 'しまの くに' },
  { id: 'forest', icon: '🌲', label: 'もりの むら' },
  { id: 'city', icon: '🏙️', label: 'おおきな まち' },
  { id: 'rail', icon: '🚃', label: 'でんしゃの まち' },
  { id: 'castle', icon: '🏰', label: 'おしろの くに' },
  { id: 'snow', icon: '⛄', label: 'ゆきの くに' },
  { id: 'desert', icon: '🐫', label: 'さばくの オアシス' },
]

/** えらぶ カードの みほんと、はじめて あそぶ ときの たね。 */
export const STARTER_SEED = 2026

type Random = () => number

const C = Math.floor(COLS / 2)
const R = Math.floor(ROWS / 2)
const NATURE = new Set<TilePart>(['tree', 'sakura', 'pine', 'palm', 'cactus', 'flowers'])

function randomOf(seed: number): Random {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const int = (random: Random, low: number, high: number) => low + Math.floor(random() * (high - low + 1))
const pick = <T>(random: Random, items: readonly T[]): T => items[Math.min(items.length - 1, Math.floor(random() * items.length))]

/** なめらかに かわる 0〜1 の でこぼこ。もりや しまの かたちに つかう。 */
function noiseOf(random: Random): (x: number, y: number) => number {
  const size = 16
  const lattice = Array.from({ length: size * size }, random)
  const at = (x: number, y: number) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)]
  const smooth = (t: number) => t * t * (3 - 2 * t)
  return (x, y) => {
    const x0 = Math.floor(x)
    const y0 = Math.floor(y)
    const fx = smooth(x - x0)
    const fy = smooth(y - y0)
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
    return top + (bottom - top) * fy
  }
}

/** つくりかけの ちず。 */
class Land {
  private readonly ground: Ground[]
  private readonly part: (TilePart | null)[] = new Array<TilePart | null>(COLS * ROWS).fill(null)

  constructor(ground: Ground) {
    this.ground = new Array<Ground>(COLS * ROWS).fill(ground)
  }

  inside(c: number, r: number): boolean {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS
  }

  groundAt(c: number, r: number): Ground | null {
    return this.inside(c, r) ? this.ground[r * COLS + c] : null
  }

  partAt(c: number, r: number): TilePart | null {
    return this.inside(c, r) ? this.part[r * COLS + c] : null
  }

  /** なにも ない りくの マスか。 */
  isOpen(c: number, r: number): boolean {
    return this.inside(c, r) && this.ground[r * COLS + c] !== 'water' && this.part[r * COLS + c] === null
  }

  paint(c: number, r: number, ground: Ground): void {
    if (!this.inside(c, r)) return
    const index = r * COLS + c
    this.ground[index] = ground
    const part = this.part[index]
    if (ground === 'water' && part !== 'road' && part !== 'rail' && part !== 'crossing') this.part[index] = null
  }

  /** いびつな まるに じめんを ぬる。 */
  blob(random: Random, c: number, r: number, radius: number, ground: Ground): void {
    const wobble = noiseOf(random)
    const reach = Math.ceil(radius + 1)
    for (let y = r - reach; y <= r + reach; y += 1) {
      for (let x = c - reach; x <= c + reach; x += 1) {
        if (Math.hypot(x - c, y - r) <= radius + (wobble(x / 2, y / 2) - 0.5) * 1.6) this.paint(x, y, ground)
      }
    }
  }

  /** たてもの・しぜんを おく。みずの うえ、みち・せんろ、ほかの たてものの うえには おかない。 */
  put(c: number, r: number, part: BuildingId): boolean {
    if (!this.inside(c, r)) return false
    const index = r * COLS + c
    const current = this.part[index]
    if (this.ground[index] === 'water' || (current !== null && !NATURE.has(current))) return false
    this.part[index] = part
    return true
  }

  /** だいじな たてものを、みちや ほかの たてものの うえでも おく（みずの うえ いがい）。 */
  replace(c: number, r: number, part: BuildingId): void {
    if (this.inside(c, r) && this.ground[r * COLS + c] !== 'water') this.part[r * COLS + c] = part
  }

  /** みち・せんろを ひく。かさなると ふみきり、みずの うえは はしに なる。 */
  way(kind: NetworkId, c: number, r: number): void {
    if (!this.inside(c, r)) return
    const index = r * COLS + c
    const current = this.part[index]
    if (current === kind || current === 'crossing') return
    this.part[index] = current === 'road' || current === 'rail' ? 'crossing' : kind
  }

  /** よこに すすんでから たてに すすむ せん。 */
  line(kind: NetworkId, c0: number, r0: number, c1: number, r1: number): void {
    for (let c = Math.min(c0, c1); c <= Math.max(c0, c1); c += 1) this.way(kind, c, r0)
    for (let r = Math.min(r0, r1); r <= Math.max(r0, r1); r += 1) this.way(kind, c1, r)
  }

  /** まるの なかの き・はなを かたづけて ひろばに する。 */
  clear(c: number, r: number, radius: number): void {
    this.each((x, y) => {
      const part = this.part[y * COLS + x]
      if (part !== null && NATURE.has(part) && Math.hypot(x - c, y - r) <= radius) this.part[y * COLS + x] = null
    })
  }

  each(visit: (c: number, r: number) => void): void {
    for (let r = 0; r < ROWS; r += 1) for (let c = 0; c < COLS; c += 1) visit(c, r)
  }

  toTown(): Town {
    const cache = new Map<string, Tile>()
    return this.ground.map((ground, index) => {
      const part = this.part[index]
      const key = `${ground}:${part}`
      let tile = cache.get(key)
      if (!tile) {
        tile = { ground, part }
        cache.set(key, tile)
      }
      return tile
    })
  }
}

/** うねうね ながれる かわ。start は はじめの れつ（よこむきなら ぎょう）、low より てまえには ながれない。 */
function river(land: Land, random: Random, start: number, width: number, vertical = true, low = 2): void {
  const length = vertical ? ROWS : COLS
  const limit = (vertical ? COLS : ROWS) - width - 2
  let position = start
  let drift = 0
  for (let step = 0; step < length; step += 1) {
    if (random() < 0.4) drift = int(random, -1, 1)
    const next = Math.max(low, Math.min(limit, position + drift))
    // ななめに ずれる ときも きれめが できないよう、まえの いちと つぎの いちの りょうほうを ぬる。
    for (let w = Math.min(position, next); w < Math.max(position, next) + width; w += 1) {
      if (vertical) land.paint(w, step, 'water')
      else land.paint(step, w, 'water')
    }
    position = next
  }
}

/** あいて いる りくの マスに、きまった わりあいで しぜんを おく。 */
function scatter(land: Land, choose: (c: number, r: number, ground: Ground) => BuildingId | null): void {
  land.each((c, r) => {
    if (!land.isOpen(c, r)) return
    const part = choose(c, r, land.groundAt(c, r)!)
    if (part) land.put(c, r, part)
  })
}

function putAll(land: Land, items: readonly (readonly [number, number, BuildingId])[]): void {
  for (const [c, r, part] of items) land.put(c, r, part)
}

/**
 * でんしゃが まわる せんろの わ（しかく）と えき。みちと かさなると ふみきり、みずの うえは はしに なる。
 * えきは ひだりの せんろの すぐ うちがわ、まんなかの よこの みち（R）の うえに おく（みちと せんろの りょうほうに となる）。
 */
function railLoop(land: Land, c0: number, r0: number, c1: number, r1: number): void {
  land.line('rail', c0, r0, c1, r0)
  land.line('rail', c0, r1, c1, r1)
  land.line('rail', c0, r0, c0, r1)
  land.line('rail', c1, r0, c1, r1)
  land.replace(c0 + 1, R - 1, 'station')
}

/** よこの みちと、その りょうがわに ならぶ たてもの。 */
function street(land: Land, random: Random, c0: number, c1: number, r: number, parts: readonly BuildingId[], fill: number): void {
  land.line('road', c0, r, c1, r)
  for (let c = c0; c <= c1; c += 1) {
    for (const side of [-1, 1]) if (random() < fill) land.put(c, r + side, pick(random, parts))
  }
}

// ---- それぞれの せかい ---------------------------------------------------

function riverWorld(random: Random): Land {
  const land = new Land('grass')
  const woods = noiseOf(random)
  const bloom = noiseOf(random)
  river(land, random, int(random, 32, 35), 2)
  land.blob(random, int(random, 8, 13), int(random, 35, 40), 2.4, 'water')
  scatter(land, (c, r) => {
    if (bloom(c / 5, r / 5) > 0.78 && random() < 0.6) return 'sakura'
    if (woods(c / 7, r / 7) > 0.6 && random() < 0.7) return 'tree'
    return random() < 0.012 ? 'flowers' : null
  })
  land.clear(C, R, 6)
  land.line('road', 8, R, 44, R)
  land.line('road', C, R, C, 12)
  railLoop(land, C - 8, R - 6, C + 6, R + 6)
  putAll(land, [
    [C - 4, R - 1, 'house'], [C - 2, R - 1, 'house-blue'], [C - 2, R + 1, 'shop'], [C - 5, R + 1, 'tree'], [C + 3, R + 2, 'flowers'],
    // きたの はたけと ふうしゃ、にしの ふんすい、はしの むこうの おしろ。
    [C + 1, 11, 'farm'], [C + 2, 11, 'farm'], [C + 1, 12, 'farm'], [C + 2, 12, 'farm'], [C + 3, 11, 'windmill'], [C - 1, 12, 'park'],
    [7, R, 'fountain'], [7, R - 1, 'sakura'], [7, R + 1, 'sakura'],
    [45, R, 'castle'], [45, R - 1, 'flowers'], [45, R + 1, 'flowers'],
  ])
  return land
}

function islandWorld(random: Random): Land {
  const land = new Land('water')
  const shape = noiseOf(random)
  const woods = noiseOf(random)
  const isles = [{ c: C, r: R, size: 9 }]
  for (let n = 0; n < 6; n += 1) isles.push({ c: int(random, 7, COLS - 8), r: int(random, 7, ROWS - 8), size: int(random, 4, 6) })
  land.each((c, r) => {
    if (c < 1 || r < 1 || c > COLS - 2 || r > ROWS - 2) return
    const height = Math.max(...isles.map((isle) => 1 - Math.hypot(c - isle.c, r - isle.r) / isle.size)) + (shape(c / 4, r / 4) - 0.5) * 0.45
    if (height > 0.24) land.paint(c, r, 'grass')
    else if (height > 0.06) land.paint(c, r, 'sand')
  })
  scatter(land, (c, r, ground) => {
    if (ground === 'sand') return random() < 0.2 ? 'palm' : null
    if (woods(c / 4, r / 4) > 0.55 && random() < 0.6) return 'tree'
    return random() < 0.04 ? 'flowers' : null
  })
  land.clear(C, R, 4.5)
  land.line('road', C - 5, R, C + 5, R)
  putAll(land, [[C - 3, R - 1, 'house'], [C - 1, R - 1, 'house-blue'], [C + 2, R - 1, 'shop'], [C - 2, R + 1, 'house'], [C + 3, R + 1, 'tent']])
  railLoop(land, C - 6, R - 6, C + 6, R + 6)
  // まんなかの しまの ひがしの はしに とうだい。
  for (let c = C + 12; c > C; c -= 1) {
    if (land.groundAt(c, R - 2) === 'sand' && land.put(c, R - 2, 'lighthouse')) break
  }
  // ほかの しまには たからもの。いちばん とおい しまに おしろ。
  const others = isles.slice(1).sort((a, b) => Math.hypot(b.c - C, b.r - R) - Math.hypot(a.c - C, a.r - R))
  others.forEach((isle, index) => {
    land.paint(isle.c, isle.r, 'grass')
    land.clear(isle.c, isle.r, 1.5)
    land.put(isle.c, isle.r, index === 0 ? 'castle' : pick(random, ['windmill', 'tent', 'fountain', 'lighthouse', 'pyramid'] as const))
  })
  return land
}

function forestWorld(random: Random): Land {
  const land = new Land('grass')
  const woods = noiseOf(random)
  const kind = noiseOf(random)
  const bloom = noiseOf(random)
  river(land, random, int(random, 34, 38), 1, false)
  for (let n = 0; n < 3; n += 1) land.blob(random, int(random, 5, COLS - 6), int(random, 5, ROWS - 6), 1.6 + random() * 1.4, 'water')
  scatter(land, (c, r) => {
    if (bloom(c / 4, r / 4) > 0.8 && random() < 0.7) return 'sakura'
    if (woods(c / 6, r / 6) > 0.36 && random() < 0.82) return kind(c / 5, r / 5) > 0.58 ? 'pine' : 'tree'
    return random() < 0.03 ? 'flowers' : null
  })
  land.clear(C, R, 6)
  land.line('road', 2, R, C + 6, R)
  railLoop(land, C - 8, R - 6, C + 7, R + 6)
  putAll(land, [
    [C - 3, R - 1, 'house'], [C + 1, R - 1, 'house-blue'], [C - 1, R + 1, 'cake'], [C + 3, R + 1, 'tent'], [C + 4, R - 1, 'tent'],
    [C + 5, R - 2, 'windmill'], [C - 5, R + 2, 'farm'], [C - 4, R + 2, 'farm'], [C - 5, R + 3, 'farm'], [C - 4, R + 3, 'farm'], [C + 1, R + 2, 'fountain'],
  ])
  // もりの おくの ひみつの おしろ。
  const hidden = { c: pick(random, [int(random, 6, 12), int(random, COLS - 13, COLS - 7)]), r: int(random, 6, 14) }
  land.blob(random, hidden.c, hidden.r, 2.2, 'grass')
  land.clear(hidden.c, hidden.r, 2.4)
  putAll(land, [[hidden.c, hidden.r, 'castle'], [hidden.c - 1, hidden.r + 1, 'flowers'], [hidden.c + 1, hidden.r + 1, 'flowers'], [hidden.c, hidden.r + 2, 'fountain']])
  return land
}

function cityWorld(random: Random): Land {
  const land = new Land('grass')
  const woods = noiseOf(random)
  const first = 14
  const last = 34
  const step = 5
  // かわは まちの ひがしを ながれ、まちの なかには はいらない。
  river(land, random, int(random, 39, 41), 3, true, last + 3)
  scatter(land, (c, r) => (woods(c / 6, r / 6) > 0.62 && random() < 0.6 ? 'tree' : null))
  for (let line = first; line <= last; line += step) {
    land.line('road', first, line, last, line)
    land.line('road', line, first, line, last)
  }
  land.line('road', 0, R, COLS - 1, R)
  // まちの みなみを でんしゃが ぐるっと まわる（かわの うえは はし）。
  land.line('rail', 2, 37, COLS - 3, 37)
  land.line('rail', 2, 44, COLS - 3, 44)
  land.line('rail', 2, 37, 2, 44)
  land.line('rail', COLS - 3, 37, COLS - 3, 44)
  land.line('road', C, last, C, 40)
  for (let r = first + 1; r < last; r += 1) {
    for (let c = first + 1; c < last; c += 1) {
      const bc = (c - first) % step
      const br = (r - first) % step
      if (bc === 0 || br === 0) continue
      land.clear(c, r, 0)
      const distance = Math.max(Math.abs(c - C), Math.abs(r - R))
      if (bc > 1 && bc < step - 1 && br > 1 && br < step - 1) {
        // みちに めんして いない まんなかは みどりに する。
        land.put(c, r, pick(random, ['tree', 'tree', 'park', 'fountain', 'flowers', 'sakura'] as const))
      } else if (random() < 0.75) {
        if (distance <= 4) land.put(c, r, pick(random, ['tower', 'office', 'office', 'depart', 'shop', 'office'] as const))
        else if (distance <= 8) land.put(c, r, pick(random, ['apartment', 'office', 'shop', 'cake', 'house', 'house-blue', 'tree'] as const))
        else land.put(c, r, pick(random, ['house', 'house-blue', 'shop', 'tree', 'house'] as const))
      }
    }
  }
  const landmarks: readonly (readonly [number, number, BuildingId])[] = [
    [C - 1, R - 1, 'tv-tower'], [C + 1, R + 1, 'depart'], [first + 1, first + 3, 'school'], [first + 6, last - 3, 'hospital'],
    [last - 4, first + 2, 'fire'], [first + 3, last - 1, 'police'], [last - 1, first + 6, 'factory'], [last - 1, first + 7, 'factory'],
    [C + 1, last - 1, 'ferris'], [C - 1, 36, 'station'],
  ]
  for (const [c, r, part] of landmarks) {
    land.clear(c, r, 0)
    if (!land.put(c, r, part)) land.replace(c, r, part)
  }
  street(land, random, 3, first - 2, R, ['house', 'house-blue', 'tree'], 0.5)
  putAll(land, [[44, R - 3, 'farm'], [45, R - 3, 'farm'], [44, R - 2, 'farm'], [45, R - 2, 'farm'], [46, R - 2, 'windmill'], [45, R + 1, 'house']])
  return land
}

function railWorld(random: Random): Land {
  const land = new Land('grass')
  const woods = noiseOf(random)
  const loop = { c0: 7, c1: 40, r0: 9, r1: 38 }
  land.blob(random, int(random, 29, 33), int(random, 14, 18), 3, 'water')
  land.blob(random, int(random, 13, 17), int(random, 29, 33), 2.2, 'water')
  scatter(land, (c, r) => {
    if (woods(c / 6, r / 6) > 0.58 && random() < 0.65) return random() < 0.2 ? 'sakura' : 'tree'
    return random() < 0.015 ? 'flowers' : null
  })
  land.line('rail', loop.c0, loop.r0, loop.c1, loop.r0)
  land.line('rail', loop.c0, loop.r1, loop.c1, loop.r1)
  land.line('rail', loop.c0, loop.r0, loop.c0, loop.r1)
  land.line('rail', loop.c1, loop.r0, loop.c1, loop.r1)
  land.line('road', 3, R, 44, R)
  land.line('road', C, 4, C, 43)
  for (const [c, r] of [[C, R], [C, 5], [C, 42], [4, R], [43, R]] as const) land.clear(c, r, 3)
  const homes = ['house', 'house-blue', 'house', 'shop', 'cake'] as const
  putAll(land, [
    [C - 1, loop.r0 + 1, 'station'], [C + 1, loop.r1 - 1, 'station'], [loop.c0 + 1, R - 1, 'station'], [loop.c1 - 1, R + 1, 'station'],
    [C - 2, R - 1, 'house'], [C + 2, R - 1, 'house-blue'], [C - 2, R + 1, 'shop'], [C + 2, R + 1, 'cake'], [C - 1, R - 3, 'park'],
    [C - 1, 5, pick(random, homes)], [C + 1, 5, pick(random, homes)], [C - 1, 7, 'house'],
    [C - 1, 42, 'apartment'], [C + 1, 42, pick(random, homes)], [C + 1, 40, 'house-blue'],
    [4, R - 1, pick(random, homes)], [5, R + 1, 'house'], [3, R + 1, 'farm'],
    [43, R - 1, pick(random, homes)], [42, R + 1, 'house-blue'], [44, R + 1, 'windmill'],
  ])
  return land
}

function castleWorld(random: Random): Land {
  const land = new Land('grass')
  const woods = noiseOf(random)
  land.blob(random, int(random, 6, 10), int(random, 37, 41), 3, 'water')
  scatter(land, (c, r) => {
    if (r < R - 9 && woods(c / 6, r / 6) > 0.4 && random() < 0.75) return random() < 0.25 ? 'pine' : 'tree'
    if (woods(c / 6, r / 6) > 0.68 && random() < 0.5) return 'sakura'
    return random() < 0.02 ? 'flowers' : null
  })
  land.clear(C, R, 8)
  // おほりと、その なかの にわ。
  land.each((c, r) => {
    const distance = Math.max(Math.abs(c - C), Math.abs(r - R))
    if (distance === 4) land.paint(c, r, 'water')
  })
  land.line('road', C - 9, R, C + 10, R)
  land.line('road', C, R - 8, C, R + 9)
  railLoop(land, C - 6, R - 6, C + 6, R + 6)
  land.replace(C, R, 'castle')
  for (let r = R - 3; r <= R + 3; r += 1) {
    for (let c = C - 3; c <= C + 3; c += 1) {
      const dc = Math.abs(c - C)
      const dr = Math.abs(r - R)
      if (dc === 3 && dr === 3) land.put(c, r, 'sakura')
      else if (dc === 2 && dr === 2) land.put(c, r, 'fountain')
      else if ((dc + dr) % 2 === 0) land.put(c, r, 'flowers')
    }
  }
  street(land, random, C - 7, C + 7, R + 9, ['house', 'house-blue', 'house', 'shop', 'cake'], 0.45)
  land.put(C - 1, R + 8, 'house')
  for (let r = R - 3; r <= R + 3; r += 1) {
    for (let c = C + 12; c <= C + 16; c += 1) if (r !== R && random() < 0.85) land.put(c, r, 'farm')
  }
  putAll(land, [[C + 17, R - 2, 'windmill'], [C + 17, R + 2, 'windmill'], [C + 11, R - 1, 'house']])
  for (let r = R - 4; r <= R + 4; r += 1) {
    for (let c = C - 18; c <= C - 11; c += 1) if (r !== R && Math.hypot(c - (C - 14), r - R) < 3.6 + random()) land.put(c, r, 'flowers')
  }
  putAll(land, [[C - 2, R - 9, 'tent'], [C + 2, R - 9, 'tent']])
  return land
}

function snowWorld(random: Random): Land {
  const land = new Land('snow')
  const woods = noiseOf(random)
  river(land, random, int(random, 9, 13), 1, false)
  for (let n = 0; n < 3; n += 1) land.blob(random, int(random, 6, COLS - 7), int(random, 30, ROWS - 6), 2 + random() * 1.6, 'water')
  scatter(land, (c, r) => {
    if (woods(c / 6, r / 6) > 0.5 && random() < 0.75) return 'pine'
    return random() < 0.015 ? 'snowman' : null
  })
  land.clear(C, R, 6)
  land.line('road', C - 8, R, C + 8, R)
  land.line('road', C, R, C, R + 9)
  railLoop(land, C - 7, R - 5, C + 7, R + 6)
  putAll(land, [
    [C - 5, R - 1, 'igloo'], [C - 3, R - 1, 'igloo'], [C + 2, R - 1, 'igloo'], [C + 4, R - 1, 'house'], [C - 3, R + 1, 'shop'],
    [C - 1, R + 1, 'snowman'], [C + 2, R + 1, 'snowman'], [C + 5, R + 1, 'pine'], [C - 1, R + 9, 'windmill'], [C + 1, R + 8, 'igloo'],
    [C - 9, R, 'tent'], [C + 9, R, 'ferris'],
  ])
  return land
}

function desertWorld(random: Random): Land {
  const land = new Land('sand')
  const dunes = noiseOf(random)
  const oasis = { c: C + int(random, -1, 1), r: R - 7 }
  river(land, random, int(random, 7, 10), 2)
  land.blob(random, oasis.c, oasis.r, 2.4, 'water')
  // みずの まわりは くさが はえる。
  land.each((c, r) => {
    if (land.groundAt(c, r) !== 'sand') return
    const nearOasis = Math.hypot(c - oasis.c, r - oasis.r) < 5.4
    const nearRiver = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => c < 16 && land.groundAt(c + dc, r + dr) === 'water')
    if (nearOasis || nearRiver) land.paint(c, r, 'grass')
  })
  scatter(land, (c, r, ground) => {
    if (ground === 'grass') {
      if (random() < 0.3) return 'palm'
      if (c < 16 && random() < 0.3) return 'farm'
      return random() < 0.06 ? 'flowers' : null
    }
    return dunes(c / 5, r / 5) > 0.6 && random() < 0.22 ? 'cactus' : null
  })
  land.clear(C, R, 4.5)
  land.line('road', 2, R, C + 6, R)
  land.line('road', C, R, C, R - 3)
  railLoop(land, C - 7, R - 2, C + 7, R + 7)
  putAll(land, [[C - 4, R - 1, 'house'], [C - 2, R - 1, 'house-blue'], [C + 2, R - 1, 'shop'], [C + 4, R + 1, 'tent'], [C - 3, R + 1, 'house']])
  const site = { c: int(random, 34, 40), r: int(random, 8, 14) }
  for (const [dc, dr] of [[0, 0], [2, 1], [-1, 3]] as const) {
    land.clear(site.c + dc, site.r + dr, 1.5)
    land.put(site.c + dc, site.r + dr, 'pyramid')
  }
  land.put(int(random, 30, 42), int(random, 34, 42), 'pyramid')
  return land
}

const BUILDERS: Record<WorldId, (random: Random) => Land> = {
  river: riverWorld,
  island: islandWorld,
  forest: forestWorld,
  city: cityWorld,
  rail: railWorld,
  castle: castleWorld,
  snow: snowWorld,
  desert: desertWorld,
}

export function createWorld(id: WorldId, seed: number): Town {
  return BUILDERS[id](randomOf(seed)).toTown()
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}
