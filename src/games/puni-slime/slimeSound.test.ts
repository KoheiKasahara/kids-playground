import { afterEach, describe, expect, it, vi } from 'vitest'
import { slimeNote } from './slimeSound'

/** Web Audio を持たない環境でも読み込める最小のモック。鳴らす中身だけを覗く。 */
class MockOscillator {
  type = 'sine'
  frequency = { value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  connect = vi.fn(); start = vi.fn(); stop = vi.fn()
}
class MockGain {
  gain = { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}
let oscillators: MockOscillator[] = []
class MockAudioContext {
  currentTime = 0
  state = 'running' as const
  resume = vi.fn()
  destination = {}
  createOscillator = vi.fn(() => { const node = new MockOscillator(); oscillators.push(node); return node })
  createGain = vi.fn(() => new MockGain())
}
async function withAudio(run: (play: typeof import('./slimeSound').playSlimeSound) => void) {
  oscillators = []
  vi.stubGlobal('window', { AudioContext: MockAudioContext })
  vi.resetModules()
  const { playSlimeSound } = await import('./slimeSound')
  run(playSlimeSound)
}
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

describe('slimeSound', () => {
  it('とろ〜りは低く長く垂れ下がる音、ぷるぷるは高く短く弾む音になる', () => {
    const soft = slimeNote('release', 'soft'), bouncy = slimeNote('release', 'bouncy')
    expect(soft.from).toBeLessThan(bouncy.from)
    expect(soft.duration).toBeGreaterThan(bouncy.duration)
    expect(soft.to).toBeLessThan(soft.from)
    expect(bouncy.to).toBeGreaterThan(bouncy.from)
  })
  it('動作ごとに高さと長さが変わり、どれも聞こえる範囲に収まる', () => {
    const cues = ['grab', 'release', 'poke', 'squish', 'drop', 'fit'] as const
    for (const feel of ['soft', 'bouncy'] as const) {
      const notes = cues.map((cue) => slimeNote(cue, feel))
      expect(new Set(notes.map((note) => note.from)).size).toBe(cues.length)
      for (const note of notes) {
        expect(note.from).toBeGreaterThan(40)
        expect(note.to).toBeGreaterThan(40)
        expect(note.duration).toBeGreaterThan(0)
        expect(note.volume).toBeGreaterThan(0)
        expect(note.volume).toBeLessThan(0.2)
      }
      expect(notes[3].from).toBeLessThan(notes[2].from)
    }
  })
  it('音を切っていると AudioContext にも触れない', async () => {
    await withAudio((play) => {
      play('grab', 'soft', false)
      expect(oscillators).toHaveLength(0)
      play('grab', 'soft')
      expect(oscillators).toHaveLength(1)
    })
  })
  it('鳴らすときは高さを滑らせて1音だけ出す', async () => {
    await withAudio((play) => {
      play('squish', 'bouncy')
      expect(oscillators).toHaveLength(1)
      const note = slimeNote('squish', 'bouncy')
      expect(oscillators[0].type).toBe(note.wave)
      expect(oscillators[0].frequency.linearRampToValueAtTime).toHaveBeenCalledWith(note.to, note.duration)
      expect(oscillators[0].start).toHaveBeenCalledTimes(1)
      expect(oscillators[0].stop).toHaveBeenCalledWith(note.duration)
    })
  })
  it('Web Audio が無い環境では黙って何もしない', async () => {
    vi.stubGlobal('window', {})
    vi.resetModules()
    const { playSlimeSound } = await import('./slimeSound')
    expect(() => playSlimeSound('poke', 'soft')).not.toThrow()
  })
})
