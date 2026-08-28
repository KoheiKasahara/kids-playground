import type { TrainType } from './railFleetModel'

/**
 * 編成内での車両の役割。
 * rear は lead と同じ先頭車系の外装を、編成外側へ向けて再利用する。
 */
export type TrainCarRole = 'lead' | 'middle' | 'rear'

const TWO_CAR_FORMATION: readonly TrainCarRole[] = ['lead', 'middle']
const E5_THREE_CAR_FORMATION: readonly TrainCarRole[] = ['lead', 'middle', 'rear']

/**
 * 車種ごとの表示編成。編成は走行ロジックではなく TrainSpec に属する。
 * Issue #248ではまずE5だけを3両化し、既存車種は2両を維持する。
 */
const TRAIN_FORMATIONS: Readonly<Record<TrainType, readonly TrainCarRole[]>> = {
  basic: TWO_CAR_FORMATION,
  e5: E5_THREE_CAR_FORMATION,
  e6: TWO_CAR_FORMATION,
  n700s: TWO_CAR_FORMATION,
  doctorYellow: TWO_CAR_FORMATION,
}

/**
 * Pathに沿う外側poseは全車両で同じ向きを保ち、最後尾の外装だけを安全に反転する。
 * 負のscaleやBufferGeometryの反転を避けるための、表示content用yaw。
 */
export function getTrainCarVisualYaw(role: TrainCarRole): number {
  return role === 'rear' ? Math.PI : 0
}

export type TrainCarVisualProfile = {
  role: TrainCarRole
  /** 外形の意図をテストやThree.js factoryから参照するための名前。 */
  silhouette:
    | 'basic-rounded'
    | 'e5-rounded-shoulder'
    | 'e5-low-nose'
    | 'e6-sharp-shoulder'
    | 'e6-spear-nose'
    | 'n700s-rounded-shoulder'
    | 'n700s-winged-nose'
    | 'doctor-yellow-thick-shoulder'
    | 'doctor-yellow-duck-nose'
  noseStyle: 'basic-box' | 'e5-wide-wedge' | 'e6-spear' | 'n700s-winged' | 'doctor-yellow-duck'
  bodyLength: number
  bodyHeight: number
  bodyWidth: number
  bodyCenterX: number
  bodyCenterY: number
  roofLength: number
  roofHeight: number
  roofWidth: number
  roofCenterX: number
  roofCenterY: number
  /** ノーズを持たない車両では0。 */
  noseLength: number
  noseBaseX: number
  noseTipX: number
  noseBaseWidth: number
  noseTipWidth: number
  noseBaseBottomY: number
  noseBaseTopY: number
  noseTipBottomY: number
  noseTipTopY: number
  accentLength: number
  accentHeight: number
  accentY: number
  sideWindowXs: readonly number[]
  sideWindowY: number
  sideWindowWidth: number
  sideWindowHeight: number
  frontWindowX: number
  frontWindowY: number
  frontWindowWidth: number
  /** 車体側面のドア中心。車種ごとの配置差を engine に持たせない。 */
  doorX: number
  headlightX: number
  headlightY: number
  headlightZ: number
  hasFrontWindow: boolean
  hasHeadlights: boolean
  /** 車体の中心から測ったカプラー位置。 */
  couplerPositions: readonly number[]
}

/**
 * E5先頭車の外装ロフト断面。x/y/zの座標系は車両ローカルで、zは全幅。
 * 断面列を純粋データとして公開し、外形制約をThree.jsなしで検証できるようにする。
 */
export type TrainShellSection = {
  x: number
  top: number
  bottom: number
  width: number
}

/** 編成間に表示する簡易幌の寸法と配置。 */
export type TrainGangwaySpec = Readonly<{
  length: number
  height: number
  width: number
  centerY: number
  positionOffset: number
}>

/**
 * E5の車両間に見せる簡易幌の共有寸法。
 *
 * 走行中に車両間の姿勢が変わっても、各車両の端面から中央の境界までを
 * 半分ずつ受け持つ。Three.js側のgeometry生成と配置を同じ純粋データから
 * 組み立てることで、直線・カーブの両方で接続の意図を保ちやすくする。
 */
