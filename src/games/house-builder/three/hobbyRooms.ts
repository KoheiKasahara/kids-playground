import * as THREE from 'three'
import type { RoomStyle } from '../data'
import { Kit, ball, block, group, mesh, tube, type V3 } from './kit'

type Context = { k: Kit; g: THREE.Group; W: number; D: number; s: RoomStyle }

/** かぐは 3m の しかくに つくり、へやに あわせて おおきくする。 */
function furnishing(c: Context, name: string) {
  const g = group(c.g)
  g.name = name
  g.scale.setScalar(Math.min((c.W - .3) / 3, (c.D - .3) / 3, 1.3))
  return g
}

function seat(k: Kit, g: THREE.Object3D, at: V3, color: string) {
  const p = group(g, at)
  for (const x of [-.2, .2]) for (const z of [-.2, .2]) block(k, p, [.06, .4, .06], '#9d7c57', [x, 0, z])
  block(k, p, [.55, .14, .55], color, [0, .4, 0], { round: .06 })
  block(k, p, [.55, .5, .08], color, [0, .5, -.24], { round: .04 })
}

function desk(k: Kit, g: THREE.Object3D, at: V3, color: string, w = 1.5) {
  const p = group(g, at)
  for (const x of [-w / 2 + .1, w / 2 - .1]) for (const z of [-.3, .3]) block(k, p, [.08, .75, .08], '#997c5b', [x, 0, z])
  block(k, p, [w, .09, .8], color, [0, .75, 0], { round: .03 })
  return p
}

function potted(k: Kit, g: THREE.Object3D, at: V3, s: RoomStyle, flower = false, scale = 1) {
  const p = group(g, at)
  p.scale.setScalar(scale)
  tube(k, p, .2, .35, s.main, [0, 0, 0], { top: .28 })
  tube(k, p, .025, .55, '#62834e', [0, .35, 0])
  for (let i = 0; i < 5; i++) {
    const a = i * Math.PI * 2 / 5
    ball(k, p, .23, flower ? '#df8dad' : s.accent, [Math.cos(a) * .2, .75 + i * .04, Math.sin(a) * .2], { scale: [1, .4, 1] })
  }
  if (flower) ball(k, p, .13, '#f9d866', [0, .97, 0])
}

export function library(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `library-${s.variant}`)
  const low = s.variant === 'picturebooks'
  const h = low ? 1 : 1.85
  block(k, g, [2.7, h, .12], s.main, [0, 0, -1.34])
  for (const x of [-1.3, 1.3]) block(k, g, [.1, h, .48], s.main, [x, 0, -1.15])
  const rows = low ? 2 : 4
  for (let row = 0; row < rows; row++) {
    const y = row * .44
    block(k, g, [2.7, .07, .48], s.main, [0, y, -1.15])
    for (let i = 0; i < 12; i++) block(k, g, [.13, .26 + i % 3 * .035, .26], [s.accent, '#e3af67', '#c77d7a'][i % 3], [-1.17 + i * .21, y + .07, -1.12])
  }
  if (s.variant === 'study') {
    desk(k, g, [.2, 0, .25], s.main, 1.8)
    block(k, g, [.55, .025, .36], '#fff8e5', [.2, .84, .25])
    block(k, g, [.02, .028, .36], s.accent, [.2, .84, .25])
    seat(k, g, [.2, 0, 1], s.accent)
  } else {
    tube(k, g, 1.1, .025, s.accent, [0, 0, .25])
    seat(k, g, [-.6, .03, .25], s.accent)
    const t = desk(k, g, [.65, .03, .3], s.main, .65)
    block(k, t, [.35, .04, .28], '#fff8e5', [0, .84, 0])
  }
}

