export type PianoNoteId = string

export type PianoNote = {
  id: PianoNoteId
  pitchClass: string
  octave: number
  frequency: number
  isBlack: boolean
  /** 白鍵は自身の並び順、黒鍵は直前の白鍵の並び順。 */
  whiteKeyIndex: number
  label: string
}

const PITCHES = [
  { name: 'C', semitone: 0, label: 'ド' },
  { name: 'C#', semitone: 1, label: '' },
  { name: 'D', semitone: 2, label: 'レ' },
  { name: 'D#', semitone: 3, label: '' },
  { name: 'E', semitone: 4, label: 'ミ' },
  { name: 'F', semitone: 5, label: 'ファ' },
  { name: 'F#', semitone: 6, label: '' },
  { name: 'G', semitone: 7, label: 'ソ' },
  { name: 'G#', semitone: 8, label: '' },
  { name: 'A', semitone: 9, label: 'ラ' },
  { name: 'A#', semitone: 10, label: '' },
  { name: 'B', semitone: 11, label: 'シ' },
] as const

/** MIDI番号から平均律の周波数を求める（A4 = 440Hz）。 */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/**
 * 自由演奏と曲データで共有するC4〜C5の鍵盤。曲データから `C4` のようなIDで参照できるよう、
 * 表示順・音程・見た目を同じ定義へ集約する。
 */
export const PIANO_NOTES: readonly PianoNote[] = (() => {
  let whiteKeyIndex = -1

  const pitchesByOctave = [
    { octave: 4, pitches: PITCHES },
    // C5は次のオクターブの白鍵として、他のノートと同じ定義・発音経路に載せる。
    { octave: 5, pitches: PITCHES.slice(0, 1) },
  ] as const

  return pitchesByOctave.flatMap(({ octave, pitches }) => pitches.map((pitch) => {
    const isBlack = pitch.name.includes('#')
    if (!isBlack) whiteKeyIndex += 1

    return {
      id: `${pitch.name}${octave}` as PianoNoteId,
      pitchClass: pitch.name,
      octave,
      frequency: midiToFrequency(12 * (octave + 1) + pitch.semitone),
      isBlack,
      whiteKeyIndex,
      label: pitch.label,
    }
  }))
})()

export const WHITE_NOTES = PIANO_NOTES.filter((note) => !note.isBlack)
export const BLACK_NOTES = PIANO_NOTES.filter((note) => note.isBlack)

export function findPianoNote(id: PianoNoteId): PianoNote | undefined {
  return PIANO_NOTES.find((note) => note.id === id)
}
