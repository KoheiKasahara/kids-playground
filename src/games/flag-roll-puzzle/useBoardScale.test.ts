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

/** clientWidth/clientHeight を固定値で返すjsdom要素を作る（jsdomは常に0を返すため） */
function fakeContainer(width: number, height: number): HTMLDivElement {
  const node = document.createElement('div')
  Object.defineProperty(node, 'clientWidth', { value: width, configurable: true })
  Object.defineProperty(node, 'clientHeight', { value: height, configurable: true })
  return node
}

describe('useBoardScale', () => {
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
    expect(result.current.width).toBeCloseTo(BOARD_WIDTH / 2, 0)
    expect(result.current.height).toBeCloseTo(BOARD_HEIGHT / 2, 0)
  })
})
