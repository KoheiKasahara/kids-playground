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
    case 'carpet': return (x + y) % 4 === 0 ? -0.15 : x % 8 === 3 ? 0.18 : n * 0.5
    // たての わらに あかい ひも
    case 'hay': return y >= 5 && y <= 6 || y >= 11 && y <= 12 ? -0.45 : x % 3 === 0 ? -0.18 : noise > 0.85 ? 0.2 : n
    // つるつるの いしに ふちどり
    case 'slab': return y === 0 || y === TEXTURE_SIZE - 1 || x === 0 || x === TEXTURE_SIZE - 1 ? -0.25 : n * 0.6
    case 'stairs': return y % 4 === 3 ? -0.3 : x === (Math.floor(y / 4) * 7 + 2) % TEXTURE_SIZE ? -0.25 : n
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
    // かねの ふちと、ひかりの すじ
    case 'bell': return y === 2 || y === 3 || y === 12 ? -0.3 : x === 4 || x === 5 ? 0.45 : n
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

const STEM = hex('#4f9a3c')
const TRUNK = hex('#8a5a2b')
const DIRT = hex('#ae7950')
const PLANK = hex('#e0b46c')
const PUMPKIN = hex('#ef8a1f')
const MUSHROOM_STEM = hex('#f2e6d0')
const COAL = hex('#2f3440')
const CARROT = hex('#f28a2e')
const DIAMOND = hex('#5ee3e0')
const RIBBON = hex('#ffd23f')
const FLAME = hex('#ffb347')
const CHOCOLATE = hex('#6b3f26')

/**
 * ばってんに えがく くさばなの え（y が おおきい ほうが うえ）。
 * えの そとは null（すきとおる）。くさばなで なければ undefined。
 */
function sprite(material: Material, x: number, y: number, noise: number, base: Rgb): Rgb | null | undefined {
  const n = (noise - 0.5) * 0.2
  switch (material) {
    case 'flower': {
      if (Math.hypot(x - 7.5, y - 11.5) < 3.4) return shade(base, Math.hypot(x - 7.5, y - 11.5) < 1.3 ? 0.55 : n)
      const stem = (x === 7 || x === 8) && y <= 9
      const leaf = ((y === 4 || y === 5) && (x === 5 || x === 6)) || ((y === 6 || y === 7) && (x === 9 || x === 10))
      return stem || leaf ? shade(STEM, n) : null
    }
    case 'sapling': {
      if ((x === 7 || x === 8) && y <= 6) return shade(TRUNK, n)
      return Math.hypot(x - 7.5, y - 10.5) < 4.8 && noise > 0.12 ? shade(base, noise > 0.8 ? 0.2 : n) : null
    }
    case 'tallgrass':
    case 'seed':
    case 'sprout':
    case 'wheat': {
      // ななめに のびる ほそい は
      const blade = (x + Math.floor(y / 5)) % 4 === 1
      if (material === 'wheat' && y >= 10 && x % 4 !== 3) return shade(base, 0.25 + n)
      return blade ? shade(base, y < 4 ? -0.25 : n) : null
    }
    case 'mushroom': {
      if (x >= 6 && x <= 9 && y <= 6) return shade(MUSHROOM_STEM, n)
      const half = 7 - Math.max(0, y - 10) * 1.4
      if (y >= 7 && y <= 13 && Math.abs(x - 7.5) <= half) return shade(base, (x + y) % 5 === 0 && noise > 0.3 ? 0.85 : n)
      return null
    }
    default: return undefined
  }
}

/** うえと よこで もようが ちがう ブロック（くさは うえが みどりで よこが つち、きは うえに ねんりん）。 */
export const FACED: readonly Material[] = ['grass', 'wood', 'pumpkin', 'jack', 'cactus', 'workbench', 'bomb', 'melon', 'sandstone', 'bookshelf', 'hay', 'gift', 'cookie']
export type Face = 'side' | 'top' | 'bottom'
const FACE_SEEDS: Record<Face, number> = { side: 0, top: 101, bottom: 211 }

