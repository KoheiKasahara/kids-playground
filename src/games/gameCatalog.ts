// ゲーム一覧の単一情報源（Single Source of Truth）。
// ホームのカード表示、ビルド時の静的HTML生成（src/build/staticRoutePages.ts）、
// ルート存在テストがすべてこのファイルを参照する。
// 新しいゲームを追加するときは、この配列に1件追加するだけで
// ホームのカードと固有URLの静的ページ生成が同時に揃うようにする。

export type GameCatalogEntry = {
  /** ゲームID。URLのslugと同じ値を使う。 */
  id: string
  slug: string
  title: string
  emoji: string
}

export const GAME_ROUTE_PREFIX = '/games'

export function gameRoutePath(slug: string): string {
  return `${GAME_ROUTE_PREFIX}/${slug}`
}

// id/title/emoji は既存の src/pages/Home.tsx と同じ並び順・内容を維持する。
export const GAME_CATALOG: readonly GameCatalogEntry[] = [
  { id: 'flag-quiz', slug: 'flag-quiz', title: 'こっきクイズ', emoji: '🌏' },
  { id: 'flag-pinball', slug: 'flag-pinball', title: 'こっきピンボール', emoji: '🎯' },
  { id: 'flag-roll-adventure', slug: 'flag-roll-adventure', title: 'こっきコロコロぼうけん', emoji: '🎢' },
  { id: 'domino-flag', slug: 'domino-flag', title: 'こっきドミノ', emoji: '🁣' },
  { id: 'flag-roll-maze', slug: 'flag-roll-maze', title: 'こっきころころめいろ', emoji: '🌀' },
  { id: 'flag-roll-puzzle', slug: 'flag-roll-puzzle', title: 'こっきコロコロパズル', emoji: '🧩' },
  { id: 'vegetable-quiz', slug: 'vegetable-quiz', title: 'おやさいクイズ', emoji: '🥕' },
  { id: 'fruit-quiz', slug: 'fruit-quiz', title: 'くだものクイズ', emoji: '🍎' },
  { id: 'working-vehicle-quiz', slug: 'working-vehicle-quiz', title: 'はたらくくるまクイズ', emoji: '🚒' },
  { id: 'math-quiz', slug: 'math-quiz', title: 'さんすうクイズ', emoji: '🔢' },
  { id: 'color-mix-quiz', slug: 'color-mix-quiz', title: 'いろまぜクイズ', emoji: '🎨' },
  { id: 'prefecture-quiz', slug: 'prefecture-quiz', title: '都道府県クイズ', emoji: '🗾' },
  { id: 'world-travel-quiz', slug: 'world-travel-quiz', title: 'せかい旅行クイズ', emoji: '✈️' },
  { id: 'japan-travel-quiz', slug: 'japan-travel-quiz', title: 'にほん旅行クイズ', emoji: '🗾' },
  { id: 'earth-globe', slug: 'earth-globe', title: 'ちきゅうぎ', emoji: '🌍' },
  { id: 'planet-globe', slug: 'planet-globe', title: 'たいようけい', emoji: '🪐' },
  { id: 'rail-builder', slug: 'rail-builder', title: '3Dせんろづくり', emoji: '🚂' },
]

export function findGameBySlug(slug: string): GameCatalogEntry | undefined {
  return GAME_CATALOG.find((game) => game.slug === slug)
}
