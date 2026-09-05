import { describe, expect, test } from 'vitest'
import { PUKUPUKA_STAGE } from './stageDefinitions'
import {
  applyWaterTap,
  createInitialState,
  drainSourceBodyId,
  faucetTargetBodyId,
  getFloater,
  isSettled,
  primaryWaterBodyId,
  stageDriftDirection,
  stepGame,
  toggleDrain,
  waterRatioOf,
  waterSurfaceYOf,
  type PukupukaGameState,
  type WaterControl,
} from './pukupukaGame'
import { rectContainsPoint } from './types'

const stage = PUKUPUKA_STAGE
const FRAME_MS = 1000 / 60
const bodyId = primaryWaterBodyId(stage)

/** 指定秒数ぶん、実際のフレーム間隔で進める。ゴール発火回数もあわせて数える。 */
function run(
  state: PukupukaGameState,
  seconds: number,
  control: WaterControl = null,
): { state: PukupukaGameState; goalCount: number } {
  const frames = Math.round((seconds * 1000) / FRAME_MS)
  let current = state
  let goalCount = 0
  for (let index = 0; index < frames; index += 1) {
    const result = stepGame(stage, current, FRAME_MS, control)
    current = result.state
    if (result.goalReached) goalCount += 1
  }
  return { state: current, goalCount }
}

function duckOf(state: PukupukaGameState) {
  const duck = getFloater(state, 'duck')
  if (!duck) throw new Error('アヒルが見つかりません')
  return duck
}

/** ゴールまでのひととおりの操作（水をためて壁を越え、せんを開けて台へ降ろす）。 */
function playThrough(): { state: PukupukaGameState; goalCount: number } {
  let current = createInitialState(stage)
  let goalCount = 0

  const fill = run(current, 6, 'fill')
  current = fill.state
  goalCount += fill.goalCount

  current = toggleDrain(current)
  const drain = run(current, 6)
  current = drain.state
  goalCount += drain.goalCount

  return { state: current, goalCount }
}

describe('pukupukaGame: 初期状態', () => {
  test('アヒルは開始位置にいて、まだクリアしていない', () => {
    const state = createInitialState(stage)
    const duck = duckOf(state)

    expect(duck.x).toBe(27)
    expect(duck.y).toBe(118)
    expect(state.phase).toBe('playing')
  })

  test('開始時の水位はステージ定義の initialLevel と一致する', () => {
    const state = createInitialState(stage)
    expect(waterSurfaceYOf(stage, state, bodyId)).toBeCloseTo(126 - 14, 5)
  })

  test('流れる向きはゴールのある右向き', () => {
    expect(stageDriftDirection(stage)).toBe(1)
  })
})

describe('pukupukaGame: じゃぐち(#515)', () => {
  test('じゃぐちの注ぎ先はステージ定義のfaucet.targetBodyIdと一致する', () => {
    expect(faucetTargetBodyId(stage)).toBe(stage.faucet.targetBodyId)
    expect(faucetTargetBodyId(stage)).toBe(bodyId)
  })

  test('fill操作はじゃぐちの注ぎ先の水域を増やす（primaryWaterBodyIdと別経路でも同じ水域に届く）', () => {
    const before = createInitialState(stage)
    const tapped = applyWaterTap(stage, before)
    const after = run(tapped, 1).state

    expect(waterSurfaceYOf(stage, after, faucetTargetBodyId(stage))).toBeLessThan(
      waterSurfaceYOf(stage, before, bodyId),
    )
  })
})

describe('pukupukaGame: せん/排水(#516)', () => {
  test('排水の水源はステージ定義のdrain.sourceBodyIdと一致する', () => {
    expect(drainSourceBodyId(stage)).toBe(stage.drain.sourceBodyId)
    expect(drainSourceBodyId(stage)).toBe(bodyId)
  })

  test('タップのたびに開閉が反転する', () => {
    const closed = createInitialState(stage)
    expect(closed.drainOpen).toBe(false)

    const opened = toggleDrain(closed)
    expect(opened.drainOpen).toBe(true)

    const closedAgain = toggleDrain(opened)
    expect(closedAgain.drainOpen).toBe(false)
  })

  test('開いている間は水位が下がり続け、閉じると低下が止まる', () => {
    const filled = run(createInitialState(stage), 3, 'fill').state
    const settled = run(filled, 2).state
    const beforeSurface = waterSurfaceYOf(stage, settled, bodyId)

    const opened = toggleDrain(settled)
    const draining = run(opened, 2).state
    // Yは下向きのため、水位が下がる＝水面Yが大きくなる。
    expect(waterSurfaceYOf(stage, draining, bodyId)).toBeGreaterThan(beforeSurface)

    const closed = toggleDrain(draining)
    const rightAfterClose = waterSurfaceYOf(stage, closed, bodyId)
    const settledAfterClose = run(closed, 3).state
    expect(waterSurfaceYOf(stage, settledAfterClose, bodyId)).toBeCloseTo(rightAfterClose, 0)
  })

  test('排水を開き続けても最低水位を下回らず、アヒルは床の上に乗る', () => {
    const opened = toggleDrain(createInitialState(stage))
    const { state } = run(opened, 12)
    const duck = duckOf(state)

    expect(waterRatioOf(stage, state, bodyId)).toBe(0)
    expect(waterSurfaceYOf(stage, state, bodyId)).toBeCloseTo(126, 5)
    expect(duck.y).toBeCloseTo(118, 1)
  })

  test('じゃぐちと排水を同時に開くと、水位はほぼそのまま安定する（注水量-排水量が打ち消し合う）', () => {
    const filled = run(createInitialState(stage), 3, 'fill').state
    const settled = run(filled, 2).state
    const before = waterSurfaceYOf(stage, settled, bodyId)

    const opened = toggleDrain(settled)
    const after = run(opened, 3, 'fill').state

    expect(waterSurfaceYOf(stage, after, bodyId)).toBeCloseTo(before, 0)
  })

  test('クリア後は排水の開閉を受け付けない', () => {
    const cleared = playThrough().state
    expect(cleared.phase).toBe('cleared')

    const toggled = toggleDrain(cleared)
    expect(toggled.drainOpen).toBe(cleared.drainOpen)
  })
})

