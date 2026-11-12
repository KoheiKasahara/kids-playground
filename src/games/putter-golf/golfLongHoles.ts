/**
 * パターゴルフの ながい ホール（データだけ）。
 *
 * まがりくねった ながい みちは、まん中の線（＝みちすじ）と はばから 床の形を 作る。
 * まん中の線が そのまま 目安の みちすじに なるので、かどごとに 止まりながら すすめる。
 */
import type { Corner, HoleDefinition, Vec2 } from './golfCourses'

/**
 * まん中の線 path に そって、よこ ±half の はばを もつ 1本の みち。
 * かどは r で 丸め、はじめと おわりは cap だけ のばす（ティーと カップの うしろの よゆう）。
 */
export function ribbon(path: readonly Vec2[], half: number, r = 0.7, cap = 1.1): Corner[] {
  const unit = (from: Vec2, to: Vec2): Vec2 => {
    const length = Math.hypot(to.x - from.x, to.z - from.z) || 1
    return { x: (to.x - from.x) / length, z: (to.z - from.z) / length }
  }
  const first = unit(path[1]!, path[0]!)
  const last = unit(path[path.length - 2]!, path[path.length - 1]!)
  const points = [
    { x: path[0]!.x + first.x * cap, z: path[0]!.z + first.z * cap },
    ...path.slice(1, -1),
    { x: path[path.length - 1]!.x + last.x * cap, z: path[path.length - 1]!.z + last.z * cap },
  ]
  const left: Corner[] = []
  const right: Corner[] = []
  points.forEach((point, index) => {
    const before = index > 0 ? unit(points[index - 1]!, point) : unit(point, points[index + 1]!)
    const after = index < points.length - 1 ? unit(point, points[index + 1]!) : before
    // 前後の 辺の 法線の まん中の むきへ、はばが かわらない 長さだけ ずらす。
    const sum = { x: -before.z - after.z, z: before.x + after.x }
    const length = Math.hypot(sum.x, sum.z) || 1
    const miter = { x: sum.x / length, z: sum.z / length }
    const reach = half / Math.max(0.35, miter.x * -before.z + miter.z * before.x)
    const end = index === 0 || index === points.length - 1
    const round = end ? Math.min(r, half * 0.75) : r
    left.push({ x: point.x + miter.x * reach, z: point.z + miter.z * reach, r: round })
    right.push({ x: point.x - miter.x * reach, z: point.z - miter.z * reach, r: round })
  })
  return [...left, ...right.reverse()]
}

/** まん中の線が そのまま みちすじに なる ながい ホール。 */
function winding(hole: Omit<HoleDefinition, 'tee' | 'cup' | 'floors' | 'route'> & { path: readonly Vec2[]; half: number; route?: HoleDefinition['route'] }): HoleDefinition {
  const { path, half, route, ...rest } = hole
  return { ...rest, tee: path[0]!, cup: path[path.length - 1]!, floors: [{ corners: ribbon(path, half) }], route: route ?? path }
}

