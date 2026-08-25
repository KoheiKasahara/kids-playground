import { describe, expect, test } from 'vitest'
import {
  clearAll,
  changeStage,
  clearPartSelection,
  createPuzzleState,
  reachGoal,
  markBallGoal,
  markBallStopped,
  removeSelectedPart,
  returnBall,
  rotateSelectedPart,
  selectPart,
  startRun,
  stopRun,
  tryMovePart,
  tryPlacePart,
} from './puzzleState'

/** 板を2枚置いた編集中の状態 */
function stateWithTwoParts() {
  const first = tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })!
  return tryPlacePart(first, 'slopeLeft', { col: 3, row: 4 })!
}

describe('puzzleState', () => {
  test('最初は編集中で、パーツは何も置かれていない', () => {
    const state = createPuzzleState()
    expect(state.phase).toBe('edit')
    expect(state.parts).toEqual([])
    expect(state.runId).toBe(0)
  })

  test('編集中はパーツを置ける。IDは重複しない', () => {
    const first = tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })
    expect(first).not.toBeNull()
    const second = tryPlacePart(first!, 'slopeLeft', { col: 2, row: 1 })
    expect(second).not.toBeNull()
    expect(second!.parts).toHaveLength(2)
    expect(second!.parts[0].id).not.toBe(second!.parts[1].id)
  })

  test('同じマスへは2つ置けない', () => {
    const placed = tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })!
    expect(tryPlacePart(placed, 'slopeRight', { col: 1, row: 1 })).toBeNull()
    expect(placed.parts).toHaveLength(1)
  })

  test('ボードの外へは置けない', () => {
    expect(tryPlacePart(createPuzzleState(), 'slopeLeft', { col: -1, row: 1 })).toBeNull()
  })

  test('実行中はパーツを置けない（配置と実行を混ぜない）', () => {
    const running = startRun(tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })!)
    expect(running.phase).toBe('running')
    expect(tryPlacePart(running, 'slopeLeft', { col: 2, row: 2 })).toBeNull()
  })

  test('「ボールをおとす」で実行へ移り、実行の世代(runId)が進む', () => {
    const state = createPuzzleState()
    const running = startRun(state)
    expect(running.phase).toBe('running')
    expect(running.runId).toBe(state.runId + 1)
    // 実行中にもう一度押しても二重に始まらない
    expect(startRun(running)).toBe(running)
  })

  test('ゴールは実行中のときだけ受け付ける', () => {
    const running = startRun(createPuzzleState())
    const cleared = reachGoal(running)
    expect(cleared.phase).toBe('cleared')
    // 同じ実行で二度呼ばれても状態は変わらない
    expect(reachGoal(cleared)).toBe(cleared)
    expect(reachGoal(createPuzzleState()).phase).toBe('edit')
  })

  test('途中停止ではパーツを残して編集へ戻り、開始位置から再実行できる', () => {
    const running = startRun(stateWithTwoParts())
    const stopped = stopRun(running)
    expect(stopped.phase).toBe('stopped')
    // 停止中は既存の編集操作を使える
    expect(tryPlacePart(stopped, 'slopeLeft', { col: 5, row: 6 })).not.toBeNull()
    const resumed = startRun(stopped)
    expect(resumed.phase).toBe('running')
    expect(resumed.runId).toBe(running.runId + 1)
  })

  test('途中停止後もPhase 3のパーツを追加・回転してから再開できる', () => {
    const stopped = stopRun(startRun(createPuzzleState()))
    const curve = tryPlacePart(stopped, 'curveLeft', { col: 1, row: 2 })!
    const bumper = tryPlacePart(curve, 'bumper', { col: 3, row: 2 })!
    const guide = tryPlacePart(bumper, 'guideRight', { col: 5, row: 2 })!
    const cannon = tryPlacePart(guide, 'cannon', { col: 2, row: 4 })!
    const rotated = rotateSelectedPart(selectPart(cannon, 'part-4'))

    expect(rotated.parts.map((part) => part.typeId)).toEqual([
      'curveLeft', 'bumper', 'guideRight', 'cannonDownRight',
    ])
    expect(startRun(rotated).phase).toBe('running')
  })

  test('ゴール済み状態を途中停止へは移さない', () => {
    const cleared = reachGoal(startRun(createPuzzleState()))
    expect(stopRun(cleared)).toBe(cleared)
  })

  test('「ボールをもどす」は、置いたパーツを残したまま編集へ戻す', () => {
    const placed = tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })!
    const returned = returnBall(reachGoal(startRun(placed)))
    expect(returned.phase).toBe('edit')
    expect(returned.parts).toHaveLength(1)
  })

  test('盤面のパーツを選べる。同じパーツをもう一度選ぶと解除される', () => {
    const state = stateWithTwoParts()
    const [first, second] = state.parts
    expect(state.selectedPartId).toBeNull()

    const selected = selectPart(state, first.id)
    expect(selected.selectedPartId).toBe(first.id)
    expect(selectPart(selected, first.id).selectedPartId).toBeNull()
    expect(selectPart(selected, second.id).selectedPartId).toBe(second.id)
  })

  test('存在しないパーツや、実行中の選択は受け付けない', () => {
    const state = stateWithTwoParts()
    expect(selectPart(state, 'part-none')).toBe(state)
    const running = startRun(state)
    expect(selectPart(running, state.parts[0].id)).toBe(running)
  })

  test('選んだパーツを1つだけ消せる。ほかのパーツは残る', () => {
    const state = stateWithTwoParts()
    const [first, second] = state.parts
    const removed = removeSelectedPart(selectPart(state, first.id))
    expect(removed.parts.map((part) => part.id)).toEqual([second.id])
    expect(removed.selectedPartId).toBeNull()
  })

  test('何も選んでいなければ、消す操作は何も起こさない', () => {
    const state = stateWithTwoParts()
    expect(removeSelectedPart(state)).toBe(state)
    expect(clearPartSelection(state)).toBe(state)
  })

  test('実行中は選んでいたパーツを消せない', () => {
    const selected = selectPart(stateWithTwoParts(), 'part-1')
    const running = startRun(selected)
    // 実行へ移る時点で選択は解ける（実行中に消す対象が残らないようにする）
    expect(running.selectedPartId).toBeNull()
    expect(removeSelectedPart(running)).toBe(running)
  })

  test('置いたパーツを別のマスへ動かせる。数もidも変わらない', () => {
    const state = stateWithTwoParts()
    const [first] = state.parts
    const moved = tryMovePart(state, first.id, { col: 5, row: 6 })
    expect(moved).not.toBeNull()
    expect(moved!.parts).toHaveLength(2)
    expect(moved!.parts[0].id).toBe(first.id)
    expect(moved!.parts[0].cell).toEqual({ col: 5, row: 6 })
  })

  test('動かせない位置（ほかのパーツの上・ボードの外）は null を返す', () => {
    const state = stateWithTwoParts()
    const [first, second] = state.parts
    expect(tryMovePart(state, first.id, second.cell)).toBeNull()
    expect(tryMovePart(state, first.id, { col: -1, row: 0 })).toBeNull()
  })

  test('選んでいるパーツを動かしても、選択はそのパーツに付いていく', () => {
    const state = stateWithTwoParts()
    const [first] = state.parts
    const moved = tryMovePart(selectPart(state, first.id), first.id, { col: 5, row: 6 })
    expect(moved!.selectedPartId).toBe(first.id)
  })

  test('選んでいる斜め板は左右2方向を循環して回せる', () => {
    const selected = selectPart(tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 2, row: 3 })!, 'part-1')
    const left = rotateSelectedPart(selected)
    const right = rotateSelectedPart(left)
    expect(left.parts[0].typeId).toBe('slopeRight')
    expect(right.parts[0].typeId).toBe('slopeLeft')
    expect(rotateSelectedPart(right).parts[0].typeId).toBe('slopeRight')
  })

  test('実行中はパーツを動かせない', () => {
    const state = stateWithTwoParts()
    const running = startRun(state)
    expect(tryMovePart(running, state.parts[0].id, { col: 5, row: 6 })).toBeNull()
  })

  test('新しくパーツを置くと、それまでの選択は解ける', () => {
    const selected = selectPart(stateWithTwoParts(), 'part-1')
    const placed = tryPlacePart(selected, 'slopeLeft', { col: 5, row: 6 })!
    expect(placed.selectedPartId).toBeNull()
  })

  test('「ぜんぶけす」は、パーツを全部外して編集へ戻す', () => {
    const placed = tryPlacePart(createPuzzleState(), 'slopeLeft', { col: 1, row: 1 })!
    const cleared = clearAll(startRun(placed))
    expect(cleared.phase).toBe('edit')
    expect(cleared.parts).toEqual([])
    expect(cleared.selectedPartId).toBeNull()
  })

  test('むずかしいは2球を一意IDと個別状態で持ち、1球だけではクリアしない', () => {
    const state = createPuzzleState('hard', 'fr')
    expect(state.balls.map((ball) => ball.id)).toEqual(['ball-a', 'ball-b'])
    expect(state.balls.every((ball) => ball.flagId === 'fr')).toBe(true)

    const running = startRun(state)
    const firstGoal = markBallGoal(running, 'ball-a', [
      { id: 'ball-a', position: { x: 120, y: 820 }, status: 'goal' },
      { id: 'ball-b', position: { x: 270, y: 200 }, status: 'moving' },
    ])
    expect(firstGoal.phase).toBe('running')
    expect(firstGoal.balls.find((ball) => ball.id === 'ball-a')?.status).toBe('goal')
    expect(firstGoal.balls.find((ball) => ball.id === 'ball-b')?.status).toBe('moving')
  })

  test('2球ともゴールしたときだけclearedになる', () => {
    const running = startRun(createPuzzleState('hard'))
    const first = markBallGoal(running, 'ball-a')
    const cleared = markBallGoal(first, 'ball-b')
    expect(cleared.phase).toBe('cleared')
    expect(cleared.balls.every((ball) => ball.status === 'goal')).toBe(true)
  })

  test('片方停止・片方移動中はrunning、両方停止またはゴール+停止でstoppedになる', () => {
    const running = startRun(createPuzzleState('hard'))
    const oneStopped = markBallStopped(running, 'ball-a')
    expect(oneStopped.phase).toBe('running')
    const bothStopped = markBallStopped(oneStopped, 'ball-b')
    expect(bothStopped.phase).toBe('stopped')

    const goalThenStop = markBallStopped(markBallGoal(running, 'ball-a'), 'ball-b')
    expect(goalThenStop.phase).toBe('stopped')
  })

  test('2球が別々に停止したとき、先に停止した球もスタート位置へ戻る', () => {
    const running = startRun(createPuzzleState('hard'))
    const startA = running.balls.find((ball) => ball.id === 'ball-a')!.startPosition
    const startB = running.balls.find((ball) => ball.id === 'ball-b')!.startPosition

    // ball-aが先に停止。この時点のスナップショットはball-bがまだ動いている座標を含む。
    const oneStopped = markBallStopped(running, 'ball-a', [
      { id: 'ball-a', position: { x: 400, y: 500 }, status: 'stopped' },
      { id: 'ball-b', position: { x: 300, y: 260 }, status: 'moving' },
    ])
    expect(oneStopped.balls.find((ball) => ball.id === 'ball-a')?.position).toEqual(startA)

    // ball-bが後で停止。物理Bodyは静止したball-aの停止地点をそのまま報告し続けるため、
    // そのスナップショットでball-aのスタート復帰位置を上書きしてはいけない。
    const bothStopped = markBallStopped(oneStopped, 'ball-b', [
      { id: 'ball-a', position: { x: 400, y: 500 }, status: 'stopped' },
      { id: 'ball-b', position: { x: 320, y: 540 }, status: 'stopped' },
    ])
    expect(bothStopped.balls.find((ball) => ball.id === 'ball-a')?.position).toEqual(startA)
    expect(bothStopped.balls.find((ball) => ball.id === 'ball-b')?.position).toEqual(startB)
  })

  test('再開時はゴール済みを動かさず、未ゴール停止球だけを動かす', () => {
    const running = startRun(createPuzzleState('hard'))
    const stopped = markBallStopped(markBallGoal(running, 'ball-a'), 'ball-b')
    const resumed = startRun(stopped)
    expect(resumed.balls.find((ball) => ball.id === 'ball-a')?.status).toBe('goal')
    expect(resumed.balls.find((ball) => ball.id === 'ball-b')?.status).toBe('moving')
  })

  test('もどす・ぜんぶけすは全ボールを各スタートへ戻し、国旗とステージを維持する', () => {
    const placed = tryPlacePart(createPuzzleState('hard', 'us'), 'slopeLeft', { col: 1, row: 1 })!
    const running = startRun(placed)
    const progressed = markBallGoal(running, 'ball-a')
    const returned = returnBall(progressed)
    expect(returned.stageId).toBe('hard')
    expect(returned.parts).toHaveLength(1)
    expect(returned.balls.every((ball) => ball.flagId === 'us' && ball.status === 'ready')).toBe(true)
    expect(returned.balls.map((ball) => ball.position.x)).toEqual([90, 270])

    const cleared = clearAll(startRun(returned))
    expect(cleared.stageId).toBe('hard')
    expect(cleared.parts).toEqual([])
    expect(cleared.balls).toHaveLength(2)
  })

  test('ステージ切り替えは進行とパーツを初期化して国旗を引き継ぐ', () => {
    const hard = createPuzzleState('hard', 'de')
    const changed = changeStage(hard, 'normal')
    expect(changed.stageId).toBe('normal')
    expect(changed.balls).toHaveLength(1)
    expect(changed.balls[0].flagId).toBe('de')
    expect(changed.balls[0].status).toBe('ready')
    expect(changed.parts).toEqual([])
    expect(changed.phase).toBe('edit')
  })
})
