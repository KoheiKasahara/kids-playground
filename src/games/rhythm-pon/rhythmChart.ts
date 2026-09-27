import { findPianoNote } from '../shared/music/notes'
import type { PianoSong } from '../shared/music/pianoSongs'

export type RhythmMode = 'easy' | 'normal'
export type Judgement = 'perfect' | 'good' | 'miss'

export type ChartNote = {
  readonly index: number
  readonly noteId: string
  /** 曲の頭からの時刻（ms）。 */
  readonly timeMs: number
  readonly durationMs: number
  readonly lane: number
  /** true: こどもがタップする音。false: 間を埋めるため自動で鳴る音。 */
  readonly target: boolean
}

export type RhythmChart = {
  readonly mode: RhythmMode
  readonly laneCount: number
  readonly beatMs: number
  readonly notes: readonly ChartNote[]
  readonly targetCount: number
  readonly durationMs: number
}

type ModeRule = {
  readonly laneCount: number
  /** 前のタップ音から、少なくともこの拍数あける。 */
  readonly minGapBeats: number
  /** テンポにかかわらず、少なくともこの時間はあける。 */
  readonly minGapMs: number
  /** 早すぎ・遅すぎの許容幅（ms）。幼児向けに広めにとる。 */
  readonly perfectWindowMs: number
  readonly goodWindowMs: number
  /** ノーツが画面の奥から判定ラインまで届く時間。 */
  readonly approachMs: number
}

export const MODE_RULES: Readonly<Record<RhythmMode, ModeRule>> = {
  easy: { laneCount: 1, minGapBeats: 1, minGapMs: 640, perfectWindowMs: 170, goodWindowMs: 330, approachMs: 2400 },
  normal: { laneCount: 3, minGapBeats: 0.5, minGapMs: 340, perfectWindowMs: 125, goodWindowMs: 260, approachMs: 1900 },
}

function midiOf(noteId: string): number {
  const note = findPianoNote(noteId)
  if (!note) throw new Error(`未定義の音です: ${noteId}`)
  return Math.round(69 + 12 * Math.log2(note.frequency / 440))
}

/**
 * 共有の旋律データから、リズムゲームの譜面を作る。
 * すべての音を叩かせると幼児には速すぎるため、間隔の詰まった音は「自動で鳴る音」にして
 * メロディは途切れさせず、タップする音だけを間引く。
 * 3レーンでは、低い音を左・高い音を右に置き、ピアノの鍵盤と同じ向きにする。
 */
export function buildRhythmChart(melody: PianoSong, tempoBpm: number, mode: RhythmMode): RhythmChart {
  const rule = MODE_RULES[mode]
  const scale = melody.tempoBpm / tempoBpm
  const beatMs = 60_000 / tempoBpm
  const minGapMs = Math.max(rule.minGapMs, rule.minGapBeats * beatMs - 1)
  const melodyNotes = melody.timeline.filter((item) => item.kind === 'note')
  const midis = melodyNotes.map((item) => midiOf(item.noteId))
  const lowest = Math.min(...midis)
  const span = Math.max(...midis) - lowest + 1

  let lastTargetMs = Number.NEGATIVE_INFINITY
  const notes = melodyNotes.map((item, index): ChartNote => {
    const timeMs = Math.round(item.startMs * scale)
    const target = timeMs - lastTargetMs >= minGapMs
    if (target) lastTargetMs = timeMs
    const lane = rule.laneCount === 1 ? 0 : Math.min(rule.laneCount - 1, Math.floor(((midis[index] - lowest) / span) * rule.laneCount))
    return { index, noteId: item.noteId, timeMs, durationMs: Math.round(item.durationMs * scale), lane, target }
  })

  return {
    mode,
    laneCount: rule.laneCount,
    beatMs,
    notes,
    targetCount: notes.filter((note) => note.target).length,
    durationMs: Math.round(melody.totalDurationMs * scale),
  }
}

/** ずれ（ms）から判定を返す。範囲外なら null（なにもしない）。 */
export function judgeOffset(offsetMs: number, mode: RhythmMode): Exclude<Judgement, 'miss'> | null {
  const rule = MODE_RULES[mode]
  const distance = Math.abs(offsetMs)
  if (distance <= rule.perfectWindowMs) return 'perfect'
  if (distance <= rule.goodWindowMs) return 'good'
  return null
}

/**
 * タップしたレーンで、いま叩ける いちばん古いノーツを探す。
 * 早押しで先のノーツを取ってしまわないよう、判定幅の中の未判定ノーツだけを見る。
 */
export function findTapTarget(
  chart: RhythmChart,
  judged: ReadonlyMap<number, Judgement>,
  lane: number,
  nowMs: number,
): ChartNote | undefined {
  const window = MODE_RULES[chart.mode].goodWindowMs
  return chart.notes.find((note) => note.target && note.lane === lane && !judged.has(note.index)
    && Math.abs(note.timeMs - nowMs) <= window)
}

/** 判定幅を過ぎても叩かれなかったノーツ。 */
export function findExpiredTargets(
  chart: RhythmChart,
  judged: ReadonlyMap<number, Judgement>,
  nowMs: number,
): ChartNote[] {
  const window = MODE_RULES[chart.mode].goodWindowMs
  return chart.notes.filter((note) => note.target && !judged.has(note.index) && nowMs - note.timeMs > window)
}

export type RhythmTally = { perfect: number; good: number; miss: number }

export function tallyJudgements(judged: ReadonlyMap<number, Judgement>): RhythmTally {
  const tally: RhythmTally = { perfect: 0, good: 0, miss: 0 }
  for (const judgement of judged.values()) tally[judgement] += 1
  return tally
}

/** 0〜1。「いいね」も しっかり ほめるため、すごいの8割として数える。 */
export function rhythmAccuracy(tally: RhythmTally, total: number): number {
  if (total <= 0) return 0
  return Math.min(1, (tally.perfect + tally.good * 0.8) / total)
}

/** さいごまで あそべば かならず★1。幼児向けに★3の基準もやさしめにする。 */
export function starsForAccuracy(accuracy: number): 1 | 2 | 3 {
  if (accuracy >= 0.75) return 3
  if (accuracy >= 0.45) return 2
  return 1
}
