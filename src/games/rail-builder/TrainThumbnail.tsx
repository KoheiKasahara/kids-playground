import { resolveTrainSpec, type TrainCarVisualProfile } from './railTrainVisuals'
import type { TrainType } from './railFleetModel'
import styles from './TrainTypePicker.module.css'

type TrainThumbnailProps = {
  trainType: TrainType
}

const VIEWBOX_WIDTH = 200
const VIEWBOX_HEIGHT = 112
const MIN_WORLD_Y = 0.34
const MAX_WORLD_Y = 1.48
const DRAWING_LEFT = 13
const DRAWING_RIGHT = 188

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function getWorldXBounds(profile: TrainCarVisualProfile): { min: number; max: number } {
  const bodyLeft = profile.bodyCenterX - profile.bodyLength / 2
  const bodyRight = profile.bodyCenterX + profile.bodyLength / 2
  const noseTip = profile.noseLength > 0 ? profile.noseTipX : bodyRight
  return {
    min: bodyLeft - 0.08,
    max: Math.max(bodyRight, noseTip) + 0.08,
  }
}

function getCoordinateMapper(profile: TrainCarVisualProfile) {
  const bounds = getWorldXBounds(profile)
  const worldWidth = Math.max(0.1, bounds.max - bounds.min)
  const mapX = (worldX: number) => DRAWING_LEFT + ((worldX - bounds.min) / worldWidth) * (DRAWING_RIGHT - DRAWING_LEFT)
  const mapY = (worldY: number) => VIEWBOX_HEIGHT - 18 - ((worldY - MIN_WORLD_Y) / (MAX_WORLD_Y - MIN_WORLD_Y)) * 70
  return { mapX, mapY }
}

function createBodyPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const bodyLeft = profile.bodyCenterX - profile.bodyLength / 2
  const bodyRight = profile.bodyCenterX + profile.bodyLength / 2
  const bodyTop = profile.bodyCenterY + profile.bodyHeight / 2
  const bodyBottom = profile.bodyCenterY - profile.bodyHeight / 2
  const bodyFrontX = profile.noseLength > 0 ? profile.noseBaseX : bodyRight
  const bodyFrontTop = profile.noseLength > 0 ? profile.noseBaseTopY : bodyTop
  const bodyFrontBottom = profile.noseLength > 0 ? profile.noseBaseBottomY : bodyBottom
  const rearRadius = Math.min(0.14, profile.bodyLength * 0.08)

  return [
    `M ${mapX(bodyLeft + rearRadius)} ${mapY(bodyTop)}`,
    `L ${mapX(bodyFrontX)} ${mapY(bodyFrontTop)}`,
    `L ${mapX(bodyFrontX)} ${mapY(bodyFrontBottom)}`,
    `L ${mapX(bodyLeft + rearRadius)} ${mapY(bodyBottom)}`,
    `Q ${mapX(bodyLeft)} ${mapY(bodyBottom)} ${mapX(bodyLeft)} ${mapY(bodyBottom - rearRadius)}`,
    `L ${mapX(bodyLeft)} ${mapY(bodyTop + rearRadius)}`,
    `Q ${mapX(bodyLeft)} ${mapY(bodyTop)} ${mapX(bodyLeft + rearRadius)} ${mapY(bodyTop)}`,
    'Z',
  ].join(' ')
}