describe('pukupukaGame: 水位と浮遊物の連動', () => {
  test('水位を上げるとアヒルが上がる', () => {
    const settled = run(createInitialState(stage), 3).state
    const before = duckOf(settled)

    const after = duckOf(run(settled, 2, 'fill').state)

    // Yは下向きのため、上がる＝Yが小さくなる。
    expect(after.y).toBeLessThan(before.y - 5)
  })

  test('水位を下げるとアヒルが下がる', () => {
    const filled = run(createInitialState(stage), 3, 'fill').state
    const settled = run(filled, 2).state
    const before = duckOf(settled)

    const opened = toggleDrain(settled)
    const after = duckOf(run(opened, 3).state)

    expect(after.y).toBeGreaterThan(before.y + 5)
  })

  test('アヒルは水面のすぐ近くに浮く（沈みっぱなし・浮きすぎにならない）', () => {
    const state = run(createInitialState(stage), 4, 'fill').state
    const settled = run(state, 3).state
    const duck = duckOf(settled)
    const surfaceY = waterSurfaceYOf(stage, settled, bodyId)

    // 中心が水面の上下8（＝半径ぶん）以内にいれば「水面に浮いている」と見える。
    expect(Math.abs(duck.y - surfaceY)).toBeLessThan(8)
  })
})

describe('pukupukaGame: 水位の下限・上限', () => {
  test('排水を開き続けても水位は0で止まり、アヒルは床の上に乗る', () => {
    const opened = toggleDrain(createInitialState(stage))
    const { state } = run(opened, 12)
    const duck = duckOf(state)

    expect(waterRatioOf(stage, state, bodyId)).toBe(0)
    expect(waterSurfaceYOf(stage, state, bodyId)).toBeCloseTo(126, 5)
    // 床(y=126)へ半径8ぶん乗った位置。貫通していない。
    expect(duck.y).toBeCloseTo(118, 1)
    expect(Number.isFinite(duck.x)).toBe(true)
    expect(Number.isFinite(duck.y)).toBe(true)
  })

  test('水を増やし続けても水位は満水で止まり、アヒルは天井側へ抜けない', () => {
    const { state } = run(createInitialState(stage), 12, 'fill')
    const duck = duckOf(state)

    expect(waterRatioOf(stage, state, bodyId)).toBe(1)
    expect(waterSurfaceYOf(stage, state, bodyId)).toBeCloseTo(30, 5)
    expect(duck.y).toBeGreaterThan(20)
    expect(duck.y).toBeLessThan(stage.height)
  })

  test('じゃぐちとせんを交互に切り替えても位置が発散しない', () => {
    let current = createInitialState(stage)
    for (let index = 0; index < 40; index += 1) {
      if (index % 2 === 0) {
        current = run(current, 0.2, 'fill').state
      } else {
        current = toggleDrain(current)
        current = run(current, 0.2).state
        current = toggleDrain(current)
      }
    }
    const duck = duckOf(current)

    expect(duck.x).toBeGreaterThanOrEqual(8)
    expect(duck.x).toBeLessThanOrEqual(stage.width - 8)
    expect(duck.y).toBeGreaterThanOrEqual(8)
    expect(duck.y).toBeLessThanOrEqual(stage.height - 8)
  })
})

