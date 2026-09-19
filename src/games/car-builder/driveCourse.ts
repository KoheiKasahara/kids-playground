/**
 * 「3Dクルマづくり」でつくった車を走らせるコースと、その車の走り方。
 *
 * ここはコース形状と性能の数値だけを持ち、レンダラー・Reactには依存しない
 * （three.jsのカーブ計算だけを使うので、そのまま単体テストできる）。
 * 路面・配置物・空・カメラの作りはサーキットレース側（`../circuit-racing/`）を
 * そのまま使うため、このファイルは同じ `CircuitDefinition` の形で返す。
 */
import * as THREE from 'three'
import type { CircuitDefinition } from '../circuit-racing/circuit'
import type { MotionCarPerformance } from '../circuit-racing/motion'
import type { CarConfig, RideHeight, WheelType } from './carConfig'
import type { CarVehicleId } from './carVehicles'

/**
 * コース中心線の制御点（メートル、xz平面の閉じた輪）。
 *
 * サーキットレースのコース（おおよそ300m×140m）の半分以下に収め、
 * どのカーブからも かんらんしゃ・スタンド・おうち が近くに見えるようにしている。
 * まっすぐ・大きいカーブ・小さいカーブを1本の輪へ入れて、短い1周でも変化を出す。
 */
const CONTROL_POINTS: readonly [number, number][] = [
  [-52, -36],
  [-14, -42],
  [26, -40],
  [54, -26],
  [62, -2],
  [52, 20],
  [26, 32],
  [-6, 24],
  [-30, 30],
  [-54, 22],
  [-64, 0],
  [-62, -20],
]

/** 1台で走るコースなので、レース用（12m・3レーン）より狭くして周りの景色を近づける。 */
const DRIVE_COURSE_WIDTH = 10

/**
 * 「みちばた」カメラを置く高さ。コースが小さいぶん、レース用の高さ（100m）では
 * 見下ろしすぎるので、観客席くらいの高さから車を追う。
 */
export const DRIVE_TRACKSIDE_HEIGHT = 10

/** 走行コース。`CircuitDefinition` なので路面・配置物の生成をレース側と共有できる。 */
export function createDriveCourse(): CircuitDefinition {
  return {
    id: 'car-builder-drive',
    name: 'にぎやかコース',
    description: 'まわりに たくさん！',
    // かんらんしゃ・ピット・スタンドが並ぶ、いちばん にぎやかな景色を借りる。
    scenery: 'grandPrix',
    width: DRIVE_COURSE_WIDTH,
    curve: new THREE.CatmullRomCurve3(
      CONTROL_POINTS.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      'centripetal',
      0.5,
    ),
  }
}

export const DRIVE_COURSE: CircuitDefinition = createDriveCourse()

/**
 * 「みちばた」カメラを置く場所＝コースの内側の真ん中。
 *
 * 配置物はほとんどコースの外側に立つので、内側から見ると車が隠れにくく、
 * かんらんしゃやスタンドが車の背景に入る（外側に置くと、たとえば かんらんしゃの
 * ゴンドラで車が丸ごと隠れてしまう）。小さいコースなので、ここから全周が見える。
 */
export function driveTracksideAnchor(course: CircuitDefinition): { x: number; y: number; z: number } {
  const points = course.curve.getPoints(128)
  const total = points.reduce((sum, point) => ({ x: sum.x + point.x, z: sum.z + point.z }), { x: 0, z: 0 })
  return { x: total.x / points.length, y: DRIVE_TRACKSIDE_HEIGHT, z: total.z / points.length }
}

/**
 * 車種ごとの走り方。`topSpeed` は m/s、`grip` はカーブで耐えられる横向きの加速度(m/s²)。
 * 小さいコースなのでレース用（`../circuit-racing/raceConfig.ts`）より控えめにし、
 * 大きく背の高い車ほど最高速もカーブの粘りも落とす。
 */
const BODY_DRIVE_FEELS: Record<CarVehicleId, { topSpeed: number; grip: number }> = {
  sportsCar: { topSpeed: 25, grip: 10.5 },
  policeCar: { topSpeed: 24, grip: 9.8 },
  taxi: { topSpeed: 22.5, grip: 9.2 },
  car: { topSpeed: 22, grip: 9 },
  pickup: { topSpeed: 21, grip: 7.4 },
  suv: { topSpeed: 20.5, grip: 7.6 },
  ambulance: { topSpeed: 20, grip: 6.8 },
  van: { topSpeed: 19.5, grip: 7 },
  bus: { topSpeed: 19, grip: 6.4 },
  schoolBus: { topSpeed: 18, grip: 6 },
}

/**
 * タイヤごとの倍率。「レーシングタイヤにしたら はやくなった」が分かるよう、
 * 見た目の性格と同じ向きに効かせる（太いオフロードは踏ん張るが最高速は落ちる など）。
 */
const WHEEL_DRIVE_FEELS: Record<WheelType, { speed: number; grip: number }> = {
  small: { speed: 0.95, grip: 1 },
  big: { speed: 1.08, grip: 0.92 },
  offroad: { speed: 0.92, grip: 1.06 },
  racing: { speed: 1.12, grip: 1.16 },
  whitewall: { speed: 1, grip: 1 },
  flower: { speed: 1, grip: 1 },
  star: { speed: 1.02, grip: 1.02 },
  rainbow: { speed: 1.05, grip: 1.05 },
}

/** 車高ごとの倍率。低いほど安定して速く、高いほどカーブでゆっくりになる。 */
const RIDE_HEIGHT_DRIVE_FEELS: Record<RideHeight, { speed: number; grip: number }> = {
  low: { speed: 1.04, grip: 1.08 },
  normal: { speed: 1, grip: 1 },
  high: { speed: 0.96, grip: 0.9 },
}

/**
 * つくった車の走り方を求める。レース用の周回プロファイル
 * （`createMotionProfile`）へそのまま渡せる形で返す。
 *
 * ボディ・タイヤ・車高の3つだけが効き、色や飾りでは走りが変わらない
 * （見た目のために遅くなる、という遊びづらさを作らない）。
 */
export function driveCarTuning(config: CarConfig): MotionCarPerformance {
  const body = BODY_DRIVE_FEELS[config.body]
  const wheel = WHEEL_DRIVE_FEELS[config.wheel]
  const ride = RIDE_HEIGHT_DRIVE_FEELS[config.rideHeight]
  const maxSpeed = body.topSpeed * wheel.speed * ride.speed
  return {
    maxSpeed,
    // 速い車ほど力も強いので、加速・ブレーキは最高速から決める（表をもう2つ増やさない）。
    acceleration: maxSpeed * 0.28,
    braking: maxSpeed * 0.5,
    cornering: body.grip * wheel.grip * ride.grip,
  }
}
