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
  /**
   * 行ったり来たりする うごくカベ。中心 (x,z) から axis の向きへ ±span うごく。
   * 真ん中に寄っても左右に すきまが残る幅にして、いつかは通れるようにする。
   */
  | { kind: 'gate'; id: string; x: number; z: number; axis: Vec2; span: number; speed: number; halfWidth: number }
  /** (x,z) と to のあいだを 行ったり来たり歩く どうぶつ。ぶつかると ぽよんと はねる。 */
  | { kind: 'critter'; id: string; x: number; z: number; to: Vec2; speed: number; look: CritterLook }
  /** 入ると exit から exitDir の向きへ出てくる どかん。2つ向かい合わせに置くと行き来できる。 */
  | { kind: 'warp'; id: string; x: number; z: number; radius: number; exit: Vec2; exitDir: Vec2 }

export type CritterLook = 'duck' | 'crab' | 'alien' | 'penguin' | 'dino'

/** ゆかの ちがう ところ。すなば・こおり・ふかふか。 */
export type ZoneKind = 'sand' | 'ice' | 'rough'
export type SurfaceZone = { kind: ZoneKind; x: number; z: number; radius: number }

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
  zones?: readonly SurfaceZone[]
  /** 目安のみちすじ（tee → … → cup）。ヒントの矢印と「おたすけ」に使う。 */
  route: readonly RoutePoint[]
  /** ホールの はじめに出す ひとこと。 */
  tip: string
}

/** コースの並び順。★の保存やコース選びは、この一覧を正とする。 */
export const COURSE_IDS = ['meadow', 'beach', 'moon', 'snow', 'candy', 'dino'] as const
export type CourseId = (typeof COURSE_IDS)[number]

