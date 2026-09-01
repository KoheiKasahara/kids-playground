import { describe, expect, test } from 'vitest'
import { render, screen } from '@testing-library/react'
import CarVisual from './CarVisual'

describe('CarVisual', () => {
  test.each([
    ['car', 'rounded-body'],
    ['police-car', 'siren-bar'],
    ['bus', 'long-body'],
    ['bulldozer', 'blade'],
  ] as const)('renders the %s silhouette feature in the shared visual', (vehicleId, feature) => {
    render(<CarVisual vehicleId={vehicleId} />)

    const visual = screen.getByTestId('car-visual')
    expect(visual).toHaveAttribute('data-vehicle-id', vehicleId)
    expect(visual).toHaveAttribute('data-front-direction', 'E')
    expect(visual).toHaveAttribute('data-front-feature', feature)
    expect(visual.querySelector(`[data-vehicle-feature="${feature}"]`)).toBeInTheDocument()
  })

  test('keeps the police light bar visible as a two-color roof detail', () => {
    render(<CarVisual vehicleId="police-car" />)

    const visual = screen.getByTestId('car-visual')
    expect(visual.querySelector('[data-vehicle-feature="siren-bar"]')).toBeInTheDocument()
    expect(visual.querySelector('.policeLightRed, [class*="policeLightRed"]')).toBeInTheDocument()
    expect(visual.querySelector('.policeLightBlue, [class*="policeLightBlue"]')).toBeInTheDocument()
  })
})
