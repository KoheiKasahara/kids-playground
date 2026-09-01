import { resolveTrainSpec, type TrainCarVisualProfile, type TrainShellSection } from './railTrainVisuals'
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

function getBasicShellSections(profile: TrainCarVisualProfile): readonly TrainShellSection[] {
  const bodyLeft = profile.bodyCenterX - profile.bodyLength / 2
  const bodyRight = profile.bodyCenterX + profile.bodyLength / 2
  const bodyTop = profile.bodyCenterY + profile.bodyHeight / 2
  const bodyBottom = profile.bodyCenterY - profile.bodyHeight / 2
  const roofTop = profile.roofCenterY + profile.roofHeight / 2

  // Basic has no TrainShellSection table because its 3D renderer still uses
  // the original toy-car primitives. Build the same single side shell here:
  // the small crown is a paint/contour change inside the body, not a roof
  // object placed on top of it.
  return [
    { x: bodyLeft, top: bodyTop - 0.02, bottom: bodyBottom + 0.04, width: profile.bodyWidth },
    { x: bodyLeft + 0.12, top: roofTop - 0.02, bottom: bodyBottom, width: profile.bodyWidth },
    { x: bodyRight - 0.22, top: roofTop - 0.02, bottom: bodyBottom, width: profile.bodyWidth },
    { x: bodyRight - 0.04, top: bodyTop + 0.01, bottom: bodyBottom + 0.02, width: profile.bodyWidth },
    { x: profile.noseTipX, top: profile.noseTipTopY, bottom: profile.noseTipBottomY, width: profile.noseTipWidth },
  ]
}

function createCubicProfilePath(
  points: readonly { x: number; y: number }[],
  mapX: (value: number) => number,
  mapY: (value: number) => number,
  move = true,
): string {
  if (points.length === 0) return ''
  const commands = move ? [`M ${mapX(points[0]!.x)} ${mapY(points[0]!.y)}`] : []
  const tension = 1 / 6

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index]!
    const current = points[index]!
    const next = points[index + 1]!
    const afterNext = points[index + 2] ?? next
    const segmentLength = next.x - current.x
    const control1 = {
      // Keep the longitudinal coordinate inside this segment. The basic toy
      // train has intentionally uneven stations, so a raw Catmull-Rom x
      // tangent could briefly bend backwards at the first shoulder.
      x: current.x + segmentLength / 3,
      y: current.y + (next.y - previous.y) * tension,
    }
    const control2 = {
      x: next.x - segmentLength / 3,
      y: next.y - (afterNext.y - current.y) * tension,
    }
    commands.push(
      `C ${mapX(control1.x)} ${mapY(control1.y)}, ${mapX(control2.x)} ${mapY(control2.y)}, ${mapX(next.x)} ${mapY(next.y)}`,
    )
  }

  return commands.join(' ')
}

function createIntegratedShellPath(
  sections: readonly TrainShellSection[],
  mapX: (value: number) => number,
  mapY: (value: number) => number,
): string {
  const first = sections[0]!
  const last = sections[sections.length - 1]!
  const topPoints = sections.map(({ x, top }) => ({ x, y: top }))
  const bottomPoints = [...sections].reverse().map(({ x, bottom }) => ({ x, y: bottom }))
  const frontCap = Math.min(0.07, Math.max(0.025, (last.top - last.bottom) * 0.12))
  const rearCap = Math.min(0.1, Math.max(0.04, (first.top - first.bottom) * 0.12))

  return [
    createCubicProfilePath(topPoints, mapX, mapY),
    `C ${mapX(last.x + frontCap)} ${mapY(last.top - frontCap * 0.2)}, ${mapX(last.x + frontCap)} ${mapY(last.bottom + frontCap * 0.2)}, ${mapX(last.x)} ${mapY(last.bottom)}`,
    createCubicProfilePath(bottomPoints, mapX, mapY, false),
    `C ${mapX(first.x - rearCap)} ${mapY(first.bottom + rearCap * 0.25)}, ${mapX(first.x - rearCap)} ${mapY(first.top - rearCap * 0.25)}, ${mapX(first.x)} ${mapY(first.top)}`,
    'Z',
  ].join(' ')
}

function sampleShellTop(sections: readonly TrainShellSection[], x: number): number {
  const first = sections[0]!
  const last = sections[sections.length - 1]!
  if (x <= first.x) return first.top
  if (x >= last.x) return last.top

  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1]!
    const current = sections[index]!
    if (x <= current.x) {
      const amount = (x - previous.x) / Math.max(0.001, current.x - previous.x)
      return previous.top + (current.top - previous.top) * amount
    }
  }
  return last.top
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

