import { describe, expect, it } from 'vitest'
import { scoreForPanels } from './panelScore'
import { PANEL_COUNT } from './PanelFlag'

describe('scoreForPanels', () => {
  it('不正解は開いたパネル枚数によらず常に0点', () => {
    for (const opened of [1, 2, 5, 10, PANEL_COUNT, 0, -3, 999]) {
      expect(scoreForPanels(opened, false)).toBe(0)
    }
  })

  it('正解時は開いたパネル枚数が増えるほど得点が下がる（1枚=100, 以降1枚ごとに10点減）', () => {
    expect(scoreForPanels(1, true)).toBe(100)
    expect(scoreForPanels(2, true)).toBe(90)
    expect(scoreForPanels(3, true)).toBe(80)
    expect(scoreForPanels(4, true)).toBe(70)
    expect(scoreForPanels(5, true)).toBe(60)
    expect(scoreForPanels(6, true)).toBe(50)
    expect(scoreForPanels(7, true)).toBe(40)
    expect(scoreForPanels(8, true)).toBe(30)
    expect(scoreForPanels(9, true)).toBe(20)
  })

  it('10枚以上開いてから正解しても10点で下げ止まる', () => {
    expect(scoreForPanels(10, true)).toBe(10)
    expect(scoreForPanels(PANEL_COUNT, true)).toBe(10)
    expect(scoreForPanels(20, true)).toBe(10)
  })

  it('0以下やPANEL_COUNT超えなど異常な枚数で呼ばれても安全にクランプする', () => {
    expect(scoreForPanels(0, true)).toBe(100)
    expect(scoreForPanels(-5, true)).toBe(100)
    expect(scoreForPanels(999, true)).toBe(10)
  })

  it('小数の openedCount が渡されても整数に丸めて計算する', () => {
    expect(scoreForPanels(1.9, true)).toBe(100)
    expect(scoreForPanels(2.1, true)).toBe(90)
  })

  it('1ゲームの満点は10問 × 100点 = 1000点になる（全問1枚目で正解した場合）', () => {
    const perfectScore = Array.from({ length: 10 }, () => scoreForPanels(1, true)).reduce(
      (sum, s) => sum + s,
      0,
    )
    expect(perfectScore).toBe(1000)
  })
})
