/**
 * パターゴルフのコースとホールの定義（データだけ）。
 *
 * ホールは「床の形（角の丸めつき多角形）」「高さのしかけ（こぶ・なみ・ジャンプ台）」
 * 「動くしかけ」「すなば」で表す。見た目の床と物理の床は、どちらもこのデータから
 * golfGeometry.ts が同じ三角形として作るので、見えている形と転がり方が必ず一致する。
 */
import { EARTH_GRAVITY } from './golfPhysics'

export type Vec2 = { x: number; z: number }

/** 多角形の角。r を付けるとその角を丸める。 */
export type Corner = { x: number; z: number; r?: number }

export type FloorPiece = {
  corners: readonly Corner[]
  /** 床の高さの基準。ジャンプの着地側を少し低くするときに使う。 */
  y?: number
  /** 壁を付けない辺の番号（corners[i] → corners[i+1]）。ジャンプの切れ目など。 */
  open?: readonly number[]
}

export type HeightFeature =
  /** まるい こぶ（height が負ならくぼみ）。 */
  | { kind: 'bump'; x: number; z: number; radius: number; height: number }
  /** 細長い こぶ（なみ）。from→to の線からの距離で高さが決まる。 */
  | { kind: 'ridge'; from: Vec2; to: Vec2; radius: number; height: number }
  /** ジャンプ台。from で0、to で rise まで一定の坂で上がる。 */
  | { kind: 'kicker'; from: Vec2; to: Vec2; halfWidth: number; rise: number }

export type Gadget =
  /** ぽよんと はねかえす バンパー。 */
  | { kind: 'bumper'; id: string; x: number; z: number; radius: number }
  /** はねかえりの小さい いわ。 */
  | { kind: 'rock'; id: string; x: number; z: number; radius: number }
  /** トンネルの前で はねが回る ふうしゃ。トンネルは z 方向に通る。 */
  | { kind: 'windmill'; id: string; x: number; z: number; speed: number }
  /** 上を通ったボールを dir の向きへ speed まで速くする ダッシュパネル。 */
  | { kind: 'booster'; id: string; x: number; z: number; dir: Vec2; speed: number }

export type SandZone = { x: number; z: number; radius: number }

/** みちすじの点。minPower は「ここを通るなら最低この強さ」（ジャンプ台の手前など）。 */
export type RoutePoint = Vec2 & { minPower?: number }

export type HoleDefinition = {
  id: string
  name: string
  par: number
  tee: Vec2
  cup: Vec2
  floors: readonly FloorPiece[]
  features?: readonly HeightFeature[]
  gadgets?: readonly Gadget[]
  sand?: readonly SandZone[]
  /** 目安のみちすじ（tee → … → cup）。ヒントの矢印と「おたすけ」に使う。 */
  route: readonly RoutePoint[]
  /** ホールの はじめに出す ひとこと。 */
  tip: string
}

export type CourseId = 'meadow' | 'beach' | 'moon'

export type CourseLook = {
  felt: string
  wall: string
  wallCap: string
  skirt: string
  sand: string
  ground: string
  sky: string
  horizon: string
  bumper: string
  bumperCap: string
  rock: string
}

export type CourseDefinition = {
  id: CourseId
  label: string
  icon: string
  description: string
  color: string
  gravity: number
  /** 転がり抵抗の係数の倍率。月の砂は重力が小さいぶん転がりにくい。 */
  rollingScale: number
  look: CourseLook
  holes: readonly HoleDefinition[]
}

/** 円弧に沿った角の列。円いアリーナの外周を作るときに使う。角度は +z を0として時計回り。 */
function arc(cx: number, cz: number, radius: number, from: number, to: number, steps: number): Corner[] {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const angle = ((from + ((to - from) * index) / steps) * Math.PI) / 180
    return { x: cx + Math.sin(angle) * radius, z: cz + Math.cos(angle) * radius }
  })
}

