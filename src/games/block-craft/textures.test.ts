import { expect, it } from 'vitest'
import { blockPixels, FACED, TEXTURE_SIZE } from './textures'
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
    // さく・ひらいた ドア・ばってんの くさばなは すきまが すけて、のこりは ふとうめい
    expect([...alphas].sort()).toEqual(MATERIAL_DEFS[index].cutout || MATERIAL_DEFS[index].cross ? [0, 255] : [255])
    expect(colors.size).toBeGreaterThan(1)
  }
  expect(blockPixels('brick')).toEqual(blockPixels('brick'))
  // むきだけ ちがう かいだんは おなじ もよう
  const looks = MATERIALS.filter(m => !('stairs' in m) || m.stairs === 0)
  expect(new Set(looks.map(m => blockPixels(m.id).join(','))).size).toBe(looks.length)
  expect(new Set(MATERIALS.filter(m => 'stairs' in m).map(m => blockPixels(m.id).join(','))).size).toBe(1)
})

it('draws a different top and bottom for blocks like grass and logs', () => {
  for (const material of FACED) {
    const [side, top, bottom] = (['side', 'top', 'bottom'] as const).map(face => blockPixels(material, face).join(','))
    expect(top).not.toBe(side)
    expect(bottom).not.toBe(side)
  }
  // くさの したは つち
  expect(blockPixels('grass', 'bottom')).not.toEqual(blockPixels('grass', 'top'))
})
