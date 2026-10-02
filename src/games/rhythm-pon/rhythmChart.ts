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
  /** タップする音どうしを、少なくともこの時間はあける。1拍では足りない速い曲は2拍ごとにする。 */
  readonly minGapMs: number
  /** 早すぎ・遅すぎの許容幅（ms）。幼児向けに広めにとる。 */
  readonly perfectWindowMs: number
  readonly goodWindowMs: number
  /** ノーツが画面の奥から判定ラインまで届く時間。 */
  readonly approachMs: number
}

export const MODE_RULES: Readonly<Record<RhythmMode, ModeRule>> = {
  easy: { laneCount: 1, minGapMs: 640, perfectWindowMs: 170, goodWindowMs: 330, approachMs: 2400 },
  normal: { laneCount: 3, minGapMs: 340, perfectWindowMs: 125, goodWindowMs: 260, approachMs: 1900 },
}

/** 旋律の時刻の丸め誤差を吸収して、拍の頭とみなす幅（拍）。 */
const ON_BEAT_TOLERANCE = 0.1

function midiOf(noteId: string): number {
  const note = findPianoNote(noteId)
  if (!note) throw new Error(`未定義の音です: ${noteId}`)
  return Math.round(69 + 12 * Math.log2(note.frequency / 440))
}

/**
 * 音の高さの順を保ったまま、音の種類を laneCount 個のまとまりに分ける。
 * 各まとまりの回数の二乗和が最小になる区切り（各まとまりの先頭の番号）を返す。
 */
function splitEvenly(counts: readonly number[], laneCount: number, from = 0): { cost: number; starts: number[] } {
  const sizeOf = (end: number) => counts.slice(from, end).reduce((sum, count) => sum + count, 0)
  if (laneCount === 1) return { cost: sizeOf(counts.length) ** 2, starts: [from] }
  let best = { cost: Number.POSITIVE_INFINITY, starts: [] as number[] }
  for (let end = from; end <= counts.length; end += 1) {
    const rest = splitEvenly(counts, laneCount - 1, end)
    const cost = sizeOf(end) ** 2 + rest.cost
    if (cost < best.cost) best = { cost, starts: [from, ...rest.starts] }
  }
  return best
}

/**
 * 音の高さ（MIDI）からレーンを決める関数を作る。低い音ほど左。
 * 音域を三等分すると、低い音ばかりの曲では左の太鼓に偏るため、タップする音の回数がそろうように分ける。
 * タップしない音は、それ以下でいちばん近いタップ音と同じレーンにする。
 */
function pitchLanes(targetMidis: readonly number[], laneCount: number): (midi: number) => number {
  if (laneCount === 1) return () => 0
  const pitches = [...new Set(targetMidis)].sort((a, b) => a - b)
  const counts = pitches.map((pitch) => targetMidis.filter((value) => value === pitch).length)
  const { starts } = splitEvenly(counts, laneCount)
  return (midi) => {
    const rank = Math.max(0, pitches.filter((pitch) => pitch <= midi).length - 1)
    return starts.reduce((lane, start, index) => (start <= rank ? index : lane), 0)
  }
}

/**
 * 共有の旋律データから、リズムゲームの譜面を作る。
 * すべての音を叩かせると幼児には速すぎるため、タップする音を間引き、残りは「自動で鳴る音」にして
 * メロディは途切れさせない。
 * タップする音は拍の頭（伴奏の太鼓と同じ時刻）にだけ置き、裏拍や細かい音は叩かせない。
 * 1拍では間に合わない速い曲は2拍ごとにし、長い音（旋律の山）が多く乗る向きに拍をそろえる。
 * こうすると、こどもは「どん・どん」という一定の間隔で叩けばよく、次のタイミングを予想しやすい。
 * 3レーンでは、低い音を左・高い音を右に置き、ピアノの鍵盤と同じ向きにする。
 */
export function buildRhythmChart(melody: PianoSong, tempoBpm: number, mode: RhythmMode): RhythmChart {
  const rule = MODE_RULES[mode]
  const scale = melody.tempoBpm / tempoBpm
  const beatMs = 60_000 / tempoBpm
  const melodyBeatMs = 60_000 / melody.tempoBpm
  const stepBeats = Math.ceil(rule.minGapMs / beatMs)
  const melodyNotes = melody.timeline.filter((item) => item.kind === 'note')
  const midis = melodyNotes.map((item) => midiOf(item.noteId))

  const beatIndexes = melodyNotes.map((item) => {
    const beat = item.startMs / melodyBeatMs
    return Math.abs(beat - Math.round(beat)) <= ON_BEAT_TOLERANCE ? Math.round(beat) : null
  })
  const phaseWeights = Array.from({ length: stepBeats }, () => 0)
  beatIndexes.forEach((beat, index) => {
    if (beat !== null) phaseWeights[beat % stepBeats] += melodyNotes[index].durationMs
  })
  const phase = phaseWeights.indexOf(Math.max(...phaseWeights))
  const targets = beatIndexes.map((beat) => beat !== null && beat % stepBeats === phase)
  const laneOf = pitchLanes(midis.filter((_, index) => targets[index]), rule.laneCount)

  const notes = melodyNotes.map((item, index): ChartNote => ({
    index,
    noteId: item.noteId,
    timeMs: Math.round(item.startMs * scale),
    durationMs: Math.round(item.durationMs * scale),
    lane: laneOf(midis[index]),
    target: targets[index],
  }))

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
