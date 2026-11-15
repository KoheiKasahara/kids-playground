// まちづくりで おける パーツの いちらん（マスタデータ）。
// え（SVG）は PartArt.tsx、3D は three/buildingModels.ts、おきかたの きまりは town.ts が もつ。

export type CategoryId = 'way' | 'home' | 'shop' | 'town' | 'nature' | 'fun'

export type BuildingId =
  | 'house' | 'house-blue' | 'apartment' | 'tower'
  | 'shop' | 'cake' | 'office' | 'depart' | 'factory'
  | 'school' | 'hospital' | 'fire' | 'police' | 'station'
  | 'tree' | 'sakura' | 'flowers' | 'farm' | 'park' | 'fountain'
  | 'ferris' | 'castle' | 'tv-tower' | 'windmill'
  | 'igloo' | 'lighthouse' | 'pine' | 'palm' | 'cactus' | 'snowman' | 'pyramid' | 'tent'
  | 'big-apartment' | 'supermarket' | 'airport' | 'forest' | 'pool' | 'stadium' | 'zoo'
  | 'icecream' | 'bakery' | 'heliport' | 'shrine'
  | 'mountain' | 'ranch' | 'beach'
  | 'merry' | 'coaster' | 'rocket' | 'circus'

export type NetworkId = 'road' | 'rail'
/** マスに のる もの。みちと せんろが かさなると ふみきり（crossing）になる。 */
export type TilePart = BuildingId | NetworkId | 'crossing'
/** じめんを かえる どうぐ。 */
export type GroundToolId = 'water' | 'sand' | 'snow'
/** えらべる どうぐ。water・sand・snow は じめんを かえ、erase は けす。 */
export type ToolId = BuildingId | NetworkId | GroundToolId | 'erase'

export type FootprintSize = readonly [cols: number, rows: number]

/**
 * おく ときに えらべる おおきさ。たてものの もとの マスかず（size）を この ばいに して おく。
 * 1 = ちいさい、2 = おおきい（よこ・たて 2ばい）、3 = とくだい（3ばい）。
 */
export type Scale = 1 | 2 | 3

export type PartDefinition = {
  id: Exclude<ToolId, 'erase'>
  label: string
  category: CategoryId
  /** みちに つながると すむ ひとの かず（いえ だけ）。おおきく おくと つかう マスの かずの ぶん ふえる。 */
  residents?: number
  /** みちが となりに ないと「みちが ほしい」しるしを だす たてもの。 */
  needsRoad?: boolean
  /** ちいさい ときに つかう マスの かず（よこ・たて）。ない ときは 1マス。 */
  size?: FootprintSize
}

export const CATEGORIES: readonly { id: CategoryId; label: string; icon: Exclude<ToolId, 'erase'> }[] = [
  { id: 'way', label: 'みちと じめん', icon: 'road' },
  { id: 'home', label: 'おうち', icon: 'house' },
  { id: 'shop', label: 'おみせ', icon: 'shop' },
  { id: 'town', label: 'まちの たてもの', icon: 'school' },
  { id: 'nature', label: 'しぜん', icon: 'tree' },
  { id: 'fun', label: 'たのしい ところ', icon: 'ferris' },
]

export const PARTS: readonly PartDefinition[] = [
  { id: 'road', label: 'みち', category: 'way' },
  { id: 'rail', label: 'せんろ', category: 'way' },
  { id: 'water', label: 'みず', category: 'way' },
  { id: 'sand', label: 'すな', category: 'way' },
  { id: 'snow', label: 'ゆき', category: 'way' },
  { id: 'house', label: 'あかい おうち', category: 'home', residents: 4, needsRoad: true },
  { id: 'house-blue', label: 'あおい おうち', category: 'home', residents: 4, needsRoad: true },
  { id: 'apartment', label: 'マンション', category: 'home', residents: 12, needsRoad: true },
  { id: 'tower', label: 'タワーマンション', category: 'home', residents: 30, needsRoad: true },
  { id: 'igloo', label: 'かまくら', category: 'home', residents: 2, needsRoad: true },
  { id: 'big-apartment', label: 'ながい マンション', category: 'home', residents: 24, needsRoad: true, size: [2, 1] },
  { id: 'shop', label: 'コンビニ', category: 'shop', needsRoad: true },
  { id: 'cake', label: 'ケーキやさん', category: 'shop', needsRoad: true },
  { id: 'icecream', label: 'アイスやさん', category: 'shop', needsRoad: true },
  { id: 'bakery', label: 'パンやさん', category: 'shop', needsRoad: true },
  { id: 'office', label: 'ビル', category: 'shop', needsRoad: true },
  { id: 'depart', label: 'デパート', category: 'shop', needsRoad: true },
  { id: 'factory', label: 'こうじょう', category: 'shop', needsRoad: true },
  { id: 'supermarket', label: 'スーパー', category: 'shop', needsRoad: true, size: [2, 1] },
  { id: 'school', label: 'がっこう', category: 'town', needsRoad: true },
  { id: 'hospital', label: 'びょういん', category: 'town', needsRoad: true },
  { id: 'fire', label: 'しょうぼうしょ', category: 'town', needsRoad: true },
  { id: 'police', label: 'けいさつ', category: 'town', needsRoad: true },
  { id: 'station', label: 'えき', category: 'town', needsRoad: true },
  { id: 'heliport', label: 'ヘリポート', category: 'town', needsRoad: true },
  { id: 'shrine', label: 'じんじゃ', category: 'town' },
  { id: 'lighthouse', label: 'とうだい', category: 'town' },
  { id: 'airport', label: 'くうこう', category: 'town', needsRoad: true, size: [2, 2] },
  { id: 'tree', label: 'き', category: 'nature' },
  { id: 'sakura', label: 'さくら', category: 'nature' },
  { id: 'pine', label: 'もみのき', category: 'nature' },
  { id: 'palm', label: 'やしのき', category: 'nature' },
  { id: 'cactus', label: 'サボテン', category: 'nature' },
  { id: 'flowers', label: 'おはなばたけ', category: 'nature' },
  { id: 'farm', label: 'はたけ', category: 'nature' },
  { id: 'park', label: 'こうえん', category: 'nature' },
  { id: 'fountain', label: 'ふんすい', category: 'nature' },
  { id: 'beach', label: 'すなはま', category: 'nature' },
  { id: 'ranch', label: 'ぼくじょう', category: 'nature', size: [2, 1] },
  { id: 'forest', label: 'もり', category: 'nature', size: [2, 2] },
  { id: 'mountain', label: 'やま', category: 'nature', size: [2, 2] },
  { id: 'ferris', label: 'かんらんしゃ', category: 'fun', needsRoad: true },
  { id: 'merry', label: 'メリーゴーランド', category: 'fun', needsRoad: true },
  { id: 'circus', label: 'サーカス', category: 'fun', needsRoad: true },
  { id: 'castle', label: 'おしろ', category: 'fun' },
  { id: 'tv-tower', label: 'タワー', category: 'fun', needsRoad: true },
  { id: 'windmill', label: 'ふうしゃ', category: 'fun' },
  { id: 'pyramid', label: 'ピラミッド', category: 'fun' },
  { id: 'tent', label: 'テント', category: 'fun' },
  { id: 'snowman', label: 'ゆきだるま', category: 'fun' },
  { id: 'rocket', label: 'ロケット', category: 'fun' },
  { id: 'pool', label: 'プール', category: 'fun', needsRoad: true, size: [2, 1] },
  { id: 'coaster', label: 'ジェットコースター', category: 'fun', needsRoad: true, size: [2, 2] },
  { id: 'stadium', label: 'スタジアム', category: 'fun', needsRoad: true, size: [2, 2] },
  { id: 'zoo', label: 'どうぶつえん', category: 'fun', needsRoad: true, size: [2, 2] },
]