export const E5_GANGWAY_SPEC: TrainGangwaySpec = {
  length: 0.24,
  height: 0.46,
  width: 0.58,
  centerY: 0.76,
  positionOffset: 0.12,
} as const

/** E5先頭車の後端から低く長い鼻先までをつなぐ連続19断面。
 *
 * x方向は一定ピッチに揃え、屋根の終わりからコックピット、鼻先へ
 * 高さ・幅が少しずつ変わるようにする。前半を完全に平らにしないことで、
 * 玩具らしい丸みを保ちながら、屋根から鼻先へ一続きに見える輪郭になる。
 */
export const E5_LEAD_SHELL_SECTIONS: readonly TrainShellSection[] = [
  { x: -1.04, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.89, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.74, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.59, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.44, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.29, top: 1.22, bottom: 0.49, width: 0.88 },
  { x: -0.14, top: 1.22, bottom: 0.49, width: 0.88 },
  // The taper starts just ahead of the cabin instead of leaving a round
  // block at the front of the body.
  // The shoulder-to-nose slope now changes at a steadier rate.  This keeps
  // the cabin roof, cockpit and nose reading as one continuous toy shell
  // from a three-quarter view, without changing the established envelope.
  { x: 0.01, top: 1.218, bottom: 0.491, width: 0.878 },
  { x: 0.16, top: 1.213, bottom: 0.494, width: 0.874 },
  { x: 0.31, top: 1.204, bottom: 0.498, width: 0.866 },
  { x: 0.46, top: 1.190, bottom: 0.503, width: 0.852 },
  { x: 0.61, top: 1.171, bottom: 0.510, width: 0.830 },
  { x: 0.76, top: 1.146, bottom: 0.520, width: 0.798 },
  { x: 0.91, top: 1.114, bottom: 0.533, width: 0.755 },
  { x: 1.06, top: 1.074, bottom: 0.549, width: 0.700 },
  { x: 1.21, top: 1.024, bottom: 0.568, width: 0.632 },
  { x: 1.36, top: 0.955, bottom: 0.590, width: 0.552 },
  { x: 1.51, top: 0.860, bottom: 0.614, width: 0.457 },
  { x: 1.66, top: 0.770, bottom: 0.630, width: 0.360 },
] as const

export type TrainWindshieldSection = {
  /** Longitudinal position on the integrated E5 shell. */
  x: number
  /** Total lateral width of the glass panel. */
  width: number
}

/**
 * Four low-poly stations for the E5 front windshield. The y coordinate and
 * outer shoulder vertices are derived from the shell ring in the Three.js
 * factory, keeping the glass on the sloping roof-to-nose surface when the
 * shell is tuned.
 */
export const E5_FRONT_WINDSHIELD_SECTIONS: readonly TrainWindshieldSection[] = [
  // A slightly wider rear station lets the glass meet both shell shoulders;
  // it then tapers toward the low nose instead of reading as a top plate.
  { x: 0.34, width: 0.68 },
  { x: 0.43, width: 0.72 },
  { x: 0.62, width: 0.66 },
  { x: 0.84, width: 0.57 },
] as const

export type TrainShellAccentBand = {
  sideLower: number
  sideUpper: number
  lowerY: number
  upperY: number
  centerY: number
  height: number
}

/**
 * E5の12点リングで側面に当たる垂直域。帯と外装で同じcornerHeight式を
 * 共有するための小さな純粋helper。リングの斜め角部へ帯を置かない。
 */
export function getE5LeadShellAccentBand(
  section: TrainShellSection,
  requestedHeight: number,
  requestedCenterY: number,
): TrainShellAccentBand {
  const verticalRange = Math.max(0.01, section.top - section.bottom)
  const cornerHeight = Math.min(0.07, verticalRange * 0.28)
  const sideUpper = section.top - cornerHeight * 1.25
  const sideLower = section.bottom + cornerHeight * 1.15
  const sideRange = Math.max(0, sideUpper - sideLower)
  // Leave a little clearance from the curved ring corners. The requested
  // height is allowed to shrink toward the tapered nose.
  const height = Math.min(Math.max(0, requestedHeight), sideRange * 0.76)
  const centerY = sideRange === 0
    ? (sideLower + sideUpper) / 2
    : Math.min(sideUpper - height / 2, Math.max(sideLower + height / 2, requestedCenterY))
  return {
    sideLower,
    sideUpper,
    lowerY: centerY - height / 2,
    upperY: centerY + height / 2,
    centerY,
    height,
  }
}

