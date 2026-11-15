import type { AnimalKind } from './animals'
import {
  arch, cabin, castle, farm, generate, giantMushroom, giantTree, igloo, lampPost, lighthouse, NEW_WORLD, oak, palm, pyramid,
  ruin, SEA, ship, snowman, spires, spruce, volcano, type Column, type Gen, type Spot,
} from './terrain'
import type { Dimensions, Material, WoolColor, World } from './world'

export type BiomeId = 'meadow' | 'desert' | 'snow' | 'island' | 'forest' | 'volcano' | 'sky' | 'castle' | 'crystal' | 'adventure'
export type AnimalSpec = { kind: AnimalKind; wool?: WoolColor }
export type Biome = {
  id: BiomeId; label: string; emoji: string
  /** ひるの そらの いろ。 */
  sky: string
  /** はじめに いる どうぶつ（ばしょは せかいが できてから きめる）。 */
  animals: readonly AnimalSpec[]
  /** おなじ seed なら いつも おなじ せかい。 */
  create: (dimensions?: Dimensions, seed?: number) => World
}

const sea: Column = { h: 1, top: 'sand', water: SEA }
const distance = (x: number, z: number, spot: Spot) => Math.hypot(x - spot.x, z - spot.z)
const chebyshev = (x: number, z: number, spot: Spot) => Math.max(Math.abs(x - spot.x), Math.abs(z - spot.z))
const near = (g: Gen, dx: number, dz: number): Spot => ({
  x: Math.max(3, Math.min(g.size - 4, g.c + dx)), z: Math.max(3, Math.min(g.size - 4, g.c + dz)),
})

/* ---- どの せかいでも つかう かざり ---- */

const plants = (g: Gen, count: number, plant: Material, on: Material = 'grass') => g.scatter(g.count(count), (x, z, top, material) => {
  if (material === on) g.d.put(x, top + 1, z, plant)
})
const oaks = (g: Gen, count: number, grove = 0.5, allowed: (x: number, z: number) => boolean = () => true) =>
  g.scatter(g.count(count), (x, z, _top, material) => {
    if (material === 'grass' && g.n(x, z, 18, 21) > grove && allowed(x, z)) oak(g.d, x, z, g.rng() < 0.25)
  })
const homeCabin = (g: Gen) => {
  const house = near(g, 7, -3)
  cabin(g.d, house.x, house.z, { x: -1, z: 0 })
  lampPost(g.d, house.x - 4, house.z + 2)
  const field = near(g, 5, 4)
  farm(g.d, field.x, field.z, 4, 3, g.rng)
}

/** くさはら：おか・かわ・ゆきを かぶった やま・はなばたけ。 */
const createMeadow = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  const [peak = near(g, -g.size, -g.size)] = g.spots(1, 0.55, 0.8)
  const radius = Math.max(6, g.size * 0.17)
  return {
    homeTop: 'grass',
    shape(x, z) {
      const hills = g.n(x, z, 34)
      const mountain = Math.max(0, 1 - distance(x, z, peak) / radius)
      const h = SEA + Math.max(0, hills - 0.42) * 16 * g.lift + mountain * 18 * g.lift
      const river = Math.abs(g.n(x, z, 70, 7) - 0.5)
      if (h < SEA + 2.5 && (river < 0.028 || hills < 0.27)) return sea
      if (h < SEA + 1.5 && (river < 0.04 || hills < 0.3)) return { h, top: 'sand' }
      return h >= 14 ? { h, top: 'snow', mid: 'stone' } : h >= 10 ? { h, top: 'stone', mid: 'stone' } : { h, top: 'grass' }
    },
    decorate() {
      oaks(g, 620)
      plants(g, 330, 'flower')
      plants(g, 30, 'sapling')
      plants(g, 24, 'pumpkin')
      plants(g, 30, 'mushroom')
      plants(g, 18, 'melon')
      for (const spot of g.spots(g.count(3), 0.3, 0.9, 20)) ruin(g.d, spot.x, spot.z, g.rng)
      homeCabin(g)
    },
  }
})

