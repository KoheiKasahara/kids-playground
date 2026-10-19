// ピッチャー と バッターの からだの うごき。絵は かかずに、かくど や ながさ だけを きめる。
// かくどは がめんの むき（0 = みぎ、π/2 = した、-π/2 = うえ）。

const TAU = Math.PI * 2

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
export const smoothstep = (from: number, to: number, v: number) => {
  const t = clamp01((v - from) / (to - from))
  return t * t * (3 - 2 * t)
}
const easeOut = (t: number) => 1 - (1 - t) ** 3
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** うで 1ぽん。 */
export type Limb = {
  angle: number
  /** みえる ながさ（1 = ふつう。まえや うしろへ のばすと みじかく みえる）。 */
  reach: number
  /** からだの まえに かく（false は からだの うしろ）。 */
  front: boolean
}

export type PitcherPose = {
  /** なげる うで（がめんの みぎがわ）。 */
  throwing: Limb
  /** グローブの うで（がめんの ひだりがわ）。 */
  glove: Limb
  /** グローブがわの あしを あげる たかさ（0〜1）。 */
  kick: number
  /** からだの かたむき[rad]（プラスで みぎ＝なげる うでの ほうへ）。 */
  lean: number
  /** からだの のびちぢみ（プラスで のびる、マイナスで かがむ）。 */
  stretch: number
  /** よろこんで とびはねる たかさ[cm]。 */
  hop: number
  /** うでを ふった あとの すじ（from → to の かくど と こさ）。 */
  swoosh: { from: number; to: number; alpha: number } | null
  /** ボールを もっているか。 */
  holding: boolean
  /** うごきの ための じかん[s]。 */
  time: number
  /** ほのおを はく（ドラゴンの びゅーん ボール）。 */
  fire: number
  /** ピタッと とめている（ロボの ランプが ひかる）。 */
  stopped: boolean
}

// ボールを はなす しゅんかんを 0 と した じかん[s] ごとの かたち。
// [じかん, なげる うで, その ながさ, グローブの うで, その ながさ, あし, かたむき, のびちぢみ]
const IDLE_THROW = 1.2, IDLE_GLOVE = Math.PI - IDLE_THROW
const PITCH_KEYS: readonly (readonly number[])[] = [
  [-.9, IDLE_THROW, 1, IDLE_GLOVE, 1, 0, 0, 0],
  // りょうてを むねの まえで あわせて、あしを あげはじめる。
  [-.62, 2.7, .75, .35, .9, .35, .03, .03],
  // あしが いちばん たかい。ボールを もった てを したへ おろす。
  [-.4, 1.5, .85, .5, .9, 1, .1, .07],
  // うでを うしろへ ひいて、グローブで ねらう。
  [-.2, .15, .95, 3.4, .85, .9, .08, .04],
  // ふみこんで、うでを うえから ふる。
  [-.07, -1, .8, 3, .8, .2, -.05, 0],
  [0, -1.75, .62, 2.6, .75, 0, -.12, -.04],
  // てを かおに かぶせない よう、かたの ちかくを とおって むねの まえへ ふりおろす。
  [.06, -2.6, .32, 2.2, .72, 0, -.17, -.08],
  [.14, -3.6, .75, 1.7, .7, 0, -.2, -.11],
  // ふりおろして、まえに かがむ。
  [.26, -3.95, .95, 1.4, .7, 0, -.18, -.1],
  // もとの かまえに もどる（なげる うでは ひとまわり）。
  [.65, IDLE_THROW - TAU, 1, IDLE_GLOVE, 1, 0, 0, 0],
]

function sampleKeys(keys: readonly (readonly number[])[], at: number): number[] {
  if (at <= keys[0][0]) return keys[0].slice(1)
  const last = keys[keys.length - 1]
  if (at >= last[0]) return last.slice(1)
  let i = 0
  while (at > keys[i + 1][0]) i++
  const a = keys[i], b = keys[i + 1]
  const t = smoothstep(a[0], b[0], at)
  return a.slice(1).map((v, k) => lerp(v, b[k + 1], t))
}

/** なげる うでを からだの うしろに かくす じかん（うでを うしろへ ひいている あいだ）。 */
const THROW_BEHIND: [number, number] = [-.45, -.06]
/** グローブを からだの まえに だす じかん。 */
const GLOVE_FRONT: [number, number] = [-.75, .45]
/** ふった あとの すじを だす じかん。 */
const SWOOSH: [number, number] = [-.18, .2]

/**
 * ピッチャーの かたち。since は ボールを はなしてからの じかん[s]（まえは マイナス、null は かまえたまま）。
 * cheer は ストライクを とって よろこびはじめてからの じかん[s]。
 */
