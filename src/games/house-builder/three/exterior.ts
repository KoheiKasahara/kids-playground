// そとから みる 3D の おうち。まどりの かたちに かべを たて、やね・まど・ドア と にわの ものを ならべる。

import * as THREE from 'three'
import { findRoof, findShape, findWall, type DoghouseId, type Exterior, type ExtraId, type RoofKind } from '../data'
import {
  BASE_H, CAR_L, CAR_W, CELL, STORY, footprintRects, sideOpenings, wallRuns, yardLayout,
  type Rect, type WallRun,
} from '../layout3d'
import { floorCount, type HouseDesign } from '../plan'
import { Kit, ball, block, disposeObject, group, mesh, mix, tube, type Built, type Tick, type V3 } from './kit'
import { openingPanel } from './openings'
import { roofTexture, wallTexture } from './textures'

const T = .22
const EAVE = .5
const GABLE_EAVE = .3
const PITCH: Readonly<Record<Exclude<RoofKind, 'flat'>, number>> = { gable: .56, kawara: .48, steep: 1 }

type Ctx = { k: Kit; root: THREE.Group; ticks: Tick[]; ex: Exterior }

// ---------------- にわの もの ----------------

function car(k: Kit, parent: THREE.Object3D, at: V3, color: string, name: string) {
  const c = group(parent, at)
  c.name = name
  c.userData.spot = 'car'
  const glass = k.mat('#37474f', { rough: .15, metal: .3 })
  block(k, c, [CAR_W, .62, CAR_L], color, [0, .26, 0], { round: .22 })
  block(k, c, [CAR_W - .24, .55, 2.1], color, [0, .78, -.25], { round: .18 })
  block(k, c, [CAR_W - .2, .42, 1.9], glass, [0, .83, -.25], { round: .12 })
  block(k, c, [CAR_W - .5, .44, 2.14], glass, [0, .82, -.25], { round: .1 })
  for (const x of [-CAR_W / 2 + .05, CAR_W / 2 - .05]) {
    for (const z of [-CAR_L / 2 + .75, CAR_L / 2 - .8]) {
      c.add(mesh(k, k.cyl(.34, .34, .26, 18), '#263238', [x, .34, z], { rot: [0, 0, Math.PI / 2] }))
      c.add(mesh(k, k.cyl(.16, .16, .27, 14), '#b0bec5', [x, .34, z], { rot: [0, 0, Math.PI / 2], noShadow: true }))
    }
  }
  const head = k.mat('#fff9c4', { emissive: '#ffee58', glow: .8 })
  for (const x of [-.6, .6]) {
    block(k, c, [.32, .14, .05], head, [x, .6, CAR_L / 2 - .02], { noShadow: true })
    block(k, c, [.3, .12, .05], k.mat('#e53935', { emissive: '#b71c1c', glow: .5 }), [x, .62, -CAR_L / 2 + .02], { noShadow: true })
  }
  block(k, c, [CAR_W + .04, .12, .14], '#9e9e9e', [0, .26, CAR_L / 2 - .02], { round: .05 })
  block(k, c, [CAR_W + .04, .12, .14], '#9e9e9e', [0, .26, -CAR_L / 2 + .02], { round: .05 })
  return c
}

