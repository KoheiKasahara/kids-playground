import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react'
import { BLACK_NOTES, WHITE_NOTES, type PianoNote } from './notes'
import styles from './PianoPlay.module.css'

type PianoKeyboardProps = {
  activeNoteIds: ReadonlySet<string>
  onPointerStart: (note: PianoNote, pointerId: number) => void
  onPointerEnd: (pointerId: number) => void
  onKeyboardPlay: (note: PianoNote) => void
}

function accessibleName(note: PianoNote): string {
  const sharpName = note.pitchClass.replace('#', ' シャープ')
  return note.label ? `${note.label} ${note.id}` : `${sharpName}${note.octave}`
}

export default function PianoKeyboard({
  activeNoteIds,
  onPointerStart,
  onPointerEnd,
  onKeyboardPlay,
}: PianoKeyboardProps) {
  const pointerDown = (event: ReactPointerEvent<HTMLButtonElement>, note: PianoNote) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture?.(event.pointerId)
    onPointerStart(note, event.pointerId)
  }

  const pointerEnd = (event: ReactPointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    onPointerEnd(event.pointerId)
  }

  const renderKey = (note: PianoNote, black: boolean) => (
    <button
      key={note.id}
      type="button"
      className={[
        black ? styles.blackKey : styles.whiteKey,
        activeNoteIds.has(note.id) ? styles.keyActive : '',
      ].filter(Boolean).join(' ')}
      style={black ? ({ left: `${((note.whiteKeyIndex + 1) / WHITE_NOTES.length) * 100}%` } as CSSProperties) : undefined}
      aria-label={accessibleName(note)}
      aria-pressed={activeNoteIds.has(note.id)}
      data-note={note.id}
      onPointerDown={(event) => pointerDown(event, note)}
      onPointerUp={pointerEnd}
      onPointerCancel={pointerEnd}
      onLostPointerCapture={pointerEnd}
      onClick={(event) => {
        // 実ポインタのclickはpointerdownで発音済み。detail=0のキーボード操作だけ補完する。
        if (event.detail === 0) onKeyboardPlay(note)
      }}
    >
      {!black && (
        <span className={styles.noteLabel} aria-hidden="true">
          {note.label}
        </span>
      )}
    </button>
  )

  return (
    <div className={styles.keyboard} role="group" aria-label="ピアノのけんばん">
      <div className={styles.whiteKeys}>{WHITE_NOTES.map((note) => renderKey(note, false))}</div>
      <div className={styles.blackKeys}>{BLACK_NOTES.map((note) => renderKey(note, true))}</div>
    </div>
  )
}
