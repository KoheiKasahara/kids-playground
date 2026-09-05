/**
 * レーンの形と、積み木の配置データ。
 *
 * Phase 3 で複数ステージ化したが、「配置は座標データ、組み立ては共通処理」という
 * 形は変えていない。ステージを足すときは BOWLING_STAGES へ1件足すだけでよい。
 *
 * 座標系:
 *   +X = 画面右 / -Z = 積み木のある奥 / +Z = 発射位置のある手前
 *   レーン面の高さ y は laneSurfaceY(z) で決まる（手前ほど高い、ごく緩い下り勾配）。
 */

import { LANE_SLOPE_RAD } from './bowlingPhysics'

// ---------------------------------------------------------------------------
// レーンの寸法
// ---------------------------------------------------------------------------

/** レーンの左右の半分の幅。玉が多少ずれても落ちない広さにしてある。 */
export const LANE_HALF_WIDTH = 5.2
/**
 * レーンの奥行き（半分）。手前の発射位置から奥の壁までを覆う。
 *
 * 発射位置(LAUNCH_Z)を積み木から遠ざけたぶん、レーンそのものも伸ばしてある
 * （手前の余白・奥の壁裏の余白は、発射距離を伸ばす前と同じ幅を保っている）。
 */
export const LANE_HALF_LENGTH = 19.5
/** レーン板の厚み（半分）。見た目の板厚で、挙動には影響しない。 */
export const LANE_HALF_THICKNESS = 0.5
/** レーン板の中心のZ。手前(+Z)の発射位置から奥(-Z)まで届く位置に置く。 */
export const LANE_CENTER_Z = 4.5

/** 左右の縁。低い土手にして、崩れた積み木が画面外へ流れ続けないようにする。 */
export const RAIL_HALF_HEIGHT = 0.4
export const RAIL_HALF_WIDTH = 0.25
/** 奥の壁。突き抜けた玉を受け止めて、次の投球までの待ち時間を短くする。 */
export const BACK_WALL_Z = -12.2
export const BACK_WALL_HALF_HEIGHT = 0.55

/**
 * レーン面の高さ。y = z * tan(slope)。
 * z = 0 を基準面とし、手前(+Z)ほど高く、奥(-Z)ほど低い。
 */
export function laneSurfaceY(z: number): number {
  return z * Math.tan(LANE_SLOPE_RAD)
}

/**
 * 勾配に沿って物を置くためのクォータニオン（X軸まわり -slope）。
 * これを掛けたローカル+Yがレーンの法線になり、積み木が斜面に対してまっすぐ立つ。
 */
export function laneTiltQuaternion(yaw = 0): { x: number; y: number; z: number; w: number } {
  const halfPitch = -LANE_SLOPE_RAD / 2
  const halfYaw = yaw / 2
  // q = qYaw(Y軸) * qPitch(X軸)
  const cy = Math.cos(halfYaw)
  const sy = Math.sin(halfYaw)
  const cp = Math.cos(halfPitch)
  const sp = Math.sin(halfPitch)
  return {
    x: cy * sp,
    y: sy * cp,
    z: -sy * sp,
    w: cy * cp,
  }
}

/** レーン板そのものの姿勢（中心座標と回転）。物理Colliderと見た目Meshで共有する。 */
export function laneBodyTransform(): {
  center: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
} {
  const cos = Math.cos(LANE_SLOPE_RAD)
  const sin = Math.sin(LANE_SLOPE_RAD)
  return {
    // 面の中心から法線の逆向きへ板厚のぶんだけ下げる。
    center: {
      x: 0,
      y: laneSurfaceY(LANE_CENTER_Z) - LANE_HALF_THICKNESS * cos,
      z: LANE_CENTER_Z + LANE_HALF_THICKNESS * sin,
    },
    rotation: laneTiltQuaternion(),
  }
}

// ---------------------------------------------------------------------------
// ステージ定義
// ---------------------------------------------------------------------------

