/**
 * アーム（クレーン）の動きだけを持つ純粋な状態機械。
 * Rapier も Three も知らず、ボタン操作と経過時間からアームの姿勢を決めるだけにしてある。
 * 物理側（craneWorld.ts）はここで決まった姿勢を kinematic な剛体へ写し、
 * つかむ・すべるといった結果だけを返す。
 */
import { CHUTE } from './craneMachines'

/** アームが動ける範囲[m]。穴の真上（HOME）まで届く大きさにしてある。 */
export const RAIL = { minX: -0.46, maxX: 0.48, minZ: -0.3, maxZ: 0.3 } as const
/** ケーブルがいちばん短いときのアームの高さと、降りきったときの高さ。 */
export const CLAW_TOP = 0.8
export const CLAW_BOTTOM = 0.21
/** 景品を落とす位置。穴の中心の真上。 */
export const HOME = { x: RAIL.minX, z: RAIL.maxZ } as const
/** アームの開き角[rad]。ひらいた指の先は景品の外側を通る広さにしてある。 */
export const FINGER_OPEN = 0.8
export const FINGER_SHUT = 0.1

/** アーム1本ぶんの寸法[m]。物理の剛体と見た目のメッシュが同じ値を読む。 */
export const CLAW = {
  hubRadius: 0.05,
  hubHalf: 0.019,
  /** 付け根の、中心軸からの距離と高さ。 */
  pivot: 0.032,
  pivotY: -0.014,
  arm: 0.115,
  armRadius: 0.012,
  tip: 0.05,
  tipRadius: 0.011,
  /** 先端が内側へ曲がっている角度[rad]。 */
  tipBend: 0.95,
} as const

/** 3本のアームの向き。手前側を開けて、景品が見えるように配置する。 */
export const FINGER_AZIMUTHS = [-Math.PI / 2, -Math.PI / 2 + (2 * Math.PI) / 3, -Math.PI / 2 + (4 * Math.PI) / 3] as const

export type Vec3 = { x: number; y: number; z: number }
export type Quat = { x: number; y: number; z: number; w: number }

export function quaternionY(angle: number): Quat {
  return { x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) }
}

export function quaternionZ(angle: number): Quat {
  return { x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) }
}

export function multiplyQuaternion(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  }
}

export type ClawPose = { x: number; y: number; z: number; finger: number }

/**
 * アーム1本の姿勢。ローカル-Yが指の向き、ローカル+Zが開閉の回転軸になるよう組んであるので、
 * 物理側の当たり判定と見た目のメッシュで同じローカル座標をそのまま使える。
 */
export function fingerPose(pose: ClawPose, index: number, angle = pose.finger): { position: Vec3; rotation: Quat } {
  const azimuth = FINGER_AZIMUTHS[index % FINGER_AZIMUTHS.length]!
  return {
    position: {
      x: pose.x + Math.cos(azimuth) * CLAW.pivot,
      y: pose.y + CLAW.pivotY,
      z: pose.z + Math.sin(azimuth) * CLAW.pivot,
    },
    // Y軸まわりで外向きへ向け、そこからローカルZ軸まわりに開く。
    rotation: multiplyQuaternion(quaternionY(-azimuth), quaternionZ(angle)),
  }
}

/** 指先の、中心軸からの水平距離[m]。開いているほど広がる。 */
export function fingerSpan(angle: number): number {
  return CLAW.pivot + Math.sin(angle) * CLAW.arm + Math.sin(angle - CLAW.tipBend) * CLAW.tip
}

/** 指先の、アーム中心からの高さ[m]（負の値）。 */
export function fingerDepth(angle: number): number {
  return CLAW.pivotY - Math.cos(angle) * CLAW.arm - Math.cos(angle - CLAW.tipBend) * CLAW.tip
}

/** 指先の世界座標。つかみ判定と、すべり落ちる位置の表示に使う。 */
export function fingerTip(pose: ClawPose, index: number, angle = pose.finger): Vec3 {
  const azimuth = FINGER_AZIMUTHS[index % FINGER_AZIMUTHS.length]!
  const span = fingerSpan(angle)
  return { x: pose.x + Math.cos(azimuth) * span, y: pose.y + fingerDepth(angle), z: pose.z + Math.sin(azimuth) * span }
}

