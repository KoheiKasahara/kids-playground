/**
 * 物理パラメータ。盤面の論理座標（boardLayout.ts）を前提に調整してある。
 * 数値の意味を1か所へ集め、UI側（盤面・画面）からは触らせない。
 */

/** 固定タイムステップ。端末のフレームレートで挙動が変わらないよう60fpsの論理時間で進める */
export const STEP_MS = 1000 / 60

/**
 * 重力。ピンボール(1000px)より短い680pxの盤面なので、落下が速すぎて
 * 板に当たった向きの変化が目で追えなくならないよう、ややゆるめにする。
 */
export const GRAVITY = { x: 0, y: 0.6 } as const

/** 国旗ボールの物理係数。よく弾むより、板の上を転がって進む動きを優先する */
export const BALL_RESTITUTION = 0.28
export const BALL_FRICTION = 0.02
export const BALL_FRICTION_AIR = 0.006
export const BALL_DENSITY = 0.002

/** 外周壁。跳ね返って戻ってきすぎないよう、板より弾ませない */
export const WALL_RESTITUTION = 0.15
export const WALL_FRICTION = 0.05

/** 1フレームぶんのdeltaの上限(ms)。タブ復帰直後の暴走を防ぐ */
export const MAX_FRAME_DELTA_MS = 100
/** 1フレームで進める物理ステップ数の上限 */
export const MAX_SUBSTEPS = 5

/** ボールの最大速度(px/step)。薄い板を1ステップで飛び越えるのを防ぐ */
export const MAX_SPEED = 16
/** 最大角速度(rad/step)。国旗の模様が読めなくなるほど速く回らないようにする */
export const MAX_ANGULAR_VELOCITY = 0.25

/** 途中停止は、速度と位置変化の両方がこの値以下のときだけ観察する */
export const STOP_SPEED_THRESHOLD = 0.12
export const STOP_POSITION_DELTA = 0.8
/** 一瞬の低速では編集へ戻さないための継続時間 */
export const STOP_DURATION_MS = 900
