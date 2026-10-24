import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSoundOutput, setSoundEnabled } from '../../audio/sound'
import { FakeAudioContext, FakeOscillatorNode, type FakeAudioScheduledSourceNode } from '../../test/audio/fakeAudioContext'
import { installFakeAudio } from '../../test/audio/soundMeter'
import { playMiniSound, startMiniBgm, stopMiniSounds, type MiniSound } from './sounds'

let ctx: FakeAudioContext
let firstSource = 0
const cleanups: (() => void)[] = []
const effects: MiniSound[] = ['select', 'assemble', 'start', 'countdown', 'go', 'lap', 'lane', 'bump', 'cheer', 'finish']

function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 25) {
    ctx.currentTime += .025
    vi.advanceTimersByTime(25)
  }
}

function signature(sources: FakeAudioScheduledSourceNode[]) {
  return sources.map(source => source instanceof FakeOscillatorNode
    ? [source.type, Math.round(source.frequency.valueAt(source.startTime!)), Math.round((source.stopTime - source.startTime!) * 1000)]
    : ['noise', Math.round((source.stopTime - source.startTime!) * 1000)])
}

beforeAll(() => {
  // Importing the audio module itself must not start anything before a user gesture.
  expect(FakeAudioContext.instances).toHaveLength(0)
  ctx = installFakeAudio()
  getSoundOutput(ctx as unknown as AudioContext)
})

beforeEach(() => {
  vi.useFakeTimers()
  setSoundEnabled(true)
  firstSource = ctx.startedSources.length
})

afterEach(() => {
  for (const stop of cleanups.splice(0)) stop()
  for (const source of ctx.startedSources.slice(firstSource)) source.onended?.call(source, new Event('ended'))
  stopMiniSounds()
  setSoundEnabled(true)
  vi.useRealTimers()
})

afterAll(() => vi.unstubAllGlobals())

