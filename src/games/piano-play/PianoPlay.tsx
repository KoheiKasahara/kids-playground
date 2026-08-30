import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PianoKeyboard from './PianoKeyboard'
import { PianoAudioEngine, type PianoVoiceHandle } from './pianoAudio'
import type { PianoNote } from './notes'
import { PIANO_SONGS, findPianoSong } from './pianoSongs'
import { PianoSongPlayer } from './pianoSongPlayer'
import { INSTRUMENT_SPECS, type InstrumentId } from './pianoSamples'
import styles from './PianoPlay.module.css'

type ActivePointer = { noteId: string; voice: PianoVoiceHandle | null }
type PlaybackState = 'idle' | 'playing' | 'stopped' | 'finished'

const MOBILE_PORTRAIT_QUERY = '(max-width: 767px) and (pointer: coarse) and (orientation: portrait)'

function isMobilePortrait(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(MOBILE_PORTRAIT_QUERY).matches === true
}

export default function PianoPlay() {
  const navigate = useNavigate()
  const engineRef = useRef<PianoAudioEngine | null>(null)
  if (engineRef.current === null) engineRef.current = new PianoAudioEngine()

  const activePointers = useRef(new Map<number, ActivePointer>())
  const feedbackTimers = useRef(new Set<ReturnType<typeof setTimeout>>())
  const keyboardFeedbackCounts = useRef(new Map<string, number>())
  const automaticFeedbackCounts = useRef(new Map<string, number>())
  const songPlayerRef = useRef<PianoSongPlayer | null>(null)
  const [activeNoteIds, setActiveNoteIds] = useState<ReadonlySet<string>>(new Set())
  const [portraitMobile, setPortraitMobile] = useState(isMobilePortrait)
  const [selectedSongId, setSelectedSongId] = useState(PIANO_SONGS[0].id)
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle')
  const [selectedInstrument, setSelectedInstrument] = useState<InstrumentId>('piano')
  const [instrumentLoadState, setInstrumentLoadState] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle')

  const syncActiveNotes = useCallback(() => {
    const next = new Set(Array.from(activePointers.current.values(), (active) => active.noteId))
    for (const [noteId, count] of keyboardFeedbackCounts.current) {
      if (count > 0) next.add(noteId)
    }
    for (const [noteId, count] of automaticFeedbackCounts.current) {
      if (count > 0) next.add(noteId)
    }
    setActiveNoteIds(next)
  }, [])

  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return undefined
    const player = new PianoSongPlayer(engine, {
      onNoteStart: (noteId) => {
        automaticFeedbackCounts.current.set(noteId, (automaticFeedbackCounts.current.get(noteId) ?? 0) + 1)
        syncActiveNotes()
      },
      onNoteEnd: (noteId) => {
        const remaining = (automaticFeedbackCounts.current.get(noteId) ?? 1) - 1
        if (remaining > 0) automaticFeedbackCounts.current.set(noteId, remaining)
        else automaticFeedbackCounts.current.delete(noteId)
        syncActiveNotes()
      },
      onClearHighlights: () => {
        automaticFeedbackCounts.current.clear()
        syncActiveNotes()
      },
      onComplete: () => setPlaybackState('finished'),
    })
    songPlayerRef.current = player
    return () => {
      player.dispose()
      if (songPlayerRef.current === player) songPlayerRef.current = null
    }
  }, [syncActiveNotes])

  const endPointer = useCallback((pointerId: number) => {
    const active = activePointers.current.get(pointerId)
    if (!active) return
    if (active.voice) engineRef.current?.stopNote(active.voice)
    activePointers.current.delete(pointerId)
    syncActiveNotes()
  }, [syncActiveNotes])

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

  const clearActiveState = useCallback(() => {
    songPlayerRef.current?.stop()
    setPlaybackState('stopped')
    for (const active of activePointers.current.values()) {
      if (active.voice) engineRef.current?.stopNote(active.voice)
    }
    activePointers.current.clear()
    for (const timer of feedbackTimers.current) clearTimeout(timer)
    feedbackTimers.current.clear()
    keyboardFeedbackCounts.current.clear()
    automaticFeedbackCounts.current.clear()
    setActiveNoteIds(new Set())
  }, [])

  const startSelectedSong = () => {
    const song = findPianoSong(selectedSongId)
    if (!song) return
    songPlayerRef.current?.play(song)
    setPlaybackState('playing')
  }

  const stopSong = () => {
    songPlayerRef.current?.stop()
    setPlaybackState('stopped')
  }

  const selectInstrument = (instrumentId: InstrumentId) => {
    const engine = engineRef.current
    if (!engine) return
    // setInstrumentは現在のvoiceや自動演奏の予約を止めず、次の発音からだけ切り替える。
    setSelectedInstrument(instrumentId)
    setInstrumentLoadState('loading')
    void engine.setInstrument(instrumentId).then(() => {
      if (engine.getInstrument() === instrumentId) setInstrumentLoadState(engine.getSampleLoadState(instrumentId))
    })
  }

  const selectSong = (songId: string) => {
    songPlayerRef.current?.stop()
    setSelectedSongId(songId)
    setPlaybackState('stopped')
  }

  useEffect(() => {
    const engine = engineRef.current
    const pointers = activePointers.current
    const timers = feedbackTimers.current
    const feedbackCounts = keyboardFeedbackCounts.current
    const autoFeedbackCounts = automaticFeedbackCounts.current
    return () => {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      pointers.clear()
      feedbackCounts.clear()
      autoFeedbackCounts.clear()
      engine?.dispose()
    }
  }, [])

  useEffect(() => {
    // 画面に入った時点でピアノ13音を先読みする。失敗時・読込中もstartNote側の短い合成音フォールバックで
    // 無反応にはせず、ロード完了後は同じAPIから録音サンプルへ自動で切り替わる。
    const engine = engineRef.current
    if (!engine) return
    setInstrumentLoadState('loading')
    void engine.prepare().then(() => {
      if (engine.getInstrument() === 'piano') setInstrumentLoadState(engine.getSampleLoadState('piano'))
    })
  }, [])

  useEffect(() => {
    const mediaQuery = window.matchMedia?.(MOBILE_PORTRAIT_QUERY)
    if (!mediaQuery) return undefined

    const updateOrientation = () => {
      const nextPortraitMobile = mediaQuery.matches
      setPortraitMobile(nextPortraitMobile)
      if (nextPortraitMobile) clearActiveState()
    }

    updateOrientation()
    mediaQuery.addEventListener('change', updateOrientation)
    return () => mediaQuery.removeEventListener('change', updateOrientation)
  }, [clearActiveState])

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.home} onClick={() => navigate('/')}>
          ← もどる
        </button>
        <h1 className={styles.title}>
          <span aria-hidden="true">🎹</span> ピアノであそぼう
        </h1>
      </header>

      {portraitMobile ? (
        <section className={styles.orientationGuide} aria-label="横向きであそぶ案内">
          <span className={styles.orientationIcon} aria-hidden="true">↻</span>
          <h1>よこにして<br />あそんでね</h1>
          <p>スマホを よこむきにすると<br />おおきな けんばんで あそべるよ</p>
        </section>
      ) : (
        <div className={styles.playLayout}>
          <section className={styles.songControls} aria-label="きょくをえらんで じどうえんそう">
            <div className={styles.instrumentPicker} role="group" aria-label="おとを えらぶ">
              <span className={styles.instrumentLabel}>おとを えらぶ</span>
              <div className={styles.instrumentButtons}>
                {INSTRUMENT_SPECS.map((instrument) => (
                  <button
                    key={instrument.id}
                    type="button"
                    className={`${styles.instrumentButton} ${selectedInstrument === instrument.id ? styles.instrumentButtonSelected : ''}`}
                    aria-label={instrument.label}
                    aria-pressed={selectedInstrument === instrument.id}
                    onClick={() => selectInstrument(instrument.id)}
                  >
                    <span className={styles.instrumentIcon} aria-hidden="true">{instrument.icon}</span>
                    <span>{instrument.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <label className={styles.songPicker}>
              <span>きょくを えらぶ</span>
              <select value={selectedSongId} onChange={(event) => selectSong(event.target.value)}>
                {PIANO_SONGS.map((song) => <option key={song.id} value={song.id}>{song.title}</option>)}
              </select>
            </label>
            {instrumentLoadState !== 'ready' && (
              <p className={styles.instrumentStatus} aria-live="polite">
                {instrumentLoadState === 'loading' ? 'おとの じゅんびちゅう…' : instrumentLoadState === 'failed' ? 'おとを きりかえられないため、かんたんな おとで ならします' : ''}
              </p>
            )}
            <button
              type="button"
              className={`${styles.playButton} ${playbackState === 'playing' ? styles.stopButton : ''}`}
              onClick={playbackState === 'playing' ? stopSong : startSelectedSong}
            >
              {playbackState === 'playing' ? '■ とめる' : '▶ さいせい'}
            </button>
            {(playbackState === 'playing' || playbackState === 'finished') && (
              <p className={styles.playbackStatus} role="status">
                {playbackState === 'playing' ? 'えんそうちゅう' : 'おわり'}
              </p>
            )}
          </section>
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
        </div>
      )}
    </main>
  )
}