export function pitcherMotion(since: number | null, cheer: number | null = null): Pick<PitcherPose, 'throwing' | 'glove' | 'kick' | 'lean' | 'stretch' | 'hop' | 'swoosh'> {
  if (cheer !== null) return cheerMotion(cheer)
  const s = since ?? -9
  const [throwAngle, throwReach, gloveAngle, gloveReach, kick, lean, stretch] = sampleKeys(PITCH_KEYS, s)
  let swoosh: PitcherPose['swoosh'] = null
  if (s > SWOOSH[0] && s < SWOOSH[1]) {
    const from = sampleKeys(PITCH_KEYS, s - .1)[0]
    const alpha = 1 - Math.abs(s + .02) / .18
    if (alpha > 0 && from - throwAngle > .2) swoosh = { from, to: throwAngle, alpha }
  }
  return {
    throwing: { angle: throwAngle, reach: throwReach, front: !(s > THROW_BEHIND[0] && s < THROW_BEHIND[1]) },
    glove: { angle: gloveAngle, reach: gloveReach, front: s > GLOVE_FRONT[0] && s < GLOVE_FRONT[1] },
    kick, lean, stretch, hop: 0, swoosh,
  }
}

/** ストライクを とった ときに りょうてを あげて ぴょんぴょん とぶ。 */
function cheerMotion(c: number) {
  const up = smoothstep(0, .18, c) * (1 - smoothstep(1.05, 1.4, c))
  const hop = c < 1.1 ? Math.abs(Math.sin(c * Math.PI * 2.6)) * 22 * (1 - c / 1.1) : 0
  return {
    throwing: { angle: lerp(IDLE_THROW, -1.2, up), reach: 1, front: true },
    // グローブの うでは そとがわを まわって うえへ。
    glove: { angle: lerp(IDLE_GLOVE, Math.PI + 1.2, up), reach: 1, front: true },
    kick: 0, lean: Math.sin(c * 7) * .05 * up, stretch: .05 * up - hop * .002, hop, swoosh: null,
  }
}

// ---- バッター ----------------------------------------------------------------

export type BatterPose = {
  /** バットを ふる すすみぐあい（0 → 1）。null は かまえ。 */
  swing: number | null
  /** ボールを まって バットを ひく ぐあい（0〜1）。 */
  load: number
  /** まえあしを あげる ぐあい（0〜1）。ボールが くる まえに ふみこんで おろす。 */
  step: number
  /** からぶりして よろけはじめてからの じかん[s]。 */
  wobble: number | null
  time: number
}

type Dir = [x: number, y: number, z: number]
/** バットの むき（x: みぎ、y: うえ、z: ピッチャーの ほう）。かまえ → ミート → ふりぬき。 */
const BAT_KEYS: [at: number, dir: Dir, hand: [number, number]][] = [
  [0, [.25, 1, -.25], [30, -108]],
  [.39, [1, -.08, .12], [50, -94]],
  [.7, [.15, .05, 1], [38, -100]],
  [1, [-.95, .55, .15], [8, -112]],
]

export type BatPose = { angle: number; length: number; hand: { x: number; y: number } }

/**
 * バットを ふる うごき。u は 0 → 1（ふりはじめ → ふりおわり）。null は かまえ。
 * バットは よこに まわるので、むきを 3D で まぜてから がめんへ うつす（おくを むくと みじかく みえる）。
 */
export function batPose(u: number | null): BatPose {
  const e = u === null ? 0 : easeOut(clamp01(u))
  let i = 0
  while (i < BAT_KEYS.length - 2 && e > BAT_KEYS[i + 1][0]) i++
  const [a0, d0, h0] = BAT_KEYS[i], [a1, d1, h1] = BAT_KEYS[i + 1]
  const t = clamp01((e - a0) / (a1 - a0))
  const mix = d0.map((v, k) => v + (d1[k] - v) * t)
  const norm = Math.hypot(...mix) || 1
  const [x, y, z] = mix.map(v => v / norm)
  const sx = x, sy = -y - z * .32
  return {
    angle: Math.atan2(sy, sx),
    length: Math.max(.22, Math.min(1, Math.hypot(sx, sy))),
    hand: { x: h0[0] + (h1[0] - h0[0]) * t, y: h0[1] + (h1[1] - h0[1]) * t },
  }
}

/** こしを まわす ぐあい（0 = かまえ、1 = ふりおわり）。 */
export function batterTwist(swing: number | null): number {
  return swing === null ? 0 : smoothstep(0, .75, swing)
}

/** えらぶ がめんなどで つかう、ボールを もって まっている かたち。 */
export function restingPitcherPose(time = 0): PitcherPose {
  return { ...pitcherMotion(null), holding: true, time, fire: 0, stopped: false }
}
