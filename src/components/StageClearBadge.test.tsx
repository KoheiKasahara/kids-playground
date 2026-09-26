import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'
import StageClearBadge from './StageClearBadge'

describe('StageClearBadge（Issue #784 A6）', () => {
  test('まだクリアしていなければ何も出さない', () => {
    const { container } = render(<StageClearBadge stars={0} />)
    expect(container).toBeEmptyDOMElement()
  })

  test('クリア済みなら「クリア」と★を出す', () => {
    render(<StageClearBadge stars={2} />)
    expect(screen.getByRole('img', { name: 'クリアずみ ほし 2こ' })).toBeInTheDocument()
    expect(screen.getByText('クリア')).toBeInTheDocument()
  })
})