export function music(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `music-${s.variant}`)
  block(k, g, [2.6, .025, 2.5], s.accent, [0, 0, 0], { round: .15 })
  if (s.variant === 'piano') {
    for (const x of [-.95, .95]) block(k, g, [.15, .7, .6], s.main, [x, .025, -.85])
    block(k, g, [2.2, 1.05, .38], s.main, [0, .5, -1.06], { round: .04 })
    block(k, g, [2.2, .12, .6], s.main, [0, .76, -.7])
    for (let i = 0; i < 18; i++) {
      block(k, g, [.105, .04, .38], '#fff8e9', [-.96 + i * .113, .88, -.58])
      if (i % 3 !== 2) block(k, g, [.055, .06, .23], '#292b36', [-.91 + i * .113, .92, -.67])
    }
    desk(k, g, [0, .025, .45], s.main, .8).scale.set(1, .65, .65)
  } else if (s.variant === 'drums') {
    for (const [x, z, r, y] of [[0, 0, .5, .15], [-.5, -.65, .32, .75], [.4, -.65, .3, .8]]) {
      tube(k, g, r, .45, s.main, [x, y, z])
      tube(k, g, r, .035, '#f3eade', [x, y + .45, z])
    }
    for (const x of [-1.05, 1.05]) {
      tube(k, g, .04, 1.25, '#8f98a0', [x, .025, -.2])
      tube(k, g, .34, .035, '#e7bf60', [x, 1.26, -.2])
      tube(k, g, .3, .04, '#8f98a0', [x, .025, -.2])
    }
    seat(k, g, [0, .025, 1], s.main)
  } else {
    const guitar = group(g, [.2, .35, -.25])
    ball(k, guitar, .43, s.main, [0, .4, 0], { scale: [1, 1.1, .35] })
    ball(k, guitar, .32, s.main, [0, .82, 0], { scale: [1, 1, .4] })
    block(k, guitar, [.13, .9, .12], '#8c633d', [0, .9, 0])
    block(k, guitar, [.23, .3, .14], s.main, [0, 1.77, 0])
    guitar.add(mesh(k, k.circle(.13), '#42382f', [0, .68, .156]))
    for (const x of [-.03, 0, .03]) block(k, guitar, [.008, 1.65, .008], '#ead3a1', [x, .25, .17])
    block(k, g, [.85, .7, .5], '#424652', [-.95, .025, -.6], { round: .05 })
    g.add(mesh(k, k.circle(.25), s.accent, [-.95, .4, -.341]))
    seat(k, g, [.65, .025, .75], s.accent)
  }
}

export function art(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `art-${s.variant}`)
  if (s.variant === 'painting') {
    for (const x of [-.4, .4]) block(k, g, [.08, 1.85, .08], s.main, [x, 0, -.6], { rot: [0, 0, -x * .2] })
    block(k, g, [1.2, .1, .3], s.main, [0, .65, -.55])
    block(k, g, [1.05, 1.05, .06], '#fff6e4', [0, .75, -.55])
    ball(k, g, .19, s.accent, [.25, 1.51, -.5], { scale: [1, 1, .1] })
    g.add(mesh(k, k.circle(.45, 3), '#79aca0', [-.1, 1.05, -.51]))
    block(k, g, [.08, 1.1, .08], s.main, [0, 0, -1.15], { rot: [.25, 0, 0] })
  } else {
    const t = desk(k, g, [-.3, 0, -.4], s.main, 1.8)
    if (s.variant === 'pottery') {
      tube(k, t, .38, .045, '#b5b9b6', [0, .84, 0])
      tube(k, t, .2, .32, s.accent, [0, .885, 0], { top: .27 })
      tube(k, t, .21, .02, '#72513e', [0, 1.205, 0])
    } else {
      block(k, t, [.7, .02, .45], '#fff5dc', [0, .84, 0])
      block(k, t, [.25, .08, .25], s.accent, [-.15, .86, 0], { rot: [0, .4, 0] })
      for (let i = 0; i < 3; i++) block(k, t, [.04, .03, .35], ['#d36e6e', '#67a8bd', '#e4bf57'][i], [.4 + i * .07, .86, 0])
    }
    seat(k, g, [-.3, 0, .6], s.accent)
  }
  const t = desk(k, g, [1, 0, -.4], s.main, .65)
  for (let i = 0; i < 3; i++) tube(k, t, .085, .2 + i * .04, [s.accent, '#eac754', '#7eaec7'][i], [0, .84, -.25 + i * .25])
}

