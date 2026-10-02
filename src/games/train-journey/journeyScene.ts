import * as THREE from 'three'
import { CITY_CROSSING, createCityDistrict } from './journeyCity'
import { createDowntownScene } from './journeyDowntown'
import { type JourneyCourse, type JourneyRoutes, MAPS } from './journeyModel'
import { buildGround, buildSwitchStand, buildTrack, buildTunnel, journeyLabel, sceneryBatch, type JourneyTunnel } from './journeyParts'

export { disposeJourneyObject } from './journeyParts'
export type JourneyWorld = {
  group: THREE.Group
  tunnels: readonly JourneyTunnel[]
  setOverview: (overview: boolean) => void
  update: (seconds: number, reducedMotion: boolean, crossingClosed?: boolean) => void
  setRoutes: (routes: JourneyRoutes) => void
}

export function createJourneyScene(course: JourneyCourse, sleeper: THREE.Object3D): JourneyWorld {
  return course.id === 'downtown' ? createDowntownScene(course, sleeper) : createIslandScene(course, sleeper)
}

function createIslandScene(course: JourneyCourse, sleeper: THREE.Object3D): JourneyWorld {
  const group = new THREE.Group()
  const batch = sceneryBatch(group)
  const { part, beam } = batch
  const mesh = (geometry: THREE.BufferGeometry, color: string) => {
    const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }))
    object.receiveShadow = object.castShadow = true
    group.add(object)
    return object
  }
  buildGround(mesh, '#91bd70', '#87cfd9')

  const trackSamples = Object.values(course.curves).flatMap(c => c.getSpacedPoints(350))
  const clear = (x: number, z: number, r: number) => !trackSamples.some(p => Math.hypot(p.x - x, p.z - z) < r)
  const beds = buildTrack(group, mesh, course, sleeper, '#dab779')
  const up = new THREE.Vector3(0, 1, 0)
  // Piers carry the high loop; its span over the lower line becomes a red truss.
  const curve = course.curves.bridge
  const length = course.lengths.bridge
  for (let d = 2; d < length - 2; d += 3.3) {
    const p = curve.getPointAt(d / length)
    if (p.y < 0.9) continue
    const tangent = curve.getTangentAt(d / length)
    const right = new THREE.Vector3(tangent.z, 0, -tangent.x).normalize()
    const lowerTrack = trackSamples.some(q => q.y < p.y - 2 && Math.hypot(q.x - p.x, q.z - p.z) < 1.7)
    if (!lowerTrack) {
      part('box', '#e7d8b7', p.x, (p.y - 0.25) / 2, p.z, 0.85, p.y - 0.25, 0.85)
      part('box', '#c6b394', p.x, 0.12, p.z, 1.4, 0.3, 1.4)
      part('box', '#f0e2c5', p.x, p.y - 0.45, p.z, 1.75, 0.35, 1, 0, Math.atan2(tangent.x, tangent.z))
    }
    const next = curve.getPointAt(Math.min(1, (d + 3.3) / length))
    const nextT = curve.getTangentAt(Math.min(1, (d + 3.3) / length))
    const nextRight = new THREE.Vector3(nextT.z, 0, -nextT.x).normalize()
    const bridge = p.y > 5 && p.x < -3 && p.z > -9 && p.z < 6
    for (const side of [-1, 1]) {
      const a = p.clone().addScaledVector(right, side * 1.04).addScaledVector(up, 0.55)
      const b = next.clone().addScaledVector(nextRight, side * 1.04).addScaledVector(up, 0.55)
      const color = bridge ? '#db6550' : '#bce1ed'
      beam(color, a, b, 0.14)
      beam(color, a.clone().addScaledVector(up, -0.5), a.clone().addScaledVector(up, 0.2), 0.16)
      if (bridge) {
        beam('#cd5947', a.clone().addScaledVector(up, 1.8), b.clone().addScaledVector(up, 1.8), 0.22)
        beam('#db6550', a.clone().addScaledVector(up, -0.4), b.clone().addScaledVector(up, 1.8), 0.18)
        beam('#db6550', a.clone().addScaledVector(up, 1.8), b.clone().addScaledVector(up, -0.4), 0.18)
      }
    }
  }

  // A real open-ended arched shell follows the forest rail, with visible portals.
  const tunnelStart = 17
  const tunnelEnd = 23
  const forest = course.curves.forest
  const tunnel = buildTunnel(mesh, part, forest, course.lengths.forest, tunnelStart, tunnelEnd, { shell: '#6c8966', wall: '#769077', stone: ['#e2dbc7', '#d4cbb2'] })
  tunnel.name = 'forest-tunnel'
  const tunnelLabel = journeyLabel('もりの トンネル', '#3f7751', 5)
  const tunnelPoint = forest.getPointAt(tunnelStart / course.lengths.forest)
  tunnelLabel.position.copy(tunnelPoint).add(new THREE.Vector3(0, 3.6, 0))
  group.add(tunnelLabel)

  // The town along the city branch: blocks, a level crossing and its traffic.
  const town = createCityDistrict({ part, beam, clear }, course.curves.city, course.lengths.city)
  let gateLift = Math.PI / 2
  for (const gate of town.gates) { gate.rotation.x = -gateLift; group.add(gate) }
  const cityLabel = journeyLabel('ビルの まち', '#b0642a', 5)
  cityLabel.position.copy(course.curves.city.getPointAt(CITY_CROSSING / course.lengths.city)).add(new THREE.Vector3(0, 5.4, 0))
  group.add(cityLabel)

  // Pond, little islets, reeds and a boat below the elevated loop.
  part('cylinder', '#cbdab0', 3, 0.005, 7.5, 14, 0.1, 12)
  const pond = mesh(new THREE.CircleGeometry(1, 48), '#58bbcf')
  pond.rotation.x = -Math.PI / 2
  pond.position.set(3, 0.075, 7.5)
  pond.scale.set(6.4, 5.4, 1)
  pond.castShadow = false
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.4
    const x = 3 + Math.cos(angle) * 6.7
    const z = 7.5 + Math.sin(angle) * 5.7
    if (clear(x, z, 1.1)) {
      part('sphere', '#b2b6a1', x, 0.18, z, 0.8, 0.55, 0.7)
      part('cone', '#609363', x + 0.3, 0.55, z + 0.2, 0.25, 1.1, 0.25)
    }
  }
  part('box', '#edc477', 4.3, 0.26, 8.5, 0.75, 0.35, 1.65, 0, -0.4)
  part('cylinder', '#f5e8c5', 4.3, 1, 8.5, 0.07, 1.7, 0.07)
  part('cone', '#fcf4da', 4.4, 1.4, 8.5, 1, 1.1, 0.05, 0, -0.4)

  // Station sits beside the long foreground straight. Roof leaves the train visible.
  part('box', '#d5c6a5', -3, 0.25, 21, 15, 0.5, 3.7)
  part('box', '#fff0af', -3, 0.54, 19.3, 15, 0.09, 0.25)
  part('box', '#f3e4bc', 1, 1.9, 23.7, 5.4, 3.8, 3.4)
  part('box', '#d67753', 1, 3.85, 23.7, 6.1, 0.4, 4.1)
  part('roof', '#ce664b', 1, 4.55, 23.7, 6.2, 1.45, 4.2)
  for (const x of [-0.7, 2.7]) {
    part('box', '#477b8b', x, 2.05, 21.96, 1.15, 1.6, 0.07)
    part('box', '#fff1cd', x, 2.05, 21.9, 0.1, 1.6, 0.05)
  }
  part('box', '#8b7058', 1, 1.2, 21.96, 1, 2.1, 0.08)
  for (const x of [-9, -5]) {
    part('box', '#788c8c', x, 1.75, 22, 0.16, 3.1, 0.16)
    part('box', '#c38457', x, 1.02, 21, 2, 0.16, 0.65)
    part('box', '#c38457', x, 1.45, 21.25, 2, 0.6, 0.12)
    part('box', '#726c60', x, 0.75, 21, 1.6, 0.5, 0.12)
  }
  part('box', '#61a5a1', -7, 3.38, 21.3, 7, 0.3, 3.9)
  const stationLabel = journeyLabel(MAPS.island.station, '#ae6244', 6)
  stationLabel.position.set(1, 5.7, 23.7)
  group.add(stationLabel)
  const clock = mesh(new THREE.CircleGeometry(0.58, 24), '#fff6d8')
  clock.rotation.y = Math.PI
  clock.position.set(1, 4.1, 21.55)
  part('box', '#52666a', 1, 4.24, 21.5, 0.055, 0.32, 0.08)
  part('box', '#52666a', 1.14, 4.1, 21.5, 0.32, 0.055, 0.08)

  // Deterministic placement keeps all scenery clear of every route.
  const noise = (n: number) => { const s = Math.sin(n * 127.1 + 31.7) * 43758.5453; return s - Math.floor(s) }
  function tree(x: number, z: number, size: number, pine: boolean, seed: number) {
    part('cylinder', '#9c7952', x, size * 0.4, z, 0.28 * size, size * 0.8, 0.28 * size)
    const greens = ['#4b9069', '#69a474', '#7ca86b', '#3c8167', '#98ba75']
    if (pine) {
      part('cone', greens[seed % greens.length], x, size * 1.05, z, size * 1.4, size * 1.8, size * 1.4)
      part('cone', '#79a876', x, size * 1.5, z, size, size * 1.4, size)
    } else part('sphere', greens[seed % greens.length], x, size * 1.3, z, size * 1.65, size * 1.65, size * 1.65)
  }
  // The town stands where the northern woods used to, on both sides of the
  // viaduct, and its outskirts keep whatever ground each block asked for.
  const inTown = (x: number, z: number) => (x > -15 && x < 3.5 && z > -21 && z < -4.5)
    || town.footprints.some(spot => Math.hypot(spot.x - x, spot.z - z) < spot.radius)
  for (let i = 0; i < 200; i++) {
    const x = noise(i * 3 + 1) * 54 - 27
    const z = noise(i * 3 + 2) * 53 - 27
    const size = 0.85 + noise(i * 3 + 3) * 0.9
    if (z > 18 || (x > -5 && x < 11 && z > 1 && z < 15) || (x > 21 && z > -20) || inTown(x, z)) continue
    if (clear(x, z, 2.15 + size * 0.3)) tree(x, z, size, z < -6, i)
  }
  // Soft low-poly hills on the northwestern coast, away from both tracks.
  for (const [x, z, s] of [[-21, -22, 7], [-16, -25, 5], [-23, -14, 5]]) {
    part('sphere', '#81a58a', x, 0.1, z, s * 1.7, s, s * 1.5)
    part('sphere', '#a1bb8d', x - 0.7, 1.1, z, s * 1.35, s * 0.85, s * 1.1)
  }
  // A row of houses, a footpath, gardens and fences adds a lived-in scale.
  part('box', '#d8cca6', 24.6, 0.01, -1, 2, 0.09, 38)
  for (let i = 0; i < 6; i++) {
    const x = 27
    const z = -17 + i * 6
    const wall = ['#f4d399', '#edd5bf', '#e8d7b5'][i % 3]
    const roof = ['#c87559', '#608f9c', '#c8a34e'][i % 3]
    part('box', wall, x, 1.3, z, 3.1, 2.6, 3.3)
    part('roof', roof, x, 3.2, z, 3.8, 1.5, 3.9, 0, Math.PI / 2)
    part('box', '#578193', x - 1.57, 1.6, z - 0.8, 0.08, 0.85, 0.8)
    part('box', '#977559', x - 1.57, 0.8, z + 0.75, 0.08, 1.6, 0.8)
    part('box', '#f4edcf', x - 0.7, 3.5, z + 0.6, 0.48, 1.7, 0.48)
    for (let j = 0; j < 4; j++) {
      part('box', '#ede2be', 25.7 + j * 0.7, 0.6, z + 2.45, 0.12, 1.2, 0.12)
      part('sphere', ['#edba63', '#e58e95'][j % 2], 25.5 + j * 0.7, 0.4, z - 2.3, 0.4, 0.5, 0.4)
    }
    part('box', '#ede2be', 26.7, 0.8, z + 2.45, 2.8, 0.13, 0.12)
  }
  // Passengers are just a few shared primitive instances.
  for (let i = 0; i < 9; i++) {
    const x = -9 + i * 1.55
    const z = 20 + (i % 2) * 0.45
    part('sphere', ['#ed9760', '#6c94bd', '#dfbd54', '#a885b0'][i % 4], x, 1.06, z, 0.45, 0.75, 0.4)
    part('sphere', '#ecc49b', x, 1.65, z, 0.42, 0.45, 0.42)
    part('sphere', '#795d4e', x, 1.84, z, 0.45, 0.16, 0.45)
    for (const s of [-1, 1]) part('box', '#637b85', x + s * 0.12, 0.71, z, 0.13, 0.36, 0.17)
  }
  // Flowers along the foreground and little patches throughout the island.
  for (let i = 0; i < 100; i++) {
    const x = noise(i + 600) * 50 - 25
    const z = noise(i + 800) * 49 - 23
    if (!clear(x, z, 2) || (x > -5 && x < 11 && z > 1 && z < 15) || z > 19 || inTown(x, z)) continue
    part('sphere', '#86ae65', x, 0.05, z, 1.2, 0.16, 0.8)
    for (let j = 0; j < 3; j++) part('sphere', ['#ffe5a1', '#fff5d7', '#e99c9e'][i % 3], x + j * 0.2, 0.18, z + (j % 2) * 0.22, 0.18, 0.18, 0.18)
  }
  // Turnout lever and arrows share the destination colours of the UI.
  const stand = buildSwitchStand(group, part, course, course.switches[0])

  // A small windmill and ripples add quiet movement to the scenery.
  part('cone', '#f4e1bc', 15, 1.5, 5, 2.1, 3.1, 2.1)
  part('cone', '#c87355', 15, 3.35, 5, 2.4, 1.2, 2.4)
  const sails = new THREE.Group()
  sails.position.set(15, 3, 6)
  const sailMaterial = new THREE.MeshStandardMaterial({ color: '#fff6d7', roughness: 0.85 })
  const sailGeometry = new THREE.BoxGeometry(0.35, 2.1, 0.09)
  for (let i = 0; i < 4; i++) {
    const sail = new THREE.Mesh(sailGeometry, sailMaterial)
    const angle = i * Math.PI / 2
    sail.position.set(Math.sin(angle) * 1.05, Math.cos(angle) * 1.05, 0)
    sail.rotation.z = -angle
    sail.castShadow = true
    sails.add(sail)
  }
  group.add(sails)
  const ripples = new THREE.Group()
  const rippleGeometry = new THREE.RingGeometry(0.91, 1, 28)
  const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#c5e7d6', transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })
  for (let i = 0; i < 4; i++) {
    const ripple = new THREE.Mesh(rippleGeometry, rippleMaterial)
    ripple.rotation.x = -Math.PI / 2
    ripple.position.set(1 + (i % 2) * 4, 0.09, 6 + Math.floor(i / 2) * 3)
    ripples.add(ripple)
  }
  group.add(ripples)
  batch.finish()
  return {
    group,
    tunnels: [{ edge: 'forest', start: tunnelStart, end: tunnelEnd, caption: 'トンネルを くぐるよ！' }],
    setOverview(overview: boolean) {
      stationLabel.visible = overview
      tunnelLabel.visible = overview
      cityLabel.visible = overview
    },
    update(seconds: number, reducedMotion: boolean, crossingClosed = false) {
      // The barriers are a safety cue, so they keep working when motion is reduced.
      const target = crossingClosed ? 0 : Math.PI / 2
      gateLift = reducedMotion ? target : gateLift + Math.max(-0.08, Math.min(0.08, target - gateLift))
      for (const gate of town.gates) gate.rotation.x = -gateLift
      if (reducedMotion) return
      sails.rotation.z = seconds * 0.23
      ripples.children.forEach((ripple, i) => {
        const scale = 0.3 + ((seconds * 0.18 + i * 0.25) % 1) * 0.55
        ripple.scale.set(scale, scale * 0.7, 1)
      })
    },
    setRoutes(routes: JourneyRoutes) {
      stand.setRoute(routes[0], beds)
    },
  }
}
