import { GROUND_Y } from './levels'

// 画面の 大きさから、せかいを どれだけ ひろく うつすかを きめる 純粋な けいさん。

/** 地面の 下に のこす 土の あつみ。 */
const BELOW_GROUND = 90
/** 少なくとも この たかさ だけは うつす（たかく とんだ たまを 見うしなわない）。 */
const MIN_VIEW_H = 560
/** これより ひろく うつすと ロボットが 小さくなりすぎる。たて画面は せまめに する。 */
const MAX_VIEW_W = 1450
const MAX_VIEW_W_PORTRAIT = 800

export type View = { scale: number; width: number; height: number; left: number; top: number }

/** できれば パチンコから おしろまで ステージ ぜんぶを 1画面に おさめる。 */
export function viewScale(screenW: number, screenH: number, levelW: number) {
  if (screenW <= 0 || screenH <= 0) return 1
  const widest = screenW < screenH ? MAX_VIEW_W_PORTRAIT : MAX_VIEW_W
  const fitWidth = Math.max(screenW / levelW, screenW / widest)
  return Math.min(fitWidth, screenH / MIN_VIEW_H)
}

/** カメラの まんなか x を せかいの はしで とめる。 */
export function clampCenter(center: number, viewW: number, levelW: number) {
  if (viewW >= levelW) return levelW / 2
  return Math.max(viewW / 2, Math.min(levelW - viewW / 2, center))
}

export function makeView(screenW: number, screenH: number, center: number, levelW: number): View {
  const scale = viewScale(screenW, screenH, levelW)
  const width = screenW / scale
  const height = screenH / scale
  const x = clampCenter(center, width, levelW)
  // たて長の 画面では 空が あまるので、地面を 上に あげて 下に 土の だんを つくる（ヒントを おく ばしょ）。
  const below = height > MIN_VIEW_H * 1.35 ? Math.max(BELOW_GROUND, height * .26) : BELOW_GROUND
  return { scale, width, height, left: x - width / 2, top: GROUND_Y + below - height }
}

export function toWorld(view: View, sx: number, sy: number) {
  return { x: view.left + sx / view.scale, y: view.top + sy / view.scale }
}

/** なめらかに おいかける。dt が 大きくても とびこさない。 */
export function follow(current: number, target: number, frames: number, rate = .08) {
  const k = 1 - Math.pow(1 - rate, Math.max(0, frames))
  return current + (target - current) * k
}
