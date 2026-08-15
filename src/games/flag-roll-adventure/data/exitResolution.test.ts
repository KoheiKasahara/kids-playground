import { describe, expect, it } from 'vitest'
import { findArea, resolveExitTarget } from './areas'

describe('resolveExitTarget', () => {
  it('出口から接続先エリアと入口を解決し、未知idはundefinedで扱う', () => {
    const target = resolveExitTarget('sky', 'sky-to-forest')
    expect(target).toEqual({
      areaId: 'forest',
      entry: findArea('forest')?.entries[0],
    })
    expect(resolveExitTarget('sky', 'unknown-exit')).toBeUndefined()
    expect(resolveExitTarget('unknown-area', 'sky-to-forest')).toBeUndefined()
  })
})
