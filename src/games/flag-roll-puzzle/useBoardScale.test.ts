import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BOARD_HEIGHT, BOARD_WIDTH } from './boardLayout'
import { computeBoardScale, useBoardScale } from './useBoardScale'

describe('computeBoardScale', () => {
  it('幅・高さのうち小さい倍率を採用し、上限も超えない', () => {
    expect(computeBoardScale(BOARD_WIDTH, BOARD_HEIGHT * 2)).toBe(1)
    expect(computeBoardScale(BOARD_WIDTH * 2, BOARD_HEIGHT)).toBe(1)
  })

  it('初回計測前の0や負値では等倍にフォールバックする', () => {
    expect(computeBoardScale(0, 700)).toBe(1)
    expect(computeBoardScale(400, -1)).toBe(1)
  })
})

/** 計測サイズを固定したjsdom要素を作る（jsdomはレイアウトを持たないため） */
function fakeContainer(width: number, height: number): HTMLDivElement {
  const node = document.createElement('div')
  Object.defineProperty(node, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(node, 'clientHeight', { value: height, configurable: true })
  node.getBoundingClientRect = () => ({ width, height } as DOMRect)
  return node
}

describe('useBoardScale', () => {
  it('keeps fractional containers and the clipping stage large enough for the scaled board', () => {
    const { result } = renderHook(() => useBoardScale())
    for (const [width, height] of [[400.8, 313.6], [500.2, 328.4], [203.4, 700.8], [500, 375], [500, 383], [500, 391]]) {
      act(() => result.current.containerRef(fakeContainer(width, height)))
      expect(result.current.width).toBeGreaterThanOrEqual(BOARD_WIDTH * result.current.scale + 2 - 1e-9)
      expect(result.current.height).toBeGreaterThanOrEqual(BOARD_HEIGHT * result.current.scale + 2 - 1e-9)
      expect(result.current.width).toBeLessThanOrEqual(width)
      expect(result.current.height).toBeLessThanOrEqual(height)
    }
  })

  it('ステージ選択画面などでrefが最初nullでも、後からDOMへ付いたときのサイズで縮尺を計算する', () => {
    // こっきコロコロパズルはステージ選択→盤面の順で同じコンポーネントインスタンス内を
    // 遷移するため、containerRefのDOMノードはマウント直後にはまだ無い。
    const { result } = renderHook(() => useBoardScale())
    expect(result.current.scale).toBe(1)

    const node = fakeContainer(Math.round(BOARD_WIDTH / 2), Math.round(BOARD_HEIGHT / 2))
    act(() => {
      result.current.containerRef(node)
    })

    expect(result.current.scale).toBeCloseTo(0.5, 1)
    expect(Math.abs(result.current.width - BOARD_WIDTH / 2)).toBeLessThanOrEqual(2)
    expect(result.current.height).toBeLessThanOrEqual(BOARD_HEIGHT / 2)
    expect(result.current.height).toBeGreaterThanOrEqual(BOARD_HEIGHT / 2 - 2)
  })
})
