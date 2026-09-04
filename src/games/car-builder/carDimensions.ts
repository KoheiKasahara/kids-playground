/**
 * 車両寸法とattachment point（取り付け基準位置）の計算。three.jsに依存しない純粋関数。
 *
 * 後続Issueで足すパーツ（フロント・屋根・飾り・マークなど）は、座標をベタ書きせず
 * 必ずここが返す `CarDimensions` / `CarAttachments` を基準に配置する。
 * これにより「ボディを増やす」「タイヤを大きくする」「車高を変える」のどれをしても、
 * 各パーツ側を個別に直さずに追従できる。
 *
 * 座標系の約束:
 *   - 地面は y = 0。上が +Y。
 *   - 車の前（ボンネット側）は +Z。左右は X（+X が車体の左側面）。
 *   - 原点は車体の中心（前後・左右の中心）で、車は常に原点に置く。
 */
import type { BodyType, CarConfig, RideHeight, WheelType } from './carConfig'

export type CarVec3 = { x: number; y: number; z: number }
export type CarBodyStyle = 'sports' | 'suv' | 'bus' | 'truck' | 'police'

/** ボディ種別ごとの素の寸法と、ボディ形状を組み立てるための少量の基準値。 */
export type CarBodySpec = {
  id: BodyType
  style: CarBodyStyle
  /** 車体全長（Z方向）。 */
  length: number
  /** 車幅（X方向、タイヤを含まないボディ本体の幅）。 */
  width: number
  /** 下段（ボンネット〜荷台）の高さ。 */
  hullHeight: number
  /** 上段（キャビン）の高さ。 */
  cabinHeight: number
  /** キャビンの前後長 ÷ 全長。 */
  cabinLengthRatio: number
  /** キャビン中心のZ位置 ÷ 全長（+で前寄り）。 */
  cabinCenterRatio: number
  /** キャビン幅 ÷ 車幅。 */
  cabinWidthRatio: number
  /** 前端からボンネットとして見せる長さ ÷ 全長。 */
  hoodLengthRatio: number
  /** ホイールベース ÷ 全長。 */
  wheelbaseRatio: number
  /** 素の最低地上高。実際の値はタイヤ半径と車高でクランプされる。 */
  baseGroundClearance: number
  /**
   * タイヤの内側をボディ側面へ入れ込む量。未指定なら `DEFAULT_WHEEL_INSET`。
   * スポーツカーだけはフェンダーを断面の膨らみとして作るため、
   * タイヤを少し内側へ寄せて「張り出しすぎないフェンダー」に収める。
   */
  wheelInset?: number
}

export type CarWheelSpec = {
  id: WheelType
  /** タイヤ半径。 */
  radius: number
  /** タイヤの厚み（X方向）。 */
  width: number
}

export type CarRideHeightSpec = {
  id: RideHeight
  /** 最低地上高への上乗せ量。 */
  lift: number
}

export const CAR_BODY_SPECS: Record<BodyType, CarBodySpec> = {
  sports: {
    id: 'sports',
    style: 'sports',
    // 幅に対して短く「ずんぐり」して見えていたため、全長を伸ばして車幅を絞る。
    // 車幅はフェンダーが膨らむ前の基準幅で、実際の最大幅は断面のヒップで決まる。
    length: 4.32,
    width: 1.86,
    // 下段に厚みを持たせて「低い板の上にキャビンを載せた」印象を消し、
    // 上段（キャビン）はガラスが台形として成立する高さまで確保する。
    hullHeight: 0.55,
    cabinHeight: 0.52,
    cabinLengthRatio: 0.445,
    cabinCenterRatio: -0.05,
    cabinWidthRatio: 0.8,
    hoodLengthRatio: 0.29,
    wheelbaseRatio: 0.665,
    baseGroundClearance: 0.18,
    wheelInset: 0.12,
  },
  suv: {
    id: 'suv',
    style: 'suv',
    length: 4.35,
    width: 1.92,
    hullHeight: 0.72,
    cabinHeight: 0.6,
    cabinLengthRatio: 0.56,
    cabinCenterRatio: -0.04,
    cabinWidthRatio: 0.9,
    hoodLengthRatio: 0.3,
    wheelbaseRatio: 0.61,
    baseGroundClearance: 0.2,
  },
  bus: {
    id: 'bus',
    style: 'bus',
    length: 6.4,
    width: 2.05,
    hullHeight: 0.8,
    cabinHeight: 0.88,
    cabinLengthRatio: 0.8,
    cabinCenterRatio: -0.02,
    cabinWidthRatio: 0.92,
    hoodLengthRatio: 0.02,
    wheelbaseRatio: 0.78,
    baseGroundClearance: 0.24,
  },
  truck: {
    id: 'truck',
    style: 'truck',
    length: 5.35,
    width: 2.0,
    hullHeight: 0.76,
    cabinHeight: 0.66,
    cabinLengthRatio: 0.34,
    cabinCenterRatio: 0.25,
    cabinWidthRatio: 0.92,
    hoodLengthRatio: 0.22,
    wheelbaseRatio: 0.72,
    baseGroundClearance: 0.22,
  },
  police: {
    id: 'police',
    style: 'police',
    length: 4.4,
    width: 1.84,
    hullHeight: 0.62,
    cabinHeight: 0.54,
    cabinLengthRatio: 0.52,
    cabinCenterRatio: -0.04,
    cabinWidthRatio: 0.84,
    hoodLengthRatio: 0.28,
    wheelbaseRatio: 0.62,
    baseGroundClearance: 0.18,
  },
}