/** うえ・したの めんの もよう。 */
function cap(material: Material, face: Face, x: number, y: number, noise: number, base: Rgb): Rgb {
  const n = (noise - 0.5) * 0.16
  const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5))
  switch (material) {
    case 'grass': return face === 'top' ? shade(base, pattern('grass', x, y, noise)) : shade(DIRT, pattern('dirt', x, y, noise))
    case 'wood': return ring > 6.5 ? shade(base, -0.3 + n) : shade(PLANK, Math.floor(ring) % 2 ? -0.2 : 0.05 + n)
    case 'pumpkin':
    case 'jack': return ring < 1.5 ? shade(STEM, -0.2 + n) : shade(PUMPKIN, Math.floor(ring) % 3 === 0 ? -0.22 : n)
    case 'cactus': return ring > 6.5 ? shade(base, -0.3) : x % 4 === 1 && y % 4 === 1 ? shade(base, -0.4) : shade(base, 0.15 + n)
    case 'workbench': return x % 5 === 0 || y % 5 === 0 ? shade(base, -0.38) : shade(base, (x + y) % 9 === 0 ? 0.2 : n)
    case 'bomb': return ring < 1.5 ? shade(base, -0.75) : shade(base, ring > 6.5 ? -0.2 : 0.15 + n)
    case 'melon': return ring < 1.5 ? shade(STEM, -0.35) : shade(base, (x + y) % 4 === 0 ? -0.25 : n)
    case 'sandstone': return shade(base, n * 0.4 + (ring > 6.5 ? -0.12 : 0))
    case 'bookshelf': return shade(PLANK, y % 4 === 3 ? -0.3 : n)
    // たばねた わらの きりくち
    case 'hay': return shade(base, ring > 6.5 ? -0.25 : (x * 3 + y * 5) % 7 === 0 ? -0.3 : 0.1 + n)
    // うえは じゅうじの リボンと まんなかの ちょうちょ むすび、したは はこの いろ
    case 'gift': {
      if (face === 'bottom') return shade(base, -0.15 + n)
      if (ring < 2) return shade(RIBBON, ring < 1 ? -0.2 : 0.15)
      return x === 7 || x === 8 || y === 7 || y === 8 ? shade(RIBBON, n) : shade(base, n)
    }
    // うえに チョコの つぶ、したは こんがり
    case 'cookie': {
      if (face === 'bottom') return shade(base, -0.25 + n)
      if (ring > 6.5) return shade(base, -0.2 + n)
      return noise > 0.86 ? shade(CHOCOLATE, n) : shade(base, 0.08 + n)
    }
    default: return shade(base, pattern(material, x, y, noise))
  }
}
const BOOKS = ['#c8473c', '#3f6fc4', '#3f9a55', '#e0b23a', '#8a4fb5'].map(hex)

