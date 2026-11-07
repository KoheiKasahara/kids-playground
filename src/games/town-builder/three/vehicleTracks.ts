import { COLS, DIRS, ROWS, type Town } from '../town'
import { stepVehicle, syncVehicles, vehiclePose, type Random, type Vehicle } from '../vehicles'
import type { Point } from './townLayout'

// 3D で くるま・でんしゃを なめらかに はしらせる みち。
// 2D と おなじ vehicles.ts で 1マスずつ すすめ、とおった 3つの いちを 2じ ベジェで つないで かどを まるく まがる。
// えがく いちは しらべた いちより 1マス おくれるが、みる だけ なので かまわない。

export type Track = {
  /** つぎに すすむ ときの もとに なる、いちばん さきの じょうたい。 */
  readonly lead: Vehicle
  readonly p0: Point
  readonly p1: Point
  readonly p2: Point
}

export type TrackPose = { x: number; z: number; heading: number }

function pointOf(vehicle: Vehicle): Point {
  const pose = vehiclePose(vehicle)
  return { x: pose.x - COLS / 2, z: pose.y - ROWS / 2 }
}

/** (dx, dz) へ すすむ ときの y じくの かいてん（のりものの まえは ローカルの -z）。 */
export function headingOf(dx: number, dz: number): number {
  return Math.atan2(-dx, -dz)
}

function mid(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
}

/** みち・せんろに くるま・でんしゃを だす（だいすうは 2D と おなじ きまり）。 */
export function startTracks(town: Town, random: Random): Track[] {
  return syncVehicles(town, [], random).map((vehicle) => {
    const p1 = pointOf(vehicle)
    const lead = stepVehicle(town, vehicle, random)
    return { lead, p0: p1, p1, p2: pointOf(lead) }
  })
}

/** みんな 1マス すすめる。 */
export function advanceTracks(town: Town, tracks: readonly Track[], random: Random): Track[] {
  return tracks.map((track) => {
    const lead = stepVehicle(town, track.lead, random)
    return { lead, p0: track.p1, p1: track.p2, p2: pointOf(lead) }
  })
}

/** t（0〜1）の ときの いちと むき。t=1 の いちは つぎの t=0 の いちと おなじ。 */
export function trackPose(track: Track, t: number): TrackPose {
  const a = mid(track.p0, track.p1)
  const c = track.p1
  const b = mid(track.p1, track.p2)
  const u = 1 - t
  const x = u * u * a.x + 2 * u * t * c.x + t * t * b.x
  const z = u * u * a.z + 2 * u * t * c.z + t * t * b.z
  let dx = 2 * u * (c.x - a.x) + 2 * t * (b.x - c.x)
  let dz = 2 * u * (c.z - a.z) + 2 * t * (b.z - c.z)
  if (Math.hypot(dx, dz) < 1e-6) {
    dx = b.x - a.x
    dz = b.z - a.z
  }
  if (Math.hypot(dx, dz) < 1e-6) [dx, dz] = DIRS[track.lead.dir]
  return { x, z, heading: headingOf(dx, dz) }
}
