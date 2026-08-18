import type { DominoPlacement } from './dominoLayout'

/**
 * ボール区間のトリガーへ向けて、道中のドミノ自身に階段を登らせて坂の高さを稼ぐ。
 * 1段あたりの高さはヘッドレス物理検証(揺らぎ・旋回込みで12/12成功)で確かめた安全値。
 */
export const STAIR_STEP_COUNT = 6
export const STAIR_STEP_RISE = 0.22
/** トリガードミノ自身が立つ台の高さ。ボール区間側のスタート台はこの上にさらに乗る。 */
export const STAIR_TOP_BASE_Y = STAIR_STEP_COUNT * STAIR_STEP_RISE

export const STAIR_PLATFORM_WIDTH = 1.0
export const STAIR_PLATFORM_DEPTH = 0.7

export type StairPlatform = {
  center: { x: number; y: number; z: number }
  yaw: number
  width: number
  height: number
  depth: number
}

/**
 * baseYを持つ配置(階段区間の道中ドミノ)ごとに、地面から段の高さまで伸びる台を作る。
 * 台は表示とColliderの両方で共有し、ドミノは実際にこの上に立って登っていく。
 */
export function getStairPlatforms(placements: readonly DominoPlacement[]): StairPlatform[] {
  const platforms: StairPlatform[] = []
  for (const placement of placements) {
    const baseY = placement.baseY ?? 0
    if (baseY <= 0) continue
    platforms.push({
      center: { x: placement.x, y: baseY / 2, z: placement.z },
      yaw: placement.yaw ?? 0,
      width: STAIR_PLATFORM_WIDTH,
      height: baseY,
      depth: STAIR_PLATFORM_DEPTH,
    })
  }
  return platforms
}