const PART_BY_ID = new Map<string, PartDefinition>(PARTS.map((part) => [part.id, part]))

export function findPart(id: string): PartDefinition | undefined {
  return PART_BY_ID.get(id)
}

export function partsInCategory(category: CategoryId): PartDefinition[] {
  return PARTS.filter((part) => part.category === category)
}

/** まえに べつの なまえで あった パーツ（ほぞんを よむ ときに いまの なまえへ なおす）。 */
const RENAMED_PARTS: Readonly<Record<string, BuildingId>> = { camp: 'tent' }

/** ほぞんに かかれた パーツの なまえを いまの なまえに する。 */
export function currentPartId(id: string): string {
  return RENAMED_PARTS[id] ?? id
}

const ONE_TILE: FootprintSize = [1, 1]

/** ちいさい ときに つかう マスの かず（よこ・たて）。みちや どうぐは 1マス。 */
export function sizeOf(tool: ToolId | TilePart): FootprintSize {
  return findPart(tool)?.size ?? ONE_TILE
}

export function isGroundTool(tool: string): tool is GroundToolId {
  return tool === 'water' || tool === 'sand' || tool === 'snow'
}

export function isBuilding(part: TilePart | null): part is BuildingId {
  return part !== null && part !== 'road' && part !== 'rail' && part !== 'crossing'
}

/** おおきさを えらべる どうぐか（たてもの・しぜん・あそびば。みち・せんろ・じめん・けす は えらべない）。 */
export function isBuildingTool(tool: ToolId): tool is BuildingId {
  return !isGroundTool(tool) && tool !== 'erase' && isBuilding(tool)
}

export const SCALES: readonly { scale: Scale; label: string }[] = [
  { scale: 1, label: 'ちいさい' },
  { scale: 2, label: 'おおきい' },
  { scale: 3, label: 'とくだい' },
]

/** いちばん ながい へんが この マスかずを こえる おおきさは えらべない（ちずに おさまり、まちが うまらない）。 */
const MAX_SPAN = 4

/** その どうぐで えらべる おおきさ。みちや どうぐは ちいさい だけ。 */
export function scalesOf(tool: ToolId): Scale[] {
  if (!isBuildingTool(tool)) return [1]
  const [cols, rows] = sizeOf(tool)
  return SCALES.map((item) => item.scale).filter((scale) => Math.max(cols, rows) * scale <= MAX_SPAN)
}

/** えらんだ おおきさを、その どうぐで えらべる いちばん ちかい おおきさに する。 */
export function fitScale(tool: ToolId, scale: Scale): Scale {
  const scales = scalesOf(tool)
  return scales.filter((item) => item <= scale).at(-1) ?? 1
}

export function scaleLabel(scale: Scale): string {
  return SCALES.find((item) => item.scale === scale)?.label ?? ''
}

/** おおきさを かけた ときに つかう マスの かず（よこ・たて）。 */
export function spanOf(tool: ToolId | TilePart, scale: Scale = 1): FootprintSize {
  const [cols, rows] = sizeOf(tool)
  return [cols * scale, rows * scale]
}

/** 2マス いじょうを つかう たてものか（その おおきさで おく とき）。 */
export function isLarge(tool: ToolId | TilePart | null, scale: Scale = 1): tool is BuildingId {
  if (tool === null || isGroundTool(tool) || tool === 'erase' || !isBuilding(tool)) return false
  const [cols, rows] = spanOf(tool, scale)
  return cols * rows > 1
}

export function partLabel(part: TilePart): string {
  if (part === 'crossing') return 'ふみきり'
  return findPart(part)?.label ?? ''
}

export const ERASE_LABEL = 'けす'
