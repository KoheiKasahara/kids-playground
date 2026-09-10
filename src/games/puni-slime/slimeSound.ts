/**
 * スライムの手ざわりの音。質感ごとの「地の音」(FeelParams.voice) を、動作ごとの高さ・長さへ変換する。
 * とろ〜りは低くて間延びし下がる音、ぷるぷるは高くて短く弾む音になる。
 * 音源ファイルを持たず Web Audio だけで鳴らすので、オフラインでも鳴り、非対応環境では黙る。
 */
import { createToneNodes, getSharedAudioContext, isSoundEnabled } from '../../audio/sound'
import { FEELS, type Feel } from './slimeSimulation'

export type SlimeCue = 'grab' | 'release' | 'poke' | 'squish' | 'drop' | 'fit'
export type SlimeNote = { from: number; to: number; duration: number; volume: number; wave: OscillatorType }
/** 動作ごとの音の高さ倍率と長さ倍率。質感の地の音に掛けて使う。 */
const CUES: Record<SlimeCue, { pitch: number; length: number; volume: number }> = {
  grab: { pitch: 1, length: 0.7, volume: 0.8 },
  release: { pitch: 1.2, length: 1, volume: 1 },
  poke: { pitch: 1.5, length: 0.5, volume: 0.7 },
  squish: { pitch: 0.75, length: 1.2, volume: 1 },
  drop: { pitch: 0.6, length: 1.4, volume: 1 },
  fit: { pitch: 1.8, length: 1.1, volume: 0.9 },
}
/** 鳴らす音の中身を決めるだけの純粋関数。Web Audioに触れないのでそのままテストできる。 */
export function slimeNote(cue: SlimeCue, feel: Feel): SlimeNote {
  const voice = FEELS[feel].voice
  const shape = CUES[cue]
  const from = voice.base * shape.pitch
  return {
    from,
    to: Math.max(40, from * (1 + voice.glide)),
    duration: voice.length * shape.length,
    volume: voice.volume * shape.volume,
    wave: voice.wave,
  }
}
export function playSlimeSound(cue: SlimeCue, feel: Feel, enabled = true): void {
  if (!enabled || !isSoundEnabled()) return
  const ctx = getSharedAudioContext()
  if (!ctx) return
  const note = slimeNote(cue, feel)
  const start = ctx.currentTime
  const { oscillator } = createToneNodes(ctx, note.from, start, note.duration, note.volume, note.wave)
  // 高さを滑らせて、とろ〜りは垂れ下がる音に、ぷるぷるは弾み上がる音にする。
  oscillator.frequency.setValueAtTime(note.from, start)
  oscillator.frequency.linearRampToValueAtTime(note.to, start + note.duration)
  oscillator.start(start)
  oscillator.stop(start + note.duration)
}
