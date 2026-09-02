/**
 * スポーツカーボディの外殻（ボンネット・フェンダー・キャビン・ガラス・リア）を
 * **1枚の連続したサーフェス**として生成する。
 *
 * ## なぜ専用ファイルなのか
 *
 * 以前のスポーツカーは「ロフト外殻 + フロントガラス板 + サイドガラス板 + 丸棒のピラー +
 * フェンダーのバンド + 箱のグリル」という **20個以上の独立メッシュの寄せ集め** だった。
 * 面が原理的につながっていないため、寸法をどれだけ調整しても
 * 「板を貼った窓」「載せたキャビン」「タイヤの上だけ膨らむフェンダー」から抜け出せなかった。
 *
 * ここでは造形方式そのものを変える。
 *
 * 1. 断面を「幅と高さのスケール」ではなく **プロファイル上の名前付き制御点** で定義する。
 *    ロッカー・くびれ・ヒップ（最大幅）・ショルダー・天面外周・天面中央を断面ごとに動かせる。
 *    とくに **天面中央を天面外周より低くできる** ため、目標とする
 *    「中央が低いノーズ／ボンネットの谷 + 高いフェンダークラウン」が作れる。
 * 2. フェンダーは独立パーツではなく **断面の最大幅へ加算する膨らみ関数**。
 *    前後輪から離れるほど滑らかに減衰するので、ボンネット／ドア／リアへ自然につながる。
 * 3. ホイールアーチは **断面のロッカー高さを円弧で押し上げて外殻に彫り込む**。
 * 4. 窓は別メッシュではなく **同じサーフェスのマテリアルグループ**。
 *    ガラス帯の頂点だけを内側へ沈めるので、窓が浅い開口部に収まって見え、
 *    A/B/Cピラーとルーフレールは「塗装のまま残った帯」＝面そのものになる。
 *
 * 座標系は carDimensions.ts と同じ（地面 y=0、車の前が +Z、+X が左側面）。
 */
import * as THREE from 'three'
import type { CarAttachments, CarDimensions } from './carDimensions'

/** 半断面のサンプル点数。リング全体は `HALF_SAMPLES * 2 - 2` 点になる。 */
const HALF_SAMPLES = 36
/**
 * 半断面サンプルのうち、ヒップ（最大幅）より下へ割り当てる割合。
 * 残りをショルダー〜グリーンハウス〜天面へ寄せる。窓とピラーの境界は
 * この帯の解像度がそのまま効くため、下面より上面を厚くサンプルする。
 */
const LOWER_SAMPLE_SHARE = 0.35
/** 断面補間の最大間隔（m）。断面数はこの値と設計断面の間隔から決まる。 */
const MAX_SECTION_STEP = 0.05
/** ガラス帯を外殻から内側へ沈める深さ（m）。窓の「貼り付け感」をここで消す。 */
const GLASS_INSET = 0.014
/** 前後端を丸く閉じるキャップのリング数。 */
const CAP_RINGS = 4
/** ノーズを丸く落とす奥行き。 */
const FRONT_CAP_DEPTH = 0.09
/** テールを閉じる奥行き。浅くして Kamm テールにする。 */
const REAR_CAP_DEPTH = 0.055

export const SPORTS_HULL_NAME = 'car-body-hull'
/** 塗装面のマテリアルグループ番号。 */
export const SPORTS_PAINT_GROUP = 0
/** ガラス面のマテリアルグループ番号。 */
export const SPORTS_GLASS_GROUP = 1
/** 開口部（フロントインテーク・リアディフューザー）のマテリアルグループ番号。 */
export const SPORTS_TRIM_GROUP = 2

/** 設計時に手で置く断面。幅は基準半幅（車幅の半分）に対する比で書く。 */
type SectionInput = {
  z: number
  /** 下面（断面の一番下・中央）の持ち上げ量。ノーズとテールで巻き上げる。 */
  floorLift: number
  /** ロッカー（サイドシル）の持ち上げ量。 */
  sillLift: number
  /** ロッカーの半幅比。ここを絞ると側面下部がタックインする。 */
  sill: number
  /** ロッカーとヒップの間の半幅比。ヒップより小さいとドア中央のくびれになる。 */
  waist: number
  /** 最大幅（ショルダーライン）の半幅比。フェンダーの膨らみは別途加算される。 */
  hip: number
  /** 最大幅の高さ。 */
  hipY: number
  /** 天面外周の半幅比。キャビンではグリーンハウス幅、ボンネットでは中央パネル幅。 */
  roof: number
  /** 天面外周の高さ − 天面中央の高さ。正＝ボンネットの谷、負＝丸いルーフ。 */
  topEdgeLift: number
  /** 天面中央の高さ。ルーフラインとボンネットラインの側面シルエットそのもの。 */
  crownY: number
}

/** 実寸へ展開した断面。プロファイル生成はこの形だけを見る。 */
type ResolvedSection = {
  z: number
  floorY: number
  floorHalfWidth: number
  sillHalfWidth: number
  sillY: number
  waistHalfWidth: number
  waistY: number
  hipHalfWidth: number
  hipY: number
  shoulderHalfWidth: number
  shoulderY: number
  roofHalfWidth: number
  roofEdgeY: number
  crownY: number
}

type Point2 = { x: number; y: number }

