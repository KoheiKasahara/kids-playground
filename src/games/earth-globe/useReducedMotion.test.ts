import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REDUCED_MOTION_QUERY, useReducedMotion } from './useReducedMotion'

const originalMatchMediaDescriptor = Object.getOwnPropertyDescriptor(window, 'matchMedia')

function stubMatchMedia(reducedMotion: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      matches: reducedMotion,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    })),
  })
}

afterEach(() => {
  if (originalMatchMediaDescriptor) {
    Object.defineProperty(window, 'matchMedia', originalMatchMediaDescriptor)
  } else {
    delete (window as unknown as Record<string, unknown>).matchMedia
  }
})

describe('useReducedMotion', () => {
  beforeEach(() => {
    stubMatchMedia(false)
  })

  it('reads a true reduced-motion preference', () => {
    stubMatchMedia(true)

    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(true)
    expect(window.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY)
  })

  it('reads a false reduced-motion preference', () => {
    const { result } = renderHook(() => useReducedMotion())

    expect(result.current).toBe(false)
  })

  it('does not throw when matchMedia is unavailable', () => {
    delete (window as unknown as Record<string, unknown>).matchMedia

    expect(() => renderHook(() => useReducedMotion())).not.toThrow()
  })
})
