// へやごとの 3D ジオラマ。ゆか・かべ・まど と、へやの しゅるいと みためで きまる かぐを ならべる。
// かぐの みためは きまっていて、へやの おおきさに あわせて ならびかたや かずが かわる。

import * as THREE from 'three'
import { findRoomStyle, type RoomStyle, type RoomTypeId } from '../data'
import { CELL, ROOM_WALL_H, SIDES, innerDoor, roomEdge, roomOpenings, type Side } from '../layout3d'
import { roomSize, type HouseDesign, type PlacedRoom } from '../plan'
import { Kit, ball, block, disposeObject, group, mesh, mix, tube, type Built, type Cutaway, type Tick, type V3 } from './kit'
import { innerDoorPanel, openingPanel } from './openings'
import { floorTexture } from './textures'
import { library, music, art, playroom, pet, laundry, closet, plants } from './hobbyRooms'

const T = .14
const LOW = .22
const H = ROOM_WALL_H

type Ctx = { k: Kit; g: THREE.Group; W: number; D: number; s: RoomStyle; ticks: Tick[] }

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
const WOOD = '#a0673a'
const DARK_WOOD = '#6d4c41'
const WHITE = '#ffffff'

// ---------------- こまかい もの ----------------

function plant(k: Kit, parent: THREE.Object3D, at: V3, scale = 1, pot = '#d9825b') {
  const p = group(parent, at)
  p.scale.setScalar(scale)
  tube(k, p, .2, .36, pot, [0, 0, 0], { top: .24 })
  tube(k, p, .04, .5, '#7a5230', [0, .36, 0], { noShadow: true })
  ball(k, p, .3, '#4caf50', [0, 1.02, 0])
  ball(k, p, .22, '#43a047', [-.2, .86, .1])
  ball(k, p, .2, '#66bb6a', [.18, .9, -.06])
  return p
}

function lamp(k: Kit, parent: THREE.Object3D, at: V3, color = '#fff3d6') {
  const p = group(parent, at)
  tube(k, p, .08, .04, '#5d4037', [0, 0, 0])
  tube(k, p, .025, .22, '#8d6e63', [0, .04, 0], { noShadow: true })
  p.add(mesh(k, k.cyl(.09, .14, .18, 16), k.mat(color, { emissive: '#ffcc66', glow: .7 }), [0, .34, 0], { noShadow: true }))
  return p
}

function vase(k: Kit, parent: THREE.Object3D, at: V3, color: string, flower: string) {
  const p = group(parent, at)
  tube(k, p, .07, .22, color, [0, 0, 0], { top: .05 })
  for (const [x, z, y] of [[0, 0, .42], [.07, .03, .36], [-.06, -.02, .38]] as const) {
    tube(k, p, .008, y - .1, '#388e3c', [x * .4, .2, z * .4], { noShadow: true })
    ball(k, p, .05, flower, [x, y, z], { noShadow: true })
  }
  return p
}

/** せもたれの ある いす。まえが +z。 */
function chair(k: Kit, parent: THREE.Object3D, at: V3, rotY: number, color: string, seat = color) {
  const p = group(parent, at, rotY)
  for (const x of [-.17, .17]) for (const z of [-.17, .17]) tube(k, p, .02, .45, color, [x, 0, z], { noShadow: true })
  block(k, p, [.44, .06, .44], seat, [0, .45, 0], { round: .02 })
  block(k, p, [.44, .46, .05], color, [0, .51, -.2], { round: .02 })
  return p
}

/** ソファ。まえが +z、うしろが かべ。 */
function sofa(k: Kit, parent: THREE.Object3D, at: V3, rotY: number, w: number, color: string, accent: string) {
  const p = group(parent, at, rotY)
  const soft = mix(color, WHITE, .1)
  for (const x of [-w / 2 + .12, w / 2 - .12]) for (const z of [-.32, .32]) tube(k, p, .03, .1, '#5d4037', [x, 0, z], { noShadow: true })
  block(k, p, [w, .24, .88], color, [0, .1, 0], { round: .06 })
  const n = w > 2.3 ? 3 : w > 1.2 ? 2 : 1
  const cw = (w - .36) / n
  for (let i = 0; i < n; i++) block(k, p, [cw - .03, .14, .66], soft, [-w / 2 + .18 + cw * (i + .5), .32, .08], { round: .06 })
  block(k, p, [w - .36, .44, .22], color, [0, .3, -.33], { round: .09 })
  for (const x of [-w / 2 + .09, w / 2 - .09]) block(k, p, [.18, .4, .88], color, [x, .1, 0], { round: .08 })
  if (w > 1.2) {
    block(k, p, [.36, .32, .12], accent, [-w / 2 + .5, .44, -.16], { round: .06, rot: [-.25, 0, .12] })
    block(k, p, [.36, .32, .12], mix(accent, WHITE, .35), [w / 2 - .5, .44, -.16], { round: .06, rot: [-.25, 0, -.12] })
  }
  return p
}

function table(k: Kit, parent: THREE.Object3D, at: V3, w: number, d: number, h: number, top: string, legs = top) {
  const p = group(parent, at)
  block(k, p, [w, .06, d], top, [0, h - .06, 0], { round: .02 })
  for (const x of [-w / 2 + .08, w / 2 - .08]) for (const z of [-d / 2 + .08, d / 2 - .08]) block(k, p, [.06, h - .06, .06], legs, [x, 0, z], { noShadow: true })
  return p
}

function roundTable(k: Kit, parent: THREE.Object3D, at: V3, r: number, h: number, top: string, stem = DARK_WOOD) {
  const p = group(parent, at)
  tube(k, p, r, .05, top, [0, h - .05, 0], { seg: 28 })
  tube(k, p, .05, h - .05, stem, [0, 0, 0], { noShadow: true })
  tube(k, p, r * .45, .04, stem, [0, 0, 0], { noShadow: true })
  return p
}

function plate(k: Kit, parent: THREE.Object3D, at: V3, food: string) {
  tube(k, parent, .12, .015, WHITE, at, { noShadow: true, seg: 18 })
  ball(k, parent, .05, food, [at[0], at[1] + .04, at[2]], { noShadow: true, scale: [1, .6, 1] })
}

function rug(k: Kit, parent: THREE.Object3D, at: V3, w: number, d: number, color: string, round = false) {
  if (round) tube(k, parent, Math.min(w, d) / 2, .02, color, at, { noShadow: true, seg: 32, scale: [w / Math.min(w, d), 1, d / Math.min(w, d)] })
  else block(k, parent, [w, .02, d], color, at, { noShadow: true, round: .01 })
}

/** かべに かける え。まえが +z。 */
function picture(k: Kit, parent: THREE.Object3D, at: V3, rotY: number, w: number, h: number, art: readonly string[]) {
  const p = group(parent, at, rotY)
  block(k, p, [w, h, .04], '#8d6e63', [0, 0, .02])
  p.add(mesh(k, k.plane(w - .08, h - .08), art[0], [0, h / 2, .041], { noShadow: true }))
  p.add(mesh(k, k.circle(Math.min(w, h) * .16, 16), art[1], [w * .2, h * .66, .043], { noShadow: true }))
  p.add(mesh(k, k.circle(Math.min(w, h) * .34, 3), art[2], [-w * .08, h * .22, .042], { rot: [0, 0, Math.PI / 2], noShadow: true }))
  return p
}

function star(k: Kit, parent: THREE.Object3D, at: V3, rotY: number, r: number, look: THREE.Material) {
  const geo = k.custom('star', () => {
    const shape = new THREE.Shape()
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i * Math.PI) / 5
      const rr = i % 2 ? .42 : 1
      if (i === 0) shape.moveTo(Math.cos(a) * rr, Math.sin(a) * rr)
      else shape.lineTo(Math.cos(a) * rr, Math.sin(a) * rr)
    }
    return new THREE.ShapeGeometry(shape)
  })
  const m = mesh(k, geo, look, at, { rot: [0, rotY, 0], scale: [r, r, r], noShadow: true })
  parent.add(m)
  return m
}

