import { describe, expect, it } from 'vitest'
import {
  advanceRig,
  aimRig,
  CLAW,
  CLAW_BOTTOM,
  CLAW_TOP,
  createRig,
  FINGER_AZIMUTHS,
  FINGER_OPEN,
  FINGER_SHUT,
  fingerPose,
  fingerSpan,
  fingerTip,
  gripLoad,
  gripSlips,
  HOME,
  overChute,
  RAIL,
  rigBusy,
  startGrab,
  stopRig,
  toggleAxis,
  type Rig,
  type RigEvent,
} from './craneRig'

const STEP = 1 / 60

function advance(rig: Rig, seconds: number, options: { blocked?: boolean } = {}): RigEvent[] {
  const events: RigEvent[] = []
  for (let i = 0; i < Math.round(seconds / STEP); i++) events.push(...advanceRig(rig, STEP, options))
  return events
}

function runSequence(rig: Rig, options: { blocked?: boolean } = {}): RigEvent[] {
  const events: RigEvent[] = []
  for (let i = 0; i < 3000 && (rigBusy(rig) || i === 0); i++) events.push(...advanceRig(rig, STEP, options))
  return events
}

describe('アームの操作', () => {
  it('穴の上から始まり、ひらいた状態で止まっている', () => {
    const rig = createRig()
    expect(rig.phase).toBe('idle')
    expect(rigBusy(rig)).toBe(false)
    expect({ x: rig.x, z: rig.z }).toEqual({ x: HOME.x, z: HOME.z })
    expect(rig.y).toBe(CLAW_TOP)
    expect(rig.finger).toBe(FINGER_OPEN)
    expect(overChute(rig.x, rig.z)).toBe(true)
    advance(rig, 1)
    expect({ x: rig.x, z: rig.z }).toEqual({ x: HOME.x, z: HOME.z })
  })

  it('よこボタンで動き出し、もう一度おすと止まる', () => {
    const rig = createRig()
    toggleAxis(rig, 'x')
    advance(rig, 0.5)
    expect(rig.x).toBeGreaterThan(HOME.x)
    const reached = rig.x
    toggleAxis(rig, 'x')
    advance(rig, 0.5)
    expect(rig.x).toBe(reached)
    expect(rig.axis).toBeNull()
  })

  it('レールの端まで行くと向きが変わり、端でおしても必ず動き出す', () => {
    const rig = createRig()
    toggleAxis(rig, 'x')
    advance(rig, 10)
    expect(rig.x).toBeLessThanOrEqual(RAIL.maxX)
    expect(rig.x).toBeGreaterThanOrEqual(RAIL.minX)
    // 端に着いたら折り返して戻ってくる。
    advance(rig, 4)
    expect(rig.x).toBeLessThan(RAIL.maxX)
    stopRig(rig)
    rig.x = RAIL.maxX
    rig.direction.x = 1
    toggleAxis(rig, 'x')
    advance(rig, 0.3)
    expect(rig.x).toBeLessThan(RAIL.maxX)
  })

  it('おくボタンは前後の軸を動かし、よこボタンとは入れかわる', () => {
    const rig = createRig()
    toggleAxis(rig, 'z')
    advance(rig, 0.5)
    expect(rig.z).toBeLessThan(HOME.z)
    expect(rig.x).toBe(HOME.x)
    toggleAxis(rig, 'x')
    expect(rig.axis).toBe('x')
    const z = rig.z
    advance(rig, 0.4)
    expect(rig.z).toBe(z)
    expect(rig.x).not.toBe(HOME.x)
  })

  it('ケースをタップした場所へ向かい、着いたら止まる', () => {
    const rig = createRig()
    aimRig(rig, 0.2, -0.1)
    expect(rig.target).toEqual({ x: 0.2, z: -0.1 })
    advance(rig, 6)
    expect(rig.target).toBeNull()
    expect(rig.x).toBeCloseTo(0.2, 5)
    expect(rig.z).toBeCloseTo(-0.1, 5)
  })

  it('届かない場所をタップしても、レールの中へおさまる', () => {
    const rig = createRig()
    aimRig(rig, 9, -9)
    expect(rig.target).toEqual({ x: RAIL.maxX, z: RAIL.minZ })
    advance(rig, 10)
    expect(rig.x).toBe(RAIL.maxX)
    expect(rig.z).toBe(RAIL.minZ)
  })

  it('つかむ動作は降りる→閉じる→上げる→運ぶ→放すの順に進み、穴の上で終わる', () => {
    const rig = createRig()
    aimRig(rig, 0.3, -0.2)
    advance(rig, 8)
    expect(startGrab(rig)).toBe(true)
    expect(rig.phase).toBe('descend')
    const events = runSequence(rig)
    expect(events).toEqual(['bottom', 'grip', 'lifted', 'arrived', 'release', 'done'])
    expect(rig.phase).toBe('idle')
    expect(rig.y).toBe(CLAW_TOP)
    expect(rig.finger).toBe(FINGER_OPEN)
    expect({ x: rig.x, z: rig.z }).toEqual({ x: HOME.x, z: HOME.z })
    expect(rig.bottom).toBe(CLAW_BOTTOM)
  })

  it('動作中はボタンを受け付けず、二重に始まらない', () => {
    const rig = createRig()
    startGrab(rig)
    advance(rig, 0.2)
    expect(startGrab(rig)).toBe(false)
    toggleAxis(rig, 'x')
    aimRig(rig, 0.4, 0.1)
    expect(rig.axis).toBeNull()
    expect(rig.target).toBeNull()
    expect(rig.x).toBe(HOME.x)
  })

  it('景品に当たったらそこで降りるのをやめる', () => {
    const rig = createRig()
    startGrab(rig)
    advance(rig, 0.2)
    const stopped = rig.y
    expect(stopped).toBeLessThan(CLAW_TOP)
    advanceRig(rig, STEP, { blocked: true })
    expect(rig.phase).toBe('close')
    expect(rig.bottom).toBeGreaterThan(CLAW_BOTTOM)
    expect(rig.bottom).toBeLessThan(stopped)
  })

  it('閉じる途中の開き角は、ひらいた角度から閉じた角度へなめらかに動く', () => {
    const rig = createRig()
    startGrab(rig)
    while (rig.phase === 'descend') advance(rig, STEP)
    expect(rig.phase).toBe('close')
    const angles: number[] = []
    for (let i = 0; i < 10; i++) { advance(rig, 0.04); angles.push(rig.finger) }
    expect(angles.every((angle, index) => index === 0 || angle <= angles[index - 1]!)).toBe(true)
    expect(angles.at(-1)!).toBeLessThan(FINGER_OPEN)
    expect(angles.at(-1)!).toBeGreaterThanOrEqual(FINGER_SHUT)
  })

  it('1回の動作は十分短い時間で終わる', () => {
    const rig = createRig()
    startGrab(rig)
    let seconds = 0
    while (rigBusy(rig) && seconds < 30) { advance(rig, STEP); seconds += STEP }
    expect(seconds).toBeLessThan(10)
  })

  it('時間が進まないときは何も起きない', () => {
    const rig = createRig()
    startGrab(rig)
    expect(advanceRig(rig, 0)).toEqual([])
    expect(advanceRig(rig, Number.NaN)).toEqual([])
    expect(rig.y).toBe(CLAW_TOP)
  })
})

