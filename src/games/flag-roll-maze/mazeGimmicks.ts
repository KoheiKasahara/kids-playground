import {
  BUMPER_COOLDOWN_MS,
  BUMPER_HEIGHT,
  BUMPER_KICK_IMPULSE,
  BUMPER_KICK_MARGIN,
  BUMPER_RADIUS,
  BALL_RADIUS,
  CAR_BODY_HEIGHT,
  CAR_CABIN_RADIUS,
  CAR_DEPTH,
  CAR_WIDTH,
  CANNON_CAPTURE_RADIUS,
  CANNON_MUZZLE_Y,
  JUMP_PAD_TOP,
  SPINNER_HEIGHT,
  SPINNER_LENGTH,
  SPINNER_THICKNESS,
  type PhysicsVector,
} from './mazePhysics'
import { CELL_SIZE, cellToWorld, type MazePoint } from './mazeGrid'

export type CellCoordinate = { column: number; row: number }

export type SpinnerPlacement = {
  kind: 'spinner'
  id: string
  cell: CellCoordinate
  /** 棒の長さ。既定値はSPINNER_LENGTHにして配置側の指定を簡単にする。 */
  length?: number
  /** 角速度(rad/s)。正で反時計回り、負で時計回り。 */
  angularSpeed: number
  /** 開始角(rad)。ステージごとに最初の見え方を変えられる。 */
  initialAngle: number
}

export type BumperPlacement = {
  kind: 'bumper'
  id: string
  cell: CellCoordinate
  /** 半径。省略時は幼児向けに調整した既定値を使う。 */
  radius?: number
}

export type CarPlacement = {
  kind: 'car'
  id: string
  /** 往復移動の中心セル。 */
  cell: CellCoordinate
  /** 中心からの片側振れ幅（ワールド単位）。 */
  amplitude: number
  /** 往復中の一定速度（ワールド単位/秒）。 */
  speed: number
  /** 複数台が同じ動きに見えないよう開始位相をずらす。 */
  phaseOffsetSeconds?: number
  /** 1で+Xへ、-1で-Xへ動き始める。 */
  initialDirection: 1 | -1
}

export type JumpPadPlacement = {
  kind: 'jumpPad'
  id: string
  /** 通路幅いっぱいへ置くための中心セル。 */
  cell: CellCoordinate
  widthCells: number
  depthCells: number
}

export type CannonPlacement = {
  kind: 'cannon'
  id: string
  /** 砲身の付け根と捕捉位置を同じセルで管理し、コース上の行き止まりへ置きやすくする。 */
  cell: CellCoordinate
  /** +z を0とする発射仰角と水平方向。 */
  elevationRad: number
  headingRad: number
  speed: number
}

export type GimmickPlacement =
  | SpinnerPlacement
  | BumperPlacement
  | CarPlacement
  | JumpPadPlacement
  | CannonPlacement

export type SpinnerGimmick = {
  id: string
  center: MazePoint
  length: number
  thickness: number
  height: number
  angularSpeed: number
  initialAngle: number
  /** 棒の角が掃く円の半径。配置検証とスタック脱出の基準を同じにする。 */
  sweepRadius: number
}

export type BumperGimmick = {
  id: string
  center: MazePoint
  radius: number
  height: number
}

export type CarGimmick = {
  id: string
  /** 車体の中心。物理・描画・往復計算で同じ高さを基準にする。 */
  center: PhysicsVector
  amplitude: number
  speed: number
  phaseOffsetSeconds: number
  initialDirection: 1 | -1
  halfWidth: number
  halfHeight: number
  halfDepth: number
  cabinRadius: number
}

export type JumpPadGimmick = {
  id: string
  center: MazePoint
  halfWidth: number
  halfDepth: number
  top: number
}

export type CannonGimmick = {
  id: string
  center: MazePoint
  muzzleY: number
  elevationRad: number
  headingRad: number
  speed: number
  captureRadius: number
}

export type MazeHole = { center: MazePoint; size: number }

export type MazeGimmicks = {
  spinners: SpinnerGimmick[]
  bumpers: BumperGimmick[]
  cars: CarGimmick[]
  jumpPads: JumpPadGimmick[]
  cannons: CannonGimmick[]
}

/** 経過時間から角度を直接求め、フレーム数による誤差を蓄積させない。 */
export function spinnerAngleAt(
  spinner: SpinnerGimmick,
  elapsedSeconds: number,
): number {
  return spinner.initialAngle + spinner.angularSpeed * elapsedSeconds
}