/** 積み木1個の配置。y方向は「レーン面からの高さ」で書く（勾配を意識せずに積める）。 */
export type StageBlock = {
  /** 左右の位置。0がレーン中央。 */
  x: number
  /** 奥行きの位置。負の値が奥。 */
  z: number
  /** レーン面から積み木の中心までの高さ。 */
  height: number
  /** 積み木の大きさ [幅, 高さ, 奥行き]。 */
  size: readonly [number, number, number]
  /** 見た目の色。 */
  color: number
  /** Y軸まわりの回転[rad]。既定0。 */
  yaw?: number
}

export type BowlingStage = {
  id: string
  name: string
  /** 選択カードに出す短い一言（例: 「まんなかを ねらおう」）。 */
  hint: string
  /**
   * カメラが距離を見積もるときに使う奥行き。省略時は外形の中心(stageBounds().centerZ)。
   * 既定ステージ tower だけは Phase 1 の画角を1度も変えないために明示する。
   */
  cameraZ?: number
  blocks: readonly StageBlock[]
}

// 幼児向けにはっきり区別できる原色寄りの6色。
const RED = 0xef4b4b
const BLUE = 0x3d7ff2
const YELLOW = 0xf7c223
const GREEN = 0x44b45f
const ORANGE = 0xf28034
const PURPLE = 0x9a6ae0

/**
 * 柱と板の基本サイズ。ここを共有することで積み上げ高さの計算がずれない。
 *
 * 重要: 同じ段の積み木どうしを絶対に重ねないこと。
 * 少しでも重なった状態から始めると、Rapierが初期状態でそれを弾き飛ばし、
 * 何もしていないのに塔が崩れてしまう（実測で19個中5個が勝手に倒れた）。
 */
const PILLAR: readonly [number, number, number] = [0.3, 1, 0.3]
const SHORT_PILLAR: readonly [number, number, number] = [0.3, 0.85, 0.3]
/**
 * 塔の手前に立てる横長の壁。
 *
 * この壁があるおかげで、左右どこへ当てても力が幅いっぱいに伝わり、
 * 奥の柱をまとめて倒せる。壁がないと、まん中へ当てても左右の山が
 * そのまま立っていて、崩れ方が寂しくなる（実測で18個中6個しか倒れなかった）。
 */
const FRONT_WALL: readonly [number, number, number] = [4.2, 0.95, 0.28]
/** 1段目の板。柱2本にだけ載せ、どちらか1本が抜ければ必ず落ちるようにする。 */
const PLANK: readonly [number, number, number] = [1.4, 0.22, 1.9]
/** 2段目の板。1枚で上段全体を支える。 */
const WIDE_PLANK: readonly [number, number, number] = [3.2, 0.22, 1]
const CUBE: readonly [number, number, number] = [0.44, 0.44, 0.44]
const BIG_CUBE: readonly [number, number, number] = [0.5, 0.5, 0.5]

/**
 * 塔全体を奥へ下げる量[m]。
 *
 * 発射位置(z=+7)と塔が近すぎると、離した瞬間にもう当たっていて
 * 「ビューンと進んでからドカン」の助走が味わえない（実画面で確認した）。
 * 塔だけをこのぶん奥へ下げ、発射の強さ・速度は一切触らずに助走を伸ばしている。
 * 玉から最前面の積み木までは 11.0m → 14.1m（約27%増）。
 *
 * これに合わせて BACK_WALL_Z も奥へ動かし、崩れた積み木が散らばる余地を保つ
 * （手前の塔から奥の壁までの距離は常に約2.75mのまま）。
 *
 * これ以上下げると、はずむだまを中くらいの力で投げたときに積み木まで届く前に
 * 勢いを失い、何度も跳ねる持ち味が消えてしまう
 * （Rapierで実測。offset 3.0 では中くらいの力の基準を0.7→0.8へ少し上げて
 * 保っている。bowlingWorld.test.tsのaim(0.8)参照）。
 */
const TOWER_DEPTH_OFFSET = 3.0

