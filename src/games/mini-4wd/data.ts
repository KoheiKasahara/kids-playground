import type { Build, CarStats, Course, Part, PartCategory, TrackPoint } from './types'

export const PARTS: Record<PartCategory, Part[]> = {
  body: [
    { id: 'arrow', name: 'アロー', description: 'かるくて すいすい', icon: '⚡', stats: { speed: .6, grip: 0, stability: -.3 } },
    { id: 'buggy', name: 'バギー', description: 'カーブも おまかせ', icon: '🛞', stats: { speed: -.3, grip: .5, stability: .5 } },
    { id: 'wing', name: 'ウイング', description: 'ジャンプも しっかり', icon: '🪽', stats: { speed: -.2, grip: 0, stability: .8 } },
    { id: 'shark', name: 'シャーク', description: 'とがった はなで ぐんぐん', icon: '🦈', stats: { speed: .4, grip: .3, stability: -.2 } },
    { id: 'truck', name: 'トラック', description: 'どっしり おもたい', icon: '🚚', stats: { speed: -.5, grip: .2, stability: 1.1 } },
  ],
  motor: [
    { id: 'balance', name: 'バランス', description: 'はじめてに ぴったり', icon: '⚙️', stats: { speed: 0, grip: 0, stability: .3 } },
    { id: 'dash', name: 'ダッシュ', description: 'はやい！ でも ゆれやすい', icon: '⚡', stats: { speed: 1, grip: 0, stability: -.8 } },
    { id: 'torque', name: 'パワー', description: 'ゆっくり ぐんぐん', icon: '💪', stats: { speed: -.4, grip: .35, stability: .45 } },
    { id: 'rocket', name: 'ロケット', description: 'びゅーん！ でも あばれんぼう', icon: '🚀', stats: { speed: 1.4, grip: -.2, stability: -1.2 } },
    { id: 'eco', name: 'エコ', description: 'しずかで やさしい', icon: '🍃', stats: { speed: -.2, grip: .15, stability: .8 } },
  ],
  tires: [
    { id: 'normal', name: 'ノーマル', description: 'どこでも はしれる', icon: '🛞', stats: { speed: 0, grip: .2, stability: 0 } },
    { id: 'sponge', name: 'スポンジ', description: 'やわらか すべりにくい', icon: '☁️', stats: { speed: -.25, grip: .9, stability: .4 } },
    { id: 'slick', name: 'スリック', description: 'まっすぐが とくい', icon: '💨', stats: { speed: .45, grip: -.6, stability: -.2 } },
    { id: 'big', name: 'ビッグ', description: 'おおきくて がたがたも へっちゃら', icon: '🌕', stats: { speed: -.3, grip: .2, stability: .9 } },
    { id: 'spike', name: 'スパイク', description: 'とげとげで ぴたっ', icon: '✳️', stats: { speed: -.15, grip: 1.2, stability: 0 } },
  ],
  rollers: [
    { id: 'standard', name: 'ノーマル', description: 'こつこつ あんてい', icon: '🔩', stats: { speed: 0, grip: 0, stability: 0 } },
    { id: 'bearing', name: 'ベアリング', description: 'くるくる なめらか', icon: '✨', stats: { speed: .3, grip: .1, stability: -.2 } },
    { id: 'wide', name: 'ワイド', description: 'ひろくて ゆれにくい', icon: '↔️', stats: { speed: -.35, grip: .4, stability: .9 } },
    { id: 'double', name: 'ダブル', description: '2だんで しっかり ガード', icon: '🔗', stats: { speed: -.15, grip: .3, stability: .6 } },
    { id: 'gold', name: 'ゴールド', description: 'きらきら すべすべ', icon: '🌟', stats: { speed: .45, grip: .15, stability: -.35 } },
  ],
}

export const COLORS = [
  { id: 'red', name: 'あか', hex: '#f35e68' },
  { id: 'blue', name: 'あお', hex: '#518eff' },
  { id: 'mint', name: 'ミント', hex: '#4ed8ac' },
  { id: 'yellow', name: 'きいろ', hex: '#ffd464' },
  { id: 'violet', name: 'むらさき', hex: '#b593ff' },
  { id: 'white', name: 'しろ', hex: '#f2f4ef' },
]

export const DEFAULT_BUILD: Build = {
  body: 'arrow', motor: 'balance', tires: 'normal', rollers: 'standard', color: 'red',
}

export function normalizeBuild(value: unknown): Build {
  const build = { ...DEFAULT_BUILD }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return build
  const stored = value as Record<string, unknown>
  for (const category of Object.keys(PARTS) as PartCategory[]) {
    if (PARTS[category].some(part => part.id === stored[category])) build[category] = stored[category] as string
  }
  if (COLORS.some(color => color.id === stored.color)) build.color = stored.color as string
  return build
}

export function getStats(build: Build): CarStats {
  const valid = normalizeBuild(build)
  const stats: CarStats = { speed: 3, grip: 2.6, stability: 2.7 }
  for (const category of Object.keys(PARTS) as PartCategory[]) {
    const part = PARTS[category].find(item => item.id === valid[category])!
    for (const key of Object.keys(stats) as (keyof CarStats)[]) stats[key] += part.stats[key]
  }
  for (const key of Object.keys(stats) as (keyof CarStats)[]) {
    stats[key] = Math.round(Math.max(1, Math.min(5, stats[key])) * 10) / 10
  }
  return stats
}