export function playroom(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `playroom-${s.variant}`)
  block(k, g, [2.8, .04, 2.8], s.accent, [0, 0, 0], { round: .12 })
  if (s.variant === 'balls') {
    block(k, g, [2.3, .08, 2.2], s.main, [0, .04, 0], { round: .15 })
    for (const x of [-1.1, 1.1]) block(k, g, [.18, .5, 2.2], s.main, [x, .04, 0], { round: .08 })
    for (const z of [-1, 1]) block(k, g, [2.2, .5, .18], s.main, [0, .04, z], { round: .08 })
    for (let i = 0; i < 25; i++) ball(k, g, .17, [s.accent, '#f4d35e', '#92cc9f', '#fcebd1'][i % 4], [-.75 + i % 5 * .37, .27 + i % 2 * .08, -.7 + Math.floor(i / 5) * .35])
  } else if (s.variant === 'blocks') {
    for (let i = 0; i < 9; i++) {
      const x = -.85 + i % 3 * .8, z = -.8 + Math.floor(i / 3) * .8
      block(k, g, [.5, .3 + i % 3 * .25, .5], [s.main, '#d88377', '#76a7cf'][i % 3], [x, .04, z], { round: .03 })
      if (i % 2) tube(k, g, .28, .45, s.accent, [x, .34 + i % 3 * .25, z], { top: 0, seg: 4 })
    }
  } else {
    for (const x of [-.4, .4]) block(k, g, [.1, 1.1, .1], s.main, [x, .04, -.8])
    block(k, g, [.9, .1, .6], s.main, [0, 1.1, -.8])
    for (let i = 1; i <= 3; i++) block(k, g, [.8, .07, .2], s.accent, [0, i * .3, -1.1])
    g.add(mesh(k, k.box(.8, .1, 1.8), s.accent, [0, .64, .25], { rot: [.55, 0, 0] }))
    for (const x of [-.45, .45]) g.add(mesh(k, k.box(.08, .2, 1.8), s.main, [x, .76, .25], { rot: [.55, 0, 0] }))
    ball(k, g, .25, '#f2d563', [1, .29, .8])
  }
}

export function pet(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `pet-${s.variant}`)
  block(k, g, [1.25, .2, 1.05], s.accent, [.7, 0, .7], { round: .15 })
  block(k, g, [.9, .1, .7], '#f9eedc', [.7, .2, .7], { round: .12 })
  if (s.variant === 'cat') {
    block(k, g, [1.1, .1, 1], s.main, [-.75, 0, -.6], { round: .05 })
    tube(k, g, .09, 1.6, '#d4bd97', [-.75, .1, -.6])
    for (const y of [.7, 1.65]) block(k, g, [.9, .1, .8], s.accent, [-.75, y, -.6], { round: .08 })
    block(k, g, [.7, .55, .65], s.main, [-.75, .1, -.6], { round: .08 })
    g.add(mesh(k, k.circle(.18), '#594a3b', [-.75, .4, -.267]))
  } else if (s.variant === 'dog') {
    block(k, g, [1.1, .85, 1.1], s.main, [-.7, 0, -.6])
    const roof = k.custom('indoor-dog-roof', () => new THREE.CylinderGeometry(0, .85, .55, 4).rotateY(Math.PI / 4))
    g.add(mesh(k, roof, s.accent, [-.7, 1.12, -.6]))
    block(k, g, [.47, .65, .02], '#604e40', [-.7, 0, -.039], { round: .16 })
  } else {
    block(k, g, [1.2, .1, 1.2], s.main, [-.65, 0, -.6])
    for (const x of [-1.2, -.1]) for (const z of [-1.15, -.05]) block(k, g, [.05, .8, .05], s.accent, [x, .1, z])
    block(k, g, [1.2, .06, 1.2], s.main, [-.65, .9, -.6])
    ball(k, g, .24, '#fff3e7', [-.65, .34, -.4], { scale: [1, .8, 1.2] })
    for (const x of [-.75, -.55]) ball(k, g, .08, '#f7d9d5', [x, .68, -.45], { scale: [.65, 2.3, .65] })
  }
  for (const x of [.45, 1]) {
    tube(k, g, .19, .11, s.main, [x, 0, -.9], { top: .23 })
    tube(k, g, .17, .015, x < .5 ? '#8ccad7' : '#a67f56', [x, .11, -.9])
  }
  ball(k, g, .15, s.accent, [-.5, .15, .9])
}

