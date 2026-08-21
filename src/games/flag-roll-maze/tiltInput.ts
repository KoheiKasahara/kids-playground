/**
 * 盤面をどちらへ傾けるかだけを表す、デバイス非依存の共通入力。
 *
 * - `x` は盤面のワールド+X方向、`y` は盤面のワールド+Z方向へ「下り坂を作る」量。
 * - 画面上ではカメラが+Z側から見下ろすため、`y` が正なら手前（画面下）へ転がる。
 * - 大きさ（`x`,`y`のノルム）は 0〜1 に正規化し、1が最大の傾き。
 *
 * Phase 1はバーチャルスティックだけがこの値を作るが、Phase 2で
 * DeviceOrientation を足すときも「センサー値 → TiltInput」を書くだけで済むよう、
 * 物理側はこの型しか知らないようにしている。
 */
export type TiltInput = {
  x: number
  y: number
}

/** 入力が無い状態。エンジン初期値とスティックを離したときの戻り先。 */
export const NEUTRAL_TILT: TiltInput = { x: 0, y: 0 }

/**
 * スティック中央付近の遊び。
 * 幼児は指を完全に中央へ戻せないため、少し広めに取って「離したら止まる」を成立させる。
 */
export const TILT_DEADZONE = 0.18

/** 指を離してから中立へ戻る速さ、および入力へ追従する速さ（1/秒）。 */
export const TILT_SMOOTHING_LAMBDA = 9

/** ノルムが1を超えないよう、方向を保ったまま丸める。 */
export function clampTiltMagnitude(tilt: TiltInput): TiltInput {
  const magnitude = Math.hypot(tilt.x, tilt.y)
  if (magnitude <= 1 || magnitude === 0) return { x: tilt.x, y: tilt.y }
  return { x: tilt.x / magnitude, y: tilt.y / magnitude }
}

/**
 * デッドゾーンの外側を 0〜1 へ引き伸ばす。
 * 単純な切り捨てだとデッドゾーン境界で急に力が立ち上がるため、
 * 境界のすぐ外では必ず 0 付近から始まるように再スケールする。
 */
export function applyTiltDeadzone(tilt: TiltInput, deadzone = TILT_DEADZONE): TiltInput {
  const magnitude = Math.hypot(tilt.x, tilt.y)
  if (magnitude <= deadzone) return { ...NEUTRAL_TILT }
  const scaled = (magnitude - deadzone) / (1 - deadzone)
  const ratio = Math.min(1, scaled) / magnitude
  return { x: tilt.x * ratio, y: tilt.y * ratio }
}

/**
 * スティックの中心からのドラッグ量（px）を TiltInput へ変換する。
 * `radius` を超えて引いても 1 で頭打ちにし、指がノブから外れても操作が続くようにする。
 */
export function tiltFromStickOffset(
  offsetX: number,
  offsetY: number,
  radius: number,
): TiltInput {
  if (!Number.isFinite(radius) || radius <= 0) return { ...NEUTRAL_TILT }
  return applyTiltDeadzone(
    clampTiltMagnitude({ x: offsetX / radius, y: offsetY / radius }),
  )
}

/** 指数減衰の補間係数。フレーム落ちしても同じ手触りになるよう、経過時間から求める。 */
export function tiltDampFactor(lambda: number, deltaSeconds: number): number {
  if (!(deltaSeconds > 0)) return 0
  return 1 - Math.exp(-lambda * Math.max(0, deltaSeconds))
}

/**
 * 現在値を目標値へなめらかに寄せる。
 * 入力が飛んでも重力が階段状に切り替わらないため、ボールが不自然に跳ねない。
 */
export function smoothTilt(
  current: TiltInput,
  target: TiltInput,
  deltaSeconds: number,
  lambda = TILT_SMOOTHING_LAMBDA,
): TiltInput {
  const factor = tiltDampFactor(lambda, deltaSeconds)
  return {
    x: current.x + (target.x - current.x) * factor,
    y: current.y + (target.y - current.y) * factor,
  }
}

/** PCでも遊べるように、押されている矢印キー（またはWASD）から傾きを作る。 */
export const TILT_KEY_CODES = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
] as const

export type TiltKeyCode = (typeof TILT_KEY_CODES)[number]

/** 与えられたコードがゲームで使う移動キーかどうか。 */
export function isTiltKeyCode(code: string): code is TiltKeyCode {
  return (TILT_KEY_CODES as readonly string[]).includes(code)
}

/**
 * 同時押しは合成してから正規化する。
 * 斜めが直線より速くならないよう、必ずノルム1へ丸める。
 */
export function tiltFromPressedKeys(pressed: Iterable<string>): TiltInput {
  let x = 0
  let y = 0
  for (const code of pressed) {
    if (code === 'ArrowUp' || code === 'KeyW') y -= 1
    else if (code === 'ArrowDown' || code === 'KeyS') y += 1
    else if (code === 'ArrowLeft' || code === 'KeyA') x -= 1
    else if (code === 'ArrowRight' || code === 'KeyD') x += 1
  }
  return clampTiltMagnitude({ x, y })
}
