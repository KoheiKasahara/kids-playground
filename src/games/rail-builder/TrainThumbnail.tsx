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

type CoordinateMapper = {
  mapX: (worldX: number) => number
  mapY: (worldY: number) => number
}

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

function getCoordinateMapper(profile: TrainCarVisualProfile): CoordinateMapper {
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
  const rearRadius = Math.min(0.16, profile.bodyLength * 0.09)
  const frontBlend = Math.min(0.32, Math.max(0.12, (bodyFrontX - bodyLeft) * 0.18))

  return [
    `M ${mapX(bodyLeft + rearRadius)} ${mapY(bodyTop)}`,
    `C ${mapX(bodyLeft + profile.bodyLength * 0.22)} ${mapY(bodyTop)}, ${mapX(bodyFrontX - frontBlend * 1.5)} ${mapY(bodyTop)}, ${mapX(bodyFrontX - frontBlend)} ${mapY(bodyFrontTop)}`,
    `C ${mapX(bodyFrontX - frontBlend * 0.42)} ${mapY(bodyFrontTop)}, ${mapX(bodyFrontX - frontBlend * 0.08)} ${mapY(bodyFrontTop)}, ${mapX(bodyFrontX)} ${mapY(bodyFrontTop)}`,
    `C ${mapX(bodyFrontX + frontBlend * 0.08)} ${mapY(bodyFrontTop - 0.01)}, ${mapX(bodyFrontX + frontBlend * 0.08)} ${mapY(bodyFrontBottom + 0.01)}, ${mapX(bodyFrontX)} ${mapY(bodyFrontBottom)}`,
    `C ${mapX(bodyFrontX - frontBlend * 0.45)} ${mapY(bodyFrontBottom)}, ${mapX(bodyLeft + profile.bodyLength * 0.22)} ${mapY(bodyBottom)}, ${mapX(bodyLeft + rearRadius)} ${mapY(bodyBottom)}`,
    `C ${mapX(bodyLeft + rearRadius * 0.3)} ${mapY(bodyBottom)}, ${mapX(bodyLeft)} ${mapY(bodyBottom - rearRadius * 0.45)}, ${mapX(bodyLeft)} ${mapY(bodyBottom - rearRadius)}`,
    `C ${mapX(bodyLeft)} ${mapY(bodyTop + rearRadius)}, ${mapX(bodyLeft + rearRadius * 0.3)} ${mapY(bodyTop)}, ${mapX(bodyLeft + rearRadius)} ${mapY(bodyTop)}`,
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

  const curveTightness = profile.noseStyle === 'doctor-yellow-duck'
    ? 0.6
    : profile.noseStyle === 'n700s-winged'
      ? 0.32
      : profile.noseStyle === 'e6-spear'
        ? 0.42
        : profile.noseStyle === 'e7w7-dignified'
          ? 0.5
          : 0.44
  const noseHeight = Math.max(0.08, baseTop - tipTop)
  const lowerRise = Math.max(0.04, tipBottom - baseBottom)
  const upperShoulderX = baseX + length * 0.16
  const upperMidX = baseX + length * curveTightness
  const lowerMidX = baseX + length * Math.min(0.78, curveTightness + 0.16)
  const upperShoulderY = baseTop - noseHeight * (profile.noseStyle === 'e6-spear' ? 0.03 : 0.015)
  const upperMidY = baseTop - noseHeight * (profile.noseStyle === 'n700s-winged' ? 0.38 : 0.5)
  const lowerMidY = baseBottom + lowerRise * (profile.noseStyle === 'doctor-yellow-duck' ? 0.42 : 0.55)
  const lowerShoulderX = baseX + length * 0.2

  return [
    `M ${mapX(baseX)} ${mapY(baseTop)}`,
    `C ${mapX(upperShoulderX)} ${mapY(baseTop)}, ${mapX(upperShoulderX + length * 0.1)} ${mapY(upperShoulderY)}, ${mapX(upperMidX)} ${mapY(upperMidY)}`,
    `C ${mapX(upperMidX + length * 0.18)} ${mapY(upperMidY - noseHeight * 0.14)}, ${mapX(tipX - length * 0.08)} ${mapY(tipTop + noseHeight * 0.04)}, ${mapX(tipX)} ${mapY(tipTop)}`,
    `C ${mapX(tipX + length * 0.018)} ${mapY(tipTop + 0.025)}, ${mapX(tipX + length * 0.018)} ${mapY(tipBottom - 0.025)}, ${mapX(tipX)} ${mapY(tipBottom)}`,
    `C ${mapX(tipX - length * 0.08)} ${mapY(tipBottom + lowerRise * 0.04)}, ${mapX(lowerMidX)} ${mapY(lowerMidY + lowerRise * 0.2)}, ${mapX(lowerMidX)} ${mapY(lowerMidY)}`,
    `C ${mapX(lowerMidX - length * 0.2)} ${mapY(lowerMidY - lowerRise * 0.08)}, ${mapX(lowerShoulderX)} ${mapY(baseBottom)}, ${mapX(baseX)} ${mapY(baseBottom)}`,
    'Z',
  ].join(' ')
}

function createRoofPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const left = profile.roofCenterX - profile.roofLength / 2
  const right = profile.roofCenterX + profile.roofLength / 2
  const top = profile.roofCenterY + profile.roofHeight / 2
  const bottom = profile.roofCenterY - profile.roofHeight / 2
  const shoulder = Math.min(0.2, profile.roofLength * 0.13)

  return [
    `M ${mapX(left)} ${mapY(bottom)}`,
    `C ${mapX(left + shoulder * 0.18)} ${mapY(top - 0.015)}, ${mapX(left + shoulder * 0.58)} ${mapY(top)}, ${mapX(left + shoulder)} ${mapY(top)}`,
    `C ${mapX(left + profile.roofLength * 0.32)} ${mapY(top + 0.012)}, ${mapX(right - profile.roofLength * 0.32)} ${mapY(top + 0.012)}, ${mapX(right - shoulder)} ${mapY(top)}`,
    `C ${mapX(right - shoulder * 0.42)} ${mapY(top)}, ${mapX(right - shoulder * 0.12)} ${mapY(top - 0.015)}, ${mapX(right)} ${mapY(bottom)}`,
    `C ${mapX(right - shoulder * 0.2)} ${mapY(bottom - 0.012)}, ${mapX(left + shoulder * 0.2)} ${mapY(bottom - 0.012)}, ${mapX(left)} ${mapY(bottom)}`,
    'Z',
  ].join(' ')
}

function createAccentPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string | null {
  if (profile.accentLength <= 0 || profile.accentHeight <= 0) return null
  const left = profile.bodyCenterX - profile.accentLength / 2
  const right = profile.bodyCenterX + profile.accentLength / 2
  const top = profile.accentY + profile.accentHeight / 2
  const bottom = profile.accentY - profile.accentHeight / 2
  const radius = Math.min(0.08, profile.accentLength * 0.06)
  return [
    `M ${mapX(left + radius)} ${mapY(top)}`,
    `C ${mapX(left + profile.accentLength * 0.28)} ${mapY(top)}, ${mapX(right - profile.accentLength * 0.16)} ${mapY(top + 0.012)}, ${mapX(right - radius)} ${mapY(top)}`,
    `C ${mapX(right)} ${mapY(top)}, ${mapX(right)} ${mapY(bottom)}, ${mapX(right - radius)} ${mapY(bottom)}`,
    `C ${mapX(right - profile.accentLength * 0.24)} ${mapY(bottom - 0.012)}, ${mapX(left + profile.accentLength * 0.18)} ${mapY(bottom)}, ${mapX(left + radius)} ${mapY(bottom)}`,
    `C ${mapX(left)} ${mapY(bottom)}, ${mapX(left)} ${mapY(top)}, ${mapX(left + radius)} ${mapY(top)}`,
    'Z',
  ].join(' ')
}