/** 手前の壁が立つZ。塔より手前にして、まず壁が倒れ込むようにする。 */
const FRONT_WALL_Z = -4.25 - TOWER_DEPTH_OFFSET
/** 塔の手前側・奥側の柱が立つZ。奥行きを持たせて、力が前後にも連鎖する。 */
const FRONT_ROW_Z = -5 - TOWER_DEPTH_OFFSET
const BACK_ROW_Z = -6.3 - TOWER_DEPTH_OFFSET
/** 板と上段の中心Z（前後の柱にまたがる）。 */
const TOWER_Z = (FRONT_ROW_Z + BACK_ROW_Z) / 2

/**
 * 塔のだいたいの中心Z。カメラの画角計算とテストがここを見る。
 * 塔を前後に動かしたとき、カメラ側の数値を直し忘れて
 * 「積み木が小さく写る／端が切れる」が起きないよう、必ずここから読む。
 */
export const TOWER_CENTER_Z = TOWER_Z

/**
 * 1段目の柱の左右位置。
 * 隣とのすき間(0.6)は玉の直径(0.92)より狭く、間をすり抜けられない。
 */
const BASE_PILLAR_X = [-1.8, -0.9, 0, 0.9, 1.8] as const
/** 1段目の板と2段目の柱の左右位置。板は柱2本ぶんにだけ載る。 */
const PLANK_X = [-1.35, 1.35] as const

/**
 * Phase 1 の固定ステージ「つみきタワー」（既定ステージ）。
 *
 * 1発当てるだけで大きく崩れるよう、次の順で力が伝わる形にしてある。
 * 1. 手前のキューブが弾け飛んで「当たった！」が分かる。
 * 2. 横長の壁が倒れ込み、幅いっぱいの柱をまとめて倒す。
 * 3. 柱が抜けた板が落ち、その上の柱・長い板・てっぺんのキューブが続けて落ちる。
 * 4. 柱は前後2列あるので、手前の崩れが奥へも伝わる。
 */
const TOWER_STAGE: BowlingStage = {
  id: 'tower',
  name: 'つみきタワー',
  hint: 'どこでも ドカン！',
  // Phase 1 のカメラ画角を1ミリも変えないため、外形の中心ではなく
  // 従来カメラが使っていたTOWER_Zをそのまま明示する。
  cameraZ: TOWER_Z,
  blocks: [
    // 幅いっぱいの壁。どこへ当てても、ここから塔全体へ力が伝わる。
    { x: 0, z: FRONT_WALL_Z, height: FRONT_WALL[1] / 2, size: FRONT_WALL, color: RED },

    // 壁の上に載せたキューブ。速い玉は壁の上のあたりを通るので、
    // まずこれが弾け飛んで「当たった！」が分かる。
    // 弱い発射で壁の下側に当たったときは、揺れて落ちる。
    { x: -0.9, z: FRONT_WALL_Z, height: FRONT_WALL[1] + BIG_CUBE[1] / 2, size: BIG_CUBE, color: ORANGE },
    { x: 0.9, z: FRONT_WALL_Z, height: FRONT_WALL[1] + BIG_CUBE[1] / 2, size: BIG_CUBE, color: PURPLE },

    // 1段目の柱（手前列）。
    ...BASE_PILLAR_X.map((x, index) => ({
      x,
      z: FRONT_ROW_Z,
      height: 0.5,
      size: PILLAR,
      color: [BLUE, YELLOW, GREEN, BLUE, YELLOW][index]!,
    })),
    // 1段目の柱（奥列）。
    ...BASE_PILLAR_X.map((x, index) => ({
      x,
      z: BACK_ROW_Z,
      height: 0.5,
      size: PILLAR,
      color: [YELLOW, GREEN, BLUE, YELLOW, GREEN][index]!,
    })),

    // 1段目の板。左右それぞれ柱2本の上にだけ載る。
    ...PLANK_X.map((x, index) => ({
      x,
      z: TOWER_Z,
      height: 1.11,
      size: PLANK,
      color: [YELLOW, ORANGE][index]!,
    })),

    // 2段目の柱。板1枚につき1本ずつ。
    ...PLANK_X.map((x, index) => ({
      x,
      z: TOWER_Z,
      height: 1.645,
      size: SHORT_PILLAR,
      color: [PURPLE, GREEN][index]!,
    })),

    // 2段目の板（1枚の長い板）。ここが落ちると上のキューブもまとめて崩れる。
    { x: 0, z: TOWER_Z, height: 2.18, size: WIDE_PLANK, color: BLUE },

    // てっぺんのキューブ。崩壊の最後に転がり落ちて「ガラガラ」の締めになる。
    { x: -0.55, z: TOWER_Z, height: 2.51, size: CUBE, color: YELLOW },
    { x: 0.55, z: TOWER_Z, height: 2.51, size: CUBE, color: RED },
  ],
}