/** かべに ひかる ほしを ちらす（ほしぞら・うちゅう）。 */
function starryWalls(c: Ctx, count: number) {
  const { k, g, W, D, ticks } = c
  const glow = k.mat('#ffe082', { emissive: '#ffd54f', glow: 1.1 })
  const stars: THREE.Mesh[] = []
  for (let i = 0; i < count; i++) {
    const t = (i * .618) % 1
    const y = 1.2 + ((i * .37) % 1) * 1.05
    if (i % 2) stars.push(star(k, g, [-W / 2 + .3 + t * (W - .6), y, -D / 2 + .01], 0, .07 + (i % 3) * .03, glow))
    else stars.push(star(k, g, [-W / 2 + .01, y, -D / 2 + .3 + t * (D - .6)], Math.PI / 2, .07 + (i % 3) * .03, glow))
  }
  ball(k, g, .22, k.mat('#fff7cc', { emissive: '#fff0a0', glow: .9 }), [W / 2 - .7, 2.05, -D / 2 + .05], { scale: [1, 1, .2], noShadow: true })
  ticks.push((time) => stars.forEach((m, i) => m.scale.setScalar((.07 + (i % 3) * .03) * (1 + Math.sin(time / 380 + i * 1.7) * .25))))
}

// ---------------- へや ----------------

function living(c: Ctx) {
  const { k, g, W, D, s, ticks } = c
  const L = -W / 2, R = W / 2, B = -D / 2, F = D / 2
  const pop = s.variant === 'pop'
  const fire = s.variant === 'fireplace'
  const sofaW = clamp(W - 2.3, 1.6, 3.2)
  const sx = .3
  const rugD = Math.min(D - 1.2, 2.4)
  rug(k, g, [sx, 0, B + .3 + rugD / 2], Math.min(W - 1.6, sofaW + 1), rugD, pop ? '#ffffff' : mix(s.accent, WHITE, .55), pop)
  if (pop) {
    ;['#ffd166', '#4dc9ff', '#06d6a0', '#ff6b9a'].forEach((color, i) => {
      tube(k, g, .22, .022, color, [sx - .7 + i * .45, 0, B + 1.6 + (i % 2) * .5], { noShadow: true, seg: 20 })
    })
  }
  sofa(k, g, [sx, 0, B + .12 + .44], 0, sofaW, s.main, s.accent)
  const tz = B + 1.85
  if (pop) roundTable(k, g, [sx, 0, tz], .42, .38, WHITE, WHITE)
  else table(k, g, [sx, 0, tz], 1.1, .6, .4, s.id === 'modern' ? '#2d3142' : WOOD)
  tube(k, g, .05, .1, s.accent, [sx - .25, .4, tz], { noShadow: true })
  ball(k, g, .14, '#fff3e0', [sx + .2, .44, tz], { scale: [1, .45, 1], noShadow: true })
  ball(k, g, .05, '#ff7043', [sx + .18, .5, tz], { noShadow: true })
  ball(k, g, .05, '#ffca28', [sx + .25, .5, tz + .05], { noShadow: true })

  // ひだりの かべ: テレビ か だんろ。
  const zc = clamp(B + 1.6, B + 1, F - 1)
  if (fire) {
    const stone = '#b59f87'
    block(k, g, [.55, H, 1.7], stone, [L + .27, 0, zc])
    block(k, g, [.66, .1, 1.9], DARK_WOOD, [L + .33, 1.12, zc])
    block(k, g, [.08, .75, 1], '#2b1d16', [L + .56, .12, zc])
    block(k, g, [.4, .12, 1.3], '#8d7b68', [L + .2 + .2, 0, zc])
    for (const dz of [-.15, .15]) tube(k, g, .06, .55, '#6d4c41', [L + .45, .2, zc + dz], { rot: [Math.PI / 2, 0, 0], noShadow: true })
    const flames = [
      mesh(k, k.cyl(0, .16, .42, 10), k.mat('#ff7043', { emissive: '#ff5722', glow: 1.2 }), [L + .45, .44, zc], { noShadow: true }),
      mesh(k, k.cyl(0, .1, .3, 10), k.mat('#ffd54f', { emissive: '#ffc107', glow: 1.3 }), [L + .48, .4, zc - .14], { noShadow: true }),
      mesh(k, k.cyl(0, .1, .32, 10), k.mat('#ffd54f', { emissive: '#ffc107', glow: 1.3 }), [L + .48, .4, zc + .14], { noShadow: true }),
    ]
    flames.forEach((f) => g.add(f))
    ticks.push((time) => flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(time / 120 + i * 2) * .18 }))
    vase(k, g, [L + .35, 1.22, zc - .55], '#ffffff', s.accent)
    picture(k, g, [L + .56, 1.5, zc], Math.PI / 2, .8, .6, ['#ffe0b2', '#ff7043', '#6d4c41'])
  } else {
    block(k, g, [.48, .45, 1.8], pop ? '#ffffff' : WOOD, [L + .26, 0, zc], { round: .03 })
    block(k, g, [.08, .05, .3], '#263238', [L + .3, .45, zc])
    block(k, g, [.06, .72, 1.26], '#1b1b1b', [L + .3, .55, zc], { round: .02 })
    g.add(mesh(k, k.plane(1.16, .62), k.mat('#1e3a5f', { emissive: '#3c7bbf', glow: .45, rough: .2 }), [L + .335, .91, zc], { rot: [0, Math.PI / 2, 0], noShadow: true }))
    if (!pop) lamp(k, g, [L + .3, .45, zc + .75])
  }
  plant(k, g, [R - .45, 0, B + .45], 1.1, pop ? '#4dc9ff' : '#d9825b')
  if (!fire && !pop) {
    // フロアランプ。
    const fl = group(g, [L + .45, 0, B + .4])
    tube(k, fl, .16, .03, '#37474f', [0, 0, 0])
    tube(k, fl, .02, 1.45, '#37474f', [0, .03, 0], { noShadow: true })
    fl.add(mesh(k, k.cyl(.14, .24, .3, 18, true), k.mat('#fff3d6', { emissive: '#ffd27a', glow: .6, side: THREE.DoubleSide }), [0, 1.55, 0], { noShadow: true }))
  }
  if (pop) {
    ball(k, g, .38, '#ffd166', [R - 1, .24, F - .9], { scale: [1, .62, 1] })
    ball(k, g, .38, s.accent, [R - 1.9, .24, F - 1.1], { scale: [1, .62, 1] })
    // ふうせん。
    for (const [x, color] of [[-.2, '#ff6b9a'], [.1, '#ffd166'], [.35, '#4dc9ff']] as const) {
      ball(k, g, .16, color, [R - .5 + x, 1.9 + x * .4, B + .9], { scale: [1, 1.15, 1] })
      tube(k, g, .004, 1.3, '#9e9e9e', [R - .5 + x, .5 + x * .4, B + .9], { noShadow: true })
    }
  }
  if (W >= 5 && D >= 5) sofa(k, g, [R - .7, 0, B + 2.15], -Math.PI / 2, .95, mix(s.main, WHITE, .2), s.accent)
  if (W >= 6.5 || D >= 5) {
    // ひろい へやには ほんだな。
    const shelf = group(g, [R - .2, 0, F - 1])
    block(k, shelf, [.36, 1.6, 1.1], WOOD, [0, 0, 0])
    const books = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa', '#fb8c00']
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) block(k, shelf, [.24, .32 - (i % 3) * .04, .12], books[(i + row) % books.length], [-.21, .12 + row * .5, -.42 + i * .16], { noShadow: true })
    }
  }
  if (W >= 6.5) {
    block(k, g, [.62, .36, .62], mix(s.main, WHITE, .25), [sx - sofaW / 2 - .1, 0, B + 1.6], { round: .08 })
  }
}

