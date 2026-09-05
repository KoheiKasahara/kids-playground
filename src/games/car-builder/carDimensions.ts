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
import { CAR_VEHICLES, type CarVehicleDefinition } from './carVehicles'

export type CarVec3 = { x: number; y: number; z: number }

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
  // 「ひくい」はボディを接地基準へ近づける。大径タイヤなどで
  // これ以上下げるとめり込む場合は computeGroundClearance の下限で止める。
  low: { id: 'low', lift: -0.12 },
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
  /** ルーフ天面（ライトバー・荷物・スポイラーなど）。 */
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
  /** 車両全長。 */
  length: number
  /** 車幅（ボディ本体）。 */
  width: number
  /** 全高（地面からルーフ天面まで）。 */
  height: number
  /** タイヤも含めた最大幅。 */
  overallWidth: number
  /** ホイールベース（前軸〜後軸）。 */
  wheelbase: number
  /** トレッド（左右タイヤ中心の間隔）。前後の平均。 */
  track: number
  /**
   * 前後それぞれの軸位置。GLBから外した元タイヤの実測値で、
   * ゲーム側タイヤはここへ置く。前後でトレッドが違う車種（救急車）があるため、
   * 1つのwheelbase / trackへ丸めずに軸ごとに持つ。
   */
  axles: {
    front: { z: number; halfTrack: number }
    rear: { z: number; halfTrack: number }
  }
  /** GLBの車体を、素の高さから何だけ持ち上げるか（車高・タイヤ径ぶんの補正）。 */
  bodyLift: number
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
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** GLBの車体そのものが持つ、下段（窓の下端まで）の高さ。 */
function vehicleHullHeight(vehicle: CarVehicleDefinition): number {
  return vehicle.cabin.floorY - vehicle.bodyFloor
}

/**
 * タイヤ半径・ボディ・車高から、破綻しない最低地上高を決める。
 * 素の値はGLBの車体下端（`bodyFloor`）で、そこから車高ぶんを足したうえで
 * 「タイヤがボディへめり込まない」「竹馬にならない」範囲へ丸める。
 */
export function computeGroundClearance(
  vehicle: CarVehicleDefinition,
  wheel: CarWheelSpec,
  ride: CarRideHeightSpec,
): number {
  const hullHeight = vehicleHullHeight(vehicle)
  const wheelTop = wheel.radius * 2
  const minClearance = Math.max(
    wheel.radius * MIN_CLEARANCE_RATIO,
    wheelTop * HULL_TOP_OVER_WHEEL_RATIO - hullHeight,
  )
  const maxClearance = wheel.radius * MAX_CLEARANCE_RATIO
  return clamp(vehicle.bodyFloor + ride.lift, minClearance, Math.max(minClearance, maxClearance))
}

/** CarConfig から車両寸法を計算する。ここが寸法の唯一の出どころ。 */
export function computeCarDimensions(config: CarConfig): CarDimensions {
  const vehicle = CAR_VEHICLES[config.body]
  const wheel = CAR_WHEEL_SPECS[config.wheel]
  const ride = CAR_RIDE_HEIGHT_SPECS[config.rideHeight]

  const groundClearance = computeGroundClearance(vehicle, wheel, ride)
  const hullHeight = vehicleHullHeight(vehicle)
  const cabinHeight = vehicle.bodyFloor + vehicle.size.height - vehicle.cabin.floorY
  const hullTopY = groundClearance + hullHeight
  const roofTopY = hullTopY + cabinHeight
  const { front, rear } = vehicle.wheels
  const track = front.halfTrack + rear.halfTrack

  return {
    bodyType: vehicle.id,
    length: vehicle.size.length,
    width: vehicle.size.width,
    height: roofTopY,
    overallWidth: Math.max(vehicle.size.width, track + wheel.width),
    wheelbase: front.z - rear.z,
    track,
    axles: {
      front: { z: front.z, halfTrack: front.halfTrack },
      rear: { z: rear.z, halfTrack: rear.halfTrack },
    },
    // GLBは bodyFloor の高さで作られているので、その差ぶんだけ持ち上げる。
    bodyLift: groundClearance - vehicle.bodyFloor,
    wheelRadius: wheel.radius,
    wheelWidth: wheel.width,
    groundClearance,
    bodyFloorY: groundClearance,
    hullTopY,
    roofTopY,
    hullHeight,
    cabinHeight,
    cabinLength: vehicle.cabin.length,
    cabinCenterZ: vehicle.cabin.centerZ,
    cabinWidth: vehicle.cabin.width,
  }
}

/** 車両寸法から、各カテゴリのパーツが使う取り付け基準を計算する。 */
export function computeCarAttachments(dimensions: CarDimensions): CarAttachments {
  const halfLength = dimensions.length / 2
  const halfWidth = dimensions.width / 2
  const faceCenterY = dimensions.bodyFloorY + dimensions.hullHeight * 0.55

  // 軸ごとの実測位置を使う。前後でトレッドが違う車種でもタイヤが車体からずれない。
  const wheels: CarWheelAttachment[] = ([1, -1] as const).flatMap((end) => {
    const axle = end === 1 ? dimensions.axles.front : dimensions.axles.rear
    return ([1, -1] as const).map((side) => ({
      id: (end === 1
        ? side === 1
          ? 'frontLeft'
          : 'frontRight'
        : side === 1
          ? 'rearLeft'
          : 'rearRight') as CarWheelAttachmentId,
      position: {
        x: side * axle.halfTrack,
        y: dimensions.wheelRadius,
        z: axle.z,
      },
      radius: dimensions.wheelRadius,
      width: dimensions.wheelWidth,
      side,
      end,
    }))
  })

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