/**
 * さんかくタワー。奥行き1列だけの、入門向けの三角形。
 *
 * 下から 5-4-3-2-1 の段組みで、どの段も下の段2個へまたがって載る。
 * 段差はすべて積み木の高さぴったり（隙間0）、隣どうしは0.1のすき間で
 * 絶対に重ならない。
 *
 * 最下段を±2.0まで広げてあるのは見た目のためだけではない。
 * 左右いっぱいに狙った玉は x≒±2.4 まで届くので（実測）、土台が短いと
 * 思い切り横へ狙った転がりの投球が何にも当たらずに終わる。
 * 最初に遊ぶステージほど「当てたのに何も起きない」を作らない。
 *
 * 狙い: 速い球は真ん中あたりの段（h1.25）へ当たって上半分が落ち、
 * 転がってきた球は最下段へ当たって三角形ごと後ろへ倒れ込む。
 */
const TRIANGLE_BRICK: readonly [number, number, number] = [0.9, 0.5, 0.7]
const TRIANGLE_STAGE: BowlingStage = {
  id: 'triangle',
  name: 'さんかくタワー',
  hint: 'したを ねらおう',
  blocks: (
    [
      { height: 0.25, xs: [-2.0, -1.0, 0, 1.0, 2.0], color: BLUE },
      { height: 0.75, xs: [-1.5, -0.5, 0.5, 1.5], color: YELLOW },
      { height: 1.25, xs: [-1.0, 0, 1.0], color: GREEN },
      { height: 1.75, xs: [-0.5, 0.5], color: ORANGE },
      { height: 2.25, xs: [0], color: RED },
    ] as const
  ).flatMap((row) =>
    row.xs.map((x) => ({
      x,
      z: -7.0,
      height: row.height,
      size: TRIANGLE_BRICK,
      color: row.color,
    })),
  ),
}

/**
 * つみきのおしろ。横に広く、左の塔・中央の壁・右の塔が別々に崩れる。
 *
 * 中央の壁と左右の塔のあいだには0.675の隙間があり、ちいさいだま(直径0.48)だけが
 * すり抜けて奥の壁へ届く。どっしり(0.92)・はずむ(0.68)は通れず、
 * 塔か中央壁のどちらかへ必ず当たって崩す
 * （「特定の玉でないと攻略できない」構成にはしない）。
 */
