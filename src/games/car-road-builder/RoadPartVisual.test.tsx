import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createPlacedPart } from './partDefinitions'
import RoadPartVisual from './RoadPartVisual'

describe('RoadPartVisual', () => {
  test('draws a finish line that turns with the entrance and keeps the incoming road clear', () => {
    const { rerender } = render(<RoadPartVisual part={createPlacedPart('goal')} />)

    let visual = screen.getByTestId('car-road-part-visual')
    expect(visual).toHaveAttribute('data-goal-entry-direction', 'N')
    expect(visual.querySelectorAll('[data-goal-road-path]')).toHaveLength(2)
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(0 0 0)')
    expect(visual.querySelectorAll('[data-goal-checker="true"]')).toHaveLength(8)
    // The flag stands behind the finish line, on the side away from the entrance.
    expect(screen.getByTestId('goal-flag')).toHaveAttribute('transform', 'translate(0.283 0.283) scale(1.2)')

    rerender(<RoadPartVisual part={createPlacedPart('goal', 1)} />)
    expect(screen.getByTestId('car-road-part-visual')).toHaveAttribute('data-goal-entry-direction', 'NE')
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(45 0 0)')
    expect(screen.getByTestId('goal-flag')).toHaveAttribute('transform', 'translate(-0.283 0.283) scale(1.2)')

    rerender(<RoadPartVisual part={createPlacedPart('goal', 2)} />)
    visual = screen.getByTestId('car-road-part-visual')
    expect(visual).toHaveAttribute('data-goal-entry-direction', 'E')
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(90 0 0)')

    rerender(<RoadPartVisual part={createPlacedPart('goal', 4)} />)
    expect(screen.getByTestId('car-road-part-visual')).toHaveAttribute('data-goal-entry-direction', 'S')
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(180 0 0)')

    rerender(<RoadPartVisual part={createPlacedPart('goal', 6)} />)
    expect(screen.getByTestId('car-road-part-visual')).toHaveAttribute('data-goal-entry-direction', 'W')
    expect(screen.getByTestId('goal-gate')).toHaveAttribute('transform', 'rotate(270 0 0)')
  })
})
