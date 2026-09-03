import { describe, expect, it } from 'vitest'
import {
  createToppleTracker,
  isToppledNow,
  resetToppleTracker,
  tiltAngleBetween,
  TOPPLE_CONFIRM_MS,
  TOPPLE_DROP_DISTANCE,
  TOPPLE_MOVE_DISTANCE,
  TOPPLE_TILT_RAD,
  updateToppleTracker,
  upVector,
  type BlockSample,
} from './bowlingTopple'

const UPRIGHT = { x: 0, y: 0, z: 0, w: 1 }

/** X軸まわりにangleだけ傾けたクォータニオン。 */
function tilted(angle: number) {
  return { x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) }
}

function sample(overrides: Partial<BlockSample> = {}): BlockSample {
  return {
    position: { x: 0, y: 1, z: -5 },
    rotation: UPRIGHT,
    ...overrides,
  }
}

/** 同じ状態をmsぶん流し込む。 */
function feed(tracker: ReturnType<typeof createToppleTracker>, samples: BlockSample[], ms: number) {
  const step = 10
  let newly = 0
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    newly += updateToppleTracker(tracker, samples, step)
  }
  return newly
}

describe('姿勢の計算', () => {
  it('まっすぐな積み木の「上」は+Y', () => {
    const up = upVector(UPRIGHT)
    expect(up.x).toBeCloseTo(0, 6)
    expect(up.y).toBeCloseTo(1, 6)
    expect(up.z).toBeCloseTo(0, 6)
  })

  it('傾けた角度がそのまま傾き角になる', () => {
    expect(tiltAngleBetween(upVector(UPRIGHT), upVector(tilted(0.7)))).toBeCloseTo(0.7, 5)
  })
})

describe('倒れた判定の条件', () => {
  const tracker = createToppleTracker([sample()])
  const entry = tracker.entries[0]!

  it('動いていない積み木は倒れていない', () => {
    expect(isToppledNow(entry, sample())).toBe(false)
  })

  it('しきい値より小さい傾き・移動では倒れていない', () => {
    expect(isToppledNow(entry, sample({ rotation: tilted(TOPPLE_TILT_RAD - 0.05) }))).toBe(false)
    expect(
      isToppledNow(entry, sample({ position: { x: TOPPLE_MOVE_DISTANCE - 0.05, y: 1, z: -5 } })),
    ).toBe(false)
  })

  it('大きく傾いたら倒れている', () => {
    expect(isToppledNow(entry, sample({ rotation: tilted(TOPPLE_TILT_RAD + 0.1) }))).toBe(true)
  })

  it('大きく横へ動いたら倒れている', () => {
    expect(
      isToppledNow(entry, sample({ position: { x: TOPPLE_MOVE_DISTANCE + 0.1, y: 1, z: -5 } })),
    ).toBe(true)
  })

  it('下へ落ちたら倒れている', () => {
    expect(
      isToppledNow(entry, sample({ position: { x: 0, y: 1 - TOPPLE_DROP_DISTANCE - 0.1, z: -5 } })),
    ).toBe(true)
  })
})

describe('確定までの時間と重複カウント', () => {
  it('条件を満たしてすぐには数えず、一定時間続いてから確定する', () => {
    const tracker = createToppleTracker([sample()])
    const fallen = [sample({ rotation: tilted(1.2) })]
    feed(tracker, fallen, TOPPLE_CONFIRM_MS - 30)
    expect(tracker.count).toBe(0)
    feed(tracker, fallen, 60)
    expect(tracker.count).toBe(1)
  })

  it('衝突の瞬間だけ揺れて元へ戻った積み木は数えない', () => {
    const tracker = createToppleTracker([sample()])
    feed(tracker, [sample({ rotation: tilted(1.2) })], TOPPLE_CONFIRM_MS - 40)
    feed(tracker, [sample()], 50)
    feed(tracker, [sample({ rotation: tilted(1.2) })], TOPPLE_CONFIRM_MS - 40)
    expect(tracker.count).toBe(0)
  })

  it('倒れ続けても二重に数えない', () => {
    const tracker = createToppleTracker([sample()])
    const fallen = [sample({ rotation: tilted(1.4) })]
    const newly = feed(tracker, fallen, TOPPLE_CONFIRM_MS * 8)
    expect(newly).toBe(1)
    expect(tracker.count).toBe(1)
  })

  it('いちど倒れたら、起き上がっても数を戻さない', () => {
    const tracker = createToppleTracker([sample()])
    feed(tracker, [sample({ rotation: tilted(1.4) })], TOPPLE_CONFIRM_MS + 20)
    feed(tracker, [sample()], 1000)
    expect(tracker.count).toBe(1)
  })

  it('倒れた積み木だけを数える', () => {
    const initial = [sample(), sample({ position: { x: 1, y: 1, z: -5 } }), sample({ position: { x: 2, y: 1, z: -5 } })]
    const tracker = createToppleTracker(initial)
    feed(
      tracker,
      [sample({ rotation: tilted(1.4) }), initial[1]!, sample({ position: { x: 3.4, y: 1, z: -5 } })],
      TOPPLE_CONFIRM_MS + 20,
    )
    expect(tracker.count).toBe(2)
    expect(tracker.entries.map((entry) => entry.toppled)).toEqual([true, false, true])
  })
})

describe('傾いた面に置いた積み木', () => {
  it('最初から傾いていても、その姿勢を基準にするので倒れ扱いにならない', () => {
    const initialRotation = tilted(0.06)
    const tracker = createToppleTracker([sample({ rotation: initialRotation })])
    feed(tracker, [sample({ rotation: initialRotation })], 2000)
    expect(tracker.count).toBe(0)
  })
})

describe('リセット', () => {
  it('次の投球のために、いまの姿勢を基準にして数え直す', () => {
    const tracker = createToppleTracker([sample()])
    feed(tracker, [sample({ rotation: tilted(1.4) })], TOPPLE_CONFIRM_MS + 20)
    expect(tracker.count).toBe(1)

    resetToppleTracker(tracker, [sample()])
    expect(tracker.count).toBe(0)
    expect(tracker.entries[0]!.toppled).toBe(false)
    feed(tracker, [sample()], 1000)
    expect(tracker.count).toBe(0)
  })
})