function createWindshieldPath(
  profile: TrainCarVisualProfile,
  shellSections: readonly TrainShellSection[] | undefined,
  mapX: (value: number) => number,
  mapY: (value: number) => number,
): string | null {
  if (!profile.hasFrontWindow || profile.noseLength <= 0) return null

  const startX = Math.min(profile.frontWindowX - 0.1, profile.noseTipX - 0.34)
  const endX = Math.min(profile.noseTipX - 0.05, startX + Math.max(0.26, profile.noseLength * 0.34))
  const height = clamp(0.1 + profile.frontWindowWidth * 0.12, 0.14, 0.21)
  const shellTopStart = shellSections === undefined ? profile.frontWindowY + height * 0.46 : sampleShellTop(shellSections, startX) - 0.025
  const shellTopEnd = shellSections === undefined ? profile.frontWindowY + height * 0.18 : sampleShellTop(shellSections, endX) - 0.025
  const topStart = shellTopStart
  const topEnd = shellTopEnd
  const bottomEnd = shellSections === undefined ? profile.frontWindowY - height * 0.55 : topEnd - height * 0.82
  const bottomStart = shellSections === undefined ? profile.frontWindowY - height * 0.68 : topStart - height * 0.9

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

function usesUpperShellPaint(trainType: TrainType): boolean {
  return trainType === 'e5' || trainType === 'e6' || trainType === 'e7w7'
}

/**
 * 3Dの先頭車TrainSpecを、カード内で軽く描画できる側面ミニチュアへ落とし込む。
 * Three.jsやCanvasは使わず、車種追加時も既存TrainSpecを参照するだけで済む。
 */
export default function TrainThumbnail({ trainType }: TrainThumbnailProps) {
  const spec = resolveTrainSpec(trainType)
  const profile = spec.lead
  const { mapX, mapY } = getCoordinateMapper(profile)
  const shellSections = spec.leadShellSections ?? getBasicShellSections(profile)
  const paintIds = {
    shell: `train-thumbnail-${trainType}-shell`,
    window: `train-thumbnail-${trainType}-window`,
  }
  const shellPath = createIntegratedShellPath(shellSections, mapX, mapY)
  const accentPath = createAccentPath(profile, mapX, mapY)
  const windshieldPath = createWindshieldPath(profile, shellSections, mapX, mapY)
  const bodyLeft = profile.bodyCenterX - profile.bodyLength / 2
  const bodyRight = profile.bodyCenterX + profile.bodyLength / 2
  const wheelXs = [bodyLeft + profile.bodyLength * 0.27, bodyRight - profile.bodyLength * 0.22]
  const highlightPoints = shellSections.slice(0, Math.max(2, Math.ceil(shellSections.length * 0.62))).map(({ x, top }) => ({ x, y: top - 0.035 }))

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
      data-thumbnail-quality="integrated-shell-v3"
      data-roof-treatment="integrated-paint"
    >
      <defs>
        <linearGradient id={paintIds.shell} x1="0" y1="0" x2="0" y2="1">
          {trainType === 'basic' ? (
            <>
              <stop offset="0%" stopColor={mixHexColors(spec.roofColor, '#ffffff', 0.2)} />
              <stop offset="28%" stopColor={spec.roofColor} />
              <stop offset="47%" stopColor={mixHexColors(spec.roofColor, spec.bodyColor, 0.5)} />
            </>
          ) : usesUpperShellPaint(trainType) ? (
            <>
              <stop offset="0%" stopColor={mixHexColors(spec.frontColor, '#ffffff', 0.2)} />
              <stop offset="31%" stopColor={spec.frontColor} />
              <stop offset="47%" stopColor={mixHexColors(spec.frontColor, spec.bodyColor, 0.5)} />
            </>
          ) : (
            <stop offset="0%" stopColor={mixHexColors(spec.bodyColor, '#ffffff', 0.28)} />
          )}
          <stop offset="60%" stopColor={spec.bodyColor} />
          <stop offset="100%" stopColor={mixHexColors(spec.bodyColor, '#183247', 0.18)} />
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
        <path data-part="integrated-shell" className={styles.thumbnailShell} d={shellPath} fill={`url(#${paintIds.shell})`} />
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
          d={createCubicProfilePath(highlightPoints, mapX, mapY)}
        />
      </g>
    </svg>
  )
}
