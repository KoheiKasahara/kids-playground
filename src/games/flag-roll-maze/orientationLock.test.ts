import { describe, expect, it, vi } from 'vitest'
import { lockCurrentScreenOrientation, unlockScreenOrientation } from './orientationLock'

describe('screen orientation lock', () => {
  it('locks the current orientation when supported', async () => {
    const lock = vi.fn().mockResolvedValue(undefined)
    await expect(lockCurrentScreenOrientation({ type: 'portrait-primary', lock })).resolves.toBe(true)
    expect(lock).toHaveBeenCalledWith('portrait-primary')
  })

  it('continues when locking is unsupported or rejected', async () => {
    await expect(lockCurrentScreenOrientation(undefined)).resolves.toBe(false)
    await expect(
      lockCurrentScreenOrientation({ type: 'landscape-primary', lock: vi.fn().mockRejectedValue(new Error()) }),
    ).resolves.toBe(false)
  })

  it('unlocks only when supported', () => {
    const unlock = vi.fn()
    unlockScreenOrientation({ unlock })
    unlockScreenOrientation(undefined)
    expect(unlock).toHaveBeenCalledOnce()
  })
})