function doghouse(c: Ctx, at: V3, id: Exclude<DoghouseId, 'none'>) {
  const { k, root, ticks } = c
  const g = group(root, at, -.35)
  g.name = 'doghouse'
  g.userData.spot = 'dog'
  const roof = id === 'blue' ? '#3f7cc8' : id === 'log' ? '#6d4c41' : '#d9493b'
  const body = id === 'log' ? '#b07440' : '#f3e0c0'
  const fur = id === 'blue' ? '#ffffff' : '#c68642'
  block(k, g, [1.1, .9, 1.1], body, [0, 0, 0], { round: .03 })
  if (id === 'log') for (let i = 1; i < 6; i++) block(k, g, [1.12, .02, 1.12], '#7a4a24', [0, i * .15, 0], { noShadow: true })
  for (const s of [-1, 1]) block(k, g, [1.35, .08, .82], roof, [0, 1.12, s * .32], { rot: [s * .75, 0, 0] })
  const tri = k.custom('dog-gable', () => {
    const shape = new THREE.Shape()
    shape.moveTo(-.55, 0)
    shape.lineTo(.55, 0)
    shape.lineTo(0, .42)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: false })
  })
  g.add(mesh(k, tri, body, [-.55, .9, 0], { rot: [0, Math.PI / 2, 0] }))
  block(k, g, [.46, .42, .02], '#3e2723', [0, 0, .551], { noShadow: true })
  g.add(mesh(k, k.half(.23, 16), '#3e2723', [0, .42, .562], { noShadow: true }))
  block(k, g, [.34, .1, .02], '#fff8e1', [0, .7, .56], { noShadow: true })
  const dog = group(g, [1.05, 0, .35])
  ball(k, dog, .28, fur, [0, .4, 0], { scale: [1.3, .9, .85] })
  ball(k, dog, .21, fur, [.34, .68, 0])
  ball(k, dog, .1, mix(fur, '#ffffff', .4), [.52, .62, 0], { scale: [1.2, .8, 1] })
  ball(k, dog, .035, '#1b1b1b', [.62, .65, 0], { noShadow: true })
  for (const z of [-.09, .09]) {
    ball(k, dog, .03, '#1b1b1b', [.48, .75, z], { noShadow: true })
    ball(k, dog, .1, '#8d5524', [.28, .82, z * 2.2], { scale: [.5, 1.2, .6] })
  }
  for (const [x, z] of [[.2, .14], [.2, -.14], [-.2, .14], [-.2, -.14]] as const) tube(k, dog, .065, .25, fur, [x, 0, z], { noShadow: true })
  const tail = group(dog, [-.36, .5, 0])
  tail.add(mesh(k, k.cyl(.035, .05, .32, 8), fur, [-.06, .14, 0], { rot: [0, 0, .5], noShadow: true }))
  ticks.push((time) => { tail.rotation.x = Math.sin(time / 110) * .6 })
}

function tree(k: Kit, parent: THREE.Object3D, at: V3, s: number) {
  const t = group(parent, at)
  t.scale.setScalar(s)
  tube(k, t, .2, 1.6, '#8d6e63', [0, 0, 0], { top: .14 })
  ball(k, t, 1.1, '#4caf50', [0, 2.4, 0])
  ball(k, t, .8, '#43a047', [-.75, 1.95, .2])
  ball(k, t, .8, '#66bb6a', [.75, 2, -.1])
  for (const [x, y, z] of [[.4, 2.9, .75], [-.5, 2.2, .75], [.85, 2.2, .4]] as const) ball(k, t, .13, '#ef5350', [x, y, z], { noShadow: true })
}

function bush(k: Kit, parent: THREE.Object3D, at: V3) {
  ball(k, parent, .48, '#5aa651', [at[0], at[1] + .32, at[2]], { scale: [1, .72, 1] })
  ball(k, parent, .32, '#6fbf5f', [at[0] + .3, at[1] + .25, at[2] + .1], { scale: [1, .8, 1] })
}

function koinobori(c: Ctx, at: V3) {
  const { k, root, ticks } = c
  const g = group(root, at)
  g.name = 'koinobori'
  tube(k, g, .07, 7.2, '#bdbdbd', [0, 0, 0])
  ball(k, g, .16, k.mat('#ffd54f', { metal: .5, rough: .3 }), [0, 7.3, 0])
  const fish: THREE.Group[] = []
  ;[['#263238', 1.9, 6.4], ['#e53935', 1.6, 5.5], ['#1e88e5', 1.3, 4.7]].forEach(([color, len, y], i) => {
    const f = group(g, [0, y as number, 0])
    const body = group(f, [(len as number) / 2 + .1, 0, 0])
    body.add(mesh(k, k.cyl(.26 - i * .03, .08, len as number, 14, true), k.mat(color as string, { side: THREE.DoubleSide }), [0, 0, 0], { rot: [0, 0, Math.PI / 2] }))
    for (const z of [-.2, .2]) {
      body.add(mesh(k, k.circle(.08, 14), '#ffffff', [-(len as number) / 2 + .2, .06, z * (1 - i * .1)], { rot: [0, z > 0 ? 0 : Math.PI, 0], noShadow: true }))
      body.add(mesh(k, k.circle(.04, 10), '#1b1b1b', [-(len as number) / 2 + .2, .06, z * (1 - i * .1) + (z > 0 ? .005 : -.005)], { rot: [0, z > 0 ? 0 : Math.PI, 0], noShadow: true }))
    }
    fish.push(f)
  })
  ticks.push((time) => fish.forEach((f, i) => {
    f.rotation.y = Math.sin(time / 900 + i) * .35 - .4
    f.rotation.z = Math.sin(time / 260 + i * 1.3) * .08
  }))
}

