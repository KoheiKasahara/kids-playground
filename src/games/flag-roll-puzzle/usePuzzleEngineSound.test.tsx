import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { BALL_RADIUS } from './boardLayout'
import { cellCenter } from './grid'
import type { PlacedPart } from './placement'
import type { PuzzleBallState } from './puzzleState'
import { partImpactSound, usePuzzleEngine, type PuzzlePartSound } from './usePuzzleEngine'

/** requestAnimationFrame を手で進め、固定ステップの物理を決まった時間だけ動かす。 */
function stubAnimationFrames() {
  let queue: FrameRequestCallback[] = []
  let now = 0
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queue.push(callback)
    return queue.length
  })
  vi.stubGlobal('cancelAnimationFrame', () => {})
  return (ms: number) => {
    for (let elapsed = 0; elapsed < ms; elapsed += 16) {
      now += 16
      const frame = queue
      queue = []
      for (const callback of frame) callback(now)
    }
  }
}

/** パーツの真上（2マス上）から1つだけボールを落とす。 */
function runBallOnto(part: PlacedPart, offsetX = 0, ms = 2500): PuzzlePartSound[] {
  const advance = stubAnimationFrames()
  const above = cellCenter({ col: part.cell.col, row: part.cell.row - 2 })
  const start = { x: above.x + offsetX, y: above.y }
  const ball: PuzzleBallState = { id: 'ball-a', flagId: 'jp', startPosition: start, position: start, status: 'moving' }
  const sounds: PuzzlePartSound[] = []
  const { unmount } = renderHook(() =>
    usePuzzleEngine({
      parts: [part],
      balls: [ball],
      running: true,
      runId: 1,
      onGoal: () => {},
      onStopped: () => {},
      onPartSound: (kind) => sounds.push(kind),
    }),
  )
  advance(ms)
  unmount()
  return sounds
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('こっきコロコロパズルの パーツの おと', () => {
  test('パーツの種類ごとに、はんのうした ときの おとを きめる', () => {
    expect(partImpactSound('slopeLeft')).toBe('wood')
    expect(partImpactSound('curveRight90')).toBe('wood')
    expect(partImpactSound('guideLeft')).toBe('wood')
    expect(partImpactSound('spinnerLarge')).toBe('spinner')
    expect(partImpactSound('conveyorUp')).toBe('conveyor')
    expect(partImpactSound('seesaw')).toBe('seesaw')
    expect(partImpactSound('fanLeft')).toBe('fan')
    expect(partImpactSound('bubbleLift')).toBe('bubble')
    expect(partImpactSound('warpOut')).toBe('warp')
    // 専用の瞬間に鳴らすものは、ふつうの接触では鳴らさない。
    expect(partImpactSound('bumper')).toBeNull()
    expect(partImpactSound('jumpRampLeft')).toBeNull()
    expect(partImpactSound('cannonDown')).toBeNull()
  })

  test('バンパーに あたると「ぼよん」が なる', () => {
    const sounds = runBallOnto({ id: 'part-bumper', typeId: 'bumper', cell: { col: 3, row: 5 } }, 4)
    expect(sounds).toContain('bumper')
  })

  test('たいほうは たまを こめてから「ドーン」と うつ', () => {
    // キャノンのチャンバーはマスの中心より左にあるので、そこへ落とす。
    const sounds = runBallOnto({ id: 'part-cannon', typeId: 'cannon', cell: { col: 3, row: 5 } }, -8 + BALL_RADIUS / 4)
    const load = sounds.indexOf('cannonLoad')
    const fire = sounds.indexOf('cannonFire')
    expect(load).toBeGreaterThanOrEqual(0)
    expect(fire).toBeGreaterThan(load)
  })

  test('ジャンプ台に のると「びよーん」と とぶ', () => {
    const sounds = runBallOnto({ id: 'part-ramp', typeId: 'jumpRampRight', cell: { col: 3, row: 5 } })
    expect(sounds).toContain('jump')
  })

  test('いたに あたると「こつん」が なる', () => {
    const sounds = runBallOnto({ id: 'part-slope', typeId: 'slopeRight', cell: { col: 3, row: 5 } })
    expect(sounds).toContain('wood')
  })
})
