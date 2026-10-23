import type { MoveKind, Species } from './species'

/** うっちゃりは、はしで ふんばった ときだけの ぎゃくてんわざ。 */
export type Technique = MoveKind | 'sweep' | 'rush' | 'toss' | 'utchari'

type TechniqueInfo = { name: string; description: string; cue: string }

const TECHNIQUES: Readonly<Record<Technique, TechniqueInfo>> = {
  scoop: { name: 'すくいなげ', description: 'したから すくって まえへ なげる', cue: 'ぐいーん！' },
  lift: { name: 'はさみあげ', description: 'はさんで もちあげて なげる', cue: 'もちあげた！' },
  pinch: { name: 'はさみわざ', description: 'あごで がっちり しめつける', cue: 'がっちり！' },
  charge: { name: 'たいあたり', description: 'からだを よせて おしだす', cue: 'どーん！' },
  sweep: { name: 'よこなげ', description: 'からだを ひねって よこへ なげる', cue: 'くるんっ！' },
  rush: { name: 'れんぞくづき', description: '3かい つづけて ぐいぐい おす', cue: 'ぐいっ！ ぐいっ！' },
  toss: { name: 'かちあげ', description: 'かがんで ぐっと たかく あげる', cue: 'たかーい！' },
  utchari: { name: 'うっちゃり', description: 'はしで こらえて うしろへ なげる', cue: 'ぎゃくてん！' },
}

/** とくいわざを のこし、ツノ・あごと はやさに あわせた わざを くみあわせる。 */
export function moveRepertoire(sp: Species): readonly Technique[] {
  return sp.group === 'kabuto'
    ? [sp.move.kind, 'toss', sp.stats.speed >= 6 ? 'rush' : 'sweep']
    : [sp.move.kind, 'sweep', sp.stats.speed >= 6 ? 'rush' : 'toss']
}

export function techniqueFor(sp: Species, move: Technique): TechniqueInfo {
  const info = TECHNIQUES[move]
  return move === sp.move.kind ? { ...info, name: sp.move.name } : info
}

/** シミュレーションと えが おなじ タイミングで ためる・うごく。 */
export function windupDuration(sp: Species, move: Technique) {
  const pace = move === 'rush' ? .75 : move === 'toss' ? 1.2 : move === 'sweep' ? .95 : 1
  return .5 * (1.3 - sp.stats.speed * .045) * pace
}

export function strikeDuration(move: Technique) {
  return move === 'rush' ? .66 : move === 'sweep' || move === 'toss' ? .5 : .35
}

/** れんぞくづきの 2はつめ・3はつめまでの かんかく。 */
export const RUSH_HIT_INTERVAL = .18
