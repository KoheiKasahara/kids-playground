/**
 * ろくろの ねんどの かたち（たての だんめん）を あつかう 純粋関数。
 * かたちは「そこから うえまで 等間隔に ならんだ わの はんけい」で表す。
 * 3D表示（rokuroScene）や キーボード操作は ここの関数だけで かたちを かえる。
 */

/** たての わの数。ふちと そこを ふくむ。 */
export const RING_COUNT = 40
export const MIN_RADIUS = 0.3
export const MAX_RADIUS = 1.7
/** そこの ふちだけは 細くしすぎない（たおれそうに 見えないように）。 */
export const BASE_MIN_RADIUS = 0.45
export const MIN_HEIGHT = 0.4
export const MAX_HEIGHT = 3.2
/** うつわの あつみ。うちがわの かべは そとがわから この分だけ うちへ ずらす。 */
export const WALL = 0.13
/** ゆびが ねんどを おす はば（うえした）。 */
export const SCULPT_SPREAD = 0.2
/** ゆびに むかって ねんどが うごく はやさ [1びょうあたり]。 */
export const SCULPT_SPEED = 2.2
/** ならす つよさ [1びょうあたり]。でこぼこを けすだけで、かたちは ぼかさない くらいに する。 */
export const SMOOTHING = 3
/** のばす・ちぢめる 1回分の たかさの 倍率。 */
export const STRETCH_STEP = 1.15

export type Profile = { readonly height: number; readonly radii: readonly number[] }

export type PotKind = 'plate' | 'bowl' | 'cup' | 'vase' | 'jar'