export const CAR_WHEEL_SPECS: Record<WheelType, CarWheelSpec> = {
  // 「小さい」は既存の標準タイヤの寸法を引き継ぎ、車体の基本プロポーションを変えない。
  small: { id: 'small', radius: 0.34, width: 0.26 },
  big: { id: 'big', radius: 0.46, width: 0.34 },
  // 外周のトレッドブロックを含めてもボディを過度に圧迫しない範囲で、最も太くする。
  offroad: { id: 'offroad', radius: 0.5, width: 0.42 },
  // 半径は小さい側に保ち、幅とリムの比率でレーシングらしさを出す。
  racing: { id: 'racing', radius: 0.36, width: 0.34 },
}

export const CAR_RIDE_HEIGHT_SPECS: Record<RideHeight, CarRideHeightSpec> = {
  normal: { id: 'normal', lift: 0 },
  high: { id: 'high', lift: 0.18 },
}

/**
 * タイヤがボディへめり込まないための下限。
 * 「タイヤ上端の 92% までは必ずボディ下段の中に収まる」＝ 大きいタイヤを選ぶと
 * ボディ底面が自動的に持ち上がる、という関係をここ1か所で決めている。
 */
const HULL_TOP_OVER_WHEEL_RATIO = 0.92
/** タイヤ半径に対する最低地上高の下限比。低い車高でも車体が地面に潜らない。 */
const MIN_CLEARANCE_RATIO = 0.35
/** タイヤ半径に対する最低地上高の上限比。高い車高でも竹馬のようにならない。 */
const MAX_CLEARANCE_RATIO = 1.05
/** タイヤの内側をボディ側面へどれだけ入れ込むか。トレッドはこの値から決まる。 */
export const DEFAULT_WHEEL_INSET = 0.08

export type CarWheelAttachmentId = 'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight'

export type CarWheelAttachment = {
  id: CarWheelAttachmentId
  /** タイヤ中心のワールド座標。 */
  position: CarVec3
  radius: number
  width: number
  /** +1 = 左（+X）側、-1 = 右（-X）側。 */
  side: 1 | -1
  /** +1 = 前輪、-1 = 後輪。 */
  end: 1 | -1
}

export type CarAttachment = {
  position: CarVec3
  /** 面の外向き法線。パーツはこの向きに合わせて置く。 */
  normal: CarVec3
  size: { width: number; extent: number }
}

export type CarAttachments = {
  /** 前面（ライト・グリル・前ナンバー）。 */
  front: CarAttachment
  /** 後面（後ナンバー・テールランプ）。 */
  rear: CarAttachment
  /** ルーフ天面（キャリア・ライトバーなど）。 */
  roof: CarAttachment
  /** 左側面（ステッカー・飾り）。 */
  sideLeft: CarAttachment
  /** 右側面（ステッカー・飾り）。 */
  sideRight: CarAttachment
  /** 4輪の取り付け位置。 */
  wheels: readonly CarWheelAttachment[]
}