/**
 * 車種の表示仕様。寸法・色・ディテール位置・編成を一つの純粋な定義へ
 * 集約し、Three.js の生成処理や走行ロジックから分離する。
 */
export type TrainSpec = {
  trainType: TrainType
  silhouette:
    | 'basic-rounded'
    | 'e5-rounded-shoulder'
    | 'e6-sharp-shoulder'
    | 'n700s-rounded-shoulder'
    | 'doctor-yellow-thick-shoulder'
  bodyColor: string
  frontColor: string
  roofColor: string
  /** 上端・半幅・車体前後端の設計上限を明示する。 */
  bodyWidth: number
  bodyHeight: number
  noseLength: number
  frontExtent: number
  rearExtent: number
  maxHalfWidth: number
  /** E5の側面帯、または各タイプのアクセント色。 */
  accent: {
    color: string
    height: number
    y: number
  }
  window: {
    color: string
    sideXs: readonly number[]
    sideWidth: number
    sideHeight: number
  }
  /** この spec を使う表示編成。rear は lead の外装を yaw 反転して再利用する。 */
  formation: readonly TrainCarRole[]
  /** 幌を使う車種だけ定義する。 */
  gangway?: TrainGangwaySpec
  lead: TrainCarVisualProfile
  middle: TrainCarVisualProfile
}

/** @deprecated TrainSpec を使う。既存の呼び出し元との互換 alias。 */
export type TrainVisualProfile = TrainSpec

const BASIC_SIDE_WINDOW_XS = [-0.52, 0.18] as const
const BASIC_COUPLER_POSITIONS = [-1.25, 1.25] as const

/**
 * 既存basicの車体寸法を記録したプロファイル。engine側ではbasic専用の従来
 * factoryを通るため、この値を変更してもbasicの見た目を意図せず変えない。
 */