function dining(c: Ctx) {
  const { k, g, W, D, s } = c
  const B = -D / 2, R = W / 2
  const pendant = (x: number, z: number, y: number) => {
    tube(k, g, .006, H - y - .25, '#424242', [x, y + .25, z], { noShadow: true })
    g.add(mesh(k, k.cyl(.07, .2, .25, 18, true), k.mat(s.accent, { side: THREE.DoubleSide }), [x, y + .125, z], { noShadow: true }))
    ball(k, g, .06, k.mat('#fff8e1', { emissive: '#ffe082', glow: 1 }), [x, y + .04, z], { noShadow: true })
  }
  if (s.variant === 'cafe') {
    const n = W >= 5 ? 2 : 1
    for (let i = 0; i < n; i++) {
      const x = n === 1 ? 0 : (i ? 1 : -1) * W * .22
      const z = B + D * .55
      roundTable(k, g, [x, 0, z], .42, .74, '#f5f5f5', '#3a3a3a')
      chair(k, g, [x - .62, 0, z], Math.PI / 2, s.main, s.accent)
      chair(k, g, [x + .62, 0, z], -Math.PI / 2, s.main, s.accent)
      tube(k, g, .05, .16, WHITE, [x - .12, .74, z], { noShadow: true })
      ball(k, g, .06, '#8d6e63', [x + .14, .78, z + .05], { noShadow: true })
      pendant(x, z, 1.55)
    }
    // こくばん の メニュー。
    block(k, g, [Math.min(1.4, W - 1), .9, .05], '#2e4a3a', [0, 1.15, B + .03])
    for (let i = 0; i < 3; i++) block(k, g, [.7 - i * .15, .03, .01], '#f5f5f5', [-.1, 1.75 - i * .18, B + .06], { noShadow: true })
    block(k, g, [Math.min(2.4, W - .8), .9, .5], s.main, [0, 0, B + .27], { round: .03 })
    block(k, g, [Math.min(2.5, W - .7), .05, .55], s.accent, [0, .9, B + .27])
    return
  }
  // サイドボード。
  const sbW = Math.min(1.6, W - 1.2)
  block(k, g, [sbW, .8, .42], DARK_WOOD, [0, 0, B + .23], { round: .02 })
  vase(k, g, [-sbW / 3, .8, B + .23], '#ffffff', s.accent)
  ball(k, g, .12, '#fff3e0', [sbW / 4, .9, B + .23], { scale: [1, .45, 1] })
  const tz = (B + .7 + D / 2) / 2 + .1
  if (s.variant === 'round') {
    const r = clamp(Math.min(W, D) * .2, .55, .85)
    roundTable(k, g, [0, 0, tz], r, .74, s.main, '#d7ccc8')
    const n = r > .7 ? 6 : 4
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.PI / n
      chair(k, g, [Math.sin(a) * (r + .32), 0, tz + Math.cos(a) * (r + .32)], a + Math.PI, s.accent, WHITE)
      plate(k, g, [Math.sin(a) * (r - .22), .74, tz + Math.cos(a) * (r - .22)], ['#ff7043', '#66bb6a', '#ffca28'][i % 3])
    }
    vase(k, g, [0, .74, tz], s.accent, '#ffeb3b')
    pendant(0, tz, 1.6)
    return
  }
  const tw = clamp(W * .42, 1.2, 2.4)
  const td = .9
  table(k, g, [0, 0, tz], tw, td, .74, s.main)
  const per = tw >= 1.9 ? 3 : 2
  for (let i = 0; i < per; i++) {
    const x = -tw / 2 + (tw * (i + .5)) / per
    chair(k, g, [x, 0, tz - td / 2 - .3], 0, s.main, s.accent)
    chair(k, g, [x, 0, tz + td / 2 + .3], Math.PI, s.main, s.accent)
    plate(k, g, [x, .74, tz - td / 2 + .2], ['#ff7043', '#66bb6a', '#ffca28'][i % 3])
    plate(k, g, [x, .74, tz + td / 2 - .2], ['#8d6e63', '#ef5350', '#ffee58'][i % 3])
  }
  if (D >= 5) {
    chair(k, g, [-tw / 2 - .3, 0, tz], Math.PI / 2, s.main, s.accent)
    chair(k, g, [tw / 2 + .3, 0, tz], -Math.PI / 2, s.main, s.accent)
  }
  ball(k, g, .16, '#fff3e0', [0, .8, tz], { scale: [1, .4, 1] })
  ;['#ef5350', '#ffca28', '#66bb6a'].forEach((color, i) => ball(k, g, .06, color, [-.06 + i * .06, .86, tz + (i % 2) * .05], { noShadow: true }))
  const lamps = tw > 1.8 ? 3 : 2
  for (let i = 0; i < lamps; i++) pendant(-tw / 2 + (tw * (i + .5)) / lamps, tz, 1.6)
  if (W >= 4.5) plant(k, g, [R - .45, 0, B + .45])
}

function kitchen(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2
  const steel = s.id === 'steel'
  const island = s.variant === 'island'
  const cafe = s.id === 'cafe'
  const fw = .76
  const metal = k.mat('#cfd8dc', { metal: .65, rough: .3 })
  const fridge = group(g, [R - .1 - fw / 2, 0, B + .37])
  block(k, fridge, [fw, 1.85, .7], steel ? metal : '#f4f6f8', [0, 0, 0], { round: .04 })
  block(k, fridge, [fw - .04, .01, .01], '#90a4ae', [0, 1.2, .355], { noShadow: true })
  for (const y of [.5, 1.35]) block(k, fridge, [.04, .3, .04], '#90a4ae', [-fw / 2 + .1, y, .37], { noShadow: true })
  ball(k, fridge, .04, '#ef5350', [.15, 1.5, .355], { scale: [1, 1, .4], noShadow: true })
  ball(k, fridge, .04, '#42a5f5', [.05, 1.62, .355], { scale: [1, 1, .4], noShadow: true })

  const len = W - fw - .3
  const cx = L + .1 + len / 2
  const top = steel ? metal : cafe ? '#c98b54' : '#f5efe6'
  block(k, g, [len, .82, .62], steel ? metal : s.main, [cx, 0, B + .33])
  block(k, g, [len + .02, .06, .66], top, [cx, .82, B + .35])
  const doors = Math.max(2, Math.round(len / .6))
  for (let i = 1; i < doors; i++) block(k, g, [.012, .68, .01], mix(s.main, '#000000', .3), [L + .1 + (len * i) / doors, .07, B + .645], { noShadow: true })
  for (let i = 0; i < doors; i++) block(k, g, [.14, .025, .03], s.accent, [L + .1 + (len * (i + .5)) / doors, .7, B + .66], { noShadow: true })
  // ながし。
  const sinkX = cx - len * .25
  block(k, g, [.55, .02, .4], '#90a4ae', [sinkX, .881, B + .36], { noShadow: true })
  tube(k, g, .02, .28, metal, [sinkX, .88, B + .12], { noShadow: true })
  block(k, g, [.03, .03, .2], metal, [sinkX, 1.14, B + .2], { noShadow: true })
  // コンロ と おなべ。
  const stoveX = cx + len * .22
  block(k, g, [.62, .02, .5], '#222222', [stoveX, .881, B + .36], { noShadow: true })
  for (const dx of [-.15, .15]) g.add(mesh(k, k.torus(.08, .015, Math.PI * 2, 16), '#555555', [stoveX + dx, .91, B + .36], { rot: [Math.PI / 2, 0, 0], noShadow: true }))
  tube(k, g, .14, .16, s.accent, [stoveX - .15, .9, B + .36])
  tube(k, g, .145, .02, mix(s.accent, '#000000', .2), [stoveX - .15, 1.06, B + .36], { noShadow: true })
  ball(k, g, .025, '#37474f', [stoveX - .15, 1.09, B + .36], { noShadow: true })
  block(k, g, [.68, .3, .5], metal, [stoveX, 1.62, B + .26])
  block(k, g, [.26, H - 1.92, .26], metal, [stoveX, 1.92, B + .14])
  // まな板 と やさい。
  block(k, g, [.36, .025, .24], '#e0c090', [cx - len * .02, .88, B + .38], { noShadow: true })
  ball(k, g, .05, '#e53935', [cx - len * .02 - .08, .93, B + .38], { noShadow: true })
  g.add(mesh(k, k.cyl(0, .03, .2, 10), '#fb8c00', [cx - len * .02 + .08, .92, B + .4], { rot: [0, 0, Math.PI / 2], noShadow: true }))
  // うえの たな。
  const leftEnd = stoveX - .4
  if (cafe) {
    for (const y of [1.45, 1.85]) {
      block(k, g, [leftEnd - L - .2, .04, .3], '#8d5a3b', [(L + .1 + leftEnd) / 2, y, B + .16])
      for (let i = 0; i < Math.floor((leftEnd - L - .3) / .2); i++) {
        tube(k, g, .055, .16, ['#ffcc80', '#a5d6a7', '#ef9a9a', '#90caf9'][i % 4], [L + .25 + i * .2, y + .04, B + .16], { noShadow: true })
      }
    }
  } else if (leftEnd - L > .7) {
    block(k, g, [leftEnd - L - .15, .62, .34], steel ? metal : s.main, [(L + .1 + leftEnd) / 2, 1.5, B + .19])
  }
  if (s.id === 'retro') {
    g.add(mesh(k, k.cyl(.22, .22, .05, 24), WHITE, [cx - len * .3, 1.95, B + .04], { rot: [Math.PI / 2, 0, 0] }))
    g.add(mesh(k, k.torus(.22, .03, Math.PI * 2, 24), s.accent, [cx - len * .3, 1.95, B + .07], { noShadow: true }))
  }
  if (island) {
    const iw = Math.min(W * .45, 2.2)
    const iz = B + 2.2
    block(k, g, [iw, .86, .9], WHITE, [0, 0, iz], { round: .03 })
    block(k, g, [iw + .1, .05, 1], '#e8e0d4', [0, .86, iz])
    const n = iw > 1.6 ? 3 : 2
    for (let i = 0; i < n; i++) {
      const x = -iw / 2 + (iw * (i + .5)) / n
      tube(k, g, .03, .62, '#424242', [x, 0, iz + .75], { noShadow: true })
      tube(k, g, .18, .06, s.accent, [x, .62, iz + .75])
    }
    ball(k, g, .13, '#fff3e0', [0, .95, iz], { scale: [1, .4, 1] })
  } else {
    rug(k, g, [cx, 0, B + 1.05], Math.min(len, 1.8), .55, mix(s.accent, WHITE, .4))
  }
}

