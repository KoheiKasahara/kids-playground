// かべに つける まど と ドア（3D）。そとから みる ときも、へやの なかから みる ときも つかう。
// group の なかでは x が かべに そった むき、y が うえ、z が かべから はなれる むき（0 が かべの おもて）。

import * as THREE from 'three'
import { findDoor, type DoorId, type WindowId } from '../data'
import { CELL } from '../layout3d'
import type { OpeningKind } from '../plan'
import { Kit, ball, block, group, mesh, tube } from './kit'
import { viewTexture } from './textures'

export type OpeningSize = { w: number; h: number; bottom: number }

/** まど・ドアの おおきさ（メートル）。おおきな まどは めんした はばに あわせて ひろがる。 */
export function openingSize(kind: OpeningKind, span: number): OpeningSize {
  switch (kind) {
    case 'door': return { w: 1, h: 2.1, bottom: 0 }
    case 'big': return { w: Math.max(1.4, Math.min(span * CELL - .5, 3.4)), h: 2.05, bottom: .05 }
    case 'window': return { w: 1.15, h: 1.1, bottom: .9 }
    case 'small': return { w: .62, h: .55, bottom: 1.45 }
    case 'slim': return { w: .5, h: 1.5, bottom: .6 }
  }
}

export type PanelLook = { window: WindowId; door: DoorId; inside: boolean }

const FRAME = .07
const GLASS_OUT = '#a9dcf7'

function glass(k: Kit, inside: boolean): THREE.Material {
  if (inside) {
    const map = k.tex('view', viewTexture)
    return map ? k.mat('#ffffff', { flat: true, map }) : k.mat('#bfe6fb', { flat: true })
  }
  return k.mat(GLASS_OUT, { rough: .12, metal: .25, emissive: '#2f6d93', glow: .22 })
}

/** しかくい わく。 */
function frame(k: Kit, g: THREE.Object3D, w: number, h: number, color: string, depth = .09) {
  block(k, g, [w + FRAME * 2, FRAME, depth], color, [0, -FRAME, depth / 2])
  block(k, g, [w + FRAME * 2, FRAME, depth], color, [0, h, depth / 2])
  block(k, g, [FRAME, h, depth], color, [-w / 2 - FRAME / 2, 0, depth / 2])
  block(k, g, [FRAME, h, depth], color, [w / 2 + FRAME / 2, 0, depth / 2])
}

function pane(k: Kit, g: THREE.Object3D, w: number, h: number, look: THREE.Material, y = 0) {
  g.add(mesh(k, k.plane(w, h), look, [0, y + h / 2, .02], { noShadow: true }))
}

function shojiGrid(k: Kit, g: THREE.Object3D, w: number, h: number, cols: number, rows: number) {
  const wood = '#8b6b4a'
  pane(k, g, w, h, k.mat('#fff8e7', { emissive: '#fff3d6', glow: .35 }))
  for (let i = 1; i < cols; i++) block(k, g, [.025, h, .03], wood, [-w / 2 + (w * i) / cols, 0, .035], { noShadow: true })
  for (let i = 1; i < rows; i++) block(k, g, [w, .025, .03], wood, [0, (h * i) / rows - .0125, .035], { noShadow: true })
  frame(k, g, w, h, wood)
}