function rect(minX: number, minZ: number, maxX: number, maxZ: number, near: number, far: number): Corner[] {
  return [
    { x: minX, z: maxZ, r: near },
    { x: minX, z: minZ, r: far },
    { x: maxX, z: minZ, r: far },
    { x: maxX, z: maxZ, r: near },
  ]
}

const CRATER_R = 3.7
const CRATER_Z = -0.4
const CRATER_JOIN = (Math.asin(1.05 / CRATER_R) * 180) / Math.PI

export const GOLF_COURSES: readonly CourseDefinition[] = [
  {
    id: 'meadow',
    label: 'はらっぱ',
    icon: '🌼',
    description: 'ふうしゃを くぐろう',
    color: '#3f9a4f',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#58b65a', wall: '#c98b55', wallCap: '#f6e7c8', skirt: '#9a6b42', sand: '#eed6a0', ground: '#9fd36e', sky: '#bfe7ff', horizon: '#eef8e0', bumper: '#f06a5b', bumperCap: '#fff4e6', rock: '#9aa3a8' },
    holes: [
      {
        id: 'meadow-1',
        name: 'まっすぐ',
        par: 2,
        tee: { x: 0, z: 4.5 },
        cup: { x: 0, z: -4.1 },
        floors: [{ corners: rect(-1.1, -5.6, 1.1, 5.6, 0.5, 1.0) }],
        features: [{ kind: 'ridge', from: { x: -1.4, z: 0.6 }, to: { x: 1.4, z: 0.6 }, radius: 0.9, height: 0.16 }],
        route: [{ x: 0, z: 4.5 }, { x: 0, z: -4.1 }],
        tip: 'おやまを こえて まっすぐ！',
      },
      {
        id: 'meadow-2',
        name: 'カーブ',
        par: 2,
        tee: { x: 0, z: 4.3 },
        cup: { x: 4.5, z: -2.15 },
        floors: [{
          corners: [
            { x: -1.1, z: 5.4, r: 0.5 },
            { x: -1.1, z: -3.3, r: 1.6 },
            { x: 5.6, z: -3.3, r: 0.7 },
            { x: 5.6, z: -1.0, r: 0.7 },
            { x: 1.1, z: -1.0, r: 0.4 },
            { x: 1.1, z: 5.4, r: 0.5 },
          ],
        }],
        // 曲がり角からカップへの まっすぐな道はあけ、上がわを通るとぽよんと はねる位置に置く。
        gadgets: [{ kind: 'bumper', id: 'mushroom', x: 3.0, z: -1.55, radius: 0.28 }],
        route: [{ x: 0, z: 4.3 }, { x: 0, z: -2.0 }, { x: 4.5, z: -2.15 }],
        tip: 'かべに あてて まがろう',
      },
      {
        id: 'meadow-3',
        name: 'ふうしゃ',
        par: 3,
        tee: { x: 0, z: 4.8 },
        cup: { x: 0, z: -4.4 },
        floors: [{ corners: rect(-1.2, -6.0, 1.2, 6.0, 0.6, 1.1) }],
        gadgets: [{ kind: 'windmill', id: 'windmill', x: 0, z: 0.2, speed: 0.85 }],
        route: [{ x: 0, z: 4.8 }, { x: 0, z: 1.6 }, { x: 0, z: -1.2 }, { x: 0, z: -4.4 }],
        tip: 'はねが とおりすぎたら うとう',
      },
    ],
  },
  {
    id: 'beach',
    label: 'うみべ',
    icon: '🏝️',
    description: 'すなはまと ジャンプ',
    color: '#2f8fb7',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#3fb59a', wall: '#fbfbf4', wallCap: '#4aa3d6', skirt: '#d8c7a0', sand: '#f1dca6', ground: '#f3dfae', sky: '#aee3f5', horizon: '#f5fbf7', bumper: '#ff8fb8', bumperCap: '#fff0f6', rock: '#b9ada0' },
    holes: [
      {
        id: 'beach-1',
        name: 'すなはま',
        par: 2,
        tee: { x: 0.6, z: 3.9 },
        cup: { x: -0.5, z: -3.5 },
        floors: [{ corners: rect(-2.1, -4.8, 2.1, 5.0, 1.6, 1.6) }],
        sand: [{ x: 0.35, z: 0.3, radius: 1.3 }, { x: 1.25, z: -2.7, radius: 0.6 }],
        route: [{ x: 0.6, z: 3.9 }, { x: -1.3, z: 0.4 }, { x: -0.5, z: -3.5 }],
        tip: 'すなばは ころがりにくいよ',
      },
      {
        id: 'beach-2',
        name: 'ジャンプ',
        par: 2,
        tee: { x: 0, z: 4.4 },
        cup: { x: 0, z: -2.9 },
        floors: [
          { corners: [{ x: -1.0, z: 5.4, r: 0.5 }, { x: -1.0, z: 1.0 }, { x: 1.0, z: 1.0 }, { x: 1.0, z: 5.4, r: 0.5 }], open: [1] },
          { corners: [{ x: -1.7, z: -0.3 }, { x: -1.7, z: -5.2, r: 1.0 }, { x: 1.7, z: -5.2, r: 1.0 }, { x: 1.7, z: -0.3 }], y: -0.3, open: [3] },
        ],
        features: [{ kind: 'kicker', from: { x: 0, z: 2.0 }, to: { x: 0, z: 1.0 }, halfWidth: 1.1, rise: 0.3 }],
        route: [{ x: 0, z: 4.4 }, { x: 0, z: 1.2, minPower: 0.8 }, { x: 0, z: -2.9 }],
        tip: 'つよめに うって ジャンプ！',
      },
      {
        id: 'beach-3',
        name: 'なみなみ',
        par: 3,
        tee: { x: -2.1, z: 5.1 },
        cup: { x: 2.1, z: -4.9 },
        floors: [{
          corners: [
            { x: -3.2, z: 6.0, r: 0.6 },
            { x: -1.0, z: 6.0, r: 0.6 },
            { x: -1.0, z: 1.0, r: 0.5 },
            { x: 3.2, z: 1.0, r: 1.5 },
            { x: 3.2, z: -6.0, r: 0.6 },
            { x: 1.0, z: -6.0, r: 0.6 },
            { x: 1.0, z: -1.2, r: 0.5 },
            { x: -3.2, z: -1.2, r: 1.5 },
          ],
        }],
        features: [
          { kind: 'ridge', from: { x: -3.4, z: 3.7 }, to: { x: -0.8, z: 3.7 }, radius: 0.45, height: 0.1 },
          { kind: 'ridge', from: { x: -3.4, z: 2.5 }, to: { x: -0.8, z: 2.5 }, radius: 0.45, height: 0.1 },
          { kind: 'ridge', from: { x: 0.8, z: -3.2 }, to: { x: 3.4, z: -3.2 }, radius: 0.45, height: 0.1 },
        ],
        gadgets: [{ kind: 'bumper', id: 'jellyfish', x: 0, z: -0.1, radius: 0.3 }],
        route: [{ x: -2.1, z: 5.1 }, { x: -2.0, z: -0.1 }, { x: 0, z: 0.45 }, { x: 2.1, z: -0.2 }, { x: 2.1, z: -4.9 }],
        tip: 'くらげを よけて くねくね',
      },
    ],
  },
  {
    id: 'moon',
    label: 'おつきさま',
    icon: '🌙',
    description: 'ふわふわ とぶ ボール',
    color: '#6f5fc7',
    gravity: EARTH_GRAVITY / 3,
    rollingScale: 3,
    look: { felt: '#7d8ee0', wall: '#e9ecff', wallCap: '#ffd66b', skirt: '#8e8aa8', sand: '#c9c3d9', ground: '#bdbccb', sky: '#1d2352', horizon: '#3a4480', bumper: '#7ee0d2', bumperCap: '#fff8c7', rock: '#a29fb3' },
    holes: [
      {
        id: 'moon-1',
        name: 'ふわふわ おやま',
        par: 2,
        tee: { x: 0, z: 4.9 },
        cup: { x: 0, z: -4.6 },
        floors: [{ corners: rect(-1.3, -6.0, 1.3, 6.0, 0.6, 1.2) }],
        features: [
          { kind: 'bump', x: 0, z: 2.4, radius: 1.1, height: 0.34 },
          { kind: 'bump', x: 0, z: -0.5, radius: 1.1, height: 0.34 },
        ],
        route: [{ x: 0, z: 4.9 }, { x: 0, z: -4.6 }],
        tip: 'ボールが ふわっと とぶよ',
      },
      {
        id: 'moon-2',
        name: 'クレーター',
        par: 2,
        tee: { x: 0, z: 5.6 },
        cup: { x: 0, z: CRATER_Z },
        floors: [{
          corners: [
            { x: -1.05, z: 6.6, r: 0.5 },
            { x: -1.05, z: CRATER_Z + Math.sqrt(CRATER_R ** 2 - 1.05 ** 2), r: 0.35 },
            ...arc(0, CRATER_Z, CRATER_R, -CRATER_JOIN - 15, CRATER_JOIN - 345, 20),
            { x: 1.05, z: CRATER_Z + Math.sqrt(CRATER_R ** 2 - 1.05 ** 2), r: 0.35 },
            { x: 1.05, z: 6.6, r: 0.5 },
          ],
        }],
        features: [{ kind: 'bump', x: 0, z: CRATER_Z, radius: 2.4, height: -0.5 }],
        gadgets: [{ kind: 'rock', id: 'moon-rock', x: 0, z: 2.2, radius: 0.36 }],
        route: [{ x: 0, z: 5.6 }, { x: -0.8, z: 2.4 }, { x: 0, z: CRATER_Z }],
        tip: 'いわを よけると すいこまれるよ',
      },
      {
        id: 'moon-3',
        name: 'ロケット',
        par: 2,
        tee: { x: 0, z: 7.3 },
        cup: { x: 0.75, z: -5.5 },
        floors: [
          { corners: [{ x: -1.1, z: 8.2, r: 0.5 }, { x: -1.1, z: 2.0 }, { x: 1.1, z: 2.0 }, { x: 1.1, z: 8.2, r: 0.5 }], open: [1] },
          { corners: [{ x: -1.9, z: -1.4 }, { x: -1.9, z: -8.4, r: 1.2 }, { x: 1.9, z: -8.4, r: 1.2 }, { x: 1.9, z: -1.4 }], y: -0.3, open: [3] },
        ],
        features: [{ kind: 'kicker', from: { x: 0, z: 3.3 }, to: { x: 0, z: 2.0 }, halfWidth: 1.2, rise: 0.5 }],
        gadgets: [
          { kind: 'booster', id: 'dash', x: 0, z: 4.7, dir: { x: 0, z: -1 }, speed: 4.6 },
          { kind: 'bumper', id: 'ufo-left', x: -1.05, z: -7.3, radius: 0.3 },
          { kind: 'bumper', id: 'ufo-right', x: 1.05, z: -7.3, radius: 0.3 },
        ],
        route: [{ x: 0, z: 7.3 }, { x: 0, z: 4.7, minPower: 0.35 }, { x: 0, z: -3.2 }, { x: 0.75, z: -5.5 }],
        tip: 'ダッシュパネルで びゅーん！',
      },
    ],
  },
]

export const GOLF_BALLS = [
  { id: 'white', label: 'しろ', color: '#fbfbf7', accent: '#ff6f61' },
  { id: 'pink', label: 'ピンク', color: '#ff9cc2', accent: '#ffffff' },
  { id: 'yellow', label: 'きいろ', color: '#ffd84d', accent: '#ff8a3d' },
  { id: 'sky', label: 'みずいろ', color: '#7fd3ff', accent: '#2f6fd6' },
] as const

export type GolfBallId = (typeof GOLF_BALLS)[number]['id']

export function findCourse(id: string): CourseDefinition | undefined {
  return GOLF_COURSES.find(course => course.id === id)
}
