import type { PianoNoteId } from './notes'

export type PianoSampleDefinition = {
  noteId: PianoNoteId
  /** University of Iowa の配布時ファイル名（変換前）。 */
  sourceFile: string
  /** Vite の base path を考慮した、同梱済みMP3のURL。 */
  url: string
  /** 変換後ファイルのピークを-6 dBFSへ近づける補正値。 */
  gain: number
}

const sampleUrl = (fileName: string) => `${import.meta.env.BASE_URL}audio/piano/${fileName}`

/**
 * C4〜C5の各鍵へ、同音程のUniversity of Iowa録音を1対1で対応付ける。
 * 黒鍵は公式ファイルでフラット表記のため、UI上のシャープ表記とここで対応させる。
 */
export const PIANO_SAMPLE_DEFINITIONS: readonly PianoSampleDefinition[] = [
  { noteId: 'C4', sourceFile: 'Piano.mf.C4.aiff', url: sampleUrl('C4.mp3'), gain: 7.59 },
  { noteId: 'C#4', sourceFile: 'Piano.mf.Db4.aiff', url: sampleUrl('Cs4.mp3'), gain: 8.71 },
  { noteId: 'D4', sourceFile: 'Piano.mf.D4.aiff', url: sampleUrl('D4.mp3'), gain: 5.37 },
  { noteId: 'D#4', sourceFile: 'Piano.mf.Eb4.aiff', url: sampleUrl('Ds4.mp3'), gain: 9.12 },
  { noteId: 'E4', sourceFile: 'Piano.mf.E4.aiff', url: sampleUrl('E4.mp3'), gain: 9.44 },
  { noteId: 'F4', sourceFile: 'Piano.mf.F4.aiff', url: sampleUrl('F4.mp3'), gain: 7.67 },
  { noteId: 'F#4', sourceFile: 'Piano.mf.Gb4.aiff', url: sampleUrl('Fs4.mp3'), gain: 5.96 },
  { noteId: 'G4', sourceFile: 'Piano.mf.G4.aiff', url: sampleUrl('G4.mp3'), gain: 5.25 },
  { noteId: 'G#4', sourceFile: 'Piano.mf.Ab4.aiff', url: sampleUrl('Gs4.mp3'), gain: 4.17 },
  { noteId: 'A4', sourceFile: 'Piano.mf.A4.aiff', url: sampleUrl('A4.mp3'), gain: 5.37 },
  { noteId: 'A#4', sourceFile: 'Piano.mf.Bb4.aiff', url: sampleUrl('As4.mp3'), gain: 3.87 },
  { noteId: 'B4', sourceFile: 'Piano.mf.B4.aiff', url: sampleUrl('B4.mp3'), gain: 2.24 },
  { noteId: 'C5', sourceFile: 'Piano.mf.C5.aiff', url: sampleUrl('C5.mp3'), gain: 4.07 },
] as const

export function findPianoSample(noteId: PianoNoteId): PianoSampleDefinition | undefined {
  return PIANO_SAMPLE_DEFINITIONS.find((sample) => sample.noteId === noteId)
}
