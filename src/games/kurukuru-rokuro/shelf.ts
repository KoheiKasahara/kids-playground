import { isGlazeId, type GlazeId } from './paint'
import { isProfile, roundProfile, type PotKind, type Profile, POT_KINDS } from './pottery'

/**
 * つくった うつわを かざる「たな」。この端末の localStorage にだけ のこす。
 * 保存できない環境（プライベートモード・容量いっぱい）でも、あそびは つづけられる。
 */
export const SHELF_STORAGE_KEY = 'kids-playground:kurukuru-rokuro:shelf'
export const SHELF_SIZE = 12

export type ShelfItem = {
  id: number
  kind: PotKind
  base: GlazeId | null
  profile: Profile
  /** やきあがりの 小さな しゃしん（data URL）。とれなかった ときは シルエットで かわりに 見せる。 */
  thumbnail?: string
}

function isShelfItem(value: unknown): value is ShelfItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<ShelfItem>
  return (
    typeof item.id === 'number' && Number.isFinite(item.id) &&
    typeof item.kind === 'string' && item.kind in POT_KINDS &&
    (item.base === null || isGlazeId(item.base)) &&
    isProfile(item.profile) &&
    (item.thumbnail === undefined || (typeof item.thumbnail === 'string' && item.thumbnail.startsWith('data:image/')))
  )
}

export function readShelf(): ShelfItem[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SHELF_STORAGE_KEY) ?? '[]')
    return Array.isArray(value) ? value.filter(isShelfItem).slice(0, SHELF_SIZE) : []
  } catch {
    return []
  }
}

function write(items: ShelfItem[]): boolean {
  try {
    localStorage.setItem(SHELF_STORAGE_KEY, JSON.stringify(items))
    return true
  } catch {
    return false
  }
}

/** あたらしい うつわを たなの さいしょに おく。いっぱいなら いちばん ふるいものを おろす。 */
export function addToShelf(item: Omit<ShelfItem, 'id'>, now = Date.now()): ShelfItem[] {
  const entry: ShelfItem = { ...item, id: now, profile: roundProfile(item.profile) }
  const items = [entry, ...readShelf().filter(existing => existing.id !== now)].slice(0, SHELF_SIZE)
  if (write(items)) return items
  // 容量が たりないときは、ふるい しゃしんから へらして もう一度。
  for (let keep = items.length - 1; keep >= 1; keep--) {
    const lighter = items.slice(0, keep)
    if (write(lighter)) return lighter
  }
  const withoutPhoto = { ...entry, thumbnail: undefined }
  return write([withoutPhoto]) ? [withoutPhoto] : readShelf()
}