/** さばく：すなの おか・ピラミッド・オアシス・ようがんの いけ。 */
const createDesert = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  const oases = [near(g, -9, 6), ...g.spots(g.count(2), 0.4, 0.85, 24)]
  const [pit = near(g, g.size, g.size)] = g.spots(1, 0.5, 0.85)
  return {
    homeTop: 'sand',
    shape(x, z) {
      const oasis = Math.min(...oases.map(spot => distance(x, z, spot)))
      if (oasis < 3.2) return sea
      if (oasis < 6.5) return { h: SEA, top: 'grass' }
      const lava = distance(x, z, pit)
      if (lava < 3) return { h: SEA, top: 'lava', mid: 'sandstone' }
      if (lava < 5) return { h: SEA, top: 'sandstone', mid: 'sandstone' }
      const h = SEA + g.n(x, z, 18) * 4 * g.lift
      if (g.n(x, z, 44, 5) > 0.64 && g.far(x, z) > 16) return { h: h + 1 + 5 * g.lift, top: 'sandstone', mid: 'sandstone', base: 'sandstone' }
      return { h, top: 'sand', mid: 'sand', base: 'sandstone' }
    },
    decorate() {
      const [big, small] = g.spots(2, 0.35, 0.8, 30)
      if (big) pyramid(g.d, big.x, big.z, Math.min(10, Math.max(3, g.height - g.d.top(big.x, big.z) - 4)))
      if (small) pyramid(g.d, small.x, small.z, 5)
      g.scatter(g.count(240), (x, z, top, material) => {
        if (material === 'grass' && g.rng() < 0.3) palm(g.d, x, z)
        else if (material === 'grass') g.d.put(x, top + 1, z, 'flower')
      })
      g.scatter(g.count(300), (x, z, top, material) => {
        if (material === 'sand') g.d.fill(x, z, top + 1, top + 1 + Math.floor(g.rng() * 3), 'cactus')
      })
      for (const spot of g.spots(g.count(4), 0.3, 0.9, 14)) arch(g.d, spot.x, spot.z, 'sandstone', g.rng() < 0.5)
      for (const spot of g.spots(g.count(8), 0.2, 0.95, 8)) {
        if (g.d.topMaterial(spot.x, spot.z) === 'sand') spires(g.d, spot.x, spot.z, 'sandstone', 2 + Math.floor(g.rng() * 3), g.rng)
      }
    },
  }
})

/** ゆきやま：たかい やまなみ・こおった みずうみ・かまくら。 */
const snowColumn = (g: Gen, x: number, z: number): Column => {
  const ridge = g.n(x, z, 38)
  const h = SEA + g.n(x, z, 16, 3) * 3 * g.lift + Math.max(0, ridge - 0.5) * 58 * g.lift
  if (h < SEA + 1.8 && g.n(x, z, 30, 9) < 0.34) return { h: SEA, top: 'ice', mid: 'water' }
  return h >= 6 ? { h, top: 'snow', mid: 'stone' } : { h, top: 'snow' }
}
const snowDecor = (g: Gen, count: number, allowed: (x: number, z: number) => boolean = () => true) => {
  g.scatter(g.count(count), (x, z, top, material) => {
    if (material !== 'snow' || !allowed(x, z)) return
    const roll = g.rng()
    if (roll < 0.6 && g.n(x, z, 16, 22) > 0.45) spruce(g.d, x, z)
    else if (roll > 0.97) snowman(g.d, x, z)
    else if (roll > 0.9) g.d.put(x, top + 1, z, 'mushroom')
    else if (roll > 0.88) g.d.fill(x, z, top + 1, top + 2 + Math.floor(g.rng() * 3), 'ice')
  })
}
const createSnow = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => ({
  homeTop: 'snow',
  shape: (x, z) => snowColumn(g, x, z),
  decorate() {
    snowDecor(g, 900)
    const house = near(g, -6, -5)
    igloo(g.d, house.x, house.z)
    const hut = near(g, 8, 3)
    cabin(g.d, hut.x, hut.z, { x: -1, z: 0 }, 'wood', 'snow')
    snowman(g.d, g.c + 3, g.c - 3)
  },
}))