const RAIL_SPEED = 0.3
const DESCEND_SPEED = 0.55
const LIFT_SPEED = 0.42
const CARRY_SPEED = 0.5
const CLOSE_TIME = 0.42
const OPEN_TIME = 0.3
const SETTLE_TIME = 0.9
/** アームを開ききる前に景品を放す割合。閉じたままの指で景品を押さないようにする。 */
const RELEASE_AT = 0.4

export type RigPhase = 'idle' | 'descend' | 'close' | 'lift' | 'carry' | 'open' | 'settle'
export type RigAxis = 'x' | 'z'
export type RigEvent = 'bottom' | 'grip' | 'lifted' | 'arrived' | 'release' | 'done'

export type Rig = {
  phase: RigPhase
  x: number
  z: number
  y: number
  /** アームの開き角[rad]。FINGER_SHUT〜FINGER_OPEN。 */
  finger: number
  /** 手動で動かしている軸。null なら止まっている。 */
  axis: RigAxis | null
  direction: { x: 1 | -1; z: 1 | -1 }
  /** ケースをタップして指定した行き先。 */
  target: { x: number; z: number } | null
  timer: number
  /** 実際に降りた高さ。景品に当たって途中で止まることがある。 */
  bottom: number
}

export function createRig(): Rig {
  return { phase: 'idle', x: HOME.x, z: HOME.z, y: CLAW_TOP, finger: FINGER_OPEN, axis: null, direction: { x: 1, z: -1 }, target: null, timer: 0, bottom: CLAW_BOTTOM }
}

export function clampRail(x: number, z: number): { x: number; z: number } {
  return {
    x: Math.min(RAIL.maxX, Math.max(RAIL.minX, x)),
    z: Math.min(RAIL.maxZ, Math.max(RAIL.minZ, z)),
  }
}

export function rigBusy(rig: Rig): boolean {
  return rig.phase !== 'idle'
}

/** 穴の真上にいるか。ここで放した景品だけが下の受け皿へ落ちる。 */
export function overChute(x: number, z: number): boolean {
  return x > CHUTE.minX && x < CHUTE.maxX && z > CHUTE.minZ && z < CHUTE.maxZ
}

/**
 * 軸ボタン。同じ軸をもう一度押すと止まる。
 * 端で押したときは向きを反転させ、「押したのに動かない」状態を作らない。
 */
export function toggleAxis(rig: Rig, axis: RigAxis): void {
  if (rigBusy(rig)) return
  rig.target = null
  if (rig.axis === axis) { rig.axis = null; return }
  rig.axis = axis
  if (axis === 'x' && ((rig.direction.x > 0 && rig.x >= RAIL.maxX) || (rig.direction.x < 0 && rig.x <= RAIL.minX))) rig.direction.x = rig.direction.x > 0 ? -1 : 1
  if (axis === 'z' && ((rig.direction.z > 0 && rig.z >= RAIL.maxZ) || (rig.direction.z < 0 && rig.z <= RAIL.minZ))) rig.direction.z = rig.direction.z > 0 ? -1 : 1
}

export function stopRig(rig: Rig): void {
  if (rigBusy(rig)) return
  rig.axis = null
  rig.target = null
}

/** ケースをタップしたときの行き先。届く範囲へ丸めてから向かう。 */
export function aimRig(rig: Rig, x: number, z: number): void {
  if (rigBusy(rig)) return
  rig.axis = null
  rig.target = clampRail(x, z)
}

export function startGrab(rig: Rig): boolean {
  if (rigBusy(rig)) return false
  rig.axis = null
  rig.target = null
  rig.phase = 'descend'
  rig.timer = 0
  rig.bottom = CLAW_BOTTOM
  return true
}

function moveToward(current: number, goal: number, step: number): { value: number; done: boolean } {
  const delta = goal - current
  if (Math.abs(delta) <= step) return { value: goal, done: true }
  return { value: current + Math.sign(delta) * step, done: false }
}

