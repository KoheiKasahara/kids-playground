import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// OrbitControls の標準速度に対する係数。子どもの大きめの斜めスワイプでも極へ飛びにくくする。
export const HORIZONTAL_DRAG_SCALE = 0.65
export const VERTICAL_DRAG_SCALE = 0.52
// 縦回転で到達できる最大緯度。真上(極)の手前で止め、極付近への張り付きを避ける。
export const MAX_VIEW_LATITUDE_DEGREES = 68
// この緯度を超えると、上限に近づくほど縦方向の感度を徐々に下げ始める。
export const VERTICAL_SOFT_LIMIT_START_DEGREES = 45
// 上限付近まで来たときの縦ドラッグ係数(VERTICAL_DRAG_SCALEから漸減する下限値)。
export const VERTICAL_DRAG_SCALE_NEAR_POLE = 0.1

// OrbitControls内部のSTATE.NONE相当。ドラッグ中でない(=慣性のみ)ことの判定に使う。
const ORBIT_CONTROLS_STATE_NONE = -1

type OrbitControlsInternals = OrbitControls & {
  _rotateStart: THREE.Vector2
  _sphericalDelta: THREE.Spherical
  state: number
  _handleMouseMoveRotate: (event: MouseEvent) => void
  _handleTouchMoveRotate: (event: TouchEvent) => void
}

function polarAngleToLatitudeDegrees(polarAngleRadians: number): number {
  return 90 - THREE.MathUtils.radToDeg(polarAngleRadians)
}

/**
 * 赤道〜中緯度(VERTICAL_SOFT_LIMIT_START_DEGREES)まではVERTICAL_DRAG_SCALEのまま、
 * そこから上限(MAX_VIEW_LATITUDE_DEGREES)に近づくほどVERTICAL_DRAG_SCALE_NEAR_POLEへ
 * 漸減させる。急に止まらず、手前から徐々に動きにくくする狙い。
 */
function verticalDragScaleForLatitude(latitudeDegrees: number): number {
  const distanceFromEquator = Math.min(Math.abs(latitudeDegrees), MAX_VIEW_LATITUDE_DEGREES)
  if (distanceFromEquator <= VERTICAL_SOFT_LIMIT_START_DEGREES) return VERTICAL_DRAG_SCALE

  const softRange = MAX_VIEW_LATITUDE_DEGREES - VERTICAL_SOFT_LIMIT_START_DEGREES
  const progress = (distanceFromEquator - VERTICAL_SOFT_LIMIT_START_DEGREES) / softRange
  return THREE.MathUtils.lerp(VERTICAL_DRAG_SCALE, VERTICAL_DRAG_SCALE_NEAR_POLE, progress)
}

function scaledPointerEvent<T extends MouseEvent | TouchEvent>(
  event: T,
  start: THREE.Vector2,
  xProperty: 'clientX' | 'pageX',
  yProperty: 'clientY' | 'pageY',
  verticalScale: number,
): T {
  const scaledEvent = Object.create(event) as T
  const coordinates = event as unknown as Record<typeof xProperty | typeof yProperty, number>
  const x = coordinates[xProperty]
  const y = coordinates[yProperty]

  Object.defineProperties(scaledEvent, {
    [xProperty]: { value: start.x + (x - start.x) * HORIZONTAL_DRAG_SCALE },
    [yProperty]: { value: start.y + (y - start.y) * verticalScale },
  })

  return scaledEvent
}

/**
 * OrbitControlsのズーム別rotateSpeedはそのまま使い、pointer/touch入力だけをXY別に縮小する。
 * 標準Controlsは1つのrotateSpeedしか持たないため、内部の移動処理を薄くラップする。
 */
export function configureGlobeRotationControls(controls: OrbitControls): void {
  controls.minPolarAngle = THREE.MathUtils.degToRad(90 - MAX_VIEW_LATITUDE_DEGREES)
  controls.maxPolarAngle = THREE.MathUtils.degToRad(90 + MAX_VIEW_LATITUDE_DEGREES)

  const internal = controls as OrbitControlsInternals
  const handleMouseMoveRotate = internal._handleMouseMoveRotate.bind(controls)
  const handleTouchMoveRotate = internal._handleTouchMoveRotate.bind(controls)
  const originalUpdate = internal.update.bind(controls)

  internal._handleMouseMoveRotate = (event) => {
    const verticalScale = verticalDragScaleForLatitude(
      polarAngleToLatitudeDegrees(internal.getPolarAngle()),
    )
    handleMouseMoveRotate(
      scaledPointerEvent(event, internal._rotateStart, 'clientX', 'clientY', verticalScale),
    )
  }
  internal._handleTouchMoveRotate = (event) => {
    const verticalScale = verticalDragScaleForLatitude(
      polarAngleToLatitudeDegrees(internal.getPolarAngle()),
    )
    handleTouchMoveRotate(
      scaledPointerEvent(event, internal._rotateStart, 'pageX', 'pageY', verticalScale),
    )
  }

  // 指を離した後の慣性(damping)は、ドラッグ中(state !== NONE)は通常の速度を保ちつつ、
  // 惰性だけの区間では極付近ほど縦成分を追加で弱め、勢い余って極へ滑り込むのを防ぐ。
  internal.update = (deltaTime) => {
    if (internal.enableDamping && internal.state === ORBIT_CONTROLS_STATE_NONE) {
      const latitudeDegrees = polarAngleToLatitudeDegrees(internal.getPolarAngle())
      const inertiaScale = verticalDragScaleForLatitude(latitudeDegrees) / VERTICAL_DRAG_SCALE
      internal._sphericalDelta.phi *= inertiaScale
    }
    return originalUpdate(deltaTime)
  }
}
