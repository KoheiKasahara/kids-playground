import type { AdventureArea, AreaEntry, AreaExit } from '../types'
import { caveArea } from './courses/cave'
import { cloudArea } from './courses/cloud'
import { forestArea } from './courses/forest'
import { goalArea } from './courses/goal'
import { riverArea } from './courses/river'
import { skyArea } from './courses/sky'

/** 開始エリアをデータから参照するためのid。分岐追加時も入口生成を自動にしない。 */
export const START_AREA_ID = 'sky'

/** 6エリアの定義をコースファイルから組み立てる。各コースの座標とテーマは個別ファイルに閉じ込める。 */
export const AREAS: readonly AdventureArea[] = [skyArea, forestArea, caveArea, riverArea, cloudArea, goalArea]

const areaById = new Map(AREAS.map((area) => [area.id, area]))

/** idからエリアを引く。未知のidはデータ不整合を呼び出し側で扱えるようundefinedを返す。 */
export function findArea(id: string): AdventureArea | undefined {
  return areaById.get(id)
}

/** ボールのローカルx座標に応じて、開口内を優先し、それ以外は中心が最も近い出口を選ぶ。 */
export function pickExitForBallX(area: AdventureArea, localX: number): AreaExit | undefined {
  const containingExit = area.exits.find((exit) => {
    const halfWidth = exit.width / 2
    return localX >= exit.x - halfWidth && localX <= exit.x + halfWidth
  })
  if (containingExit) return containingExit

  const firstExit = area.exits[0]
  if (!firstExit) return undefined

  let nearestExit = firstExit
  let nearestDistance = Math.abs(localX - firstExit.x)
  for (const exit of area.exits.slice(1)) {
    const distance = Math.abs(localX - exit.x)
    if (distance < nearestDistance) {
      nearestExit = exit
      nearestDistance = distance
    }
  }
  return nearestExit
}

export type ResolvedExitTarget = {
  areaId: string
  entry: AreaEntry
}

/** 出口idから接続先のエリアと入口を解決し、未知idや壊れた接続は安全にundefinedへ落とす。 */
export function resolveExitTarget(areaId: string, exitId: string): ResolvedExitTarget | undefined {
  const area = findArea(areaId)
  const exit: AreaExit | undefined = area?.exits.find((candidate) => candidate.id === exitId)
  if (!exit) return undefined

  const targetArea = findArea(exit.to)
  const entry = targetArea?.entries.find((candidate) => candidate.id === exit.toEntry)
  if (!targetArea || !entry) return undefined
  return { areaId: targetArea.id, entry }
}
