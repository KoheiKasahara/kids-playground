import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { PianoAudioEngine } from '../shared/music/pianoAudio'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import type { RhythmMode } from './rhythmChart'
import { RHYTHM_SONGS, findRhythmSong, type RhythmSongDefinition } from './rhythmSongs'
import RhythmSession, { type RhythmResult } from './RhythmSession'
import SoundToggle from './SoundToggle'
import { playSelect } from './sounds'
import styles from './RhythmPlay.module.css'

const MODES: readonly { id: RhythmMode; label: string; caption: string; drums: number }[] = [
  { id: 'easy', label: 'ひとつ たいこ', caption: 'はじめての こに', drums: 1 },
  { id: 'normal', label: 'みっつ たいこ', caption: 'なれてきたら', drums: 3 },
]

/** 記録は「モード:曲ID」ごとに、いちばん よい★を残す。 */
function progressId(mode: RhythmMode, songId: string): string {
  return `${mode}:${songId}`
}

const progressStore = createStageProgressStore('rhythm-pon-progress', (id) => {
  const [mode, songId] = id.split(':')
  return MODES.some((item) => item.id === mode) && findRhythmSong(songId ?? '') !== undefined
})

export default function RhythmPlay() {
  const engineRef = useRef<PianoAudioEngine | null>(null)
  const [mode, setMode] = useState<RhythmMode>('easy')
  const [selected, setSelected] = useState<RhythmSongDefinition | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [sound, setSound] = useState(true)
  const [progress, setProgress] = useState(progressStore.read)
  const selectionHeading = useRef<HTMLHeadingElement>(null)
  const returning = useRef(false)
  useGameIntroPlaying(selected !== null)

  // メロディはピアノあそびと同じ録音音源で鳴らす。選曲中から先読みしておく。
  useEffect(() => {
    const engine = new PianoAudioEngine()
    engineRef.current = engine
    void engine.prepare()
    return () => {
      engine.dispose()
      if (engineRef.current === engine) engineRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!selected && returning.current) {
      selectionHeading.current?.focus({ preventScroll: true })
      returning.current = false
    }
  }, [selected])

  const onComplete = useCallback((result: RhythmResult) => {
    if (!selected) return
    setProgress(progressStore.record(progressId(mode, selected.id), result.stars))
  }, [mode, selected])

  function toggleSound() {
    if (!sound) {
      primeAudio()
      engineRef.current?.activate()
    }
    setSound(!sound)
  }

  function start(song: RhythmSongDefinition) {
    // 選曲のタップ（ユーザー操作）の中で音を起こしておくと、iOSでも最初の音から鳴る。
    if (sound) {
      primeAudio()
      engineRef.current?.activate()
      playSelect()
    }
    window.scrollTo(0, 0)
    setAttempt((value) => value + 1)
    setSelected(song)
  }

  function backToSelection() {
    returning.current = true
    setSelected(null)
  }

  if (selected) {
    return <RhythmSession key={attempt} song={selected} mode={mode} engine={engineRef} sound={sound} onToggleSound={toggleSound}
      onBack={backToSelection} onComplete={onComplete} onRetry={() => {
        if (sound) {
          primeAudio()
          engineRef.current?.activate()
        }
        setAttempt((value) => value + 1)
      }} />
  }

  return <main className={`${styles.page} ${styles.selection}`}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1 className={styles.playTitle}>リズム ぽんぽん</h1>
      <SoundToggle sound={sound} onToggle={toggleSound} />
    </header>
    <div className={styles.selectionBody}>
      <div className={styles.hero}>
        <div className={styles.heroDrum} aria-hidden="true">
          <span className={styles.heroNote}>♪</span>
          <span className={`${styles.heroNote} ${styles.heroNote2}`}>♫</span>
          <span className={styles.drumTop} />
        </div>
        <h2 ref={selectionHeading} tabIndex={-1}>どの きょくで あそぶ？</h2>
        <p>おんぷが きたら、たいこを ぽん！</p>
      </div>

      <div className={styles.modes} role="group" aria-label="たいこの かず">
        {MODES.map((item) => <button key={item.id} type="button" className={styles.modeButton} aria-pressed={mode === item.id}
          onClick={() => {
            if (sound) playSelect()
            setMode(item.id)
          }}>
          <span className={styles.modeDrums} aria-hidden="true">{Array.from({ length: item.drums }, (_, index) => <i key={index} />)}</span>
          <span className={styles.modeLabel}>{item.label}</span>
          <small>{item.caption}</small>
        </button>)}
      </div>

      <ul className={styles.songs}>
        {RHYTHM_SONGS.map((song, index) => <li key={song.id}>
          <button type="button" className={styles.songCard} aria-label={`${song.title}（${song.composer}）で あそぶ`}
            style={{ '--card-index': index, '--sky': song.theme.sky, '--glow': song.theme.glow } as CSSProperties}
            onClick={() => start(song)}>
            <span className={styles.record} aria-hidden="true"><span>{song.emoji}</span></span>
            <span className={styles.songText}>
              <span className={styles.songTitle}>{song.title}</span>
              <span className={styles.composer}>{song.composer}</span>
              <span className={styles.level} aria-hidden="true">{'♪'.repeat(song.level)}<i>{'♪'.repeat(3 - song.level)}</i></span>
            </span>
            <StageClearBadge stars={progress[progressId(mode, song.id)] ?? 0} corner />
          </button>
        </li>)}
      </ul>
    </div>
  </main>
}
