import { afterEach, describe, expect, test, vi } from 'vitest'
import type { PianoVoiceHandle } from './pianoAudio'
import { PianoSongPlayer } from './pianoSongPlayer'
import type { PianoSong } from './pianoSongs'

const TEST_SONG: PianoSong = {
  id: 'test-song',
  title: 'テスト曲',
  tempoBpm: 120,
  timeline: [
    { kind: 'note', noteId: 'C4', startMs: 0, durationMs: 100 },
    { kind: 'rest', startMs: 100, durationMs: 50 },
    { kind: 'note', noteId: 'C4', startMs: 150, durationMs: 100 },
  ],
  totalDurationMs: 250,
}

describe('PianoSongPlayer', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  test('絶対時刻の予約で再生し、同じ音のハイライトを個別に終了する', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    let voiceId = 0
    const engine = {
      activate: vi.fn(),
      playNote: vi.fn(() => ({ id: ++voiceId }) satisfies PianoVoiceHandle),
      stopNote: vi.fn(),
    }
    const callbacks = {
      onNoteStart: vi.fn(),
      onNoteEnd: vi.fn(),
      onClearHighlights: vi.fn(),
      onComplete: vi.fn(),
    }
    const player = new PianoSongPlayer(engine, callbacks)

    player.play(TEST_SONG)
    expect(engine.activate).toHaveBeenCalledTimes(1)
    actTimers(0)
    expect(engine.playNote).toHaveBeenCalledTimes(1)
    expect(callbacks.onNoteStart).toHaveBeenLastCalledWith('C4')

    actTimers(100)
    expect(callbacks.onNoteEnd).toHaveBeenCalledTimes(1)
    actTimers(50)
    expect(engine.playNote).toHaveBeenCalledTimes(2)
    actTimers(101)
    expect(callbacks.onNoteEnd).toHaveBeenCalledTimes(2)
    expect(callbacks.onComplete).toHaveBeenCalledTimes(1)
    expect(player.isPlaying).toBe(false)
  })

  test('停止・再生し直し・disposeで旧予約と旧voiceを残さない', () => {
    vi.useFakeTimers()
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    let voiceId = 0
    const engine = {
      activate: vi.fn(),
      playNote: vi.fn(() => ({ id: ++voiceId }) satisfies PianoVoiceHandle),
      stopNote: vi.fn(),
    }
    const callbacks = {
      onNoteStart: vi.fn(),
      onNoteEnd: vi.fn(),
      onClearHighlights: vi.fn(),
      onComplete: vi.fn(),
    }
    const player = new PianoSongPlayer(engine, callbacks)

    player.play(TEST_SONG)
    actTimers(0)
    player.stop()
    expect(engine.stopNote).toHaveBeenCalledTimes(1)
    expect(callbacks.onClearHighlights).toHaveBeenCalledTimes(1)
    actTimers(1_000)
    expect(engine.playNote).toHaveBeenCalledTimes(1)
    expect(callbacks.onComplete).not.toHaveBeenCalled()

    player.play(TEST_SONG)
    actTimers(0)
    player.play(TEST_SONG)
    actTimers(0)
    expect(engine.stopNote).toHaveBeenCalledTimes(2)
    expect(engine.playNote).toHaveBeenCalledTimes(3)
    player.dispose()
    actTimers(1_000)
    expect(engine.playNote).toHaveBeenCalledTimes(3)
  })
})

function actTimers(milliseconds: number): void {
  vi.advanceTimersByTime(milliseconds)
}