function createNosePath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string | null {
  if (profile.noseLength <= 0) return null

  const baseX = profile.noseBaseX
  const tipX = profile.noseTipX
  const length = Math.max(0.1, tipX - baseX)
  const baseTop = profile.noseBaseTopY
  const baseBottom = profile.noseBaseBottomY
  const tipTop = profile.noseTipTopY
  const tipBottom = profile.noseTipBottomY

  if (profile.noseStyle === 'e6-spear') {
    return [
      `M ${mapX(baseX)} ${mapY(baseTop)}`,
      `L ${mapX(baseX + length * 0.42)} ${mapY(baseTop - 0.025)}`,
      `L ${mapX(tipX)} ${mapY(tipTop)}`,
      `L ${mapX(tipX)} ${mapY(tipBottom)}`,
      `L ${mapX(baseX + length * 0.42)} ${mapY(baseBottom + 0.025)}`,
      `L ${mapX(baseX)} ${mapY(baseBottom)}`,
      'Z',
    ].join(' ')
  }

  const curveTightness = profile.noseStyle === 'doctor-yellow-duck'
    ? 0.58
    : profile.noseStyle === 'n700s-winged'
      ? 0.34
      : profile.noseStyle === 'e7w7-dignified'
        ? 0.48
        : 0.42
  const upperControlX = baseX + length * curveTightness
  const lowerControlX = baseX + length * (curveTightness + 0.12)

  return [
    `M ${mapX(baseX)} ${mapY(baseTop)}`,
    `Q ${mapX(upperControlX)} ${mapY(baseTop)} ${mapX(tipX)} ${mapY(tipTop)}`,
    `L ${mapX(tipX)} ${mapY(tipBottom)}`,
    `Q ${mapX(lowerControlX)} ${mapY(baseBottom)} ${mapX(baseX)} ${mapY(baseBottom)}`,
    'Z',
  ].join(' ')
}

function createRoofPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const left = profile.roofCenterX - profile.roofLength / 2
  const right = profile.roofCenterX + profile.roofLength / 2
  const top = profile.roofCenterY + profile.roofHeight / 2
  const bottom = profile.roofCenterY - profile.roofHeight / 2
  const shoulder = Math.min(0.18, profile.roofLength * 0.12)

  return [
    `M ${mapX(left)} ${mapY(bottom)}`,
    `Q ${mapX(left + shoulder)} ${mapY(top)} ${mapX(left + shoulder * 2)} ${mapY(top)}`,
    `L ${mapX(right - shoulder)} ${mapY(top)}`,
    `Q ${mapX(right - shoulder * 0.5)} ${mapY(top)} ${mapX(right)} ${mapY(bottom)}`,
    'Z',
  ].join(' ')
}

function createAccentPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string | null {
  if (profile.accentLength <= 0 || profile.accentHeight <= 0) return null
  const left = profile.bodyCenterX - profile.accentLength / 2
  const right = profile.bodyCenterX + profile.accentLength / 2
  const top = profile.accentY + profile.accentHeight / 2
  const bottom = profile.accentY - profile.accentHeight / 2
  return `M ${mapX(left)} ${mapY(top)} L ${mapX(right)} ${mapY(top)} L ${mapX(right)} ${mapY(bottom)} L ${mapX(left)} ${mapY(bottom)} Z`
}

function createWindshieldPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string | null {
  if (!profile.hasFrontWindow || profile.noseLength <= 0) return null

  const startX = Math.min(profile.frontWindowX - 0.1, profile.noseTipX - 0.34)
  const endX = Math.min(profile.noseTipX - 0.05, startX + Math.max(0.26, profile.noseLength * 0.34))
  const centerY = profile.frontWindowY
  const height = clamp(0.1 + profile.frontWindowWidth * 0.12, 0.14, 0.21)
  const topStart = centerY + height * 0.46
  const topEnd = centerY + height * 0.18
  const bottomEnd = centerY - height * 0.55
  const bottomStart = centerY - height * 0.68

  return [
    `M ${mapX(startX)} ${mapY(topStart)}`,
    `L ${mapX(endX)} ${mapY(topEnd)}`,
    `L ${mapX(endX)} ${mapY(bottomEnd)}`,
    `L ${mapX(startX)} ${mapY(bottomStart)}`,
    'Z',
  ].join(' ')
}

function createChassisPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const left = profile.bodyCenterX - profile.bodyLength / 2 + 0.18
  const right = profile.bodyCenterX + profile.bodyLength / 2 - 0.14
  return `M ${mapX(left)} ${mapY(0.52)} L ${mapX(right)} ${mapY(0.52)} L ${mapX(right - 0.08)} ${mapY(0.4)} L ${mapX(left + 0.08)} ${mapY(0.4)} Z`
}

/**
 * 3Dの先頭車TrainSpecを、カード内で軽く描画できる側面ミニチュアへ落とし込む。
 * Three.jsやCanvasは使わず、車種追加時も既存TrainSpecを参照するだけで済む。
 */