/** Closed Catmull–Rom path: rendering and racing use the same sampled centerline. */
function makeCourse(definition: Omit<Course, 'points' | 'length'>, corners: [number, number][]): Course {
  const points: TrackPoint[] = []
  for (let i = 0; i < corners.length; i++) {
    const p0 = corners[(i + corners.length - 1) % corners.length]
    const p1 = corners[i]
    const p2 = corners[(i + 1) % corners.length]
    const p3 = corners[(i + 2) % corners.length]
    for (let step = 0; step < 16; step++) {
      const t = step / 16
      const coordinate = (axis: number) => .5 * (
        2 * p1[axis] + (-p0[axis] + p2[axis]) * t
        + (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t
        + (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t * t * t
      )
      points.push({ x: coordinate(0), y: coordinate(1) })
    }
  }
  const length = points.reduce((total, point, i) => {
    const next = points[(i + 1) % points.length]
    return total + Math.hypot(next.x - point.x, next.y - point.y)
  }, 0)
  return { ...definition, points, length }
}

export const COURSES: Course[] = [
  makeCourse({
    id: 'park', name: 'はじめてパーク', subtitle: 'ながい まっすぐを すいすい', theme: 'park', accent: '#83dcb3',
    zones: [
      { start: .1, end: .32, kind: 'curve', severity: .65 },
      { start: .61, end: .82, kind: 'curve', severity: .65 },
    ],
  }, [[360, 100], [520, 100], [620, 165], [620, 275], [520, 340], [200, 340], [100, 275], [100, 165], [200, 100]]),
  makeCourse({
    id: 'forest', name: 'もりのくねくね', subtitle: 'タイヤで カーブを クリア', theme: 'forest', accent: '#a6cd6c',
    zones: [
      { start: .11, end: .29, kind: 'curve', severity: 1.2 },
      { start: .35, end: .55, kind: 'curve', severity: 1.8 },
      { start: .64, end: .85, kind: 'curve', severity: 1.4 },
    ],
  }, [[360, 95], [510, 95], [615, 155], [610, 270], [510, 340], [445, 320], [420, 225], [300, 225], [275, 325], [180, 340], [100, 265], [110, 160], [220, 100]]),
  makeCourse({
    id: 'coast', name: 'うみかぜジャンプ', subtitle: 'ふわっと とんで ちゃくち', theme: 'coast', accent: '#78d1ee',
    zones: [
      { start: .07, end: .12, kind: 'jump', severity: 1.6 },
      { start: .19, end: .35, kind: 'curve', severity: .9 },
      { start: .43, end: .49, kind: 'jump', severity: 2 },
      { start: .65, end: .75, kind: 'wave', severity: 1.3 },
      { start: .8, end: .91, kind: 'curve', severity: 1 },
    ],
  }, [[360, 100], [540, 100], [625, 170], [595, 280], [470, 340], [355, 300], [240, 340], [125, 295], [100, 195], [165, 110]]),
  makeCourse({
    id: 'night', name: 'ネオンシティ', subtitle: 'はやさと あんていの しょうぶ', theme: 'night', accent: '#c2a1ff',
    zones: [
      { start: .11, end: .24, kind: 'curve', severity: 1.6 },
      { start: .29, end: .35, kind: 'jump', severity: 1.8 },
      { start: .38, end: .56, kind: 'curve', severity: 2 },
      { start: .61, end: .75, kind: 'wave', severity: 2 },
      { start: .8, end: .92, kind: 'curve', severity: 1.7 },
    ],
  }, [[360, 100], [525, 100], [620, 175], [600, 295], [495, 335], [400, 270], [310, 335], [200, 330], [100, 255], [125, 150], [220, 100]]),
]

const trackDistances = new WeakMap<Course, number[]>()

function distancesFor(course: Course): number[] {
  const cached = trackDistances.get(course)
  if (cached) return cached
  const distances = [0]
  for (let i = 0; i < course.points.length; i++) {
    const point = course.points[i]
    const next = course.points[(i + 1) % course.points.length]
    distances.push(distances[i] + Math.hypot(next.x - point.x, next.y - point.y))
  }
  trackDistances.set(course, distances)
  return distances
}

export function sampleTrack(course: Course, distance: number): TrackPoint & { angle: number } {
  const distances = distancesFor(course)
  const wrapped = ((distance % course.length) + course.length) % course.length
  const at = wrapped < 1e-7 || course.length - wrapped < 1e-7 ? 0 : wrapped
  let low = 0
  let high = course.points.length - 1
  while (low < high) {
    const middle = Math.floor((low + high + 1) / 2)
    if (distances[middle] <= at) low = middle
    else high = middle - 1
  }
  const from = course.points[low]
  const to = course.points[(low + 1) % course.points.length]
  const t = (at - distances[low]) / (distances[low + 1] - distances[low])
  return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, angle: Math.atan2(to.y - from.y, to.x - from.x) }
}
