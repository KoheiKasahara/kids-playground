import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

// OrbitControls の標準速度に対する係数。子どもの大きめの斜めスワイプでも極へ飛びにくくする。
export const HORIZONTAL_DRAG_SCALE = 0.65
export const VERTICAL_DRAG_SCALE = 0.52
export const MAX_VIEW_LATITUDE_DEGREES = 78

type OrbitControlsInternals = OrbitControls & {
  _rotateStart: THREE.Vector2
  _handleMouseMoveRotate: (event: MouseEvent) => void
  _handleTouchMoveRotate: (event: TouchEvent) => void
}

function scaledPointerEvent<T extends MouseEvent | TouchEvent>(
  event: T,
  start: THREE.Vector2,
  xProperty: 'clientX' | 'pageX',
  yProperty: 'clientY' | 'pageY',
): T {
  const scaledEvent = Object.create(event) as T
  const coordinates = event as unknown as Record<typeof xProperty | typeof yProperty, number>
  const x = coordinates[xProperty]
  const y = coordinates[yProperty]

  Object.defineProperties(scaledEvent, {
    [xProperty]: { value: start.x + (x - start.x) * HORIZONTAL_DRAG_SCALE },
    [yProperty]: { value: start.y + (y - start.y) * VERTICAL_DRAG_SCALE },
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

  internal._handleMouseMoveRotate = (event) => {
    handleMouseMoveRotate(
      scaledPointerEvent(event, internal._rotateStart, 'clientX', 'clientY'),
    )
  }
  internal._handleTouchMoveRotate = (event) => {
    handleTouchMoveRotate(
      scaledPointerEvent(event, internal._rotateStart, 'pageX', 'pageY'),
    )
  }
}