function bath(c: Ctx) {
  const { k, g, W, D, s, ticks } = c
  const L = -W / 2, R = W / 2, B = -D / 2
  const water = k.mat('#6ec6ea', { opacity: .82, rough: .1, emissive: '#2f8fb8', glow: .25 })
  const duck = (at: V3) => {
    const d = group(g, at)
    d.scale.setScalar(1.6)
    ball(k, d, .09, '#ffd54f', [0, 0, 0], { scale: [1.25, .85, 1] })
    ball(k, d, .06, '#ffd54f', [.07, .09, 0])
    d.add(mesh(k, k.cyl(0, .028, .07, 8), '#ff8f00', [.14, .085, 0], { rot: [0, 0, -Math.PI / 2], noShadow: true }))
    ball(k, d, .01, '#212121', [.11, .12, .035], { noShadow: true })
    ticks.push((time) => {
      d.position.y = at[1] + Math.sin(time / 500) * .02
      d.rotation.y = Math.sin(time / 1300) * .5
    })
  }
  if (s.variant === 'onsen') {
    const r = clamp(Math.min(W, D) * .27, .65, 1.35)
    const cz = B + r + .55
    const cx = R - r - .55
    tube(k, g, r, .06, water, [cx, .02, cz], { seg: 32, noShadow: true })
    const rocks = Math.round(r * 11)
    for (let i = 0; i < rocks; i++) {
      const a = (i / rocks) * Math.PI * 2
      const rr = .18 + ((i * 7) % 5) * .03
      g.add(mesh(k, k.rock(rr), ['#8d8579', '#a1998c', '#776f64'][i % 3], [cx + Math.cos(a) * (r + .05), rr * .72, cz + Math.sin(a) * (r + .05)], { rot: [0, i * 2, 0], scale: [1, .7, 1] }))
    }
    const steam: THREE.Mesh[] = []
    for (let i = 0; i < 4; i++) {
      const m = mesh(k, k.sphere(.22, 12), k.mat('#ffffff', { opacity: .35 }), [cx, .4, cz], { noShadow: true })
      g.add(m)
      steam.push(m)
    }
    ticks.push((time) => steam.forEach((m, i) => {
      const t = ((time / 2600 + i / 4) % 1)
      m.position.set(cx + Math.sin(i * 2.1) * r * .5, .25 + t * 1.4, cz + Math.cos(i * 1.7) * r * .4)
      m.scale.setScalar(.6 + t)
      ;(m.material as THREE.MeshStandardMaterial).opacity = .35
    }))
    duck([cx - r * .3, .12, cz + r * .2])
    // いしの とうろう。
    const tor = group(g, [L + .4, 0, B + .4])
    block(k, tor, [.3, .1, .3], '#9e9e9e', [0, 0, 0])
    tube(k, tor, .06, .5, '#9e9e9e', [0, .1, 0])
    block(k, tor, [.28, .22, .28], k.mat('#fff3c4', { emissive: '#ffd66b', glow: .7 }), [0, .6, 0])
    tor.add(mesh(k, k.cyl(.02, .26, .16, 4), '#8d8d8d', [0, .9, 0], { rot: [0, Math.PI / 4, 0] }))
    tube(k, g, .14, .14, '#c49a6c', [L + .45, 0, B + 1.2], { top: .16 })
    return
  }
  const tw = clamp(W * .55, 1.4, 2.4)
  const td = clamp(D * .42, .85, 1.5)
  const tx = R - tw / 2 - .12
  const tz = B + td / 2 + .1
  const hinoki = s.variant === 'hinoki'
  const tub = hinoki ? '#e1b97a' : WHITE
  const rim = .1
  block(k, g, [tw, .12, td], tub, [tx, 0, tz])
  for (const side of [-1, 1]) {
    block(k, g, [tw, .6, rim], tub, [tx, 0, tz + side * (td / 2 - rim / 2)], { round: hinoki ? 0 : .04 })
    block(k, g, [rim, .6, td - rim * 2], tub, [tx + side * (tw / 2 - rim / 2), 0, tz], { round: hinoki ? 0 : .04 })
  }
  if (hinoki) for (let i = 1; i < Math.floor(tw / .2); i++) block(k, g, [.014, .6, .01], '#b08850', [tx - tw / 2 + i * .2, 0, tz + td / 2 + .003], { noShadow: true })
  block(k, g, [tw - rim * 2, .36, td - rim * 2], water, [tx, .12, tz], { noShadow: true })
  rug(k, g, [tx, 0, tz + td / 2 + .4], Math.min(tw, .9), .5, mix(s.accent, WHITE, .3))
  if (s.variant === 'bubble') {
    const bubbles: THREE.Mesh[] = []
    for (let i = 0; i < 16; i++) {
      const m = mesh(k, k.sphere(.07 + (i % 4) * .025, 12), i % 3 ? '#ffffff' : '#d1c4e9', [tx - tw / 2 + .22 + ((i * .37) % 1) * (tw - .44), .5, tz - td / 2 + .22 + ((i * .61) % 1) * (td - .44)], { noShadow: true })
      g.add(m)
      bubbles.push(m)
    }
    ticks.push((time) => bubbles.forEach((m, i) => { m.position.y = .5 + Math.sin(time / 420 + i) * .025 }))
  } else {
    duck([tx, .52, tz])
  }
  // シャワー と かがみ。
  const sz = clamp(B + 1.2, B + .6, D / 2 - .6)
  tube(k, g, .02, 1.5, k.mat('#cfd8dc', { metal: .7, rough: .25 }), [L + .07, .4, sz], { noShadow: true })
  g.add(mesh(k, k.cyl(.08, .05, .05, 16), k.mat('#cfd8dc', { metal: .7, rough: .25 }), [L + .14, 1.88, sz], { rot: [0, 0, Math.PI / 2.4], noShadow: true }))
  block(k, g, [.03, .7, .55], k.mat('#e3f4fb', { rough: .2, emissive: '#9fc8da', glow: .45 }), [L + .02, 1.05, sz + .55])
  tube(k, g, .16, .28, s.accent, [L + .6, 0, sz + .4])
  tube(k, g, .13, .14, '#ffd54f', [L + .55, 0, sz - .2], { top: .15 })
  // シャンプーの たな。
  block(k, g, [.14, .03, .5], WHITE, [L + .07, .95, sz - .45], { noShadow: true })
  ;['#ff8fab', '#64b5f6', '#81c784'].forEach((color, i) => tube(k, g, .04, .18 - i * .02, color, [L + .08, .98, sz - .62 + i * .17], { noShadow: true }))
}

function toilet(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2
  const tx = W >= 3.4 ? L + .8 : 0
  const gold = s.id === 'hotel'
  const trim = gold ? k.mat('#d4af37', { metal: .7, rough: .3 }) : k.mat('#cfd8dc', { metal: .5, rough: .35 })
  block(k, g, [.44, .42, .2], WHITE, [tx, .42, B + .12], { round: .05 })
  g.add(mesh(k, k.cyl(.2, .17, .38, 20), WHITE, [tx, .19, B + .46], { scale: [1, 1, 1.25] }))
  g.add(mesh(k, k.torus(.17, .04, Math.PI * 2, 20), gold ? '#f5f5f5' : mix(s.accent, WHITE, .5), [tx, .4, B + .47], { rot: [Math.PI / 2, 0, 0], scale: [1, 1.25, 1] }))
  block(k, g, [.38, .48, .035], gold ? '#f5f5f5' : mix(s.accent, WHITE, .5), [tx, .42, B + .25], { round: .015, rot: [-.12, 0, 0] })
  block(k, g, [.06, .03, .08], trim, [tx + .12, .8, B + .23], { noShadow: true })
  // かみ。
  const px = L + .06
  block(k, g, [.06, .04, .18], trim, [px, .72, B + .7], { noShadow: true })
  tube(k, g, .06, .12, WHITE, [px + .06, .66, B + .7], { rot: [Math.PI / 2, 0, 0], noShadow: true })
  rug(k, g, [tx, 0, B + 1], .6, .45, mix(s.accent, WHITE, .3))
  if (s.variant === 'flower') vase(k, g, [tx + .12, .84, B + .1], '#ffffff', s.accent)
  if (s.variant === 'plant') plant(k, g, [R - .3, 0, B + .3], .8)
  if (gold) {
    block(k, g, [.5, .62, .03], k.mat('#e3f4fb', { rough: .2, emissive: '#9fc8da', glow: .45 }), [tx, 1.2, B + .02])
    for (const y of [1.18, 1.82]) block(k, g, [.56, .03, .04], trim, [tx, y, B + .03], { noShadow: true })
    lamp(k, g, [R - .3, 0, B + .3], '#fff8e1')
  }
  if (s.id === 'simple') {
    g.add(mesh(k, k.torus(.09, .012, Math.PI * 2, 16), trim, [L + .03, 1.05, B + 1], { rot: [0, Math.PI / 2, 0], noShadow: true }))
    block(k, g, [.03, .3, .16], s.accent, [L + .04, .72, B + 1], { noShadow: true })
  }
  if (W >= 3.4) {
    block(k, g, [.9, .78, .45], WOOD, [R - .7, 0, B + .25])
    tube(k, g, .16, .08, WHITE, [R - .7, .78, B + .25])
    block(k, g, [.6, .5, .03], k.mat('#e3f4fb', { rough: .2, emissive: '#9fc8da', glow: .45 }), [R - .7, 1.15, B + .02])
  }
}

