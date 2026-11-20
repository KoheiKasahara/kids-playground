import { expect, it } from 'vitest'
import { blockPixels, TEXTURE_SIZE } from './textures'
import { MATERIAL_DEFS, MATERIALS } from './world'

it('draws an opaque, patterned, repeatable texture for every material, with see-through gaps only where it has them', () => {
  const textures = MATERIALS.map(m => blockPixels(m.id))
  for (const [index, pixels] of textures.entries()) {
    expect(pixels).toHaveLength(TEXTURE_SIZE * TEXTURE_SIZE * 4)
    const colors = new Set<string>()
    const alphas = new Set<number>()
    for (let i = 0; i < pixels.length; i += 4) {
      alphas.add(pixels[i + 3])
      if (pixels[i + 3]) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
    }
    // さく・ひらいた ドアは すきまが すけて、のこりは ふとうめい
    expect([...alphas].sort()).toEqual(MATERIAL_DEFS[index].cutout ? [0, 255] : [255])
    expect(colors.size).toBeGreaterThan(1)
  }
  expect(blockPixels('brick')).toEqual(blockPixels('brick'))
  expect(new Set(textures.map(pixels => pixels.join(','))).size).toBe(MATERIALS.length)
})