const seaDecor = (g: Gen, corals: number, allowed: (x: number, z: number) => boolean = () => true) => {
  g.scatter(g.count(corals), (x, z, top, material) => {
    if (material === 'water' && top === SEA && allowed(x, z)) g.d.set(x, SEA, z, 'coral')
  })
  for (let tries = 0, ships = 0; tries < 60 && ships < g.count(2); tries++) {
    const x = 6 + Math.floor(g.rng() * (g.size - 12)), z = 6 + Math.floor(g.rng() * (g.size - 12))
    const open = [[0, 0], [4, 0], [-4, 0], [0, 2], [0, -2]].every(([dx, dz]) => g.d.topMaterial(x + dx, z + dz) === 'water')
    if (!open || !allowed(x, z)) continue
    ship(g.d, x, z)
    ships++
  }
}

/** しま：うみに うかぶ しまじま・かざん・ふね・とうだい。 */
const createIsland = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  const main = { x: g.c, z: g.c, r: Math.max(6, g.size * 0.2) }
  const isles = [main, ...g.spots(g.count(7), 0.55, 0.9, 15).map(spot => ({ ...spot, r: 4 + g.rng() * 5 }))]
  return {
    homeTop: 'grass',
    shape(x, z) {
      const land = Math.max(...isles.map(isle => isle.r - distance(x, z, isle))) + (g.n(x, z, 10) - 0.5) * 5
      if (land <= 0) return sea
      if (land < 1.8) return { h: SEA, top: 'sand' }
      return { h: SEA + Math.min(5, (land - 1.8) * 0.45) * g.lift, top: 'grass' }
    },
    decorate() {
      const cone = near(g, Math.round(main.r * 0.55), Math.round(main.r * 0.3))
      volcano(g.d, cone.x, cone.z, Math.min(8, main.r * 0.45), Math.round(4 + 7 * g.lift), g.rng)
      g.scatter(g.count(420), (x, z, top, material) => {
        if (material === 'sand' && top === SEA) {
          if (g.rng() < 0.3) palm(g.d, x, z)
          else g.d.put(x, top + 1, z, 'shell')
        } else if (material === 'grass') {
          if (g.rng() < 0.25) palm(g.d, x, z)
          else g.d.put(x, top + 1, z, 'flower')
        }
      })
      const tower = isles[1]
      if (tower) lighthouse(g.d, tower.x, tower.z)
      seaDecor(g, 520)
    },
  }
})

const forestDecor = (g: Gen, scale: number, allowed: (x: number, z: number) => boolean = () => true) => {
  for (const spot of g.spots(g.count(16 * scale), 0.18, 0.95, 11)) {
    if (g.d.topMaterial(spot.x, spot.z) === 'grass' && allowed(spot.x, spot.z)) giantTree(g.d, spot.x, spot.z, 9 + Math.floor(g.rng() * 5))
  }
  g.scatter(g.count(1500 * scale), (x, z, top, material) => {
    if (material !== 'grass' || !allowed(x, z)) return
    // はじめの ひろばは きを すくなくして、みとおしを よく する
    const roll = g.far(x, z) < 10 ? 0.5 + g.rng() / 2 : g.rng()
    if (roll < 0.4) oak(g.d, x, z, g.rng() < 0.4)
    else if (roll < 0.5) spruce(g.d, x, z, false)
    else if (roll < 0.52) giantMushroom(g.d, x, z, 3 + Math.floor(g.rng() * 4))
    else if (roll < 0.75) g.d.put(x, top + 1, z, 'mushroom')
    else if (roll < 0.85) g.d.put(x, top + 1, z, 'flower')
    else if (roll < 0.88) g.d.put(x, top + 1, z, g.rng() < 0.5 ? 'pumpkin' : 'melon')
  })
}