function washroom(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2
  const wood = s.id === 'wood'
  const vw = W >= 5 ? 1.8 : .9
  const vx = L + .1 + vw / 2
  block(k, g, [vw, .8, .5], wood ? s.main : WHITE, [vx, 0, B + .27], { round: .03 })
  block(k, g, [vw + .04, .05, .54], wood ? '#e6cfa7' : '#eeeeee', [vx, .8, B + .28])
  const basins = vw > 1.5 ? 2 : 1
  const metal = k.mat('#cfd8dc', { metal: .65, rough: .3 })
  for (let i = 0; i < basins; i++) {
    const x = vx - vw / 2 + (vw * (i + .5)) / basins
    tube(k, g, .19, .07, WHITE, [x, .85, B + .3], { seg: 24 })
    tube(k, g, .02, .2, metal, [x, .85, B + .08], { noShadow: true })
    block(k, g, [.03, .03, .14], metal, [x, 1.03, B + .14], { noShadow: true })
  }
  block(k, g, [vw, .75, .03], k.mat('#e3f4fb', { rough: .2, emissive: '#9fc8da', glow: .45 }), [vx, 1.15, B + .02])
  block(k, g, [vw + .08, .06, .05], s.accent, [vx, 1.9, B + .03], { noShadow: true })
  tube(k, g, .05, .14, s.accent, [vx + vw / 2 - .12, .85, B + .4], { noShadow: true })
  // せんたくき。
  const wm = group(g, [R - .42, 0, B + .35])
  block(k, wm, [.62, .86, .62], WHITE, [0, 0, 0], { round: .05 })
  wm.add(mesh(k, k.torus(.19, .03, Math.PI * 2, 24), '#b0bec5', [0, .42, .31], { noShadow: true }))
  wm.add(mesh(k, k.circle(.17, 24), k.mat('#4f7fa8', { rough: .15, metal: .2 }), [0, .42, .312], { noShadow: true }))
  block(k, wm, [.5, .1, .02], '#cfd8dc', [0, .72, .31], { noShadow: true })
  ball(k, wm, .03, s.accent, [.18, .77, .32], { noShadow: true })
  // タオル。
  const tz = clamp(B + 1.3, B + .9, D / 2 - .5)
  tube(k, g, .015, .55, metal, [L + .06, 1.2, tz], { rot: [Math.PI / 2, 0, 0], noShadow: true })
  if (s.variant === 'marine') {
    ;[s.accent, WHITE, s.accent, WHITE, s.accent].forEach((color, i) => block(k, g, [.04, .1, .45], color, [L + .07, .7 + i * .1, tz], { noShadow: true }))
    g.add(mesh(k, k.torus(.2, .06, Math.PI * 2, 24), '#e53935', [L + .05, 1.75, tz], { rot: [0, Math.PI / 2, 0] }))
    for (let i = 0; i < 4; i++) g.add(mesh(k, k.torus(.2, .062, Math.PI / 6, 6), WHITE, [L + .05, 1.75, tz], { rot: [i * Math.PI / 2, Math.PI / 2, 0], noShadow: true }))
  } else {
    block(k, g, [.04, .5, .45], s.accent, [L + .07, .7, tz], { noShadow: true })
  }
  tube(k, g, .2, .42, '#d7b98e', [R - .4, 0, clamp(B + 1.3, B + 1.1, D / 2 - .4)], { top: .23 })
  ball(k, g, .12, '#90caf9', [R - .42, .45, clamp(B + 1.3, B + 1.1, D / 2 - .4)], { noShadow: true })
  if (wood) plant(k, g, [vx - vw / 2 + .12, .85, B + .4], .35, '#ffffff')
}

/** ベッド。あたまが かべ（-z）。 */
function bed(k: Kit, parent: THREE.Object3D, at: V3, w: number, len: number, frame: string, cover: string, pillow = WHITE) {
  const p = group(parent, at)
  block(k, p, [w + .1, .3, len], frame, [0, 0, len / 2], { round: .03 })
  block(k, p, [w + .1, .95, .08], frame, [0, 0, .04], { round: .03 })
  block(k, p, [w, .18, len - .12], WHITE, [0, .3, len / 2 + .03], { round: .05 })
  block(k, p, [w + .05, .1, len * .64], cover, [0, .4, len * .66], { round: .05 })
  block(k, p, [w + .05, .03, .12], mix(cover, WHITE, .4), [0, .48, len * .34 + .05], { noShadow: true })
  const n = w > 1.3 ? 2 : 1
  for (let i = 0; i < n; i++) block(k, p, [Math.min(.55, w - .1), .13, .34], pillow, [n === 1 ? 0 : (i ? 1 : -1) * w / 4, .47, .28], { round: .06 })
  return p
}

function bedroom(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2, F = D / 2
  const len = Math.min(2.1, D - .9)
  const twin = s.variant === 'twin' && W >= 4.8
  const frame = s.id === 'hotel' ? '#3e2723' : s.id === 'starry' ? '#455a9a' : s.id === 'princess' ? WHITE : '#d7b98e'
  const cover = s.id === 'starry' ? '#3949ab' : s.id === 'hotel' ? WHITE : s.accent
  const pillow = s.id === 'starry' ? '#ffd54f' : WHITE
  const stand = (x: number) => {
    block(k, g, [.45, .5, .4], frame === WHITE ? '#f3e5f5' : frame, [x, 0, B + .24], { round: .03 })
    lamp(k, g, [x, .5, B + .24])
  }
  if (twin) {
    for (const x of [-.85, .85]) bed(k, g, [x, 0, B + .02], 1, len, frame, cover, pillow)
    block(k, g, [2.2, .03, .2], s.accent, [0, .5, B + len * .7], { noShadow: true })
    stand(0)
  } else {
    const bw = W >= 3.6 ? 1.6 : 1.2
    bed(k, g, [0, 0, B + .02], bw, len, frame, cover, pillow)
    if (s.id === 'hotel') block(k, g, [bw + .07, .03, .35], s.accent, [0, .5, B + len * .75], { noShadow: true })
    if (W >= bw + 1.3) {
      stand(-bw / 2 - .4)
      stand(bw / 2 + .4)
    }
    if (s.variant === 'canopy') {
      const ch = 2.15
      const pts = [[-bw / 2 - .02, B + .06], [bw / 2 + .02, B + .06], [-bw / 2 - .02, B + len], [bw / 2 + .02, B + len]] as const
      for (const [x, z] of pts) tube(k, g, .03, ch, WHITE, [x, 0, z], { noShadow: true })
      block(k, g, [bw + .1, .05, .05], WHITE, [0, ch, B + .06], { noShadow: true })
      block(k, g, [bw + .1, .05, .05], WHITE, [0, ch, B + len], { noShadow: true })
      const drape = k.mat(s.accent, { opacity: .38, side: THREE.DoubleSide })
      for (const x of [-bw / 2 - .02, bw / 2 + .02]) g.add(mesh(k, k.plane(len - .1, 1.4), drape, [x, ch - .7, B + len / 2 + .03], { rot: [0, Math.PI / 2, 0], noShadow: true }))
      g.add(mesh(k, k.plane(bw + .04, len), drape, [0, ch, B + len / 2 + .03], { rot: [-Math.PI / 2, 0, 0], noShadow: true }))
      ball(k, g, .1, s.accent, [R - .4, 1.6, B + .03], { scale: [1, 1, .3] })
    }
  }
  if (s.variant === 'stars') starryWalls(c, 14)
  const rz = B + len + .55
  if (rz + .5 < F) rug(k, g, [0, 0, rz], Math.min(W - 1, 2.2), .9, mix(s.accent, WHITE, .5), true)
  if (D >= 4.8 || W >= 5) {
    const wd = group(g, [L + .33, 0, F - 1], Math.PI / 2)
    block(k, wd, [1.2, 2, .6], frame === WHITE ? '#f8bbd0' : frame, [0, 0, 0], { round: .02 })
    block(k, wd, [.01, 1.9, .01], '#5d4037', [0, .05, .305], { noShadow: true })
    for (const x of [-.08, .08]) block(k, wd, [.03, .25, .03], '#d4af37', [x, 1, .32], { noShadow: true })
  }
}

