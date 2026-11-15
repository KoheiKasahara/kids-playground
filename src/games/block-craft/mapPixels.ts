import { MATERIAL_DEFS, type World } from './world'

const COLORS = MATERIAL_DEFS.map(m => {
  const value = Number.parseInt(m.color.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
})

/** うえから みた せかいの いろ（RGBA）。たかい ところほど あかるい。 */
export function mapPixels(world: World): Uint8ClampedArray<ArrayBuffer> {
  const pixels = new Uint8ClampedArray(world.area * 4)
  for (let z = 0; z < world.size; z++) for (let x = 0; x < world.size; x++) {
    const y = world.topY(x, z)
    const [r, g, b] = COLORS[world.codeAt(x, y, z) - 1] ?? [0, 0, 0]
    const light = 0.72 + Math.min(0.5, y / 36)
    const i = (x + z * world.size) * 4
    pixels[i] = r * light
    pixels[i + 1] = g * light
    pixels[i + 2] = b * light
    pixels[i + 3] = 255
  }
  return pixels
}
