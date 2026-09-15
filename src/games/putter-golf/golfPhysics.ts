/**
 * パターゴルフの物理の決まりごと。
 *
 * Rapier・Three.js・DOM に依存しない定数と純粋関数だけを置き、
 * 「うつ強さ」「転がりにくさ」「止まったか」「カップへの寄り」をそのままテストできるようにする。
 * 長さの単位はゲーム内の m（ボールの直径が 0.3）。
 */

export type Vec3 = { x: number; y: number; z: number }

export const BALL_RADIUS = 0.15
export const CUP_RADIUS = 0.34
/** 「おおきい カップ」を選んだときの半径。幼児でも入りやすい大きさ。 */
export const BIG_CUP_RADIUS = 0.5
export const CUP_DEPTH = 0.36
export const WALL_HEIGHT = 0.3
export const WALL_THICKNESS = 0.2
/** コースの台の厚み。見た目と、落ちたかどうかの判定に使う。 */
export const PLATFORM_DEPTH = 0.35
export const EARTH_GRAVITY = 9.81
export const PHYSICS_STEP = 1 / 120
/** 1フレームで進める物理の上限。タブ復帰などで一気に進めないようにする。 */
export const MAX_STEPS_PER_FRAME = 8

export const SHOT_SPEED_MIN = 0.9
export const SHOT_SPEED_MAX = 6.8
/** 弱い側ほど細かく強さを選べるように曲げる。 */
export const SHOT_CURVE = 1.5

/** 芝・すなば・こおり・ふかふかの ゆか。 */
export type Surface = 'green' | 'sand' | 'ice' | 'rough'
/** 転がり抵抗の係数。重さ（重力）に比例する一定の減速として扱う。こおりは芝の1/3、ふかふかは3倍。 */
export const ROLLING: Record<Surface, number> = { green: 0.092, sand: 0.62, ice: 0.03, rough: 0.3 }

/** これより遅く、回転も小さい状態が REST_SECONDS 続いたら止まったとみなす。 */
export const REST_SPEED = 0.05
export const REST_SPIN = 0.7
export const REST_SECONDS = 0.3
/** ゆるい坂でいつまでも転がり続けるときの打ち切り。 */
export const SHOT_TIMEOUT_SECONDS = 18
export const MAX_BALL_SPEED = 12

/** カップのまわりで遅いボールを中心へ寄せる範囲（縁からの距離）と強さ。 */
export const CUP_PULL_MARGIN = 0.24
export const CUP_PULL_SPEED = 2.4
export const CUP_PULL_ACCEL = 2.8

/** ふうしゃの寸法。物理（golfWorld）と見た目（golfScene）が同じ値で作る。 */
export const WINDMILL = { tunnelHalf: 0.36, halfDepth: 0.7, outer: 1.6, pillarHeight: 0.75, hubHeight: 1.25, bladeFront: 0.92, bladeLength: 1.2, bladeWidth: 0.3, bladeThickness: 0.08, blades: 4 } as const
/** ダッシュパネルの広さ（半分の幅・半分の長さ）。 */
export const BOOSTER = { halfWidth: 0.55, halfLength: 0.6 } as const
export const BUMPER_HEIGHT = 0.44
/** うごくカベ（ゲート）の寸法。半分の厚みと高さ。 */
export const GATE = { halfDepth: 0.13, height: 0.44 } as const
/** 歩く どうぶつの大きさ。 */
export const CRITTER = { radius: 0.24, height: 0.46 } as const
/** ワープの どかん。入口の高さと、出てくるときに残る速さの割合。 */
export const WARP = { height: 0.42, keepSpeed: 0.9, minSpeed: 0.3 } as const

/** ふうしゃの はねの角度。物理と見た目で同じ時刻から求める。 */
export function windmillAngle(speed: number, time: number): number {
  return -speed * time
}

/**
 * 行ったり来たりする しかけの位置（-span〜+span）。
 * ふうしゃと同じで、時刻だけから決まるので物理と見た目が必ずそろう。
 */
