import type { PianoVoiceHandle } from './pianoAudio'
import type { PianoSong } from './pianoSongs'
import { findPianoNote } from './notes'

type PianoNotePlayer = {
  activate(): void
  playNote(note: NonNullable<ReturnType<typeof findPianoNote>>, durationMs: number): PianoVoiceHandle | null
  stopNote(handle: PianoVoiceHandle): void
}

type PianoSongPlayerCallbacks = {
  onNoteStart(noteId: string): void
  onNoteEnd(noteId: string): void
  onClearHighlights(): void
  onComplete(): void
}

/**
 * 曲データの絶対開始時刻を基準にした、小さな自動演奏スケジューラ。
 * 各予約をsetTimeoutで個別に管理するため、停止・曲切り替え・unmount時に残さず取消できる。
 */
export class PianoSongPlayer {
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private readonly activeVoices = new Map<number, PianoVoiceHandle>()
  private generation = 0
  private playing = false

  constructor(
    private readonly engine: PianoNotePlayer,
    private readonly callbacks: PianoSongPlayerCallbacks,
  ) {}

  get isPlaying(): boolean {
    return this.playing
  }

  play(song: PianoSong): void {
    this.stop()
    this.playing = true
    const generation = ++this.generation
    // 再生ボタンのユーザー操作中にAudioContextをresumeして、iOS/PWAでも後続タイマーの最初の音を鳴らせるようにする。
    this.engine.activate()
    const startAt = performance.now()

    for (const item of song.timeline) {
      if (item.kind !== 'note') continue
      this.scheduleAt(startAt + item.startMs, generation, () => {
        const note = findPianoNote(item.noteId)
        if (!note) return
        const handle = this.engine.playNote(note, item.durationMs)
        if (handle) this.activeVoices.set(handle.id, handle)
        this.callbacks.onNoteStart(item.noteId)
        this.scheduleAt(performance.now() + item.durationMs, generation, () => {
          this.callbacks.onNoteEnd(item.noteId)
        })
      })
    }

    // 最終音のハイライト終了を先に処理してから自然終了へ遷移する。
    this.scheduleAt(startAt + song.totalDurationMs + 1, generation, () => {
      this.playing = false
      this.activeVoices.clear()
      this.callbacks.onClearHighlights()
      this.callbacks.onComplete()
    })
  }

  stop(notify = true): void {
    this.generation += 1
    for (const timer of this.timers) clearTimeout(timer)
    this.timers.clear()
    for (const handle of this.activeVoices.values()) this.engine.stopNote(handle)
    this.activeVoices.clear()
    const wasPlaying = this.playing
    this.playing = false
    if (notify && wasPlaying) this.callbacks.onClearHighlights()
  }

  dispose(): void {
    this.stop(false)
  }

  private scheduleAt(targetTime: number, generation: number, callback: () => void): void {
    const run = () => {
      this.timers.delete(timer)
      if (this.generation !== generation) return
      callback()
    }
    const timer = setTimeout(run, Math.max(0, targetTime - performance.now()))
    this.timers.add(timer)
  }
}
