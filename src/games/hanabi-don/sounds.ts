import { getSharedAudioContext, getSoundOutput, isSoundEnabled, playNoiseBurst } from '../../audio/sound'

/**
 * どーん！はなび の こうかおん と BGM。すべて 共有AudioContext で その場で つくる（音源ファイルなし）。
 */

type Voice = { type: OscillatorType; f: number; f2?: number; dur: number; vol: number; attack?: number; at?: number; dest?: AudioNode }

function ctx(): AudioContext | undefined {
  if (!isSoundEnabled()) return undefined
  try {
    return getSharedAudioContext()
  } catch {
    return undefined
  }
}

function voice(c: AudioContext, v: Voice) {
  const t = Math.max(c.currentTime, v.at ?? c.currentTime)
  const o = c.createOscillator()
  const gn = c.createGain()
  o.type = v.type
  o.frequency.setValueAtTime(v.f, t)
  if (v.f2) o.frequency.exponentialRampToValueAtTime(v.f2, t + v.dur)
  gn.gain.setValueAtTime(0.0001, t)
  gn.gain.exponentialRampToValueAtTime(v.vol, t + (v.attack ?? 0.005))
  gn.gain.exponentialRampToValueAtTime(0.0001, t + v.dur)
  o.connect(gn)
  gn.connect(v.dest ?? getSoundOutput(c))
  o.start(t)
  o.stop(t + v.dur + 0.03)
}

/** 音が出せなくても あそびは つづくので、失敗は のみこむ。 */
function safely(play: (c: AudioContext) => void) {
  const c = ctx()
  if (!c) return
  try {
    play(c)
  } catch {
    /* はなびは 画面で みえる。 */
  }
}

// ペンタトニック（ドレミソラ）。ほしを つづけて ともすほど たかくなる。
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]
const hz = (semi: number, base = 523.25) => base * 2 ** (semi / 12)

/** はなびが のぼる「ひゅ〜」。 */
export function playLaunch() {
  safely((c) => {
    const now = c.currentTime
    voice(c, { type: 'sine', f: 420, f2: 1500, dur: 0.46, vol: 0.2, attack: 0.05 })
    voice(c, { type: 'triangle', f: 430, f2: 1540, dur: 0.44, vol: 0.06, attack: 0.05, at: now + 0.01 })
    playNoiseBurst(c, now, 0.1, 0.1, 'bandpass', 1800)
  })
}

/** はなびが ひらく「どーん」と「ぱらぱら」。ほしを ともすと はでになる。 */
export function playBurst(caught = 0) {
  safely((c) => {
    const now = c.currentTime
    const power = Math.min(1, 0.6 + caught * 0.2)
    voice(c, { type: 'sine', f: 190, f2: 46, dur: 0.5, vol: 0.5 * power })
    voice(c, { type: 'triangle', f: 120, f2: 40, dur: 0.32, vol: 0.28 * power })
    playNoiseBurst(c, now, 0.4, 0.34 * power, 'lowpass', 900)
    // ぱらぱら と ちる ひばな。
    for (let i = 0; i < 6; i++) playNoiseBurst(c, now + 0.12 + i * 0.07, 0.05, 0.07 * power, 'highpass', 5200)
  })
}

/** ほしに あかりが ついた「きらりん」。lit は いままでに ともした かず。 */
export function playStarLit(lit: number, caught = 1) {
  safely((c) => {
    const now = c.currentTime
    for (let i = 0; i < caught; i++) {
      const note = PENTA[Math.min(Math.max(lit - caught + i, 0), PENTA.length - 1)]!
      const at = now + 0.1 + i * 0.09
      voice(c, { type: 'triangle', f: hz(note, 1046.5), dur: 0.4, vol: 0.2, at })
      voice(c, { type: 'sine', f: hz(note + 12, 1046.5), dur: 0.22, vol: 0.07, at })
    }
  })
}

