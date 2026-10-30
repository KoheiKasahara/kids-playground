// キャンプと あそびば。よやくした にわの しかくの なかに つくる。
import * as THREE from 'three'
import type { OutdoorExtraId } from '../data'
import type { Box2 } from '../layout3d'
import { Kit, ball, block, group, mesh, tube } from './kit'

function triangle(k: Kit, w: number, h: number) {
  return k.custom(`tent-face-${w}-${h}`, () => {
    const shape = new THREE.Shape()
    shape.moveTo(-w / 2, 0)
    shape.lineTo(w / 2, 0)
    shape.lineTo(0, h)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  })
}

export function outdoorObject(k: Kit, parent: THREE.Object3D, box: Box2, id: OutdoorExtraId) {
  const g = group(parent, [(box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2])
  g.name = id
  switch (id) {
    case 'seesaw': {
      tube(k, g, .5, .7, '#6ca7ad', [0, 0, 0], { top: .12, seg: 3 })
      const plank = group(g, [0, .78, 0])
      plank.rotation.z = -.18
      block(k, plank, [2.8, .12, .42], '#e8b75e', [0, 0, 0], { round: .04 })
      for (const x of [-1.05, 1.05]) {
        block(k, plank, [.45, .08, .5], '#db7c78', [x, .12, 0], { round: .06 })
        tube(k, plank, .035, .42, '#db7c78', [x * .75, .12, 0])
        block(k, plank, [.06, .06, .44], '#db7c78', [x * .75, .52, 0])
      }
      break
    }
    case 'trampoline': {
      const metal = '#778b9d'
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = Math.cos(a) * 1.3, z = Math.sin(a) * 1.3
        tube(k, g, .035, 2.05, metal, [x, .02, z])
      }
      tube(k, g, 1.25, .06, '#374b5d', [0, .48, 0], { seg: 32 })
      g.add(mesh(k, k.torus(1.28, .09), '#6db6b5', [0, .54, 0], { rot: [Math.PI / 2, 0, 0] }))
      const net = k.mat('#a5cbcc', { opacity: .18, side: THREE.DoubleSide })
      g.add(mesh(k, k.cyl(1.3, 1.3, 1.5, 32, true), net, [0, 1.3, 0], { noShadow: true }))
      for (const y of [.7, 1.1, 1.5, 2.05]) g.add(mesh(k, k.torus(1.3, .012), '#83a5ad', [0, y, 0], { rot: [Math.PI / 2, 0, 0], noShadow: true }))
      break
    }
    case 'playhouse': {
      block(k, g, [2.2, .12, 2.3], '#c6a174', [0, 0, 0])
      block(k, g, [2.1, 1.5, .12], '#f6dca5', [0, .12, -1.05])
      for (const x of [-1, 1]) {
        block(k, g, [.12, 1.5, 2.1], '#f6dca5', [x, .12, 0])
        block(k, g, [.61, 1.5, .12], '#f6dca5', [x * .75, .12, 1.05])
        block(k, g, [.42, .45, .04], '#b9e2e8', [x * .76, .9, 1.12])
        block(k, g, [.5, .06, .09], '#ffffff', [x * .76, .86, 1.13])
      }
      block(k, g, [.9, .35, .12], '#f6dca5', [0, 1.27, 1.05])
      block(k, g, [.85, 1.1, .06], '#7fb1b6', [0, .12, 1.09], { round: .08 })
      ball(k, g, .05, '#f7d76c', [.28, .67, 1.14])
      for (const x of [-.61, .61]) g.add(mesh(k, k.box(1.45, .12, 2.6), '#dd8c81', [x, 1.96, 0], { rot: [0, 0, x < 0 ? .5 : -.5] }))
      break
    }
    case 'basketball': {
      block(k, g, [2.9, .03, 3], '#cce0bc', [0, .01, 0])
      for (const x of [-1.35, 1.35]) block(k, g, [.025, .012, 2.8], '#ffffff', [x, .04, 0])
      block(k, g, [2.7, .012, .025], '#ffffff', [0, .04, 1.4])
      tube(k, g, .065, 2.65, '#738994', [0, .04, -1.1])
      block(k, g, [1.6, .95, .08], '#eff6f3', [0, 2, -.95])
      for (const x of [-.32, .32]) block(k, g, [.035, .4, .015], '#da8466', [x, 2.15, -.9])
      for (const y of [2.15, 2.55]) block(k, g, [.67, .035, .015], '#da8466', [0, y, -.9])
      g.add(mesh(k, k.torus(.32, .035), '#e18c62', [0, 2.15, -.5], { rot: [Math.PI / 2, 0, 0] }))
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4
        tube(k, g, .012, .4, '#d5cdb6', [Math.cos(a) * .26, 1.75, -.5 + Math.sin(a) * .26])
      }
      ball(k, g, .24, '#ebaa60', [.85, .29, .85])
      for (const rot of [[0, 0, 0], [0, Math.PI / 2, 0]] as const) g.add(mesh(k, k.torus(.241, .008), '#a56c40', [.85, .29, .85], { rot }))
      break
    }
    case 'flowerarch': {
      for (const x of [-1, 1]) {
        block(k, g, [.13, 1.65, .15], '#baa17a', [x, .03, 0])
        block(k, g, [.4, .12, .7], '#baa17a', [x, 0, 0])
      }
      g.add(mesh(k, k.torus(1, .08, Math.PI), '#baa17a', [0, 1.65, 0]))
      for (let i = 0; i < 15; i++) {
        const a = i / 14 * Math.PI
        const x = Math.cos(a), y = 1.65 + Math.sin(a)
        ball(k, g, .15, '#6fa477', [x, y, 0])
        if (i % 2 === 0) {
          ball(k, g, .13, '#df94ad', [x, y, .13])
          ball(k, g, .05, '#f6d976', [x, y, .24])
        }
      }
      for (const x of [-1, 1]) for (const y of [.4, .8, 1.2]) ball(k, g, .17, '#6fa477', [x, y, 0], { scale: [1, 1.5, 1] })
      break
    }
    case 'bench': {
      for (const x of [-1, 1]) for (const z of [-.3, .3]) block(k, g, [.1, .6, .1], '#5d7975', [x, 0, z])
      for (const z of [-.25, 0, .25]) block(k, g, [2.5, .1, .22], '#dfb78b', [0, .6, z], { round: .02 })
      for (const x of [-1, 1]) {
        block(k, g, [.08, .7, .08], '#5d7975', [x, .6, -.3])
        block(k, g, [.12, .08, .75], '#5d7975', [x, .88, 0], { round: .03 })
      }
      for (const y of [.9, 1.15]) block(k, g, [2.5, .18, .07], '#c49b6f', [0, y, -.3], { round: .02 })
      break
    }
    case 'bbq': {
      for (const x of [-.95, -.05]) for (const z of [-.35, .35]) block(k, g, [.07, .75, .07], '#75868c', [x, 0, z])
      block(k, g, [1.35, .38, 1.1], '#d9806c', [-.5, .7, 0], { round: .15 })
      block(k, g, [1.2, .04, .95], '#414a4f', [-.5, 1.08, 0])
      for (let i = 0; i < 9; i++) block(k, g, [.025, .025, .95], '#bfc7c4', [-1.03 + i * .13, 1.12, 0])
      for (const z of [-.2, .2]) block(k, g, [.28, .07, .16], '#e7a46e', [-.5, 1.15, z], { round: .04 })
      for (const x of [.6, 1.3]) for (const z of [-.35, .35]) block(k, g, [.07, .85, .07], '#a0815b', [x, 0, z])
      block(k, g, [.9, .08, 1], '#d4ae79', [.95, .85, 0])
      tube(k, g, .2, .025, '#f8ead6', [.95, .93, 0])
      break
    }
    case 'birdhouse': {
      block(k, g, [.65, .12, .65], '#bc9669', [0, 0, 0], { round: .03 })
      tube(k, g, .07, 1.8, '#bc9669', [0, .12, 0])
      block(k, g, [.85, .7, .7], '#f4dda4', [0, 1.7, 0])
      for (const x of [-.25, .25]) g.add(mesh(k, k.box(.62, .08, .9), '#7ca897', [x, 2.53, 0], { rot: [0, 0, x < 0 ? .5 : -.5] }))
      g.add(mesh(k, k.circle(.16), '#655344', [0, 2.08, .356]))
      block(k, g, [.07, .07, .4], '#b69565', [0, 1.85, .45])
      ball(k, g, .14, '#dfb86a', [0, 1.99, .48], { scale: [1, 1, 1.3] })
      ball(k, g, .1, '#dfb86a', [0, 2.12, .59])
      ball(k, g, .018, '#444b4d', [.075, 2.14, .63])
      tube(k, g, .05, .12, '#dc8a59', [0, 2.07, .73], { top: 0, rot: [Math.PI / 2, 0, 0] })
      break
    }
    case 'greenhouse': {
      block(k, g, [2.5, .12, 2.8], '#bcaa83', [0, 0, 0])
      const glass = k.mat('#b9e4d8', { opacity: .22, side: THREE.DoubleSide })
      for (const x of [-1.2, 1.2]) {
        block(k, g, [.035, 1.65, 2.6], glass, [x, .12, 0], { noShadow: true })
        for (const z of [-1.3, 0, 1.3]) block(k, g, [.055, 1.65, .055], '#84b19c', [x, .12, z])
        for (const y of [.12, 1, 1.77]) block(k, g, [.055, .055, 2.65], '#84b19c', [x, y, 0])
        g.add(mesh(k, k.box(1.4, .04, 2.7), glass, [x / 2, 2.08, 0], { rot: [0, 0, x < 0 ? .5 : -.5], noShadow: true }))
      }
      for (const z of [-1.3, 1.3]) {
        for (const x of [-.4, .4]) block(k, g, [.055, 1.65, .055], '#84b19c', [x, .12, z])
        block(k, g, [2.4, 1.65, .035], glass, [0, .12, z], { noShadow: true })
        for (const x of [-.6, .6]) g.add(mesh(k, k.box(1.4, .06, .06), '#84b19c', [x, 2.08, z], { rot: [0, 0, x < 0 ? .5 : -.5] }))
      }
      block(k, g, [.06, .06, 2.7], '#84b19c', [0, 2.4, 0])
      for (const x of [-.8, .8]) for (const z of [-.8, 0, .8]) {
        tube(k, g, .2, .35, '#c89970', [x, .12, z], { top: .26 })
        tube(k, g, .025, .65, '#64a177', [x, .47, z])
        for (const y of [.7, .95]) ball(k, g, .2, '#64a177', [x, y, z], { scale: [1, .4, 1] })
      }
      block(k, g, [.06, .06, .05], '#bc996c', [.27, .9, 1.34])
      break
    }
    case 'yardlights': {
      const glow = k.mat('#ffe2a0', { emissive: '#ffc761', glow: .9 })
      for (const [x, z, h] of [[-.8, -.6, 1.6], [.8, .6, 1.1]]) {
        tube(k, g, .3, .08, '#617a78', [x, 0, z])
        tube(k, g, .045, h, '#617a78', [x, .08, z])
        block(k, g, [.4, .5, .4], glow, [x, h, z], { round: .02 })
        for (const dx of [-.22, .22]) for (const dz of [-.22, .22]) block(k, g, [.035, .55, .035], '#617a78', [x + dx, h - .02, z + dz])
        tube(k, g, .36, .3, '#617a78', [x, h + .5, z], { top: 0, seg: 4, rot: [0, Math.PI / 4, 0] })
        g.add(mesh(k, k.torus(.13, .025, Math.PI), '#617a78', [x, h + .8, z]))
      }
      break
    }
    case 'tent': {
      block(k, g, [2.7, .08, 2.6], '#576f62', [0, .02, 0], { round: .05 })
      const roof = k.custom('camp-tent', () => {
        const shape = new THREE.Shape()
        shape.moveTo(-1.3, 0)
        shape.lineTo(1.3, 0)
        shape.lineTo(0, 1.85)
        shape.closePath()
        return new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false })
      })
      g.add(mesh(k, roof, '#efaa45', [0, .1, -1.2]))
      g.add(mesh(k, triangle(k, 1.45, 1.45), '#344b54', [0, .11, 1.21]))
      block(k, g, [.72, .06, .55], '#9dccbc', [0, .1, 1.25], { round: .04 })
      for (const z of [-1.24, 1.24]) tube(k, g, .035, 2.05, '#f6e5c6', [0, .1, z])
      break
    }
    case 'teepee': {
      tube(k, g, 1.3, 2.3, '#f4e0b5', [0, .06, 0], { top: 0, seg: 8 })
      g.add(mesh(k, triangle(k, 1, 1.45), '#735749', [0, .07, 1.21], { rot: [-.32, 0, 0] }))
      for (const x of [-.14, 0, .14]) tube(k, g, .035, .65, '#957047', [x, 2.05, 0], { rot: [0, 0, x * 2] })
      // すその いろつき もよう。
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4
        ball(k, g, .14, i % 2 ? '#5faeae' : '#dc8762', [Math.sin(a) * 1.1, .38, Math.cos(a) * 1.1], { noShadow: true })
      }
      break
    }
    case 'gazebo': {
      block(k, g, [2.8, .18, 2.8], '#cda878', [0, 0, 0], { round: .04 })
      for (const x of [-1.1, 1.1]) for (const z of [-1.1, 1.1]) block(k, g, [.14, 2.1, .14], '#ac8159', [x, .18, z])
      const roof = k.custom('gazebo-roof', () => new THREE.CylinderGeometry(0, 2.05, .85, 4).rotateY(Math.PI / 4))
      g.add(mesh(k, roof, '#67a38d', [0, 2.65, 0]))
      block(k, g, [1.95, .12, .45], '#a77b52', [0, .65, -.85], { round: .03 })
      for (const x of [-.7, .7]) block(k, g, [.12, .47, .35], '#8a6345', [x, .18, -.85])
      block(k, g, [1.95, .38, .1], '#ba9063', [0, .85, -1.03])
      break
    }
    case 'slide': {
      for (const x of [-.5, .5]) for (const z of [-1, -.4]) block(k, g, [.1, 1.5, .1], '#5d9cbb', [x, .03, z])
      block(k, g, [1.12, .12, .8], '#ffd36a', [0, 1.45, -.7], { round: .03 })
      for (const x of [-.55, .55]) {
        block(k, g, [.08, .65, .08], '#5d9cbb', [x, 1.5, -.85])
        block(k, g, [.08, .08, .7], '#5d9cbb', [x, 2.1, -.7])
        block(k, g, [.09, 1.55, .09], '#5d9cbb', [x, .02, -1.2])
      }
      for (let i = 1; i <= 4; i++) block(k, g, [1, .07, .25], '#ffd36a', [0, i * .34, -1.2])
      g.add(mesh(k, k.box(.88, .08, 2.2), '#f58470', [0, .86, .45], { rot: [.65, 0, 0] }))
      for (const x of [-.48, .48]) g.add(mesh(k, k.box(.09, .22, 2.25), '#ffd36a', [x, .95, .45], { rot: [.65, 0, 0] }))
      block(k, g, [1.1, .12, .45], '#f58470', [0, .12, 1.4], { round: .04 })
      break
    }
    case 'sandbox': {
      block(k, g, [2.7, .16, 2.5], '#ecd192', [0, .02, 0], { round: .08 })
      for (const x of [-1.35, 1.35]) block(k, g, [.15, .32, 2.7], '#bc8655', [x, .02, 0], { round: .03 })
      for (const z of [-1.25, 1.25]) block(k, g, [2.7, .32, .15], '#bc8655', [0, .02, z], { round: .03 })
      block(k, g, [.8, .36, .65], '#d9b96f', [-.35, .18, -.3])
      for (const x of [-.7, 0]) for (const z of [-.6, 0]) tube(k, g, .15, .5, '#e7c983', [x, .18, z], { seg: 12 })
      tube(k, g, .22, .34, '#ed7765', [.65, .18, .4], { top: .28 })
      g.add(mesh(k, k.torus(.24, .025, Math.PI, 16), '#ffe07f', [.65, .52, .4]))
      block(k, g, [.07, .06, .55], '#5eacc3', [.2, .2, .65])
      block(k, g, [.22, .06, .25], '#5eacc3', [.2, .2, .95], { round: .05 })
      break
    }
    case 'hammock': {
      for (const x of [-1.3, 1.3]) {
        block(k, g, [.16, 1.65, .16], '#a37a50', [x, .05, 0])
        block(k, g, [.35, .12, 1.5], '#a37a50', [x, .02, 0], { round: .05 })
      }
      const cloth = k.custom('hammock-cloth', () => {
        const geo = new THREE.PlaneGeometry(2.5, 1, 20, 1)
        const pos = geo.attributes.position
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getY(i)
          pos.setXYZ(i, x, .6 + .58 * x * x, z)
        }
        geo.computeVertexNormals()
        return geo
      })
      g.add(mesh(k, cloth, k.mat('#77c8c3', { side: THREE.DoubleSide }), [0, 0, 0]))
      for (const z of [-.5, .5]) {
        const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-1.25, 1.5, z), new THREE.Vector3(0, -.3, z), new THREE.Vector3(1.25, 1.5, z))
        const rope = k.custom(`hammock-rope-${z}`, () => new THREE.TubeGeometry(curve, 20, .025, 6, false))
        g.add(mesh(k, rope, '#fff1c9', [0, 0, 0]))
      }
      block(k, g, [.35, .12, .7], '#fff1c9', [-.78, .98, 0], { round: .06, rot: [0, 0, -.55] })
      break
    }
  }
}
