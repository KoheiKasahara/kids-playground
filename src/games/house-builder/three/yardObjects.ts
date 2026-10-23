// にわの はたけ・みずあそび・やすむ ばしょ。どれも layout の しかくの なかに おさめる。
import * as THREE from 'three'
import type { PoolId } from '../data'
import type { Box2 } from '../layout3d'
import { Kit, ball, block, group, mesh, tube, type Tick } from './kit'

type YardContext = { k: Kit; root: THREE.Group; ticks: Tick[] }

function plotGroup(parent: THREE.Object3D, box: Box2, name: string) {
  const g = group(parent, [(box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2])
  g.name = name
  return { g, w: box.maxX - box.minX, d: box.maxZ - box.minZ }
}

/** うねの あいだに みちが ある、にんじん・トマト・キャベツ / いちごの はたけ。 */
export function gardenPlot(k: Kit, parent: THREE.Object3D, box: Box2, strawberries: boolean) {
  const { g, w, d } = plotGroup(parent, box, strawberries ? 'strawberries' : 'veggies')
  block(k, g, [w, .18, d], '#bd956d', [0, 0, 0], { round: .06 })
  for (let row = 0; row < 3; row++) {
    const z = -d / 2 + .5 + row * (d - 1) / 2
    block(k, g, [w - .3, .16, .58], '#6d4935', [0, .18, z], { round: .1 })
    for (let i = 0; i < 5; i++) {
      const x = -w / 2 + .45 + i * (w - .9) / 4
      if (strawberries) {
        for (const side of [-1, 0, 1]) ball(k, g, .14, '#388e3c', [x + side * .11, .45, z], { scale: [1, .35, 1], noShadow: true })
        const fruit = ball(k, g, .11, '#ef3154', [x, .4, z + .17], { scale: [.85, 1.2, .85], noShadow: true })
        fruit.name = 'strawberry'
        for (const dx of [-.04, .04]) ball(k, g, .014, '#ffe08a', [x + dx, .42, z + .255], { noShadow: true, seg: 6 })
        ball(k, g, .045, '#fff8e1', [x + .12, .5, z - .1], { noShadow: true })
      } else if (row === 0) {
        tube(k, g, .025, .7, '#b58b57', [x, .32, z], { seg: 6, noShadow: true })
        for (const side of [-1, 1]) {
          ball(k, g, .13, '#4a9d42', [x + side * .1, .73, z], { scale: [1, .45, 1], noShadow: true })
          ball(k, g, .12, '#ef473a', [x + side * .11, .58, z + .1], { noShadow: true })
        }
      } else if (row === 1) {
        g.add(mesh(k, k.cyl(.09, .02, .24, 9), '#ff8b25', [x, .4, z], { noShadow: true }))
        for (const side of [-1, 0, 1]) g.add(mesh(k, k.cyl(0, .08, .3, 6), '#4b9e36', [x + side * .05, .61, z], { rot: [0, 0, side * .3], noShadow: true }))
      } else {
        ball(k, g, .2, '#9ecb50', [x, .47, z], { scale: [1, .8, 1], noShadow: true })
        for (const side of [-1, 1]) ball(k, g, .14, '#75ae42', [x + side * .12, .44, z + .04], { scale: [.7, .7, 1], noShadow: true })
      }
    }
  }
}

export function orchard(k: Kit, parent: THREE.Object3D, box: Box2) {
  const { g, w, d } = plotGroup(parent, box, 'orchard')
  block(k, g, [w, .06, d], '#86b958', [0, .02, 0], { round: .14, noShadow: true })
  for (let i = 0; i < 2; i++) {
    const x = (i ? 1 : -1) * w * .24
    tube(k, g, .12, 1.2, '#9b704b', [x, .08, -.25], { top: .08 })
    ball(k, g, .72, i ? '#70ae42' : '#4d9b4a', [x, 1.55, -.25], { scale: [1, 1.05, 1] })
    for (const [dx, dy, dz] of [[-.32, 1.6, .33], [.27, 1.85, .15], [.35, 1.35, .2], [-.22, 1.9, -.2]] as const) {
      const fruit = ball(k, g, .14, i ? '#ffac28' : '#e84b40', [x + dx, dy, -.25 + dz], { noShadow: true })
      fruit.name = i ? 'orange' : 'apple'
      ball(k, g, .05, '#3a7b37', [x + dx + .025, dy + .14, -.25 + dz], { scale: [1.5, .3, 1], noShadow: true })
    }
  }
  block(k, g, [.55, .25, .45], '#c18a45', [0, .08, d / 2 - .45], { round: .03 })
  for (const x of [-.15, .12]) ball(k, g, .12, '#ef5544', [x, .36, d / 2 - .45], { noShadow: true })
}

export function swimmingPool(c: YardContext, box: Box2, id: Exclude<PoolId, 'none'>) {
  const { k, root, ticks } = c
  const { g, w, d } = plotGroup(root, box, `pool-${id}`)
  const water = k.mat('#43c9ec', { rough: .12, metal: .15, emissive: '#1eaed1', glow: .2 })
  const waterY = id === 'round' ? .49 : .43
  let surface: THREE.Mesh
  if (id === 'round') {
    const r = Math.min(w, d) / 2 - .2
    tube(k, g, r, .45, '#54b7df', [0, .02, 0], { seg: 40 })
    g.add(mesh(k, k.torus(r - .08, .16, Math.PI * 2, 40), '#fff082', [0, .47, 0], { rot: [Math.PI / 2, 0, 0] }))
    surface = mesh(k, k.circle(r - .23, 40), water, [0, waterY, 0], { rot: [-Math.PI / 2, 0, 0], noShadow: true })
    for (const y of [.14, .3]) g.add(mesh(k, k.torus(r + .005, .022, Math.PI * 2, 40), '#d0f0ff', [0, y, 0], { rot: [Math.PI / 2, 0, 0], noShadow: true }))
  } else {
    block(k, g, [w - .1, .4, d - .1], '#f1e8d6', [0, .02, 0], { round: .16 })
    surface = mesh(k, k.plane(w - .7, d - .7), water, [0, waterY, 0], { rot: [-Math.PI / 2, 0, 0], noShadow: true })
    for (const z of [-1, 1]) block(k, g, [w - .1, .1, .27], '#fff9ee', [0, .42, z * (d / 2 - .18)], { round: .04 })
    for (const x of [-1, 1]) block(k, g, [.27, .1, d - .5], '#fff9ee', [x * (w / 2 - .18), .42, 0], { round: .04 })
    for (const x of [-.32, .32]) {
      tube(k, g, .035, .8, '#e5eef2', [x, .18, d / 2 - .52], { seg: 10 })
      g.add(mesh(k, k.torus(.13, .035, Math.PI, 16), '#e5eef2', [x, .98, d / 2 - .65], { rot: [0, Math.PI / 2, 0] }))
    }
    for (const y of [.28, .55]) block(k, g, [.64, .04, .15], '#b8d0db', [0, y, d / 2 - .52], { noShadow: true })
  }
  surface.name = 'pool-water'
  g.add(surface)
  const float = group(g, [-.55, waterY + .06, .1])
  float.add(mesh(k, k.torus(.32, .1, Math.PI * 2, 24), '#ff8a8e', [0, 0, 0], { rot: [Math.PI / 2, 0, 0] }))
  for (let i = 0; i < 3; i++) g.add(mesh(k, k.torus(.18 + i * .1, .012, Math.PI * 1.35, 28), '#d8fbff', [.6, waterY + .015, -.45], { rot: [-Math.PI / 2, 0, .3], noShadow: true }))
  ball(k, g, .2, '#fff17a', [.55, waterY + .17, .55], { noShadow: true })
  ticks.push((time) => { float.position.y = waterY + .06 + Math.sin(time / 800) * .025; float.rotation.y = Math.sin(time / 1600) * .12 })
}

export function picnic(k: Kit, parent: THREE.Object3D, box: Box2) {
  const { g } = plotGroup(parent, box, 'picnic')
  for (const x of [-.65, .65]) for (const z of [-.3, .3]) block(k, g, [.1, .78, .1], '#8b6243', [x, 0, z])
  block(k, g, [1.9, .12, .9], '#d2a56f', [0, .78, 0], { round: .05 })
  for (const z of [-.85, .85]) {
    block(k, g, [2, .1, .38], '#d2a56f', [0, .42, z], { round: .04 })
    for (const x of [-.65, .65]) block(k, g, [.12, .42, .25], '#8b6243', [x, 0, z])
  }
  tube(k, g, .04, 2.35, '#e3d4b1', [0, .85, 0])
  for (let i = 0; i < 8; i++) {
    const canopy = k.custom(`umbrella-${i}`, () => new THREE.CylinderGeometry(0, 1.25, .55, 1, 1, false, i * Math.PI / 4, Math.PI / 4))
    g.add(mesh(k, canopy, k.mat(i % 2 ? '#fff5df' : '#ff925d', { side: THREE.DoubleSide }), [0, 2.65, 0]))
  }
  tube(k, g, .08, .15, '#81d5de', [.5, .9, .15], { noShadow: true })
  tube(k, g, .18, .025, '#ffffff', [-.45, .9, .1], { noShadow: true })
  ball(k, g, .09, '#eb6651', [-.45, 1.01, .1], { noShadow: true })
}

export function fountain(c: YardContext, box: Box2) {
  const { k, root, ticks } = c
  const { g, w, d } = plotGroup(root, box, 'fountain')
  const r = Math.min(w, d) / 2 - .1
  const stone = '#d9d3bd'
  const water = k.mat('#76d8ed', { rough: .15, emissive: '#30b7d2', glow: .15 })
  tube(k, g, r, .22, stone, [0, .02, 0], { seg: 32 })
  tube(k, g, r - .18, .035, water, [0, .24, 0], { seg: 32, noShadow: true })
  g.add(mesh(k, k.torus(r - .08, .1, Math.PI * 2, 32), stone, [0, .28, 0], { rot: [Math.PI / 2, 0, 0] }))
  tube(k, g, .18, .85, stone, [0, .25, 0], { top: .12 })
  tube(k, g, .3, .22, stone, [0, 1.02, 0], { top: .54, seg: 24 })
  tube(k, g, .48, .025, water, [0, 1.24, 0], { seg: 24, noShadow: true })
  tube(k, g, .04, .48, water, [0, 1.26, 0], { noShadow: true })
  ball(k, g, .085, water, [0, 1.76, 0], { noShadow: true })
  const drops: THREE.Mesh[] = []
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 1.65, 0), new THREE.Vector3(Math.cos(angle) * .65, 1.8, Math.sin(angle) * .65), new THREE.Vector3(Math.cos(angle) * .85, .3, Math.sin(angle) * .85))
    const stream = k.custom(`fountain-stream-${i}`, () => new THREE.TubeGeometry(curve, 16, .018, 6, false))
    g.add(mesh(k, stream, water, [0, 0, 0], { noShadow: true }))
    drops.push(ball(k, g, .045, '#c5f7ff', [0, 0, 0], { noShadow: true }))
    ticks.push((time) => { drops[i].position.copy(curve.getPoint((time / 1100 + i / 6) % 1)) })
  }
}
