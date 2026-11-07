import { carriesRail, carriesRoad, colOf, DIRS, neighborIndex, rowOf, type Dir, type Town } from './town'

// みちを はしる くるまと、せんろを はしる でんしゃ。
// がめんを もたず、まちと いまの いちから つぎの いちを きめる だけ。

export type VehicleKind = 'car' | 'train'
export type Vehicle = {
  readonly id: number
  readonly kind: VehicleKind
  readonly index: number
  /** いま すすんで いる むき。 */
  readonly dir: Dir
  readonly variant: number
}
export type Random = () => number

export const CAR_VARIANTS = 5
const KINDS: readonly VehicleKind[] = ['car', 'train']

function carries(kind: VehicleKind, town: Town, index: number): boolean {
  const part = town[index]?.part ?? null
  return kind === 'car' ? carriesRoad(part) : carriesRail(part)
}

/** いまの マスに まだ みち（せんろ）が あるか。けした すぐ あとの えがきわけに つかう。 */
export function isOnTrack(town: Town, vehicle: Vehicle): boolean {
  return carries(vehicle.kind, town, vehicle.index)
}

function exits(town: Town, kind: VehicleKind, index: number): Dir[] {
  const result: Dir[] = []
  for (let dir = 0 as Dir; dir < 4; dir = (dir + 1) as Dir) {
    const next = neighborIndex(index, dir)
    if (next !== null && carries(kind, town, next)) result.push(dir)
  }
  return result
}

function pick<T>(items: readonly T[], random: Random): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

/** みち・せんろの ながさに あわせた だいすう。 */
export function vehicleTarget(town: Town, kind: VehicleKind): number {
  let count = 0
  for (let index = 0; index < town.length; index += 1) if (carries(kind, town, index)) count += 1
  if (kind === 'car') return count < 2 ? 0 : Math.min(10, Math.ceil(count / 4))
  return count < 3 ? 0 : Math.min(3, 1 + Math.floor(count / 16))
}

/** けされた みちの くるまを のぞき、たりない ぶんを つながった みちに だす。 */
export function syncVehicles(town: Town, vehicles: readonly Vehicle[], random: Random): Vehicle[] {
  const result: Vehicle[] = []
  let nextId = vehicles.reduce((max, vehicle) => Math.max(max, vehicle.id), 0) + 1
  for (const kind of KINDS) {
    const target = vehicleTarget(town, kind)
    const kept = vehicles.filter((vehicle) => vehicle.kind === kind && carries(kind, town, vehicle.index)).slice(0, target)
    result.push(...kept)
    const occupied = new Set(kept.map((vehicle) => vehicle.index))
    const spawnable: number[] = []
    for (let index = 0; index < town.length; index += 1) {
      if (!occupied.has(index) && carries(kind, town, index) && exits(town, kind, index).length) spawnable.push(index)
    }
    for (let count = kept.length; count < target && spawnable.length; count += 1) {
      const [index] = spawnable.splice(Math.floor(random() * spawnable.length), 1)
      const dir = pick(exits(town, kind, index), random)
      result.push({ id: nextId, kind, index, dir, variant: Math.floor(random() * CAR_VARIANTS) })
      nextId += 1
    }
  }
  return result
}

/** となりの マスへ 1つ すすむ。ひきかえすのは いきどまり だけ。 */
export function stepVehicle(town: Town, vehicle: Vehicle, random: Random): Vehicle {
  const options = exits(town, vehicle.kind, vehicle.index)
  if (!options.length) return vehicle
  const back = ((vehicle.dir + 2) % 4) as Dir
  const forward = options.filter((dir) => dir !== back)
  const choices = forward.length ? forward : options
  const straight = choices.includes(vehicle.dir) && (vehicle.kind === 'train' || random() < 0.6)
  const dir = straight ? vehicle.dir : pick(choices, random)
  const index = neighborIndex(vehicle.index, dir)
  return index === null ? vehicle : { ...vehicle, index, dir }
}

export function stepVehicles(town: Town, vehicles: readonly Vehicle[], random: Random): Vehicle[] {
  return syncVehicles(town, vehicles, random).map((vehicle) => stepVehicle(town, vehicle, random))
}

/** えがく いち（マスの たんい）と むき。くるまは ひだりがわを はしる。 */
export function vehiclePose(vehicle: Vehicle): { x: number; y: number; angle: number } {
  const lane = vehicle.kind === 'car' ? 0.14 : 0
  const [dx, dy] = DIRS[vehicle.dir]
  return {
    x: colOf(vehicle.index) + 0.5 + dy * lane,
    y: rowOf(vehicle.index) + 0.5 - dx * lane,
    angle: vehicle.dir * 90,
  }
}