describe('pukupukaGame: 固定物との関係', () => {
  test('アヒルは床・壁・しきりを大きく貫通しない', () => {
    let current = createInitialState(stage)
    // 'fill'に加え、drainOpenをtrue/falseへ切り替えながら進める（同時ONの区間も含む）。
    const steps: { control: WaterControl; drainOpen: boolean }[] = [
      { control: 'fill', drainOpen: false },
      { control: null, drainOpen: false },
      { control: null, drainOpen: true },
      { control: 'fill', drainOpen: true },
      { control: null, drainOpen: true },
      { control: null, drainOpen: false },
    ]
    for (const step of steps) {
      if (current.drainOpen !== step.drainOpen) current = toggleDrain(current)
      current = run(current, 2, step.control).state
      const duck = duckOf(current)
      for (const solid of stage.solids) {
        const nearestX = Math.min(Math.max(duck.x, solid.x), solid.x + solid.width)
        const nearestY = Math.min(Math.max(duck.y, solid.y), solid.y + solid.height)
        const distance = Math.hypot(duck.x - nearestX, duck.y - nearestY)
        // 半径8に対して、めり込みは0.5未満（＝見た目に分からない範囲）に収まる。
        expect(distance).toBeGreaterThan(8 - 0.5)
      }
    }
  })

  test('水が少ないうちはしきりを越えられず、ゴール側へ行かない', () => {
    const { state, goalCount } = run(createInitialState(stage), 8)
    const duck = duckOf(state)

    expect(duck.x).toBeLessThan(46)
    expect(goalCount).toBe(0)
    expect(state.phase).toBe('playing')
  })
})

describe('pukupukaGame: ゴール', () => {
  test('水をためて壁を越え、水を減らすとゴールできる', () => {
    const { state, goalCount } = playThrough()
    const duck = duckOf(state)

    expect(state.phase).toBe('cleared')
    expect(goalCount).toBe(1)
    expect(rectContainsPoint(stage.goal.area, duck.x, duck.y)).toBe(true)
  })

  test('クリア後に進め続けてもゴールは1回しか発火しない', () => {
    const cleared = playThrough()
    expect(cleared.goalCount).toBe(1)

    const after = run(cleared.state, 10)

    expect(after.goalCount).toBe(0)
    expect(after.state.phase).toBe('cleared')
  })

  test('クリア後は水の操作を受け付けない', () => {
    const { state } = playThrough()
    const surfaceBefore = waterSurfaceYOf(stage, state, bodyId)

    const tapped = applyWaterTap(stage, state)
    const stepped = run(tapped, 2, 'fill').state

    expect(waterSurfaceYOf(stage, stepped, bodyId)).toBeCloseTo(surfaceBefore, 5)
  })
})

describe('pukupukaGame: やりなおし', () => {
  test('createInitialState でいつでも初期状態へ戻せる', () => {
    const played = playThrough().state
    expect(played.phase).toBe('cleared')

    const reset = createInitialState(stage)

    expect(reset.phase).toBe('playing')
    expect(duckOf(reset)).toEqual(duckOf(createInitialState(stage)))
    expect(waterSurfaceYOf(stage, reset, bodyId)).toBeCloseTo(126 - 14, 5)
    expect(reset.elapsedMs).toBe(0)
    expect(reset.drainOpen).toBe(false)
  })
})

describe('pukupukaGame: 落ち着いたかどうかの判定', () => {
  test('水を動かしている最中は落ち着いていない', () => {
    const moving = run(createInitialState(stage), 0.3, 'fill').state
    expect(isSettled(stage, moving)).toBe(false)
  })

  test('しばらく放っておくと落ち着く', () => {
    const settled = run(createInitialState(stage), 10).state
    expect(isSettled(stage, settled)).toBe(true)
  })

  test('落ち着いたあとに水を足すと、また落ち着かなくなる', () => {
    const settled = run(createInitialState(stage), 10).state
    const tapped = run(applyWaterTap(stage, settled), 0.2).state

    expect(isSettled(stage, tapped)).toBe(false)
  })
})

describe('pukupukaGame: 進行の安定性', () => {
  test('タップ操作でも水位が変わる', () => {
    let current = createInitialState(stage)
    for (let index = 0; index < 5; index += 1) {
      current = applyWaterTap(stage, current)
    }
    const before = waterSurfaceYOf(stage, current, bodyId)
    const after = waterSurfaceYOf(stage, run(current, 3).state, bodyId)

    expect(after).toBeLessThan(before)
  })

  test('巨大な経過時間が来ても進めるステップ数に上限がある', () => {
    const state = createInitialState(stage)
    const huge = stepGame(stage, state, 10_000, 'fill')
    const normal = stepGame(stage, state, 1000 / 60, 'fill')

    expect(huge.state.elapsedMs).toBeLessThanOrEqual((1000 / 60) * 5)
    expect(huge.state.elapsedMs).toBeGreaterThanOrEqual(normal.state.elapsedMs)
  })

  test('経過時間が0や不正値でも状態が壊れない', () => {
    const state = run(createInitialState(stage), 1).state

    const zero = stepGame(stage, state, 0, 'fill')
    const nan = stepGame(stage, state, Number.NaN, 'fill')

    expect(duckOf(zero.state).y).toBeCloseTo(duckOf(state).y, 5)
    expect(Number.isFinite(duckOf(nan.state).y)).toBe(true)
  })

  test('同じ時間なら、フレーム分割の仕方が違っても同じ結果になる', () => {
    const start = createInitialState(stage)
    const fine = run(start, 2, 'fill').state

    // 30fps相当（1フレーム2ステップ）で同じ2秒ぶんを進める。
    let coarse = start
    for (let index = 0; index < 60; index += 1) {
      coarse = stepGame(stage, coarse, FRAME_MS * 2, 'fill').state
    }

    expect(duckOf(coarse).y).toBeCloseTo(duckOf(fine).y, 6)
  })
})
