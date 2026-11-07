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
    default: return n
  }
}

/** ざいりょうの いろに もようを つけた RGBA のドット（テクスチャ用）。 */
export function blockPixels(material: Material): Uint8Array {
  const index = MATERIAL_DEFS.findIndex(m => m.id === material)
  const base = hex(MATERIAL_DEFS[index].color)
  const random = seeded(index * 977 + 13)
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const [r, g, b] = shade(base, pattern(material, x, y, random()))
    const i = (y * TEXTURE_SIZE + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }
  return data
}
