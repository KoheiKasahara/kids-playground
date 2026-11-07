// まちづくりで おける パーツの いちらん（マスタデータ）。
// え（SVG）は PartArt.tsx、おきかたの きまりは town.ts が もつ。

export type CategoryId = 'way' | 'home' | 'shop' | 'town' | 'nature' | 'fun'

export type BuildingId =
  | 'house' | 'house-blue' | 'apartment' | 'tower'
  | 'shop' | 'cake' | 'office' | 'depart' | 'factory'
  | 'school' | 'hospital' | 'fire' | 'police' | 'station'
  | 'tree' | 'sakura' | 'flowers' | 'farm' | 'park' | 'fountain'
  | 'ferris' | 'castle' | 'tv-tower' | 'windmill'

export type NetworkId = 'road' | 'rail'
/** マスに のる もの。みちと せんろが かさなると ふみきり（crossing）になる。 */
export type TilePart = BuildingId | NetworkId | 'crossing'
/** えらべる どうぐ。water は じめんを かえ、erase は けす。 */
export type ToolId = BuildingId | NetworkId | 'water' | 'erase'

export type PartDefinition = {
  id: Exclude<ToolId, 'erase'>
  label: string
  category: CategoryId
  /** みちに つながると すむ ひとの かず（いえ だけ）。 */
  residents?: number
  /** みちが となりに ないと「みちが ほしい」しるしを だす たてもの。 */
  needsRoad?: boolean
}

export const CATEGORIES: readonly { id: CategoryId; label: string; icon: Exclude<ToolId, 'erase'> }[] = [
  { id: 'way', label: 'みちと かわ', icon: 'road' },
  { id: 'home', label: 'おうち', icon: 'house' },
  { id: 'shop', label: 'おみせ', icon: 'shop' },
  { id: 'town', label: 'まちの たてもの', icon: 'school' },
  { id: 'nature', label: 'しぜん', icon: 'tree' },
  { id: 'fun', label: 'たのしい ところ', icon: 'ferris' },
]

export const PARTS: readonly PartDefinition[] = [
  { id: 'road', label: 'みち', category: 'way' },
  { id: 'rail', label: 'せんろ', category: 'way' },
  { id: 'water', label: 'かわ', category: 'way' },
  { id: 'house', label: 'あかい おうち', category: 'home', residents: 4, needsRoad: true },
  { id: 'house-blue', label: 'あおい おうち', category: 'home', residents: 4, needsRoad: true },
  { id: 'apartment', label: 'マンション', category: 'home', residents: 12, needsRoad: true },
  { id: 'tower', label: 'タワーマンション', category: 'home', residents: 30, needsRoad: true },
  { id: 'shop', label: 'コンビニ', category: 'shop', needsRoad: true },
  { id: 'cake', label: 'ケーキやさん', category: 'shop', needsRoad: true },
  { id: 'office', label: 'ビル', category: 'shop', needsRoad: true },
  { id: 'depart', label: 'デパート', category: 'shop', needsRoad: true },
  { id: 'factory', label: 'こうじょう', category: 'shop', needsRoad: true },
  { id: 'school', label: 'がっこう', category: 'town', needsRoad: true },
  { id: 'hospital', label: 'びょういん', category: 'town', needsRoad: true },
  { id: 'fire', label: 'しょうぼうしょ', category: 'town', needsRoad: true },
  { id: 'police', label: 'けいさつ', category: 'town', needsRoad: true },
  { id: 'station', label: 'えき', category: 'town', needsRoad: true },
  { id: 'tree', label: 'き', category: 'nature' },
  { id: 'sakura', label: 'さくら', category: 'nature' },
  { id: 'flowers', label: 'おはなばたけ', category: 'nature' },
  { id: 'farm', label: 'はたけ', category: 'nature' },
  { id: 'park', label: 'こうえん', category: 'nature' },
  { id: 'fountain', label: 'ふんすい', category: 'nature' },
  { id: 'ferris', label: 'かんらんしゃ', category: 'fun', needsRoad: true },
  { id: 'castle', label: 'おしろ', category: 'fun' },
  { id: 'tv-tower', label: 'タワー', category: 'fun', needsRoad: true },
  { id: 'windmill', label: 'ふうしゃ', category: 'fun' },
]

const PART_BY_ID = new Map<string, PartDefinition>(PARTS.map((part) => [part.id, part]))

export function findPart(id: string): PartDefinition | undefined {
  return PART_BY_ID.get(id)
}

export function partsInCategory(category: CategoryId): PartDefinition[] {
  return PARTS.filter((part) => part.category === category)
}

export function isBuilding(part: TilePart | null): part is BuildingId {
  return part !== null && part !== 'road' && part !== 'rail' && part !== 'crossing'
}

export function partLabel(part: TilePart): string {
  if (part === 'crossing') return 'ふみきり'
  return findPart(part)?.label ?? ''
}

export const ERASE_LABEL = 'けす'