describe('mini-4wd sound effects', () => {
  it('leaves the context and timers untouched when globally muted', () => {
    setSoundEnabled(false)
    const nodes = ctx.nodes.length
    for (const effect of effects) playMiniSound(effect)
    const stop = startMiniBgm('race')
    stop()
    expect(ctx.nodes).toHaveLength(nodes)
    expect(ctx.startedSources).toHaveLength(firstSource)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('gives every action a distinct finite audible phrase', () => {
    const signatures = new Set<string>()
    for (const effect of effects) {
      const from = ctx.startedSources.length
      playMiniSound(effect)
      const sources = ctx.startedSources.slice(from)
      expect(sources.length, effect).toBeGreaterThan(0)
      for (const source of sources) {
        expect(source.stopTime, effect).toBeGreaterThan(source.startTime!)
        expect(source.stopTime - source.startTime!, effect).toBeLessThan(1.2)
      }
      signatures.add(JSON.stringify(signature(sources)))
    }
    expect(signatures.size).toBe(effects.length)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('disconnects every effect node when its last note ends, preserving the shared output', () => {
    const firstNode = ctx.nodes.length
    playMiniSound('finish')
    for (const source of ctx.startedSources.slice(firstSource)) source.onended?.call(source, new Event('ended'))
    const nodes = ctx.nodes.slice(firstNode)
    expect(nodes.length).toBeGreaterThan(0)
    expect(nodes.flatMap(node => node.outputs).every(connection => Number.isFinite(connection.end))).toBe(true)
    const output = getSoundOutput(ctx as unknown as AudioContext)
    expect(ctx.nodes.find(node => node === output as unknown)?.outputs.some(connection => connection.end === Infinity)).toBe(true)
    expect(ctx.state).toBe('running')
  })

  it('works without Web Audio support', () => {
    vi.stubGlobal('AudioContext', undefined)
    expect(() => playMiniSound('assemble')).not.toThrow()
    expect(() => startMiniBgm('garage')()).not.toThrow()
    expect(ctx.startedSources).toHaveLength(firstSource)
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })

  it('stops already scheduled effects on exit or mute and allows fresh effects on reentry', () => {
    const firstNode = ctx.nodes.length
    playMiniSound('finish')
    playMiniSound('assemble')
    const effects = ctx.startedSources.slice(firstSource)
    expect(effects.some(source => source.startTime! > ctx.currentTime)).toBe(true)
    setSoundEnabled(false)
    stopMiniSounds()
    stopMiniSounds()
    expect(effects.every(source => source.stopTime <= ctx.currentTime)).toBe(true)
    expect(ctx.nodes.slice(firstNode).flatMap(node => node.outputs).every(connection => Number.isFinite(connection.end))).toBe(true)
    expect(effects.every(source => source.onended === null)).toBe(true)
    const count = ctx.startedSources.length
    advance(1500)
    playMiniSound('select')
    expect(ctx.startedSources).toHaveLength(count)
    setSoundEnabled(true)
    playMiniSound('select')
    expect(ctx.startedSources.length).toBeGreaterThan(count)
    expect(ctx.state).toBe('running')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('releases natural completions from the effect registry without stopping music', () => {
    playMiniSound('select')
    const effects = ctx.startedSources.slice(firstSource)
    for (const source of effects) source.onended?.call(source, new Event('ended'))
    const stopSpies = effects.map(source => vi.spyOn(source, 'stop'))
    cleanups.push(startMiniBgm('garage'))
    const music = ctx.startedSources.slice(firstSource + effects.length)
    stopMiniSounds()
    for (const stop of stopSpies) expect(stop).not.toHaveBeenCalled()
    expect(music.some(source => source.stopTime > ctx.currentTime)).toBe(true)
    expect(vi.getTimerCount()).toBe(1)
  })
})

describe('mini-4wd music lifecycle', () => {
  it.each(['garage', 'race'] as const)('stops the %s scheduler, pending notes, and all owned connections on exit', mode => {
    const firstNode = ctx.nodes.length
    const stop = startMiniBgm(mode)
    cleanups.push(stop)
    advance(1000)
    const count = ctx.startedSources.length
    expect(count - firstSource).toBeGreaterThan(10)
    expect(vi.getTimerCount()).toBe(1)
    stop()
    stop()
    expect(vi.getTimerCount()).toBe(0)
    expect(ctx.startedSources.slice(firstSource).every(source => source.stopTime <= ctx.currentTime)).toBe(true)
    expect(ctx.nodes.slice(firstNode).flatMap(node => node.outputs).every(connection => Number.isFinite(connection.end))).toBe(true)
    advance(1000)
    expect(ctx.startedSources).toHaveLength(count)
    expect(ctx.state).toBe('running')
  })

  it('releases finished voices while the song continues', () => {
    cleanups.push(startMiniBgm('race'))
    const firstVoices = ctx.startedSources.slice(firstSource)
    advance(500)
    for (const source of firstVoices) source.onended?.call(source, new Event('ended'))
    expect(firstVoices.every(source => source.outputs.every(connection => Number.isFinite(connection.end)))).toBe(true)
    const count = ctx.startedSources.length
    advance(500)
    expect(ctx.startedSources.length).toBeGreaterThan(count)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('responds to global mute and can start a fresh song after reentry', () => {
    const stop = startMiniBgm('race', 'coast')
    cleanups.push(stop)
    advance(250)
    setSoundEnabled(false)
    advance(25)
    const count = ctx.startedSources.length
    expect(vi.getTimerCount()).toBe(0)
    expect(ctx.startedSources.slice(firstSource).every(source => source.stopTime <= ctx.currentTime)).toBe(true)
    advance(1000)
    expect(ctx.startedSources).toHaveLength(count)
    setSoundEnabled(true)
    cleanups.push(startMiniBgm('garage'))
    advance(500)
    expect(ctx.startedSources.length).toBeGreaterThan(count)
    expect(vi.getTimerCount()).toBe(1)
  })

  it('has different garage and course arrangements with melody, bass and percussion', () => {
    const arrangements = new Set<string>()
    for (const theme of ['park', 'forest', 'coast', 'night'] as const) {
      const from = ctx.startedSources.length
      const stop = startMiniBgm('race', theme)
      advance(500)
      const sources = ctx.startedSources.slice(from)
      arrangements.add(JSON.stringify(signature(sources)))
      expect(sources.some(source => !(source instanceof FakeOscillatorNode))).toBe(true)
      expect(sources.some(source => source instanceof FakeOscillatorNode && source.frequency.valueAt(source.startTime!) < 200)).toBe(true)
      expect(sources.some(source => source instanceof FakeOscillatorNode && source.frequency.valueAt(source.startTime!) > 400)).toBe(true)
      stop()
    }
    const from = ctx.startedSources.length
    const stop = startMiniBgm('garage')
    advance(500)
    arrangements.add(JSON.stringify(signature(ctx.startedSources.slice(from))))
    stop()
    expect(arrangements.size).toBe(5)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not schedule a burst of old notes after a throttled background tab resumes', () => {
    cleanups.push(startMiniBgm('race'))
    const count = ctx.startedSources.length
    ctx.currentTime += 120
    vi.advanceTimersByTime(25)
    expect(ctx.startedSources.length - count).toBeLessThan(8)
    expect(ctx.startedSources.slice(count).every(source => source.startTime! >= ctx.currentTime)).toBe(true)
  })
})