/** よこの めんの もよう。 */
function side(material: Material, x: number, y: number, noise: number, base: Rgb): Rgb {
  switch (material) {
    // うえの ふちだけ くさが たれる
    case 'grass': return y >= 12 + (x * 5 + 3) % 3 ? shade(base, pattern('grass', x, y, noise)) : shade(DIRT, pattern('dirt', x, y, noise))
    // いたの うえに のこぎりと かなづち
    case 'workbench': {
      const tool = (x >= 3 && x <= 4 && y >= 3 && y <= 11) || (x >= 2 && x <= 5 && y >= 10 && y <= 12) || (x >= 9 && x <= 13 && y >= 5 && y <= 9 && x - 9 <= y - 5)
      return tool ? shade(base, -0.55) : shade(PLANK, y % 4 === 3 ? -0.3 : (noise - 0.5) * 0.16)
    }
    // ゆきだるま：うえの たまに め・はな、したの たまに ボタン。あいだは くびれの かげ
    case 'snowman': {
      const n = (noise - 0.5) * 0.06
      if (y === 7 || y === 8) return shade(base, -0.14 + n)
      if (y >= 11 && y <= 12 && (x === 5 || x === 10)) return shade(COAL, n)
      if (y === 10 && x >= 7 && x <= 9) return shade(CARROT, n)
      if (y <= 5 && y % 3 === 1 && (x === 7 || x === 8)) return shade(COAL, n)
      return shade(base, n)
    }
    // きの はこの まんなかに ダイヤが はまっている
    case 'musicbox': {
      const n = (noise - 0.5) * 0.16
      if (x === 0 || y === 0 || x === TEXTURE_SIZE - 1 || y === TEXTURE_SIZE - 1) return shade(base, -0.4)
      const gem = Math.abs(x - 7.5) + Math.abs(y - 7.5)
      if (gem < 3.5) return shade(DIAMOND, gem < 1.5 ? 0.4 : n)
      return shade(base, y % 4 === 3 ? -0.2 : n)
    }
    // たての リボン
    case 'gift': return shade(x === 7 || x === 8 ? RIBBON : base, (noise - 0.5) * 0.12)
    // うえに ほのお、その したに しん、のこりは ろう
    case 'candle': {
      const n = (noise - 0.5) * 0.12
      if (y >= 12) return shade(FLAME, (x === 7 || x === 8) && y <= 13 ? 0.6 : n)
      if (y === 11) return shade(COAL, n)
      return shade(base, y === 10 && x % 5 === 2 ? -0.15 : n)
    }
    // にじは だんごとに いろを かえる
    case 'rainbow': return shade(RAINBOW[Math.floor((TEXTURE_SIZE - 1 - y) * RAINBOW.length / TEXTURE_SIZE)], (noise - 0.5) * 0.1)
    // たなに いろとりどりの ほんが 2だん
    case 'bookshelf': {
      if (y === 0 || y === 7 || y === 8 || y === TEXTURE_SIZE - 1 || x === 0 || x === TEXTURE_SIZE - 1) return shade(PLANK, -0.2)
      const book = BOOKS[(Math.floor(x / 2) + (y > 7 ? 3 : 0)) % BOOKS.length]
      return x % 2 === 1 && noise > 0.7 ? shade(book, -0.45) : shade(book, (y === 2 || y === 11) ? 0.3 : (noise - 0.5) * 0.16)
    }
    default: return shade(base, pattern(material, x, y, noise))
  }
}

/**
 * ざいりょうの いろに もようを つけた RGBA のドット（テクスチャ用）。face で うえ・よこ・したの めんを えらぶ。
 * すきまの ある ブロックと くさばなは、すきまを すきとおらせる。むきだけ ちがう かいだんは おなじ もよう。
 */
export function blockPixels(material: Material, face: Face = 'side'): Uint8Array {
  const look = (MATERIAL_DEFS.find(m => m.id === material)?.stairs !== undefined ? 'stairs' : material) as Material
  const index = MATERIAL_DEFS.findIndex(m => m.id === look)
  const base = hex(MATERIAL_DEFS[index].color)
  const random = seeded(index * 977 + 13 + FACE_SEEDS[face])
  const data = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4)
  for (let y = 0; y < TEXTURE_SIZE; y++) for (let x = 0; x < TEXTURE_SIZE; x++) {
    const noise = random()
    const plant = sprite(look, x, y, noise, base)
    const color = plant !== undefined ? plant
      : hole(look, x, y) ? null
        : face === 'side' ? side(look, x, y, noise, base) : cap(look, face, x, y, noise, base)
    const i = (y * TEXTURE_SIZE + x) * 4
    if (!color) continue
    data[i] = color[0]
    data[i + 1] = color[1]
    data[i + 2] = color[2]
    data[i + 3] = 255
  }
  return data
}
