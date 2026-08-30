import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PianoKeyboard from './PianoKeyboard'
import { PianoAudioEngine, type PianoVoiceHandle } from './pianoAudio'
import type { PianoNote } from './notes'
import styles from './PianoPlay.module.css'

type ActivePointer = { noteId: string; voice: PianoVoiceHandle | null }

export default function PianoPlay() {
  const navigate = useNavigate()
  const engineRef = useRef<PianoAudioEngine | null>(null)
  if (engineRef.current === null) engineRef.current = new PianoAudioEngine()

  const activePointers = useRef(new Map<number, ActivePointer>())
  const feedbackTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const keyboardFeedbackCounts = useRef(new Map<string, number>())
  const [activeNoteIds, setActiveNoteIds] = useState<ReadonlySet<string>>(new Set())

  const syncActiveNotes = () => {
    const next = new Set(Array.from(activePointers.current.values(), (active) => active.noteId))
    for (const [noteId, count] of keyboardFeedbackCounts.current) {
      if (count > 0) next.add(noteId)
    }
    setActiveNoteIds(next)
  }

  const endPointer = (pointerId: number) => {
    const active = activePointers.current.get(pointerId)
    if (!active) return
    if (active.voice) engineRef.current?.stopNote(active.voice)
    activePointers.current.delete(pointerId)
    syncActiveNotes()
  }

  const startPointer = (note: PianoNote, pointerId: number) => {
    endPointer(pointerId)
    activePointers.current.set(pointerId, {
      noteId: note.id,
      voice: engineRef.current?.startNote(note) ?? null,
    })
    syncActiveNotes()
  }

  const playFromKeyboard = (note: PianoNote) => {
    engineRef.current?.playNote(note, 420)
    keyboardFeedbackCounts.current.set(note.id, (keyboardFeedbackCounts.current.get(note.id) ?? 0) + 1)
    syncActiveNotes()
    const timer = setTimeout(() => {
      feedbackTimers.current.delete(timer)
      const remaining = (keyboardFeedbackCounts.current.get(note.id) ?? 1) - 1
      if (remaining > 0) keyboardFeedbackCounts.current.set(note.id, remaining)
      else keyboardFeedbackCounts.current.delete(note.id)
      syncActiveNotes()
    }, 420)
    feedbackTimers.current.add(timer)
  }

  useEffect(() => {
    const engine = engineRef.current
    const pointers = activePointers.current
    const timers = feedbackTimers.current
    const feedbackCounts = keyboardFeedbackCounts.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      pointers.clear()
      feedbackCounts.clear()
      engine?.dispose()
    }
  }, [])

  return (
    <main className={styles.page}>
      <button type="button" className={styles.home} onClick={() => navigate('/')}>
        もどる
      </button>

      <header className={styles.header}>
        <h1 className={styles.title}>
          <span aria-hidden="true">🎹</span> ピアノであそぼう
        </h1>
        <p className={styles.instruction}>けんばんを おしてみよう！</p>
      </header>

      <section className={styles.pianoArea} aria-label="自由演奏">
        <div className={styles.pianoCase}>
          <div className={styles.brandDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <PianoKeyboard
            activeNoteIds={activeNoteIds}
            onPointerStart={startPointer}
            onPointerEnd={endPointer}
            onKeyboardPlay={playFromKeyboard}
          />
        </div>
      </section>
    </main>
  )
}