/**
 * バンパーの中心からボールへ向かう水平の外向きキックを求める。
 * 中心一致では方向が定まらないため、物理側で無理に押して挙動を不安定にしない。
 */
export function bumperKick(
  ballPosition: PhysicsVector,
  bumper: BumperGimmick,
  options: { ballRadius?: number; impulse?: number; margin?: number } = {},
): PhysicsVector | null {
  const dx = ballPosition.x - bumper.center.x
  const dz = ballPosition.z - bumper.center.z
  const distance = Math.hypot(dx, dz)
  if (distance === 0) return null

  const ballRadius = options.ballRadius ?? BALL_RADIUS
  const impulse = options.impulse ?? BUMPER_KICK_IMPULSE
  const margin = options.margin ?? BUMPER_KICK_MARGIN
  if (distance > bumper.radius + ballRadius + margin) return null

  return {
    x: (dx / distance) * impulse,
    y: 0,
    z: (dz / distance) * impulse,
  }
}

/** バンパーごとの最後のキック時刻を保持する。 */
export type BumperCooldowns = Map<string, number>

/** 前回のキックから規定時間が経過したかを判定する。 */
export function canKickBumper(
  cooldowns: BumperCooldowns,
  id: string,
  nowMs: number,
  cooldownMs = BUMPER_COOLDOWN_MS,
): boolean {
  const lastKickedAt = cooldowns.get(id)
  return lastKickedAt === undefined || nowMs - lastKickedAt >= cooldownMs
}

/** キック時刻を記録し、同じバンパーの連続発火を抑える。 */
export function markBumperKicked(
  cooldowns: BumperCooldowns,
  id: string,
  nowMs: number,
): void {
  cooldowns.set(id, nowMs)
}

/**
 * セル配置をワールド座標へ解決する。
 * ステージを文字グリッドと配置配列に分離し、別ステージでも同じ計算を使えるようにする。
 */
export function resolveGimmicks(
  placements: readonly GimmickPlacement[],
  columnCount: number,
  rowCount: number,
  cellSize = CELL_SIZE,
): MazeGimmicks {
  const spinners: SpinnerGimmick[] = []
  const bumpers: BumperGimmick[] = []
  const cars: CarGimmick[] = []
  const jumpPads: JumpPadGimmick[] = []
  const cannons: CannonGimmick[] = []

  for (const placement of placements) {
    const center = cellToWorld(
      placement.cell.column,
      placement.cell.row,
      columnCount,
      rowCount,
      cellSize,
    )

    if (placement.kind === 'spinner') {
      const length = placement.length ?? SPINNER_LENGTH
      spinners.push({
        id: placement.id,
        center,
        length,
        thickness: SPINNER_THICKNESS,
        height: SPINNER_HEIGHT,
        angularSpeed: placement.angularSpeed,
        initialAngle: placement.initialAngle,
        // 棒の端の角まで含めた最大距離にして、配置検証と衝突範囲を一致させる。
        sweepRadius: Math.hypot(length / 2, SPINNER_THICKNESS / 2),
      })
      continue
    }

    if (placement.kind === 'car') {
      cars.push({
        id: placement.id,
        // 車体の下面を道路へ接地させ、子Colliderの相対位置を単純に保つ。
        center: { x: center.x, y: CAR_BODY_HEIGHT / 2, z: center.z },
        amplitude: placement.amplitude,
        speed: placement.speed,
        phaseOffsetSeconds: placement.phaseOffsetSeconds ?? 0,
        initialDirection: placement.initialDirection,
        halfWidth: CAR_WIDTH / 2,
        halfHeight: CAR_BODY_HEIGHT / 2,
        halfDepth: CAR_DEPTH / 2,
        cabinRadius: CAR_CABIN_RADIUS,
      })
      continue
    }

    if (placement.kind === 'jumpPad') {
      jumpPads.push({
        id: placement.id,
        center,
        halfWidth: (placement.widthCells * cellSize) / 2,
        halfDepth: (placement.depthCells * cellSize) / 2,
        top: JUMP_PAD_TOP,
      })
      continue
    }

    if (placement.kind === 'cannon') {
      cannons.push({
        id: placement.id,
        center,
        muzzleY: CANNON_MUZZLE_Y,
        elevationRad: placement.elevationRad,
        headingRad: placement.headingRad,
        speed: placement.speed,
        captureRadius: CANNON_CAPTURE_RADIUS,
      })
      continue
    }

    bumpers.push({
      id: placement.id,
      center,
      radius: placement.radius ?? BUMPER_RADIUS,
      height: BUMPER_HEIGHT,
    })
  }

  return { spinners, bumpers, cars, jumpPads, cannons }
}