export type CourseLook = {
  felt: string
  wall: string
  wallCap: string
  skirt: string
  sand: string
  ice: string
  rough: string
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
    look: { felt: '#58b65a', wall: '#c98b55', wallCap: '#f6e7c8', skirt: '#9a6b42', sand: '#eed6a0', ice: '#cfeaf7', rough: '#3d8a48', ground: '#9fd36e', sky: '#bfe7ff', horizon: '#eef8e0', bumper: '#f06a5b', bumperCap: '#fff4e6', rock: '#9aa3a8' },
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
      {
        id: 'meadow-4',
        name: 'かもさん',
        par: 3,
        tee: { x: 0, z: 5.2 },
        cup: { x: 0, z: -5.0 },
        floors: [{ corners: rect(-1.7, -6.2, 1.7, 6.2, 0.6, 1.1) }],
        features: [{ kind: 'bump', x: -1.0, z: -2.6, radius: 1.1, height: 0.18 }],
        gadgets: [{ kind: 'critter', id: 'duck', x: -1.2, z: 1.0, to: { x: 1.2, z: 1.0 }, speed: 1.2, look: 'duck' }],
        route: [{ x: 0, z: 5.2 }, { x: 0.5, z: -1.4 }, { x: 0, z: -5.0 }],
        tip: 'かもさんが とおりすぎたら うとう',
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
    look: { felt: '#3fb59a', wall: '#fbfbf4', wallCap: '#4aa3d6', skirt: '#d8c7a0', sand: '#f1dca6', ice: '#d7f3f9', rough: '#2f9a86', ground: '#f3dfae', sky: '#aee3f5', horizon: '#f5fbf7', bumper: '#ff8fb8', bumperCap: '#fff0f6', rock: '#b9ada0' },
    holes: [
      {
        id: 'beach-1',
        name: 'すなはま',
        par: 2,
        tee: { x: 0.6, z: 3.9 },
        cup: { x: -0.5, z: -3.5 },
        floors: [{ corners: rect(-2.1, -4.8, 2.1, 5.0, 1.6, 1.6) }],
        zones: [{ kind: 'sand', x: 0.35, z: 0.3, radius: 1.3 }, { kind: 'sand', x: 1.25, z: -2.7, radius: 0.6 }],
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
      {
        id: 'beach-4',
        name: 'どかん',
        par: 3,
        tee: { x: 0, z: 5.2 },
        cup: { x: 2.7, z: -4.6 },
        floors: [
          { corners: rect(-1.7, 1.2, 1.7, 6.2, 0.6, 1.0) },
          { corners: rect(1.0, -5.8, 4.4, -0.6, 0.9, 1.0) },
        ],
        // 2つの どかんは 向かい合わせ。入った どかんの むこうから 同じ 勢いで 出てくる。
        gadgets: [
          { kind: 'warp', id: 'pipe-in', x: 0, z: 2.2, radius: 0.42, exit: { x: 2.7, z: -1.4 }, exitDir: { x: 0, z: -1 } },
          { kind: 'warp', id: 'pipe-out', x: 2.7, z: -1.4, radius: 0.42, exit: { x: 0, z: 2.2 }, exitDir: { x: 0, z: 1 } },
        ],
        zones: [{ kind: 'sand', x: 1.6, z: -3.4, radius: 0.8 }],
        route: [{ x: 0, z: 5.2 }, { x: 0, z: 2.2, minPower: 0.6 }, { x: 2.7, z: -1.4 }, { x: 2.7, z: -4.6 }],
        tip: 'どかんに いれると むこうがわへ！',
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
    look: { felt: '#7d8ee0', wall: '#e9ecff', wallCap: '#ffd66b', skirt: '#8e8aa8', sand: '#c9c3d9', ice: '#bcd8ff', rough: '#5d67a8', ground: '#bdbccb', sky: '#1d2352', horizon: '#3a4480', bumper: '#7ee0d2', bumperCap: '#fff8c7', rock: '#a29fb3' },
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
      {
        id: 'moon-4',
        name: 'じどう とびら',
        par: 3,
        tee: { x: 0, z: 5.8 },
        cup: { x: 0, z: -5.6 },
        floors: [{ corners: rect(-1.7, -6.6, 1.7, 6.6, 0.6, 1.1) }],
        // 2まいの とびらは 速さが ちがうので、同じ ならびに ならない。
        // とびらは、まん中に よっても 左右に すきまが のこり、はしに よると まん中が あく幅にする。
        gadgets: [
          { kind: 'gate', id: 'door-a', x: 0, z: 2.4, axis: { x: 1, z: 0 }, span: 1.15, speed: 0.9, halfWidth: 0.55 },
          { kind: 'gate', id: 'door-b', x: 0, z: -1.8, axis: { x: 1, z: 0 }, span: 1.15, speed: 1.35, halfWidth: 0.55 },
        ],
        route: [{ x: 0, z: 5.8 }, { x: 0, z: 0.6 }, { x: 0, z: -5.6 }],
        tip: 'とびらの あいた ほうを ねらおう',
      },
    ],
  },
  {
    id: 'snow',
    label: 'ゆきやま',
    icon: '⛄',
    description: 'つるつる すべる こおり',
    color: '#4f86c6',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#dce9f7', wall: '#cfe3f5', wallCap: '#8fc4e8', skirt: '#a3b6cc', sand: '#e6eef8', ice: '#b6e6f7', rough: '#b9cde3', ground: '#f0f6ff', sky: '#bcdcff', horizon: '#ffffff', bumper: '#e35b6d', bumperCap: '#fdfdff', rock: '#9fb0c2' },
    holes: [
      {
        id: 'snow-1',
        name: 'つるつる',
        par: 2,
        tee: { x: 0, z: 4.6 },
        cup: { x: 0, z: -4.4 },
        floors: [{ corners: rect(-1.2, -5.8, 1.2, 5.8, 0.5, 1.0) }],
        zones: [{ kind: 'ice', x: 0, z: 0.4, radius: 1.6 }],
        route: [{ x: 0, z: 4.6 }, { x: 0, z: -4.4 }],
        tip: 'こおりの うえは よく すべるよ',
      },
      {
        id: 'snow-2',
        name: 'ふかふか',
        par: 3,
        tee: { x: 1.4, z: 4.2 },
        cup: { x: -1.2, z: -3.6 },
        floors: [{ corners: rect(-2.3, -4.8, 2.3, 5.2, 1.4, 1.4) }],
        zones: [
          { kind: 'rough', x: -0.6, z: 0.8, radius: 1.4 },
          { kind: 'rough', x: -1.6, z: -1.8, radius: 0.8 },
        ],
        gadgets: [
          { kind: 'bumper', id: 'snowman', x: 0.9, z: -2.4, radius: 0.3 },
          { kind: 'critter', id: 'penguin', x: 1.9, z: 2.0, to: { x: -1.9, z: 2.0 }, speed: 0.95, look: 'penguin' },
        ],
        route: [{ x: 1.4, z: 4.2 }, { x: 1.5, z: 0 }, { x: -1.2, z: -3.6 }],
        tip: 'ふかふかの ゆきは とまりやすいよ',
      },
      {
        id: 'snow-3',
        name: 'そり ジャンプ',
        par: 3,
        tee: { x: 0, z: 4.8 },
        cup: { x: 0, z: -4.4 },
        floors: [
          { corners: [{ x: -1.1, z: 5.8, r: 0.5 }, { x: -1.1, z: 1.2 }, { x: 1.1, z: 1.2 }, { x: 1.1, z: 5.8, r: 0.5 }], open: [1] },
          { corners: [{ x: -1.8, z: -0.4 }, { x: -1.8, z: -5.4, r: 1.0 }, { x: 1.8, z: -5.4, r: 1.0 }, { x: 1.8, z: -0.4 }], y: -0.3, open: [3] },
        ],
        features: [{ kind: 'kicker', from: { x: 0, z: 2.4 }, to: { x: 0, z: 1.2 }, halfWidth: 1.1, rise: 0.32 }],
        zones: [{ kind: 'ice', x: 0, z: -2.0, radius: 1.5 }],
        route: [{ x: 0, z: 4.8 }, { x: 0, z: 1.4, minPower: 0.82 }, { x: 0, z: -4.4 }],
        tip: 'つよく うって ジャンプ！',
      },
      {
        id: 'snow-4',
        name: 'こおりの トンネル',
        par: 3,
        tee: { x: -1.6, z: 4.8 },
        cup: { x: 1.6, z: 4.2 },
        floors: [
          { corners: rect(-2.6, -5.4, -0.6, 5.8, 0.6, 1.0) },
          { corners: rect(0.6, -5.4, 2.6, 5.8, 0.6, 1.0) },
        ],
        gadgets: [
          { kind: 'warp', id: 'tunnel-in', x: -1.6, z: -4.2, radius: 0.42, exit: { x: 1.6, z: -4.2 }, exitDir: { x: 0, z: 1 } },
          { kind: 'warp', id: 'tunnel-out', x: 1.6, z: -4.2, radius: 0.42, exit: { x: -1.6, z: -4.2 }, exitDir: { x: 0, z: 1 } },
        ],
        zones: [{ kind: 'ice', x: 1.6, z: 0.4, radius: 1.5 }],
        route: [{ x: -1.6, z: 4.8 }, { x: -1.6, z: -1.0 }, { x: -1.6, z: -4.2, minPower: 0.45 }, { x: 1.6, z: -4.2 }, { x: 1.6, z: 4.2 }],
        tip: 'トンネルで むこうの みちへ',
      },
    ],
  },
  {
    id: 'candy',
    label: 'おかしのくに',
    icon: '🍩',
    description: 'ひろい おさらを まわろう',
    color: '#e2649b',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#8fe0c4', wall: '#fff1dc', wallCap: '#ff9ec4', skirt: '#7a4a30', sand: '#f4d79f', ice: '#cdf1ff', rough: '#ffe0ef', ground: '#ffe3c2', sky: '#ffd6ec', horizon: '#fff6ea', bumper: '#ff5f9e', bumperCap: '#fff7d8', rock: '#8a5a3c' },
    holes: [
      {
        id: 'candy-1',
        name: 'クリームの おさら',
        par: 2,
        tee: { x: -2.4, z: 2.4 },
        cup: { x: 2.4, z: -2.4 },
        // 正方形の おさら。まん中の クリームは ころがりにくいので、ふちを まわって ななめに わたる。
        floors: [{ corners: rect(-3.4, -3.4, 3.4, 3.4, 1.1, 1.1) }],
        zones: [{ kind: 'rough', x: 0, z: 0, radius: 1.55 }],
        gadgets: [{ kind: 'bumper', id: 'gumdrop', x: -2.1, z: -2.1, radius: 0.3 }],
        route: [{ x: -2.4, z: 2.4 }, { x: 2.35, z: 2.25 }, { x: 2.4, z: -2.4 }],
        tip: 'クリームを よけて まわろう',
      },
      {
        id: 'candy-2',
        name: 'グミの ひろば',
        par: 3,
        tee: { x: 0, z: 2.9 },
        cup: { x: 0, z: -0.6 },
        // 正方形の ひろばの まん中に カップ。4つの グミが かこんでいて、ななめの すきまから ねらう。
        floors: [{ corners: rect(-3.5, -3.5, 3.5, 3.5, 1.2, 1.2) }],
        gadgets: [
          { kind: 'bumper', id: 'gum-n', x: 0, z: 0.6, radius: 0.3 },
          { kind: 'bumper', id: 'gum-e', x: 1.2, z: -0.6, radius: 0.3 },
          { kind: 'bumper', id: 'gum-s', x: 0, z: -1.8, radius: 0.3 },
          { kind: 'bumper', id: 'gum-w', x: -1.2, z: -0.6, radius: 0.3 },
        ],
        route: [{ x: 0, z: 2.9 }, { x: 1.5, z: 0.8 }, { x: 0, z: -0.6 }],
        tip: 'グミの あいだを ぬけよう',
      },
      {
        id: 'candy-3',
        name: 'ぐるっと まわりみち',
        par: 3,
        tee: { x: -2.55, z: 3.7 },
        cup: { x: 2.55, z: 3.3 },
        // コの字。まん中は かべなので、下を ぐるっと まわって となりの みちへ。
        floors: [{
          corners: [
            { x: -3.3, z: 4.6, r: 0.7 },
            { x: -3.3, z: -4.6, r: 1.1 },
            { x: 3.3, z: -4.6, r: 1.1 },
            { x: 3.3, z: 4.6, r: 0.7 },
            { x: 1.2, z: 4.6, r: 0.7 },
            { x: 1.2, z: -2.4, r: 0.9 },
            { x: -1.2, z: -2.4, r: 0.9 },
            { x: -1.2, z: 4.6, r: 0.7 },
          ],
        }],
        zones: [
          { kind: 'rough', x: -1.55, z: 0.6, radius: 0.72 },
          { kind: 'rough', x: 1.55, z: -0.4, radius: 0.72 },
        ],
        gadgets: [{ kind: 'bumper', id: 'gumdrop-mid', x: 0, z: -2.9, radius: 0.28 }],
        route: [{ x: -2.55, z: 3.7 }, { x: -2.55, z: -3.5 }, { x: 2.55, z: -3.5 }, { x: 2.55, z: 3.3 }],
        tip: 'かべの そとがわを ぐるっと！',
      },
      {
        id: 'candy-4',
        name: 'いちごの とびら',
        par: 3,
        tee: { x: -0.9, z: 4.0 },
        cup: { x: 0.9, z: -4.0 },
        // ふたつの へやを ほそい みちで つないだ かたち。みちの まん中を いちごの とびらが 行き来する。
        floors: [{
          corners: [
            { x: -1.95, z: 5.1, r: 0.8 },
            { x: -1.95, z: 1.25, r: 0.55 },
            { x: -1.0, z: 1.25, r: 0.45 },
            { x: -1.0, z: -1.25, r: 0.45 },
            { x: -1.95, z: -1.25, r: 0.55 },
            { x: -1.95, z: -5.1, r: 0.8 },
            { x: 1.95, z: -5.1, r: 0.8 },
            { x: 1.95, z: -1.25, r: 0.55 },
            { x: 1.0, z: -1.25, r: 0.45 },
            { x: 1.0, z: 1.25, r: 0.45 },
            { x: 1.95, z: 1.25, r: 0.55 },
            { x: 1.95, z: 5.1, r: 0.8 },
          ],
        }],
        gadgets: [{ kind: 'gate', id: 'strawberry-gate', x: 0, z: 0, axis: { x: 1, z: 0 }, span: 0.62, speed: 1.05, halfWidth: 0.5 }],
        route: [{ x: -0.9, z: 4.0 }, { x: 0, z: 1.8 }, { x: 0, z: -1.8 }, { x: 0.9, z: -4.0 }],
        tip: 'とびらの あいた ほうを ぬけよう',
      },
    ],
  },
  {
    id: 'dino',
    label: 'きょうりゅう',
    icon: '🦕',
    description: 'いわと どろの みち',
    color: '#c1672f',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#8cbc5b', wall: '#b4623c', wallCap: '#f0c98a', skirt: '#7a3f28', sand: '#e8c08a', ice: '#bfe6f0', rough: '#9a7a4a', ground: '#c98a5c', sky: '#ffcf93', horizon: '#ffeccb', bumper: '#cf7a4e', bumperCap: '#fff0cf', rock: '#a9705a' },
    holes: [
      {
        id: 'dino-1',
        name: 'いわの みち',
        par: 2,
        tee: { x: -2.0, z: 4.2 },
        cup: { x: 2.0, z: -4.2 },
        // ななめに はしる みち。まん中の いわを よけて、のこりを ななめに わたる。
        floors: [{
          corners: [
            { x: -1.26, z: 5.66, r: 0.9 },
            { x: -3.6, z: 4.54, r: 0.9 },
            { x: 1.26, z: -5.66, r: 0.9 },
            { x: 3.6, z: -4.54, r: 0.9 },
          ],
        }],
        gadgets: [
          { kind: 'rock', id: 'rock-mid', x: -0.76, z: 1.6, radius: 0.34 },
          { kind: 'rock', id: 'rock-side', x: 1.33, z: -0.59, radius: 0.3 },
        ],
        route: [{ x: -2.0, z: 4.2 }, { x: -1.35, z: 1.35 }, { x: 2.0, z: -4.2 }],
        tip: 'いわを よけて ななめに すすもう',
      },
      {
        id: 'dino-2',
        name: 'どろんこ ひろば',
        par: 3,
        tee: { x: 0, z: 4.3 },
        cup: { x: -2.6, z: -3.4 },
        // Tの字。ほそい みちを おりると、ひろい ひろばで きょうりゅうが さんぽしている。
        floors: [{
          corners: [
            { x: -1.15, z: 5.2, r: 0.6 },
            { x: -1.15, z: -1.0, r: 0.5 },
            { x: -3.7, z: -1.0, r: 0.7 },
            { x: -3.7, z: -4.6, r: 1.0 },
            { x: 3.7, z: -4.6, r: 1.0 },
            { x: 3.7, z: -1.0, r: 0.7 },
            { x: 1.15, z: -1.0, r: 0.5 },
            { x: 1.15, z: 5.2, r: 0.6 },
          ],
        }],
        zones: [
          { kind: 'rough', x: 1.7, z: -2.3, radius: 1.15 },
          { kind: 'rough', x: -0.1, z: -4.2, radius: 0.85 },
        ],
        gadgets: [{ kind: 'critter', id: 'dino-walk', x: 2.9, z: -3.7, to: { x: -1.0, z: -3.7 }, speed: 0.8, look: 'dino' }],
        route: [{ x: 0, z: 4.3 }, { x: 0, z: -2.0 }, { x: -2.6, z: -3.4 }],
        tip: 'きょうりゅうが とおりすぎたら うとう',
      },
      {
        id: 'dino-3',
        name: 'いわの とびら',
        par: 3,
        tee: { x: 0, z: 3.6 },
        cup: { x: -1.5, z: -1.8 },
        // ひし形の ひろば。おおきな いわの とびらが 行き来して、あいた ほうだけ とおれる。
        floors: [{
          corners: [
            { x: 0, z: 5.4, r: 1.3 },
            { x: -4.2, z: 0, r: 1.3 },
            { x: 0, z: -5.4, r: 1.3 },
            { x: 4.2, z: 0, r: 1.3 },
          ],
        }],
        zones: [{ kind: 'rough', x: 1.7, z: -2.4, radius: 1.0 }],
        gadgets: [{ kind: 'gate', id: 'boulder', x: -0.7, z: 0.9, axis: { x: 1, z: 0 }, span: 1.5, speed: 0.95, halfWidth: 1.25 }],
        route: [{ x: 0, z: 3.6 }, { x: -0.5, z: 2.0 }, { x: -1.5, z: -1.8 }],
        tip: 'とびらの あいた ほうへ',
      },
      {
        id: 'dino-4',
        name: 'おやまの むこう',
        par: 3,
        tee: { x: 0, z: 3.8 },
        cup: { x: 0, z: -3.6 },
        // まん中の おやまは のぼれない。いわを よけて、ひがしがわを まわって むこうがわへ。
        floors: [{ corners: rect(-3.8, -4.8, 3.8, 4.8, 1.3, 1.3) }],
        features: [{ kind: 'bump', x: 0, z: 0, radius: 2.4, height: 0.38 }],
        zones: [{ kind: 'rough', x: -2.7, z: 0.2, radius: 1.0 }],
        gadgets: [
          { kind: 'rock', id: 'rock-n', x: -0.15, z: 1.95, radius: 0.38 },
          { kind: 'rock', id: 'rock-s', x: 0.3, z: -1.95, radius: 0.38 },
          { kind: 'critter', id: 'dino-big', x: 2.55, z: 1.7, to: { x: 2.55, z: -1.3 }, speed: 0.7, look: 'dino' },
        ],
        route: [{ x: 0, z: 3.8 }, { x: 3.2, z: -0.2 }, { x: 0, z: -3.6 }],
        tip: 'おやまの そとがわを まわろう',
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