const CASTLE_TOWER_TOP: readonly [number, number, number] = [0.26, 0.3, 0.3]
const CASTLE_TOWER_BODY: readonly [number, number, number] = [0.75, 0.7, 0.8]
const CASTLE_STAGE: BowlingStage = {
  id: 'castle',
  name: 'つみきのおしろ',
  hint: 'みぎ？ ひだり？ まんなか？',
  blocks: [
    // 左の塔。
    { x: -2.0, z: -6.8, height: 0.35, size: CASTLE_TOWER_BODY, color: RED },
    { x: -2.0, z: -6.8, height: 1.05, size: CASTLE_TOWER_BODY, color: RED },
    { x: -2.22, z: -6.8, height: 1.55, size: CASTLE_TOWER_TOP, color: YELLOW },
    { x: -1.78, z: -6.8, height: 1.55, size: CASTLE_TOWER_TOP, color: YELLOW },

    // 右の塔（左の塔とxを符号反転しただけの、鏡合わせ）。
    { x: 2.0, z: -6.8, height: 0.35, size: CASTLE_TOWER_BODY, color: BLUE },
    { x: 2.0, z: -6.8, height: 1.05, size: CASTLE_TOWER_BODY, color: BLUE },
    { x: 2.22, z: -6.8, height: 1.55, size: CASTLE_TOWER_TOP, color: ORANGE },
    { x: 1.78, z: -6.8, height: 1.55, size: CASTLE_TOWER_TOP, color: ORANGE },

    // 中央の壁。
    { x: 0, z: -6.8, height: 0.30, size: [1.9, 0.6, 0.75], color: GREEN },
    { x: 0, z: -6.8, height: 0.85, size: [1.5, 0.5, 0.75], color: YELLOW },
    { x: -0.55, z: -6.8, height: 1.26, size: [0.28, 0.32, 0.3], color: PURPLE },
    { x: 0, z: -6.8, height: 1.26, size: [0.28, 0.32, 0.3], color: PURPLE },
    { x: 0.55, z: -6.8, height: 1.26, size: [0.28, 0.32, 0.3], color: PURPLE },

    // 奥の壁。中央の壁と塔の隙間をすり抜けた玉だけが当たる。
    { x: 0, z: -8.3, height: 0.275, size: [2.6, 0.55, 0.7], color: BLUE },
    { x: -0.6, z: -8.3, height: 0.75, size: [0.4, 0.4, 0.4], color: RED },
    { x: 0.6, z: -8.3, height: 0.75, size: [0.4, 0.4, 0.4], color: RED },
  ],
}

/**
 * ハートタワー。中央に穴（空間）があり、上に2つのふくらみ＋くぼみ。
 * 他のステージと見間違えないシルエットにしてある。
 *
 * 中央の穴は幅0.9（柱の内側面が±0.45）。
 * 狙い: 柱を当てるとその側が落ちて渡し板が傾き、ふくらみがその側へ転がる。
 * まん中へ当てるとどっしりだま(0.92)は穴を通れず、両方の柱を巻き込んで
 * 全部落ちる。ちいさいだま・はずむだまは穴を抜けて奥のしんへ届く。
 */
const HEART_COLUMN: readonly [number, number, number] = [0.7, 0.55, 0.8]
const HEART_STAGE: BowlingStage = {
  id: 'heart',
  name: 'ハートタワー',
  hint: 'まんなかが あいてるよ',
  blocks: [
    // 左の柱。
    { x: -0.8, z: -7.2, height: 0.275, size: HEART_COLUMN, color: RED },
    { x: -0.8, z: -7.2, height: 0.825, size: HEART_COLUMN, color: RED },
    { x: -0.8, z: -7.2, height: 1.375, size: HEART_COLUMN, color: RED },

    // 右の柱。
    { x: 0.8, z: -7.2, height: 0.275, size: HEART_COLUMN, color: BLUE },
    { x: 0.8, z: -7.2, height: 0.825, size: HEART_COLUMN, color: BLUE },
    { x: 0.8, z: -7.2, height: 1.375, size: HEART_COLUMN, color: BLUE },

    // 渡し板。左右の柱にまたがって載る。どちらかが抜けると傾く。
    { x: 0, z: -7.2, height: 1.775, size: [2.6, 0.25, 0.8], color: YELLOW },

    // ふくらみ（下段）。
    { x: -1.05, z: -7.2, height: 2.14, size: [0.48, 0.48, 0.48], color: GREEN },
    { x: -0.55, z: -7.2, height: 2.14, size: [0.48, 0.48, 0.48], color: GREEN },
    { x: 0.55, z: -7.2, height: 2.14, size: [0.48, 0.48, 0.48], color: GREEN },
    { x: 1.05, z: -7.2, height: 2.14, size: [0.48, 0.48, 0.48], color: GREEN },

    // ふくらみ（上段）。左右の下段2個ずつにまたがって載る。
    { x: -0.8, z: -7.2, height: 2.62, size: [0.48, 0.48, 0.48], color: ORANGE },
    { x: 0.8, z: -7.2, height: 2.62, size: [0.48, 0.48, 0.48], color: ORANGE },

    // 奥のしん。穴をすり抜けた玉だけが当たる。
    { x: 0, z: -8.4, height: 0.45, size: [0.9, 0.9, 0.7], color: PURPLE },
  ],
}

