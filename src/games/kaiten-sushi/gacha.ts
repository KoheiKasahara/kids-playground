// ガチャで でる たからもの を きめる。まだ もっていない ものが でやすく、きんの おすしは たまに。

import { PRIZES, type PrizeId } from './data'

const RARE_CHANCE = .07

export function pickPrize(owned: readonly PrizeId[], random: () => number = Math.random): PrizeId {
  const rare = PRIZES.filter(p => p.rare)
  const normal = PRIZES.filter(p => !p.rare)
  if (rare.length > 0 && random() < RARE_CHANCE) return rare[Math.floor(random() * rare.length)].id
  const missing = normal.filter(p => !owned.includes(p.id))
  const pool = missing.length > 0 && random() < .75 ? missing : normal
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))].id
}
