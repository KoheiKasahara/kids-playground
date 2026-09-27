import { describe, expect, test } from 'vitest'
import { findPianoSong } from '../shared/music/pianoSongs'
import {
  MODE_RULES,
  buildRhythmChart,
  findExpiredTargets,
  findTapTarget,
  judgeOffset,
  rhythmAccuracy,
  starsForAccuracy,
  tallyJudgements,
  type Judgement,
} from './rhythmChart'
import { RHYTHM_SONGS, findRhythmSong, melodyForRhythmSong } from './rhythmSongs'

describe('RHYTHM_SONGS', () => {
  test('すべての曲がピアノと共有の曲データを参照し、IDが重複しない', () => {
    expect(new Set(RHYTHM_SONGS.map((song) => song.id)).size).toBe(RHYTHM_SONGS.length)
    for (const song of RHYTHM_SONGS) {
      expect(findPianoSong(song.id), song.id).toBeDefined()
      expect(melodyForRhythmSong(song)).toBe(findPianoSong(song.id))
      expect(findRhythmSong(song.id)).toBe(song)
    }
    expect(findRhythmSong('unknown')).toBeUndefined()
  })

  test.each(RHYTHM_SONGS)('$title は どのモードでも 幼児が追いつける間隔になる', (song) => {
    for (const mode of ['easy', 'normal'] as const) {
      const chart = buildRhythmChart(melodyForRhythmSong(song), song.tempoBpm, mode)
      const targets = chart.notes.filter((note) => note.target)
      expect(targets.length).toBeGreaterThanOrEqual(8)
      expect(chart.targetCount).toBe(targets.length)
      for (let index = 1; index < targets.length; index += 1) {
        expect(targets[index].timeMs - targets[index - 1].timeMs).toBeGreaterThanOrEqual(MODE_RULES[mode].minGapMs)
      }
      expect(chart.notes.every((note) => note.lane >= 0 && note.lane < chart.laneCount)).toBe(true)
      expect(chart.durationMs).toBeGreaterThan(targets.at(-1)!.timeMs)
    }
  })
})

describe('buildRhythmChart', () => {
  const twinkle = findRhythmSong('twinkle-twinkle-little-star')!

  test('ピアノより遅いテンポへ時刻をのばす', () => {
    const melody = melodyForRhythmSong(twinkle)
    const chart = buildRhythmChart(melody, twinkle.tempoBpm, 'easy')
    expect(chart.beatMs).toBeCloseTo(60_000 / twinkle.tempoBpm)
    expect(chart.notes[1].timeMs).toBe(Math.round(melody.timeline[1].startMs * (melody.tempoBpm / twinkle.tempoBpm)))
  })

  test('かんたんは1レーン、みっつは低い音を左・高い音を右に置く', () => {
    const melody = melodyForRhythmSong(twinkle)
    expect(buildRhythmChart(melody, twinkle.tempoBpm, 'easy').notes.every((note) => note.lane === 0)).toBe(true)
    const chart = buildRhythmChart(melody, twinkle.tempoBpm, 'normal')
    const laneOf = (noteId: string) => chart.notes.find((note) => note.noteId === noteId)!.lane
    expect(laneOf('C4')).toBe(0)
    expect(laneOf('A4')).toBe(2)
    expect(new Set(chart.notes.map((note) => note.lane))).toEqual(new Set([0, 1, 2]))
  })

  test('速い音はタップせず自動で鳴らし、メロディを途切れさせない', () => {
    const song = findRhythmSong('can-can')!
    const chart = buildRhythmChart(melodyForRhythmSong(song), song.tempoBpm, 'easy')
    expect(chart.notes.some((note) => !note.target)).toBe(true)
    expect(chart.notes).toHaveLength(melodyForRhythmSong(song).timeline.filter((item) => item.kind === 'note').length)
  })
})

describe('判定', () => {
  const song = findRhythmSong('twinkle-twinkle-little-star')!
  const chart = buildRhythmChart(melodyForRhythmSong(song), song.tempoBpm, 'easy')
  const first = chart.notes[0]
  const second = chart.notes[1]

  test('ずれが小さいほど よい判定。幅の外は なにもしない', () => {
    expect(judgeOffset(0, 'easy')).toBe('perfect')
    expect(judgeOffset(-MODE_RULES.easy.perfectWindowMs, 'easy')).toBe('perfect')
    expect(judgeOffset(MODE_RULES.easy.perfectWindowMs + 1, 'easy')).toBe('good')
    expect(judgeOffset(MODE_RULES.easy.goodWindowMs + 1, 'easy')).toBeNull()
  })

  test('早押しで先のノーツを取らず、いちばん古い未判定ノーツを選ぶ', () => {
    const judged = new Map<number, Judgement>()
    expect(findTapTarget(chart, judged, 0, first.timeMs - MODE_RULES.easy.goodWindowMs - 50)).toBeUndefined()
    expect(findTapTarget(chart, judged, 0, first.timeMs + 10)).toBe(first)
    judged.set(first.index, 'perfect')
    expect(findTapTarget(chart, judged, 0, first.timeMs + 10)).toBeUndefined()
    expect(findTapTarget(chart, judged, 0, second.timeMs - 100)).toBe(second)
  })

  test('判定幅を過ぎたノーツを見のがしとして返す', () => {
    const judged = new Map<number, Judgement>()
    expect(findExpiredTargets(chart, judged, first.timeMs + MODE_RULES.easy.goodWindowMs)).toEqual([])
    expect(findExpiredTargets(chart, judged, first.timeMs + MODE_RULES.easy.goodWindowMs + 1)).toEqual([first])
  })

  test('★は さいごまで あそべば1つ、上手なほど増える', () => {
    const judged = new Map<number, Judgement>([[0, 'perfect'], [1, 'good'], [2, 'miss']])
    const tally = tallyJudgements(judged)
    expect(tally).toEqual({ perfect: 1, good: 1, miss: 1 })
    expect(rhythmAccuracy(tally, 3)).toBeCloseTo(0.6)
    expect(rhythmAccuracy(tally, 0)).toBe(0)
    expect(starsForAccuracy(0)).toBe(1)
    expect(starsForAccuracy(0.6)).toBe(2)
    expect(starsForAccuracy(0.9)).toBe(3)
  })
})
