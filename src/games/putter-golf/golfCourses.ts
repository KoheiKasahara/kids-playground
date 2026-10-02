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
  /**
   * さか。from で0、to で drop ぶん下がり、その先は下がったまま。
   * コースの はばいっぱいに きくので、短くすれば だんさ、長くすれば ゆるい さかになる。
   */
  | { kind: 'slope'; from: Vec2; to: Vec2; drop: number }

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
  /** コースに はえた き。みきに あたると こつんと はねかえる。radius は みきの太さ。 */
  | { kind: 'tree'; id: string; x: number; z: number; radius: number; look: TreeLook }
  /**
   * かわや たにを わたる はし。dir の向きに ±halfLength、よこ ±halfWidth。
   * はしの上は みずに おちない。rails なら 両がわに てすり（カベ）が付き、なければ おちられる。
   * たにを わたる はしは、はしの形の ゆかも いっしょに置く（はしは 見た目と てすりだけ）。
   */
  | { kind: 'bridge'; id: string; x: number; z: number; dir: Vec2; halfLength: number; halfWidth: number; rails: boolean }
  /**
   * ボールを はねかえす いた。(x,z) を中心に dir の向きへ ±halfLength のびる。
   * かべと ちがい、当たっても いきおいが ほとんど へらないので、ラフや いけを よけて まがれる。
   */
  | { kind: 'reflector'; id: string; x: number; z: number; dir: Vec2; halfLength: number }

export type CritterLook = 'duck' | 'crab' | 'alien' | 'penguin' | 'dino' | 'squirrel' | 'sheep'
/** きの見た目。とがった もみの木と、まるい 広葉樹。 */
export type TreeLook = 'pine' | 'broadleaf'

/** ゆかの ちがう ところ。すなば・こおり・ふかふか。 */
export type ZoneKind = 'sand' | 'ice' | 'rough'
export type SurfaceZone = { kind: ZoneKind; x: number; z: number; radius: number }

/** みず。ころがって はいると ぽちゃんと おちて、うつ前の ばしょへ もどる。とんでいる ボールは おちない。 */
export type WaterHazard =
  /** まるい いけ。 */
  | { kind: 'pond'; x: number; z: number; radius: number }
  /** まっすぐな かわ。from→to の線から halfWidth までが みずで、はしは しかく。 */
  | { kind: 'river'; from: Vec2; to: Vec2; halfWidth: number }

/**
 * みちすじの点。minPower は「ここを通るなら最低この強さ」（ジャンプ台の手前など）。
 * bank は はねかえし いたの手前の点。ここを ねらうと いたで はねて、つぎの点まで すすむ。
 */
export type RoutePoint = Vec2 & { minPower?: number; bank?: boolean }

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
  water?: readonly WaterHazard[]
  /** 目安のみちすじ（tee → … → cup）。ヒントの矢印と「おたすけ」に使う。 */
  route: readonly RoutePoint[]
  /** ホールの はじめに出す ひとこと。 */
  tip: string
}