function kids(c: Ctx) {
  const { k, g, W, D, s, ticks } = c
  const L = -W / 2, R = W / 2, B = -D / 2, F = D / 2
  const theme = s.variant
  bed(k, g, [L + .6, 0, B + .02], .95, Math.min(1.9, D - .8), WHITE, s.accent)
  // つくえ と いす。
  const dx = R - .7
  table(k, g, [dx, 0, B + .33], 1, .55, .72, '#f0d6aa', '#d7b98e')
  chair(k, g, [dx, 0, B + .85], Math.PI, s.accent, WHITE)
  lamp(k, g, [dx + .3, .72, B + .2])
  ;['#e53935', '#1e88e5', '#fdd835'].forEach((color, i) => block(k, g, [.22, .04, .3], color, [dx - .25, .72 + i * .04, B + .3], { noShadow: true }))
  const cz = clamp(B + D * .62, B + 1.6, F - .6)
  rug(k, g, [.1, 0, cz], Math.min(W - 1.2, 2), Math.min(D - 2, 1.6), mix(s.accent, WHITE, .55), true)
  ;['#e53935', '#1e88e5', '#fdd835', '#43a047'].forEach((color, i) => {
    block(k, g, [.18, .18, .18], color, [L + .7 + (i % 2) * .22, (i > 1 ? .18 : 0), cz + .45 + (i % 2) * .05], { rot: [0, i * .4, 0] })
  })
  // くまの ぬいぐるみ と ボール。
  const bear = group(g, [L + .85, .5, B + .62], .5)
  ball(k, bear, .13, '#b07d48', [0, .12, 0], { scale: [1, 1.1, .9] })
  ball(k, bear, .1, '#b07d48', [0, .32, 0])
  for (const x of [-.07, .07]) ball(k, bear, .04, '#8d5a3b', [x, .41, 0])
  ball(k, bear, .045, '#e6c9a8', [0, .3, .08], { scale: [1, .8, .7] })
  ball(k, bear, .015, '#212121', [0, .32, .12], { noShadow: true })
  for (const x of [-.04, .04]) ball(k, bear, .013, '#212121', [x, .36, .085], { noShadow: true })
  ball(k, g, .18, '#ef5350', [R - 1.1, .21, F - .55])
  g.add(mesh(k, k.torus(.18, .025, Math.PI * 2, 24), WHITE, [R - 1.1, .21, F - .55], { rot: [0, .6, 0], noShadow: true }))
  // かべの うえの ほうに さんかくの フラッグ。
  const flags = Math.max(5, Math.round(W / .45))
  for (let i = 0; i < flags; i++) {
    g.add(mesh(k, k.circle(.1, 3), [s.accent, '#ffd166', '#4dc9ff', '#06d6a0'][i % 4], [-W / 2 + .25 + (i * (W - .5)) / (flags - 1), 2.2, B + .02], { rot: [0, 0, -Math.PI / 2], noShadow: true }))
  }
  block(k, g, [W - .4, .01, .01], '#8d6e63', [0, 2.27, B + .02], { noShadow: true })
  if (D >= 5) {
    const shelf = group(g, [R - .2, 0, B + 1.6])
    block(k, shelf, [.36, 1.2, 1], WHITE, [0, 0, 0])
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 5; i++) block(k, shelf, [.24, .3 - (i % 3) * .04, .14], ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'][(i + row) % 5], [-.21, .1 + row * .55, -.36 + i * .18], { noShadow: true })
    }
  }
  block(k, g, [.7, .42, .45], s.accent, [R - .45, 0, F - .5], { round: .04 })
  block(k, g, [.74, .05, .49], mix(s.accent, WHITE, .3), [R - .45, .42, F - .5], { round: .02 })
  const tx = R - 1.1
  if (theme === 'space') {
    starryWalls(c, 10)
    const r = group(g, [tx, 0, cz])
    tube(k, r, .15, .7, WHITE, [0, .12, 0])
    r.add(mesh(k, k.cyl(0, .15, .3, 18), '#e53935', [0, .97, 0]))
    for (let i = 0; i < 3; i++) block(k, r, [.04, .26, .2], '#e53935', [Math.sin((i * Math.PI * 2) / 3) * .15, 0, Math.cos((i * Math.PI * 2) / 3) * .15], { rot: [0, (i * Math.PI * 2) / 3, 0] })
    r.add(mesh(k, k.circle(.06, 16), '#4fc3f7', [0, .65, .151], { noShadow: true }))
    const planets: THREE.Group[] = []
    for (const [x, z, color, size] of [[-.4, .4, '#ff9f1c', .18], [.6, -.3, '#4fc3f7', .13]] as const) {
      const p = group(g, [x, 1.7, z])
      tube(k, g, .004, H - 1.7, '#9e9e9e', [x, 1.7 + size, z], { noShadow: true })
      ball(k, p, size, color, [0, 0, 0])
      p.add(mesh(k, k.torus(size * 1.6, .015, Math.PI * 2, 24), '#ffe0b2', [0, 0, 0], { rot: [1.2, 0, 0], noShadow: true }))
      planets.push(p)
    }
    ticks.push((time) => planets.forEach((p, i) => { p.rotation.y = time / (1400 + i * 500) }))
  } else if (theme === 'flower') {
    const flowers = [[L + .3, B + 2.2], [R - .3, B + 1.4], [R - .3, F - 1.3]] as const
    flowers.forEach(([x, z], i) => {
      if (z > F - .3) return
      const h = .8 + i * .15
      tube(k, g, .025, h, '#43a047', [x, 0, z], { noShadow: true })
      ball(k, g, .1, '#ffeb3b', [x, h + .05, z], { noShadow: true })
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2
        ball(k, g, .09, i % 2 ? s.accent : '#ffb3c6', [x + Math.cos(a) * .14, h + .05 + Math.sin(a) * .14, z], { scale: [1, 1, .4], noShadow: true })
      }
      ball(k, g, .1, '#66bb6a', [x + .08, h * .45, z], { scale: [1.4, .3, .7], noShadow: true })
    })
  } else if (theme === 'dino') {
    const d = group(g, [tx, 0, cz], -.6)
    const green = s.accent
    ball(k, d, .3, green, [0, .55, 0], { scale: [1.35, 1, .9] })
    d.add(mesh(k, k.cyl(.1, .16, .4, 14), green, [.32, .82, 0], { rot: [0, 0, -.6] }))
    ball(k, d, .17, green, [.5, 1.05, 0], { scale: [1.3, 1, 1] })
    d.add(mesh(k, k.cyl(.02, .16, .6, 12), green, [-.5, .45, 0], { rot: [0, 0, 1.2] }))
    for (const [x, z] of [[.18, .14], [.18, -.14], [-.18, .14], [-.18, -.14]] as const) tube(k, d, .07, .32, green, [x, 0, z], { noShadow: true })
    for (let i = 0; i < 4; i++) d.add(mesh(k, k.cyl(0, .06, .14, 8), '#ff9f1c', [-.25 + i * .15, .86 - Math.abs(i - 1.5) * .02, 0], { noShadow: true }))
    for (const z of [.08, -.08]) ball(k, d, .025, '#212121', [.6, 1.1, z], { noShadow: true })
  } else if (theme === 'train') {
    const rx = Math.min(W * .25, .9)
    const rz = .45
    const track = group(g, [.1, .021, cz])
    for (const r of [-.06, .06]) track.add(mesh(k, k.torus(1, .012, Math.PI * 2, 48), '#8d6e63', [0, 0, 0], { rot: [Math.PI / 2, 0, 0], scale: [rx + r, rz + r, 1], noShadow: true }))
    const cars: THREE.Group[] = []
    ;[s.accent, '#1e88e5', '#fdd835'].forEach((color, i) => {
      const car = group(track, [0, 0, 0])
      block(k, car, [.16, .12, .1], color, [0, .02, 0], { round: .02 })
      if (i === 0) {
        tube(k, car, .035, .07, '#37474f', [.05, .14, 0], { noShadow: true })
        block(k, car, [.07, .08, .1], '#37474f', [-.05, .14, 0], { noShadow: true })
      }
      for (const x of [-.05, .05]) for (const z of [-.055, .055]) car.add(mesh(k, k.cyl(.025, .025, .01, 10), '#212121', [x, .025, z], { rot: [Math.PI / 2, 0, 0], noShadow: true }))
      cars.push(car)
    })
    ticks.push((time) => cars.forEach((car, i) => {
      const a = time / 1600 - i * .38
      car.position.set(Math.cos(a) * rx, 0, Math.sin(a) * rz)
      car.rotation.y = -Math.atan2(Math.cos(a) * rz, -Math.sin(a) * rx)
    }))
  }
}

