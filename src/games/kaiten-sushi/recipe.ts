// おすしの くみあわせ（レシピ）と、なまえ・おまかせ・ほぞんデータの たしかめ。

import {
  MAX_TOPPINGS, NETAS, PLATES, RICES, STYLES, TOPPINGS, isNeta, isPlate, isRice, isStyle, isTopping,
  netaDef, riceDef, toppingDef,
  type NetaId, type PlateId, type RiceId, type StyleId, type ToppingId,
} from './data'

export type Recipe = {
  style: StyleId
  rice: RiceId
  neta: NetaId
  toppings: readonly ToppingId[]
  plate: PlateId
}

export const DEFAULT_RECIPE: Recipe = { style: 'nigiri', rice: 'shiro', neta: 'maguro', toppings: [], plate: 'ao' }

/** おなじ くみあわせなら おなじ もじれつ（絵の キャッシュに つかう）。トッピングは じゅんばんを そろえる。 */
export function recipeKey(recipe: Recipe): string {
  const order = TOPPINGS.map(t => t.id)
  const toppings = [...recipe.toppings].sort((a, b) => order.indexOf(a) - order.indexOf(b))
  return `${recipe.style}.${recipe.rice}.${recipe.neta}.${toppings.join('+')}.${recipe.plate}`
}

/** トッピングを つけたり はずしたり。いっぱいなら いちばん ふるい ものを はずして いれかえる。 */
export function toggleTopping(toppings: readonly ToppingId[], id: ToppingId): ToppingId[] {
  if (toppings.includes(id)) return toppings.filter(t => t !== id)
  const next = [...toppings, id]
  return next.length > MAX_TOPPINGS ? next.slice(next.length - MAX_TOPPINGS) : next
}

/** おすしの なまえ。「あぶり サーモンの にぎり」「きゅうりまき」など。 */
export function recipeName(recipe: Recipe): string {
  const neta = netaDef(recipe.neta).name
  const base = {
    nigiri: `${neta}の にぎり`,
    gunkan: `${neta}の ぐんかん`,
    maki: `${neta}まき`,
    temaki: `${neta}の てまき`,
  }[recipe.style]
  const prefix = recipePrefix(recipe)
  return prefix ? `${prefix} ${base}` : base
}

function recipePrefix(recipe: Recipe): string | null {
  if (recipe.toppings.includes('kinpaku') || recipe.plate === 'kin') return 'きらきら'
  if (recipe.toppings.includes('aburi')) return 'あぶり'
  if (recipe.toppings.length >= MAX_TOPPINGS) return 'もりもり'
  return null
}

/** なまえの したに だす こまかい ないよう。「しろシャリ・わさび・マヨ」 */
export function recipeDetail(recipe: Recipe): string {
  return [`${riceDef(recipe.rice).name}シャリ`, ...recipe.toppings.map(t => toppingDef(t).name)].join('・')
}

/** わさびいり なら おきゃくさんが「ツーン！」と なる。 */
export function isSpicy(recipe: Recipe): boolean {
  return recipe.toppings.includes('wasabi')
}

/** きんぱく か きんの おさら なら「キラキラ！」。 */
export function isSparkly(recipe: Recipe): boolean {
  return recipe.toppings.includes('kinpaku') || recipe.plate === 'kin'
}

const pick = <T>(list: readonly T[], random: () => number): T => list[Math.min(list.length - 1, Math.floor(random() * list.length))]

/** 「おまかせ」。ネタに にあう かたちが でやすい。 */
export function randomRecipe(random: () => number = Math.random): Recipe {
  const neta = pick(NETAS, random)
  const form = neta.form
  let style: StyleId
  const r = random()
  if (form === 'grain' || form === 'paste') style = r < .6 ? 'gunkan' : r < .8 ? 'temaki' : pick(STYLES, random).id
  else if (form === 'veg') style = r < .5 ? 'maki' : pick(STYLES, random).id
  else style = r < .55 ? 'nigiri' : pick(STYLES, random).id
  const rice = random() < .4 ? 'shiro' : pick(RICES, random).id
  const count = Math.floor(random() * 3)
  let toppings: ToppingId[] = []
  for (let i = 0; i < count; i++) toppings = toggleTopping(toppings, pick(TOPPINGS, random).id)
  return { style, rice, neta: neta.id, toppings: [...new Set(toppings)], plate: pick(PLATES, random).id }
}

/** ほぞんした データから レシピを もどす。おかしな ものは null。 */
export function parseRecipe(data: unknown): Recipe | null {
  if (!data || typeof data !== 'object') return null
  const { style, rice, neta, toppings, plate } = data as Record<string, unknown>
  if (!isStyle(style) || !isRice(rice) || !isNeta(neta) || !isPlate(plate) || !Array.isArray(toppings)) return null
  const list = [...new Set(toppings.filter(isTopping))].slice(0, MAX_TOPPINGS)
  return { style, rice, neta, toppings: list, plate }
}
