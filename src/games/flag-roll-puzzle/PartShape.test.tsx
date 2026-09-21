import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import PartShape from './PartShape'

describe('PartShape', () => {
  test('キャノンの砲身と本体は表示だけ少し太くし、物理共有の寸法には触れない', () => {
    const { container } = render(<PartShape typeId="cannon" />)
    const segments = container.querySelectorAll('span')

    expect(segments).toHaveLength(3)
    expect(segments[0]?.style.transform).toContain('scale(1.05)')
    expect(segments[1]?.style.transform).toContain('scaleY(1.12)')
    expect(segments[2]?.style.transform).toContain('scaleY(1.08)')
  })

  test('キャノン以外のパーツにはキャノン専用の表示拡大を適用しない', () => {
    const { container } = render(<PartShape typeId="slopeLeft" />)
    const segment = container.querySelector('span')

    expect(segment?.style.transform).not.toContain('scaleY(1.12)')
    expect(segment?.style.transform).not.toContain('scale(1.05)')
  })

  test('せんぷうきは台座を上下反転せず、左右だけをミラーする', () => {
    const right = render(<PartShape typeId="fanRight" />)
    const left = render(<PartShape typeId="fanLeft" />)

    expect(right.container.querySelector('[data-fan-direction="right"]')).not.toHaveAttribute('transform')
    expect(left.container.querySelector('[data-fan-direction="left"]')).toHaveAttribute('transform', 'scale(-1 1)')
  })

  test('回転盤は回る向きの矢印を持ち、逆回しでは向きだけが反転する', () => {
    const forward = render(<PartShape typeId="spinner" />)
    const reverse = render(<PartShape typeId="spinnerReverse" />)

    expect(forward.container.querySelector('[data-spin="forward"]')).toBeInTheDocument()
    expect(reverse.container.querySelector('[data-spin="reverse"]')).toBeInTheDocument()
    // 十字（羽根2枚＋中心）はどちらも同じで、増えるのは矢印1つだけ。
    expect(forward.container.querySelectorAll('span')).toHaveLength(4)
    expect(reverse.container.querySelectorAll('span')).toHaveLength(4)
  })

  test('2×2の回転盤は、矢印も占有する4マスの中心を基準に置く', () => {
    const { container } = render(<PartShape typeId="spinnerLarge" />)
    const arrow = container.querySelector<HTMLElement>('[data-spin="forward"]')

    expect(arrow?.style.getPropertyValue('--spin-arrow-x')).toBe('30px')
    // 軸より上（マイナス側）へ置き、羽根の進む向きを指す。
    expect(Number.parseFloat(arrow?.style.getPropertyValue('--spin-arrow-y') ?? '0')).toBeLessThan(30)
  })

  test('ワープは矢印なしで、入口と出口を逆向きの漏斗形にする', () => {
    const entrance = render(<PartShape typeId="warpIn" />)
    const exit = render(<PartShape typeId="warpOut" />)

    expect(entrance.container.querySelector('[data-warp-role="entrance"] path')?.getAttribute('d')).toContain('H20')
    expect(exit.container.querySelector('[data-warp-role="exit"] path')?.getAttribute('d')).toContain('H20')
    expect(entrance.container.querySelector('[data-warp-role="entrance"] ellipse')).toHaveAttribute('cy', '-14')
    expect(exit.container.querySelector('[data-warp-role="exit"] ellipse')).toHaveAttribute('cy', '14')
  })
})
