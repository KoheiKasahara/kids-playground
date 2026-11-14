import { isBuilding, type BuildingId, type TilePart } from './parts'
import type { Ground } from './town'

// ちずで なんども かく え（たてもの・みち・せんろ）の なまえ。え は PartArt の <defs> に 1かい だけ おき、マスでは <use> で よびだす。

export function roadKey(mask: number, bridge: boolean): string { return `road-${mask}-${Number(bridge)}` }
export function railKey(mask: number, bridge: boolean, overRoad: boolean): string { return `rail-${mask}-${Number(bridge)}-${Number(overRoad)}` }
export function bodyKey(part: BuildingId): string { return `body-${part}` }
export function windowKey(part: BuildingId, lit: boolean): string { return `win-${part}-${Number(lit)}` }
export const artId = (key: string) => `town-art-${key}`

type SharedArtView = { ground: Ground; part: TilePart | null; roadMask: number; railMask: number; lit: boolean }

/** その マスが <defs> から よびだす え の なまえ。 */
export function sharedArtKeys({ ground, part, roadMask, railMask, lit }: SharedArtView): string[] {
  const bridge = ground === 'water'
  const keys: string[] = []
  if (part === 'road' || part === 'crossing') keys.push(roadKey(roadMask, bridge))
  if (part === 'rail' || part === 'crossing') keys.push(railKey(railMask, bridge, part === 'crossing'))
  if (isBuilding(part)) keys.push(bodyKey(part), windowKey(part, lit))
  return keys
}
