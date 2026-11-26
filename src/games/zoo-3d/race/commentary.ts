// レースの じっきょう（お知らせの文）と、出走表の「きょうの ちょうし」。ひらがな中心。

import { SPECIES } from '../species'
import type { Mood, RaceEvent, RacePlan } from './raceSim'

export const MOOD: Record<Mood, { emoji: string; label: string }> = {
  great: { emoji: '😆', label: 'ぜっこうちょう' },
  good: { emoji: '🙂', label: 'げんき' },
  sleepy: { emoji: '🥱', label: 'ちょっと ねむそう' },
}

export const PLACE_MEDAL = ['🥇', '🥈', '🥉']

/** できごとを、画面に出す ひとことにする。cheer は おうえんしている動物（plan.runners の番号）。 */
export function commentary(plan: RacePlan, e: RaceEvent, cheer: number | null): { emoji: string; text: string } {
  const s = SPECIES[plan.runners[e.runner].species]
  const name = s.name
  switch (e.type) {
    case 'late':
      return { emoji: '💦', text: `${name}が でおくれた！` }
    case 'lead': {
      const first = plan.events.find(x => x.type === 'lead') === e
      return { emoji: s.emoji, text: first ? `${name}が とびだした！` : `${name}が トップに たった！` }
    }
    case 'quirk': {
      const special = s.specials.find(x => x.clip === e.clip)
      return { emoji: special?.emoji ?? '✨', text: `${name}が「${special?.label ?? 'よりみち'}」！ よりみち しちゃった` }
    }
    case 'stumble':
      return { emoji: '💫', text: `${name}が つまずいた！ がんばれ！` }
    case 'tired':
      return { emoji: '😮‍💨', text: `${name}が つかれてきた…` }
    case 'swim':
      return { emoji: '🌊', text: `${name}が およいで ぐんぐん！` }
    case 'slide':
      return { emoji: '🛷', text: `${name}が おなかで すいすい！` }
    case 'mud':
      return { emoji: '🟤', text: `${name}は どろんこ へっちゃら！` }
    case 'spurt':
      return { emoji: '🔥', text: `${name}の ラストスパート！` }
    case 'finish':
      if (e.place === 1) return { emoji: '🏁', text: `ゴール！ 1ちゃくは ${name}！` }
      if (e.runner === cheer && e.place > 3) return { emoji: '👏', text: `おうえんした ${name}も ゴール！` }
      return { emoji: PLACE_MEDAL[e.place - 1] ?? '👏', text: `${e.place}ちゃくは ${name}` }
  }
}
