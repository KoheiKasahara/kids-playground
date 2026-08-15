import { BOARD_HEIGHT, ZONE_TOP } from './boardLayout'

/**
 * 物理演算とヘッドレス測定で共用する固定タイムステップ。
 * 可変フレームレートのままEngine.updateへ渡すと、端末ごとに反発の強さや飛距離が
 * 変わってしまうため、60fpsの論理時間で進める。
 */
export const STEP_MS = 1000 / 60

/**
 * Matter.jsの重力。盤面を長くしたあとも落下の勢いを保ち、ピンに当たって
 * 左右へ散る動きを作るため、極端に弱い値にはしない。
 */
export const GRAVITY = { x: 0, y: 0.55 } as const

/** 壁・障害物との接触に使う摩擦係数。転がりと接触時の減速を残す。 */
export const WALL_FRICTION = 0.05
export const OBSTACLE_FRICTION = 0.02

/** ボールの物理係数。 */
export const BALL_RESTITUTION = 0.87
export const BALL_FRICTION = 0.02
export const BALL_FRICTION_AIR = 0.005
export const BALL_DENSITY = 0.002

/** 1フレームぶんのdeltaがこれを超えたらクランプする（タブ復帰直後の暴走防止）。 */
export const MAX_FRAME_DELTA_MS = 100
/** 1フレームで進める物理ステップの上限。復帰直後に一気に追いつかないようにする。 */
export const MAX_SUBSTEPS = 5

/**
 * ボールの最大速度(px/step)。これを超えたら向きを保ったまま縮め、
 * 薄い壁やピンを1ステップで飛び越える可能性を抑える。
 */
export const MAX_SPEED = 24
/** ボールの最大角速度(rad/step)。国旗が読めなくなるほど速く回らないようにする。 */
export const MAX_ANGULAR_VELOCITY = 0.22

/** 同じ障害物への連続ヒット音・演出を間引くクールダウン(ms)。 */
export const OBSTACLE_HIT_COOLDOWN_MS = 120
/** 障害物が密なため、別のピンへの連続ヒットにも共通の間隔を設ける(ms)。 */
export const OBSTACLE_SOUND_GLOBAL_COOLDOWN_MS = 70

/** これ未満の速さ(px/step)を「停滞」とみなす。 */
export const STALL_SPEED_THRESHOLD = 0.4
/** 停滞がこれだけ続いたらナッジする(ms)。 */
export const STALL_DURATION_MS = 1500
/**
 * 停滞ナッジで直接与える水平方向の速さ(px/step)。
 * matter-jsのBody.applyForceは velocity += force / mass * delta^2 として適用され、
 * delta≈16.67msのとき係数は約278倍にもなる。そのためapplyForceで「小さく突く」ことは
 * 事実上できず（MAX_SPEEDで頭打ちになり、最大速度で真横へ弾き飛ばす挙動になってしまう）、
 * Body.setVelocityで狙った速さをそのまま与える。
 */
export const STALL_NUDGE_SPEED = 2.2

/** 射出から確定までの安全タイマー(ms)。通常プレイでは発動しない想定の最終手段。 */
export const SAFETY_TIMEOUT_MS = 45_000
/** 盤外脱出とみなす、盤面下端からの余裕(px)。 */
export const OUT_OF_BOUNDS_Y = BOARD_HEIGHT + 100
/** 盤外脱出とみなす、盤面左右からの余裕(px)。 */
export const OUT_OF_BOUNDS_MARGIN_X = 150

/** 得点ゾーンのセンサー（矩形）の高さと中心y。位置は盤面レイアウトから導出する。 */
export const ZONE_SENSOR_HEIGHT = 20
export const ZONE_SENSOR_Y = ZONE_TOP + 30

/** シミュレーションで使う固定球数。3球同時プレイの仕様と一致させる。 */
export const SIMULATION_BALL_COUNT = 3

/**
 * 全射出モードで、得点確定済みなのに盤外へ抜けない球を強制回収するまでの猶予(ms)。
 * 得点ゾーン(y≈905)から盤外(y=1100)までは通常0.3秒程度で通過するため、
 * これは「まれに盤外へ抜けきらない」場合の保険。これがあることで
 * 「全射出モードが必ず終了する」ことを構造で保証する。
 */
export const SCORED_BALL_REMOVAL_TIMEOUT_MS = 3000