function washitsu(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2
  const v = s.variant
  // あんどん。
  const an = group(g, [L + .35, 0, B + .35])
  for (const x of [-.12, .12]) for (const z of [-.12, .12]) block(k, an, [.03, .75, .03], DARK_WOOD, [x, 0, z], { noShadow: true })
  block(k, an, [.22, .4, .22], k.mat('#fff8e1', { emissive: '#ffe0a0', glow: .8 }), [0, .3, 0], { noShadow: true })
  const zabuton = (x: number, z: number, color: string) => block(k, g, [.55, .08, .55], color, [x, 0, z], { round: .035 })
  const cx = (v === 'tokonoma' ? -.2 : .1)
  const cz = B + D * .55
  if (v === 'kotatsu') {
    block(k, g, [1.5, .38, 1.5], s.main, [cx, 0, cz], { round: .1 })
    block(k, g, [1.05, .05, 1.05], WOOD, [cx, .38, cz], { round: .01 })
    tube(k, g, .16, .06, '#d7b98e', [cx, .43, cz], { seg: 18 })
    for (let i = 0; i < 4; i++) ball(k, g, .055, '#ff9800', [cx + Math.cos(i * 1.6) * .08, .53 + (i === 3 ? .07 : 0), cz + Math.sin(i * 1.6) * .08])
    zabuton(cx, cz + 1.05, s.accent)
    zabuton(cx - 1.05, cz, s.accent)
    tube(k, g, .045, .1, '#4e342e', [cx + .25, .43, cz - .2], { noShadow: true })
  } else if (v === 'tea') {
    block(k, g, [.5, .03, .5], '#4e4038', [cx, 0, cz], { noShadow: true })
    block(k, g, [.38, .031, .38], '#bdbdbd', [cx, 0, cz], { noShadow: true })
    ball(k, g, .19, '#3e3a39', [cx, .2, cz], { scale: [1, .85, 1] })
    tube(k, g, .08, .05, '#3e3a39', [cx, .34, cz], { noShadow: true })
    tube(k, g, .07, .08, '#2e7d32', [cx + .5, 0, cz + .3], { top: .08 })
    zabuton(cx + .5, cz + .85, s.accent)
    zabuton(cx - .7, cz + .2, s.accent)
    vase(k, g, [R - .4, 0, B + .35], '#8d6e63', '#ffffff')
  } else {
    // ちゃぶだい。
    const ch = group(g, [cx, 0, cz])
    tube(k, ch, .48, .05, s.main, [0, .3, 0], { seg: 28 })
    for (let i = 0; i < 4; i++) block(k, ch, [.05, .3, .05], s.main, [Math.cos(i * Math.PI / 2 + .8) * .3, 0, Math.sin(i * Math.PI / 2 + .8) * .3], { noShadow: true })
    tube(k, ch, .045, .08, '#e0e0e0', [-.12, .35, .05], { noShadow: true })
    tube(k, ch, .045, .08, '#e0e0e0', [.14, .35, -.08], { noShadow: true })
    zabuton(cx, cz + .8, s.accent)
    zabuton(cx, cz - .8, s.accent)
  }
  if (v === 'tokonoma') {
    const tx = R - .8
    block(k, g, [1.3, .14, .6], '#8d5a3b', [tx, 0, B + .31])
    block(k, g, [.5, 1.15, .02], '#f5f0e1', [tx, .75, B + .02])
    block(k, g, [.56, .04, .03], DARK_WOOD, [tx, 1.9, B + .03], { noShadow: true })
    g.add(mesh(k, k.circle(.12, 20), s.accent, [tx, 1.48, B + .032], { noShadow: true }))
    block(k, g, [.02, .4, .01], '#212121', [tx, .9, B + .032], { noShadow: true })
    const vz = B + .35
    tube(k, g, .09, .3, '#5d6d7e', [tx + .35, .14, vz], { top: .06 })
    for (const [dx, dy] of [[-.12, .7], [.05, .82], [.15, .66]] as const) {
      tube(k, g, .008, dy - .3, '#5d4037', [tx + .35 + dx * .5, .44, vz], { rot: [0, 0, -dx * 1.2], noShadow: true })
      ball(k, g, .06, '#f8bbd0', [tx + .35 + dx, dy + .14, vz], { noShadow: true })
    }
  }
}

function entrance(c: Ctx) {
  const { k, g, W, D, s } = c
  const L = -W / 2, R = W / 2, B = -D / 2, F = D / 2
  const rd = D * .45
  block(k, g, [W, .18, rd], '#e3c194', [0, 0, B + rd / 2])
  block(k, g, [W, .2, .09], '#8d5a3b', [0, 0, B + rd])
  rug(k, g, [0, .18, B + rd * .5], Math.min(W - .4, 1.2), Math.min(rd - .2, .55), s.accent)
  const tataki = D - rd
  const gd = Math.min(tataki - .2, 1.2)
  block(k, g, [.4, .95, gd], s.main, [L + .22, 0, B + rd + .1 + gd / 2], { round: .02 })
  vase(k, g, [L + .22, .95, B + rd + .1 + gd / 2], '#ffffff', s.accent)
  for (const [x, color] of [[0, '#e53935'], [.3, '#1e88e5']] as const) {
    for (const dz of [-.07, .07]) block(k, g, [.11, .08, .26], color, [L + .7 + x + dz, 0, F - .45], { round: .03, rot: [0, .1, 0] })
  }
  tube(k, g, .12, .45, '#8d6e63', [R - .25, 0, F - .3])
  for (const [dx, color] of [[-.04, '#ff6b9a'], [.04, '#4dc9ff']] as const) {
    tube(k, g, .01, .55, '#424242', [R - .25 + dx, .3, F - .3], { noShadow: true })
    g.add(mesh(k, k.cyl(.02, .07, .4, 10), color, [R - .25 + dx, .52, F - .3], { noShadow: true }))
  }
}

function stairs(c: Ctx) {
  const { k, g, W, D, s } = c
  const tread = mix(s.main, WHITE, .2)
  if (s.variant === 'spiral') {
    // おうぎがたの だんを まわりながら つみあげる。
    const r = Math.min(W, D) / 2 - .12
    tube(k, g, .08, H + .1, s.accent, [0, 0, 0])
    const n = 14
    const step = (Math.PI * 1.7) / n
    const tops: THREE.Vector3[] = []
    for (let i = 0; i < n; i++) {
      const a = i * step
      const y = ((i + 1) * H) / n - .06
      g.add(mesh(k, k.cyl(r, r, .06, 6, false, step * 1.04), tread, [0, y + .03, 0], { rot: [0, a, 0] }))
      const mid = a + step / 2
      const post = new THREE.Vector3(Math.sin(mid) * (r - .06), y + .06, Math.cos(mid) * (r - .06))
      tube(k, g, .015, .85, s.accent, [post.x, post.y, post.z], { noShadow: true })
      tops.push(post.setY(post.y + .87))
    }
    for (let i = 1; i < tops.length; i++) {
      const from = tops[i - 1]
      const dir = tops[i].clone().sub(from)
      const rail = mesh(k, k.box(.04, .04, dir.length()), s.accent, [(from.x + tops[i].x) / 2, (from.y + tops[i].y) / 2, (from.z + tops[i].z) / 2], { noShadow: true })
      rail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.normalize())
      g.add(rail)
    }
    return
  }
  const alongZ = D >= W
  const run = Math.min((alongZ ? D : W) - .3, 3.4)
  const width = Math.min((alongZ ? W : D) - .3, 1.4)
  const st = group(g, [0, 0, 0], alongZ ? 0 : Math.PI / 2)
  const n = 12
  const depth = run / n
  const start = run / 2
  for (let i = 0; i < n; i++) {
    const h = ((i + 1) * H) / n
    block(k, st, [width, h, depth], s.main, [0, 0, start - (i + .5) * depth])
    block(k, st, [width + .02, .03, depth + .02], tread, [0, h, start - (i + .5) * depth], { noShadow: true })
  }
  const side = width / 2 + .03
  for (let i = 0; i <= n; i += 3) {
    const h = (Math.max(1, i) * H) / n
    tube(k, st, .02, .85, s.accent, [side, h, start - Math.max(.5, i) * depth], { noShadow: true })
  }
  const slope = Math.atan2(H, run)
  const rail = Math.hypot(H, run)
  st.add(mesh(k, k.box(.05, .05, rail), s.accent, [side, H / 2 + .85, 0], { rot: [slope, 0, 0], noShadow: true }))
}