function swing(c: Ctx, at: V3) {
  const { k, root, ticks } = c
  const g = group(root, at)
  g.name = 'swing'
  const red = '#e53935'
  for (const x of [-1.1, 1.1]) {
    for (const s of [-1, 1]) g.add(mesh(k, k.cyl(.06, .06, 2.4, 10), red, [x, 1.15, s * .45], { rot: [s * .38, 0, 0] }))
  }
  g.add(mesh(k, k.cyl(.07, .07, 2.4, 10), red, [0, 2.25, 0], { rot: [0, 0, Math.PI / 2] }))
  const seat = group(g, [0, 2.25, 0])
  for (const x of [-.32, .32]) seat.add(mesh(k, k.cyl(.015, .015, 1.7, 6), '#5d4037', [x, -.85, 0], { noShadow: true }))
  block(k, seat, [.8, .07, .32], '#ffb300', [0, -1.75, 0], { round: .02 })
  ticks.push((time) => { seat.rotation.x = Math.sin(time / 700) * .32 })
}

function bike(k: Kit, parent: THREE.Object3D, at: V3) {
  const b = group(parent, at)
  b.name = 'bike'
  const blue = '#1e88e5'
  for (const x of [-.52, .52]) {
    b.add(mesh(k, k.torus(.3, .04, Math.PI * 2, 24), '#37474f', [x, .34, 0]))
    b.add(mesh(k, k.cyl(.02, .02, .58, 6), '#b0bec5', [x, .34, 0], { rot: [0, 0, Math.PI / 4], noShadow: true }))
  }
  b.add(mesh(k, k.cyl(.03, .03, .9, 8), blue, [0, .6, 0], { rot: [0, 0, Math.PI / 2] }))
  b.add(mesh(k, k.cyl(.03, .03, .6, 8), blue, [-.28, .48, 0], { rot: [0, 0, -.9] }))
  b.add(mesh(k, k.cyl(.03, .03, .6, 8), blue, [.28, .48, 0], { rot: [0, 0, .9] }))
  block(k, b, [.24, .06, .12], '#37474f', [-.32, .78, 0], { round: .02 })
  b.add(mesh(k, k.cyl(.02, .02, .5, 8), '#37474f', [.5, .88, 0], { rot: [Math.PI / 2, 0, 0] }))
  block(k, b, [.5, .14, .3], '#90caf9', [.7, .62, 0], { round: .03 })
}

function mailbox(k: Kit, parent: THREE.Object3D, at: V3) {
  const m = group(parent, at)
  m.name = 'mailbox'
  tube(k, m, .05, 1, '#6d4c41', [0, 0, 0])
  block(k, m, [.42, .34, .5], '#e53935', [0, 1, 0], { round: .1 })
  block(k, m, [.26, .03, .02], '#9a2018', [0, 1.22, .26], { noShadow: true })
}