function windowPanel(k: Kit, g: THREE.Group, style: WindowId, size: OpeningSize, inside: boolean) {
  const { w, h } = size
  const white = '#ffffff'
  switch (style) {
    case 'round': {
      const r = Math.min(w, h) / 2
      g.add(mesh(k, k.circle(r), glass(k, inside), [0, h / 2, .02], { noShadow: true }))
      g.add(mesh(k, k.torus(r, .055, Math.PI * 2, 32), white, [0, h / 2, .05]))
      block(k, g, [r * 2, .03, .03], white, [0, h / 2 - .015, .04], { noShadow: true })
      return
    }
    case 'arch': {
      const r = w / 2
      const rect = Math.max(.1, h - r)
      pane(k, g, w, rect, glass(k, inside))
      g.add(mesh(k, k.half(r), glass(k, inside), [0, rect, .02], { noShadow: true }))
      g.add(mesh(k, k.torus(r + FRAME / 2, FRAME / 2, Math.PI, 24), white, [0, rect, .05]))
      block(k, g, [FRAME, rect, .09], white, [-w / 2 - FRAME / 2, 0, .045])
      block(k, g, [FRAME, rect, .09], white, [w / 2 + FRAME / 2, 0, .045])
      block(k, g, [w + FRAME * 2, FRAME, .09], white, [0, -FRAME, .045])
      block(k, g, [.03, rect, .03], white, [0, 0, .04], { noShadow: true })
      return
    }
    case 'shoji':
      shojiGrid(k, g, w, h, 3, 4)
      return
    case 'wide': {
      pane(k, g, w, h, glass(k, inside))
      frame(k, g, w, h, '#3e626b')
      for (const side of [-1, 1]) block(k, g, [.035, h, .04], '#3e626b', [side * w / 6, 0, .05], { noShadow: true })
      block(k, g, [w + .2, .06, .15], '#e8e5db', [0, -.12, .08])
      return
    }
    case 'shutters': {
      // よろいどを ふくめて w に おさめ、せまい かべでも はみださない。
      const glassWidth = w * .62
      pane(k, g, glassWidth, h, glass(k, inside))
      frame(k, g, glassWidth, h, white)
      block(k, g, [.035, h, .03], white, [0, 0, .04], { noShadow: true })
      if (!inside) for (const side of [-1, 1]) {
        const shutter = group(g, [side * (w * .42 + .035), 0, .06])
        shutter.name = 'shutter'
        block(k, shutter, [w * .17, h + .1, .07], '#529486', [0, -.05, 0])
        for (let row = 0; row < 6; row++) block(k, shutter, [w * .14, .025, .03], '#b7dbc8', [0, (row + .5) * h / 6, .05], { noShadow: true })
      }
      return
    }
    case 'square':
    case 'flowerbox': {
      pane(k, g, w, h, glass(k, inside))
      frame(k, g, w, h, white)
      block(k, g, [.035, h, .03], white, [0, 0, .04], { noShadow: true })
      block(k, g, [w, .035, .03], white, [0, h / 2 - .0175, .04], { noShadow: true })
      // まどべ。
      block(k, g, [w + .24, .05, .16], white, [0, -FRAME - .05, .08])
      if (style === 'flowerbox' && !inside) {
        block(k, g, [w + .1, .2, .22], '#8d5a3b', [0, -FRAME - .25, .14])
        const colors = ['#ff6b9a', '#ffd166', '#ffffff', '#c77dff']
        const n = Math.max(3, Math.round(w / .16))
        for (let i = 0; i < n; i++) {
          const x = -w / 2 + .05 + (i * (w - .1)) / (n - 1)
          ball(k, g, .05, '#43a047', [x, -FRAME - .02, .15], { noShadow: true })
          ball(k, g, .045, colors[i % colors.length], [x + .02, .02 - FRAME, .2], { noShadow: true })
        }
      }
    }
  }
}

/** ゆかまで ある おおきな ひきちがいの まど。 */
function bigPanel(k: Kit, g: THREE.Group, style: WindowId, size: OpeningSize, inside: boolean) {
  const { w, h } = size
  if (style === 'shutters') {
    windowPanel(k, g, style, size, inside)
    return
  }
  if (style === 'shoji') {
    shojiGrid(k, g, w, h, 6, 5)
    block(k, g, [.03, h, .05], '#8b6b4a', [0, 0, .04], { noShadow: true })
    return
  }
  const color = style === 'wide' ? '#3e626b' : '#e9edf0'
  pane(k, g, w, h, glass(k, inside))
  frame(k, g, w, h, color, .1)
  block(k, g, [.06, h, .06], color, [0, 0, .05], { noShadow: true })
  block(k, g, [.03, .22, .04], '#90a4ae', [-.08, h * .45, .08], { noShadow: true })
  block(k, g, [.03, .22, .04], '#90a4ae', [.08, h * .45, .08], { noShadow: true })
  if (style === 'wide') for (const side of [-1, 1]) block(k, g, [.035, h, .06], color, [side * w / 3, 0, .05], { noShadow: true })
  if (style === 'arch' || style === 'round') {
    // うえに まるい らんま。
    const r = Math.min(.5, w / 4)
    g.add(mesh(k, k.half(r, 20), glass(k, inside), [0, h + FRAME, .02], { noShadow: true }))
    g.add(mesh(k, k.torus(r, .04, Math.PI, 20), color, [0, h + FRAME, .05]))
  }
}