export function laundry(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `laundry-${s.variant}`)
  block(k, g, [1, 1.1, .9], s.main, [-.8, 0, -.9], { round: .06 })
  g.add(mesh(k, k.torus(.31, .055), s.accent, [-.8, .56, -.439]))
  g.add(mesh(k, k.circle(.26), '#aed1dc', [-.8, .56, -.437]))
  for (const x of [-1.05, -.85, -.65]) ball(k, g, .035, s.accent, [x, .97, -.438])
  tube(k, g, .35, .45, '#d0af85', [-.8, 0, .7], { top: .43, seg: 12 })
  block(k, g, [.55, .15, .4], s.accent, [-.8, .35, .7], { round: .06 })
  if (s.variant === 'washer') {
    block(k, g, [1, 1.1, .9], s.main, [.65, 0, -.9], { round: .06 })
    g.add(mesh(k, k.torus(.31, .055), s.accent, [.65, .56, -.439]))
    g.add(mesh(k, k.circle(.26), '#f8e5be', [.65, .56, -.437]))
    for (let i = 0; i < 3; i++) block(k, g, [.7, .12, .5], i % 2 ? s.accent : '#e4e9e7', [.65, i * .12, .7], { round: .04 })
  } else if (s.variant === 'ironing') {
    const t = desk(k, g, [.65, 0, .1], s.accent, .8)
    t.scale.z = 1.8
    block(k, t, [.25, .16, .38], s.main, [0, .84, 0], { round: .06 })
    block(k, t, [.12, .13, .2], '#a3acb2', [0, 1, 0], { round: .03 })
  } else {
    for (const z of [-1.15, 1.1]) block(k, g, [.07, 1.65, .07], '#9ba7ad', [.75, 0, z])
    block(k, g, [.07, .07, 2.3], '#9ba7ad', [.75, 1.65, 0])
    for (let i = 0; i < 3; i++) block(k, g, [.8, .7, .04], i % 2 ? s.accent : '#e4e9e7', [.75, .9, -.7 + i * .65])
  }
}

export function closet(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `closet-${s.variant}`)
  block(k, g, [2.7, 2, .08], s.main, [0, 0, -1.3])
  for (const x of [-1.3, 1.3]) block(k, g, [.08, 2, .6], s.main, [x, 0, -1.05])
  for (const y of [.05, 1.9]) block(k, g, [2.7, .07, .6], s.main, [0, y, -1.05])
  block(k, g, [2.5, .035, .035], '#a2a9ad', [0, 1.65, -1])
  for (let i = 0; i < 7; i++) {
    const x = -1.02 + i * .34
    block(k, g, [.24, s.variant === 'costume' ? 1.05 : .7, .3], [s.accent, '#e9c675', '#d993a9'][i % 3], [x, .55, -1], { round: .04 })
    g.add(mesh(k, k.torus(.065, .015, Math.PI), '#b8b5aa', [x, 1.62, -1]))
  }
  if (s.variant === 'wardrobe') {
    block(k, g, [1.1, .85, .65], s.main, [-.75, 0, .65])
    for (const y of [.28, .56]) {
      block(k, g, [1.02, .02, .02], '#8e7459', [-.75, y, .986])
      block(k, g, [.2, .04, .03], s.accent, [-.75, y + .12, .99])
    }
  } else {
    block(k, g, [.75, 1.7, .08], s.main, [-.9, .05, .2])
    block(k, g, [.6, 1.4, .02], '#c9e5e9', [-.9, .2, .251])
    if (s.variant === 'costume') tube(k, g, .2, .23, '#e6c15d', [.65, .85, .7], { top: .3, seg: 5 })
    else desk(k, g, [.65, 0, .7], s.main, .9)
  }
  block(k, g, [.9, .35, .45], s.accent, [.65, 0, .7], { round: .08 })
}

export function plants(c: Context) {
  const { k, s } = c
  const g = furnishing(c, `plants-${s.variant}`)
  desk(k, g, [0, 0, -1], s.main, 2.6)
  for (const x of [-.95, 0, .95]) potted(k, g, [x, .84, -1], s, s.variant === 'flowers', .7)
  for (const x of [-.85, .85]) potted(k, g, [x, 0, .65], s, s.variant === 'flowers', 1.3)
  if (s.variant === 'hanging') {
    const p = group(g, [0, 1.45, 0])
    tube(k, p, .025, .75, '#b99b6c', [0, .05, 0])
    potted(k, p, [0, 0, 0], s, false, .6)
    for (let i = 0; i < 8; i++) ball(k, p, .13, s.accent, [Math.sin(i * .8) * .23, .1 - i * .15, .1], { scale: [1, .5, 1] })
  }
}