const BASIC_LEAD: TrainCarVisualProfile = {
  role: 'lead',
  silhouette: 'basic-rounded',
  noseStyle: 'basic-box',
  bodyLength: 2.15,
  bodyHeight: 0.78,
  bodyWidth: 0.92,
  bodyCenterX: 0,
  bodyCenterY: 0.84,
  roofLength: 2.22,
  roofHeight: 0.16,
  roofWidth: 1,
  roofCenterX: 0,
  roofCenterY: 1.31,
  noseLength: 0.3,
  noseBaseX: 1.06,
  noseTipX: 1.21,
  // A slightly broader shoulder keeps the loft visible around the body end.
  noseBaseWidth: 0.94,
  noseTipWidth: 0.88,
  noseBaseBottomY: 0.5,
  noseBaseTopY: 1.2,
  noseTipBottomY: 0.5,
  noseTipTopY: 1.2,
  accentLength: 0,
  accentHeight: 0,
  accentY: 0,
  sideWindowXs: BASIC_SIDE_WINDOW_XS,
  sideWindowY: 1.02,
  sideWindowWidth: 0.42,
  sideWindowHeight: 0.28,
  frontWindowX: 1.23,
  frontWindowY: 1.04,
  frontWindowWidth: 0.54,
  doorX: -0.78,
  headlightX: 1.24,
  headlightY: 0.8,
  headlightZ: 0.27,
  hasFrontWindow: true,
  hasHeadlights: true,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const BASIC_MIDDLE: TrainCarVisualProfile = {
  ...BASIC_LEAD,
  role: 'middle',
  hasFrontWindow: false,
  hasHeadlights: false,
}

const E5_LEAD: TrainCarVisualProfile = {
  role: 'lead',
  silhouette: 'e5-low-nose',
  noseStyle: 'e5-wide-wedge',
  // body rear remains about -1.04 while the integrated shell extends forward.
  // Keep the body low and long inside the shared toy-train envelope.
  bodyLength: 1.98,
  bodyHeight: 0.58,
  bodyWidth: 0.88,
  bodyCenterX: -0.05,
  bodyCenterY: 0.78,
  roofLength: 1.84,
  roofHeight: 0.14,
  roofWidth: 0.86,
  roofCenterX: -0.12,
  roofCenterY: 1.15,
  // The nose is long, broad through the shoulder, and narrows progressively.
  noseLength: 1.46,
  // The loft starts just ahead of the shoulder and runs to the rounded tip.
  noseBaseX: 0.20,
  noseTipX: 1.66,
  noseBaseWidth: 0.88,
  noseTipWidth: 0.36,
  noseBaseBottomY: 0.47,
  noseBaseTopY: 1.06,
  noseTipBottomY: 0.63,
  noseTipTopY: 0.77,
  accentLength: 1.92,
  accentHeight: 0.07,
  accentY: 0.8,
  sideWindowXs: [-0.32, 0.18],
  sideWindowY: 0.97,
  sideWindowWidth: 0.26,
  sideWindowHeight: 0.16,
  frontWindowX: 0.58,
  frontWindowY: 1.19,
  frontWindowWidth: 0.68,
  doorX: -0.05 - 1.98 * 0.34,
  headlightX: 1.24,
  headlightY: 0.69,
  headlightZ: 0.19,
  hasFrontWindow: true,
  hasHeadlights: true,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const E5_MIDDLE: TrainCarVisualProfile = {
  role: 'middle',
  silhouette: 'e5-rounded-shoulder',
  noseStyle: 'e5-wide-wedge',
  bodyLength: 1.96,
  bodyHeight: 0.58,
  bodyWidth: 0.88,
  bodyCenterX: 0,
  bodyCenterY: 0.78,
  roofLength: 1.98,
  roofHeight: 0.14,
  roofWidth: 0.86,
  roofCenterX: 0,
  roofCenterY: 1.15,
  noseLength: 0,
  noseBaseX: 0,
  noseTipX: 0,
  noseBaseWidth: 0,
  noseTipWidth: 0,
  noseBaseBottomY: 0,
  noseBaseTopY: 0,
  noseTipBottomY: 0,
  noseTipTopY: 0,
  accentLength: 1.82,
  accentHeight: 0.07,
  accentY: 0.8,
  // The longer middle car gets a third, compact window.  Lead/rear keep the
  // two-window arrangement so the cockpit area remains visually distinct.
  sideWindowXs: [-0.38, 0.04, 0.46],
  sideWindowY: 0.97,
  // E5 side windows use one shared BufferGeometry for all three cars.
  sideWindowWidth: 0.26,
  sideWindowHeight: 0.16,
  frontWindowX: 0,
  frontWindowY: 0,
  frontWindowWidth: 0,
  doorX: -1.96 * 0.34,
  headlightX: 0,
  headlightY: 0,
  headlightZ: 0,
  hasFrontWindow: false,
  hasHeadlights: false,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const E6_LEAD: TrainCarVisualProfile = {
  role: 'lead',
  silhouette: 'e6-spear-nose',
  noseStyle: 'e6-spear',
  bodyLength: 1.78,
  bodyHeight: 0.58,
  bodyWidth: 0.82,
  bodyCenterX: -0.12,
  bodyCenterY: 0.75,
  roofLength: 1.82,
  roofHeight: 0.13,
  roofWidth: 0.82,
  roofCenterX: -0.12,
  roofCenterY: 1.14,
  noseLength: 1.1,
  noseBaseX: 0.24,
  noseTipX: 1.34,
  noseBaseWidth: 0.82,
  noseTipWidth: 0.18,
  noseBaseBottomY: 0.48,
  noseBaseTopY: 0.98,
  noseTipBottomY: 0.66,
  noseTipTopY: 0.82,
  accentLength: 1.46,
  accentHeight: 0.055,
  accentY: 0.73,
  sideWindowXs: [-0.55, 0.04],
  sideWindowY: 0.94,
  sideWindowWidth: 0.48,
  sideWindowHeight: 0.18,
  frontWindowX: 0.62,
  frontWindowY: 0.87,
  frontWindowWidth: 0.36,
  doorX: -0.52,
  headlightX: 1.24,
  headlightY: 0.7,
  headlightZ: 0.12,
  hasFrontWindow: true,
  hasHeadlights: true,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const E6_MIDDLE: TrainCarVisualProfile = {
  ...E6_LEAD,
  role: 'middle',
  silhouette: 'e6-sharp-shoulder',
  bodyLength: 1.92,
  bodyCenterX: 0,
  roofLength: 1.94,
  roofCenterX: 0,
  noseLength: 0,
  noseBaseX: 0,
  noseTipX: 0,
  noseBaseWidth: 0,
  noseTipWidth: 0,
  noseBaseBottomY: 0,
  noseBaseTopY: 0,
  noseTipBottomY: 0,
  noseTipTopY: 0,
  frontWindowX: 0,
  frontWindowY: 0,
  frontWindowWidth: 0,
  doorX: -0.4,
  headlightX: 0,
  headlightY: 0,
  headlightZ: 0,
  hasFrontWindow: false,
  hasHeadlights: false,
}

const N700S_LEAD: TrainCarVisualProfile = {
  role: 'lead',
  silhouette: 'n700s-winged-nose',
  noseStyle: 'n700s-winged',
  bodyLength: 1.82,
  bodyHeight: 0.6,
  bodyWidth: 0.88,
  bodyCenterX: -0.08,
  bodyCenterY: 0.77,
  roofLength: 1.86,
  roofHeight: 0.14,
  roofWidth: 0.88,
  roofCenterX: -0.08,
  roofCenterY: 1.18,
  noseLength: 0.78,
  noseBaseX: 0.52,
  noseTipX: 1.3,
  noseBaseWidth: 0.82,
  noseTipWidth: 0.38,
  noseBaseBottomY: 0.5,
  noseBaseTopY: 1.02,
  noseTipBottomY: 0.62,
  noseTipTopY: 0.84,
  accentLength: 1.55,
  accentHeight: 0.1,
  accentY: 0.77,
  sideWindowXs: [-0.56, 0.08, 0.58],
  sideWindowY: 0.97,
  sideWindowWidth: 0.4,
  sideWindowHeight: 0.2,
  frontWindowX: 0.84,
  frontWindowY: 0.9,
  frontWindowWidth: 0.42,
  doorX: -0.48,
  headlightX: 1.22,
  headlightY: 0.7,
  headlightZ: 0.16,
  hasFrontWindow: true,
  hasHeadlights: true,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const N700S_MIDDLE: TrainCarVisualProfile = {
  ...N700S_LEAD,
  role: 'middle',
  silhouette: 'n700s-rounded-shoulder',
  bodyLength: 1.94,
  bodyCenterX: 0,
  roofLength: 1.97,
  roofCenterX: 0,
  noseLength: 0,
  noseBaseX: 0,
  noseTipX: 0,
  noseBaseWidth: 0,
  noseTipWidth: 0,
  noseBaseBottomY: 0,
  noseBaseTopY: 0,
  noseTipBottomY: 0,
  noseTipTopY: 0,
  frontWindowX: 0,
  frontWindowY: 0,
  frontWindowWidth: 0,
  doorX: -0.4,
  headlightX: 0,
  headlightY: 0,
  headlightZ: 0,
  hasFrontWindow: false,
  hasHeadlights: false,
}

const DOCTOR_YELLOW_LEAD: TrainCarVisualProfile = {
  role: 'lead',
  silhouette: 'doctor-yellow-duck-nose',
  noseStyle: 'doctor-yellow-duck',
  bodyLength: 1.8,
  bodyHeight: 0.7,
  bodyWidth: 0.94,
  bodyCenterX: -0.14,
  bodyCenterY: 0.78,
  roofLength: 1.86,
  roofHeight: 0.14,
  roofWidth: 0.94,
  roofCenterX: -0.14,
  roofCenterY: 1.2,
  noseLength: 1.05,
  noseBaseX: 0.27,
  noseTipX: 1.32,
  noseBaseWidth: 0.94,
  noseTipWidth: 0.34,
  noseBaseBottomY: 0.45,
  noseBaseTopY: 1.06,
  noseTipBottomY: 0.56,
  noseTipTopY: 0.83,
  accentLength: 1.52,
  accentHeight: 0.11,
  accentY: 0.78,
  sideWindowXs: [-0.52],
  sideWindowY: 0.99,
  sideWindowWidth: 0.46,
  sideWindowHeight: 0.23,
  frontWindowX: 0.55,
  frontWindowY: 0.93,
  frontWindowWidth: 0.44,
  doorX: -0.54,
  headlightX: 1.22,
  headlightY: 0.69,
  headlightZ: 0.16,
  hasFrontWindow: true,
  hasHeadlights: true,
  couplerPositions: BASIC_COUPLER_POSITIONS,
}

const DOCTOR_YELLOW_MIDDLE: TrainCarVisualProfile = {
  ...DOCTOR_YELLOW_LEAD,
  role: 'middle',
  silhouette: 'doctor-yellow-thick-shoulder',
  bodyLength: 1.96,
  bodyCenterX: 0,
  roofLength: 1.98,
  roofCenterX: 0,
  noseLength: 0,
  noseBaseX: 0,
  noseTipX: 0,
  noseBaseWidth: 0,
  noseTipWidth: 0,
  noseBaseBottomY: 0,
  noseBaseTopY: 0,
  noseTipBottomY: 0,
  noseTipTopY: 0,
  frontWindowX: 0,
  frontWindowY: 0,
  frontWindowWidth: 0,
  doorX: -0.4,
  headlightX: 0,
  headlightY: 0,
  headlightZ: 0,
  hasFrontWindow: false,
  hasHeadlights: false,
}

const E5_PROFILE: TrainSpec = {
  trainType: 'e5',
  silhouette: 'e5-rounded-shoulder',
  // Light lower body + green roof/nose is the characteristic E5 toy palette.
  bodyColor: '#f3f1e9',
  frontColor: '#197d78',
  roofColor: '#2f9286',
  bodyWidth: 0.88,
  bodyHeight: 0.58,
  noseLength: E5_LEAD.noseLength,
  frontExtent: E5_LEAD.noseTipX,
  rearExtent: -1.03,
  maxHalfWidth: 0.47,
  accent: { color: '#ec5a93', height: 0.07, y: 0.8 },
  window: {
    color: '#173246',
    sideXs: E5_LEAD.sideWindowXs,
    sideWidth: E5_LEAD.sideWindowWidth,
    sideHeight: E5_LEAD.sideWindowHeight,
  },
  formation: E5_THREE_CAR_FORMATION,
  gangway: E5_GANGWAY_SPEC,
  lead: E5_LEAD,
  middle: E5_MIDDLE,
}

const E6_PROFILE: TrainSpec = {
  trainType: 'e6',
  silhouette: 'e6-sharp-shoulder',
  bodyColor: '#c93645',
  frontColor: '#8d2432',
  roofColor: '#f2eee4',
  bodyWidth: 0.82,
  bodyHeight: 0.58,
  noseLength: E6_LEAD.noseLength,
  frontExtent: E6_LEAD.noseTipX,
  rearExtent: -1.03,
  maxHalfWidth: 0.41,
  accent: { color: '#b8bdc4', height: 0.055, y: 0.73 },
  window: {
    color: '#142f4a',
    sideXs: E6_LEAD.sideWindowXs,
    sideWidth: E6_LEAD.sideWindowWidth,
    sideHeight: E6_LEAD.sideWindowHeight,
  },
  formation: TWO_CAR_FORMATION,
  lead: E6_LEAD,
  middle: E6_MIDDLE,
}

const N700S_PROFILE: TrainSpec = {
  trainType: 'n700s',
  silhouette: 'n700s-rounded-shoulder',
  bodyColor: '#e5e8ea',
  frontColor: '#c1c8d0',
  roofColor: '#f4f6f5',
  bodyWidth: 0.88,
  bodyHeight: 0.6,
  noseLength: N700S_LEAD.noseLength,
  frontExtent: N700S_LEAD.noseTipX,
  rearExtent: -1.01,
  maxHalfWidth: 0.44,
  accent: { color: '#2e64cb', height: 0.1, y: 0.77 },
  window: {
    color: '#173b63',
    sideXs: N700S_LEAD.sideWindowXs,
    sideWidth: N700S_LEAD.sideWindowWidth,
    sideHeight: N700S_LEAD.sideWindowHeight,
  },
  formation: TWO_CAR_FORMATION,
  lead: N700S_LEAD,
  middle: N700S_MIDDLE,
}

const DOCTOR_YELLOW_PROFILE: TrainSpec = {
  trainType: 'doctorYellow',
  silhouette: 'doctor-yellow-thick-shoulder',
  bodyColor: '#f5c928',
  frontColor: '#dba315',
  roofColor: '#f3e5a3',
  bodyWidth: 0.94,
  bodyHeight: 0.7,
  noseLength: DOCTOR_YELLOW_LEAD.noseLength,
  frontExtent: DOCTOR_YELLOW_LEAD.noseTipX,
  rearExtent: -1.04,
  maxHalfWidth: 0.47,
  accent: { color: '#19457a', height: 0.11, y: 0.78 },
  window: {
    color: '#294f77',
    sideXs: DOCTOR_YELLOW_LEAD.sideWindowXs,
    sideWidth: DOCTOR_YELLOW_LEAD.sideWindowWidth,
    sideHeight: DOCTOR_YELLOW_LEAD.sideWindowHeight,
  },
  formation: TWO_CAR_FORMATION,
  lead: DOCTOR_YELLOW_LEAD,
  middle: DOCTOR_YELLOW_MIDDLE,
}

/** 全TrainTypeを一つの表で検査できる表示仕様。走行ロジックは参照しない。 */
export const TRAIN_SPECS: Readonly<Record<TrainType, TrainSpec>> = {
  basic: {
    trainType: 'basic',
    silhouette: 'basic-rounded',
    bodyColor: '#f97316',
    frontColor: '#ea580c',
    roofColor: '#facc15',
    bodyWidth: BASIC_LEAD.bodyWidth,
    bodyHeight: BASIC_LEAD.bodyHeight,
    noseLength: BASIC_LEAD.noseLength,
    frontExtent: 1.23,
    rearExtent: -1.075,
    maxHalfWidth: 0.5,
    accent: { color: '#facc15', height: 0, y: 0 },
    window: {
      color: '#67e8f9',
      sideXs: BASIC_SIDE_WINDOW_XS,
      sideWidth: 0.42,
      sideHeight: 0.28,
    },
    formation: TRAIN_FORMATIONS.basic,
    lead: BASIC_LEAD,
    middle: BASIC_MIDDLE,
  },
  e5: E5_PROFILE,
  e6: E6_PROFILE,
  n700s: N700S_PROFILE,
  doctorYellow: DOCTOR_YELLOW_PROFILE,
}

/** @deprecated TrainSpec の正規表 `TRAIN_SPECS` を使う。 */
export const TRAIN_VISUAL_PROFILES: Readonly<Record<TrainType, TrainVisualProfile>> = TRAIN_SPECS

export function resolveTrainSpec(trainType: TrainType): TrainSpec {
  return TRAIN_SPECS[trainType] ?? TRAIN_SPECS.basic
}

/** @deprecated `resolveTrainSpec` を使う。 */
export function resolveTrainVisualProfile(trainType: TrainType): TrainVisualProfile {
  return resolveTrainSpec(trainType)
}

export function getTrainFormationRoles(trainType: TrainType): readonly TrainCarRole[] {
  return resolveTrainSpec(trainType).formation
}

export function getTrainCarVisualProfile(
  trainType: TrainType,
  role: TrainCarRole,
): TrainCarVisualProfile {
  const profile = resolveTrainSpec(trainType)
  // rearは先頭車と同じ外形・窓・鼻先を共有し、向きだけcontent側で反転する。
  return role === 'middle' ? profile.middle : profile.lead
}
