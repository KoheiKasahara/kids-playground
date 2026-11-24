import { MATERIAL_DEFS, type Material } from './world'

/** ブロックの もようの おおきさ（ドット）。 */
export const TEXTURE_SIZE = 16

type Rgb = readonly [number, number, number]
function hex(color: string): Rgb {
  const value = Number.parseInt(color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}
const shade = ([r, g, b]: Rgb, amount: number): Rgb => {
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))))
  return [f(r), f(g), f(b)]
}

/** いつも おなじ もようになる らんすう。 */
function seeded(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** ざいりょうごとの ドットの こさ（-1 くらい〜+1 くらい）。0 が もとの いろ。 */
function pattern(material: Material, x: number, y: number, noise: number): number {
  const n = (noise - 0.5) * 0.16
  switch (material) {
    case 'grass': return noise > 0.86 ? 0.22 : noise < 0.1 ? -0.18 : n
    case 'dirt': return noise > 0.88 ? -0.3 : noise < 0.12 ? 0.15 : n
    case 'stone': return (x + y * 3) % 11 === 0 || noise < 0.08 ? -0.28 : noise > 0.9 ? 0.15 : n
    case 'wood': return x % 4 === 0 ? -0.3 : (x + y) % 7 === 0 ? -0.15 : n
    case 'leaf': return noise < 0.2 ? -0.35 : noise > 0.85 ? 0.2 : n
    case 'sand': return noise > 0.8 ? 0.18 : noise < 0.15 ? -0.1 : n * 0.5
    case 'brick': {
      const row = Math.floor(y / 4)
      const mortar = y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7
      return mortar ? 0.55 : n
    }
    case 'water': return (y + Math.round(Math.sin(x / 2.5) * 1.5)) % 5 === 0 ? 0.3 : n * 0.5
    case 'plank': return y % 4 === 3 ? -0.3 : x === (Math.floor(y / 4) * 5 + 3) % TEXTURE_SIZE ? -0.25 : n
    case 'glass': return x === 0 || y === 0 || x === TEXTURE_SIZE - 1 || y === TEXTURE_SIZE - 1 ? 0.5 : x === y || x === y + 1 ? 0.7 : 0
    case 'snow': return noise > 0.9 ? -0.08 : 0
    case 'cactus': return x % 5 === 2 ? -0.3 : noise > 0.93 ? 0.5 : n
    case 'pumpkin': return x % 5 === 0 ? -0.3 : n
    case 'lamp': return x % 5 === 0 || y % 5 === 0 ? -0.35 : 0.25 + n
    case 'gold':
    case 'diamond': return noise > 0.9 ? 0.6 : (x + y) % 6 === 0 ? -0.2 : n
    case 'lava': return (x + Math.round(Math.sin(y / 2) * 2)) % 6 === 0 ? 0.45 : noise < 0.15 ? -0.25 : n
    case 'obsidian': return noise > 0.9 ? 0.35 : (x * 3 + y) % 13 === 0 ? 0.2 : n
    case 'ice': return x === y || x === y + 5 ? 0.45 : noise > 0.9 ? 0.25 : 0
    case 'sandstone': return y % 5 === 4 ? -0.18 : noise > 0.85 ? 0.12 : n * 0.5
    case 'farmland': return x % 4 === 0 ? -0.35 : noise > 0.85 ? 0.12 : n
    case 'coral': return noise > 0.8 ? 0.35 : noise < 0.2 ? -0.25 : n
    case 'wool_white':
    case 'wool_pink':
    case 'wool_yellow':
    case 'wool_blue': return (x + y) % 4 === 0 ? -0.12 : n * 0.5
    case 'wheat':
    case 'sprout':
    case 'seed': return x % 3 === 0 ? -0.25 : noise > 0.85 ? 0.2 : n
    case 'cloud': return noise > 0.82 ? -0.07 : noise < 0.2 ? 0.5 : 0
    case 'crystal': return (x + y) % 5 === 0 ? 0.6 : (x * 2 + y) % 7 === 0 ? -0.25 : noise > 0.88 ? 0.75 : n
    case 'stonebrick': {
      const row = Math.floor(y / 4)
      return y % 4 === 3 || (x + (row % 2) * 4) % 8 === 7 ? -0.35 : noise > 0.9 ? 0.12 : n
    }
    case 'mushcap': return ((x + 2) % 6 < 2 && (y + (Math.floor(x / 6) % 2) * 3) % 6 < 2) ? 0.85 : n
    case 'melon': return x % 4 === 0 ? -0.4 : x % 4 === 2 && noise > 0.5 ? 0.25 : n
    case 'honey': return (x + y * 2) % 8 === 0 ? 0.5 : noise > 0.9 ? 0.4 : 0
    case 'mushroom': return noise > 0.8 && y < 10 ? 0.75 : y >= 10 ? 0.6 : n
    case 'workbench': return x % 5 === 0 || y % 5 === 0 ? -0.38 : (x + y) % 9 === 0 ? 0.2 : n
    case 'sakura': return noise < 0.2 ? -0.18 : noise > 0.8 ? 0.45 : n
    case 'sponge': return noise < 0.22 ? -0.35 : noise > 0.9 ? 0.2 : n
    case 'emerald': return noise > 0.88 ? 0.6 : (x * 2 + y) % 7 === 0 ? -0.25 : n
    // した（y が ちいさい）は えだ、うえは ほのお
    case 'torch': return y >= 11 ? 0.35 + n : -0.55 + n
    case 'fence': return n - (x % 6 === 2 ? 0.15 : 0)
    case 'door': {
      if (x === 0 || x === TEXTURE_SIZE - 1 || y === 0 || y === TEXTURE_SIZE - 1) return -0.35
      if (x >= 4 && x <= 11 && y >= 9 && y <= 13) return 0.55 + n
      if (x === 12 && y === 6) return -0.65
      return x % 4 === 0 ? -0.15 : n
    }
    case 'door_open': return -0.2 + n
    case 'bed': return y >= 11 ? 0.8 + n * 0.3 : y % 4 === 1 ? -0.2 : n
    case 'note': return x === 0 || y === 0 || x === TEXTURE_SIZE - 1 || y === TEXTURE_SIZE - 1 ? -0.4 : x % 4 === 2 && y % 4 === 2 ? 0.5 : n
    case 'bomb': return y >= 6 && y <= 9 ? (x % 3 === 1 ? -0.45 : 0.8) : x % 5 === 0 ? -0.2 : n
    case 'cake':
    case 'cake_half': return y >= 11 ? (noise > 0.92 ? -0.5 : 0.6) : y === 10 ? -0.2 : y % 3 === 0 ? -0.35 : n
    case 'jack': {
      // ひかる かお（め・くち）
      const face = ((x === 4 || x === 5 || x === 10 || x === 11) && y >= 9 && y <= 11) || (y >= 3 && y <= 5 && x >= 3 && x <= 12 && (y !== 5 || x % 3))
      return face ? 0.75 : x % 5 === 0 ? -0.3 : n
    }
    // いたチョコの みぞ
    case 'chocolate': return x % 4 === 3 || y % 4 === 3 ? -0.35 : x % 4 === 0 || y % 4 === 0 ? 0.18 : n * 0.5
    // たけの ふし
    case 'bamboo': return y % 6 === 5 ? -0.4 : y % 6 === 4 ? 0.25 : x % 5 === 1 ? 0.15 : n
    // ドラゴンの たまごの もよう
    case 'dragon_egg': return (x * 7 + y * 3) % 11 === 0 || noise > 0.93 ? 0.7 : (x + y * 5) % 13 === 0 ? -0.35 : n
    // うずまき（まんなかへ むかう わ）
    case 'portal': {
      const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
      return Math.floor(ring) % 3 === 0 ? 0.55 : Math.floor(ring) % 3 === 1 ? -0.25 : n
    }
    // つつに まいた かみと、ちいさな ほし
    case 'fireworks': return noise > 0.92 ? 0.85 : y % 5 === 2 ? 0.5 : n
    default: return n
  }
}

/** にじの いろ（うえから した）。 */
const RAINBOW: readonly Rgb[] = ['#ff5f6d', '#ffa24c', '#ffe066', '#7ed957', '#5ec8f2', '#8c7cf0', '#d77cf0'].map(hex)

/** すきまの ある ブロックで、むこうが みえる ドット。 */
function hole(material: Material, x: number, y: number) {
  switch (material) {
    // たての くいが 2ほん、よこの いたが 2まい
    case 'fence': return !(x >= 2 && x <= 4) && !(x >= 11 && x <= 13) && !(y >= 4 && y <= 6) && !(y >= 10 && y <= 12)
    // わくだけ のこる
    case 'door_open': return x > 1 && x < TEXTURE_SIZE - 2 && y < TEXTURE_SIZE - 2
    default: return false
  }
}

/** ざいりょうの いろに もようを つけた RGBA のドット（テクスチャ用）。すきまの ある ブロックは すきまを すきとおらせる。 */
export function blockPixels(material: Material): Uint8Array {
  const index = MATERIAL_DEFS.findIndex(m => m.id === material)
  const base = hex(MATERIAL_DEFS[index].color)
  const random = seeded(index * 977 + 13)
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const noise = random()
    // にじは だんごとに いろを かえる
    const color = material === 'rainbow' ? RAINBOW[Math.floor((TEXTURE_SIZE - 1 - y) * RAINBOW.length / TEXTURE_SIZE)] : base
    const [r, g, b] = shade(color, material === 'rainbow' ? (noise - 0.5) * 0.1 : pattern(material, x, y, noise))
    const i = (y * TEXTURE_SIZE + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = hole(material, x, y) ? 0 : 255
  }
  return data
}
