import { getSharedAudioContext, getSoundOutput, isSoundEnabled } from '../../audio/sound'

// 音声ファイルを つかわず、Web Audio で むかしの ゲーム機 ふうの こうかおんを その場で つくる。
// メロディは このゲームの ための オリジナル。

const NOTE: Record<string, number> = { C: -9, 'C#': -8, D: -7, 'D#': -6, E: -5, F: -4, 'F#': -3, G: -2, 'G#': -1, A: 0, 'A#': 1, B: 2 }

/** 'C5' → 周波数。 */
export function freq(name: string) {
  const m = /^([A-G]#?)(\d)$/.exec(name)
  if (!m) return 0
  return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) - 4) * 12) / 12)
}

const pulseCache = new WeakMap<AudioContext, PeriodicWave>()
/** 25% の パルス波。 */
function pulseWave(ctx: AudioContext) {
  let wave = pulseCache.get(ctx)
  if (!wave) {
    const n = 32
    const real = new Float32Array(n), imag = new Float32Array(n)
    for (let k = 1; k < n; k++) imag[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * .25)
    wave = ctx.createPeriodicWave(real, imag)
    pulseCache.set(ctx, wave)
  }
  return wave
}

type Voice = 'pulse' | 'triangle' | 'sine' | 'square' | 'sawtooth'

function tone(ctx: AudioContext, f: number, start: number, dur: number, vol: number, voice: Voice) {
  if (!f) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(f, start)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .006)
  gain.gain.setValueAtTime(vol * .8, start + Math.max(.01, dur - .05))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(gain).connect(getSoundOutput(ctx))
  osc.start(start)
  osc.stop(start + dur + .02)
}

/** 音の 高さが すーっと かわる 音。 */
function slide(ctx: AudioContext, from: number, to: number, start: number, dur: number, vol: number, voice: Voice) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  osc.connect(gain).connect(getSoundOutput(ctx))
  osc.start(start)
  osc.stop(start + dur + .02)
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
function noise(ctx: AudioContext, start: number, dur: number, vol: number, filter: BiquadFilterType, hz: number, toHz?: number) {
  let buffer = noiseCache.get(ctx)
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * .6), ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
    noiseCache.set(ctx, buffer)
  }
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.frequency.setValueAtTime(hz, start)
  if (toHz) f.frequency.exponentialRampToValueAtTime(toHz, start + dur)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  src.connect(f).connect(gain).connect(getSoundOutput(ctx))
  src.start(start)
  src.stop(start + dur + .02)
}

function sfx() {
  if (!isSoundEnabled()) return undefined
  return getSharedAudioContext()
}

/** ボタンの「ピッ」。 */
export function playSelect() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  tone(ctx, freq('A5'), t, .05, .06, 'pulse')
  tone(ctx, freq('E6'), t + .05, .07, .06, 'pulse')
}

/** むしを えらんだ ときの「ジジッ」（はねを ふるわせる おと）。voice は むしごとの たかさ。 */
export function playBuzz(voice: number) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (let i = 0; i < 2; i++) {
    const s = t + i * .11
    const osc = ctx.createOscillator()
    const lfo = ctx.createOscillator()
    const depth = ctx.createGain()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(voice, s)
    lfo.frequency.value = 42
    depth.gain.value = voice * .25
    lfo.connect(depth).connect(osc.frequency)
    gain.gain.setValueAtTime(0, s)
    gain.gain.linearRampToValueAtTime(.08, s + .01)
    gain.gain.exponentialRampToValueAtTime(.001, s + .09)
    osc.connect(gain).connect(getSoundOutput(ctx))
    osc.start(s); lfo.start(s)
    osc.stop(s + .1); lfo.stop(s + .1)
  }
}

/** けってい（ステージ・あいて）。 */
export function playDecide() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  ;['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(ctx, freq(n), t + i * .06, .1, .07, 'pulse'))
}

/** はっけよい（たいこ ドン・ドン）。 */
export function playReady() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  for (const at of [0, .32]) {
    slide(ctx, 150, 52, t + at, .32, .5, 'sine')
    noise(ctx, t + at, .08, .18, 'lowpass', 900)
  }
}

/** のこった！（ひょうしぎ カーン と かけごえ ふうの のぼる おと）。 */
export function playGo() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  noise(ctx, t, .05, .3, 'bandpass', 2600)
  tone(ctx, 1320, t, .08, .14, 'square')
  tone(ctx, 1760, t + .1, .14, .12, 'square')
  slide(ctx, 300, 900, t + .05, .25, .1, 'pulse')
}

/** ツノ・あごが ぶつかる「ガシッ」。 */
export function playClash() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  noise(ctx, t, .07, .4, 'highpass', 2200)
  tone(ctx, 1900, t, .04, .1, 'square')
  slide(ctx, 520, 180, t, .1, .2, 'square')
}

/** わざの ためる おと。 */
export function playWindup(special = false) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, special ? 300 : 200, special ? 1400 : 700, t, .3, .1, 'pulse')
  if (special) tone(ctx, freq('E6'), t + .2, .12, .07, 'pulse')
}

/** わざが きまった「ドカッ」。big なら もっと はでに。 */
export function playHit(big: boolean) {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, big ? 220 : 180, 40, t, .28, .55, 'triangle')
  noise(ctx, t, big ? .25 : .16, .5, 'lowpass', big ? 2200 : 1500)
  noise(ctx, t + .03, .35, .2, 'bandpass', 900, 3000)
  if (big) tone(ctx, freq('C6'), t + .05, .1, .08, 'pulse')
}

/** ふんばった・よけた「ガッ」。 */
export function playBlock() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  noise(ctx, t, .06, .3, 'bandpass', 1400)
  tone(ctx, 330, t, .06, .12, 'square')
}

/** ちゃくち「ドサッ」。 */
export function playLand() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, 120, 45, t, .2, .4, 'sine')
  noise(ctx, t, .14, .25, 'lowpass', 700)
}

/** おちていく「ひゅ〜」。 */
export function playFall() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, 1200, 180, t, .8, .14, 'pulse')
  noise(ctx, t, .6, .12, 'bandpass', 3000, 600)
}

/** しがみついた「ぎゅっ」。 */
export function playCling() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  slide(ctx, 500, 900, t, .1, .1, 'square')
  slide(ctx, 900, 600, t + .1, .1, .1, 'square')
}

/** かった ときの ファンファーレ。 */
export function playWin() {
  const ctx = sfx()
  if (!ctx) return
  const step = .11
  const t = ctx.currentTime
  const melody: [string, number, number][] = [['G4', 0, 1], ['C5', 1, 1], ['E5', 2, 1], ['G5', 3, 2], ['E5', 5, 1], ['G5', 6, 4]]
  for (const [n, at, len] of melody) tone(ctx, freq(n), t + at * step, len * step, .1, 'pulse')
  for (const [n, at, len] of [['C4', 0, 3], ['G3', 3, 3], ['C4', 6, 4]] as [string, number, number][]) tone(ctx, freq(n), t + at * step, len * step, .14, 'triangle')
}

/** まけた ときの ざんねんな おと。 */
export function playLose() {
  const ctx = sfx()
  if (!ctx) return
  const step = .16
  const t = ctx.currentTime
  for (const [n, at, len] of [['E5', 0, 1], ['D#5', 1, 1], ['D5', 2, 1], ['C#5', 3, 3]] as [string, number, number][]) tone(ctx, freq(n), t + at * step, len * step, .08, 'pulse')
}
