import type { Point } from './grid'
import {
  CANNON_DIRECTION_ANGLES,
  CANNON_TYPE_IDS,
  type PartTypeId,
} from './partTypes'

/** キャノンがボールを保持する時間。短くても発射の瞬間が見える長さにする。 */
export const CANNON_HOLD_DURATION_MS = 140
/** 発射後、同じキャノンへすぐ戻ったボールを再捕獲しない時間。 */
export const CANNON_COOLDOWN_MS = 260
/** MAX_SPEED(16)より少し下にした、キャノンの固定発射速度。 */
export const CANNON_LAUNCH_SPEED = 12.5

/** 見た目のチャンバーとセンサーの中心をアンカーからずらす距離(px)。 */
export const CANNON_CHAMBER_OFFSET = 8
/** ボールを置く発射口中心までの距離(px)。センサーとの再接触を避ける。 */
export const CANNON_MUZZLE_OFFSET = 26

export type CannonDirection = Readonly<{ x: number; y: number }>

export type CannonCapturePhase = 'ready' | 'holding' | 'cooldown'

/** 1つのボール×キャノン組み合わせの再入場ゲート。 */
export type CannonCaptureState = Readonly<{
  phase: CannonCapturePhase
  capturedAt: number | null
  cooldownUntil: number
  sensorContact: boolean
}>

export type CannonCaptureTransition = Readonly<{
  state: CannonCaptureState
  shouldFire: boolean
}>

export const CANNON_ROTATION_TYPES: readonly PartTypeId[] = CANNON_TYPE_IDS

const ANGLE_TO_DIRECTION = (angleDeg: number): CannonDirection => {
  const angle = angleDeg * Math.PI / 180
  const x = Math.cos(angle)
  const y = Math.sin(angle)
  return {
    x: Math.abs(x) < 1e-12 ? 0 : x,
    y: Math.abs(y) < 1e-12 ? 0 : y,
  }
}

/** 保存されたキャノンIDから、画面座標系（右が+x、下が+y）の単位方向を返す。 */
export function cannonDirectionVector(typeId: PartTypeId): CannonDirection | null {
  if (!Object.prototype.hasOwnProperty.call(CANNON_DIRECTION_ANGLES, typeId)) return null
  const angle = CANNON_DIRECTION_ANGLES[typeId as keyof typeof CANNON_DIRECTION_ANGLES]
  return ANGLE_TO_DIRECTION(angle)
}

/** 向きと速度から、入力速度に依存しない固定発射ベクトルを返す。 */
export function cannonLaunchVelocity(
  typeId: PartTypeId,
  speed = CANNON_LAUNCH_SPEED,
): CannonDirection | null {
  const direction = cannonDirectionVector(typeId)
  if (!direction) return null
  return { x: direction.x * speed, y: direction.y * speed }
}

/** キャノンのチャンバー中心。 */
export function cannonChamberPosition(center: Point, typeId: PartTypeId): Point {
  const direction = cannonDirectionVector(typeId) ?? { x: 1, y: 0 }
  return {
    x: center.x - direction.x * CANNON_CHAMBER_OFFSET,
    y: center.y - direction.y * CANNON_CHAMBER_OFFSET,
  }
}

/** キャノンの発射口中心。 */
export function cannonMuzzlePosition(center: Point, typeId: PartTypeId): Point {
  const direction = cannonDirectionVector(typeId) ?? { x: 1, y: 0 }
  return {
    x: center.x + direction.x * CANNON_MUZZLE_OFFSET,
    y: center.y + direction.y * CANNON_MUZZLE_OFFSET,
  }
}

export function createCannonCaptureState(): CannonCaptureState {
  return {
    phase: 'ready',
    capturedAt: null,
    cooldownUntil: 0,
    sensorContact: false,
  }
}

/** センサーへ入った瞬間に捕獲できるか。holding中、cooldown中、接触継続中は不可。 */
export function canCaptureCannonBall(
  state: CannonCaptureState,
  now: number,
  ballAlreadyCaptured = false,
): boolean {
  return !ballAlreadyCaptured
    && state.phase === 'ready'
    && !state.sensorContact
    && now >= state.cooldownUntil
}

export function beginCannonCapture(state: CannonCaptureState, now: number): CannonCaptureState {
  return {
    ...state,
    phase: 'holding',
    capturedAt: now,
    sensorContact: true,
  }
}

/** センサー接触を更新する。接触が切れた後だけ次回捕獲を許可する。 */
export function setCannonSensorContact(
  state: CannonCaptureState,
  sensorContact: boolean,
): CannonCaptureState {
  return { ...state, sensorContact }
}

/** 保持時間を過ぎたら、ちょうど1回だけ発射へ遷移する。 */
export function advanceCannonCapture(
  state: CannonCaptureState,
  now: number,
): CannonCaptureTransition {
  if (state.phase !== 'holding' || state.capturedAt === null) {
    return { state, shouldFire: false }
  }
  if (now - state.capturedAt < CANNON_HOLD_DURATION_MS) {
    return { state, shouldFire: false }
  }
  return {
    state: {
      ...state,
      phase: 'cooldown',
      capturedAt: null,
      cooldownUntil: now + CANNON_COOLDOWN_MS,
      sensorContact: true,
    },
    shouldFire: true,
  }
}

/** 発射後にセンサーを離れたら、クールダウン明けの新規捕獲へ戻す。 */
export function finishCannonCooldown(
  state: CannonCaptureState,
  now: number,
): CannonCaptureState {
  if (state.phase !== 'cooldown' || now < state.cooldownUntil || state.sensorContact) return state
  return { ...state, phase: 'ready' }
}

/** ボール×キャノンの状態Mapへ使う安定したキー。 */
export function cannonCaptureKey(ballId: string, cannonId: string): string {
  return `${ballId}:${cannonId}`
}
