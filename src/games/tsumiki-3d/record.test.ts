import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readBestHeight, saveBestHeight } from './record'

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
  }
}

beforeEach(() => vi.stubGlobal('localStorage', memoryStorage()))
afterEach(() => vi.unstubAllGlobals())

describe('record', () => {
  it('たかい きろく だけ のこす', () => {
    expect(readBestHeight()).toBe(0)
    saveBestHeight(4.2)
    saveBestHeight(3)
    expect(readBestHeight()).toBe(4.2)
  })

  it('ほぞん できない かんきょう でも とまらない', () => {
    const blocked = () => { throw new Error('blocked') }
    vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked })
    expect(readBestHeight()).toBe(0)
    expect(() => saveBestHeight(5)).not.toThrow()
  })
})
