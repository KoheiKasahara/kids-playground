import { footprint, type BlockShapeId } from './blocks'

/** マットの はんけい。つみきは この なかにだけ おける。 */
export const MAT_RADIUS = 6
/** おく ばしょを そろえる こうし の こまかさ。 */
export const GRID = 0.5
/** いちどに おける つみきの かず。これより おおいと スマホが おもくなる。 */
export const MAX_BLOCKS = 80
/** おいた つみきを すこし うえから そっと おとす たかさ。 */
export const DROP_HEIGHT = 0.18

/**
 * さわった ばしょ を 0.5 の こうしに そろえて、マットから はみださない ように おさめる。
 * こうしに そろえると、うえに かさねる ときに ずれにくく、はんぶん ずらした はしも かけやすい。
 */
export function snapPlacement(x: number, z: number, shape: BlockShapeId, quarterTurns: number): { x: number; z: number } {
  const size = footprint(shape, quarterTurns)
  const snap = (value: number) => Math.round(value / GRID) * GRID + 0
  let sx = snap(x)
  let sz = snap(z)
  const reach = MAT_RADIUS - Math.hypot(size.x, size.z) / 2
  const distance = Math.hypot(sx, sz)
  if (distance > reach) {
    const scale = reach / distance
    // こうしに もどしても はみださない よう、うちがわへ きりすてる。
    sx = Math.trunc(sx * scale / GRID) * GRID + 0
    sz = Math.trunc(sz * scale / GRID) * GRID + 0
  }
  return { x: sx, z: sz }
}

/** たかさ の めあて。どうぶつ と くらべて たかさを たのしめる ように する。 */
export type HeightGoal = { height: number; emoji: string; label: string }

export const HEIGHT_GOALS: readonly HeightGoal[] = [
  { height: 3, emoji: '🐤', label: 'ひよこ' },
  { height: 5, emoji: '🐰', label: 'うさぎ' },
  { height: 7.5, emoji: '🐻', label: 'くま' },
  { height: 10, emoji: '🦒', label: 'キリン' },
  { height: 13, emoji: '🏰', label: 'おしろ' },
]

/** その たかさで いくつめ の めあて まで とどいたか（0 は まだ ひとつも）。 */
export function goalsReached(height: number): number {
  return HEIGHT_GOALS.filter(goal => height >= goal.height - 0.05).length
}

export function nextGoal(height: number): HeightGoal | null {
  return HEIGHT_GOALS[goalsReached(height)] ?? null
}

/** 1 = 5cm の おもちゃの つみき として cm で あらわす。 */
export function heightInCm(height: number): number {
  return Math.max(0, Math.round(height * 5))
}
