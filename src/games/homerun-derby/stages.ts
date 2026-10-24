// ホームランダービーの あいて（ピッチャー）と、なげてくる ボールの ならび。

/** ボールの しゅるい。うごきかたは derby.ts の pitchPoint が きめる。 */
export type PitchKind = 'straight' | 'fast' | 'slow' | 'hop' | 'wave' | 'curve' | 'stop' | 'ghost'

export type PitcherId = 'penguin' | 'frog' | 'octopus' | 'robot' | 'ghost' | 'dragon'

/** そらの いろ。あいてが つよく なるほど ゆうがたから よるに なる。 */
export type SkyId = 'morning' | 'noon' | 'afternoon' | 'sunset' | 'evening' | 'night'

export type Stage = {
  id: string
  pitcher: PitcherId
  /** あいての なまえ。 */
  name: string
  /** とくいな ボール（えらぶ がめんに だす）。 */
  specialty: string
  /** はじめに でる ひとこと。 */
  lead: string
  /** ふつうの ボールが ホームに とどくまでの じかん[s]。 */
  travel: number
  /** タイミングの あまさ。1より 大きいほど ずれても とおくへ とぶ。 */
  assist: number
  /** クリアに ひつような ホームランの かず。 */
  goal: number
  sky: SkyId
  /** なげる じゅんばん。ながさは BALLS。 */
  pitches: readonly PitchKind[]
}

/** 1かいの しょうぶで なげる ボールの かず。 */
export const BALLS = 5

/** ボールの しゅるいごとの はやさ（travel に かける）。 */
export const PITCH_SPEED: Record<PitchKind, number> = {
  straight: 1, fast: .72, slow: 1.45, hop: 1.08, wave: 1.08, curve: 1, stop: 1, ghost: 1,
}

/** ボールが はなれた ときに でる なまえ。 */
export const PITCH_LABELS: Record<PitchKind, string> = {
  straight: 'まっすぐ',
  fast: 'びゅーん',
  slow: 'ふんわり',
  hop: 'ぴょんぴょん',
  wave: 'くねくね',
  curve: 'まがる',
  stop: 'ピタッ',
  ghost: 'きえる',
}

const s = 'straight', f = 'fast', w = 'slow', h = 'hop', v = 'wave', c = 'curve', p = 'stop', g = 'ghost'

export const STAGES: readonly Stage[] = [
  {
    id: 'penguin', pitcher: 'penguin', name: 'ペンギンの ペンタ', specialty: 'まっすぐ ボール',
    lead: 'まずは まっすぐ。よーく みて うとう！', travel: 1.35, assist: 1.3, goal: 2, sky: 'morning',
    pitches: [s, s, s, s, s],
  },
  {
    id: 'frog', pitcher: 'frog', name: 'カエルの ケロスケ', specialty: 'ぴょんぴょん ボール',
    lead: 'ボールが はねるよ。さいごまで よく みて！', travel: 1.25, assist: 1.2, goal: 2, sky: 'noon',
    pitches: [s, h, s, h, h],
  },
  {
    id: 'octopus', pitcher: 'octopus', name: 'タコの タコハチ', specialty: 'くねくね ボール',
    lead: 'くねくね まがっても、くるのは まんなか！', travel: 1.2, assist: 1.1, goal: 3, sky: 'afternoon',
    pitches: [s, v, c, v, c],
  },
  {
    id: 'robot', pitcher: 'robot', name: 'ロボの ガッチャン', specialty: 'ピタッと とまる ボール',
    lead: 'とまったり はやかったり。あわてないでね', travel: 1.1, assist: 1, goal: 3, sky: 'sunset',
    pitches: [s, p, f, p, f],
  },
  {
    id: 'ghost', pitcher: 'ghost', name: 'おばけの フワリ', specialty: 'きえる ボール',
    lead: 'とちゅうで きえるよ。また でてくるから まってね', travel: 1.2, assist: 1, goal: 3, sky: 'evening',
    pitches: [s, g, g, w, g],
  },
  {
    id: 'dragon', pitcher: 'dragon', name: 'ドラゴンの ドラコ', specialty: 'なんでも なげる',
    lead: 'さいごの あいて！ いろんな ボールが くるよ', travel: 1.05, assist: 1, goal: 3, sky: 'night',
    pitches: [f, h, v, p, g],
  },
]

export function findStageIndex(id: string): number {
  return STAGES.findIndex(stage => stage.id === id)
}