/** もり：おおきな き・きのこ・みはらしだい。 */
const createForest = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => ({
  homeTop: 'grass',
  shape(x, z) {
    if (g.n(x, z, 40, 4) < 0.28) return sea
    return { h: SEA + g.n(x, z, 24) * 5 * g.lift, top: g.n(x, z, 9, 6) > 0.68 ? 'dirt' : 'grass' }
  },
  decorate() {
    const lookout = near(g, 7, 6)
    giantTree(g.d, lookout.x, lookout.z, 13, true)
    forestDecor(g, 1)
    for (const spot of g.spots(g.count(2), 0.3, 0.9, 20)) ruin(g.d, spot.x, spot.z, g.rng)
  },
}))

/** かざん：ようがんの かわ・くろい いわ・おんせん。 */
const createVolcano = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  const [cone = near(g, g.size, 0)] = g.spots(1, 0.5, 0.62)
  const springs = [near(g, -8, 7), ...g.spots(g.count(2), 0.3, 0.9, 20)]
  return {
    homeTop: 'grass',
    shape(x, z) {
      if (springs.some(spot => distance(x, z, spot) < 3)) return { h: 1, top: 'stone', mid: 'stone', water: SEA }
      const h = SEA + g.n(x, z, 20) * 3 * g.lift
      if (g.n(x, z, 26, 8) < 0.3 && g.far(x, z) > 14) return { h: SEA, top: 'lava', mid: 'stone' }
      const ground = g.n(x, z, 9, 2)
      return { h, top: ground > 0.62 ? 'obsidian' : ground < 0.4 ? 'dirt' : 'stone', mid: 'stone' }
    },
    decorate() {
      volcano(g.d, cone.x, cone.z, Math.max(6, g.size * 0.2), Math.max(3, g.cap - 5), g.rng)
      for (const spot of g.spots(g.count(3), 0.3, 0.9, 22)) volcano(g.d, spot.x, spot.z, 5, Math.round(3 + 3 * g.lift), g.rng)
      g.scatter(g.count(700), (x, z, top, material) => {
        const roll = g.rng()
        if (material === 'obsidian' && roll < 0.2) g.d.fill(x, z, top + 1, top + 2 + Math.floor(g.rng() * 5), 'obsidian')
        else if (material === 'stone' && roll < 0.05) g.d.set(x, top, z, 'gold')
        else if (material === 'dirt' && roll < 0.2) g.d.fill(x, z, top + 1, top + 2 + Math.floor(g.rng() * 3), 'wood')
        else if (material === 'stone' && roll > 0.97) spires(g.d, x, z, 'crystal', 2 + Math.floor(g.rng() * 3), g.rng)
      })
      g.scatter(g.count(2500), (x, z, top, material) => {
        if (material !== 'grass') return
        if (g.rng() < 0.08) oak(g.d, x, z)
        else if (g.rng() < 0.3) g.d.put(x, top + 1, z, 'flower')
      })
      const house = near(g, 6, -6)
      cabin(g.d, house.x, house.z, { x: -1, z: 0 }, 'stonebrick', 'obsidian')
    },
  }
})

