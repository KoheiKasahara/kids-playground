import * as THREE from 'three'
import { MAPS, type JourneyCourse } from './journeyModel'
import { buildGround, buildSwitchStand, buildTrack, journeyLabel, sceneryBatch } from './journeyParts'
import type { JourneyWorld } from './journeyScene'

export function createCountrysideScene(course: JourneyCourse, sleeper: THREE.Object3D): JourneyWorld {
  const group = new THREE.Group()
  group.name = `landscape-${course.id}`
  const batch = sceneryBatch(group)
  const { part } = batch
  const mesh = (geometry: THREE.BufferGeometry, color: string) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85 }))
    object.castShadow = object.receiveShadow = true
    group.add(object)
    return object
  }
  const snow = course.id === 'snow'
  const coast = course.id === 'coast'
  buildGround(mesh, snow ? '#e4eff3' : coast ? '#efd69d' : '#9fc774', coast ? '#4bb8cf' : '#9acddc')
  const beds = buildTrack(group, mesh, course, sleeper, '#b8ab91')
  const samples = Object.values(course.curves).flatMap(curve => curve.getSpacedPoints(350))
  const clear = (x: number, z: number, radius: number) => !samples.some(p => Math.hypot(p.x - x, p.z - z) < radius)
  // Supports under the snowy hill line, avoiding the lower route.
  for (const [edge, curve] of Object.entries(course.curves)) {
    for (let d = 2; d < course.lengths[edge]; d += 3) {
      const p = curve.getPointAt(d / course.lengths[edge])
      if (p.y > 0.8) part('box', '#a9b8c6', p.x, p.y / 2 - 0.35, p.z, 1.3, p.y - 0.7, 1.3)
    }
  }
  // Station on the open foreground straight; its roof stays off the rails.
  part('box', '#d2c4a7', -4, 0.2, 24, 13, 0.4, 3)
  part('box', '#f7e7ba', 4, 1.5, 25, 4, 3, 3)
  part('roof', snow ? '#f7fcff' : '#bb674e', 4, 3.5, 25, 5, 1.3, 4)
  part('box', '#497b88', 4, 1.6, 23.45, 1.7, 1.4, 0.1)
  const sign = journeyLabel(MAPS[course.id].station, '#527e79', 6)
  sign.position.set(0, 5, 24)
  group.add(sign)
  if (snow) {
    // Snow peaks and a frozen lake sit between the two northern routes.
    for (const [x, z, size] of [[-7, 1, 9], [3, 3, 11], [11, 6, 7]]) {
      part('cone', '#91a6b8', x, size / 2, z, size, size, size)
      part('cone', '#fffaff', x, size * 0.82, z, size * 0.4, size * 0.4, size * 0.4)
    }
    part('cylinder', '#8ed7e5', 0, 0.02, -16, 12, 0.08, 5)
    for (const x of [-10, -7, -4]) {
      part('sphere', '#ffffff', x, 0.6, 25, 1.2, 1.2, 1.2)
      part('sphere', '#ffffff', x, 1.5, 25, 0.8, 0.8, 0.8)
      part('cone', '#e49a52', x, 1.5, 25.5, 0.25, 0.5, 0.25, Math.PI / 2)
    }
  } else if (coast) {
    part('cylinder', '#6ac6d5', 0, 0.01, 5, 22, 0.06, 13)
    // Red-and-white lighthouse, boats, and beach parasols.
    for (let i = 0; i < 5; i++) part('cylinder', i % 2 ? '#e16a53' : '#fff5dd', 5, 0.8 + i * 1.3, -16, 2.4 - i * 0.2, 1.3, 2.4 - i * 0.2)
    part('cylinder', '#ffe28b', 5, 7.1, -16, 2, 1.2, 2)
    part('cone', '#b65343', 5, 8, -16, 3.2, 0.9, 3.2)
    for (const x of [-6, 2, 9]) {
      part('box', '#e99157', x, 0.3, 5, 1.4, 0.5, 3)
      part('cylinder', '#fff5df', x, 1.8, 5, 0.09, 3, 0.09)
      part('roof', '#fff4cf', x + 0.6, 2.2, 5, 1.4, 2, 0.1)
    }
    for (const x of [-12, -6, 0, 6, 12]) {
      part('cylinder', '#a77a56', x, 1, 13, 0.12, 2, 0.12)
      part('cone', x % 4 ? '#f18b79' : '#75afcb', x, 2, 13, 2.7, 0.8, 2.7)
    }
  } else {
    for (const x of [-9, -3, 3, 9]) {
      part('box', '#a9854c', x, 0.02, 5, 4, 0.1, 12)
      for (let z = 0; z <= 10; z += 2) {
        part('sphere', '#719640', x - 0.8, 0.4, z, 0.9, 0.7, 0.9)
        part('sphere', '#e8c459', x + 0.8, 0.5, z, 0.8, 1, 0.8)
      }
    }
    part('box', '#cb6550', 1, 2, -19, 5, 4, 3)
    part('roof', '#f5e4b8', 1, 4.5, -19, 6, 1.5, 4)
    part('box', '#725b4a', 1, 1.2, -17.45, 1.5, 2.4, 0.1)
    for (const x of [-10, -5, 0, 5, 10]) {
      part('box', '#f5eedc', x, 0.9, 14, 1.8, 0.9, 0.9)
      part('box', '#59626a', x + 0.5, 1.4, 14, 0.65, 0.7, 0.75)
      for (const dx of [-0.6, 0.6]) for (const dz of [-0.3, 0.3]) part('box', '#59626a', x + dx, 0.3, 14 + dz, 0.18, 0.6, 0.18)
    }
  }
  // Sparse trees around the perimeter, always clear of every branch.
  for (let i = 0; i < 70; i++) {
    const x = Math.sin(i * 17.3) * 26
    const z = Math.cos(i * 11.7) * 26
    if ((Math.abs(x) < 23 && Math.abs(z) < 24) || z > 20 || !clear(x, z, 2.4)) continue
    part('cylinder', '#9e805b', x, 0.7, z, 0.3, 1.4, 0.3)
    part('cone', snow ? '#eaf5f4' : '#61996d', x, 2, z, 2, 3, 2)
  }
  const stands = course.switches.map(point => buildSwitchStand(group, part, course, point))
  batch.finish()
  return { group, tunnels: [], update() {}, setOverview(value) { sign.visible = value }, setRoutes(routes) { stands.forEach((stand, i) => stand.setRoute(routes[i], beds)) } }
}
