import type { PianoNoteId } from './notes'
import { findPianoNote } from './notes'

export type InstrumentId = 'piano' | 'violin' | 'trumpet' | 'flute' | 'xylophone'

export type PianoSampleDefinition = {
  noteId: PianoNoteId
  /** 変換前の公式配布ファイル名。ライセンス追跡にも使う。 */
  sourceFile: string
  /** Vite の base path を考慮した同梱済みMP3のURL。 */
  url: string
  /** 同じ楽器内の録音差を調整する補正値。書き出し時はピークを約-8dBFSへ正規化。 */
  gain: number
  /** 公式リポジトリの配布元URL。 */
  sourceUrl: string
}

export type InstrumentSpec = {
  id: InstrumentId
  label: string
  icon: string
  /** 楽器間の知覚音量を揃える補正値（voice gain側の第1層）。 */
  gain: number
  /** 対象13鍵で許容する最近傍アンカーからの最大移調幅（半音）。 */
  maxPitchShift: number
  samples: readonly PianoSampleDefinition[]
}

export type ResolvedSample = {
  definition: PianoSampleDefinition
  /** 13鍵の対象音へ近いアンカーを再生時にこの倍率で移調する。 */
  playbackRate: number
  /** 対象音とアンカーの符号付き移調幅（半音）。 */
  pitchShiftSemitones: number
}

const PITCH_CLASS_SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  D: 2,
  'D#': 3,
  E: 4,
  F: 5,
  'F#': 6,
  G: 7,
  'G#': 8,
  A: 9,
  'A#': 10,
  B: 11,
}

const midiForNote = (noteId: PianoNoteId): number | undefined => {
  const note = findPianoNote(noteId)
  if (!note) return undefined
  const semitone = PITCH_CLASS_SEMITONES[note.pitchClass]
  return semitone === undefined ? undefined : 12 * (note.octave + 1) + semitone
}

const sampleUrl = (instrument: InstrumentId, fileName: string) =>
  `${import.meta.env.BASE_URL}audio/${instrument}/${fileName}`

const vscoUrl = (path: string) => `https://github.com/sgossner/VSCO-2-CE/blob/master/${path}`
const vcslUrl = (path: string) => `https://github.com/sgossner/VCSL/blob/master/${path}`

const pianoSample = (noteId: PianoNoteId, sourceFile: string, fileName: string, gain: number): PianoSampleDefinition => ({
  noteId,
  sourceFile,
  url: sampleUrl('piano', fileName),
  gain,
  sourceUrl: 'https://theremin.music.uiowa.edu/MISpiano.html',
})

/** 既存のピアノ13音。黒鍵は公式ファイルのフラット表記をUIのシャープ表記へ対応させる。 */
export const PIANO_SAMPLE_DEFINITIONS: readonly PianoSampleDefinition[] = [
  pianoSample('C4', 'Piano.mf.C4.aiff', 'C4.mp3', 7.59),
  pianoSample('C#4', 'Piano.mf.Db4.aiff', 'Cs4.mp3', 8.71),
  pianoSample('D4', 'Piano.mf.D4.aiff', 'D4.mp3', 5.37),
  pianoSample('D#4', 'Piano.mf.Eb4.aiff', 'Ds4.mp3', 9.12),
  pianoSample('E4', 'Piano.mf.E4.aiff', 'E4.mp3', 9.44),
  pianoSample('F4', 'Piano.mf.F4.aiff', 'F4.mp3', 7.67),
  pianoSample('F#4', 'Piano.mf.Gb4.aiff', 'Fs4.mp3', 5.96),
  pianoSample('G4', 'Piano.mf.G4.aiff', 'G4.mp3', 5.25),
  pianoSample('G#4', 'Piano.mf.Ab4.aiff', 'Gs4.mp3', 4.17),
  pianoSample('A4', 'Piano.mf.A4.aiff', 'A4.mp3', 5.37),
  pianoSample('A#4', 'Piano.mf.Bb4.aiff', 'As4.mp3', 3.87),
  pianoSample('B4', 'Piano.mf.B4.aiff', 'B4.mp3', 2.24),
  pianoSample('C5', 'Piano.mf.C5.aiff', 'C5.mp3', 4.07),
] as const