describe('アームの形', () => {
  it('3本のアームが等しい角度で並び、中心から同じ距離にある', () => {
    const rig = createRig()
    expect(FINGER_AZIMUTHS).toHaveLength(3)
    for (let index = 0; index < 3; index++) {
      const pose = fingerPose(rig, index)
      expect(Math.hypot(pose.position.x - rig.x, pose.position.z - rig.z)).toBeCloseTo(CLAW.pivot)
      expect(pose.position.y).toBeCloseTo(rig.y + CLAW.pivotY)
      const { x, y, z, w } = pose.rotation
      expect(Math.hypot(x, y, z, w)).toBeCloseTo(1)
    }
  })

  it('ひらくと指先が広がり、閉じると中心へ寄る', () => {
    expect(fingerSpan(FINGER_OPEN)).toBeGreaterThan(0.1)
    expect(fingerSpan(FINGER_SHUT)).toBeLessThan(0.02)
    const rig = { ...createRig(), x: 0.1, z: -0.2, y: CLAW_BOTTOM }
    const open = fingerTip(rig, 0, FINGER_OPEN)
    const shut = fingerTip(rig, 0, FINGER_SHUT)
    expect(Math.hypot(open.x - rig.x, open.z - rig.z)).toBeGreaterThan(Math.hypot(shut.x - rig.x, shut.z - rig.z))
    // 指先はアームの本体より下にある。
    expect(open.y).toBeLessThan(rig.y)
    expect(shut.y).toBeLessThan(open.y)
  })
})

describe('つかむ力', () => {
  it('ばねの伸びから力を出す', () => {
    expect(gripLoad(0.01, 150)).toBeCloseTo(1.5)
    expect(gripLoad(-0.01, 150)).toBe(0)
  })

  it('支えられる力を超えたときだけすべる', () => {
    const grip = { stiffness: 150, hold: 2 }
    expect(gripSlips(0.01, grip)).toBe(false)
    expect(gripSlips(0.02, grip)).toBe(true)
  })
})