/**
 * 1ステップ進める。`blocked` は降下中にアームが景品へ当たったこと（物理側の判定）。
 * 戻り値は効果音やつかみ判定のきっかけになる出来事。
 */
export function advanceRig(rig: Rig, dt: number, options: { blocked?: boolean } = {}): RigEvent[] {
  const events: RigEvent[] = []
  if (!Number.isFinite(dt) || dt <= 0) return events
  switch (rig.phase) {
    case 'idle': {
      if (rig.axis) {
        const step = RAIL_SPEED * dt
        if (rig.axis === 'x') {
          rig.x += rig.direction.x * step
          if (rig.x >= RAIL.maxX) { rig.x = RAIL.maxX; rig.direction.x = -1 }
          if (rig.x <= RAIL.minX) { rig.x = RAIL.minX; rig.direction.x = 1 }
        } else {
          rig.z += rig.direction.z * step
          if (rig.z >= RAIL.maxZ) { rig.z = RAIL.maxZ; rig.direction.z = -1 }
          if (rig.z <= RAIL.minZ) { rig.z = RAIL.minZ; rig.direction.z = 1 }
        }
      } else if (rig.target) {
        const step = RAIL_SPEED * dt
        const nextX = moveToward(rig.x, rig.target.x, step)
        const nextZ = moveToward(rig.z, rig.target.z, step)
        rig.x = nextX.value
        rig.z = nextZ.value
        if (nextX.done && nextZ.done) rig.target = null
      }
      rig.finger = FINGER_OPEN
      break
    }
    case 'descend': {
      rig.y -= DESCEND_SPEED * dt
      if (options.blocked || rig.y <= CLAW_BOTTOM) {
        rig.y = Math.max(CLAW_BOTTOM, rig.y)
        rig.bottom = rig.y
        rig.phase = 'close'
        rig.timer = 0
        events.push('bottom')
      }
      break
    }
    case 'close': {
      rig.timer += dt
      const ratio = Math.min(1, rig.timer / CLOSE_TIME)
      rig.finger = FINGER_OPEN + (FINGER_SHUT - FINGER_OPEN) * ratio
      if (rig.timer >= CLOSE_TIME) {
        rig.finger = FINGER_SHUT
        rig.phase = 'lift'
        events.push('grip')
      }
      break
    }
    case 'lift': {
      rig.y += LIFT_SPEED * dt
      if (rig.y >= CLAW_TOP) {
        rig.y = CLAW_TOP
        rig.phase = 'carry'
        events.push('lifted')
      }
      break
    }
    case 'carry': {
      const step = CARRY_SPEED * dt
      const nextX = moveToward(rig.x, HOME.x, step)
      const nextZ = moveToward(rig.z, HOME.z, step)
      rig.x = nextX.value
      rig.z = nextZ.value
      if (nextX.done && nextZ.done) {
        rig.phase = 'open'
        rig.timer = 0
        events.push('arrived')
      }
      break
    }
    case 'open': {
      const before = rig.timer
      rig.timer += dt
      const ratio = Math.min(1, rig.timer / OPEN_TIME)
      rig.finger = FINGER_SHUT + (FINGER_OPEN - FINGER_SHUT) * ratio
      // 指が開きはじめた瞬間に放す。閉じた指で景品を押し出してしまわないようにする。
      if (before < OPEN_TIME * RELEASE_AT && rig.timer >= OPEN_TIME * RELEASE_AT) events.push('release')
      if (rig.timer >= OPEN_TIME) {
        rig.finger = FINGER_OPEN
        rig.phase = 'settle'
        rig.timer = 0
      }
      break
    }
    case 'settle': {
      rig.timer += dt
      if (rig.timer >= SETTLE_TIME) {
        rig.phase = 'idle'
        rig.timer = 0
        events.push('done')
      }
      break
    }
  }
  return events
}

/** ばねの伸び[m]からアームにかかる力[N]を出す。 */
export function gripLoad(stretch: number, stiffness: number): number {
  return Math.max(0, stretch) * stiffness
}

/** 支えられる力を超えたらすべり落ちる。 */
export function gripSlips(stretch: number, grip: { stiffness: number; hold: number }): boolean {
  return gripLoad(stretch, grip.stiffness) > grip.hold
}