/** そらの しま：くもの うみに うかぶ しまと、くもの はし・たき。 */
const createSky = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  type Isle = Spot & { r: number; y: number }
  const altitude = Math.min(g.height - 9, Math.round(4 + 8 * g.lift))
  const isles: Isle[] = [{ x: g.c, z: g.c, r: Math.max(5, g.size * 0.12), y: altitude }]
  const links: (readonly [Isle, Isle])[] = []
  for (const spot of g.spots(g.count(11), 0.32, 0.9, 15)) {
    const r = 4 + g.rng() * 4.5
    const parent = isles.reduce((best, isle) => distance(spot.x, spot.z, isle) < distance(spot.x, spot.z, best) ? isle : best)
    const gap = Math.max(0, distance(spot.x, spot.z, parent) - (r + parent.r) * 0.6)
    const step = Math.round((g.rng() * 2 - 1) * Math.min(5 * g.lift, gap / 2))
    const isle = { ...spot, r, y: Math.max(4, Math.min(g.height - 9, parent.y + step)) }
    isles.push(isle)
    links.push([parent, isle])
  }
  return {
    floor: 'cloud', cover: 'cloud',
    shape: (x, z) => ({ h: g.n(x, z, 12) > 0.66 ? 2 : 1, top: 'cloud', mid: 'cloud', base: 'cloud' }),
    decorate() {
      const { d } = g
      for (const isle of isles) {
        const r = Math.ceil(isle.r * 1.2)
        for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
          const x = isle.x + dx, z = isle.z + dz
          const edge = isle.r * (0.85 + 0.3 * g.n(x, z, 6, 3))
          const inner = 1 - Math.hypot(dx, dz) / edge
          if (inner <= 0) continue
          const thick = 1 + Math.round(inner * isle.r * 0.7)
          for (let y = Math.max(3, isle.y - thick + 1); y <= isle.y; y++) d.set(x, y, z, y === isle.y ? 'grass' : y >= isle.y - 2 ? 'dirt' : 'stone')
        }
      }
      // くもの はし：1だんずつ のぼりおり できる
      for (const [a, b] of links) {
        const length = Math.ceil(distance(a.x, a.z, b))
        const from = a.r * 0.6, to = length - b.r * 0.6
        const wide = Math.abs(b.x - a.x) > Math.abs(b.z - a.z) ? [0, 1] as const : [1, 0] as const
        for (let s = 0; s <= length; s++) {
          const t = s / length
          const x = Math.round(a.x + (b.x - a.x) * t), z = Math.round(a.z + (b.z - a.z) * t)
          const y = Math.round(a.y + (b.y - a.y) * Math.max(0, Math.min(1, (s - from) / Math.max(1, to - from))))
          for (const [px, pz] of [[x, z], [x + wide[0], z + wide[1]]]) if (d.top(px, pz) < y) d.set(px, y, pz, 'cloud')
        }
      }
      // たき：しまの ふちから くもの うみへ
      for (const isle of isles.filter((_, index) => index % 3 === 1)) {
        for (let dx = 0; dx < isle.r * 2; dx++) {
          const x = isle.x + dx
          if (d.top(x, isle.z) >= isle.y) { d.set(x, isle.y, isle.z, 'water'); continue }
          d.fill(x, isle.z, d.top(x, isle.z) + 1, isle.y, 'water')
          break
        }
      }
      g.scatter(g.count(2600), (x, z, top, material) => {
        if (material !== 'grass') return
        const roll = g.rng()
        if (roll < 0.1) oak(d, x, z, g.rng() < 0.3)
        else if (roll < 0.4) d.put(x, top + 1, z, 'flower')
        else if (roll < 0.44) d.put(x, top + 1, z, 'sapling')
        else if (roll < 0.46) d.put(x, top + 1, z, 'pumpkin')
      })
      const temple = isles.at(-1)!
      if (isles.length > 1) {
        for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]] as const) {
          if (d.top(temple.x + dx, temple.z + dz) === temple.y) d.fill(temple.x + dx, temple.z + dz, temple.y + 1, temple.y + 3, 'sandstone')
        }
        d.fill(temple.x, temple.z, temple.y + 1, temple.y + 2, 'crystal')
      }
      const giant = isles[2]
      if (giant) giantMushroom(d, giant.x, giant.z, 6)
      lampPost(d, g.c + 4, g.c + 3)
    },
  }
})