/**
 * たかいタワー。縦に高く、板と柱を交互に積んで安定させつつ、
 * 下が抜けると上が順に落ちる「ジェンガ崩し」の形。
 *
 * 下ほど広く重い台形なので自重では崩れない。玉は高さ約1.4mへ届くので、
 * 3段目〜4段目へ当たって上2/3が連鎖で落ちる。転がってきた球は
 * 最下段を抜いて全部落とす。
 */
const TALL_Z = -7.3
const TALL_STAGE: BowlingStage = {
  id: 'tall',
  name: 'たかいタワー',
  hint: 'したから ドカン！',
  blocks: [
    { x: -0.45, z: TALL_Z, height: 0.25, size: [0.8, 0.5, 0.9], color: RED },
    { x: 0.45, z: TALL_Z, height: 0.25, size: [0.8, 0.5, 0.9], color: RED },
    { x: 0, z: TALL_Z, height: 0.625, size: [1.9, 0.25, 0.9], color: BLUE },
    { x: -0.4, z: TALL_Z, height: 1.0, size: [0.7, 0.5, 0.85], color: YELLOW },
    { x: 0.4, z: TALL_Z, height: 1.0, size: [0.7, 0.5, 0.85], color: YELLOW },
    { x: 0, z: TALL_Z, height: 1.375, size: [1.6, 0.25, 0.85], color: BLUE },
    { x: -0.35, z: TALL_Z, height: 1.75, size: [0.6, 0.5, 0.8], color: GREEN },
    { x: 0.35, z: TALL_Z, height: 1.75, size: [0.6, 0.5, 0.8], color: GREEN },
    { x: 0, z: TALL_Z, height: 2.125, size: [1.3, 0.25, 0.8], color: BLUE },
    { x: -0.28, z: TALL_Z, height: 2.5, size: [0.5, 0.5, 0.7], color: ORANGE },
    { x: 0.28, z: TALL_Z, height: 2.5, size: [0.5, 0.5, 0.7], color: ORANGE },
    { x: 0, z: TALL_Z, height: 2.86, size: [1.0, 0.22, 0.7], color: BLUE },
    { x: 0, z: TALL_Z, height: 3.195, size: [0.45, 0.45, 0.45], color: PURPLE },
    { x: 0, z: TALL_Z, height: 3.595, size: [0.35, 0.35, 0.35], color: RED },
  ],
}

/**
 * もん。2本の柱＋上の板の組。柱を倒すと上が落ちる因果が見て分かる。
 * 奥にもう1つ小さい門があり、いちばん奥にはたからものを置いてある。
 *
 * 狙い: 柱へ当てるとその側の柱が抜け、板とてっぺんがその場で落ちる
 * （因果が明確）。門のまん中を通した球は手前の門をくぐって奥の門へ当たり、
 * 奥だけが崩れる。一番低く転がった球でも、最後に奥のたからものへ
 * 必ず当たるので「何も起きない投球」にならない。
 *
 * 奥の門のすき間は0.68にしてある。どっしりだま(直径0.92)・はずむだま(0.68)は
 * ここを通れず奥の門の柱へ当たって崩す。ちいさいだま(0.48)だけがすり抜けて
 * たからものへ届く。ここを広くすると（実測0.98のとき）中くらいの強さで
 * まん中へ投げた玉が2つの門を素通りし、たからもの1個しか倒れなかった。
 */