export const POT_KINDS: Record<PotKind, { name: string; emoji: string }> = {
  plate: { name: 'おさら', emoji: '🍽️' },
  bowl: { name: 'おちゃわん', emoji: '🍚' },
  cup: { name: 'コップ', emoji: '🥤' },
  vase: { name: 'はないれ', emoji: '🌷' },
  jar: { name: 'つぼ', emoji: '🍬' },
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function clampRadius(radius: number, index: number) {
  return clamp(radius, index <= 1 ? BASE_MIN_RADIUS : MIN_RADIUS, MAX_RADIUS)
}

const LUMP_HEIGHT = 1.3

/** さいしょの ねんど。ずんぐりした つつ。 */
export function createLump(): Profile {
  return { height: LUMP_HEIGHT, radii: Array.from({ length: RING_COUNT }, () => 0.85) }
}

/** のばす（+）・ちぢめる（-）を steps 回 おした ときの たかさ。おだいの たかさは かならず ここから えらぶ。 */
export function reachableHeight(steps: number): number {
  return clamp(LUMP_HEIGHT * STRETCH_STEP ** steps, MIN_HEIGHT, MAX_HEIGHT)
}

/** i ばんめの わの たかさ。 */
export function ringY(height: number, index: number): number {
  return (height * index) / (RING_COUNT - 1)
}

/** たかさ y での はんけい（わの あいだは 直線で つなぐ）。かたちの そとでは 0。 */
export function radiusAt(profile: Profile, y: number): number {
  if (y < 0 || y > profile.height || profile.height <= 0) return 0
  const position = (y / profile.height) * (RING_COUNT - 1)
  const lower = Math.min(RING_COUNT - 2, Math.floor(position))
  const t = position - lower
  return profile.radii[lower]! * (1 - t) + profile.radii[lower + 1]! * t
}

/**
 * そとがわの かべに そって そこから はかった ながさの わりあい（0〜1）を わ ごとに かえす。
 * もようの テクスチャの たて（v）は これに あわせる（ひらいた おさらの ふちでも ふでの はばが のびない）。
 */
export function wallMetrics(profile: Profile): { fractions: number[]; length: number } {
  const step = profile.height / (RING_COUNT - 1)
  const lengths = [0]
  for (let index = 1; index < RING_COUNT; index++) {
    lengths.push(lengths[index - 1]! + Math.hypot(profile.radii[index]! - profile.radii[index - 1]!, step))
  }
  const length = lengths[RING_COUNT - 1]!
  return { fractions: lengths.map(value => (length > 0 ? value / length : 0)), length }
}

/** たかさの わりあい（0〜1）→ かべに そった ながさの わりあい。 */
export function wallFractionAtHeight(profile: Profile, heightFraction: number): number {
  const { fractions } = wallMetrics(profile)
  const position = clamp(heightFraction, 0, 1) * (RING_COUNT - 1)
  const lower = Math.min(RING_COUNT - 2, Math.floor(position))
  const t = position - lower
  return fractions[lower]! * (1 - t) + fractions[lower + 1]! * t
}

/** かべに そった ながさの わりあい → そこでの はんけい。 */
export function radiusAtWallFraction(profile: Profile, fraction: number, fractions = wallMetrics(profile).fractions): number {
  const v = clamp(fraction, 0, 1)
  let index = 0
  while (index < RING_COUNT - 2 && fractions[index + 1]! < v) index++
  const span = fractions[index + 1]! - fractions[index]!
  const t = span > 0 ? clamp((v - fractions[index]!) / span, 0, 1) : 0
  return profile.radii[index]! * (1 - t) + profile.radii[index + 1]! * t
}

/**
 * ゆびで おしている あいだ、まいフレーム よぶ。radii を その場で かきかえる。
 * ゆびの よこの いち（じくからの きょり）に むかって、ゆびの たかさの まわりの ねんどが すこしずつ よる。
 * @returns かたちが かわったか
 */
export function sculptRadii(radii: number[], height: number, touch: { y: number; radius: number }, dt: number): boolean {
  if (touch.y < -SCULPT_SPREAD || touch.y > height + SCULPT_SPREAD * 1.5) return false
  const target = clamp(touch.radius, MIN_RADIUS, MAX_RADIUS)
  const maxStep = SCULPT_SPEED * clamp(dt, 0, 0.05)
  const weights = radii.map((_, index) => Math.exp(-(((ringY(height, index) - touch.y) / SCULPT_SPREAD) ** 2)))
  let changed = false
  for (let index = 0; index < radii.length; index++) {
    const weight = weights[index]!
    if (weight < 0.02) continue
    const radius = radii[index]!
    const next = clampRadius(radius + clamp(target - radius, -maxStep, maxStep) * weight, index)
    if (Math.abs(next - radius) > 1e-6) changed = true
    radii[index] = next
  }
  // さわった ところだけ すこし ならして、でこぼこに ならないように する。
  const before = [...radii]
  for (let index = 1; index < radii.length - 1; index++) {
    const weight = weights[index]!
    if (weight < 0.02) continue
    const average = (before[index - 1]! + before[index + 1]!) / 2
    radii[index] = clampRadius(before[index]! + (average - before[index]!) * Math.min(1, SMOOTHING * dt) * weight, index)
  }
  return changed
}

/** キーボード用。たかさの わりあい（0〜1）の ところを delta だけ ふとく／ほそく する。 */
export function nudgeProfile(profile: Profile, heightFraction: number, delta: number): Profile {
  const radii = [...profile.radii]
  const y = clamp(heightFraction, 0, 1) * profile.height
  sculptRadii(radii, profile.height, { y, radius: radiusAt(profile, y) + delta * 4 }, Math.abs(delta) / SCULPT_SPEED)
  return { height: profile.height, radii }
}

/** たかく のばす（direction=1）／ひくく つぶす（-1）。ねんどの りょうは だいたい かわらない。 */
export function stretchProfile(profile: Profile, direction: 1 | -1): Profile {
  const height = clamp(profile.height * STRETCH_STEP ** direction, MIN_HEIGHT, MAX_HEIGHT)
  const factor = height / profile.height
  if (Math.abs(factor - 1) < 1e-6) return profile
  const scale = 1 / Math.sqrt(factor)
  return { height, radii: profile.radii.map((radius, index) => clampRadius(radius * scale, index)) }
}

export function canStretch(profile: Profile, direction: 1 | -1): boolean {
  return direction === 1 ? profile.height < MAX_HEIGHT - 1e-6 : profile.height > MIN_HEIGHT + 1e-6
}

/** できた かたちが なにに いちばん ちかいか。 */
export function classifyPot(profile: Profile): PotKind {
  const radii = profile.radii
  const widest = Math.max(...radii)
  const top = radii[radii.length - 1]!
  // うえ はんぶんで いちばん ほそい ところ（くび）。
  const neck = Math.min(...radii.slice(Math.floor(radii.length / 2)))
  if (profile.height < 0.8 && top >= widest * 0.8) return 'plate'
  if (top < widest * 0.72 || neck < widest * 0.62) return profile.height >= 2.1 ? 'vase' : 'jar'
  return profile.height / (2 * widest) < 0.6 ? 'bowl' : 'cup'
}

/**
 * 2つの かたちの にている ど（0〜1）。よこから 見た シルエットの かさなり（共通部分 ÷ あわせた部分）。
 */
export function similarity(a: Profile, b: Profile): number {
  const samples = 64
  const height = Math.max(a.height, b.height)
  let common = 0
  let union = 0
  for (let k = 0; k < samples; k++) {
    const y = ((k + 0.5) / samples) * height
    const ra = radiusAt(a, y)
    const rb = radiusAt(b, y)
    common += Math.min(ra, rb)
    union += Math.max(ra, rb)
  }
  return union > 0 ? common / union : 0
}

/** にている ど から ★（1〜3）。おだいに ちょうせんして やきあげたら かならず ★1 は もらえる。 */
export function starsForScore(score: number): number {
  if (score >= 0.86) return 3
  if (score >= 0.75) return 2
  return 1
}

/** たての だんめんの 点から なめらかな かたちを つくる（おだい用）。points は [たかさの わりあい, はんけい]。 */
export function profileFromPoints(height: number, points: readonly (readonly [number, number])[]): Profile {
  const radii = Array.from({ length: RING_COUNT }, (_, index) => {
    const t = index / (RING_COUNT - 1)
    let segment = 0
    while (segment < points.length - 2 && t > points[segment + 1]![0]) segment++
    const [t0, r0] = points[segment]!
    const [t1, r1] = points[segment + 1]!
    const local = clamp((t - t0) / Math.max(1e-6, t1 - t0), 0, 1)
    const eased = (1 - Math.cos(local * Math.PI)) / 2
    return clampRadius(r0 + (r1 - r0) * eased, index)
  })
  return { height, radii }
}

/**
 * よこから 見た シルエットの SVG path（たなの かわり絵や おだいの カードに つかう）。
 * viewBox は 0 0 100 100、そこは y=96。かたちごとに わくいっぱいに おさまる 大きさに する。
 */
export function silhouettePath(profile: Profile): string {
  const scale = 88 / Math.max(profile.height, Math.max(...profile.radii) * 2)
  const point = (radius: number, y: number) => `${(50 + radius * scale).toFixed(1)} ${(96 - y * scale).toFixed(1)}`
  const right = profile.radii.map((radius, index) => point(radius, ringY(profile.height, index)))
  const left = profile.radii.map((radius, index) => point(-radius, ringY(profile.height, index))).reverse()
  return `M${right.join(' L')} L${left.join(' L')} Z`
}

/** たなに しまう ときに 小さく まるめる。 */
export function roundProfile(profile: Profile): Profile {
  const round = (value: number) => Math.round(value * 100) / 100
  return { height: round(profile.height), radii: profile.radii.map(round) }
}

/** 保存データなどから よんだ 値が かたちとして つかえるか。 */
export function isProfile(value: unknown): value is Profile {
  if (!value || typeof value !== 'object') return false
  const { height, radii } = value as { height?: unknown; radii?: unknown }
  return (
    typeof height === 'number' && Number.isFinite(height) && height >= MIN_HEIGHT - 0.01 && height <= MAX_HEIGHT + 0.01 &&
    Array.isArray(radii) && radii.length === RING_COUNT &&
    radii.every(radius => typeof radius === 'number' && Number.isFinite(radius) && radius >= MIN_RADIUS - 0.01 && radius <= MAX_RADIUS + 0.01)
  )
}
