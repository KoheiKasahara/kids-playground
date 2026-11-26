import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSoundOutput, setSoundEnabled } from '../../audio/sound'
import { FakeAudioBufferSourceNode, FakeAudioContext, FakeOscillatorNode, type FakeAudioNode, type FakeAudioScheduledSourceNode } from '../../test/audio/fakeAudioContext'
import { measureLoudness } from '../../test/audio/loudness'
import { renderMono } from '../../test/audio/offlineRender'
import { installFakeAudio } from '../../test/audio/soundMeter'
import { bgmCutIn, bgmHit, bgmWindup, freq, startBgm } from './sounds'

/** BGM の 8ぶおんぷ ひとつぶん（152 BPM）。 */
const STEP = 60 / 152 / 2

let ctx: FakeAudioContext
const stops: (() => void)[] = []

function advance(ms: number) {
  for (let elapsed = 0; elapsed < ms; elapsed += 10) {
    ctx.currentTime += .01
    vi.advanceTimersByTime(10)
  }
}

type Run = { startedAt: number; sources: FakeAudioScheduledSourceNode[]; signal?: Float32Array }

/** BGM を ながして、play の あいだに なった おとを あつめる。 */
function record(play: () => void): Run {
  const startedAt = ctx.currentTime
  const first = ctx.startedSources.length
  const stop = startBgm()
  stops.push(stop)
  play()
  stop()
  return { startedAt, sources: ctx.startedSources.slice(first) }
}

/** BGM の おとを かきおこして、はじめてから [from, to] びょうの おおきさ（A とくせい Fast の さいだい）を はかる。 */
function levelOf(run: Run, from: number, to: number) {
  const rate = ctx.sampleRate
  // かきおこしは おもいので、いる ところまで だけ。
  if (!run.signal || run.signal.length < to * rate) {
    const output = getSoundOutput(ctx as unknown as AudioContext) as unknown as FakeAudioNode
    run.signal = renderMono(ctx, { sources: run.sources, sinks: new Set([output]), from: run.startedAt, duration: to })
  }
  return measureLoudness(run.signal.subarray(Math.round(from * rate), Math.round(to * rate)), rate).level
}

const noisesBetween = (sources: FakeAudioScheduledSourceNode[], from: number, to: number) =>
  sources.filter(source => source instanceof FakeAudioBufferSourceNode && source.startTime! >= from && source.startTime! < to)

beforeAll(() => {
  ctx = installFakeAudio()
  getSoundOutput(ctx as unknown as AudioContext)
})

beforeEach(() => {
  vi.useFakeTimers()
  setSoundEnabled(true)
  // まえの BGM の よいんと まざらない ように、じかんを あける。
  ctx.currentTime += 30
})

afterEach(() => {
  for (const stop of stops.splice(0)) stop()
  vi.runOnlyPendingTimers()
  setSoundEnabled(true)
  vi.useRealTimers()
})

afterAll(() => vi.unstubAllGlobals())

describe('カブクワ バトルの BGM と たたかいの うごき', () => {
  it('BGM が ながれて いない ときは、わざに あわせる そうさを しても なにも ならない', () => {
    const count = ctx.startedSources.length
    bgmWindup(.5)
    bgmHit(true)
    bgmCutIn(1.8)
    expect(ctx.startedSources).toHaveLength(count)

    // とめた あとも おなじ。
    const stop = startBgm()
    stop()
    const stopped = ctx.startedSources.length
    bgmWindup(.5)
    bgmHit(true)
    bgmCutIn(1.8)
    expect(ctx.startedSources).toHaveLength(stopped)
  })

  it('わざを ためると、BGM の 16ぶの きざみに あわせて スネアの ロールが はいる', () => {
    const { startedAt, sources } = record(() => {
      advance(1000)
      bgmWindup(.5)
      advance(1000)
    })
    const at = startedAt + 1
    const base = record(() => advance(2000))
    const roll = noisesBetween(sources, at, at + .6).length - noisesBetween(base.sources, base.startedAt + 1, base.startedAt + 1.6).length
    expect(roll).toBeGreaterThanOrEqual(5)
    const added = noisesBetween(sources, at, at + .6).map(source => source.startTime! - startedAt)
    // ロールの おとは どれも 16ぶの こうしの うえに のる。
    const grid = added.map(t => ((t - .1) / (STEP / 2)) % 1).map(r => Math.min(r, 1 - r))
    expect(Math.max(...grid)).toBeLessThan(1e-6)
  })

  it('わざが きまると BGM が いっしゅん ひっこみ、おおわざの ときだけ シンバルが なる', () => {
    const base = record(() => advance(2600))
    const small = record(() => { advance(1000); bgmHit(false); advance(1600) })
    const big = record(() => { advance(1000); bgmHit(true); advance(1600) })
    // しばらくすると もとに もどる。
    expect(Math.abs(levelOf(small, 2.1, 2.5) - levelOf(base, 2.1, 2.5))).toBeLessThan(1)
    // ひっこんで いる あいだは ちいさい。
    expect(levelOf(small, 1.03, 1.1)).toBeLessThan(levelOf(base, 1.03, 1.1) - 3)
    const crash = (run: typeof base) => noisesBetween(run.sources, run.startedAt + 1.02, run.startedAt + 1.04)
    expect(crash(small)).toHaveLength(crash(base).length)
    expect(crash(big).length).toBeGreaterThan(crash(base).length)
  })

  it('カットインの あいだは こもって ちいさく なり、あけたら もりあがる ところから 2はんおん あげて つづく', () => {
    const base = record(() => advance(4000))
    const cut = record(() => {
      advance(500)
      bgmCutIn(1.8)
      // カットインの あいだは わざに あわせた うごきを うけつけない。
      const count = ctx.startedSources.length
      bgmHit(true)
      bgmWindup(.5)
      expect(ctx.startedSources).toHaveLength(count)
      advance(3500)
    })
    const after = levelOf(cut, 2.5, 3.5)
    const during = levelOf(cut, .9, 2.1)
    expect(during).toBeLessThan(levelOf(base, .9, 2.1) - 6)
    expect(after).toBeGreaterThan(during + 6)

    // あけた あとの さいしょの メロディは、もりあがる ところの はじめの C6 を 2はんおん あげた D6。
    const end = cut.startedAt + 2.3
    const lead = cut.sources
      .filter((source): source is FakeOscillatorNode => source instanceof FakeOscillatorNode && source.type === 'sawtooth')
      .filter(source => source.startTime! >= end - STEP / 2 && source.frequency.valueAt(source.startTime!) > 1000)
      .sort((a, b) => a.startTime! - b.startTime!)
    expect(lead[0].frequency.valueAt(lead[0].startTime!)).toBeCloseTo(freq('D6'), 1)
    // ハイハットが 16ぶに なって、ふつうの ときより おとが ふえる。
    expect(noisesBetween(cut.sources, cut.startedAt + 2.5, cut.startedAt + 3.8).length)
      .toBeGreaterThan(noisesBetween(base.sources, base.startedAt + 2.5, base.startedAt + 3.8).length)
  })

  it('おとを けして いる ときは BGM を はじめない', () => {
    setSoundEnabled(false)
    const count = ctx.startedSources.length
    const stop = startBgm()
    bgmCutIn(1.8)
    advance(500)
    stop()
    expect(ctx.startedSources).toHaveLength(count)
    expect(vi.getTimerCount()).toBe(0)
  })
})