const vscoSample = (
  instrument: Exclude<InstrumentId, 'piano' | 'xylophone'>,
  noteId: PianoNoteId,
  sourceFile: string,
  fileName: string,
  sourcePath: string,
): PianoSampleDefinition => ({
  noteId,
  sourceFile,
  url: sampleUrl(instrument, fileName),
  gain: 1,
  sourceUrl: vscoUrl(sourcePath),
})

const violinSamples: readonly PianoSampleDefinition[] = [
  vscoSample('violin', 'C4', 'LLVln_ArcoVib_C4_f.wav', 'C4.mp3', 'Strings/Solo%20Violin/Arco%20Vib/LLVln_ArcoVib_C4_f.wav'),
  vscoSample('violin', 'E4', 'LLVln_ArcoVib_E4_f.wav', 'E4.mp3', 'Strings/Solo%20Violin/Arco%20Vib/LLVln_ArcoVib_E4_f.wav'),
  vscoSample('violin', 'G4', 'LLVln_ArcoVib_G4_f.wav', 'G4.mp3', 'Strings/Solo%20Violin/Arco%20Vib/LLVln_ArcoVib_G4_f.wav'),
  vscoSample('violin', 'A4', 'LLVln_ArcoVib_A4_f.wav', 'A4.mp3', 'Strings/Solo%20Violin/Arco%20Vib/LLVln_ArcoVib_A4_f.wav'),
  vscoSample('violin', 'C5', 'LLVln_ArcoVib_C5_f.wav', 'C5.mp3', 'Strings/Solo%20Violin/Arco%20Vib/LLVln_ArcoVib_C5_f.wav'),
]

const trumpetSamples: readonly PianoSampleDefinition[] = [
  vscoSample('trumpet', 'D4', 'Sum_SHTrumpet_sus_D4_v1_rr1.wav', 'D4.mp3', 'Brass/Trumpet/sus/Sum_SHTrumpet_sus_D4_v1_rr1.wav'),
  vscoSample('trumpet', 'F4', 'Sum_SHTrumpet_sus_F4_v1_rr1.wav', 'F4.mp3', 'Brass/Trumpet/sus/Sum_SHTrumpet_sus_F4_v1_rr1.wav'),
  vscoSample('trumpet', 'A4', 'Sum_SHTrumpet_sus_A4_v1_rr1.wav', 'A4.mp3', 'Brass/Trumpet/sus/Sum_SHTrumpet_sus_A4_v1_rr1.wav'),
  vscoSample('trumpet', 'C5', 'Sum_SHTrumpet_sus_C5_v1_rr1.wav', 'C5.mp3', 'Brass/Trumpet/sus/Sum_SHTrumpet_sus_C5_v1_rr1.wav'),
]

const fluteSamples: readonly PianoSampleDefinition[] = [
  vscoSample('flute', 'C4', 'LDFlute_susNV_C4_v1_1.wav', 'C4.mp3', 'Woodwinds/Flute/susNV/LDFlute_susNV_C4_v1_1.wav'),
  vscoSample('flute', 'E4', 'LDFlute_susNV_E4_v1_1.wav', 'E4.mp3', 'Woodwinds/Flute/susNV/LDFlute_susNV_E4_v1_1.wav'),
  vscoSample('flute', 'A4', 'LDFlute_susNV_A4_v1_1.wav', 'A4.mp3', 'Woodwinds/Flute/susNV/LDFlute_susNV_A4_v1_1.wav'),
  vscoSample('flute', 'C5', 'LDFlute_susNV_C5_v1_1.wav', 'C5.mp3', 'Woodwinds/Flute/susNV/LDFlute_susNV_C5_v1_1.wav'),
]

