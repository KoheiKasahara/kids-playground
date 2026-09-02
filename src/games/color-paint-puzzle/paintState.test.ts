import { describe, expect, test } from 'vitest'
import { UNPAINTED_FILL } from './paintColors'
import {
  areaFillColor,
  createEmptyPaintings,
  getPaintedAreas,
  paintArea,
  resetPicture,
  type PaintingsState,
} from './paintState'

describe('paintState', () => {
  test('初期状態は空で、未塗りエリアのareaFillColorはUNPAINTED_FILL', () => {
    const state = createEmptyPaintings()
    expect(state).toEqual({})
    const painted = getPaintedAreas(state, 'car')
    expect(painted).toEqual({})
    expect(areaFillColor(painted, 'body')).toBe(UNPAINTED_FILL)
  })

  test('エリアを塗ると当該エリアだけ色が付き、他エリアは未塗りのまま', () => {
    const state = createEmptyPaintings()
    const next = paintArea(state, 'car', 'body', 'red')
    const painted = getPaintedAreas(next, 'car')
    expect(areaFillColor(painted, 'body')).toBe('#e8453c')
    expect(areaFillColor(painted, 'roof')).toBe(UNPAINTED_FILL)
  })

  test('同じエリアを別の色で塗り直せる', () => {
    let state = createEmptyPaintings()
    state = paintArea(state, 'car', 'body', 'red')
    state = paintArea(state, 'car', 'body', 'blue')
    expect(areaFillColor(getPaintedAreas(state, 'car'), 'body')).toBe('#1c7ed6')
  })

  test('複数エリアを独立して塗れる', () => {
    let state = createEmptyPaintings()
    state = paintArea(state, 'car', 'body', 'red')
    state = paintArea(state, 'car', 'roof', 'yellow')
    state = paintArea(state, 'car', 'wheelBack', 'green')
    const painted = getPaintedAreas(state, 'car')
    expect(areaFillColor(painted, 'body')).toBe('#e8453c')
    expect(areaFillColor(painted, 'roof')).toBe('#fcc419')
    expect(areaFillColor(painted, 'wheelBack')).toBe('#37b24d')
  })

  test('resetPictureで対象の絵だけ初期化され、他の絵の塗りは残る', () => {
    let state = createEmptyPaintings()
    state = paintArea(state, 'car', 'body', 'red')
    state = paintArea(state, 'fish', 'body', 'blue')
    state = resetPicture(state, 'car')
    expect(getPaintedAreas(state, 'car')).toEqual({})
    expect(areaFillColor(getPaintedAreas(state, 'fish'), 'body')).toBe('#1c7ed6')
  })

  test('resetPictureは未塗りの絵に対しても安全（同じ結果を返す）', () => {
    const state = createEmptyPaintings()
    const next = resetPicture(state, 'car')
    expect(next).toEqual({})
  })

  test('各関数は引数のstateを破壊しない', () => {
    const state: PaintingsState = createEmptyPaintings()
    const snapshotBefore = JSON.stringify(state)
    paintArea(state, 'car', 'body', 'red')
    expect(JSON.stringify(state)).toBe(snapshotBefore)

    const painted = paintArea(state, 'car', 'body', 'red')
    const paintedSnapshot = JSON.stringify(painted)
    paintArea(painted, 'car', 'roof', 'yellow')
    resetPicture(painted, 'car')
    expect(JSON.stringify(painted)).toBe(paintedSnapshot)
  })
})