/** おしろ：おほりの ある おしろと、むら・はたけ。 */
const createCastle = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  const keep = { x: g.c, z: g.c - Math.round(g.size * 0.24) }
  const hasCastle = keep.z >= 14
  return {
    homeTop: 'grass',
    shape(x, z) {
      const ring = hasCastle ? chebyshev(x, z, keep) : 99
      const road = Math.abs(x - g.c) <= 1 && z < g.c - 2 && z > keep.z
      if (ring <= 13) {
        if (ring === 10 || ring === 11) return road ? { h: SEA, top: 'plank', mid: 'plank' } : sea
        return { h: SEA, top: road || ring < 8 ? 'sandstone' : 'grass' }
      }
      const hills = g.n(x, z, 30)
      if (hills < 0.26 && !road) return sea
      return { h: SEA + Math.max(0, hills - 0.45) * 10 * g.lift, top: road && hasCastle ? 'sandstone' : 'grass' }
    },
    decorate() {
      if (hasCastle) castle(g.d, keep.x, keep.z)
      oaks(g, 420, 0.45, (x, z) => chebyshev(x, z, keep) > 13)
      plants(g, 260, 'flower')
      plants(g, 30, 'pumpkin')
      plants(g, 20, 'melon')
      for (const [dx, dz, door] of [[-8, -7, 1], [8, -7, -1], [-9, 4, 1], [9, 5, -1]] as const) {
        const house = near(g, dx, dz)
        cabin(g.d, house.x, house.z, { x: door, z: 0 })
      }
      for (let z = g.c - 6; z > keep.z + 13; z -= 6) for (const dx of [-3, 3]) lampPost(g.d, g.c + dx, z)
      const field = near(g, -3, 6)
      farm(g.d, field.x, field.z, 7, 4, g.rng)
    },
  }
})

/** クリスタルの たに：がけに かこまれた たにと、ひかる クリスタル。 */
const createCrystal = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => ({
  homeTop: 'grass',
  shape(x, z) {
    const valley = Math.abs(g.n(x, z, 46) - 0.5)
    if (valley < 0.016) return { h: 1, top: 'stone', mid: 'stone', water: SEA }
    if (valley < 0.07) return { h: SEA, top: g.n(x, z, 8, 2) > 0.62 ? 'ice' : 'stone', mid: 'stone' }
    const h = SEA + Math.min(1, (valley - 0.07) / 0.1) * 13 * g.lift + g.n(x, z, 12, 4) * 3 * g.lift
    return { h, top: h > 8 && g.n(x, z, 14, 5) > 0.5 ? 'grass' : 'stone', mid: 'stone' }
  },
  decorate() {
    const { d } = g
    g.scatter(g.count(1100), (x, z, top, material) => {
      const roll = g.rng()
      if (material === 'stone' && roll < 0.1) spires(d, x, z, 'crystal', 2 + Math.floor(g.rng() * 6), g.rng)
      else if (material === 'stone' && roll < 0.13) spires(d, x, z, 'glass', 2 + Math.floor(g.rng() * 4), g.rng)
      else if (material === 'ice' && roll < 0.3) d.fill(x, z, top + 1, top + 1 + Math.floor(g.rng() * 4), 'ice')
      else if (material === 'stone' && roll < 0.16) d.set(x, top, z, 'crystal')
      else if (material === 'grass' && roll < 0.2) spruce(d, x, z, false)
      else if (material === 'grass' && roll < 0.5) d.put(x, top + 1, z, 'mushroom')
    })
    // おおきな クリスタル
    for (const spot of g.spots(g.count(3), 0.25, 0.85, 24)) {
      const base = d.top(spot.x, spot.z) + 5
      for (let dy = -5; dy <= 5; dy++) for (let dx = -3; dx <= 3; dx++) for (let dz = -3; dz <= 3; dz++) {
        if (Math.abs(dx) + Math.abs(dz) + Math.abs(dy) * 0.6 <= 3) d.put(spot.x + dx, base + dy, spot.z + dz, Math.abs(dx) + Math.abs(dz) > 1 ? 'glass' : 'crystal')
      }
    }
    for (const spot of g.spots(g.count(4), 0.25, 0.9, 14)) arch(d, spot.x, spot.z, 'crystal', g.rng() < 0.5)
    g.scatter(g.count(1800), (x, z, top, material) => { if (material === 'grass' && g.far(x, z) < 12) d.put(x, top + 1, z, 'flower') })
  },
}))

