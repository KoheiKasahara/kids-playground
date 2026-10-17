import { describe, expect, test } from 'vitest'
import { MAX_TOPPINGS, NETAS, PLATES, RICES, STYLES, TOPPINGS } from './data'
import { DEFAULT_RECIPE, isSparkly, isSpicy, parseRecipe, randomRecipe, recipeDetail, recipeKey, recipeName, toggleTopping } from './recipe'
import { rng } from './pixel'

describe('マスターデータ', () => {
  test.each([
    ['かたち', STYLES], ['シャリ', RICES], ['ネタ', NETAS], ['トッピング', TOPPINGS], ['おさら', PLATES],
  ] as const)('%s の id と なまえが かさならない', (_label, list) => {
    expect(new Set(list.map(item => item.id)).size).toBe(list.length)
    expect(new Set(list.map(item => item.name)).size).toBe(list.length)
  })
})

describe('レシピ', () => {
  test('かたちごとの なまえ', () => {
    expect(recipeName(DEFAULT_RECIPE)).toBe('まぐろの にぎり')
    expect(recipeName({ ...DEFAULT_RECIPE, style: 'gunkan', neta: 'ikura' })).toBe('いくらの ぐんかん')
    expect(recipeName({ ...DEFAULT_RECIPE, style: 'maki', neta: 'kyuri' })).toBe('きゅうりまき')
    expect(recipeName({ ...DEFAULT_RECIPE, style: 'temaki', neta: 'salmon' })).toBe('サーモンの てまき')
  })

  test('トッピングや おさらで なまえに かざりが つく', () => {
    expect(recipeName({ ...DEFAULT_RECIPE, neta: 'salmon', toppings: ['aburi'] })).toBe('あぶり サーモンの にぎり')
    expect(recipeName({ ...DEFAULT_RECIPE, plate: 'kin' })).toBe('きらきら まぐろの にぎり')
    expect(recipeName({ ...DEFAULT_RECIPE, toppings: ['negi', 'mayo', 'lemon'] })).toBe('もりもり まぐろの にぎり')
    expect(recipeDetail({ ...DEFAULT_RECIPE, rice: 'aka', toppings: ['wasabi', 'negi'] })).toBe('あかシャリ・わさび・ねぎ')
  })

  test('トッピングは 3つまで。4つめを えらぶと いちばん ふるい ものと いれかわる', () => {
    let toppings = toggleTopping([], 'wasabi')
    toppings = toggleTopping(toppings, 'negi')
    toppings = toggleTopping(toppings, 'mayo')
    expect(toppings).toEqual(['wasabi', 'negi', 'mayo'])
    toppings = toggleTopping(toppings, 'lemon')
    expect(toppings).toEqual(['negi', 'mayo', 'lemon'])
    expect(toggleTopping(toppings, 'mayo')).toEqual(['negi', 'lemon'])
  })

  test('トッピングの じゅんばんが ちがっても おなじ キー', () => {
    expect(recipeKey({ ...DEFAULT_RECIPE, toppings: ['mayo', 'negi'] })).toBe(recipeKey({ ...DEFAULT_RECIPE, toppings: ['negi', 'mayo'] }))
    expect(recipeKey(DEFAULT_RECIPE)).not.toBe(recipeKey({ ...DEFAULT_RECIPE, rice: 'kuro' }))
  })

  test('わさびは からい、きんは きらきら', () => {
    expect(isSpicy({ ...DEFAULT_RECIPE, toppings: ['wasabi'] })).toBe(true)
    expect(isSpicy(DEFAULT_RECIPE)).toBe(false)
    expect(isSparkly({ ...DEFAULT_RECIPE, toppings: ['kinpaku'] })).toBe(true)
    expect(isSparkly({ ...DEFAULT_RECIPE, plate: 'kin' })).toBe(true)
    expect(isSparkly(DEFAULT_RECIPE)).toBe(false)
  })

  test('おまかせは いつも ただしい くみあわせ', () => {
    const random = rng(7)
    for (let i = 0; i < 300; i++) {
      const recipe = randomRecipe(random)
      expect(parseRecipe(recipe)).toEqual(recipe)
      expect(recipe.toppings.length).toBeLessThanOrEqual(MAX_TOPPINGS)
      expect(new Set(recipe.toppings).size).toBe(recipe.toppings.length)
    }
  })

  test('ほぞんデータの おかしな レシピは すてる', () => {
    expect(parseRecipe(null)).toBeNull()
    expect(parseRecipe({ ...DEFAULT_RECIPE, neta: 'pizza' })).toBeNull()
    expect(parseRecipe({ ...DEFAULT_RECIPE, toppings: 'mayo' })).toBeNull()
    expect(parseRecipe({ ...DEFAULT_RECIPE, toppings: ['mayo', 'mayo', 'cheese', 'negi', 'lemon', 'tare'] })?.toppings).toEqual(['mayo', 'negi', 'lemon'])
  })
})