function veggies(k: Kit, parent: THREE.Object3D, box: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const g = group(parent, [(box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2])
  g.name = 'veggies'
  const w = box.maxX - box.minX
  const d = box.maxZ - box.minZ
  block(k, g, [w, .22, d], '#8d6e63', [0, 0, 0], { round: .05 })
  for (let r = 0; r < 3; r++) {
    for (let i = 0; i < 5; i++) {
      const x = -w / 2 + .35 + (i * (w - .7)) / 4
      const z = -d / 2 + .45 + (r * (d - .9)) / 2
      g.add(mesh(k, k.cyl(0, .16, .42, 8), '#43a047', [x, .43, z], { noShadow: true }))
      if (r === 0) ball(k, g, .09, '#e53935', [x + .1, .4, z + .08], { noShadow: true })
      if (r === 1) g.add(mesh(k, k.cyl(.06, 0, .22, 8), '#fb8c00', [x, .3, z + .1], { rot: [.4, 0, 0], noShadow: true }))
      if (r === 2) ball(k, g, .13, '#c0ca33', [x, .32, z], { scale: [1, .8, 1], noShadow: true })
    }
  }
}

function pond(c: Ctx, box: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  const { k, root, ticks } = c
  const g = group(root, [(box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2])
  g.name = 'pond'
  const rx = (box.maxX - box.minX) / 2
  const rz = (box.maxZ - box.minZ) / 2
  tube(k, g, 1, .05, k.mat('#4fc3f7', { opacity: .85, rough: .1, emissive: '#1e88e5', glow: .2 }), [0, .01, 0], { scale: [rx - .1, 1, rz - .1], seg: 36, noShadow: true })
  const n = 16
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    g.add(mesh(k, k.rock(.2 + (i % 3) * .05), ['#9e9e9e', '#bdbdbd', '#8d8d8d'][i % 3], [Math.cos(a) * rx, .1, Math.sin(a) * rz], { rot: [i, i, 0], scale: [1, .6, 1] }))
  }
  g.add(mesh(k, k.circle(.25, 16), '#81c784', [rx * .4, .07, -rz * .3], { rot: [-Math.PI / 2, 0, 0], noShadow: true }))
  const fish: THREE.Group[] = []
  for (let i = 0; i < 2; i++) {
    const f = group(g, [0, .04, 0])
    ball(k, f, .14, i ? '#ffffff' : '#ff7043', [0, 0, 0], { scale: [1.6, .5, .7], noShadow: true })
    f.add(mesh(k, k.cyl(0, .12, .18, 6), '#ff7043', [-.26, 0, 0], { rot: [0, 0, Math.PI / 2], noShadow: true }))
    fish.push(f)
  }
  ticks.push((time) => fish.forEach((f, i) => {
    const a = time / (1800 + i * 600) + i * 2
    f.position.set(Math.cos(a) * (rx - .5), .04, Math.sin(a) * (rz - .4))
    f.rotation.y = -a - Math.PI / 2
  }))
}

function flowerBed(c: Ctx, runs: readonly WallRun[], wx: (n: number) => number, wz: (n: number) => number, doorX: number) {
  const { k, root } = c
  const spots: { x: number; z: number }[] = []
  for (const run of runs) {
    if (run.side !== 'front') continue
    const z = wz(run.line) + T / 2 + .45
    for (let x = wx(run.from) + .3; x <= wx(run.to) - .3; x += .32) {
      if (Math.abs(x - doorX) < 1.1) continue
      spots.push({ x, z })
    }
  }
  if (spots.length === 0) return
  const colors = ['#ff6b9a', '#ffd166', '#ef476f', '#c77dff', '#ffffff']
  const leaves = new THREE.InstancedMesh(k.sphere(.14, 10), k.mat('#4caf50'), spots.length)
  const blooms = new THREE.InstancedMesh(k.sphere(.08, 10), k.mat('#ffffff'), spots.length)
  const m = new THREE.Matrix4()
  spots.forEach((p, i) => {
    leaves.setMatrixAt(i, m.makeTranslation(p.x, .14, p.z))
    blooms.setMatrixAt(i, m.makeTranslation(p.x + (i % 2 ? .05 : -.05), .3, p.z + .05))
    blooms.setColorAt(i, new THREE.Color(colors[i % colors.length]))
  })
  leaves.name = 'flowers'
  blooms.castShadow = leaves.castShadow = true
  root.add(leaves, blooms)
}

function fence(c: Ctx, yard: { minX: number; maxX: number; minZ: number; maxZ: number }, gap: { minX: number; maxX: number }, backZ: number) {
  const { k, root } = c
  const posts: V3[] = []
  const rail = (from: V3, to: V3) => {
    const len = Math.hypot(to[0] - from[0], to[2] - from[2])
    if (len < .1) return
    const g = group(root, [(from[0] + to[0]) / 2, 0, (from[2] + to[2]) / 2], Math.atan2(to[0] - from[0], to[2] - from[2]))
    for (const y of [.3, .62]) block(k, g, [.05, .08, len], '#eeeeee', [0, y, 0], { noShadow: true })
    for (let d = .15; d < len; d += .32) posts.push([g.position.x + Math.sin(g.rotation.y) * (d - len / 2), 0, g.position.z + Math.cos(g.rotation.y) * (d - len / 2)])
  }
  rail([yard.minX, 0, yard.maxZ], [gap.minX, 0, yard.maxZ])
  rail([gap.maxX, 0, yard.maxZ], [yard.maxX, 0, yard.maxZ])
  rail([yard.minX, 0, backZ], [yard.minX, 0, yard.maxZ])
  rail([yard.maxX, 0, backZ], [yard.maxX, 0, yard.maxZ])
  const pickets = new THREE.InstancedMesh(k.box(.1, .85, .05), k.mat('#ffffff'), posts.length)
  const m = new THREE.Matrix4()
  posts.forEach((p, i) => pickets.setMatrixAt(i, m.makeTranslation(p[0], .425, p[2])))
  pickets.name = 'fence'
  pickets.castShadow = true
  root.add(pickets)
}

/** いえの まわりを ゆっくり まわる くも。いえに かさならない ように たかく とおくに おく。 */
function clouds(c: Ctx, span: number, height: number) {
  const { k, root, ticks } = c
  const white = k.mat('#ffffff', { rough: 1, emissive: '#ffffff', glow: .25 })
  const list: THREE.Group[] = []
  for (let i = 0; i < 6; i++) {
    const cl = group(root, [0, height + (i % 3) * 2.4, 0])
    cl.scale.setScalar(1.4 + (i % 2) * .4)
    ball(k, cl, 2, white, [0, 0, 0], { noShadow: true })
    ball(k, cl, 1.5, white, [1.9, -.3, .3], { noShadow: true })
    ball(k, cl, 1.4, white, [-1.8, -.4, -.2], { noShadow: true })
    list.push(cl)
  }
  const drift = (time: number) => list.forEach((cl, i) => {
    const a = (i * Math.PI) / 3 + .5 + time / 90000
    cl.position.x = Math.sin(a) * span
    cl.position.z = Math.cos(a) * span
  })
  drift(0)
  ticks.push(drift)
}

// ---------------- やね ----------------

function roofWing(c: Ctx, rect: Rect, wx: (n: number) => number, wz: (n: number) => number, top: number, main: boolean) {
  const { k, root, ex } = c
  const roof = findRoof(ex.roof)
  const wall = findWall(ex.wall)
  const x0 = wx(rect.x) - T / 2
  const x1 = wx(rect.x + rect.w) + T / 2
  const z0 = wz(rect.y) - T / 2
  const z1 = wz(rect.y + rect.h) + T / 2
  const alongX = x1 - x0 >= z1 - z0
  const long = alongX ? x1 - x0 : z1 - z0
  const span = alongX ? z1 - z0 : x1 - x0
  // むねが よこ（x）に くる むきで つくって、たてながの ときは まわす。
  const wing = group(root, [(x0 + x1) / 2, top, (z0 + z1) / 2], alongX ? 0 : Math.PI / 2)
  wing.name = main ? 'roof-main' : 'roof'
  const has = (id: ExtraId) => ex.extras.includes(id)
  if (roof.kind === 'flat') {
    block(k, wing, [long + .3, .26, span + .3], k.mat('#ffffff', { map: k.tex(`roof-${roof.id}`, () => roofTexture(roof.kind, roof.color, roof.dark), [long / 2, span / 2]) }), [0, 0, 0])
    for (const z of [-1, 1]) block(k, wing, [long + .3, .3, .14], roof.dark, [0, .26, z * (span / 2 + .08)])
    for (const x of [-1, 1]) block(k, wing, [.14, .3, span + .3], roof.dark, [x * (long / 2 + .08), .26, 0])
    if (main && has('solar')) {
      // たいらな やねの うえに ならべ、どの むきの やねでも おもて（+z）に かたむける。
      const cols = Math.max(1, Math.min(4, Math.floor((long - .8) / 1.7)))
      const rows = Math.max(1, Math.min(3, Math.floor((span - .8) / 2.2)))
      const panel = k.mat('#1a3d7c', { rough: .25, metal: .4 })
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const p = group(wing, [-long / 2 + .4 + ((i + .5) * (long - .8)) / cols, .26, -span / 2 + .4 + ((j + .5) * (span - .8)) / rows], alongX ? 0 : -Math.PI / 2)
          p.name = 'solar'
          block(k, p, [1.3, .05, 1.5], panel, [0, .3, 0], { rot: [.35, 0, 0] })
          block(k, p, [.02, .055, 1.5], '#90caf9', [0, .3, 0], { rot: [.35, 0, 0], noShadow: true })
          block(k, p, [1.1, .3, .06], '#9e9e9e', [0, 0, -.55], { noShadow: true })
        }
      }
    }
    if (main && has('chimney')) chimney(c, wing, [long / 2 - .9, .26, -span / 4], 1.5)
    return
  }
  const kind = roof.kind
  const pitch = PITCH[kind]
  const rise = (span / 2) * Math.tan(pitch)
  const run = span / 2 + EAVE
  const slope = run / Math.cos(pitch)
  const len = long + GABLE_EAVE * 2
  const map = k.tex(`roof-${roof.id}`, () => roofTexture(kind, roof.color, roof.dark), [len / 2, slope / 2])
  const look = k.mat(map ? '#ffffff' : roof.color, { map })
  const thick = kind === 'kawara' ? .2 : .14
  for (const s of [-1, 1]) {
    const slab = mesh(k, k.box(len, thick, slope), look, [0, rise - (run / 2) * Math.tan(pitch) + thick / 2 / Math.cos(pitch), s * (run / 2)], { rot: [s * pitch, 0, 0] })
    wing.add(slab)
    block(k, wing, [len, .12, .1], roof.dark, [0, rise - run * Math.tan(pitch) - .06, s * run], { noShadow: true })
  }
  block(k, wing, [len + .04, kind === 'kawara' ? .24 : .16, .26], roof.dark, [0, rise + thick * .5, 0], { round: .04 })
  if (kind === 'kawara') for (const x of [-1, 1]) block(k, wing, [.24, .4, .44], roof.dark, [x * (len / 2 - .1), rise + .05, 0], { round: .05 })
  const gable = k.custom(`gable-${span.toFixed(2)}-${rise.toFixed(2)}`, () => {
    const shape = new THREE.Shape()
    shape.moveTo(-span / 2, 0)
    shape.lineTo(span / 2, 0)
    shape.lineTo(0, rise)
    shape.closePath()
    return new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false })
  })
  const gableColor = wall.kind === 'wa' ? '#f6f1e4' : wall.base
  for (const x of [-1, 1]) wing.add(mesh(k, gable, gableColor, [x * long / 2 - (x > 0 ? T : 0), 0, 0], { rot: [0, Math.PI / 2, 0] }))
  // まえがわの やねの ひょうめんに そって ものを おく。
  const onSlope = (x: number, z: number, lift: number): V3 => [x, rise - Math.abs(z) * Math.tan(pitch) + thick / Math.cos(pitch) + lift, z]
  if (kind === 'steep' && main) {
    const p = group(wing, onSlope(0, span / 4, .02))
    p.rotation.x = pitch - Math.PI / 2
    p.add(mesh(k, k.circle(.38, 24), k.mat('#a9dcf7', { rough: .12, metal: .25, emissive: '#2f6d93', glow: .2 }), [0, 0, 0], { noShadow: true }))
    p.add(mesh(k, k.torus(.38, .06, Math.PI * 2, 28), '#ffffff', [0, 0, 0]))
  }
  if (main && has('solar')) {
    const n = Math.max(2, Math.min(4, Math.floor(long / 1.8)))
    for (let i = 0; i < n; i++) {
      const x = -long / 2 + 1 + ((i + .5) * (long - 2)) / n
      const p = group(wing, onSlope(x, span / 4 + .1, .04))
      p.name = 'solar'
      p.rotation.x = pitch
      block(k, p, [Math.min(1.4, (long - 2) / n - .1), .05, Math.min(1.6, span / 2 - .3)], k.mat('#1a3d7c', { rough: .25, metal: .4 }), [0, 0, 0])
      block(k, p, [.02, .055, Math.min(1.6, span / 2 - .3)], '#90caf9', [0, 0, 0], { noShadow: true })
    }
  }
  if (main && has('chimney')) {
    const z = -span / 4
    const base = rise - Math.abs(z) * Math.tan(pitch)
    chimney(c, wing, [long / 2 - Math.min(1.4, long / 4), 0, z], rise + .9 - base, base)
  }
}

