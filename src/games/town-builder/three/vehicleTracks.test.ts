import { expect, it } from 'vitest'
import { applyTool, carriesRail, carriesRoad, COLS, createEmptyTown, createTown, type Town } from '../town'
import type { Vehicle } from '../vehicles'
import { tileAt } from './townLayout'
import { advanceTracks, headingOf, startTracks, trackPose, type Track } from './vehicleTracks'

function seeded(seed: number) {
  let value = seed
  return () => {
    value = (value * 16807) % 2147483647
    return value / 2147483647
  }
}

function angleGap(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)))
}

/** みちと せんろが まじわる まち（ふみきり・カーブ・いきどまり つき）。 */
function railTown(): Town {
  let town = createTown()
  for (let col = 1; col < 9; col += 1) town = applyTool(town, 3 * COLS + col, 'rail')
  for (let row = 3; row < 12; row += 1) town = applyTool(town, row * COLS + 8, 'rail')
  return town
}

it('points the vehicle front (local -z) along the way it travels', () => {
  for (const [dx, dz] of [[1, 0], [0, 1], [-1, 0], [0, -1], [0.6, -0.8]]) {
    const heading = headingOf(dx, dz)
    expect(-Math.sin(heading)).toBeCloseTo(dx)
    expect(-Math.cos(heading)).toBeCloseTo(dz)
  }
})

it('drives cars and trains smoothly: every step starts where the last one ended, on its own track', () => {
  const random = seeded(11)
  const town = railTown()
  let tracks = startTracks(town, random)
  expect(tracks.filter((track) => track.lead.kind === 'car').length).toBeGreaterThan(0)
  expect(tracks.filter((track) => track.lead.kind === 'train').length).toBeGreaterThan(0)
  for (const track of tracks) expect(Number.isFinite(trackPose(track, 0).heading)).toBe(true)

  for (let step = 0; step < 40; step += 1) {
    const next = advanceTracks(town, tracks, random)
    next.forEach((track, index) => {
      const end = trackPose(tracks[index], 1)
      const start = trackPose(track, 0)
      expect(start.x).toBeCloseTo(end.x)
      expect(start.z).toBeCloseTo(end.z)
      expect(angleGap(start.heading, end.heading)).toBeLessThan(1e-6)
      const middle = trackPose(track, 0.5)
      const part = town[tileAt(middle.x, middle.z)!].part
      expect(track.lead.kind === 'car' ? carriesRoad(part) : carriesRail(part)).toBe(true)
    })
    tracks = next
  }
})

it('rounds corners instead of snapping to the new direction', () => {
  const lead: Vehicle = { id: 1, kind: 'train', index: 0, dir: 2, variant: 0 }
  const corner: Track = { lead, p0: { x: 0, z: 0 }, p1: { x: 1, z: 0 }, p2: { x: 1, z: 1 } }
  expect(angleGap(trackPose(corner, 0).heading, headingOf(1, 0))).toBeLessThan(1e-6)
  expect(angleGap(trackPose(corner, 1).heading, headingOf(0, 1))).toBeLessThan(1e-6)
  let previous = trackPose(corner, 0)
  for (let t = 0.1; t <= 1.0001; t += 0.1) {
    const pose = trackPose(corner, t)
    expect(angleGap(pose.heading, previous.heading)).toBeLessThan(0.3)
    expect(Math.hypot(pose.x - previous.x, pose.z - previous.z)).toBeLessThan(0.2)
    previous = pose
  }
})

it('turns round at a dead end and keeps a direction while standing still', () => {
  const random = seeded(5)
  let town = createEmptyTown()
  town = applyTool(town, 2 * COLS + 2, 'road')
  town = applyTool(town, 2 * COLS + 3, 'road')
  let tracks = startTracks(town, random)
  expect(tracks).toHaveLength(1)
  const headings: number[] = []
  for (let step = 0; step < 4; step += 1) {
    for (let t = 0; t < 1; t += 0.25) headings.push(trackPose(tracks[0], t).heading)
    tracks = advanceTracks(town, tracks, random)
  }
  // ひがし むきと にし むきの りょうほうを はしる。
  expect(headings.some((heading) => angleGap(heading, headingOf(1, 0)) < 0.3)).toBe(true)
  expect(headings.some((heading) => angleGap(heading, headingOf(-1, 0)) < 0.3)).toBe(true)

  const parked: Track = { lead: { id: 9, kind: 'car', index: 0, dir: 1, variant: 0 }, p0: { x: 2, z: 2 }, p1: { x: 2, z: 2 }, p2: { x: 2, z: 2 } }
  expect(trackPose(parked, 0.5).heading).toBeCloseTo(headingOf(1, 0))
})