/** 半断面のサンプル結果。マスクを断面形状に対して相対的に定義するため u アンカーも返す。 */
type HalfProfile = {
  points: readonly Point2[]
  /** 各点の外向き法線（断面平面内）。ガラスを内側へ沈めるのに使う。 */
  normals: readonly Point2[]
  /** ロッカーの弧長比。フロントインテークなど下部開口の基準。 */
  sillU: number
  /** ヒップ（最大幅）の弧長比。ベルトラインの基準。 */
  hipU: number
  /** 天面外周の弧長比。ルーフレール／ガラス上端の基準。 */
  roofEdgeU: number
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  if (edge1 === edge0) return value < edge0 ? 0 : 1
  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** 区間 [start, end] の内側で1・外側で0になる滑らかな帯。 */
function smoothBand(value: number, start: number, end: number, feather: number): number {
  return smoothstep(start - feather, start + feather, value) * (1 - smoothstep(end - feather, end + feather, value))
}

function catmullRom2(p0: Point2, p1: Point2, p2: Point2, p3: Point2, t: number): Point2 {
  const t2 = t * t
  const t3 = t2 * t
  const axis = (a: number, b: number, c: number, d: number) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  return { x: axis(p0.x, p1.x, p2.x, p3.x), y: axis(p0.y, p1.y, p2.y, p3.y) }
}

/**
 * 断面の制御点列を Catmull-Rom で通し、**弧長で等間隔に** 再サンプルした半断面を返す。
 *
 * 端点（下面中央 / 天面中央）の仮想制御点には反対側のミラー点を使う。
 * こうすると x=0 で接線が水平になり、左右をミラーで貼り合わせても中央に折れが出ない。
 */
function sampleHalfProfile(section: ResolvedSection): HalfProfile {
  const control: Point2[] = [
    { x: 0, y: section.floorY },
    { x: section.floorHalfWidth, y: section.floorY },
    { x: section.sillHalfWidth, y: section.sillY },
    { x: section.waistHalfWidth, y: section.waistY },
    { x: section.hipHalfWidth, y: section.hipY },
    { x: section.shoulderHalfWidth, y: section.shoulderY },
    { x: section.roofHalfWidth, y: section.roofEdgeY },
    { x: 0, y: section.crownY },
  ]
  const first = control[0]!
  const second = control[1]!
  const last = control[control.length - 1]!
  const beforeLast = control[control.length - 2]!
  // 中央で水平接線になるよう、両端の仮想制御点は隣の点のミラー。
  const virtualHead: Point2 = { x: -second.x, y: second.y }
  const virtualTail: Point2 = { x: -beforeLast.x, y: beforeLast.y }

  // ホイールアーチのように制御点が大きく跳ねる断面では Catmull-Rom が
  // 設計範囲の外へオーバーシュートする（下面が地面へ潜る）。
  // 曲率だけを使いたいので、設計した範囲の箱へ必ず収める。
  const minX = 0
  const maxX = Math.max(...control.map((point) => point.x))
  const minY = Math.min(...control.map((point) => point.y))
  const maxY = Math.max(...control.map((point) => point.y))

  const dense: Point2[] = []
  // 制御点ごとの弧長位置（マスクを断面へ相対化するために記録する）。
  const controlArcIndex: number[] = [0]
  const stepsPerSegment = 14
  for (let index = 0; index < control.length - 1; index += 1) {
    const p0 = index === 0 ? virtualHead : control[index - 1]!
    const p1 = control[index]!
    const p2 = control[index + 1]!
    const p3 = index + 2 < control.length ? control[index + 2]! : virtualTail
    for (let step = 0; step < stepsPerSegment; step += 1) {
      const point = catmullRom2(p0, p1, p2, p3, step / stepsPerSegment)
      dense.push({ x: clamp(point.x, minX, maxX), y: clamp(point.y, minY, maxY) })
    }
    controlArcIndex.push(dense.length)
  }
  dense.push({ x: clamp(last.x, minX, maxX), y: clamp(last.y, minY, maxY) })

  const cumulative: number[] = [0]
  for (let index = 1; index < dense.length; index += 1) {
    const previous = dense[index - 1]!
    const current = dense[index]!
    cumulative.push(cumulative[index - 1]! + Math.hypot(current.x - previous.x, current.y - previous.y))
  }
  const total = cumulative[cumulative.length - 1] ?? 1
  const safeTotal = total > 1e-6 ? total : 1

  const pointAtArc = (target: number): Point2 => {
    let index = 1
    while (index < cumulative.length - 1 && cumulative[index]! < target) index += 1
    const before = cumulative[index - 1]!
    const after = cumulative[index]!
    const span = after - before
    const amount = span > 1e-9 ? (target - before) / span : 0
    const a = dense[index - 1]!
    const b = dense[index]!
    return { x: lerp(a.x, b.x, amount), y: lerp(a.y, b.y, amount) }
  }

  const hipFraction = clamp((cumulative[controlArcIndex[4]!] ?? 0) / safeTotal, 0.05, 0.95)
  const roofEdgeFraction = clamp((cumulative[controlArcIndex[6]!] ?? 0) / safeTotal, hipFraction, 1)
  const sillFraction = clamp((cumulative[controlArcIndex[2]!] ?? 0) / safeTotal, 0, hipFraction)
  /** サンプル番号（等間隔）→ 弧長比。ヒップを境に上側を密にサンプルする。 */
  const arcAt = (t: number): number =>
    t <= LOWER_SAMPLE_SHARE
      ? (t / LOWER_SAMPLE_SHARE) * hipFraction
      : hipFraction + ((t - LOWER_SAMPLE_SHARE) / (1 - LOWER_SAMPLE_SHARE)) * (1 - hipFraction)

  const points: Point2[] = []
  for (let index = 0; index < HALF_SAMPLES; index += 1) {
    points.push(pointAtArc(arcAt(index / (HALF_SAMPLES - 1)) * safeTotal))
  }
  points[0] = { x: 0, y: first.y }
  points[HALF_SAMPLES - 1] = { x: 0, y: last.y }

  const normals: Point2[] = points.map((_point, index) => {
    const previous = points[Math.max(0, index - 1)]!
    const next = points[Math.min(points.length - 1, index + 1)]!
    const tangentX = next.x - previous.x
    const tangentY = next.y - previous.y
    const length = Math.hypot(tangentX, tangentY)
    if (length < 1e-9) return { x: 1, y: 0 }
    // 下面中央から +X 側を上へ回る向きなので、(ty, -tx) が外向きになる。
    return { x: tangentY / length, y: -tangentX / length }
  })
  // マスクはサンプル番号の空間（u）で定義するため、アンカーも同じ空間へ写す。
  // ヒップは常に LOWER_SAMPLE_SHARE に固定されるので、断面が変わっても
  // ベルトラインの位置が前後で揺れない＝窓の境界がぎざぎざにならない。
  return {
    points,
    normals,
    sillU: (sillFraction / Math.max(1e-6, hipFraction)) * LOWER_SAMPLE_SHARE,
    hipU: LOWER_SAMPLE_SHARE,
    roofEdgeU: LOWER_SAMPLE_SHARE
      + ((roofEdgeFraction - hipFraction) / Math.max(1e-6, 1 - hipFraction)) * (1 - LOWER_SAMPLE_SHARE),
  }
}

/** 断面の設計値を実寸へ展開する。ここで自己交差しないよう順序をクランプする。 */
function resolveSection(input: SectionInput, baseHalfWidth: number, floorY: number): ResolvedSection {
  const sillY = floorY + input.sillLift
  const hipY = Math.max(sillY + 0.02, input.hipY)
  const roofEdgeY = input.crownY + input.topEdgeLift
  const hipHalfWidth = baseHalfWidth * input.hip
  const roofHalfWidth = Math.min(baseHalfWidth * input.roof, hipHalfWidth * 0.99)
  // ショルダーはヒップと天面外周の間。断面の外周が折り返さない範囲に収める。
  const shoulderY = lerp(hipY, roofEdgeY, 0.58)
  const shoulderHalfWidth = lerp(hipHalfWidth, roofHalfWidth, 0.45)

  return {
    z: input.z,
    floorY: floorY + input.floorLift,
    floorHalfWidth: baseHalfWidth * input.sill * 0.7,
    sillHalfWidth: Math.min(baseHalfWidth * input.sill, hipHalfWidth * 0.995),
    sillY,
    waistHalfWidth: Math.min(baseHalfWidth * input.waist, hipHalfWidth * 0.998),
    waistY: lerp(sillY, hipY, 0.68),
    hipHalfWidth,
    hipY,
    shoulderHalfWidth,
    shoulderY,
    roofHalfWidth,
    roofEdgeY,
    crownY: input.crownY,
  }
}

/**
 * スポーツカーの設計断面。前から後ろではなく **リア → フロント** の順（z 昇順）。
 *
 * `crownY` の列がそのまま側面シルエット（リアデッキ → ルーフ → フロントガラス → ボンネット → ノーズ）で、
 * `topEdgeLift` の符号がルーフの丸み（負）とボンネットの谷（正）を切り替える。
 */
function designSections(dimensions: CarDimensions): SectionInput[] {
  const half = dimensions.length / 2
  const hullTop = dimensions.hullTopY
  const roofTop = dimensions.roofTopY
  const cabinHalfLength = dimensions.cabinLength / 2
  const cabinRear = dimensions.cabinCenterZ - cabinHalfLength
  const cabinFront = dimensions.cabinCenterZ + cabinHalfLength
  const roofRear = cabinRear + dimensions.cabinLength * 0.19
  const roofFront = cabinFront - dimensions.cabinLength * 0.31
  const frontWheelZ = dimensions.wheelbase / 2
  const rearWheelZ = -frontWheelZ

  return [
    // --- リア端（Kammテール）。天面はルーフより明確に低く、幅を絞る。 -------
    { z: -half + REAR_CAP_DEPTH, floorLift: 0.15, sillLift: 0.235, sill: 0.62, waist: 0.72, hip: 0.79, hipY: hullTop - 0.075, roof: 0.70, topEdgeLift: -0.005, crownY: hullTop - 0.062 },
    { z: -half + 0.20, floorLift: 0.085, sillLift: 0.180, sill: 0.79, waist: 0.875, hip: 0.918, hipY: hullTop - 0.030, roof: 0.79, topEdgeLift: -0.008, crownY: hullTop - 0.010 },
    // --- リアデッキ〜リアフェンダー。ヒップを最大にする。 --------------------
    { z: -half + 0.36, floorLift: 0.040, sillLift: 0.150, sill: 0.845, waist: 0.935, hip: 0.985, hipY: hullTop + 0.002, roof: 0.83, topEdgeLift: -0.010, crownY: hullTop + 0.045 },
    { z: rearWheelZ - 0.22, floorLift: 0.014, sillLift: 0.140, sill: 0.855, waist: 0.945, hip: 1.005, hipY: hullTop + 0.016, roof: 0.85, topEdgeLift: -0.016, crownY: hullTop + 0.085 },
    { z: rearWheelZ, floorLift: 0, sillLift: 0.135, sill: 0.865, waist: 0.955, hip: 1.012, hipY: hullTop + 0.026, roof: 0.845, topEdgeLift: -0.024, crownY: hullTop + 0.150 },
    { z: rearWheelZ + 0.20, floorLift: 0, sillLift: 0.140, sill: 0.855, waist: 0.950, hip: 1.015, hipY: hullTop + 0.016, roof: 0.825, topEdgeLift: -0.034, crownY: hullTop + 0.235 },
    // --- Cピラー基部 → ルーフ後端。ヒップは張ったままルーフ幅へ絞る。 -------
    { z: rearWheelZ + 0.40, floorLift: 0, sillLift: 0.145, sill: 0.850, waist: 0.930, hip: 1.010, hipY: hullTop + 0.008, roof: 0.805, topEdgeLift: -0.044, crownY: hullTop + 0.345 },
    { z: roofRear, floorLift: 0, sillLift: 0.145, sill: 0.850, waist: 0.926, hip: 1.005, hipY: hullTop + 0.006, roof: 0.79, topEdgeLift: -0.048, crownY: hullTop + 0.412 },
    // --- キャビン。天面中央が最大＝ルーフ。タンブルホームで上へ絞る。 -------
    { z: lerp(roofRear, dimensions.cabinCenterZ, 0.45), floorLift: 0, sillLift: 0.145, sill: 0.848, waist: 0.906, hip: 1.000, hipY: hullTop + 0.004, roof: 0.785, topEdgeLift: -0.050, crownY: hullTop + 0.464 },
    { z: dimensions.cabinCenterZ, floorLift: 0, sillLift: 0.145, sill: 0.848, waist: 0.903, hip: 0.998, hipY: hullTop + 0.004, roof: 0.790, topEdgeLift: -0.050, crownY: roofTop },
    { z: lerp(dimensions.cabinCenterZ, roofFront, 0.5), floorLift: 0, sillLift: 0.142, sill: 0.850, waist: 0.906, hip: 1.000, hipY: hullTop + 0.006, roof: 0.785, topEdgeLift: -0.048, crownY: hullTop + 0.480 },
    { z: roofFront, floorLift: 0, sillLift: 0.140, sill: 0.852, waist: 0.912, hip: 1.005, hipY: hullTop + 0.010, roof: 0.755, topEdgeLift: -0.042, crownY: hullTop + 0.458 },
    // --- フロントガラス。天面中央が一気に落ちる＝寝たガラス面。 -------------
    { z: lerp(roofFront, cabinFront, 0.38), floorLift: 0, sillLift: 0.138, sill: 0.855, waist: 0.928, hip: 1.008, hipY: hullTop + 0.016, roof: 0.775, topEdgeLift: -0.026, crownY: hullTop + 0.322 },
    { z: lerp(roofFront, cabinFront, 0.78), floorLift: 0, sillLift: 0.135, sill: 0.858, waist: 0.930, hip: 1.010, hipY: hullTop + 0.022, roof: 0.790, topEdgeLift: -0.008, crownY: hullTop + 0.142 },
    // --- カウル（ガラス下端）。ここから天面外周が中央より高くなる＝谷の始まり。
    { z: cabinFront, floorLift: 0, sillLift: 0.133, sill: 0.858, waist: 0.930, hip: 1.010, hipY: hullTop + 0.024, roof: 0.785, topEdgeLift: 0.006, crownY: hullTop + 0.064 },
    // --- ボンネット。中央が低く、左右のフェンダー側が高い。 -----------------
    { z: lerp(cabinFront, frontWheelZ, 0.22), floorLift: 0, sillLift: 0.132, sill: 0.853, waist: 0.950, hip: 1.006, hipY: hullTop + 0.024, roof: 0.720, topEdgeLift: 0.030, crownY: hullTop + 0.044 },
    { z: lerp(cabinFront, frontWheelZ, 0.48), floorLift: 0, sillLift: 0.133, sill: 0.850, waist: 0.948, hip: 1.004, hipY: hullTop + 0.022, roof: 0.665, topEdgeLift: 0.048, crownY: hullTop + 0.034 },
    { z: lerp(cabinFront, frontWheelZ, 0.76), floorLift: 0, sillLift: 0.135, sill: 0.853, waist: 0.950, hip: 1.000, hipY: hullTop + 0.018, roof: 0.630, topEdgeLift: 0.056, crownY: hullTop + 0.024 },
    // --- 前輪まわり。フェンダークラウンが立ち上がる（膨らみは別途加算）。 ---
    { z: frontWheelZ, floorLift: 0, sillLift: 0.138, sill: 0.860, waist: 0.955, hip: 1.000, hipY: hullTop + 0.014, roof: 0.615, topEdgeLift: 0.060, crownY: hullTop + 0.014 },
    { z: frontWheelZ + 0.24, floorLift: 0.012, sillLift: 0.140, sill: 0.850, waist: 0.940, hip: 0.982, hipY: hullTop - 0.004, roof: 0.580, topEdgeLift: 0.052, crownY: hullTop - 0.008 },
    // --- ノーズ。中央を落としつつ、前端は丸い塊としてまとめる。 -------------
    { z: half - 0.32, floorLift: 0.032, sillLift: 0.142, sill: 0.825, waist: 0.900, hip: 0.940, hipY: hullTop - 0.022, roof: 0.530, topEdgeLift: 0.038, crownY: hullTop - 0.028 },
    { z: half - 0.19, floorLift: 0.066, sillLift: 0.144, sill: 0.785, waist: 0.850, hip: 0.878, hipY: hullTop - 0.056, roof: 0.470, topEdgeLift: 0.022, crownY: hullTop - 0.062 },
    { z: half - FRONT_CAP_DEPTH, floorLift: 0.112, sillLift: 0.156, sill: 0.695, waist: 0.750, hip: 0.780, hipY: hullTop - 0.098, roof: 0.380, topEdgeLift: 0.006, crownY: hullTop - 0.108 },
  ]
}

/** 前後輪から決まる、フェンダーの膨らみとホイールアーチの切り欠き。 */
type WheelShaping = {
  /** 断面の最大幅へ加算する膨らみ。 */
  bulge: (z: number) => number
  /** ロッカーを押し上げてタイヤを避けるアーチ高さ。無ければ null。 */
  archY: (z: number) => number | null
}

function wheelShaping(dimensions: CarDimensions, attachments: CarAttachments): WheelShaping {
  const baseHalfWidth = dimensions.width / 2
  const tireOuterX = dimensions.track / 2 + dimensions.wheelWidth / 2
  // フェンダーは必ずタイヤ外端を覆う。タイヤやトレッドが変わっても破綻しないよう、
  // 固定値ではなく attachment 由来のタイヤ外端から逆算する。
  const flare = Math.max(0.05, tireOuterX + 0.015 - baseHalfWidth)
  const wheels = [...attachments.wheels].filter((wheel) => wheel.side === 1)

  return {
    bulge: (z) => {
      let total = 0
      for (const wheel of wheels) {
        const forward = z > wheel.position.z
        // 前輪は前方（ノーズ）へ短く・後方（ドア）へ長く、後輪はその逆に減衰させる。
        const reach = wheel.end === 1
          ? (forward ? wheel.radius * 2.7 : wheel.radius * 3.5)
          : (forward ? wheel.radius * 3.3 : wheel.radius * 2.9)
        const t = clamp(Math.abs(z - wheel.position.z) / reach, 0, 1)
        const falloff = (1 - t * t) * (1 - t * t)
        total = Math.max(total, flare * falloff)
      }
      return total
    },
    archY: (z) => {
      let top: number | null = null
      for (const wheel of wheels) {
        const archRadius = wheel.radius * 1.36
        const dz = z - wheel.position.z
        if (Math.abs(dz) >= archRadius) continue
        const value = wheel.position.y + Math.sqrt(archRadius * archRadius - dz * dz)
        top = top === null ? value : Math.max(top, value)
      }
      return top
    },
  }
}

/**
 * 任意の z に対して断面を返す関数を作る。
 * 設計断面の間は Catmull-Rom で補間し、そのうえでフェンダーの膨らみと
 * ホイールアーチを「z の連続関数」として適用する。
 * 設計断面の置き方に関係なくアーチが滑らかに出るのがこの順序の狙い。
 */
function createSectionResolver(
  dimensions: CarDimensions,
  attachments: CarAttachments,
): (z: number) => ResolvedSection {
  const design = designSections(dimensions)
  const baseHalfWidth = dimensions.width / 2
  const shaping = wheelShaping(dimensions, attachments)

  const keys = [
    'floorLift', 'sillLift', 'sill', 'waist', 'hip', 'hipY', 'roof', 'topEdgeLift', 'crownY',
  ] as const

  return (z: number) => {
    // 設計断面の間は Catmull-Rom で補間する。断面の境目が陰影の筋にならない。
    let index = 0
    while (index < design.length - 2 && design[index + 1]!.z < z) index += 1
    const p1 = design[index]!
    const p2 = design[index + 1]!
    const p0 = design[index - 1] ?? p1
    const p3 = design[index + 2] ?? p2
    const span = p2.z - p1.z
    const t = span > 1e-9 ? clamp((z - p1.z) / span, 0, 1) : 0
    const t2 = t * t
    const t3 = t2 * t

    const interpolated = {} as Record<(typeof keys)[number], number>
    for (const key of keys) {
      const a = p0[key]
      const b = p1[key]
      const c = p2[key]
      const d = p3[key]
      const value = 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      // 設計した範囲の外へオーバーシュートさせない。曲率だけを滑らかにする。
      interpolated[key] = clamp(value, Math.min(b, c), Math.max(b, c))
    }

    const bulge = shaping.bulge(z)
    const arch = shaping.archY(z)
    const input: SectionInput = {
      z,
      floorLift: interpolated.floorLift,
      sillLift: interpolated.sillLift,
      sill: interpolated.sill,
      waist: interpolated.waist,
      hip: interpolated.hip,
      // フェンダーの膨らみは幅だけでなくショルダーの高さも少し押し上げる。
      hipY: interpolated.hipY + bulge * 0.32,
      roof: interpolated.roof,
      topEdgeLift: interpolated.topEdgeLift,
      crownY: interpolated.crownY,
    }

    const resolved = resolveSection(input, baseHalfWidth, dimensions.bodyFloorY)
    resolved.hipHalfWidth += bulge
    resolved.shoulderHalfWidth += bulge * 0.30
    resolved.waistHalfWidth += bulge * 0.45
    resolved.sillHalfWidth += bulge * 0.55

    if (arch !== null) {
      // ホイールアーチ：ロッカーを円弧まで押し上げ、外側へ寄せて外殻へ彫り込む。
      const archLip = Math.min(arch + 0.02, resolved.hipY - 0.012)
      resolved.sillY = Math.max(resolved.sillY, archLip)
      resolved.sillHalfWidth = Math.max(resolved.sillHalfWidth, resolved.hipHalfWidth * 0.985)
      resolved.floorHalfWidth = Math.max(resolved.floorHalfWidth, resolved.hipHalfWidth * 0.62)
      resolved.hipY = Math.max(resolved.hipY, arch + 0.05)
      resolved.waistY = lerp(resolved.sillY, resolved.hipY, 0.68)
      resolved.waistHalfWidth = Math.max(resolved.waistHalfWidth, resolved.hipHalfWidth * 0.992)
    }
    resolved.shoulderY = lerp(resolved.hipY, resolved.roofEdgeY, 0.58)
    return resolved
  }
}

/** 設計断面を z 方向へ補間した、メッシュ化用の細かい断面列。 */
function buildResolvedSections(
  dimensions: CarDimensions,
  attachments: CarAttachments,
): ResolvedSection[] {
  const design = designSections(dimensions)
  const resolveAt = createSectionResolver(dimensions, attachments)

  const zSamples: number[] = []
  for (let index = 0; index < design.length - 1; index += 1) {
    const current = design[index]!
    const next = design[index + 1]!
    const steps = Math.max(1, Math.ceil((next.z - current.z) / MAX_SECTION_STEP))
    for (let step = 0; step < steps; step += 1) zSamples.push(lerp(current.z, next.z, step / steps))
  }
  zSamples.push(design[design.length - 1]!.z)

  return zSamples.map(resolveAt)
}

/**
 * 外殻サーフェス上の1点を返す。
 * ヘッドライトのように「ボディ面の上に置きたい」小物が、寸法から座標を
 * 推測して浮いたり埋まったりしないよう、面そのものを問い合わせられるようにする。
 *
 * @param u 断面内の位置（0 = 下面中央、1 = 天面中央）。
 */
export function sportsSurfacePoint(
  dimensions: CarDimensions,
  attachments: CarAttachments,
  z: number,
  u: number,
): { position: THREE.Vector3; normal: THREE.Vector3 } {
  const section = createSectionResolver(dimensions, attachments)(z)
  const profile = sampleHalfProfile(section)
  const index = clamp(Math.round(u * (HALF_SAMPLES - 1)), 0, HALF_SAMPLES - 1)
  const point = profile.points[index]!
  const normal = profile.normals[index]!
  return {
    position: new THREE.Vector3(point.x, point.y, z),
    normal: new THREE.Vector3(normal.x, normal.y, 0).normalize(),
  }
}

/**
 * ガラス領域のマスク。0 = 塗装、1 = ガラス。
 *
 * グリーンハウス（キャビン上部）をひとつの領域として取り、そこから
 * ルーフパネル・Aピラー・Bピラー・Cピラーを引き算する。
 * こうすると窓とピラーが必ず同じサーフェス上で切り替わり、
 * ピラーは「別に置いた棒」ではなく「塗装のまま残った面の帯」になる。
 */
type SurfaceMask = {
  /** 塗装／ガラス／開口のどれにするか。面の割り当ては 0 か 1 だけを使う。 */
  glass: number
  trim: number
  /** 外殻から内側へ沈める量（0〜1）。境界を滑らかな溝として見せる。 */
  depth: number
}

/**
 * 断面内の境界 u を「サンプル番号の中間」へ吸着させる。
 *
 * 境界が断面ごとに 0.4 セルでも前後すると、面ごとの判定がセルをまたいで反転し、
 * 窓の縁がのこぎり状になる。サンプル番号の中間へ吸着させると、境界は必ず
 * グリッド線に沿った直線になり、ギザギザが構造的に発生しなくなる。
 */
function snapToSampleEdge(u: number): number {
  const steps = HALF_SAMPLES - 1
  return (Math.round(u * steps - 0.5) + 0.5) / steps
}

function makeSurfaceMask(dimensions: CarDimensions) {
  const half = dimensions.length / 2
  const cabinHalfLength = dimensions.cabinLength / 2
  const cabinRear = dimensions.cabinCenterZ - cabinHalfLength
  const cabinFront = dimensions.cabinCenterZ + cabinHalfLength
  const roofRear = cabinRear + dimensions.cabinLength * 0.19
  const roofFront = cabinFront - dimensions.cabinLength * 0.31
  const bPillarZ = lerp(roofRear, roofFront, 0.46)

  // グリーンハウスの前後端。リアはCピラーの手前で止め、リアフェンダーの
  // 断面が大きく動く帯までガラスを伸ばさない。
  const greenhouseRear = cabinRear + 0.02
  const greenhouseFront = cabinFront - 0.03

  // サンプルの割り当てで hipU は常に LOWER_SAMPLE_SHARE に固定されるため、
  // ベルトライン・ルーフレール・天面の境界も断面に依らない定数で置ける。
  const upper = (ratio: number) => snapToSampleEdge(LOWER_SAMPLE_SHARE + (1 - LOWER_SAMPLE_SHARE) * ratio)
  const beltU = upper(0.10)
  const railU = upper(0.44)
  const roofU = upper(0.49)
  const uFeather = 1.4 / (HALF_SAMPLES - 1)

  const inside = (value: number, start: number, end: number) => (value > start && value < end ? 1 : 0)

  return (z: number, u: number, x: number, y: number): SurfaceMask => {
    const sideZFront = greenhouseFront - 0.11
    const sideZRear = greenhouseRear + 0.10

    // 天面帯（フロントガラス・ルーフ・リアガラス）。ルーフパネルは塗装で残す。
    const topGlass = u > roofU
      && inside(z, greenhouseRear - 0.02, greenhouseFront)
      && !(z > roofRear && z < roofFront)
    // サイド帯。前後端は z 一定、上下端は u 一定なので境界が必ず直線になる。
    const sideGlass = u > beltU && u < railU
      && inside(z, sideZRear, sideZFront)
      && !(z > bPillarZ - 0.05 && z < bPillarZ + 0.05)

    // フロント下の開口とリアのディフューザー。箱を貼らず外殻の面で作る。
    // 弧長ではなく実座標で切ることで、ノーズの回り込みへ黒帯が巻き上がらない。
    const intakeTop = dimensions.bodyFloorY + dimensions.hullHeight * 0.46
    const intakeBottom = dimensions.bodyFloorY + dimensions.hullHeight * 0.10
    const intake = z > half - 0.30 && Math.abs(x) < dimensions.width * 0.40
      && y < intakeTop && y > intakeBottom
    const diffuserTop = dimensions.bodyFloorY + dimensions.hullHeight * 0.34
    const diffuser = z < -half + 0.24 && Math.abs(x) < dimensions.width * 0.42
      && y < diffuserTop && y > dimensions.bodyFloorY + dimensions.hullHeight * 0.04

    const glass = topGlass || sideGlass ? 1 : 0
    const trim = !glass && (intake || diffuser) ? 1 : 0

    // 沈み込みだけは滑らかにして、境界を陰の溝として読ませる。
    const softTop = Math.min(
      smoothstep(roofU - uFeather, roofU + uFeather, u),
      smoothBand(z, greenhouseRear - 0.02, greenhouseFront, 0.03),
      1 - smoothBand(z, roofRear, roofFront, 0.03),
    )
    const softSide = Math.min(
      smoothstep(beltU - uFeather, beltU + uFeather, u),
      1 - smoothstep(railU - uFeather, railU + uFeather, u),
      smoothBand(z, sideZRear, sideZFront, 0.03),
      1 - smoothBand(z, bPillarZ - 0.05, bPillarZ + 0.05, 0.02),
    )
    const softTrim = Math.max(
      Math.min(
        smoothBand(y, intakeBottom, intakeTop, 0.03),
        smoothstep(half - 0.34, half - 0.26, z),
        1 - smoothstep(dimensions.width * 0.34, dimensions.width * 0.42, Math.abs(x)),
      ),
      Math.min(
        smoothBand(y, dimensions.bodyFloorY + dimensions.hullHeight * 0.04, diffuserTop, 0.03),
        1 - smoothstep(-half + 0.20, -half + 0.28, z),
        1 - smoothstep(dimensions.width * 0.36, dimensions.width * 0.44, Math.abs(x)),
      ),
    )

    return {
      glass,
      trim,
      depth: clamp(Math.max(softTop, softSide, softTrim * 0.85), 0, 1),
    }
  }
}

export type SportsHullResult = {
  mesh: THREE.Mesh
  /** ガラス面の三角形数。0 なら窓が生成できていない。 */
  glassTriangleCount: number
  /** 開口部（インテーク・ディフューザー）面の三角形数。 */
  trimTriangleCount: number
  /** 全三角形数。モバイル性能のガードに使う。 */
  triangleCount: number
}

/**
 * スポーツカーの外殻を1つの Mesh として生成する。
 * マテリアルは `[塗装, ガラス]` の2要素で、ガラス面は同じサーフェス上のグループになる。
 */
export function createSportsHull(
  dimensions: CarDimensions,
  attachments: CarAttachments,
  paintMaterial: THREE.Material,
  glassMaterial: THREE.Material,
  trimMaterial: THREE.Material,
): SportsHullResult {
  const sections = buildResolvedSections(dimensions, attachments)
  const mask = makeSurfaceMask(dimensions)
  const ringSize = HALF_SAMPLES * 2 - 2

  const positions: number[] = []
  /** リング頂点ごとのガラス／開口マスク値。面のマテリアル判定に使う。 */
  const glassValues: number[] = []
  const trimValues: number[] = []

  const profiles = sections.map((section) => sampleHalfProfile(section))
  const pushRing = (section: ResolvedSection, sectionIndex: number) => {
    const profile = profiles[sectionIndex]!
    const half: { x: number; y: number; glass: number; trim: number }[] = []
    for (let index = 0; index < HALF_SAMPLES; index += 1) {
      const point = profile.points[index]!
      const normal = profile.normals[index]!
      const u = index / (HALF_SAMPLES - 1)
      const value = mask(section.z, u, point.x, point.y)
      // ガラスと開口だけを外殻の内側へ沈める。浅い窪みの中に収まって見える。
      const depth = GLASS_INSET * value.depth
      half.push({
        x: point.x - normal.x * depth,
        y: point.y - normal.y * depth,
        glass: value.glass,
        trim: value.trim,
      })
    }
    // +X 側を下から上へ、そのあと -X 側を上から下へ。左右対称を構造的に保証する。
    for (let index = 0; index < HALF_SAMPLES; index += 1) {
      const entry = half[index]!
      positions.push(entry.x, entry.y, section.z)
      glassValues.push(entry.glass)
      trimValues.push(entry.trim)
    }
    for (let index = HALF_SAMPLES - 2; index >= 1; index -= 1) {
      const entry = half[index]!
      positions.push(-entry.x, entry.y, section.z)
      glassValues.push(entry.glass)
      trimValues.push(entry.trim)
    }
  }

  sections.forEach((section, index) => pushRing(section, index))

  /**
   * 前後端を丸く閉じる。最後のリングを重心へ向けて四分円状に縮めながら
   * z を進めるので、平らな切り口ではなく丸いノーズ／テールになる。
   */
  const appendCap = (ringIndex: number, direction: 1 | -1, depth: number): number[][] => {
    const start = ringIndex * ringSize
    let centerX = 0
    let centerY = 0
    for (let index = 0; index < ringSize; index += 1) {
      centerX += positions[(start + index) * 3]!
      centerY += positions[(start + index) * 3 + 1]!
    }
    centerX /= ringSize
    centerY /= ringSize
    const baseZ = positions[start * 3 + 2]!

    const rings: number[][] = []
    for (let capIndex = 1; capIndex <= CAP_RINGS; capIndex += 1) {
      const angle = (capIndex / CAP_RINGS) * (Math.PI / 2)
      const scale = Math.cos(angle)
      const z = baseZ + direction * depth * Math.sin(angle)
      const ring: number[] = []
      for (let index = 0; index < ringSize; index += 1) {
        const source = (start + index) * 3
        ring.push(positions.length / 3)
        positions.push(
          centerX + (positions[source]! - centerX) * scale,
          centerY + (positions[source + 1]! - centerY) * scale,
          z,
        )
        glassValues.push(glassValues[start + index]! * scale)
        trimValues.push(trimValues[start + index]!)
      }
      rings.push(ring)
    }
    return rings
  }

  const rearCap = appendCap(0, -1, REAR_CAP_DEPTH)
  const frontCap = appendCap(sections.length - 1, 1, FRONT_CAP_DEPTH)

  const paintIndices: number[] = []
  const glassIndices: number[] = []
  const trimIndices: number[] = []

  const addQuad = (a: number, b: number, c: number, d: number) => {
    // a=現リングj, b=次リングj, c=現リングj+1, d=次リングj+1。
    // リングが +X 側を上へ回る向きなので、この順で法線が外を向く。
    const glass = (glassValues[a]! + glassValues[b]! + glassValues[c]! + glassValues[d]!) / 4
    const trim = (trimValues[a]! + trimValues[b]! + trimValues[c]! + trimValues[d]!) / 4
    const target = glass > 0.5 ? glassIndices : trim > 0.5 ? trimIndices : paintIndices
    target.push(a, c, b, c, d, b)
  }

  const ringStart = (index: number) => index * ringSize
  for (let sectionIndex = 0; sectionIndex < sections.length - 1; sectionIndex += 1) {
    const current = ringStart(sectionIndex)
    const next = ringStart(sectionIndex + 1)
    for (let vertexIndex = 0; vertexIndex < ringSize; vertexIndex += 1) {
      const nextVertex = (vertexIndex + 1) % ringSize
      addQuad(current + vertexIndex, next + vertexIndex, current + nextVertex, next + nextVertex)
    }
  }

  const stitchCap = (baseRingIndex: number, capRings: number[][], flip: boolean) => {
    let previous = Array.from({ length: ringSize }, (_, index) => ringStart(baseRingIndex) + index)
    for (const ring of capRings) {
      for (let vertexIndex = 0; vertexIndex < ringSize; vertexIndex += 1) {
        const nextVertex = (vertexIndex + 1) % ringSize
        const a = previous[vertexIndex]!
        const b = ring[vertexIndex]!
        const c = previous[nextVertex]!
        const d = ring[nextVertex]!
        if (flip) addQuad(b, a, d, c)
        else addQuad(a, b, c, d)
      }
      previous = ring
    }
  }

  // リアキャップは -Z へ進むので、面の向きが裏返らないよう順序を入れ替える。
  stitchCap(0, rearCap, true)
  stitchCap(sections.length - 1, frontCap, false)

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex([...paintIndices, ...glassIndices, ...trimIndices])
  geometry.addGroup(0, paintIndices.length, SPORTS_PAINT_GROUP)
  geometry.addGroup(paintIndices.length, glassIndices.length, SPORTS_GLASS_GROUP)
  geometry.addGroup(paintIndices.length + glassIndices.length, trimIndices.length, SPORTS_TRIM_GROUP)
  geometry.computeVertexNormals()

  const mesh = new THREE.Mesh(geometry, [paintMaterial, glassMaterial, trimMaterial])
  mesh.name = SPORTS_HULL_NAME
  mesh.castShadow = true
  // 外殻自身の細い面をシャドウマップへ戻すと塗装面に自己影の筋が出る。
  // 地面へは影を落としつつ、面の滑らかさを優先する。
  mesh.receiveShadow = false

  return {
    mesh,
    glassTriangleCount: glassIndices.length / 3,
    trimTriangleCount: trimIndices.length / 3,
    triangleCount: (paintIndices.length + glassIndices.length + trimIndices.length) / 3,
  }
}
