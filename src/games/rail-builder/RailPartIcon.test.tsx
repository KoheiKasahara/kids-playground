import { render } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import RailPartIcon from './RailPartIcon'

/**
 * Issue #254: パーツ置場のアイコンでも左右分岐を見分けられること。
 * 図形データは1つだけ持ち、左分岐は横方向の鏡像変換で描く。
 */
describe('RailPartIcon の分岐アイコン', () => {
  function branchGroup(branchSide: 'right' | 'left' | undefined) {
    const { container } = render(<RailPartIcon kind="branch" branchSide={branchSide} />)
    return container.querySelector('svg > g')
  }

  test('右分岐は反転せず、左分岐だけ横方向の鏡像になる', () => {
    expect(branchGroup('right')?.getAttribute('transform')).toBeNull()
    expect(branchGroup('left')?.getAttribute('transform')).toBe('translate(64,0) scale(-1,1)')
  })

  test('branchSide未指定は従来どおり右分岐として描く', () => {
    expect(branchGroup(undefined)?.getAttribute('transform')).toBeNull()
  })

  test('左右で同じ図形データを使う（描画要素の数と形が一致する）', () => {
    const shapesFor = (branchSide: 'right' | 'left') => {
      const { container } = render(<RailPartIcon kind="branch" branchSide={branchSide} />)
      return [...container.querySelectorAll('svg > g > *')].map((element) => (
        `${element.tagName}:${element.getAttribute('d') ?? ''}`
      ))
    }
    expect(shapesFor('left')).toEqual(shapesFor('right'))
    expect(shapesFor('right').length).toBeGreaterThan(0)
  })

  test('分岐以外のアイコンは分岐用のグループを持たない', () => {
    const { container } = render(<RailPartIcon kind="straight" />)
    expect(container.querySelector('svg > g')).toBeNull()
  })
})
