/**
 * App が共通の「もどる」ボタン（GameBackButton）を重ねて出す既存画面の一覧。
 *
 * 各ゲームは GameBackButton を自分のヘッダーへ置き、to または onBack で一階層上を明示する
 * （docs/development-guidelines.md の「ゲーム追加・変更時の共通基盤」を参照）。
 * ここにあるのは、まだボタンをヘッダーへ移していない既存画面だけなので、新しいゲームは追加しない。
 * ヘッダーへ移した画面は、同じ変更でこの一覧から外す。
 */

// /games/<slug> 以下のすべての画面で App の共通ボタンを使う既存ゲーム。
export const LEGACY_BACK_BUTTON_GAME_SLUGS: ReadonlySet<string> = new Set([
  'flag-quiz',
  'flag-roll-adventure',
  'vegetable-quiz',
  'fruit-quiz',
  'working-vehicle-quiz',
  'math-quiz',
  'color-mix-quiz',
  'prefecture-quiz',
  'world-travel-quiz',
  'japan-travel-quiz',
  'earth-globe',
  'train-journey',
  'circuit-racing',
])

// 選択画面だけ自前のヘッダーへ移し、残りの画面で App の共通ボタンを使うゲームの画面。
export const LEGACY_BACK_BUTTON_PATHS: ReadonlySet<string> = new Set([
  '/games/flag-pinball/play',
  '/games/flag-pinball/result',
])

/** 末尾の「/」を落としたパスを受け取り、App が共通の戻るボタンを出す画面かどうかを返す。 */
export function showsAppGameBackButton(pathname: string): boolean {
  // React Router は大文字・小文字を区別せずにルートを一致させるため、判定もそろえる。
  const path = pathname.toLowerCase()
  if (LEGACY_BACK_BUTTON_PATHS.has(path)) return true
  const [, root, slug] = path.split('/')
  return root === 'games' && slug !== undefined && LEGACY_BACK_BUTTON_GAME_SLUGS.has(slug)
}
