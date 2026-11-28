import { expect, it } from 'vitest'
import { CRAFT_SLOTS, CRAFTED, craftResult, INGREDIENTS, isCrafted, RECIPES } from './recipes'
import { materialDef, PALETTE, type Material } from './world'

it('makes each crafted block from one recipe of palette blocks, in any order', () => {
  expect(new Set(CRAFTED).size).toBe(RECIPES.length)
  const shapes = RECIPES.map(r => [...r.ingredients].sort().join(','))
  expect(new Set(shapes).size).toBe(RECIPES.length)
  const palette = new Set<Material>(PALETTE.map(m => m.id))
  for (const [index, { result, ingredients }] of RECIPES.entries()) {
    expect(palette.has(result)).toBe(true)
    expect(ingredients.length).toBeGreaterThanOrEqual(2)
    expect(ingredients.length).toBeLessThanOrEqual(CRAFT_SLOTS)
    for (const ingredient of ingredients) {
      expect(palette.has(ingredient)).toBe(true)
      // けいとは ひつじ しだいなので つかわない。つくった ブロックは まえの レシピで つくれる
      expect(materialDef(ingredient).wool).toBeUndefined()
      if (isCrafted(ingredient)) expect(RECIPES.slice(0, index).some(r => r.result === ingredient)).toBe(true)
    }
    expect(craftResult([...ingredients])).toBe(result)
    expect(craftResult([...ingredients].reverse())).toBe(result)
  }
  expect(INGREDIENTS).toEqual([...new Set(RECIPES.flatMap(r => r.ingredients))])
})

it('makes nothing from a partial, extra or unknown set', () => {
  expect(craftResult([])).toBeNull()
  expect(craftResult(['plank', 'plank'])).toBeNull()
  expect(craftResult(['plank', 'plank', 'plank', 'plank'])).toBeNull()
  expect(craftResult(['stone', 'stone', 'stone'])).toBeNull()
  expect(craftResult(['lamp', 'wood'])).toBe('torch')
  // つくった ブロックも ざいりょうに なる
  expect(craftResult(['torch', 'honey'])).toBe('candle')
  expect(craftResult(['snow', 'snow'])).toBeNull()
})

it('starts the palette with the crafting table and keeps every crafted block in it', () => {
  expect(PALETTE[0].id).toBe('workbench')
  expect(isCrafted('workbench')).toBe(false)
  for (const made of CRAFTED) expect(PALETTE.some(m => m.id === made)).toBe(true)
})