const GATE_STAGE: BowlingStage = {
  id: 'gate',
  name: 'もん',
  hint: 'はしらを たおそう',
  blocks: [
    // 手前の門。
    { x: -1.1, z: -7.0, height: 0.8, size: [0.5, 1.6, 0.65], color: RED },
    { x: 1.1, z: -7.0, height: 0.8, size: [0.5, 1.6, 0.65], color: RED },
    { x: 0, z: -7.0, height: 1.775, size: [3.2, 0.35, 0.7], color: BLUE },
    { x: -0.95, z: -7.0, height: 2.175, size: [0.45, 0.45, 0.45], color: YELLOW },
    { x: 0, z: -7.0, height: 2.175, size: [0.45, 0.45, 0.45], color: YELLOW },
    { x: 0.95, z: -7.0, height: 2.175, size: [0.45, 0.45, 0.45], color: YELLOW },

    // 奥の門（ひとまわり小さい）。
    { x: -0.55, z: -8.5, height: 0.55, size: [0.42, 1.1, 0.55], color: GREEN },
    { x: 0.55, z: -8.5, height: 0.55, size: [0.42, 1.1, 0.55], color: GREEN },
    { x: 0, z: -8.5, height: 1.25, size: [2.0, 0.3, 0.6], color: ORANGE },
    { x: -0.5, z: -8.5, height: 1.6, size: [0.4, 0.4, 0.4], color: PURPLE },
    { x: 0.5, z: -8.5, height: 1.6, size: [0.4, 0.4, 0.4], color: PURPLE },

    // 奥のたからもの。すき間をすり抜けたちいさいだまが最後に当たる。
    // 幅は0.6。奥の門の柱(内側面±0.34)と横に重ならない大きさにしてある
    // （初期状態で重なると、Rapierが弾き飛ばして勝手に崩れる）。
    { x: 0, z: -8.9, height: 0.25, size: [0.6, 0.5, 0.6], color: YELLOW },
  ],
}

/**
 * ピラミッド。数が多く、1発で大量にガラガラ崩れるのが売り。
 * 隣どうしの隙間は0.02（重ねない）で、上の段は必ず下の段2個へまたがって載る。
 *
 * 狙い: 前面へ当たると衝撃が奥まで伝わり、上の段がまとめて崩れ落ちる。
 * 30個は既定ステージの1.6倍だが、Rapierの剛体数としては十分軽い。
 * これ以上増やさないこと。
 */
const PYRAMID_STAGE: BowlingStage = {
  id: 'pyramid',
  name: 'ピラミッド',
  hint: 'いっぱい くずれる！',
  blocks: (
    [
      { height: 0.3, xs: [-0.93, -0.31, 0.31, 0.93], zs: [-6.75, -7.37, -7.99, -8.61], color: BLUE },
      { height: 0.9, xs: [-0.62, 0, 0.62], zs: [-7.06, -7.68, -8.30], color: GREEN },
      { height: 1.5, xs: [-0.31, 0.31], zs: [-7.37, -7.99], color: YELLOW },
      { height: 2.1, xs: [0], zs: [-7.68], color: RED },
    ] as const
  ).flatMap((row) =>
    row.xs.flatMap((x) =>
      row.zs.map((z) => ({
        x,
        z,
        height: row.height,
        size: [0.6, 0.6, 0.6] as const,
        color: row.color,
      })),
    ),
  ),
}

export const BOWLING_STAGES: readonly BowlingStage[] = [
  TOWER_STAGE,
  TRIANGLE_STAGE,
  CASTLE_STAGE,
  HEART_STAGE,
  TALL_STAGE,
  GATE_STAGE,
  PYRAMID_STAGE,
]

export const DEFAULT_BOWLING_STAGE_ID = TOWER_STAGE.id

export function getBowlingStage(id: string | undefined): BowlingStage {
  const found = BOWLING_STAGES.find((stage) => stage.id === id)
  return found ?? BOWLING_STAGES[0]!
}

/**
 * ステージの外形。カメラの画角の見積もりと、テストでの機械的な検証に使う。
 * 積み木データから毎回計算するので、ステージ定義側と二重管理にならない。
 */
