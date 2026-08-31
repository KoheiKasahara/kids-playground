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
})
