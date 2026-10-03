import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSoundOutput, playTone } from '../../audio/sound'
import { FakeAudioContext } from './fakeAudioContext'
import { measureLoudness } from './loudness'
import { renderMono } from './offlineRender'
import { installFakeAudio, measureSample } from './soundMeter'

function renderTone(type: OscillatorType, frequency: number, seconds: number, amplitude = 1) {
  const ctx = new FakeAudioContext()
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.value = frequency
  gain.gain.value = amplitude
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(0)
  oscillator.stop(seconds)
  const signal = renderMono(ctx, { sources: [oscillator], sinks: new Set([ctx.destination]), from: 0, duration: seconds })
  return { ctx, signal }
}

describe('loudness meter', () => {
  it('measures a full-scale 1 kHz sine at -3 dB', () => {
    const { ctx, signal } = renderTone('sine', 1000, 1)
    const result = measureLoudness(signal, ctx.sampleRate)
    expect(result.level).toBeCloseTo(-3.0, 1)
    expect(result.peakDb).toBeCloseTo(0, 1)
  })

  it('treats a half amplitude as 6 dB quieter', () => {
    const loud = renderTone('sine', 1000, 1, 1)
    const quiet = renderTone('sine', 1000, 1, 0.5)
    const difference = measureLoudness(loud.signal, loud.ctx.sampleRate).level
      - measureLoudness(quiet.signal, quiet.ctx.sampleRate).level
    expect(difference).toBeCloseTo(6.02, 1)
  })

  it('hears low tones weaker, buzzy low tones louder than pure ones, and short blips a little weaker', () => {
    const level = (r: { ctx: FakeAudioContext; signal: Float32Array }) => measureLoudness(r.signal, r.ctx.sampleRate).level
    const mid = level(renderTone('sine', 1000, 1))
    const low = level(renderTone('sine', 150, 1))
    const lowSaw = level(renderTone('sawtooth', 150, 1))
    const blip = level(renderTone('sine', 1000, 0.05))
    expect(mid - low).toBeGreaterThan(12)
    expect(lowSaw).toBeGreaterThan(low + 3)
    expect(mid - blip).toBeGreaterThan(3)
    expect(mid - blip).toBeLessThan(7)
  })

  it('follows gain automation and stops at stop()', () => {
    const ctx = new FakeAudioContext()
    const oscillator = ctx.createOscillator()
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, 0)
    gain.gain.linearRampToValueAtTime(1, 0.1)
    gain.gain.exponentialRampToValueAtTime(0.001, 0.3)
    oscillator.connect(gain).connect(ctx.destination)
    oscillator.start(0)
    oscillator.stop(0.3)
    const signal = renderMono(ctx, { sources: [oscillator], sinks: new Set([ctx.destination]), from: 0, duration: 0.5 })
    const at = (seconds: number) => Math.max(...signal.slice(Math.floor(seconds * 48_000) - 120, Math.floor(seconds * 48_000)).map(Math.abs))
    expect(at(0.1)).toBeGreaterThan(0.9)
    expect(at(0.05)).toBeGreaterThan(0.4)
    expect(at(0.05)).toBeLessThan(0.6)
    expect(at(0.45)).toBe(0)
  })

  it('renders delay feedback loops without hanging', () => {
    const ctx = new FakeAudioContext()
    const oscillator = ctx.createOscillator()
    const delay = ctx.createDelay(1)
    const feedback = ctx.createGain()
    delay.delayTime.value = 0.1
    feedback.gain.value = 0.5
    oscillator.connect(delay)
    delay.connect(feedback).connect(delay)
    delay.connect(ctx.destination)
    oscillator.start(0)
    oscillator.stop(0.05)
    const signal = renderMono(ctx, { sources: [oscillator], sinks: new Set([ctx.destination]), from: 0, duration: 0.5 })
    const energy = (from: number, to: number) => signal.slice(from * 48_000, to * 48_000).reduce((sum, v) => sum + v * v, 0)
    expect(energy(0, 0.09)).toBe(0)
    expect(energy(0.1, 0.15)).toBeGreaterThan(0)
    expect(energy(0.2, 0.25)).toBeGreaterThan(0)
    expect(energy(0.2, 0.25)).toBeLessThan(energy(0.1, 0.15))
  })
})

describe('soundMeter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('measures sounds played through the shared output and ignores earlier sounds', () => {
    const ctx = installFakeAudio()
    playTone(ctx as unknown as AudioContext, 880, ctx.currentTime, 2, 0.9, 'square')
    const quiet = measureSample(ctx, { name: 'quiet', play: () => playTone(ctx as unknown as AudioContext, 880, ctx.currentTime, 0.3, 0.05, 'sine') })
    const loud = measureSample(ctx, { name: 'loud', play: () => playTone(ctx as unknown as AudioContext, 880, ctx.currentTime, 0.3, 0.2, 'sine') })
    expect(loud.level - quiet.level).toBeCloseTo(12.04, 0)
    expect(getSoundOutput(ctx as unknown as AudioContext)).not.toBe(ctx.destination)
  })
})