function chimney(c: Ctx, parent: THREE.Object3D, at: V3, height: number, base = at[1]) {
  const { k, ticks } = c
  const g = group(parent, [at[0], base - .3, at[2]])
  g.name = 'chimney'
  block(k, g, [.6, height + .3, .6], '#a5523a', [0, 0, 0])
  block(k, g, [.74, .14, .74], '#6d2f1f', [0, height + .3, 0])
  const puffs: THREE.Mesh[] = []
  for (let i = 0; i < 3; i++) {
    const m = mesh(k, k.sphere(.3, 12), k.mat('#ffffff', { opacity: .7 }), [0, height + .8, 0], { noShadow: true })
    g.add(m)
    puffs.push(m)
  }
  ticks.push((time) => puffs.forEach((m, i) => {
    const t = (time / 2400 + i / 3) % 1
    m.position.set(t * .5, height + .6 + t * 2.2, 0)
    m.scale.setScalar(.5 + t * 1.1)
  }))
}

// ---------------- ぜんたい ----------------

/** できあがった おうちを そとから みる 3D。 */
export function buildExterior(design: HouseDesign): Built {
  const k = new Kit()
  const root = new THREE.Group()
  root.name = 'house-outside'
  const shape = findShape(design.shape)
  const ex = design.exterior
  const floors = floorCount(design)
  const wall = findWall(ex.wall)
  const yard = yardLayout(design)
  const ticks: Tick[] = []
  const c: Ctx = { k, root, ticks, ex }
  const has = (id: ExtraId) => ex.extras.includes(id)
  const wx = (n: number) => (n - shape.width / 2) * CELL
  const wz = (n: number) => (n - shape.height / 2) * CELL
  const top = BASE_H + floors * STORY
  const runs = wallRuns(shape)
  const rects = footprintRects(shape)

  // じめん・みち。
  const reach = Math.max(-yard.yard.minX, yard.yard.maxX, -yard.yard.minZ, yard.yard.maxZ)
  tube(k, root, reach + 18, .2, '#8bc34a', [0, -.2, 0], { seg: 48, noShadow: true })
  block(k, root, [yard.yard.maxX - yard.yard.minX, .02, yard.yard.maxZ - yard.yard.minZ], '#9ccc65', [(yard.yard.minX + yard.yard.maxX) / 2, 0, (yard.yard.minZ + yard.yard.maxZ) / 2], { noShadow: true })
  const roadZ = yard.yard.maxZ + 2.6
  block(k, root, [(reach + 18) * 2, .03, 3.6], '#78909c', [0, 0, roadZ], { noShadow: true })
  for (let x = -reach - 14; x < reach + 14; x += 3) block(k, root, [1.4, .035, .14], '#ffffff', [x, 0, roadZ], { noShadow: true })
  for (let z = yard.door.z + .75, i = 0; z < yard.yard.maxZ - .3; z += .78, i++) {
    tube(k, root, .34, .06, '#d7ccc8', [yard.door.x + (i % 2 ? .14 : -.12), 0, z], { seg: 14, noShadow: true })
  }

  // どだい と かべ。
  for (const r of rects) block(k, root, [r.w * CELL + T + .1, BASE_H, r.h * CELL + T + .1], '#9e9e9e', [wx(r.x + r.w / 2), 0, wz(r.y + r.h / 2)])
  const house = group(root)
  house.name = 'house'
  for (let f = 0; f < floors; f++) {
    const y0 = BASE_H + f * STORY
    const story = group(house, [0, y0, 0])
    story.name = `floor-${f}`
    for (const run of runs) {
      const length = (run.to - run.from) * CELL + T
      const map = k.tex(`wall-${wall.id}`, () => wallTexture(wall.kind, wall.base, wall.line), [length / 2, 1])
      const look = k.mat(map ? '#ffffff' : wall.base, { map })
      const mid = (run.from + run.to) / 2
      const across = run.side === 'front' || run.side === 'back'
      const at: V3 = across ? [wx(mid), 0, wz(run.line)] : [wx(run.line), 0, wz(mid)]
      block(k, story, across ? [length, STORY, T] : [T, STORY, length], look, at)
      if (f > 0) block(k, story, across ? [length + .08, .16, T + .08] : [T + .08, .16, length + .08], mix(wall.line, '#000000', .1), [at[0], -.08, at[2]], { noShadow: true })
    }
    for (const o of sideOpenings(design, f)) {
      const run = runs.find((r) => r.side === o.side && r.line === o.line && o.center > r.from && o.center < r.to)
      if (!run) continue
      const room = Math.min(o.center - run.from, run.to - o.center) * CELL * 2 - .3
      if (room < .4) continue
      const panel = openingPanel(k, o.kind, o.span, { window: ex.window, door: ex.door, inside: false }, room)
      const across = o.side === 'front' || o.side === 'back'
      const out = o.side === 'front' || o.side === 'right' ? T / 2 + .003 : -T / 2 - .003
      if (across) panel.position.set(wx(o.center), 0, wz(o.line) + out)
      else panel.position.set(wx(o.line) + out, 0, wz(o.center))
      panel.rotation.y = { front: 0, back: Math.PI, left: -Math.PI / 2, right: Math.PI / 2 }[o.side]
      if (o.kind === 'door') {
        panel.name = 'door'
        panel.userData.spot = 'door'
      }
      story.add(panel)
    }
  }
  // やね。
  const mainRect = rects.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a), rects[0])
  for (const r of rects) roofWing(c, r, wx, wz, top, r === mainRect)

  // ベランダ（2かいいじょう）か ウッドデッキ（ひらや）。
  const fronts = runs.filter((r) => r.side === 'front').sort((a, b) => b.to - b.from - (a.to - a.from))
  const longest = fronts[0]
  if (has('balcony') && longest) {
    const len = (longest.to - longest.from) * CELL
    const z = wz(longest.line) + T / 2
    if (floors === 1) {
      const dw = Math.min(len * .45, 4.5)
      let cx = wx((longest.from + longest.to) / 2)
      if (Math.abs(cx - yard.door.x) < dw / 2 + 1) cx = yard.door.x < cx ? Math.min(wx(longest.to) - dw / 2, yard.door.x + 1 + dw / 2) : Math.max(wx(longest.from) + dw / 2, yard.door.x - 1 - dw / 2)
      const deck = group(root, [cx, 0, z + .5])
      deck.name = 'balcony'
      block(k, deck, [dw, .32, 1], '#b07440', [0, 0, 0])
      for (let i = 1; i < 5; i++) block(k, deck, [dw + .01, .012, .02], '#7a4a24', [0, .32, -.5 + i * .2], { noShadow: true })
    } else {
      const bw = Math.min(len * .6, 5)
      const cx = wx((longest.from + longest.to) / 2)
      for (let f = 1; f < floors; f++) {
        const b = group(root, [cx, BASE_H + f * STORY, z + .55])
        b.name = 'balcony'
        block(k, b, [bw, .14, 1.1], '#9e9e9e', [0, -.14, 0])
        block(k, b, [bw, .06, .06], '#ffffff', [0, .95, .52], { noShadow: true })
        for (const x of [-1, 1]) block(k, b, [.06, .06, 1.1], '#ffffff', [x * (bw / 2 - .03), .95, 0], { noShadow: true })
        for (let x = -bw / 2 + .1; x <= bw / 2 - .05; x += .22) block(k, b, [.04, .95, .04], '#ffffff', [x, 0, .52], { noShadow: true })
        if (f === 1) {
          block(k, b, [bw - .4, .03, .03], '#757575', [0, 1.75, .1], { noShadow: true })
          ;['#4fc3f7', '#ff8a80', '#fff176', '#a5d6a7'].forEach((color, i) => {
            block(k, b, [.45, .6, .02], color, [-bw / 2 + .6 + (i * (bw - 1.2)) / 3, 1.15, .1], { noShadow: true })
          })
        }
      }
    }
  }

  // にわ。
  if (yard.parking) {
    const p = yard.parking
    block(k, root, [p.maxX - p.minX, .06, p.maxZ - p.minZ], '#b0b5ba', [(p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2], { noShadow: true })
    const colors = ex.parking === 'blue' ? ['#1e88e5'] : ex.parking === 'garage' ? ['#43a047'] : ex.parking === 'two' ? ['#e53935', '#fdd835'] : ['#e53935']
    p.cars.forEach((at, i) => car(k, root, [at.x, .06, at.z], colors[i], p.cars.length > 1 ? `car-${i + 1}` : 'car'))
    if (ex.parking === 'garage') {
      const g = group(root, [(p.minX + p.maxX) / 2, 0, (p.minZ + p.maxZ) / 2])
      g.name = 'garage'
      const w = p.maxX - p.minX
      const d = p.maxZ - p.minZ
      for (const x of [-w / 2 + .15, w / 2 - .15]) for (const z of [-d / 2 + .2, d / 2 - .2]) tube(k, g, .08, 2.4, '#78909c', [x, 0, z])
      block(k, g, [w + .4, .12, d + .4], '#546e7a', [0, 2.4, 0], { rot: [.06, 0, 0] })
    }
  }
  if (yard.bike) bike(k, root, [yard.bike.x, 0, yard.bike.z])
  if (yard.mailbox) mailbox(k, root, [yard.mailbox.x, 0, yard.mailbox.z])
  if (yard.plot) {
    if (ex.garden === 'veggies') veggies(k, root, yard.plot)
    else pond(c, yard.plot)
  }
  if (yard.doghouse && ex.doghouse !== 'none') doghouse(c, [yard.doghouse.x, 0, yard.doghouse.z], ex.doghouse)
  if (yard.koinobori) koinobori(c, [yard.koinobori.x, 0, yard.koinobori.z])
  if (yard.swing) swing(c, [yard.swing.x, 0, yard.swing.z])
  yard.trees.forEach((t) => tree(k, root, [t.x, 0, t.z], t.s))
  if (ex.garden === 'flowers') flowerBed(c, runs, wx, wz, yard.door.x)
  for (const x of [yard.house.minX + .55, yard.house.maxX - .55]) {
    const z = yard.frontZ + .75
    const blocked = Math.abs(x - yard.door.x) < 1.4 || [yard.parking, yard.plot].some((b) => b && x > b.minX - .6 && x < b.maxX + .6 && z > b.minZ - .6)
    if (!blocked) bush(k, root, [x, 0, z])
  }
  if (has('fence')) fence(c, yard.yard, { minX: yard.path.minX - .1, maxX: yard.path.maxX + .1 }, yard.house.minZ - 1)
  clouds(c, reach + 22, top + 16)

  const hx = (shape.width * CELL) / 2
  const hz = (shape.height * CELL) / 2
  const height = top + Math.min(hx, hz) * .9
  return {
    root,
    target: new THREE.Vector3(0, height * .42, yard.frontZ * .25),
    radius: Math.hypot(Math.max(hx, hz) + 1, height / 2) + 1.5,
    cutaways: [],
    ticks,
    dispose: () => {
      disposeObject(root)
      k.dispose()
    },
  }
}