export default function TrainThumbnail({ trainType }: TrainThumbnailProps) {
  const spec = resolveTrainSpec(trainType)
  const profile = spec.lead
  const { mapX, mapY } = getCoordinateMapper(profile)
  const nosePath = createNosePath(profile, mapX, mapY)
  const accentPath = createAccentPath(profile, mapX, mapY)
  const windshieldPath = createWindshieldPath(profile, mapX, mapY)
  const bodyLeft = profile.bodyCenterX - profile.bodyLength / 2
  const bodyRight = profile.bodyCenterX + profile.bodyLength / 2
  const wheelXs = [bodyLeft + profile.bodyLength * 0.27, bodyRight - profile.bodyLength * 0.22]
  const bodyTop = profile.bodyCenterY + profile.bodyHeight / 2

  return (
    <svg
      className={styles.thumbnail}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
      role="presentation"
      aria-hidden="true"
      data-train-type={trainType}
      data-silhouette={spec.silhouette}
      data-nose-style={profile.noseStyle}
      data-window-count={profile.sideWindowXs.length}
    >
      <ellipse className={styles.thumbnailShadow} cx="101" cy="96" rx="78" ry="7" />
      <g className={styles.thumbnailTrain}>
        {wheelXs.map((wheelX) => (
          <g key={wheelX}>
            <circle className={styles.thumbnailWheel} cx={mapX(wheelX)} cy={mapY(0.38)} r="4.8" />
            <circle className={styles.thumbnailWheelHub} cx={mapX(wheelX)} cy={mapY(0.38)} r="1.7" />
          </g>
        ))}
        <path className={styles.thumbnailChassis} d={createChassisPath(profile, mapX, mapY)} />
        <path className={styles.thumbnailBody} d={createBodyPath(profile, mapX, mapY)} fill={spec.bodyColor} />
        {nosePath !== null && <path className={styles.thumbnailNose} d={nosePath} fill={spec.frontColor} />}
        {accentPath !== null && <path className={styles.thumbnailAccent} d={accentPath} fill={spec.accent.color} />}
        {profile.sideWindowXs.map((windowX) => (
          <rect
            key={windowX}
            className={styles.thumbnailWindow}
            x={mapX(windowX - profile.sideWindowWidth / 2)}
            y={mapY(profile.sideWindowY + profile.sideWindowHeight / 2)}
            width={mapX(windowX + profile.sideWindowWidth / 2) - mapX(windowX - profile.sideWindowWidth / 2)}
            height={mapY(profile.sideWindowY - profile.sideWindowHeight / 2) - mapY(profile.sideWindowY + profile.sideWindowHeight / 2)}
            rx="2.2"
            fill={spec.window.color}
          />
        ))}
        {windshieldPath !== null && <path className={styles.thumbnailWindshield} d={windshieldPath} fill={spec.window.color} />}
        {spec.windshieldCenterDivider && windshieldPath !== null && (
          <path
            className={styles.thumbnailWindshieldDivider}
            d={`M ${mapX(profile.frontWindowX + 0.12)} ${mapY(profile.frontWindowY + 0.08)} L ${mapX(profile.frontWindowX + 0.12)} ${mapY(profile.frontWindowY - 0.08)}`}
          />
        )}
        {profile.hasHeadlights && (
          <circle
            className={styles.thumbnailLight}
            cx={mapX(clamp(profile.headlightX, bodyRight, profile.noseTipX))}
            cy={mapY(profile.headlightY)}
            r="2.5"
          />
        )}
        <path className={styles.thumbnailRoof} d={createRoofPath(profile, mapX, mapY)} fill={spec.roofColor} />
        <path
          className={styles.thumbnailHighlight}
          d={`M ${mapX(bodyLeft + 0.12)} ${mapY(bodyTop - 0.04)} L ${mapX(Math.min(bodyRight - 0.1, bodyLeft + profile.bodyLength * 0.62))} ${mapY(bodyTop - 0.04)}`}
        />
      </g>
    </svg>
  )
}
