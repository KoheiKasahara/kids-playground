import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPlacedPart } from './partDefinitions'
import RoadPartVisual from './RoadPartVisual'

describe('RoadPartVisual', () => {
  test('renders the goal as one entrance with a rotated finish gate', () => {
    const { rerender } = render(<RoadPartVisual part={createPlacedPart('goal')} />)

    let visual = screen.getByTestId('car-road-part-visual')
    expect(visual).toHaveAttribute('data-goal-entry-direction', 'N')
    expect(visual.querySelectorAll('[data-goal-road-path]')).toHaveLength(2)
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(0)')
    expect(visual.querySelectorAll('rect')).toHaveLength(28)
    expect(visual.querySelectorAll('circle')).toHaveLength(3)

    rerender(<RoadPartVisual part={createPlacedPart('goal', 2)} />)
    visual = screen.getByTestId('car-road-part-visual')
    expect(visual).toHaveAttribute('data-goal-entry-direction', 'E')
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(90)')
  })
})
