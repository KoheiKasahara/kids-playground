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
