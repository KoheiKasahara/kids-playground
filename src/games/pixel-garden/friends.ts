export const GARDEN_FRIENDS = ['ちょうちょ', 'はち', 'ことり'] as const
export const FRIENDS_KEY = 'kids-playground:pixel-garden:friends:v1'
export type GardenFriends = { unlocked: number; decorations: number[] }

export function readFriends(): GardenFriends {
  const empty = { unlocked: 0, decorations: [] }
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FRIENDS_KEY) ?? 'null')
    if (!value || typeof value !== 'object' || !('unlocked' in value) || !('decorations' in value)) return empty
    const { unlocked, decorations } = value
    if (typeof unlocked !== 'number' || !Number.isInteger(unlocked) || unlocked < 0 || unlocked > GARDEN_FRIENDS.length) return empty
    return { unlocked, decorations: Array.isArray(decorations)
      ? [...new Set(decorations.filter((id): id is number => Number.isInteger(id) && id >= 0 && id < unlocked))] : [] }
  } catch {
    return empty
  }
}

export function saveFriends(friends: GardenFriends): boolean {
  try {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(friends))
    return true
  } catch {
    return false
  }
}

export function earnFriend(friends: GardenFriends): GardenFriends {
  if (friends.unlocked >= GARDEN_FRIENDS.length) return friends
  return { unlocked: friends.unlocked + 1, decorations: [...friends.decorations, friends.unlocked] }
}

export function toggleFriend(friends: GardenFriends, id: number): GardenFriends {
  if (!Number.isInteger(id) || id < 0 || id >= friends.unlocked) return friends
  return { ...friends, decorations: friends.decorations.includes(id)
    ? friends.decorations.filter((item) => item !== id) : [...friends.decorations, id] }
}