/** いままでの コースの さいごに 足す、ながい しめくくりの ホール。 */
export const FINALE_HOLES = {
  beach: winding({
    id: 'beach-5',
    name: 'ながい なぎさ',
    par: 4,
    path: [{ x: -4, z: 14 }, { x: -4, z: 4 }, { x: 4, z: -2 }, { x: 4, z: -14 }],
    half: 1.4,
    features: [{ kind: 'ridge', from: { x: 2.4, z: -5 }, to: { x: 5.6, z: -5 }, radius: 0.8, height: 0.14 }],
    zones: [{ kind: 'sand', x: -2.85, z: 9 }, { kind: 'sand', x: 2.85, z: -8.5 }].map(zone => ({ ...zone, kind: 'sand' as const, radius: 0.9 })),
    gadgets: [
      { kind: 'bumper', id: 'jelly-long', x: 0.5, z: 1.65, radius: 0.3 },
      { kind: 'critter', id: 'crab-long', x: 2.9, z: -11, to: { x: 5.1, z: -11 }, speed: 0.9, look: 'crab' },
    ],
    tip: 'ながーい なぎさを くねくね すすもう',
  }),
  moon: winding({
    id: 'moon-5',
    name: 'ぎんがの みち',
    par: 5,
    path: [{ x: 0, z: 16 }, { x: 0, z: 8 }, { x: 5, z: 3 }, { x: -5, z: -5 }, { x: 0, z: -10 }, { x: 0, z: -17 }],
    half: 1.3,
    features: [{ kind: 'bump', x: 0, z: -1, radius: 1.1, height: 0.18 }],
    gadgets: [
      { kind: 'booster', id: 'star-dash', x: 0, z: 13.4, dir: { x: 0, z: -1 }, speed: 3.4 },
      { kind: 'rock', id: 'comet-rock', x: 3.1, z: 6.1, radius: 0.32 },
      { kind: 'bumper', id: 'ufo-long', x: -0.8, z: -13.6, radius: 0.3 },
    ],
    tip: 'ほしの あいだを ジグザグに すすもう',
  }),
  snow: winding({
    id: 'snow-5',
    name: 'ゆきやま スラローム',
    par: 6,
    path: [{ x: -3, z: 15 }, { x: -3, z: 5 }, { x: 3, z: 0 }, { x: 3, z: -8 }, { x: -3, z: -13 }, { x: -3, z: -19 }],
    half: 1.4,
    zones: [{ kind: 'ice', x: -3, z: 9.5, radius: 1.3 }, { kind: 'ice', x: 3, z: -4, radius: 1.3 }, { kind: 'rough', x: -1.85, z: -17, radius: 0.8 }],
    gadgets: [
      { kind: 'bumper', id: 'snowman-long', x: 0.5, z: 3.15, radius: 0.3 },
      { kind: 'critter', id: 'penguin-long', x: -4.1, z: -15, to: { x: -1.9, z: -15 }, speed: 0.9, look: 'penguin' },
    ],
    tip: 'こおりで すべりながら くねくね くだろう',
  }),
  candy: winding({
    id: 'candy-5',
    name: 'キャンディ うずまき',
    par: 7,
    path: [{ x: -5, z: 7 }, { x: -5, z: -7 }, { x: 5, z: -7 }, { x: 5, z: 4 }, { x: -1.6, z: 4 }, { x: -1.6, z: -3.4 }, { x: 1.8, z: -3.4 }, { x: 1.8, z: 0.6 }],
    half: 1.1,
    gadgets: [
      { kind: 'bumper', id: 'gum-spiral-a', x: -5.6, z: -1, radius: 0.28 },
      { kind: 'bumper', id: 'gum-spiral-b', x: 0, z: -7.6, radius: 0.28 },
      { kind: 'bumper', id: 'gum-spiral-c', x: 5.6, z: -1.5, radius: 0.28 },
    ],
    tip: 'ぐるぐる うずまきの まん中が ゴール',
  }),
  dino: winding({
    id: 'dino-5',
    name: 'きょうりゅうの せなか',
    par: 6,
    path: [{ x: -5, z: 14 }, { x: -5, z: 6 }, { x: 5, z: -4 }, { x: 5, z: -12 }, { x: -1, z: -16 }],
    half: 1.4,
    features: [[-2.5, 3.5], [0, 1], [2.5, -1.5]].map(([x, z]) => ({ kind: 'ridge' as const, from: { x: x! - 1.13, z: z! - 1.13 }, to: { x: x! + 1.13, z: z! + 1.13 }, radius: 0.7, height: 0.15 })),
    gadgets: [
      { kind: 'rock', id: 'spine-rock-a', x: -5.75, z: 10, radius: 0.32 },
      { kind: 'rock', id: 'spine-rock-b', x: 5.75, z: -8, radius: 0.32 },
      { kind: 'critter', id: 'dino-long', x: 1.4, z: -13.1, to: { x: 2.6, z: -14.9 }, speed: 0.7, look: 'dino' },
    ],
    tip: 'でこぼこの せなかを こえて いこう',
  }),
} satisfies Record<string, HoleDefinition>