export function stageBounds(stage: BowlingStage): {
  /** 左右の半幅。max(abs(x) + size[0]/2)。 */
  halfWidth: number
  /** レーン面からの最大の高さ。max(height + size[1]/2)。 */
  topHeight: number
  /** 最前面（手前）のZ。max(z + size[2]/2)。 */
  frontZ: number
  /** 最奥のZ。min(z - size[2]/2)。 */
  backZ: number
  /** 前後の中間Z。 */
  centerZ: number
} {
  let halfWidth = 0
  let topHeight = 0
  let frontZ = Number.NEGATIVE_INFINITY
  let backZ = Number.POSITIVE_INFINITY
  for (const block of stage.blocks) {
    halfWidth = Math.max(halfWidth, Math.abs(block.x) + block.size[0] / 2)
    topHeight = Math.max(topHeight, block.height + block.size[1] / 2)
    frontZ = Math.max(frontZ, block.z + block.size[2] / 2)
    backZ = Math.min(backZ, block.z - block.size[2] / 2)
  }
  return { halfWidth, topHeight, frontZ, backZ, centerZ: (frontZ + backZ) / 2 }
}

// ---------------------------------------------------------------------------
// ステージ選択カードのプレビュー
// ---------------------------------------------------------------------------

/** 選択カードに描く、正面から見た積み木1個ぶんの矩形（SVG座標・左上原点）。 */
export type StagePreviewRect = {
  x: number
  y: number
  width: number
  height: number
  color: number
  /** 0=いちばん奥, 1=いちばん手前。奥ほど薄く描くために使う。 */
  depth: number
}

export type StagePreview = {
  /** SVG の viewBox 幅・高さ（m単位そのまま）。 */
  width: number
  height: number
  /** レーン面のY（SVG座標）。カードの地面線に使う。 */
  groundY: number
  /** 奥→手前の順。この順に描けば手前が上に重なる。 */
  rects: StagePreviewRect[]
}

/**
 * ステージ定義から、選択カードに描く正面図を作る（純粋関数）。
 *
 * プレビュー用の座標を手で二重管理しないための仕組み。
 * 新しいステージを BOWLING_STAGES へ足すだけで、絵も自動で付いてくる。
 */
export function stagePreview(stage: BowlingStage, padding = 0.2): StagePreview {
  const minX = Math.min(...stage.blocks.map((block) => block.x - block.size[0] / 2))
  const maxX = Math.max(...stage.blocks.map((block) => block.x + block.size[0] / 2))
  const topY = Math.max(...stage.blocks.map((block) => block.height + block.size[1] / 2))

  const width = maxX - minX + padding * 2
  const height = topY + padding * 2
  const groundY = topY + padding

  const zValues = stage.blocks.map((block) => block.z)
  const minZ = Math.min(...zValues)
  const maxZ = Math.max(...zValues)
  const zRange = maxZ - minZ

  // z の昇順（奥が先）で返す。この順に描けば、手前のブロックが奥のブロックへ重なる。
  const rects = [...stage.blocks]
    .sort((a, b) => a.z - b.z)
    .map((block) => ({
      x: block.x - block.size[0] / 2 - minX + padding,
      y: groundY - (block.height + block.size[1] / 2),
      width: block.size[0],
      height: block.size[1],
      color: block.color,
      // z がすべて同じステージ（0除算）では、いちばん手前(1)扱いにする。
      depth: zRange > 0 ? (block.z - minZ) / zRange : 1,
    }))

  return { width, height, groundY, rects }
}

/** 積み木1個ぶんの、世界座標での初期姿勢。 */
export type BlockPlacement = {
  position: { x: number; y: number; z: number }
  rotation: { x: number; y: number; z: number; w: number }
  size: readonly [number, number, number]
  color: number
}

/** 斜面に沿って置いたときに、面へわずかに沈み込まないための持ち上げ量。 */
const PLACEMENT_LIFT = 0.004

/**
 * ステージ定義を世界座標の配置へ変換する。
 * 物理Body・見た目Mesh・リセット処理がすべてこの1つの結果を共有するので、
 * 「見た目と当たり判定がずれる」「リセット後だけ位置が違う」が起きない。
 */
export function stageBlockPlacements(stage: BowlingStage): BlockPlacement[] {
  return stage.blocks.map((block) => ({
    position: {
      x: block.x,
      y: laneSurfaceY(block.z) + block.height + PLACEMENT_LIFT,
      z: block.z,
    },
    rotation: laneTiltQuaternion(block.yaw ?? 0),
    size: block.size,
    color: block.color,
  }))
}
