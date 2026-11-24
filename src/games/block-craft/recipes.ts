import type { Material } from './world'

/** クラフトだいで つくる ブロック。ざいりょうの ならびは じゅんばんを とわない。 */
export type Recipe = { result: Material; ingredients: readonly Material[] }

export const RECIPES = [
  { result: 'torch', ingredients: ['wood', 'lamp'] },
  { result: 'fence', ingredients: ['wood', 'wood', 'plank'] },
  { result: 'door', ingredients: ['plank', 'plank', 'plank'] },
  { result: 'bed', ingredients: ['plank', 'cloud', 'cloud'] },
  { result: 'note', ingredients: ['plank', 'plank', 'crystal'] },
  { result: 'bomb', ingredients: ['sand', 'sand', 'lava'] },
  { result: 'cake', ingredients: ['honey', 'snow', 'melon'] },
  { result: 'slab', ingredients: ['stone', 'stone'] },
  { result: 'stairs', ingredients: ['plank', 'plank', 'wood'] },
  // つくった たいまつも ざいりょうに なる
  { result: 'jack', ingredients: ['pumpkin', 'torch'] },
] as const satisfies readonly Recipe[]

/** クラフトだいに ならべられる かず。 */
export const CRAFT_SLOTS = 3
export type CraftedMaterial = typeof RECIPES[number]['result']
/** つくるまで パレットで「？」に なる ブロック。 */
export const CRAFTED: readonly Material[] = RECIPES.map(r => r.result)
export const isCrafted = (material: Material): material is CraftedMaterial => CRAFTED.includes(material)
/** クラフトだいの ざいりょうの ならび（レシピに でてくる じゅん）。 */
export const INGREDIENTS: readonly Material[] = [...new Set(RECIPES.flatMap(r => r.ingredients))]

const sorted = (materials: readonly Material[]) => [...materials].sort().join(',')
/** ならべた ざいりょうで できる ブロック。ぴったり あう レシピが なければ null。 */
export function craftResult(slots: readonly Material[]): CraftedMaterial | null {
  const wanted = sorted(slots)
  return RECIPES.find(r => sorted(r.ingredients) === wanted)?.result ?? null
}
