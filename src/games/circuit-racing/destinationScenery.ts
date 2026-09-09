import * as THREE from 'three'
import type { CircuitDefinition } from './circuit'
import type { SceneryWriter } from './sceneryDetails'

/** Destination landmarks share the existing opaque, static shape batches. */
export function addDestinationScenery(circuit: CircuitDefinition, { part, place }: SceneryWriter) {
  const world = new THREE.Matrix4()
  if (circuit.scenery === 'city') {
    // The route's southern straight crosses a shallow canal. The bridge deck
    // stays BELOW the driving surface; its towers and rails stay outside it.
    part(world, 'box', '#6e9fa7', 0, -0.13, -78, 30, 0.08, 82)
    part(world, 'box', '#64c0d4', 0, -0.075, -78, 24, 0.025, 82)
    part(world, 'box', '#b7c6ca', 0, -0.025, -78, 38, 0.025, 16)
    for (const side of [-1, 1]) {
      const z = -78 + side * 9
      part(world, 'box', '#e8e5d8', 0, 0.7, z, 42, 1.4, 1)
      part(world, 'box', '#df6a51', 0, 3, z, 40, 0.45, 0.5)
      for (const x of [-18, 18]) {
        part(world, 'box', '#e8e5d8', x, 6.5, z, 1.6, 13, 1.6)
        part(world, 'cone', '#df6a51', x, 14, z, 3, 2, 3)
      }
      for (let x = -15; x <= 15; x += 5) {
        const height = 5 + Math.abs(x) * 0.35
        part(world, 'box', '#f4e5bc', x, 3 + height / 2, z, 0.25, height, 0.25)
        // Stepped suspension silhouette, readable even from the overview.
        part(world, 'box', '#df6a51', x, 3 + height, z, 5.2, 0.35, 0.45)
      }
    }
    // Short covered section on the eastern straight, with open portals and
    // generous clearance for every vehicle. No opaque wall across the road.
    for (let z = -12; z <= 12; z += 6) {
      for (const side of [-1, 1]) {
        part(world, 'box', '#899fae', 150 + side * 9, 5, z, 1.4, 10, 6)
        part(world, 'box', '#f2ce70', 150 + side * 8.25, 3.5, z, 0.12, 0.6, 4.5)
      }
      part(world, 'box', '#9aafba', 150, 10.5, z, 20, 1, 6)
      part(world, 'box', '#fff0b0', 150, 9.92, z, 3, 0.12, 1)
    }
    for (const z of [-15.4, 15.4]) {
      part(world, 'box', '#e4e8dd', 150, 11, z, 21, 2, 0.8)
      part(world, 'box', '#44aab3', 150, 11.1, z, 9, 0.65, 0.94)
    }
    for (let i = 0; i < 15; i++) {
      place((i + 0.2) / 15, 11, (m) => {
        const height = 12 + (i % 4) * 7
        const color = ['#79aabb', '#e5c5a1', '#8394b6', '#a8c9c9'][i % 4]!
        part(m, 'box', '#d3d7cb', 0, 0.1, 0, 14, 0.6, 14)
        part(m, 'box', color, 0, height / 2 + 0.4, 0, 10, height, 10)
        part(m, 'box', '#eaf0e5', 0, height + 0.8, 0, 11, 0.8, 11)
        part(m, 'box', '#667b8b', 2, height + 1.8, 1, 3, 1.3, 3)
        for (let y = 3; y < height; y += 4) {
          for (const side of [-1, 1]) {
            part(m, 'box', '#d2eff0', side * 5.08, y, 0, 0.16, 1.7, 8)
            part(m, 'box', '#d2eff0', 0, y, side * 5.08, 8, 1.7, 0.16)
          }
        }
        part(m, 'box', '#4d6c81', -5.12, 1.8, 0, 0.2, 2.8, 2.2)
        part(m, 'box', '#efb44f', -5.7, 3.4, 0, 1.6, 0.35, 7)
      }, i % 3 === 0 ? -1 : 1, 'building')
    }
    for (let i = 0; i < 12; i++) place((i + 0.5) / 12, 3.5, (m) => {
      part(m, 'cylinder', '#566e7d', 0, 4, 0, 0.3, 8, 0.3)
      part(m, 'box', '#566e7d', -1, 8, 0, 2.3, 0.25, 0.3)
      part(m, 'box', '#fff0b3', -2, 7.8, 0, 1.2, 0.4, 0.9)
      part(m, 'box', '#e58264', 0.25, 5.8, 0, 0.12, 2, 1.4)
    }, 1, 'streetlight')
  } else if (circuit.scenery === 'coast') {
    // A continuous sea beside the eastern coastline, not a small inland pond.
    part(world, 'box', '#eddb9c', 170, -0.09, 0, 20, 0.12, 630)
    part(world, 'box', '#49bed0', 187, -0.075, 0, 14, 0.1, 630)
    part(world, 'box', '#309ec7', 257, -0.09, 0, 126, 0.12, 630)
    for (let i = 0; i < 22; i++) {
      part(world, 'box', '#b8eff0', 183 + (i % 3) * 2.5, 0.005, (i - 10.5) * 25,
        0.45, 0.025, 9 + (i % 3) * 3)
    }
    place(0.28, 12, (m) => {
      part(m, 'cylinder', '#e2d7b5', 0, 0.2, 0, 18, 0.8, 18)
      part(m, 'cylinder', '#f8efda', 0, 2, 0, 9, 3, 9)
      for (let band = 0; band < 6; band++) {
        part(m, 'cylinder', band % 2 ? '#e26955' : '#fff2d8', 0, 5 + band * 3, 0,
          6 - band * 0.35, 3, 6 - band * 0.35)
      }
      part(m, 'cylinder', '#536d80', 0, 22, 0, 7.5, 0.65, 7.5)
      part(m, 'cylinder', '#ffe9a1', 0, 23.7, 0, 4.5, 2.8, 4.5)
      for (const x of [-2, 2]) for (const z of [-1, 1]) {
        part(m, 'box', '#536d80', x, 23.7, z, 0.25, 3, 0.25)
      }
      part(m, 'cone', '#d85d4e', 0, 26, 0, 7, 2.5, 7)
      part(m, 'box', '#536d80', -4.55, 1.8, 0, 0.16, 2.5, 1.6)
    }, 1, 'lighthouse')
    for (let i = 0; i < 9; i++) place((i + 0.3) / 9, 7, (m) => {
      part(m, 'cylinder', '#eed9a0', 0, -0.1, 0, 12, 0.1, 12)
      part(m, 'cylinder', '#aa815a', 0, 4, 0, 0.8, 8, 0.8)
      for (let leaf = 0; leaf < 5; leaf++) {
        const local = m.clone().multiply(new THREE.Matrix4().makeRotationY(leaf * Math.PI * 2 / 5))
        part(local, 'sphere', leaf % 2 ? '#43976c' : '#62ad70', 2, 7.8, 0, 5.4, 0.7, 1.7, -0.22)
      }
      part(m, 'sphere', '#aa815a', 0, 7.5, 0, 1.4, 1.4, 1.4)
    }, i % 2 ? -1 : 1, 'palm')
    for (let i = 0; i < 5; i++) place((i + 0.6) / 5, 9, (m) => {
      part(m, 'cylinder', '#eddb9c', 0, -0.08, 0, 16, 0.16, 15)
      part(m, 'cylinder', '#e8e0c1', 0, 2.1, 0, 0.2, 4.2, 0.2)
      part(m, 'cone', i % 2 ? '#f1ad54' : '#58baca', 0, 4.4, 0, 8, 1.9, 8)
      for (const z of [-3, 3]) {
        part(m, 'box', '#f8f0d6', 0, 0.6, z, 4, 0.35, 1.5)
        part(m, 'box', '#ea8c73', 1.5, 1, z, 0.4, 1.2, 1.5, -0.35)
      }
    }, -1, 'beach')
    for (let i = 0; i < 3; i++) {
      const boat = new THREE.Matrix4().makeTranslation(219 + i * 27, 0, -110 + i * 95)
      part(boat, 'sphere', '#f5edda', 0, 0.4, 0, 5, 2, 12)
      part(boat, 'box', '#ec9b5a', 0, 1.1, 0, 3, 0.5, 7)
      part(boat, 'cylinder', '#f6edce', 0, 6, 0, 0.25, 10, 0.25)
      part(boat, 'cone', '#fff4db', 0, 7, 0, 0.25, 7, 7)
    }
  }
}