/** コースの並び順。★の保存やコース選びは、この一覧を正とする。 */
export const COURSE_IDS = ['meadow', 'beach', 'moon', 'snow', 'candy', 'dino', 'forest', 'downhill', 'river', 'canyon'] as const
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
  {
    id: 'forest',
    label: 'もり',
    icon: '🌲',
    description: 'きを よけて すすもう',
    color: '#2e6f3c',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#5cb05a', wall: '#8d6242', wallCap: '#e8d3a8', skirt: '#5f4028', sand: '#e6d2a4', ice: '#cfe9f5', rough: '#3d7f45', ground: '#4f7f46', sky: '#a8dcf2', horizon: '#dff1dd', bumper: '#c97f3f', bumperCap: '#ffeccd', rock: '#8f978e' },
    holes: [
      {
        id: 'forest-1',
        name: 'もりの みち',
        par: 4,
        tee: { x: 0, z: 9.8 },
        cup: { x: -0.5, z: -10.0 },
        // 正方形のコースを たてに3つ ならべたくらいの 長い みち。きが 左右 かわりばんこに 立っていて、
        // まっすぐ カップまでは 見通せない。
        floors: [{ corners: rect(-3.4, -11.2, 3.4, 11.2, 1.2, 1.2) }],
        gadgets: [
          { kind: 'tree', id: 'oak-mid', x: 0.45, z: 6.2, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'pine-w', x: -2.7, z: 6.6, radius: 0.38, look: 'pine' },
          { kind: 'tree', id: 'pine-e', x: 3.0, z: 5.8, radius: 0.4, look: 'pine' },
          { kind: 'tree', id: 'oak-w', x: -1.5, z: 1.0, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'oak-e', x: 1.7, z: 0.4, radius: 0.45, look: 'broadleaf' },
          { kind: 'tree', id: 'pine-far', x: 3.3, z: 0.8, radius: 0.34, look: 'pine' },
          { kind: 'tree', id: 'oak-low', x: -0.2, z: -4.6, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'pine-low', x: 2.9, z: -5.2, radius: 0.4, look: 'pine' },
          { kind: 'tree', id: 'pine-cup', x: 1.4, z: -8.6, radius: 0.42, look: 'pine' },
        ],
        zones: [
          { kind: 'rough', x: -2.6, z: -2.0, radius: 0.9 },
          { kind: 'rough', x: 2.4, z: -9.0, radius: 0.9 },
        ],
        route: [{ x: 0, z: 9.8 }, { x: -1.2, z: 6.4 }, { x: 0.1, z: 0.6 }, { x: -1.6, z: -4.8 }, { x: -0.5, z: -10.0 }],
        tip: 'きの あいだを ぬけて いこう',
      },
      {
        id: 'forest-2',
        name: 'きの ひろば',
        par: 3,
        tee: { x: -4.2, z: 5.4 },
        cup: { x: 4.2, z: -5.4 },
        // とても ひろい ひろば。まん中の きの かたまりは とおれないので、そとがわを まわる。
        floors: [{ corners: rect(-5.6, -7.0, 5.6, 7.0, 1.6, 1.6) }],
        gadgets: [
          { kind: 'tree', id: 'grove-n', x: -0.6, z: 2.8, radius: 0.4, look: 'pine' },
          { kind: 'tree', id: 'grove-ne', x: 1.6, z: 2.2, radius: 0.45, look: 'broadleaf' },
          { kind: 'tree', id: 'grove-mid', x: 0, z: 1.2, radius: 0.55, look: 'broadleaf' },
          { kind: 'tree', id: 'grove-w', x: -1.2, z: -0.4, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'grove-e', x: 1.3, z: -1.0, radius: 0.5, look: 'pine' },
          { kind: 'tree', id: 'grove-s', x: 0.2, z: -2.9, radius: 0.45, look: 'broadleaf' },
          { kind: 'critter', id: 'squirrel', x: -2.6, z: 3.4, to: { x: -2.6, z: -2.6 }, speed: 1.1, look: 'squirrel' },
        ],
        zones: [
          { kind: 'rough', x: -2.8, z: -5.0, radius: 1.0 },
          { kind: 'rough', x: 3.4, z: 1.6, radius: 1.1 },
        ],
        route: [{ x: -4.2, z: 5.4 }, { x: -4.0, z: -1.0 }, { x: 0.6, z: -5.6 }, { x: 4.2, z: -5.4 }],
        tip: 'まん中の きを よけて ぐるっと',
      },
      {
        id: 'forest-3',
        name: 'まるたの かど',
        par: 4,
        tee: { x: 0, z: 9.8 },
        cup: { x: 7.6, z: -5.4 },
        // Lの字の 大きな もり。ながい みちを おりて、かどを まがった おくに カップ。
        floors: [{
          corners: [
            { x: -3.2, z: 11.4, r: 1.2 },
            { x: -3.2, z: -8.0, r: 1.4 },
            { x: 9.0, z: -8.0, r: 1.4 },
            { x: 9.0, z: -2.6, r: 1.2 },
            { x: 3.2, z: -2.6, r: 1.0 },
            { x: 3.2, z: 11.4, r: 1.2 },
          ],
        }],
        gadgets: [
          { kind: 'tree', id: 'top-e', x: 1.4, z: 7.0, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'top-w', x: -2.6, z: 6.6, radius: 0.4, look: 'pine' },
          { kind: 'tree', id: 'mid-e', x: 0.9, z: 2.2, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'mid-w', x: -2.9, z: 1.4, radius: 0.36, look: 'pine' },
          { kind: 'tree', id: 'corner', x: 4.0, z: -3.4, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'end-s', x: 5.6, z: -6.8, radius: 0.45, look: 'pine' },
          { kind: 'tree', id: 'end-n', x: 6.6, z: -3.4, radius: 0.45, look: 'pine' },
        ],
        zones: [{ kind: 'rough', x: -2.2, z: -5.4, radius: 1.2 }],
        route: [{ x: 0, z: 9.8 }, { x: -1.0, z: 4.4 }, { x: 0.8, z: -1.0 }, { x: 2.2, z: -5.4 }, { x: 7.6, z: -5.4 }],
        tip: 'かどを まがって おくの カップへ',
      },
      {
        id: 'forest-4',
        name: 'もりの おく',
        par: 4,
        tee: { x: 0, z: 12.2 },
        cup: { x: 0, z: -12.4 },
        // いちばん ながい みち。正方形のコース4つぶんの ながさを、4つの きの もんを ぬけて すすむ。
        floors: [{ corners: rect(-3.4, -13.6, 3.4, 13.6, 1.2, 1.2) }],
        gadgets: [
          { kind: 'tree', id: 'gate1-mid', x: 0.5, z: 9.0, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'gate1-w', x: -3.1, z: 9.4, radius: 0.34, look: 'pine' },
          { kind: 'tree', id: 'gate2-e', x: 1.2, z: 2.6, radius: 0.5, look: 'pine' },
          { kind: 'tree', id: 'gate2-w', x: -2.9, z: 2.0, radius: 0.4, look: 'broadleaf' },
          { kind: 'tree', id: 'gate3-mid', x: -1.2, z: -5.0, radius: 0.5, look: 'broadleaf' },
          { kind: 'tree', id: 'gate3-e', x: 3.0, z: -5.4, radius: 0.4, look: 'pine' },
          { kind: 'tree', id: 'gate4-w', x: -1.9, z: -10.4, radius: 0.45, look: 'pine' },
          { kind: 'tree', id: 'gate4-e', x: 2.4, z: -10.8, radius: 0.4, look: 'broadleaf' },
        ],
        zones: [
          { kind: 'rough', x: 2.6, z: 6.2, radius: 1.0 },
          { kind: 'rough', x: -2.8, z: -7.6, radius: 1.0 },
        ],
        route: [{ x: 0, z: 12.2 }, { x: -1.5, z: 5.6 }, { x: 1.4, z: -2.0 }, { x: -1.0, z: -8.6 }, { x: 0, z: -12.4 }],
        tip: 'もんを ぬけて どこまでも すすもう',
      },
    ],
  },
  {
    id: 'downhill',
    label: 'くだりざか',
    icon: '⛰️',
    description: 'たかだいから おりよう',
    color: '#2f9c8e',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#74c46a', wall: '#c08f5e', wallCap: '#ffe7b4', skirt: '#7b5334', sand: '#ecd7a2', ice: '#cbeaf7', rough: '#4c9457', ground: '#8cc76a', sky: '#a6dbff', horizon: '#eef8e6', bumper: '#f0913c', bumperCap: '#fff2d6', rock: '#9aa096' },
    holes: [
      {
        id: 'downhill-1',
        name: 'さかみち',
        par: 2,
        tee: { x: 0, z: 5.4 },
        cup: { x: 0, z: -5.0 },
        // たかだいの てっぺんから、ふたつの さかを おりて ふもとへ。
        floors: [{ corners: rect(-1.5, -6.2, 1.5, 6.2, 0.6, 1.1) }],
        features: [
          { kind: 'slope', from: { x: 0, z: 4.4 }, to: { x: 0, z: 3.2 }, drop: 0.5 },
          { kind: 'slope', from: { x: 0, z: -0.6 }, to: { x: 0, z: -1.7 }, drop: 0.45 },
        ],
        route: [{ x: 0, z: 5.4 }, { x: 0, z: 0.6 }, { x: 0, z: -5.0 }],
        tip: 'さかで どんどん はやくなるよ',
      },
      {
        id: 'downhill-2',
        name: 'だんだんばたけ',
        par: 3,
        tee: { x: -1.65, z: 5.2 },
        cup: { x: 1.75, z: -5.2 },
        // Zの字の だんだん畑。みじかい さかが だんさになっていて、3だんで ふもとまで おりる。
        floors: [{
          corners: [
            { x: -2.9, z: 6.3, r: 0.8 },
            { x: -0.4, z: 6.3, r: 0.8 },
            { x: -0.4, z: 1.1, r: 0.7 },
            { x: 3.0, z: 1.1, r: 0.8 },
            { x: 3.0, z: -6.3, r: 0.8 },
            { x: 0.5, z: -6.3, r: 0.8 },
            { x: 0.5, z: -1.3, r: 0.7 },
            { x: -2.9, z: -1.3, r: 0.8 },
          ],
        }],
        features: [
          { kind: 'slope', from: { x: 0, z: 3.9 }, to: { x: 0, z: 3.1 }, drop: 0.3 },
          { kind: 'slope', from: { x: 0, z: 0.7 }, to: { x: 0, z: -0.1 }, drop: 0.3 },
          { kind: 'slope', from: { x: 0, z: -3.1 }, to: { x: 0, z: -3.9 }, drop: 0.3 },
        ],
        gadgets: [{ kind: 'rock', id: 'ledge-rock', x: -2.62, z: 2.4, radius: 0.28 }],
        zones: [{ kind: 'rough', x: 2.75, z: -3.0, radius: 0.62 }],
        route: [{ x: -1.65, z: 5.2 }, { x: -1.9, z: -0.85 }, { x: 1.75, z: -0.9 }, { x: 1.75, z: -5.2 }],
        tip: 'だんだんを おりて よこへ すすもう',
      },
      {
        id: 'downhill-3',
        name: 'だんだん がけ',
        par: 3,
        tee: { x: 0, z: 5.8 },
        cup: { x: -1.4, z: -4.2 },
        // 3だんの だんさを ころころ おりて、下の ひろばへ。だんさでは ボールが ぴょんと はねる。
        floors: [{
          corners: [
            { x: -1.6, z: 6.4, r: 0.9 },
            { x: -1.6, z: 1.0, r: 0.5 },
            { x: -2.8, z: 1.0, r: 0.7 },
            { x: -2.8, z: -6.0, r: 1.1 },
            { x: 2.8, z: -6.0, r: 1.1 },
            { x: 2.8, z: 1.0, r: 0.7 },
            { x: 1.6, z: 1.0, r: 0.5 },
            { x: 1.6, z: 6.4, r: 0.9 },
          ],
        }],
        features: [
          { kind: 'slope', from: { x: 0, z: 4.7 }, to: { x: 0, z: 4.2 }, drop: 0.3 },
          { kind: 'slope', from: { x: 0, z: 3.5 }, to: { x: 0, z: 3.0 }, drop: 0.3 },
          { kind: 'slope', from: { x: 0, z: 2.3 }, to: { x: 0, z: 1.8 }, drop: 0.3 },
        ],
        gadgets: [
          { kind: 'bumper', id: 'barrel', x: 1.5, z: -1.6, radius: 0.3 },
          { kind: 'rock', id: 'fallen-rock', x: -2.2, z: -2.0, radius: 0.32 },
        ],
        zones: [{ kind: 'rough', x: 1.9, z: -4.4, radius: 0.9 }],
        route: [{ x: 0, z: 5.8 }, { x: 0, z: 0.2 }, { x: -1.4, z: -4.2 }],
        tip: 'だんだんを ころころ おりよう',
      },
      {
        id: 'downhill-4',
        name: 'ひつじの おか',
        par: 3,
        tee: { x: 0, z: 5.0 },
        cup: { x: -1.0, z: -4.6 },
        // ひろい おかを おりていく みち。とちゅうに なみと いわ、ひつじが よこぎる。
        floors: [{ corners: rect(-3.4, -5.6, 3.4, 6.0, 1.0, 1.3) }],
        features: [
          { kind: 'slope', from: { x: 0, z: 3.6 }, to: { x: 0, z: 2.5 }, drop: 0.45 },
          { kind: 'slope', from: { x: 0, z: -0.6 }, to: { x: 0, z: -1.7 }, drop: 0.45 },
          { kind: 'ridge', from: { x: -3.6, z: -2.8 }, to: { x: 3.6, z: -2.8 }, radius: 0.6, height: 0.12 },
        ],
        gadgets: [
          { kind: 'critter', id: 'sheep', x: -2.2, z: 1.2, to: { x: 2.2, z: 1.2 }, speed: 0.8, look: 'sheep' },
          { kind: 'rock', id: 'hill-rock', x: 1.6, z: -3.0, radius: 0.36 },
          { kind: 'rock', id: 'hill-rock-w', x: -1.9, z: -0.2, radius: 0.34 },
        ],
        zones: [{ kind: 'rough', x: 2.7, z: 3.6, radius: 0.9 }],
        route: [{ x: 0, z: 5.0 }, { x: 0.2, z: 0.2 }, { x: -1.0, z: -4.6 }],
        tip: 'ひつじさんが とおりすぎたら うとう',
      },
    ],
  },
  {
    id: 'river',
    label: 'かわべ',
    icon: '🏞️',
    description: 'いけと かわを はしで わたろう',
    color: '#3f6fd1',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#63bd62', wall: '#a8784e', wallCap: '#f3e2c0', skirt: '#7a5536', sand: '#efdca8', ice: '#d0ecf7', rough: '#3f8a4c', ground: '#8cc86c', sky: '#b4e2ff', horizon: '#eef9ea', bumper: '#f08a3c', bumperCap: '#fff4e0', rock: '#95a0a0' },
    holes: [
      {
        id: 'river-1',
        name: 'いけの まわり',
        par: 3,
        tee: { x: 1.5, z: 15.5 },
        cup: { x: -1.0, z: -15.0 },
        // ながい ひろばに いけが ふたつ。ひだり・みぎと じぐざぐに よけて すすむ。
        floors: [{ corners: rect(-4, -17, 4, 17, 1.2, 1.4) }],
        water: [
          { kind: 'pond', x: 1.2, z: 5.0, radius: 2.4 },
          { kind: 'pond', x: -1.6, z: -5.0, radius: 2.2 },
        ],
        zones: [
          { kind: 'sand', x: 1.6, z: -12.2, radius: 0.9 },
          { kind: 'rough', x: -3.0, z: 11.5, radius: 0.9 },
        ],
        gadgets: [{ kind: 'critter', id: 'duck', x: -3.3, z: 0.2, to: { x: 3.3, z: 0.2 }, speed: 0.8, look: 'duck' }],
        route: [{ x: 1.5, z: 15.5 }, { x: -1.9, z: 5.0 }, { x: 1.9, z: -5.0 }, { x: -1.0, z: -15.0 }],
        tip: 'いけに おちないように ぐねぐね すすもう',
      },
      {
        id: 'river-2',
        name: 'まるたの はし',
        par: 4,
        tee: { x: -1.8, z: 17.0 },
        cup: { x: 1.8, z: -16.5 },
        // かわが 2ほん よこぎる。はしは ひだりと みぎに ひとつずつ。まっすぐ わたらないと ぽちゃん。
        floors: [{ corners: rect(-3.5, -19, 3.5, 19, 1.0, 1.2) }],
        water: [
          { kind: 'river', from: { x: -3.6, z: 5.0 }, to: { x: 3.6, z: 5.0 }, halfWidth: 1.3 },
          { kind: 'river', from: { x: -3.6, z: -7.0 }, to: { x: 3.6, z: -7.0 }, halfWidth: 1.3 },
        ],
        zones: [
          { kind: 'rough', x: 2.0, z: 1.0, radius: 0.9 },
          { kind: 'sand', x: -1.8, z: -12.6, radius: 1.0 },
        ],
        gadgets: [
          { kind: 'bridge', id: 'log-bridge-1', x: -1.8, z: 5.0, dir: { x: 0, z: 1 }, halfLength: 1.7, halfWidth: 0.7, rails: true },
          { kind: 'bridge', id: 'log-bridge-2', x: 1.8, z: -7.0, dir: { x: 0, z: 1 }, halfLength: 1.7, halfWidth: 0.7, rails: true },
          { kind: 'rock', id: 'bank-rock', x: -2.6, z: 10.5, radius: 0.34 },
        ],
        route: [{ x: -1.8, z: 17.0 }, { x: -1.8, z: -0.5 }, { x: 1.8, z: -3.2 }, { x: 1.8, z: -16.5 }],
        tip: 'はしを まっすぐ わたろう',
      },
      {
        id: 'river-3',
        name: 'ジャンプで ひとっとび',
        par: 4,
        tee: { x: -3.0, z: 18.0 },
        cup: { x: 3.0, z: -18.0 },
        // かわを わたるのは はしか、みぎの ジャンプ台。つよく うてば かわを とびこえられる。
        floors: [{ corners: rect(-5, -20, 5, 20, 1.4, 1.6) }],
        features: [{ kind: 'kicker', from: { x: 2.5, z: 5.9 }, to: { x: 2.5, z: 3.2 }, halfWidth: 1.2, rise: 0.6 }],
        water: [
          { kind: 'river', from: { x: -5.1, z: 2.0 }, to: { x: 5.1, z: 2.0 }, halfWidth: 0.85 },
          { kind: 'pond', x: 0, z: -11.0, radius: 2.0 },
        ],
        zones: [
          { kind: 'sand', x: 4.0, z: -14.2, radius: 0.8 },
          { kind: 'rough', x: -0.6, z: 9.5, radius: 1.2 },
        ],
        gadgets: [
          { kind: 'bridge', id: 'bridge', x: -3.4, z: 2.0, dir: { x: 0, z: 1 }, halfLength: 1.25, halfWidth: 0.7, rails: true },
          { kind: 'booster', id: 'dash', x: 2.5, z: 7.4, dir: { x: 0, z: -1 }, speed: 6.6 },
          { kind: 'tree', id: 'willow', x: -4.2, z: -6.5, radius: 0.35, look: 'broadleaf' },
        ],
        route: [{ x: -3.0, z: 18.0 }, { x: -3.4, z: -2.0 }, { x: -2.8, z: -12.0 }, { x: 3.0, z: -18.0 }],
        tip: 'はしか ジャンプ台で かわを こえよう',
      },
      {
        id: 'river-4',
        name: 'しまの カップ',
        par: 5,
        tee: { x: -1.0, z: 20.0 },
        cup: { x: -1.5, z: -17.0 },
        // カップは みずに かこまれた しまの上。しまへは みぎの はしから わたる。
        floors: [{ corners: rect(-6, -22, 8, 22, 1.6, 1.6) }],
        water: [
          { kind: 'pond', x: -2.0, z: 8.0, radius: 2.6 },
          { kind: 'pond', x: 1.6, z: 0, radius: 2.0 },
          { kind: 'river', from: { x: -6.1, z: -11.2 }, to: { x: 5.2, z: -11.2 }, halfWidth: 1.2 },
          { kind: 'river', from: { x: 4.0, z: -10.0 }, to: { x: 4.0, z: -22.1 }, halfWidth: 1.2 },
        ],
        zones: [
          { kind: 'sand', x: 6.4, z: 6.0, radius: 0.9 },
          { kind: 'sand', x: 0.6, z: -19.6, radius: 0.8 },
        ],
        gadgets: [
          { kind: 'bridge', id: 'island-bridge', x: 4.0, z: -17.0, dir: { x: 1, z: 0 }, halfLength: 1.6, halfWidth: 0.75, rails: true },
          { kind: 'critter', id: 'swan', x: 6.6, z: -12.0, to: { x: 6.6, z: -8.0 }, speed: 0.7, look: 'duck' },
        ],
        route: [{ x: -1.0, z: 20.0 }, { x: 2.2, z: 9.0 }, { x: 6.6, z: -5.0 }, { x: 6.6, z: -17.0 }, { x: -1.5, z: -17.0 }],
        tip: 'みぎの はしから しまへ わたろう',
      },
    ],
  },
  {
    id: 'canyon',
    label: 'たにま',
    icon: '🏜️',
    description: 'がけと はねかえし いた',
    color: '#b84a3a',
    gravity: EARTH_GRAVITY,
    rollingScale: 1,
    look: { felt: '#a6c46a', wall: '#c9784a', wallCap: '#f4d6a8', skirt: '#a0522d', sand: '#f0d49a', ice: '#d4eef6', rough: '#6f9a4a', ground: '#d08a55', sky: '#ffd9a8', horizon: '#fff0da', bumper: '#e0663a', bumperCap: '#fff3dc', rock: '#b0785a' },
    holes: [
      {
        id: 'canyon-1',
        name: 'がけっぷちの みち',
        par: 3,
        tee: { x: 0, z: 16.0 },
        cup: { x: 0.8, z: -15.5 },
        // ほそい がけの みちには かべが ない。はみだすと たにへ まっさかさま。
        floors: [{
          corners: [
            { x: -3.0, z: 18.0, r: 1.0 },
            { x: -3.0, z: 9.0 },
            { x: -1.1, z: 9.0 },
            { x: -1.1, z: -7.0 },
            { x: -3.5, z: -7.0 },
            { x: -3.5, z: -18.0, r: 1.2 },
            { x: 3.5, z: -18.0, r: 1.2 },
            { x: 3.5, z: -7.0 },
            { x: 1.1, z: -7.0 },
            { x: 1.1, z: 9.0 },
            { x: 3.0, z: 9.0 },
            { x: 3.0, z: 18.0, r: 1.0 },
          ],
          open: [1, 2, 3, 7, 8, 9],
        }],
        features: [{ kind: 'slope', from: { x: 0, z: 4.0 }, to: { x: 0, z: 0 }, drop: 0.35 }],
        zones: [
          { kind: 'sand', x: 1.9, z: -11.5, radius: 0.9 },
          { kind: 'sand', x: -2.0, z: -15.0, radius: 0.8 },
        ],
        gadgets: [{ kind: 'rock', id: 'ledge-rock', x: 0.5, z: 6.0, radius: 0.32 }],
        route: [{ x: 0, z: 16.0 }, { x: -0.4, z: -9.5 }, { x: 0.8, z: -15.5 }],
        tip: 'がけから おちないように まっすぐ！',
      },
      {
        id: 'canyon-2',
        name: 'はねかえし いた',
        par: 3,
        tee: { x: -3.8, z: 8.0 },
        cup: { x: 3.8, z: 7.0 },
        // コの字の みち。まん中は ふかい たに。すみの はねかえし いたに あてて、ぐるっと まわりこむ。
        floors: [{
          corners: [
            { x: -6, z: 10, r: 1.2 },
            { x: -6, z: -12, r: 1.2 },
            { x: 6, z: -12, r: 1.2 },
            { x: 6, z: 10, r: 1.2 },
            { x: 1.6, z: 10 },
            { x: 1.6, z: -7 },
            { x: -1.6, z: -7 },
            { x: -1.6, z: 10 },
          ],
          open: [4, 5, 6],
        }],
        zones: [{ kind: 'sand', x: 5.0, z: 2.0, radius: 0.7 }],
        gadgets: [
          { kind: 'reflector', id: 'mirror-left', x: -3.675, z: -9.835, dir: { x: 1, z: -1 }, halfLength: 3.07 },
          { kind: 'reflector', id: 'mirror-right', x: 3.675, z: -9.835, dir: { x: 1, z: 1 }, halfLength: 3.07 },
        ],
        route: [{ x: -3.8, z: 8.0 }, { x: -3.8, z: -8.4, bank: true }, { x: 1.2, z: -9.4 }, { x: 2.8, z: -9.4, bank: true }, { x: 3.8, z: 7.0 }],
        tip: 'いたに あてると ぐるっと まがるよ',
      },
      {
        id: 'canyon-3',
        name: 'つりばし',
        par: 4,
        tee: { x: -2.5, z: 18.0 },
        cup: { x: 2.5, z: -17.0 },
        // ふたつの がけの あいだに ほそい つりばし。てすりが ないので まっすぐ わたろう。
        floors: [
          { corners: [{ x: -5, z: 20, r: 1.2 }, { x: -5, z: 5 }, { x: 5, z: 5 }, { x: 5, z: 20, r: 1.2 }], open: [1] },
          { corners: [{ x: -0.8, z: 5.3 }, { x: -0.8, z: -3.3 }, { x: 0.8, z: -3.3 }, { x: 0.8, z: 5.3 }], open: [0, 1, 2, 3] },
          { corners: [{ x: -5, z: -3 }, { x: -5, z: -20, r: 1.2 }, { x: 5, z: -20, r: 1.2 }, { x: 5, z: -3 }], open: [3] },
        ],
        zones: [
          { kind: 'sand', x: -2.4, z: -13.0, radius: 1.0 },
          { kind: 'rough', x: 3.2, z: -8.0, radius: 1.0 },
        ],
        gadgets: [
          { kind: 'bridge', id: 'rope-bridge', x: 0, z: 1.0, dir: { x: 0, z: 1 }, halfLength: 4.3, halfWidth: 0.8, rails: false },
          { kind: 'rock', id: 'top-rock', x: 2.6, z: 11.5, radius: 0.4 },
          { kind: 'rock', id: 'low-rock', x: 0.6, z: -12.0, radius: 0.36 },
        ],
        route: [{ x: -2.5, z: 18.0 }, { x: 0, z: 9.0 }, { x: 0, z: -7.0 }, { x: 2.5, z: -17.0 }],
        tip: 'つりばしの まんなかを まっすぐ わたろう',
      },
      {
        id: 'canyon-4',
        name: 'たにの おく',
        par: 4,
        tee: { x: -2.0, z: 20.0 },
        cup: { x: 4.0, z: -16.5 },
        // たかだいから がけの さかみちを くだり、はねかえし いたで まがって たにの おくへ。
        floors: [{
          corners: [
            { x: -6, z: 22, r: 1.2 },
            { x: -6, z: -20, r: 1.2 },
            { x: 6, z: -20, r: 1.2 },
            { x: 6, z: -2 },
            { x: -3.8, z: -2 },
            { x: -3.8, z: 12 },
            { x: 2, z: 12 },
            { x: 2, z: 22, r: 1.2 },
          ],
          open: [3, 4, 5],
        }],
        features: [{ kind: 'slope', from: { x: 0, z: 11.0 }, to: { x: 0, z: -1.0 }, drop: 0.8 }],
        zones: [
          { kind: 'rough', x: -0.5, z: -11.0, radius: 2.6 },
          { kind: 'rough', x: -3.5, z: -15.5, radius: 2.0 },
          { kind: 'sand', x: 5.0, z: -13.0, radius: 0.8 },
          { kind: 'sand', x: 0.0, z: 17.5, radius: 1.0 },
        ],
        gadgets: [
          { kind: 'reflector', id: 'canyon-mirror', x: -4.575, z: -6.635, dir: { x: 1, z: -1 }, halfLength: 1.8 },
          { kind: 'rock', id: 'mesa-rock', x: -4.2, z: 17.0, radius: 0.4 },
        ],
        route: [{ x: -2.0, z: 20.0 }, { x: -4.9, z: 13.0 }, { x: -4.9, z: -5.0, bank: true }, { x: 3.4, z: -6.0 }, { x: 4.0, z: -16.5 }],
        tip: 'さかを くだって いたに あてよう',
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
