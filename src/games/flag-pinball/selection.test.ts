import { describe, expect, it } from 'vitest'
import { isSelectionComplete, MAX_SELECTION, remainingCount, toggleSelection } from './selection'

describe('toggleSelection', () => {
  it('未選択のidを追加できる', () => {
    expect(toggleSelection([], 'jp')).toEqual(['jp'])
    expect(toggleSelection(['jp'], 'kr')).toEqual(['jp', 'kr'])
  })

  it('同じidをもう一度押すと外れる', () => {
    expect(toggleSelection(['jp', 'kr'], 'jp')).toEqual(['kr'])
  })

  it('3個そろった状態で4個目を押しても増えない', () => {
    const selected = ['jp', 'kr', 'cn']
    expect(toggleSelection(selected, 'us')).toEqual(['jp', 'kr', 'cn'])
  })

  it('3個そろった状態で選択済みを押すと外れて2個になる', () => {
    const selected = ['jp', 'kr', 'cn']
    expect(toggleSelection(selected, 'kr')).toEqual(['jp', 'cn'])
  })

  it('元の配列を破壊しない', () => {
    const selected = ['jp', 'kr']
    const before = [...selected]
    toggleSelection(selected, 'cn')
    toggleSelection(selected, 'jp')
    expect(selected).toEqual(before)
  })
})

describe('isSelectionComplete / remainingCount', () => {
  it('0個のときは未完了で、残りはMAX_SELECTION個', () => {
    expect(isSelectionComplete([])).toBe(false)
    expect(remainingCount([])).toBe(MAX_SELECTION)
  })

  it('2個のときは未完了で、残り1個', () => {
    expect(isSelectionComplete(['jp', 'kr'])).toBe(false)
    expect(remainingCount(['jp', 'kr'])).toBe(1)
  })

  it('3個そろうと完了で、残り0個', () => {
    expect(isSelectionComplete(['jp', 'kr', 'cn'])).toBe(true)
    expect(remainingCount(['jp', 'kr', 'cn'])).toBe(0)
  })

  it('remainingCountは0未満にならない', () => {
    expect(remainingCount(['jp', 'kr', 'cn', 'us'])).toBe(0)
  })
})