export type CarDimensions = {
  bodyType: BodyType
  bodyStyle: CarBodyStyle
  /** 車両全長。 */
  length: number
  /** 車幅（ボディ本体）。 */
  width: number
  /** 全高（地面からルーフ天面まで）。 */
  height: number
  /** タイヤも含めた最大幅。 */
  overallWidth: number
  /** ホイールベース。 */
  wheelbase: number
  /** トレッド（左右タイヤ中心の間隔）。 */
  track: number
  /** タイヤ半径。 */
  wheelRadius: number
  /** タイヤの厚み。 */
  wheelWidth: number
  /** 最低地上高（＝ボディ底面高さ）。 */
  groundClearance: number
  /** ボディ底面のY。 */
  bodyFloorY: number
  /** ボディ下段の天面Y。 */
  hullTopY: number
  /** ルーフ天面Y。 */
  roofTopY: number
  /** ボディ下段の高さ。 */
  hullHeight: number
  /** キャビンの高さ。 */
  cabinHeight: number
  /** キャビンの前後長。 */
  cabinLength: number
  /** キャビン中心のZ。 */
  cabinCenterZ: number
  /** キャビンの幅。 */
  cabinWidth: number
  /** ボンネットとして見せる前方部分の長さ。 */
  hoodLength: number
  /** 前後のオーバーハング。 */
  frontOverhang: number
  rearOverhang: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** タイヤ半径・ボディ・車高から、破綻しない最低地上高を決める。 */
export function computeGroundClearance(
  body: CarBodySpec,
  wheel: CarWheelSpec,
  ride: CarRideHeightSpec,
): number {
  const wheelTop = wheel.radius * 2
  const minClearance = Math.max(
    wheel.radius * MIN_CLEARANCE_RATIO,
    wheelTop * HULL_TOP_OVER_WHEEL_RATIO - body.hullHeight,
  )
  const maxClearance = wheel.radius * MAX_CLEARANCE_RATIO
  return clamp(body.baseGroundClearance + ride.lift, minClearance, Math.max(minClearance, maxClearance))
}

/** CarConfig から車両寸法を計算する。ここが寸法の唯一の出どころ。 */
export function computeCarDimensions(config: CarConfig): CarDimensions {
  const body = CAR_BODY_SPECS[config.body]
  const wheel = CAR_WHEEL_SPECS[config.wheel]
  const ride = CAR_RIDE_HEIGHT_SPECS[config.rideHeight]

  const groundClearance = computeGroundClearance(body, wheel, ride)
  const hullTopY = groundClearance + body.hullHeight
  const roofTopY = hullTopY + body.cabinHeight
  const track = body.width + wheel.width - (body.wheelInset ?? DEFAULT_WHEEL_INSET) * 2

  return {
    bodyType: body.id,
    bodyStyle: body.style,
    length: body.length,
    width: body.width,
    height: roofTopY,
    overallWidth: track + wheel.width,
    wheelbase: body.length * body.wheelbaseRatio,
    track,
    wheelRadius: wheel.radius,
    wheelWidth: wheel.width,
    groundClearance,
    bodyFloorY: groundClearance,
    hullTopY,
    roofTopY,
    hullHeight: body.hullHeight,
    cabinHeight: body.cabinHeight,
    cabinLength: body.length * body.cabinLengthRatio,
    cabinCenterZ: body.length * body.cabinCenterRatio,
    cabinWidth: body.width * body.cabinWidthRatio,
    hoodLength: body.length * body.hoodLengthRatio,
    frontOverhang: (body.length - body.length * body.wheelbaseRatio) / 2,
    rearOverhang: (body.length - body.length * body.wheelbaseRatio) / 2,
  }
}

/** 車両寸法から、各カテゴリのパーツが使う取り付け基準を計算する。 */
export function computeCarAttachments(dimensions: CarDimensions): CarAttachments {
  const halfLength = dimensions.length / 2
  const halfWidth = dimensions.width / 2
  const faceCenterY = dimensions.bodyFloorY + dimensions.hullHeight * 0.55

  const wheels: CarWheelAttachment[] = ([1, -1] as const).flatMap((end) =>
    ([1, -1] as const).map((side) => ({
      id: (end === 1
        ? side === 1
          ? 'frontLeft'
          : 'frontRight'
        : side === 1
          ? 'rearLeft'
          : 'rearRight') as CarWheelAttachmentId,
      position: {
        x: (side * dimensions.track) / 2,
        y: dimensions.wheelRadius,
        z: (end * dimensions.wheelbase) / 2,
      },
      radius: dimensions.wheelRadius,
      width: dimensions.wheelWidth,
      side,
      end,
    })),
  )

  return {
    front: {
      position: { x: 0, y: faceCenterY, z: halfLength },
      normal: { x: 0, y: 0, z: 1 },
      size: { width: dimensions.width, extent: dimensions.hullHeight },
    },
    rear: {
      position: { x: 0, y: faceCenterY, z: -halfLength },
      normal: { x: 0, y: 0, z: -1 },
      size: { width: dimensions.width, extent: dimensions.hullHeight },
    },
    roof: {
      position: { x: 0, y: dimensions.roofTopY, z: dimensions.cabinCenterZ },
      normal: { x: 0, y: 1, z: 0 },
      size: { width: dimensions.cabinWidth, extent: dimensions.cabinLength },
    },
    sideLeft: {
      position: { x: halfWidth, y: faceCenterY, z: 0 },
      normal: { x: 1, y: 0, z: 0 },
      size: { width: dimensions.length, extent: dimensions.hullHeight },
    },
    sideRight: {
      position: { x: -halfWidth, y: faceCenterY, z: 0 },
      normal: { x: -1, y: 0, z: 0 },
      size: { width: dimensions.length, extent: dimensions.hullHeight },
    },
    wheels,
  }
}

/**
 * 車全体を収める球の半径。カメラ距離のフィットに使う。
 * 球なので回転しても大きさが変わらず、どの向きでも車が切れない。
 * 後続カテゴリのパーツが少しはみ出しても収まるよう、わずかに余裕を持たせている。
 */
export function carBoundingRadius(dimensions: CarDimensions): number {
  const halfLength = dimensions.length / 2
  const halfWidth = dimensions.overallWidth / 2
  const halfHeight = dimensions.height / 2
  return Math.hypot(halfLength, halfWidth, halfHeight) * 1.02
}