function doorPanel(k: Kit, g: THREE.Group, door: DoorId, size: OpeningSize, inside: boolean) {
  const { w, h } = size
  const d = findDoor(door)
  const trim = '#5d4037'
  const knob = k.mat('#e0b64a', { rough: .3, metal: .7 })
  if (door === 'slide') {
    // ガラスの こうしが はいった ひきど 2まい。
    for (const side of [-1, 1]) {
      const p = group(g, [(side * w) / 4, 0, side > 0 ? .02 : .06])
      block(k, p, [w / 2, h, .05], d.color, [0, 0, 0])
      const gw = w / 2 - .16
      const gh = h * .62
      p.add(mesh(k, k.plane(gw, gh), glass(k, inside), [0, h * .3 + gh / 2, .027], { noShadow: true }))
      for (let i = 1; i < 3; i++) block(k, p, [.025, gh, .02], d.color, [-gw / 2 + (gw * i) / 3, h * .3, .035], { noShadow: true })
      for (let i = 1; i < 4; i++) block(k, p, [gw, .025, .02], d.color, [0, h * .3 + (gh * i) / 4, .035], { noShadow: true })
    }
    frame(k, g, w, h, trim, .1)
    return
  }
  if (door === 'double') {
    for (const side of [-1, 1]) {
      const leaf = group(g, [side * w / 4, 0, 0])
      leaf.name = 'door-leaf'
      block(k, leaf, [w / 2 - .02, h, .06], d.color, [0, 0, .03])
      block(k, leaf, [w * .32, h * .3, .025], '#9a734d', [0, h * .12, .075], { noShadow: true })
      leaf.add(mesh(k, k.plane(w * .3, h * .35), glass(k, inside), [0, h * .71, .065], { noShadow: true }))
      block(k, leaf, [.025, h * .35, .025], '#edd1a0', [0, h * .535, .08], { noShadow: true })
      ball(k, leaf, .045, knob, [-side * w * .16, h * .48, .1])
    }
    frame(k, g, w, h, '#f5e3c4', .1)
    return
  }
  if (door === 'round') {
    const r = w / 2
    const body = h - r
    block(k, g, [w, body, .06], d.color, [0, 0, .03])
    g.add(mesh(k, k.cyl(r, r, .06, 24, false, Math.PI), d.color, [0, body, .03], { rot: [Math.PI / 2, Math.PI / 2, 0] }))
    g.add(mesh(k, k.torus(r + .04, .05, Math.PI, 24), trim, [0, body, .07]))
    block(k, g, [.06, body, .1], trim, [-r - .04, 0, .05])
    block(k, g, [.06, body, .1], trim, [r + .04, 0, .05])
    ball(k, g, .06, knob, [0, body * .55, .1])
    g.add(mesh(k, k.circle(.16, 16), glass(k, inside), [0, body + r * .45, .065], { noShadow: true }))
    return
  }
  block(k, g, [w, h, .06], d.color, [0, 0, .03])
  frame(k, g, w, h, trim, .1)
  const panelColor = door === 'white' ? '#e3e3e3' : new THREE.Color(d.color).multiplyScalar(.82).getStyle()
  if (door === 'blue') {
    const porthole = group(g, [0, h * .73, .07])
    porthole.add(mesh(k, k.circle(w * .19, 24), glass(k, inside), [0, 0, 0], { noShadow: true }))
    porthole.add(mesh(k, k.torus(w * .19, .035, Math.PI * 2, 24), '#f7f1dc', [0, 0, .02]))
    block(k, g, [w * .62, h * .24, .025], panelColor, [0, h * .13, .07], { noShadow: true })
  } else if (door === 'white') {
    g.add(mesh(k, k.plane(.2, h * .7), glass(k, inside), [-w * .22, h * .5, .065], { noShadow: true }))
  } else {
    block(k, g, [w * .62, h * .3, .03], panelColor, [0, h * .58, .07], { noShadow: true })
    block(k, g, [w * .62, h * .3, .03], panelColor, [0, h * .14, .07], { noShadow: true })
  }
  if (door === 'red') g.add(mesh(k, k.plane(w * .4, .3), glass(k, inside), [0, h * .92 - .15, .09], { noShadow: true }))
  ball(k, g, .055, knob, [w * .36, h * .48, .1])
}