/** だいぼうけん：くさはらの まわりに ゆきやま・さばく・うみ・もりが ひろがる。 */
const createAdventure = (dimensions = NEW_WORLD, seed = 0) => generate(dimensions, seed, g => {
  type Region = 'meadow' | 'snow' | 'desert' | 'sea' | 'forest'
  const region = (x: number, z: number): Region => {
    const dx = x - g.c + (g.n(x, z, 20, 11) - 0.5) * 16, dz = z - g.c + (g.n(x, z, 20, 12) - 0.5) * 16
    if (Math.hypot(dx, dz) < g.size * 0.19) return 'meadow'
    return Math.abs(dz) > Math.abs(dx) ? (dz < 0 ? 'snow' : 'sea') : dx > 0 ? 'desert' : 'forest'
  }
  const is = (kind: Region) => (x: number, z: number) => region(x, z) === kind
  return {
    homeTop: 'grass',
    shape(x, z) {
      switch (region(x, z)) {
        case 'snow': return snowColumn(g, x, z)
        case 'desert': return g.n(x, z, 44, 5) > 0.66
          ? { h: SEA + 4 * g.lift + 1, top: 'sandstone', mid: 'sandstone' }
          : { h: SEA + g.n(x, z, 18) * 4 * g.lift, top: 'sand', mid: 'sand', base: 'sandstone' }
        case 'sea': {
          const land = g.n(x, z, 14, 5)
          return land > 0.68 ? { h: SEA + 1, top: 'grass' } : land > 0.62 ? { h: SEA, top: 'sand' } : sea
        }
        case 'forest': return g.n(x, z, 40, 4) < 0.26 ? sea : { h: SEA + g.n(x, z, 24) * 4 * g.lift, top: 'grass' }
        default: {
          const hills = g.n(x, z, 34)
          return hills < 0.27 ? sea : { h: SEA + Math.max(0, hills - 0.45) * 9 * g.lift, top: 'grass' }
        }
      }
    },
    decorate() {
      const { d } = g
      const reach = Math.round(g.size * 0.34)
      const tomb = near(g, reach, 2)
      if (is('desert')(tomb.x, tomb.z)) pyramid(d, tomb.x, tomb.z, Math.min(8, Math.max(3, g.height - d.top(tomb.x, tomb.z) - 4)))
      const dome = near(g, -3, -reach)
      if (d.topMaterial(dome.x, dome.z) === 'snow') igloo(d, dome.x, dome.z)
      const cone = near(g, -Math.round(g.size * 0.2), reach)
      if (is('sea')(cone.x, cone.z)) volcano(d, cone.x, cone.z, 6, Math.round(4 + 5 * g.lift), g.rng)
      const lookout = near(g, -reach, 4)
      if (d.topMaterial(lookout.x, lookout.z) === 'grass') giantTree(d, lookout.x, lookout.z, 13, true)
      forestDecor(g, 0.35, is('forest'))
      snowDecor(g, 320, is('snow'))
      seaDecor(g, 200, is('sea'))
      oaks(g, 260, 0.5, is('meadow'))
      const desert = is('desert'), ocean = is('sea')
      g.scatter(g.count(700), (x, z, top, material) => {
        if (material === 'sand' && desert(x, z) && g.rng() < 0.3) d.fill(x, z, top + 1, top + 1 + Math.floor(g.rng() * 3), 'cactus')
        else if ((material === 'sand' || material === 'grass') && ocean(x, z)) {
          if (g.rng() < 0.25) palm(d, x, z)
          else d.put(x, top + 1, z, material === 'sand' ? 'shell' : 'flower')
        } else if (material === 'grass' && g.rng() < 0.4) d.put(x, top + 1, z, g.rng() < 0.9 ? 'flower' : 'pumpkin')
      })
      for (const spot of g.spots(g.count(4), 0.3, 0.9, 20)) {
        if (d.topMaterial(spot.x, spot.z) === 'grass') ruin(d, spot.x, spot.z, g.rng)
        else if (d.topMaterial(spot.x, spot.z) === 'sand' && desert(spot.x, spot.z)) arch(d, spot.x, spot.z, 'sandstone')
      }
      homeCabin(g)
    },
  }
})