/** ぜんぶ ともした ファンファーレ。 */
export function playClear() {
  safely((c) => {
    const now = c.currentTime
    ;[0, 4, 7, 12, 16].forEach((s, i) => {
      voice(c, { type: 'triangle', f: hz(s, 783.99), dur: i === 4 ? 0.7 : 0.26, vol: 0.24, at: now + i * 0.13 })
      voice(c, { type: 'sine', f: hz(s - 12, 783.99), dur: 0.3, vol: 0.12, at: now + i * 0.13 })
    })
    for (let i = 0; i < 8; i++) playNoiseBurst(c, now + 0.6 + i * 0.06, 0.05, 0.06, 'highpass', 6000)
  })
}

/** えらぶ・もどる の「ぽん」。 */
export function playSelect() {
  safely((c) => {
    voice(c, { type: 'triangle', f: 660, f2: 990, dur: 0.12, vol: 0.2 })
  })
}

// ---------------- BGM（なつの よるの ゆったりした うた） ----------------

/** すうじは C から なんはんおん うえか、`-` は のばす、`.` は やすみ（1つ = 8ぶおんぷ）。 */
const MELODY = (
  '4 - 7 - 9 - 7 - | 4 - 2 - 0 - - - | 2 - 4 - 7 - 4 - | 2 - - - . . . . | '
  + '9 - 12 - 9 - 7 - | 4 - 7 - 9 - - - | 7 - 4 - 2 - 4 - | 0 - - - . . . .'
).split(/\s+/).filter((s) => s !== '|')
/** 1しょうせつ ごとの わおんの ねもと（C から なんはんおん）。 */
const CHORDS = [0, -3, 5, 7, -3, 0, 5, 0]
const BPM = 92

function bgmNote(c: AudioContext, dest: AudioNode, type: OscillatorType, f: number, at: number, dur: number, vol: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, at)
  g.gain.setValueAtTime(0.0001, at)
  g.gain.exponentialRampToValueAtTime(vol, at + 0.03)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(dest)
  o.start(at)
  o.stop(at + dur + 0.03)
}

/** あそんでいる あいだの BGM を ながす。とめる かんすうを かえす。 */
export function startBgm(): () => void {
  const c = ctx()
  if (!c) return () => {}
  let master: GainNode
  try {
    master = c.createGain()
    master.gain.value = 0.3
    master.connect(getSoundOutput(c))
  } catch {
    return () => {}
  }
  const step = 60 / BPM / 2
  let index = 0
  let next = c.currentTime + 0.15
  const schedule = () => {
    try {
      while (next < c.currentTime + 0.3) {
        const i = index % MELODY.length
        const s = MELODY[i]!
        if (s !== '-' && s !== '.') {
          let len = 1
          while (MELODY[(i + len) % MELODY.length] === '-' && len < 8) len++
          // すずしい ねいろの メロディ（ふうりん みたいに うえの おとを そえる）。
          bgmNote(c, master, 'sine', hz(Number(s), 523.25), next, len * step * 1.1, 0.11)
          bgmNote(c, master, 'sine', hz(Number(s) + 12, 523.25), next, step * 0.9, 0.025)
        }
        const beat = i % 8
        const root = CHORDS[Math.floor(i / 8)]!
        // ひくい おとが ゆっくり ささえ、まんなかで わおんが ぽろんと なる。
        if (beat === 0) bgmNote(c, master, 'triangle', hz(root, 130.81), next, step * 7, 0.09)
        if (beat === 2 || beat === 6) bgmNote(c, master, 'triangle', hz(root + 7, 261.63), next, step * 1.6, 0.04)
        if (beat === 4) bgmNote(c, master, 'triangle', hz(root + 4, 261.63), next, step * 1.6, 0.04)
        index++
        next += step
      }
    } catch {
      /* BGM が とぎれても あそびは つづく。 */
    }
  }
  schedule()
  const timer = setInterval(schedule, 80)
  return () => {
    clearInterval(timer)
    try {
      const t = c.currentTime
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(0, t + 0.25)
      setTimeout(() => { try { master.disconnect() } catch { /* もう きれている */ } }, 350)
    } catch {
      /* とめられなくても あそびは つづく。 */
    }
  }
}
