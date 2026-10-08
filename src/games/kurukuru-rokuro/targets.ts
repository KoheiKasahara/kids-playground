import { profileFromPoints, reachableHeight, type PotKind, type Profile } from './pottery'

export type TargetId = 'cup' | 'bowl' | 'plate' | 'jar' | 'vase'

export type ChallengeTarget = {
  id: TargetId
  name: string
  emoji: string
  kind: PotKind
  profile: Profile
}

/** おだいの おてほん。やさしい じゅん。たかさは のばす・ちぢめるで ぴったり とどく ものに する。 */
export const TARGETS: readonly ChallengeTarget[] = [
  { id: 'cup', name: 'コップ', emoji: '🥤', kind: 'cup', profile: profileFromPoints(reachableHeight(2), [[0, 0.68], [1, 0.8]]) },
  {
    id: 'bowl', name: 'おちゃわん', emoji: '🍚', kind: 'bowl',
    profile: profileFromPoints(reachableHeight(-2), [[0, 0.55], [0.45, 1.05], [1, 1.35]]),
  },
  { id: 'plate', name: 'おさら', emoji: '🍽️', kind: 'plate', profile: profileFromPoints(reachableHeight(-7), [[0, 0.95], [0.5, 1.25], [1, 1.62]]) },
  {
    id: 'jar', name: 'つぼ', emoji: '🍬', kind: 'jar',
    profile: profileFromPoints(reachableHeight(3), [[0, 0.65], [0.45, 1.25], [0.85, 0.62], [1, 0.6]]),
  },
  {
    id: 'vase', name: 'はないれ', emoji: '🌷', kind: 'vase',
    profile: profileFromPoints(reachableHeight(6), [[0, 0.62], [0.3, 1.05], [0.72, 0.4], [0.9, 0.38], [1, 0.58]]),
  },
]

export function findTarget(id: string | null | undefined): ChallengeTarget | undefined {
  return TARGETS.find(target => target.id === id)
}
