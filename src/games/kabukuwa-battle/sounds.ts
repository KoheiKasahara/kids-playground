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

function tone(ctx: AudioContext, f: number, start: number, dur: number, vol: number, voice: Voice, dest: AudioNode = getSoundOutput(ctx)) {
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
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

/** 音の 高さが すーっと かわる 音。 */
function slide(ctx: AudioContext, from: number, to: number, start: number, dur: number, vol: number, voice: Voice, dest: AudioNode = getSoundOutput(ctx)) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  if (voice === 'pulse') osc.setPeriodicWave(pulseWave(ctx))
  else osc.type = voice
  osc.frequency.setValueAtTime(from, start)
  osc.frequency.exponentialRampToValueAtTime(to, start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  osc.connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .02)
}

const noiseCache = new WeakMap<AudioContext, AudioBuffer>()
function noise(ctx: AudioContext, start: number, dur: number, vol: number, filter: BiquadFilterType, hz: number, toHz?: number, dest: AudioNode = getSoundOutput(ctx)) {
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
  src.connect(f).connect(gain).connect(dest)
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
    gain.gain.linearRampToValueAtTime(.16, s + .01)
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

/** きらきら ふるえながら きえていく たかい おと（「ピーーン」の ぶぶん）。 */
function ring(ctx: AudioContext, f: number, start: number, dur: number, vol: number) {
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  const shimmer = ctx.createGain()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(f, start)
  // ふるえ（トレモロ）で キラキラ させる。
  lfo.frequency.value = 17
  depth.gain.value = .45
  shimmer.gain.value = .55
  lfo.connect(depth).connect(shimmer.gain)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .008)
  gain.gain.exponentialRampToValueAtTime(.001, start + dur)
  osc.connect(shimmer).connect(gain).connect(getSoundOutput(ctx))
  osc.start(start); lfo.start(start)
  osc.stop(start + dur + .02); lfo.stop(start + dur + .02)
}

/** ぎゃくてんの カットイン「シュッ（スワイプ）… キュピーン！」。 */
export function playCutIn() {
  const ctx = sfx()
  if (!ctx) return
  const t = ctx.currentTime
  // シュッ（おびが ひだりから はいる）。
  noise(ctx, t, .2, .3, 'bandpass', 700, 5000)
  // キュ（いっきに かけあがる）。
  const kyu = t + .17
  slide(ctx, 900, 3400, kyu, .07, .09, 'square')
  slide(ctx, 1400, 4200, kyu + .02, .06, .05, 'pulse')
  // ピーーン（きらきら ひびいて きえる）。
  const pin = kyu + .07
  tone(ctx, freq('B6'), pin, .05, .08, 'pulse')
  ring(ctx, freq('E7'), pin, 1, .16)
  ring(ctx, freq('B6'), pin, .8, .1)
  ring(ctx, freq('E6'), pin, .6, .08)
  noise(ctx, pin, .3, .08, 'highpass', 7000)
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

// ---------------- BGM（スーファミ ふうの バトル きょく） ----------------

/** メロディ。すうじは A4 から なんはんおん うえか、`-` は のばす、`.` は やすみ（1つ = 8ぶおんぷ）。 */
const BGM_MELODY = (
  '12 - 7 - 12 14 15 - | 14 12 8 - 7 - 5 7 | 10 - 7 - 10 12 14 - | 7 - - - . 7 10 12 | '
  + '15 - 14 12 14 - 12 10 | 12 - 8 - 12 15 17 - | 19 - 17 15 14 - 10 14 | 11 - - - 14 - 11 -'
).split(/\s+/).filter(s => s !== '|')
/** 1しょうせつ ごとの コード（A から なんはんおん）。Am F G Em Am F G E */
const BGM_CHORDS: [number, number, number][] = [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2], [0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -1, 2]]
const BGM_BPM = 152
const semi = (base: number, n: number) => base * Math.pow(2, n / 12)

/** ビブラートの かかった ブラス ふうの リード（のこぎり波を すこし まるめる）。 */
function brass(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number) {
  const osc = ctx.createOscillator()
  const lfo = ctx.createOscillator()
  const depth = ctx.createGain()
  const lp = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(f, start)
  // ながい おとだけ あとから ゆらす。
  lfo.frequency.value = 5.5
  depth.gain.setValueAtTime(0, start)
  depth.gain.linearRampToValueAtTime(dur > .3 ? f * .012 : 0, start + Math.min(.25, dur))
  lfo.connect(depth).connect(osc.frequency)
  lp.type = 'lowpass'
  lp.frequency.setValueAtTime(900, start)
  lp.frequency.linearRampToValueAtTime(2600, start + .04)
  lp.frequency.linearRampToValueAtTime(1800, start + dur)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(vol, start + .015)
  gain.gain.setValueAtTime(vol * .85, start + Math.max(.02, dur - .04))
  gain.gain.linearRampToValueAtTime(0, start + dur)
  osc.connect(lp).connect(gain).connect(dest)
  osc.start(start); lfo.start(start)
  osc.stop(start + dur + .02); lfo.stop(start + dur + .02)
}

