import { expect, it } from 'vitest'
import { blockPixels, TEXTURE_SIZE } from './textures'
import { MATERIALS } from './world'

it('draws an opaque, patterned, repeatable texture for every material', () => {
  const textures = MATERIALS.map(m => blockPixels(m.id))
  for (const pixels of textures) {
    expect(pixels).toHaveLength(TEXTURE_SIZE * TEXTURE_SIZE * 4)
    const colors = new Set<string>()
    for (let i = 0; i < pixels.length; i += 4) {
      expect(pixels[i + 3]).toBe(255)
      colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
    }
    expect(colors.size).toBeGreaterThan(1)
  }
  expect(blockPixels('brick')).toEqual(blockPixels('brick'))
  expect(new Set(textures.map(pixels => pixels.join(','))).size).toBe(MATERIALS.length)
})
