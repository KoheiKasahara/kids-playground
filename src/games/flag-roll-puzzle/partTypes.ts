import type { GridCell } from './grid'

/**
 * パーツの種類。Phase 1は横板と斜め板2種だけに絞る。
 * 名前は「見た目の向き」ではなく「ボールがどちらへ滑るか」で付けてある
 * （slopeLeft は ／ の形で、乗ったボールは左へ滑り落ちる）。
 * 幼児が選ぶときに知りたいのは形の名前ではなく結果なので、表示ラベルも同じ考え方にする。
 */
export type PartTypeId = 'plank' | 'slopeLeft' | 'slopeRight'

/**
 * パーツを構成する長方形。アンカーセルの中心を原点とした相対位置(px)で表す。
 *
 * 描画（div + rotate）と物理Body（Matter.Bodies.rectangle）を、どちらもこの
 * 同じ定義から作る。見た目と当たり判定が構造的にずれないうえ、新しいパーツを
 * 足すときも「セグメントの並びを書く」だけで済み、盤面やエンジン側に
 * パーツ種類ごとの分岐が増えない。
 *
 * Phase 3で予定しているカーブのように長方形の集合で表しにくいパーツが来たら、
 * セグメントを細かく分けて近似するか、そのときに描画専用の情報を足す。
 * 今は使わない仕組みを先に作らない。
 */
export type PartSegment = {
  /** アンカーセル中心からのずれ(px) */
  readonly offsetX: number
  readonly offsetY: number
  readonly width: number
  readonly height: number
  /** 角度(度)。時計回りが正（画面座標系。CSS rotate / matter-js の angle と同じ向き） */
  readonly angleDeg: number
}

export type PartDefinition = {
  readonly id: PartTypeId
  /** パーツ置き場に出す短い名前 */
  readonly label: string
  /**
   * アンカーセルからの相対で、このパーツが占有するマス。
   * Phase 1は全パーツが1マスだが、2〜3マスを使う長い板（Phase 3）を足すときは
   * ここへオフセットを増やすだけで重なり判定に反映される。
   */
  readonly cells: readonly GridCell[]
  readonly segments: readonly PartSegment[]
  /** 物理係数。板ごとに弾み方を変えられるよう、パーツ定義側に持たせる */
  readonly restitution: number
  readonly friction: number
}

/** 1マスぶんのパーツが占有するマス（アンカーセルそのもの） */
const SINGLE_CELL: readonly GridCell[] = [{ col: 0, row: 0 }]

/** 板の厚み。薄すぎるとボールがすり抜け、厚すぎるとマスが埋まって見える */
const PLANK_THICKNESS = 12
/** 横板の長さ。マス(60)より少し短くし、隣り合わせに置いても線がつながって見えないようにする */
const PLANK_LENGTH = 54
/**
 * 斜め板の角度。ボールが確実に滑り出し（摩擦係数より tan が大きい角度）、
 * かつ真下へ落ちるだけにならない中間として30度を選んだ。
 */
const SLOPE_ANGLE_DEG = 30
/**
 * 斜め板の長さ。回転させたあとの外接矩形が1マス(60)に収まる最大に近い長さにしてある
 * （30度なら 62/2*cos30 + 12/2*sin30 ≒ 29.9 ≦ 30）。横板と横幅がほぼそろい、
 * 隣どうしに置いても見た目が重ならない。partTypes.test.ts がこの収まりを検証する。
 */
const SLOPE_LENGTH = 62

export const PART_DEFINITIONS: readonly PartDefinition[] = [
  {
    id: 'plank',
    label: 'よこいた',
    cells: SINGLE_CELL,
    segments: [{ offsetX: 0, offsetY: 0, width: PLANK_LENGTH, height: PLANK_THICKNESS, angleDeg: 0 }],
    restitution: 0.2,
    friction: 0.04,
  },
  {
    id: 'slopeLeft',
    label: 'ひだりへ',
    cells: SINGLE_CELL,
    // ／ の形。右端が上がるので、乗ったボールは左へ滑る
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: PLANK_THICKNESS, angleDeg: -SLOPE_ANGLE_DEG }],
    restitution: 0.2,
    friction: 0.03,
  },
  {
    id: 'slopeRight',
    label: 'みぎへ',
    cells: SINGLE_CELL,
    // ＼ の形。右端が下がるので、乗ったボールは右へ滑る
    segments: [{ offsetX: 0, offsetY: 0, width: SLOPE_LENGTH, height: PLANK_THICKNESS, angleDeg: SLOPE_ANGLE_DEG }],
    restitution: 0.2,
    friction: 0.03,
  },
]

const definitionsById = new Map(PART_DEFINITIONS.map((definition) => [definition.id, definition]))

/**
 * 種類IDからパーツ定義を引く。
 * 未知のIDはデータ不整合なので、国旗ボール(flagBalls.ts)と同じ方針で早期に throw する。
 */
export function partDefinition(id: PartTypeId): PartDefinition {
  const definition = definitionsById.get(id)
  if (!definition) throw new Error(`flag-roll-puzzle: 不明なパーツ種類です: ${id}`)
  return definition
}

/**
 * 選んだ板を回すときの次の向き。Phase 1の3種類はいずれも1マスを使うため、
 * 種類IDを循環させるだけで「よこ → 左上がり → 右上がり」が表せる。
 *
 * Phase 3で複数マスの板を足す場合も、この対応表へ利用可能な向きだけを追加すれば
 * placement.ts の占有判定をそのまま再利用できる。
 */
const NEXT_ROTATION_TYPE: Readonly<Record<PartTypeId, PartTypeId>> = {
  plank: 'slopeLeft',
  slopeLeft: 'slopeRight',
  slopeRight: 'plank',
}

export function nextRotationType(id: PartTypeId): PartTypeId {
  return NEXT_ROTATION_TYPE[id]
}