/** 「だいぼうけん」コース。どの ホールも ながい。 */
export const JOURNEY_HOLES: readonly HoleDefinition[] = [
  winding({
    id: 'journey-1',
    name: 'くねくね ロード',
    par: 7,
    path: [{ x: 0, z: 20 }, { x: 0, z: 13 }, { x: 5, z: 8 }, { x: 5, z: 1 }, { x: -4, z: -3 }, { x: -4, z: -10 }, { x: 3, z: -15 }, { x: 3, z: -21 }],
    half: 1.3,
    features: [{ kind: 'ridge', from: { x: -0.15, z: 0.46 }, to: { x: 1.15, z: -2.46 }, radius: 0.9, height: 0.15 }],
    gadgets: [
      { kind: 'bumper', id: 'acorn-a', x: 5.75, z: 4.5, radius: 0.3 },
      { kind: 'bumper', id: 'acorn-b', x: -4.75, z: -6.5, radius: 0.3 },
      { kind: 'critter', id: 'squirrel-road', x: 1.9, z: -18, to: { x: 4.1, z: -18 }, speed: 1.0, look: 'squirrel' },
    ],
    tip: 'くねくねの みちを かどごとに すすもう',
  }),
  winding({
    id: 'journey-2',
    name: 'ダッシュ うずまき',
    par: 9,
    path: [{ x: -7, z: 4 }, { x: -7, z: -10 }, { x: 7, z: -10 }, { x: 7, z: 6.6 }, { x: -3.6, z: 6.6 }, { x: -3.6, z: -6.6 }, { x: 3.6, z: -6.6 }, { x: 3.6, z: 3.2 }, { x: 0, z: 3.2 }, { x: 0, z: -2.5 }],
    half: 1.2,
    gadgets: [
      { kind: 'booster', id: 'dash-a', x: -7, z: 1.5, dir: { x: 0, z: -1 }, speed: 4.6 },
      { kind: 'booster', id: 'dash-b', x: -4.5, z: -10, dir: { x: 1, z: 0 }, speed: 4.6 },
      { kind: 'booster', id: 'dash-c', x: 7, z: -7.5, dir: { x: 0, z: 1 }, speed: 5.0 },
      { kind: 'bumper', id: 'acorn-spiral', x: 0.75, z: 0.5, radius: 0.28 },
    ],
    tip: 'ダッシュパネルで びゅーんと うずまきの まん中へ',
  }),
  winding({
    id: 'journey-3',
    name: 'ジグザグ ざか',
    par: 7,
    path: [{ x: -6, z: 12 }, { x: 6, z: 12 }, { x: 6, z: 5 }, { x: -6, z: 5 }, { x: -6, z: -2 }, { x: 6, z: -2 }, { x: 6, z: -9 }, { x: 0, z: -9 }],
    half: 1.3,
    features: [
      { kind: 'slope', from: { x: 0, z: 10.4 }, to: { x: 0, z: 6.6 }, drop: 0.7 },
      { kind: 'slope', from: { x: 0, z: 3.4 }, to: { x: 0, z: -0.4 }, drop: 0.7 },
      { kind: 'slope', from: { x: 0, z: -3.6 }, to: { x: 0, z: -7.4 }, drop: 0.7 },
    ],
    gadgets: [
      { kind: 'rock', id: 'slope-rock-a', x: 0, z: 12.7, radius: 0.3 },
      { kind: 'bumper', id: 'acorn-slope', x: -2, z: 5.7, radius: 0.3 },
      { kind: 'rock', id: 'slope-rock-b', x: 2, z: -2.7, radius: 0.3 },
    ],
    tip: 'かどの さかを ころころ くだって ジグザグに',
  }),
  winding({
    id: 'journey-4',
    name: 'しかけ ロード',
    par: 4,
    path: [{ x: 0, z: 24 }, { x: 0, z: -23.5 }],
    half: 1.6,
    route: [{ x: 0, z: 24 }, { x: 0, z: 16 }, { x: 0, z: 13.2 }, { x: 0, z: -23.5 }],
    features: [{ kind: 'ridge', from: { x: -1.8, z: 20 }, to: { x: 1.8, z: 20 }, radius: 0.9, height: 0.14 }],
    zones: [{ kind: 'ice', x: 0, z: 0.5, radius: 1.5 }, { kind: 'sand', x: -1.3, z: -6, radius: 0.7 }, { kind: 'sand', x: 1.3, z: -9, radius: 0.7 }],
    gadgets: [
      { kind: 'windmill', id: 'road-windmill', x: 0, z: 14.6, speed: 0.8 },
      { kind: 'gate', id: 'road-gate', x: 0, z: 6, axis: { x: 1, z: 0 }, span: 1.0, speed: 0.9, halfWidth: 0.55 },
      { kind: 'booster', id: 'road-dash', x: 0, z: -12, dir: { x: 0, z: -1 }, speed: 4.2 },
      { kind: 'critter', id: 'road-duck', x: -1.2, z: -17, to: { x: 1.2, z: -17 }, speed: 1.0, look: 'duck' },
      { kind: 'bumper', id: 'road-acorn', x: -0.95, z: -21, radius: 0.3 },
    ],
    tip: 'ふうしゃ・とびら・こおり… しかけが いっぱい！',
  }),
  winding({
    id: 'journey-5',
    name: 'ちょうロング だいぼうけん',
    par: 10,
    path: [{ x: -8, z: 22 }, { x: -8, z: 10 }, { x: -2, z: 4 }, { x: 6, z: 4 }, { x: 6, z: -6 }, { x: -2, z: -6 }, { x: -8, z: -12 }, { x: -8, z: -22 }, { x: 2, z: -22 }, { x: 8, z: -16 }],
    half: 1.4,
    features: [{ kind: 'ridge', from: { x: -9.6, z: -17 }, to: { x: -6.4, z: -17 }, radius: 0.9, height: 0.16 }],
    zones: [{ kind: 'sand', x: 7, z: -7, radius: 0.9 }],
    gadgets: [
      { kind: 'booster', id: 'epic-dash', x: -8, z: 19, dir: { x: 0, z: -1 }, speed: 4.0 },
      { kind: 'bumper', id: 'epic-acorn-a', x: 1, z: 4.8, radius: 0.3 },
      { kind: 'bumper', id: 'epic-acorn-b', x: 3.5, z: 3.2, radius: 0.3 },
      { kind: 'gate', id: 'epic-gate', x: 6, z: -1, axis: { x: 1, z: 0 }, span: 0.8, speed: 0.9, halfWidth: 0.5 },
      { kind: 'rock', id: 'epic-rock-a', x: -4, z: -21.3, radius: 0.3 },
      { kind: 'rock', id: 'epic-rock-b', x: -1, z: -22.7, radius: 0.3 },
      { kind: 'critter', id: 'epic-squirrel', x: 4.2, z: -18.2, to: { x: 5.8, z: -19.8 }, speed: 0.9, look: 'squirrel' },
    ],
    tip: 'いちばん ながい みち。あせらず すすもう！',
  }),
]
