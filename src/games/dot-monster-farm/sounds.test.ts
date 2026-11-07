import { afterEach, describe, expect, it, vi } from 'vitest'
import * as sound from '../../audio/sound'
import { GAME_SOUND_LEVEL_DB, SOUND_LOUDNESS_TARGET_DB } from '../../audio/gameSoundLevels'
import { FakeAudioContext, type FakeAudioNode } from '../../test/audio/fakeAudioContext'
import { measureLoudness } from '../../test/audio/loudness'
import { renderMono } from '../../test/audio/offlineRender'
import { playHit } from './sounds'

function seededRandom(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const ctx of FakeAudioContext.instances) void ctx.close()
  FakeAudioContext.instances.length = 0
})

describe('dot-monster-farm hit sounds', () => {
  // バッファは Context ごとにキャッシュされるため、毎回作り直して異なるノイズを検証する。
  const noises = [
    ...Array.from({ length: 16 }, (_, seed) => ({ name: `seed ${seed}`, random: () => seededRandom(seed) })),
    // 旧振幅では通常ヒットが -0.80 dBFS になり、上限 -1 dBFS を超える系列。
    { name: 'regression seed 367', random: () => seededRandom(367) },
    { name: 'positive full-scale noise', random: () => () => 1 },
    { name: 'negative full-scale noise', random: () => () => 0 },
  ]
  const variants = [
    { big: false, crit: false },
    { big: false, crit: true },
    { big: true, crit: false },
    { big: true, crit: true },
  ]

  it.each(variants)('keeps big=$big, crit=$crit audible and below the peak limit across noise buffers', ({ big, crit }) => {
    for (const noise of noises) {
      const ctx = new FakeAudioContext()
      vi.spyOn(sound, 'getSharedAudioContext').mockReturnValue(ctx as unknown as AudioContext)
      vi.spyOn(Math, 'random').mockImplementation(noise.random())
      playHit(big, crit)
      const output = sound.getSoundOutput(ctx as unknown as AudioContext) as unknown as FakeAudioNode
      const signal = renderMono(ctx, { sources: ctx.startedSources, sinks: new Set([output]), from: 0, duration: 0.8 })
      const measured = measureLoudness(signal, ctx.sampleRate)
      void ctx.close()
      vi.clearAllMocks()
      const trim = GAME_SOUND_LEVEL_DB['dot-monster-farm']
      expect(measured.peakDb + trim, noise.name).toBeLessThanOrEqual(-1)
      expect(measured.level + trim, noise.name).toBeGreaterThanOrEqual(SOUND_LOUDNESS_TARGET_DB - 20)
    }
  })
})
