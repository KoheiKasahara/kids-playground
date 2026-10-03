import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { isSoundEnabled, setSoundEnabled } from './sound'
import { useSoundToggle } from './useSoundToggle'

describe('useSoundToggle', () => {
  it('mutes only while the game is open so other games keep their sound', () => {
    setSoundEnabled(false)
    const { result, unmount } = renderHook(() => useSoundToggle())
    expect(result.current[0]).toBe(true)
    expect(isSoundEnabled()).toBe(true)
    act(() => result.current[1]())
    expect(result.current[0]).toBe(false)
    expect(isSoundEnabled()).toBe(false)
    unmount()
    expect(isSoundEnabled()).toBe(true)
  })
})
