import { describe, expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import PukupukaDrain from './PukupukaDrain'
import type { DrainDefinition } from './types'

const drain: DrainDefinition = { id: 'main-drain', sourceBodyId: 'main', x: 36, y: 126 }

describe('PukupukaDrain', () => {
  test('閉じているときも栓の取っ手を表示し、渦は出ない', () => {
    const { container } = render(
      <svg>
        <PukupukaDrain drain={drain} open={false} disabled={false} onToggle={() => {}} />
      </svg>,
    )

    expect(screen.getByTestId('pukupuka-drain')).toHaveAttribute('data-drain-open', 'false')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')
    expect(container.querySelectorAll('circle')).toHaveLength(1)
    expect(container.querySelector('ellipse[stroke-dasharray]')).toBeNull()
  })

  test('開いているときは栓が浮き上がり、穴に渦が出る', () => {
    const { container } = render(
      <svg>
        <PukupukaDrain drain={drain} open={true} disabled={false} onToggle={() => {}} />
      </svg>,
    )

    expect(screen.getByTestId('pukupuka-drain')).toHaveAttribute('data-drain-open', 'true')
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
    expect(container.querySelector('ellipse[stroke-dasharray]')).not.toBeNull()
    expect(container.querySelector('g[style]')).toHaveStyle({ transform: 'translateY(-8px)' })
  })

  test('タップでonToggleが1回だけ呼ばれる', () => {
    const onToggle = vi.fn()
    render(
      <svg>
        <PukupukaDrain drain={drain} open={false} disabled={false} onToggle={onToggle} />
      </svg>,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  test('disabledのときは押せない', () => {
    render(
      <svg>
        <PukupukaDrain drain={drain} open={false} disabled={true} onToggle={() => {}} />
      </svg>,
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })
})
