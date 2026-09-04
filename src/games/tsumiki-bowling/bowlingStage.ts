/**
 * レーンの形と、積み木の配置データ。
 *
 * Phase 1 は固定1ステージだが、Phase 3 の複数ステージ化に備えて
 * 「配置は座標データ、組み立ては共通処理」という形にしてある。
 * ステージを足すときは BOWLING_STAGES へ1件足すだけでよい。
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
/** レーンの奥行き（半分）。手前の発射位置から奥の壁までを覆う。 */
export const LANE_HALF_LENGTH = 13
/** レーン板の厚み（半分）。見た目の板厚で、挙動には影響しない。 */
export const LANE_HALF_THICKNESS = 0.5
/** レーン板の中心のZ。手前(+Z)の発射位置から奥(-Z)まで届く位置に置く。 */
export const LANE_CENTER_Z = -2

/** 左右の縁。低い土手にして、崩れた積み木が画面外へ流れ続けないようにする。 */
export const RAIL_HALF_HEIGHT = 0.4
export const RAIL_HALF_WIDTH = 0.25
/** 奥の壁。突き抜けた玉を受け止めて、次の投球までの待ち時間を短くする。 */
export const BACK_WALL_Z = -11.4
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
 * 玉から最前面の積み木までは 11.0m → 13.2m（約20%増）。
 *
 * これ以上下げると、幼児には狙いにくく・積み木が小さく見え始めるため、
 * 「少し伸ばす」の範囲としてここで止めている。
 */
const TOWER_DEPTH_OFFSET = 2.2

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
 * Phase 1 の固定ステージ「つみきタワー」。
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

export const BOWLING_STAGES: readonly BowlingStage[] = [TOWER_STAGE]

export const DEFAULT_BOWLING_STAGE_ID = TOWER_STAGE.id

export function getBowlingStage(id: string | undefined): BowlingStage {
  const found = BOWLING_STAGES.find((stage) => stage.id === id)
  return found ?? BOWLING_STAGES[0]!
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