const sheep = (wool: WoolColor): AnimalSpec => ({ kind: 'sheep', wool })
const chicken: AnimalSpec = { kind: 'chicken' }, rabbit: AnimalSpec = { kind: 'rabbit' }

export const BIOMES: readonly Biome[] = [
  { id: 'meadow', label: 'くさはら', emoji: '🌳', sky: '#c6eafa', create: createMeadow, animals: [sheep('white'), sheep('pink'), sheep('white'), chicken, chicken, rabbit, rabbit, sheep('pink')] },
  { id: 'desert', label: 'さばく', emoji: '🏜️', sky: '#f4dfae', create: createDesert, animals: [sheep('yellow'), sheep('yellow'), rabbit, rabbit, chicken, chicken, sheep('yellow'), rabbit] },
  { id: 'snow', label: 'ゆきやま', emoji: '🏔️', sky: '#dbe7f3', create: createSnow, animals: [sheep('blue'), sheep('blue'), sheep('white'), rabbit, rabbit, sheep('white'), rabbit, sheep('blue')] },
  { id: 'island', label: 'しま', emoji: '🏝️', sky: '#a5e0f8', create: createIsland, animals: [chicken, chicken, sheep('white'), sheep('white'), chicken, rabbit, rabbit, chicken] },
  { id: 'forest', label: 'もり', emoji: '🌲', sky: '#cdebc6', create: createForest, animals: [rabbit, rabbit, rabbit, chicken, chicken, sheep('pink'), sheep('pink'), rabbit] },
  { id: 'volcano', label: 'かざん', emoji: '🌋', sky: '#f3cdb0', create: createVolcano, animals: [rabbit, rabbit, chicken, chicken, sheep('yellow'), sheep('yellow')] },
  { id: 'sky', label: 'そらの しま', emoji: '☁️', sky: '#b7dcff', create: createSky, animals: [sheep('white'), sheep('blue'), sheep('white'), sheep('blue'), chicken, chicken, rabbit, rabbit] },
  { id: 'castle', label: 'おしろ', emoji: '🏰', sky: '#d3ecf6', create: createCastle, animals: [sheep('white'), sheep('pink'), chicken, chicken, chicken, rabbit, rabbit, sheep('white')] },
  { id: 'crystal', label: 'クリスタル', emoji: '🔮', sky: '#ddd2f6', create: createCrystal, animals: [sheep('blue'), sheep('pink'), sheep('blue'), sheep('pink'), rabbit, rabbit] },
  { id: 'adventure', label: 'だいぼうけん', emoji: '🗺️', sky: '#bfe6f2', create: createAdventure, animals: [sheep('white'), sheep('pink'), sheep('yellow'), sheep('blue'), chicken, chicken, rabbit, rabbit] },
]
export const biome = (id: BiomeId): Biome => BIOMES.find(b => b.id === id)!
export const isBiomeId = (value: unknown): value is BiomeId => BIOMES.some(b => b.id === value)