function hall(c: Ctx) {
  const { k, g, W, D, s } = c
  const alongZ = D >= W
  const len = alongZ ? D : W
  const wide = alongZ ? W : D
  const h = group(g, [0, 0, 0], alongZ ? 0 : -Math.PI / 2)
  if (s.variant === 'runner') {
    block(k, h, [.75, .012, len - .5], s.accent, [0, 0, 0], { noShadow: true })
    for (const x of [-.32, .32]) block(k, h, [.035, .014, len - .55], '#ffca28', [x, 0, 0], { noShadow: true })
  }
  const arts = [['#bbdefb', '#ffeb3b', '#66bb6a'], ['#ffe0b2', '#ef5350', '#8d6e63'], ['#e1bee7', '#ffffff', '#7e57c2']] as const
  const n = Math.max(1, Math.floor(len / 1.7))
  for (let i = 0; i < n; i++) picture(k, h, [-wide / 2 + .01, 1.25, -len / 2 + (len * (i + .5)) / n], Math.PI / 2, .55, .45, arts[i % arts.length])
  block(k, h, [.35, .75, .7], WOOD, [wide / 2 - .2, 0, -len / 2 + .45])
  vase(k, h, [wide / 2 - .2, .75, -len / 2 + .45], '#ffffff', s.id === 'shiny' ? '#64b5f6' : '#ff8a80')
  if (s.id === 'shiny') plant(k, h, [wide / 2 - .3, 0, len / 2 - .4], .8)
}

const FURNISH: Readonly<Record<RoomTypeId, (c: Ctx) => void>> = {
  living, dining, kitchen, bath, toilet, washroom, bedroom, kids, washitsu, entrance, stairs, hall,
  library, music, art, playroom, pet, laundry, closet, plants,
}

// ---------------- ゆか と かべ ----------------

function wallColor(type: RoomTypeId, s: RoomStyle): string {
  if (s.variant === 'stars' || s.variant === 'space') return '#2c3a6e'
  if (type === 'washitsu') return '#efe4c8'
  if (s.id === 'hotel' && type === 'toilet') return '#6b6b82'
  return mix(s.base, WHITE, .6)
}

type WallPlace = { normal: THREE.Vector3; at: V3; rotY: number; length: number }

/** かべの いち。rotY は かべの うちがわ（へやの なか）を +z に むける。 */
function wallPlace(side: Side, W: number, D: number): WallPlace {
  switch (side) {
    case 'back': return { normal: new THREE.Vector3(0, 0, -1), at: [0, 0, -D / 2], rotY: 0, length: W }
    case 'front': return { normal: new THREE.Vector3(0, 0, 1), at: [0, 0, D / 2], rotY: Math.PI, length: W }
    case 'left': return { normal: new THREE.Vector3(-1, 0, 0), at: [-W / 2, 0, 0], rotY: Math.PI / 2, length: D }
    case 'right': return { normal: new THREE.Vector3(1, 0, 0), at: [W / 2, 0, 0], rotY: -Math.PI / 2, length: D }
  }
}

/** かべに そった マスの いち → かべの なかの x（まんなかが 0）。 */
function alongWall(side: Side, room: PlacedRoom, W: number, D: number, cells: number): number {
  const from = roomEdge(room, side).from
  const local = (cells - from) * CELL
  switch (side) {
    case 'back': return local - W / 2
    case 'front': return W / 2 - local
    case 'left': return D / 2 - local
    case 'right': return local - D / 2
  }
}

/** へやを ひとつ 3D に する。まわりの かべは カメラに ちかい がわを ひくく して なかを みせる。 */
export function buildRoom(design: HouseDesign, room: PlacedRoom): Built {
  const k = new Kit()
  const root = new THREE.Group()
  root.name = `room-${room.id}`
  root.userData.spot = 'room'
  const { w, h } = roomSize(room)
  const W = w * CELL
  const D = h * CELL
  const s = findRoomStyle(room.type, room.style)
  const ticks: Tick[] = []
  const cutaways: Cutaway[] = []

  // だい と ゆか。
  block(k, root, [W + T * 2 + .5, .3, D + T * 2 + .5], '#efe3cf', [0, -.4, 0], { round: .06 })
  block(k, root, [W + T * 2 + .56, .05, D + T * 2 + .56], '#cdb79a', [0, -.42, 0])
  const map = k.tex(`floor-${room.type}-${s.id}`, () => floorTexture(s.floor, s.base, s.line), [W / CELL, D / CELL])
  const floor = block(k, root, [W, .1, D], k.mat(map ? WHITE : s.base, { map, rough: s.floor === 'marble' || s.floor === 'tile' ? .35 : .85 }), [0, -.1, 0])
  floor.name = 'floor'

  const inner = wallColor(room.type, s)
  const bath = room.type === 'bath' || room.type === 'washroom'
  const japanese = room.type === 'washitsu'
  const openings = roomOpenings(design, room)
  const door = innerDoor(design, room)
  const look = { window: design.exterior.window, door: design.exterior.door, inside: true }
  for (const side of SIDES) {
    const place = wallPlace(side, W, D)
    const length = place.length + T * 2
    const wall = group(root, place.at, place.rotY)
    wall.name = `wall-${side}`
    const full = group(wall)
    const low = group(wall)
    const tile = bath ? k.tex(`wall-tile-${s.id}`, () => floorTexture('tile', inner, mix(inner, '#90a4ae', .35)), [length / CELL, H / CELL]) : null
    block(k, full, [length, H, T], k.mat(tile ? WHITE : inner, { map: tile }), [0, 0, -T / 2])
    block(k, full, [place.length, .1, .02], japanese ? DARK_WOOD : mix(inner, '#5d4037', .35), [0, 0, .01], { noShadow: true })
    block(k, low, [length, LOW, T], inner, [0, 0, -T / 2])
    block(k, low, [length, .03, T + .02], mix(inner, '#5d4037', .3), [0, LOW, -T / 2], { noShadow: true })
    if (japanese) {
      for (const x of [-place.length / 2 + .06, place.length / 2 - .06]) block(k, full, [.12, H, .06], DARK_WOOD, [x, 0, .03])
      block(k, full, [place.length, .1, .05], DARK_WOOD, [0, 1.85, .025], { noShadow: true })
    }
    for (const o of openings) {
      if (o.side !== side) continue
      const edge = roomEdge(room, side)
      const room2wall = Math.min(o.center - edge.from, edge.to - o.center) * CELL * 2 - .2
      const panel = openingPanel(k, o.kind, o.span, look, room2wall)
      panel.position.set(alongWall(side, room, W, D, o.center), 0, .005)
      full.add(panel)
    }
    if (door && door.side === side && !openings.some((o) => o.side === side && Math.abs(o.center - door.center) < .8)) {
      const panel = innerDoorPanel(k, japanese)
      panel.position.set(alongWall(side, room, W, D, door.center), 0, .005)
      full.add(panel)
    }
    low.visible = false
    cutaways.push({ normal: place.normal, full, low })
  }

  const furniture = group(root)
  furniture.name = 'furniture'
  FURNISH[room.type]({ k, g: furniture, W, D, s, ticks })

  // おもての ドアが ある へやは うしろから みて ドアを みせる。
  const frontDoor = openings.some((o) => o.kind === 'door' && o.side === 'front')
  return {
    root,
    yaw: frontDoor ? Math.PI - .62 : undefined,
    target: new THREE.Vector3(0, .7, 0),
    radius: Math.hypot(W / 2 + T, D / 2 + T, 1.3) + .2,
    cutaways,
    ticks,
    dispose: () => {
      disposeObject(root)
      k.dispose()
    },
  }
}