export function patrolOffset(speed: number, time: number, span: number): number {
  return Math.sin(speed * time) * span
}

/** 行ったり来たりする しかけの進み具合（0〜1）。どうぶつが from→to を歩くのに使う。 */
export function patrolPhase(speed: number, time: number): number {
  return (patrolOffset(speed, time, 1) + 1) / 2
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/** うつ強さ（0〜1）→ 初速[m/s]。 */
export function shotSpeed(power: number): number {
  return SHOT_SPEED_MIN + (SHOT_SPEED_MAX - SHOT_SPEED_MIN) * clamp(power, 0, 1) ** SHOT_CURVE
}

/** その速さで平らな面を転がったときに止まるまでの距離の目安。 */
export function rollDistance(speed: number, decel: number): number {
  if (decel <= 0) return Infinity
  return (speed * speed) / (2 * decel)
}

/** 平らな面で distance だけ転がす強さ（0〜1）。最初のねらいの強さに使う。 */
export function powerForDistance(distance: number, decel: number): number {
  const speed = Math.sqrt(Math.max(0, 2 * decel * Math.max(0, distance)))
  const ratio = (speed - SHOT_SPEED_MIN) / (SHOT_SPEED_MAX - SHOT_SPEED_MIN)
  return clamp(ratio, 0, 1) ** (1 / SHOT_CURVE)
}

/** 転がり抵抗による減速[m/s²]。月では係数を大きくして、平らな所の転がり方を地球とそろえる。 */
export function rollingDecel(surface: Surface, gravity: number, scale = 1): number {
  return ROLLING[surface] * scale * gravity
}

/**
 * 1ステップぶんの転がり抵抗。速度に掛ける倍率を返す（0なら止める）。
 * 摩擦のように「一定の強さでブレーキがかかる」ので、指数的に減速するdampingと違って
 * いつまでもじわじわ転がり続けることがない。坂の重力が抵抗より強ければ次のステップでまた転がり出す。
 */
export function rollingFactor(speed: number, decel: number, dt: number): number {
  if (!(speed > 0)) return 0
  const loss = decel * dt
  return speed <= loss ? 0 : (speed - loss) / speed
}

/** 水平な向き（正規化済み）と強さから、打ち出す速度と、すべらず転がり出す回転を作る。 */
export function shotVelocity(direction: { x: number; z: number }, power: number): { linear: Vec3; angular: Vec3 } {
  const length = Math.hypot(direction.x, direction.z) || 1
  const speed = shotSpeed(power)
  const vx = (direction.x / length) * speed
  const vz = (direction.z / length) * speed
  // ω = (上向き × v) / r。打った瞬間から転がる回転にしておくと、芝の上ですべる区間ができない。
  return { linear: { x: vx, y: 0, z: vz }, angular: { x: vz / BALL_RADIUS, y: 0, z: -vx / BALL_RADIUS } }
}

/** カップの縁の近くを遅く通るボールを、中心へやさしく寄せる加速度。範囲外なら null。 */
export function cupPull(ball: { x: number; z: number }, speed: number, cup: { x: number; z: number }, radius: number): { x: number; z: number } | null {
  const dx = cup.x - ball.x
  const dz = cup.z - ball.z
  const distance = Math.hypot(dx, dz)
  const reach = radius + CUP_PULL_MARGIN
  if (distance >= reach || distance < 1e-4 || speed > CUP_PULL_SPEED) return null
  const strength = CUP_PULL_ACCEL * (1 - distance / reach) * (1 - speed / CUP_PULL_SPEED * 0.5)
  return { x: (dx / distance) * strength, z: (dz / distance) * strength }
}

/** ボールの中心がカップの中へ沈んだか。 */
export function isHoled(ball: Vec3, cup: Vec3, radius: number): boolean {
  return Math.hypot(ball.x - cup.x, ball.z - cup.z) < radius && ball.y < cup.y - BALL_RADIUS * 0.8
}