function createSideWindowPath(
  windowX: number,
  windowY: number,
  width: number,
  height: number,
  mapX: (value: number) => number,
  mapY: (value: number) => number,
): string {
  const left = windowX - width / 2
  const right = windowX + width / 2
  const top = windowY + height / 2
  const bottom = windowY - height / 2
  const radius = Math.min(0.055, width * 0.22, height * 0.22)

  return [
    `M ${mapX(left + radius)} ${mapY(top)}`,
    `C ${mapX(left + width * 0.36)} ${mapY(top + 0.008)}, ${mapX(right - width * 0.2)} ${mapY(top + 0.008)}, ${mapX(right - radius)} ${mapY(top)}`,
    `C ${mapX(right)} ${mapY(top)}, ${mapX(right)} ${mapY(bottom)}, ${mapX(right - radius)} ${mapY(bottom)}`,
    `C ${mapX(right - width * 0.34)} ${mapY(bottom - 0.008)}, ${mapX(left + width * 0.2)} ${mapY(bottom - 0.008)}, ${mapX(left + radius)} ${mapY(bottom)}`,
    `C ${mapX(left)} ${mapY(bottom)}, ${mapX(left)} ${mapY(top)}, ${mapX(left + radius)} ${mapY(top)}`,
    'Z',
  ].join(' ')
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

  const corner = Math.min(0.05, (endX - startX) * 0.18, height * 0.22)

  return [
    `M ${mapX(startX + corner)} ${mapY(topStart)}`,
    `C ${mapX(startX + (endX - startX) * 0.34)} ${mapY(topStart + 0.01)}, ${mapX(endX - corner)} ${mapY(topEnd + 0.01)}, ${mapX(endX - corner)} ${mapY(topEnd)}`,
    `C ${mapX(endX)} ${mapY(topEnd)}, ${mapX(endX)} ${mapY(bottomEnd)}, ${mapX(endX - corner)} ${mapY(bottomEnd)}`,
    `C ${mapX(endX - (endX - startX) * 0.34)} ${mapY(bottomEnd - 0.01)}, ${mapX(startX + corner)} ${mapY(bottomStart - 0.01)}, ${mapX(startX + corner)} ${mapY(bottomStart)}`,
    `C ${mapX(startX)} ${mapY(bottomStart)}, ${mapX(startX)} ${mapY(topStart)}, ${mapX(startX + corner)} ${mapY(topStart)}`,
    'Z',
  ].join(' ')
}

function createChassisPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const left = profile.bodyCenterX - profile.bodyLength / 2 + 0.18
  const right = profile.bodyCenterX + profile.bodyLength / 2 - 0.14
  return [
    `M ${mapX(left + 0.08)} ${mapY(0.52)}`,
    `C ${mapX(left + profile.bodyLength * 0.32)} ${mapY(0.525)}, ${mapX(right - profile.bodyLength * 0.2)} ${mapY(0.525)}, ${mapX(right)} ${mapY(0.52)}`,
    `C ${mapX(right - 0.01)} ${mapY(0.47)}, ${mapX(right - 0.05)} ${mapY(0.42)}, ${mapX(right - 0.08)} ${mapY(0.4)}`,
    `C ${mapX(right - profile.bodyLength * 0.36)} ${mapY(0.395)}, ${mapX(left + profile.bodyLength * 0.2)} ${mapY(0.395)}, ${mapX(left + 0.08)} ${mapY(0.4)}`,
    `C ${mapX(left + 0.04)} ${mapY(0.43)}, ${mapX(left + 0.04)} ${mapY(0.48)}, ${mapX(left + 0.08)} ${mapY(0.52)}`,
    'Z',
  ].join(' ')
}

function createDoorPath(profile: TrainCarVisualProfile, mapX: (value: number) => number, mapY: (value: number) => number): string {
  const bodyTop = profile.bodyCenterY + profile.bodyHeight / 2
  const bodyBottom = profile.bodyCenterY - profile.bodyHeight / 2
  const top = bodyTop - 0.08
  const bottom = bodyBottom + 0.07
  return `M ${mapX(profile.doorX)} ${mapY(top)} C ${mapX(profile.doorX + 0.025)} ${mapY(top - 0.02)}, ${mapX(profile.doorX + 0.025)} ${mapY(bottom + 0.02)}, ${mapX(profile.doorX)} ${mapY(bottom)}`
}

