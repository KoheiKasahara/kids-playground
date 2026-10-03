/**
 * ゲームの効果音を、本物と同じ共有 AudioContext の経路で鳴らして音量を測るテスト用の計測器。
 * window.AudioContext を FakeAudioContext に差し替え、1回の「再生」で始まった音源だけを描き起こす。
 * 使う側は vi.useFakeTimers() を有効にしておく（setTimeout で遅れて鳴る音や BGM も時間を進めて測れる）。
 */
import { vi } from 'vitest'
import { getSharedAudioContext, getSoundOutput } from '../../audio/sound'
import { FakeAudioContext, type FakeAudioNode } from './fakeAudioContext'
import { measureLoudness, type LoudnessResult } from './loudness'
import { renderMono } from './offlineRender'

export type SoundSampleHelpers = {
  /** ゲームが使う共有 AudioContext（FakeAudioContext）。 */
  ctx: FakeAudioContext
  /** 音の時計とタイマーを一緒に進める。BGM や遅れて鳴る音を測るときに使う。 */
  advance: (ms: number) => void
}

export type SoundSample = {
  name: string
  /** 音を鳴らす。BGM やループ音は止める関数を返す（測定の最後に呼ぶ）。 */
  play: (helpers: SoundSampleHelpers) => void | (() => void)
  /**
   * 止めるまで鳴り続ける音（BGM・走行音など）を何秒ぶん測るか。
   * 指定すると、その時間だけ時計を進めてから止める関数を呼ぶ。
   */
  seconds?: number
}

export type SoundMeasurement = LoudnessResult & { name: string }

/** ループ音を測るときの既定の長さと、余韻を描き起こす長さ [秒]。 */
const TAIL_SECONDS = 0.6
const MAX_RENDER_SECONDS = 8

export function installFakeAudio(): FakeAudioContext {
  if (typeof window === 'undefined') vi.stubGlobal('window', globalThis)
  vi.stubGlobal('AudioContext', FakeAudioContext)
  ;(window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext
  const ctx = getSharedAudioContext()
  if (!(ctx instanceof FakeAudioContext)) {
    throw new Error('共有 AudioContext が FakeAudioContext になっていません。sound.ts を読み込む前に installFakeAudio() を呼んでください。')
  }
  return ctx
}

/** ピアノのように自前の AudioContext を持つゲームもあるので、すべての Context の時計を一緒に進める。 */
function advanceClock(ms: number): void {
  // BGM のスケジューラーは「今の時刻 + 少し先」まで音を予約するので、細かく刻んで進める。
  const step = 10
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    const delta = Math.min(step, ms - elapsed)
    for (const context of FakeAudioContext.instances) {
      if (context.state !== 'closed') context.currentTime += delta / 1000
    }
    vi.advanceTimersByTime(delta)
  }
}

export function measureSample(ctx: FakeAudioContext, sample: SoundSample): SoundMeasurement {
  // 前の測定の音・クールダウンと混ざらないよう、時計を大きく進めてから鳴らす。
  advanceClock(3_000)
  const startedAt = new Map<FakeAudioContext, { firstSource: number; from: number }>()
  const remember = () => {
    for (const context of FakeAudioContext.instances) {
      if (!startedAt.has(context)) startedAt.set(context, { firstSource: context.startedSources.length, from: context.currentTime })
    }
  }
  remember()
  const sessionSources = () => [...startedAt].flatMap(([context, { firstSource }]) => context.startedSources.slice(firstSource))
  const elapsed = () => ctx.currentTime - startedAt.get(ctx)!.from
  const helpers: SoundSampleHelpers = { ctx, advance: (ms) => advanceClock(ms) }
  // 再生中に新しく作られた Context（ピアノなど）も、作られた時点から測る。
  FakeAudioContext.onCreate = remember
  let stop: void | (() => void)
  try {
    stop = sample.play(helpers)
    if (sample.seconds !== undefined) {
      advanceClock(Math.max(0, sample.seconds - elapsed()) * 1000)
    } else if (typeof stop === 'function') {
      // 後片付け（dispose）で鳴りかけの音を止めないよう、音が自然に鳴り終わるまで待ってから呼ぶ。
      let remaining = 0
      for (const source of sessionSources()) {
        if (Number.isFinite(source.stopTime)) remaining = Math.max(remaining, source.stopTime - source.context.currentTime)
      }
      advanceClock(Math.min(MAX_RENDER_SECONDS, remaining + 0.1) * 1000)
    }
    if (typeof stop === 'function') stop()
  } finally {
    FakeAudioContext.onCreate = undefined
  }

  let mix: Float32Array | undefined
  for (const [context, { firstSource, from }] of startedAt) {
    const sources = context.startedSources.slice(firstSource)
    if (sources.length === 0) continue
    let end = context.currentTime
    for (const source of sources) end = Math.max(end, Number.isFinite(source.stopTime) ? source.stopTime : context.currentTime)
    const duration = Math.min(MAX_RENDER_SECONDS, end - from + TAIL_SECONDS)
    const sinks = new Set<FakeAudioNode>([getSoundOutput(context as unknown as AudioContext) as unknown as FakeAudioNode, context.destination])
    const signal = renderMono(context, { sources, sinks, from, duration })
    if (!mix || mix.length < signal.length) {
      const grown = new Float32Array(signal.length)
      if (mix) grown.set(mix)
      mix = grown
    }
    for (let i = 0; i < signal.length; i++) mix[i] += signal[i]
  }
  // 次の測定までに、遅れて走る後片付け（disconnect の setTimeout など）を済ませておく。
  advanceClock(1_000)
  return { name: sample.name, ...measureLoudness(mix ?? new Float32Array(ctx.sampleRate), ctx.sampleRate) }
}