/** はじく ような シンセ ベース。 */
function bassNote(ctx: AudioContext, dest: AudioNode, f: number, start: number, dur: number, vol: number) {
  const osc = ctx.createOscillator()
  const lp = ctx.createBiquadFilter()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(f, start)
  lp.type = 'lowpass'
  lp.Q.value = 4
  lp.frequency.setValueAtTime(1400, start)
  lp.frequency.exponentialRampToValueAtTime(300, start + dur)
  gain.gain.setValueAtTime(vol, start)
  gain.gain.exponentialRampToValueAtTime(vol * .3, start + dur)
  gain.gain.linearRampToValueAtTime(0, start + dur + .01)
  osc.connect(lp).connect(gain).connect(dest)
  osc.start(start)
  osc.stop(start + dur + .03)
}

/** たたかい ちゅうの BGM を ながす。とめる かんすうを かえす。 */
export function startBgm(): () => void {
  const ctx = sfx()
  if (!ctx) return () => {}
  const out = getSoundOutput(ctx)
  const master = ctx.createGain()
  master.gain.value = .42
  master.connect(out)
  // スーファミ らしい ひびき（エコー）。
  const echo = ctx.createDelay(1)
  const echoTone = ctx.createBiquadFilter()
  const feedback = ctx.createGain()
  const echoOut = ctx.createGain()
  echo.delayTime.value = 60 / BGM_BPM * .75
  echoTone.type = 'lowpass'
  echoTone.frequency.value = 2400
  feedback.gain.value = .32
  echoOut.gain.value = .35
  master.connect(echo).connect(echoTone).connect(feedback).connect(echo)
  echoTone.connect(echoOut).connect(out)

  const step = 60 / BGM_BPM / 2
  const lead = 440, low = 110
  let index = 0
  let next = ctx.currentTime + .1
  const schedule = () => {
    while (next < ctx.currentTime + .25) {
      const i = index % BGM_MELODY.length
      const bar = Math.floor(i / 8), beat = i % 8
      const chord = BGM_CHORDS[bar]
      const s = BGM_MELODY[i]
      if (s !== '-' && s !== '.') {
        let len = 1
        while (BGM_MELODY[(i + len) % BGM_MELODY.length] === '-' && len < 8) len++
        brass(ctx, master, semi(lead, Number(s)), next, len * step * .92, .05)
        // 1オクターブ したで うすく かさねて あつみを だす。
        tone(ctx, semi(lead / 2, Number(s)), next, len * step * .9, .018, 'pulse', master)
      }
      // ベースは オクターブで かけまわる。
      bassNote(ctx, master, semi(low, chord[0] + (beat % 2 ? 12 : 0)), next, step * .8, .09)
      // うらで コードを きざむ。
      if (beat % 2 === 1) for (const n of chord) tone(ctx, semi(lead / 2, n + 12), next, step * .45, .012, 'square', master)
      // ドラム（キック・スネア・ハイハット）。さいごの しょうせつの おわりは フィルイン。
      const fill = bar === 7 && beat >= 6
      if (beat === 0 || beat === 3 || beat === 4) slide(ctx, 160, 45, next, .18, .28, 'sine', master)
      if (beat === 2 || beat === 6 || fill) {
        noise(ctx, next, .12, .14, 'bandpass', 1800, undefined, master)
        slide(ctx, 260, 160, next, .07, .07, 'triangle', master)
      }
      if (fill) noise(ctx, next + step / 2, .1, .12, 'bandpass', 1500, undefined, master)
      else noise(ctx, next, .03, beat % 2 ? .035 : .05, 'highpass', 7500, undefined, master)
      index++
      next += step
    }
  }
  schedule()
  const timer = setInterval(schedule, 60)
  return () => {
    clearInterval(timer)
    try {
      const t = ctx.currentTime
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + .25)
      // エコーが きえるのを まってから きりはなす。
      setTimeout(() => {
        try { master.disconnect(); feedback.disconnect(); echoOut.disconnect() } catch { /* もう きれている */ }
      }, 1500)
    } catch {
      // とめられなくても たたかいは つづく。
    }
  }
}