function mixHexColors(first: string, second: string, amount: number): string {
  const firstMatch = first.match(/^#([\da-f]{6})$/i)
  const secondMatch = second.match(/^#([\da-f]{6})$/i)
  if (!firstMatch || !secondMatch) return first

  const ratio = clamp(amount, 0, 1)
  const firstRgb = [0, 2, 4].map((offset) => Number.parseInt(firstMatch[1].slice(offset, offset + 2), 16))
  const secondRgb = [0, 2, 4].map((offset) => Number.parseInt(secondMatch[1].slice(offset, offset + 2), 16))
  return `#${firstRgb.map((value, index) => Math.round(value + (secondRgb[index] - value) * ratio).toString(16).padStart(2, '0')).join('')}`
}

/**
 * 3Dの先頭車TrainSpecを、カード内で軽く描画できる側面ミニチュアへ落とし込む。
 * Three.jsやCanvasは使わず、車種追加時も既存TrainSpecを参照するだけで済む。
 */
export default function TrainThumbnail({ trainType }: TrainThumbnailProps) {
  const spec = resolveTrainSpec(trainType)
  const profile = spec.lead
  const { mapX, mapY } = getCoordinateMapper(profile)
  const paintIds = {
    body: `train-thumbnail-${trainType}-body`,
    nose: `train-thumbnail-${trainType}-nose`,
    roof: `train-thumbnail-${trainType}-roof`,
    window: `train-thumbnail-${trainType}-window`,
  }
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
      data-thumbnail-quality="bezier-shell-v2"
    >
      <defs>
        <linearGradient id={paintIds.body} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mixHexColors(spec.bodyColor, '#ffffff', 0.28)} />
          <stop offset="46%" stopColor={spec.bodyColor} />
          <stop offset="100%" stopColor={mixHexColors(spec.bodyColor, '#183247', 0.18)} />
        </linearGradient>
        <linearGradient id={paintIds.nose} x1="0" y1="0" x2="0.12" y2="1">
          <stop offset="0%" stopColor={mixHexColors(spec.frontColor, '#ffffff', 0.2)} />
          <stop offset="55%" stopColor={spec.frontColor} />
          <stop offset="100%" stopColor={mixHexColors(spec.frontColor, '#183247', 0.16)} />
        </linearGradient>
        <linearGradient id={paintIds.roof} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mixHexColors(spec.roofColor, '#ffffff', 0.2)} />
          <stop offset="100%" stopColor={mixHexColors(spec.roofColor, '#183247', 0.16)} />
        </linearGradient>
        <linearGradient id={paintIds.window} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={mixHexColors(spec.window.color, '#9deaf2', 0.24)} />
          <stop offset="100%" stopColor={spec.window.color} />
        </linearGradient>
      </defs>
      <ellipse className={styles.thumbnailShadow} cx="101" cy="96" rx="78" ry="7" />
      <g className={styles.thumbnailTrain}>
        {wheelXs.map((wheelX) => (
          <g key={wheelX}>
            <circle className={styles.thumbnailWheel} cx={mapX(wheelX)} cy={mapY(0.38)} r="4.8" />
            <circle className={styles.thumbnailWheelHub} cx={mapX(wheelX)} cy={mapY(0.38)} r="1.7" />
          </g>
        ))}
        <path className={styles.thumbnailChassis} d={createChassisPath(profile, mapX, mapY)} />
        <path data-part="body" className={styles.thumbnailBody} d={createBodyPath(profile, mapX, mapY)} fill={`url(#${paintIds.body})`} />
        {nosePath !== null && <path data-part="nose" className={styles.thumbnailNose} d={nosePath} fill={`url(#${paintIds.nose})`} />}
        <path data-part="roof" className={styles.thumbnailRoof} d={createRoofPath(profile, mapX, mapY)} fill={`url(#${paintIds.roof})`} />
        {accentPath !== null && <path data-part="accent" className={styles.thumbnailAccent} d={accentPath} fill={spec.accent.color} />}
        <path data-part="door" className={styles.thumbnailDoor} d={createDoorPath(profile, mapX, mapY)} />
        {profile.sideWindowXs.map((windowX) => (
          <path
            key={windowX}
            className={styles.thumbnailWindow}
            data-part="side-window"
            d={createSideWindowPath(windowX, profile.sideWindowY, profile.sideWindowWidth, profile.sideWindowHeight, mapX, mapY)}
            fill={`url(#${paintIds.window})`}
          />
        ))}
        {windshieldPath !== null && <path data-part="windshield" className={styles.thumbnailWindshield} d={windshieldPath} fill={`url(#${paintIds.window})`} />}
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
        <path
          className={styles.thumbnailHighlight}
          d={`M ${mapX(bodyLeft + 0.12)} ${mapY(bodyTop - 0.04)} C ${mapX(bodyLeft + profile.bodyLength * 0.32)} ${mapY(bodyTop - 0.075)}, ${mapX(Math.min(bodyRight - 0.18, bodyLeft + profile.bodyLength * 0.54))} ${mapY(bodyTop - 0.075)}, ${mapX(Math.min(bodyRight - 0.1, bodyLeft + profile.bodyLength * 0.62))} ${mapY(bodyTop - 0.04)}`}
        />
      </g>
    </svg>
  )
}