/**
 * まど・ドアを ひとつ つくる。そとがわの ドアには ひさし・ステップ・ランプも つける。
 * width を わたすと はばを せまく できる（かべが みじかい とき）。
 */
export function openingPanel(k: Kit, kind: OpeningKind, span: number, look: PanelLook, width?: number): THREE.Group {
  let base = openingSize(kind, span)
  if (kind === 'door' && look.door === 'double') base = { ...base, w: 1.5 }
  if (kind === 'window' && look.window === 'wide') base = { w: Math.min(2.1, span * CELL - .35), h: .85, bottom: 1.05 }
  if (kind === 'window' && look.window === 'shutters') base = { ...base, w: 1.7 }
  const size = width ? { ...base, w: Math.min(base.w, width) } : base
  const g = new THREE.Group()
  const inner = group(g, [0, size.bottom, 0])
  if (kind === 'door') {
    doorPanel(k, inner, look.door, size, look.inside)
    if (!look.inside) {
      block(k, g, [size.w + .8, .12, .75], '#6d6d6d', [0, size.h + .2, .38], { round: .03 })
      block(k, g, [size.w + .7, .16, .7], '#c9c3b8', [0, -.16, .35], { round: .03 })
      const lamp = group(g, [size.w / 2 + .3, 1.75, .1])
      block(k, lamp, [.16, .22, .16], k.mat('#fff3c4', { emissive: '#ffd66b', glow: .8 }), [0, 0, 0], { noShadow: true })
      block(k, lamp, [.2, .04, .2], '#37474f', [0, .22, 0], { noShadow: true })
    }
  } else if (kind === 'big') {
    bigPanel(k, inner, look.window, size, look.inside)
  } else {
    windowPanel(k, inner, look.window === 'flowerbox' && kind !== 'window' ? 'square' : look.window, size, look.inside)
  }
  return g
}

/** へやから となりへ でる ドア（なかの ドア）。わしつは ふすま。 */
export function innerDoorPanel(k: Kit, japanese: boolean): THREE.Group {
  const g = new THREE.Group()
  if (japanese) {
    for (const side of [-1, 1]) {
      const p = group(g, [side * .42, 0, side > 0 ? .02 : .05])
      block(k, p, [.84, 1.95, .04], '#f4ead2', [0, 0, 0])
      p.add(mesh(k, k.circle(.05, 12), '#5d4037', [-side * .3, 1, .022], { noShadow: true }))
      block(k, p, [.84, .04, .05], '#3e2723', [0, 1.95, 0], { noShadow: true })
      // やまの え。
      p.add(mesh(k, k.circle(.22, 3), '#9ccc65', [0, .5, .022], { rot: [0, 0, Math.PI / 2], noShadow: true }))
    }
    block(k, g, [1.8, .08, .1], '#6d4c41', [0, 1.97, .05])
    return g
  }
  block(k, g, [.86, 2, .05], '#e9d4b4', [0, 0, .025])
  frame(k, g, .86, 2, '#a1887f', .08)
  block(k, g, [.6, .7, .02], '#dcc39e', [0, 1.1, .06], { noShadow: true })
  block(k, g, [.6, .6, .02], '#dcc39e', [0, .3, .06], { noShadow: true })
  tube(k, g, .025, .12, k.mat('#cfd8dc', { metal: .6, rough: .3 }), [.32, 1, .1], { rot: [Math.PI / 2, 0, 0], noShadow: true })
  return g
}
