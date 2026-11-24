import type { Hull } from './voyage'

// Each horizontal section is a little top-down pixel painting. Rotate every
// section about the keel, foreshorten it, then stack it one pixel above the last.
// The nozzle is its own stack and can turn independently of the hull.
const length = 96
const beam = 34
const frame = 108
export const keel = { x: 54, y: 62 }
const pitch = 0.61
const headings = 72
type Stack = Uint32Array[]
type Swatch = string | ((x: number, y: number, z: number) => string)
const inks = new Map<string, number>()
function ink(hex: string) {
  let value = inks.get(hex)
  if (value !== undefined) return value
  const rgb = Number.parseInt(hex, 16)
  value = (0xff000000 | (rgb & 255) << 16 | (rgb & 0xff00) | (rgb >>> 16)) >>> 0
  inks.set(hex, value)
  return value
}

function paint(stack: Stack, x1: number, x2: number, y1: number, y2: number, z1: number, z2: number,
  swatch: Swatch, inside?: (x: number, y: number, z: number) => boolean) {
  for (let z = z1; z <= z2; z++) {
    const slice = stack[z] ??= new Uint32Array(length * beam)
    for (let y = y1; y <= y2; y++) {
      for (let x = x1; x <= x2; x++) {
        if (!inside || inside(x, y, z)) {
          slice[(y + beam / 2) * length + x + length / 2] = ink(typeof swatch === 'string' ? swatch : swatch(x, y, z))
        }
      }
    }
  }
}

function makeHull(kind: Hull) {
  const s: Stack = []
  const blue = kind === 'skipper'
  const mail = kind === 'mail'
  const boss = kind === 'flagship'
  const light = blue ? 'fff3ce' : mail ? 'fff0ab' : 'ffd2a7'
  const accent = blue ? '238a9c' : mail ? '4b9b65' : 'c65347'
  const dark = blue ? '254456' : mail ? '32595a' : '533e51'
  const stripe = blue ? '539eaf' : mail ? 'dfaa49' : 'e27654'
  const rim = (x: number) => {
    const t = (x + 42) / 86
    return 14 * Math.min(1, 0.28 + t * 4.5, Math.max(0, (1 - t) * 3.3)) * (0.91 + 0.09 * Math.sin(Math.PI * t))
  }
  paint(s, -42, 44, -14, 14, 0, 8, (x, y, z) => {
    const edge = rim(x) - Math.abs(y)
    if (z === 8) {
      if (edge < 1.5 || x < -39) return light
      if (edge < 2.6) return dark
      if ((y + 16) % 4 === 0 || (x + y * 5 + 96) % 23 === 0) return 'af845c'
      return ((y + 16) >> 2) % 2 ? 'e4bd80' : 'f0ce94'
    }
    if (z <= 1) return '563e48'
    if (z < 4) return blue ? 'ba6047' : '9b504b'
    if (z === 4) return 'f2c98f'
    if (z === 6 && x % 7 === 0) return 'e9c882'
    if (z === 7) return accent
    return y > 0 ? dark : stripe
  }, (x, y, z) => Math.abs(y) <= rim(x) - Math.max(0, 4 - z) * 0.7)

  const box = (x: number, y: number, w: number, d: number, bottom: number, top: number, wall: string, roof: string) =>
    paint(s, x, x + w - 1, y, y + d - 1, bottom, top, (u, v, z) =>
      z === top ? roof : (u === x || v === y + d - 1) ? wall : light)
  // Raised stern hatch, engine house and bridge with a continuous band of windows.
  box(-36, -6, 10, 13, 9, 11, dark, accent)
  paint(s, -34, -29, -4, 4, 12, 12, (_x, y) => y % 3 ? '446372' : '97acac')
  box(-23, -9, 37, 19, 9, 14, stripe, light)
  paint(s, -22, 12, -9, 9, 11, 12, (x, y) => (Math.abs(y) === 9 && (x + 27) % 6 < 3) ? dark : accent)
  box(-20, -7, 25, 15, 15, 16, dark, 'a1b5af')
  box(3, -8, 11, 17, 15, 21, accent, light)
  paint(s, 3, 13, -8, 8, 18, 20, (x, y) =>
    (x + 22) % 5 === 0 || (x === 13 && (y + 12) % 5 === 0) ? 'dfcfac' : '305366')
  box(1, -10, 15, 21, 22, 23, dark, light)
  box(5, -6, 7, 13, 24, 25, accent, stripe)

  // Steam funnels: shaded curved metal, painted bands and hollow mouths.
  for (const cx of (mail ? [-9] : [-16, -5])) {
    const top = boss ? 36 : 32
    paint(s, cx - 4, cx + 4, -4, 4, 16, top, (x, y, z) => {
      const r = (x - cx) ** 2 + y ** 2
      if (z === top) return r < 9 ? '243742' : '87948e'
      if (z >= top - 4 || z < 19) return y > 0 ? '344753' : '566272'
      if (z === 24 || z === 25) return blue ? 'fff0b2' : light
      return x < cx - 1 ? 'ffe097' : y > 1 ? 'bd7441' : 'edac50'
    }, (x, y) => (x - cx) ** 2 + y ** 2 <= 18)
  }

  // Dinghies in davits, bollards, rail posts and anchor chain.
  for (const side of [-1, 1]) {
    const cy = 11 * side
    paint(s, -21, -7, cy - 2, cy + 2, 10, 12, (x, y, z) =>
      z === 12 && y === cy && x % 4 ? 'a27855' : 'fff1c8',
    (x, y) => ((x + 14) / 7) ** 2 + ((y - cy) / 2.6) ** 2 <= 1)
    for (const x of [-36, -27, 18, 25, 32]) {
      const y = Math.round(rim(x) - 1) * side
      paint(s, x, x + 1, y, y, 9, 11, 'e4e4c8')
    }
    for (let x = 33; x <= 39; x++) {
      const y = Math.round((40 - x) / 2) * side
      paint(s, x, x, y, y, 9, 9, x % 2 ? dark : 'a6a99b')
    }
  }
  if (mail) {
    box(18, -6, 9, 10, 9, 16, 'ad7747', 'e6bb7a')
    box(26, -2, 6, 8, 9, 14, '8a654b', 'db9b62')
  }
  // Mast, cross-yard, beacon and a two-tone swallowtail pennant.
  const mast = boss ? 48 : 44
  paint(s, 7, 8, 0, 1, 25, mast, (x, _y, z) => z % 10 < 2 ? 'fff1bf' : x === 7 ? '344957' : 'ad9f80')
  paint(s, 7, 8, -6, 6, 33, 33, '796f63')
  paint(s, -2, 6, 0, 0, mast - 5, mast - 1, (x, _y, z) =>
    x < 1 || z === mast - 1 ? 'fff1c7' : accent, (x, _y, z) => x > 1 || Math.abs(mast - 3 - z) > 1)
  return s
}