const xylophoneSamples: readonly PianoSampleDefinition[] = [
  {
    noteId: 'C4',
    sourceFile: 'Xylo_Medium_C4_ff_01_far.wav',
    url: sampleUrl('xylophone', 'C4.mp3'),
    gain: 1,
    sourceUrl: vcslUrl('Idiophones/Struck%20Idiophones/Xylophone/Medium%20Mallets/Xylo_Medium_C4_ff_01_far.wav'),
  },
  {
    noteId: 'G4',
    sourceFile: 'Xylo_Medium_G4_ff_01_far.wav',
    url: sampleUrl('xylophone', 'G4.mp3'),
    gain: 1,
    sourceUrl: vcslUrl('Idiophones/Struck%20Idiophones/Xylophone/Medium%20Mallets/Xylo_Medium_G4_ff_01_far.wav'),
  },
  {
    noteId: 'C5',
    sourceFile: 'Xylo_Medium_C5_ff_01_far.wav',
    url: sampleUrl('xylophone', 'C5.mp3'),
    gain: 1,
    sourceUrl: vcslUrl('Idiophones/Struck%20Idiophones/Xylophone/Medium%20Mallets/Xylo_Medium_C5_ff_01_far.wav'),
  },
]

export const INSTRUMENT_SPECS: readonly InstrumentSpec[] = [
  { id: 'piano', label: 'ピアノ', icon: '🎹', gain: 1, maxPitchShift: 0, samples: PIANO_SAMPLE_DEFINITIONS },
  { id: 'violin', label: 'バイオリン', icon: '🎻', gain: 0.82, maxPitchShift: 2, samples: violinSamples },
  { id: 'trumpet', label: 'ラッパ', icon: '🎺', gain: 0.58, maxPitchShift: 2, samples: trumpetSamples },
  { id: 'flute', label: 'フルート', icon: '🪈', gain: 0.82, maxPitchShift: 2, samples: fluteSamples },
  { id: 'xylophone', label: '木琴', icon: '🪇', gain: 0.72, maxPitchShift: 3, samples: xylophoneSamples },
] as const

const instrumentById = new Map(INSTRUMENT_SPECS.map((spec) => [spec.id, spec]))

export function getInstrumentSpec(instrumentId: InstrumentId): InstrumentSpec {
  return instrumentById.get(instrumentId) ?? INSTRUMENT_SPECS[0]
}

export function findPianoSample(noteId: PianoNoteId): PianoSampleDefinition | undefined {
  return PIANO_SAMPLE_DEFINITIONS.find((sample) => sample.noteId === noteId)
}

/** 対象13音に最も近い公式アンカーを一つ選び、AudioBufferSourceNode用の移調倍率を返す。 */
export function resolveInstrumentSample(instrumentId: InstrumentId, noteId: PianoNoteId): ResolvedSample | undefined {
  const targetMidi = midiForNote(noteId)
  if (targetMidi === undefined) return undefined
  const spec = getInstrumentSpec(instrumentId)
  let nearest: PianoSampleDefinition | undefined
  let nearestDistance = Number.POSITIVE_INFINITY
  let nearestMidi = Number.POSITIVE_INFINITY

  for (const sample of spec.samples) {
    const sourceMidi = midiForNote(sample.noteId)
    if (sourceMidi === undefined) continue
    const distance = Math.abs(sourceMidi - targetMidi)
    // 同距離では低いアンカーを優先し、音色の変化を一方向に固定する。
    if (distance < nearestDistance || (distance === nearestDistance && sourceMidi < nearestMidi)) {
      nearest = sample
      nearestDistance = distance
      nearestMidi = sourceMidi
    }
  }
  if (!nearest) return undefined
  const pitchShiftSemitones = targetMidi - nearestMidi
  return {
    definition: nearest,
    playbackRate: 2 ** (pitchShiftSemitones / 12),
    pitchShiftSemitones,
  }
}
