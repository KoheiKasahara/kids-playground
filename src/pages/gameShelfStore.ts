import { useSyncExternalStore } from 'react'
import { GAME_CATALOG, gameRoutePath } from '../games/gameCatalog'

/**
 * ホームの「おきにいり」「さいきん あそんだ」に並べるゲームidの保存先。
 * アカウントやサーバーを持たないため、この端末のlocalStorageだけに保存する。
 * キーはアプリ名・用途・版で名前空間を分け、各ゲームの保存キーと衝突しないようにする。
 * localStorageが使えない環境（プライベートブラウズ等）でもメモリ上の値でその場は動き、
 * ホームの「ぜんぶの ゲーム」一覧と並び順はこの保存内容に一切左右されない。
 */
export const FAVORITE_GAMES_STORAGE_KEY = 'kids-playground:favorite-games:v1'
export const RECENT_GAMES_STORAGE_KEY = 'kids-playground:recent-games:v1'
export const MAX_RECENT_GAMES = 6

const KNOWN_GAME_IDS = new Set(GAME_CATALOG.map((game) => game.id))
const EMPTY: readonly string[] = []

// 壊れた値・同じキーに書かれた別形式の値・削除済みゲームのidが入っていても、
// 例外で一覧を止めず、今あるゲームのidだけを重複なしで使う。
function sanitizeGameIds(value: unknown, maxLength: number): readonly string[] {
  if (!Array.isArray(value)) return EMPTY
  const ids = value.filter(
    (id): id is string => typeof id === 'string' && KNOWN_GAME_IDS.has(id),
  )
  return [...new Set(ids)].slice(0, maxLength)
}

function createGameIdListStore(storageKey: string, maxLength: number) {
  let cached: readonly string[] | undefined
  const listeners = new Set<() => void>()

  function read(): readonly string[] {
    try {
      const raw = window.localStorage.getItem(storageKey)
      return raw === null ? EMPTY : sanitizeGameIds(JSON.parse(raw), maxLength)
    } catch {
      return EMPTY
    }
  }

  function get(): readonly string[] {
    if (cached === undefined) cached = read()
    return cached
  }

  function set(next: readonly string[]): void {
    const previous = get()
    if (next.length === previous.length && next.every((id, index) => id === previous[index])) {
      return
    }
    cached = next
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next))
    } catch {
      // 保存できなくても、メモリ上のキャッシュで今のホーム表示だけは切り替える。
    }
    listeners.forEach((listener) => listener())
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  function reset(): void {
    cached = undefined
  }

  return { get, set, subscribe, reset }
}

const favoriteGames = createGameIdListStore(FAVORITE_GAMES_STORAGE_KEY, KNOWN_GAME_IDS.size)
const recentGames = createGameIdListStore(RECENT_GAMES_STORAGE_KEY, MAX_RECENT_GAMES)

/** おきにいりに入れた順のゲームid。 */
export function useFavoriteGameIds(): readonly string[] {
  return useSyncExternalStore(favoriteGames.subscribe, favoriteGames.get, () => EMPTY)
}

/** 最後に遊んだものが先頭のゲームid（最大 MAX_RECENT_GAMES 件）。 */
export function useRecentGameIds(): readonly string[] {
  return useSyncExternalStore(recentGames.subscribe, recentGames.get, () => EMPTY)
}

/** 後から入れたものを末尾へ足し、すでに並んでいるゲームの位置は動かさない。 */
export function toggleFavoriteGame(gameId: string): void {
  if (!KNOWN_GAME_IDS.has(gameId)) return
  const current = favoriteGames.get()
  favoriteGames.set(
    current.includes(gameId) ? current.filter((id) => id !== gameId) : [...current, gameId],
  )
}

/** ゲーム内の画面（/games/<slug>/play など）も、そのゲームを開いたものとして扱う。 */
export function findGameIdByPathname(pathname: string): string | undefined {
  return GAME_CATALOG.find((game) => {
    const gamePath = gameRoutePath(game.slug)
    return pathname === gamePath || pathname.startsWith(`${gamePath}/`)
  })?.id
}

/** ゲームのURLを開いたときに呼び、そのゲームを「さいきん あそんだ」の先頭へ置く。 */
export function recordRecentGameVisit(pathname: string): void {
  const gameId = findGameIdByPathname(pathname)
  if (gameId === undefined) return
  recentGames.set(
    [gameId, ...recentGames.get().filter((id) => id !== gameId)].slice(0, MAX_RECENT_GAMES),
  )
}

/** テストで localStorage を差し替えたあと、次の読み取りで保存値を読み直すための関数。 */
export function resetGameShelfCache(): void {
  favoriteGames.reset()
  recentGames.reset()
}