function makeNozzle(): Stack {
  const s: Stack = []
  paint(s, -6, 7, -6, 6, 0, 4, (x, y, z) =>
    z === 4 ? 'd0ddca' : y > 2 || x < -2 ? '456578' : '749aa0',
  (x, y, z) => (x / 7) ** 2 + (y / 6.5) ** 2 < 1.1 - z * 0.06)
  paint(s, 0, 13, -3, 3, 4, 5, (x, _y, z) =>
    x > 11 ? '324b58' : z === 5 ? 'e0e3c8' : '637e85', (_x, y) => Math.abs(y) === 2 || Math.abs(y) === 3)
  return s
}

function rotateStack(stack: Stack, angle: number) {
  const canvas = document.createElement('canvas')
  canvas.width = frame
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  const image = ctx.createImageData(frame, canvas.height)
  const pixels = new Uint32Array(image.data.buffer)
  const cos = Math.cos(angle), sin = Math.sin(angle)
  // A column of the projected footprint looks up the same texel on every slice.
  for (let v = -29; v <= 29; v++) {
    for (let u = -47; u <= 47; u++) {
      const x = Math.round(u * cos + v / pitch * sin) + length / 2
      const y = Math.round(-u * sin + v / pitch * cos) + beam / 2
      if (x < 0 || x >= length || y < 0 || y >= beam) continue
      const texel = y * length + x
      // Adjacent projected rows overlap after a height offset. A nearer row
      // covers a farther one, with the top visible in the gaps between walls.
      for (let z = 0; z < stack.length; z++) {
        const color = stack[z]?.[texel]
        if (color) pixels[(keel.y + v - z) * frame + keel.x + u] = color
      }
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas
}

// Per-scene caches go out of scope when the game is left.
export function createShipyard() {
  const models = new Map<Hull | 'nozzle', Stack>()
  const frames = new Map<string, HTMLCanvasElement>()
  return (kind: Hull | 'nozzle', angle: number) => {
    const step = (Math.round(angle * headings / (2 * Math.PI)) % headings + headings) % headings
    const key = kind + step
    let sprite = frames.get(key)
    if (!sprite) {
      let model = models.get(kind)
      if (!model) {
        model = kind === 'nozzle' ? makeNozzle() : makeHull(kind)
        models.set(kind, model)
      }
      sprite = rotateStack(model, step * Math.PI * 2 / headings)
      frames.set(key, sprite)
    }
    return sprite
  }
}
