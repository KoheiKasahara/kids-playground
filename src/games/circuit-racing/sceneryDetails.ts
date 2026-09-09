import type * as THREE from 'three'
import type { CircuitDefinition } from './circuit'

export type SceneryShape = 'box' | 'cone' | 'sphere' | 'cylinder' | 'ring'
export type SceneryWriter = {
  part: (parent: THREE.Matrix4, shape: SceneryShape, color: string,
    x: number, y: number, z: number, sx: number, sy: number, sz: number, rz?: number) => void
  place: (t: number, radius: number, build: (matrix: THREE.Matrix4) => void,
    side?: number, kind?: string) => void
}

/** Everything joins the existing shape batches: no loaders, textures or animation. */
export function addCircuitDetails(circuit: CircuitDefinition, { part, place }: SceneryWriter) {
  const alpine = circuit.scenery === 'alpine'
  const forest = circuit.scenery === 'forest'
  const festive = ['#eb665c', '#ffd05a', '#53a8d0', '#a681ce']
  const grass = alpine ? '#acae79' : forest ? '#8cba65' : '#a1c96e'

  function pond(m: THREE.Matrix4) {
    // Opaque, shallow color plates suggest water without reflections or overdraw.
    part(m, 'cylinder', alpine ? '#d5cbb2' : '#c6cf8b', 0, -0.08, 0, 25, 0.16, 21)
    part(m, 'cylinder', '#50b8d1', 0, 0.03, 0, 22, 0.08, 18)
    part(m, 'cylinder', '#66cadd', -0.8, 0.085, 0.4, 17, 0.025, 13)
    for (let i = 0; i < 3; i++) {
      part(m, 'box', '#bcebee', -4 + i * 3.2, 0.12, (i % 2 ? -1 : 1) * 2.2,
        2.8, 0.025, 0.22)
    }
    for (const side of [-1, 1]) {
      part(m, 'sphere', '#b6bfb0', side * 9.2, 0.55, -5.2, 3.2, 1.8, 2.5)
      for (let reed = 0; reed < 3; reed++) {
        part(m, 'cone', '#67995c', side * (8.7 + reed * 0.7), 0.7 + reed * 0.12,
          4.4, 0.65, 1.8 + reed * 0.24, 0.65)
      }
    }
  }

  function meadow(m: THREE.Matrix4, index: number) {
    // Broad, low facets break up the flat field; the reserved disc contains it all.
    part(m, 'cylinder', grass, 0, -0.14, 0, 28, 0.08, 23)
    part(m, 'sphere', alpine ? '#b8bd86' : '#94bf68', 0, -0.48, 0, 23, 1.35, 18)
    for (let bush = 0; bush < 4; bush++) {
      const x = (bush - 1.5) * 4.2
      const z = bush % 2 ? 4.5 : -4.5
      part(m, 'sphere', bush % 2 ? '#649951' : '#78a95a', x, 0.65, z, 3.8, 1.8, 3)
      part(m, 'sphere', festive[(index + bush) % festive.length]!, x - 0.4, 1.3, z,
        0.65, 0.65, 0.65)
    }
  }

  function cottage(m: THREE.Matrix4, index: number) {
    const wall = alpine ? '#eadac0' : forest ? '#c89b6c' : '#f1e1bb'
    const roof = alpine ? '#637d91' : '#c65e4c'
    part(m, 'box', '#c9c4a8', 0, -0.02, 0, 9, 0.16, 11)
    part(m, 'box', wall, 0, 2, 0, 6.6, 4, 8.6)
    for (const side of [-1, 1]) {
      part(m, 'box', roof, side * 1.8, 4.6, 0, 4, 0.3, 9.8, -side * 0.32)
      for (const z of [-2.5, 2.5]) {
        part(m, 'box', '#f7eecf', side * 3.34, 2.25, z, 0.12, 1.8, 1.8)
        part(m, 'box', '#77bace', side * 3.42, 2.25, z, 0.06, 1.3, 1.3)
      }
    }
    part(m, 'box', '#806451', -3.38, 1.2, 0, 0.18, 2.4, 1.2)
    part(m, 'box', '#e9c56e', -3.49, 1.15, 0.4, 0.06, 0.14, 0.14)
    part(m, 'box', '#a99687', 1.6, 5.25, 2.4, 0.85, 2.3, 0.85)
    part(m, 'box', '#d8ceb2', -5.4, -0.02, 0, 4, 0.14, 2)
    for (const z of [-3.5, 3.5]) {
      part(m, 'box', '#9a7654', -4.2, 0.35, z, 1.1, 0.7, 1.6)
      part(m, 'sphere', festive[index % festive.length]!, -4.2, 0.85, z, 1.3, 0.95, 1.6)
    }
  }

  function pavilion(m: THREE.Matrix4, index: number) {
    const color = festive[index % festive.length]!
    part(m, 'box', '#cfc9b0', 0, -0.04, 0, 10, 0.14, 10)
    for (const x of [-2.7, 2.7]) {
      for (const z of [-2.7, 2.7]) {
        part(m, 'cylinder', '#f3efe2', x, 2, z, 0.25, 4, 0.25)
      }
    }
    part(m, 'cone', color, 0, 5.1, 0, 10, 2.8, 10)
    part(m, 'box', color, -2.4, 1, 0, 1, 2, 5.8)
    part(m, 'box', '#faf1d7', -2.4, 2.05, 0, 1.3, 0.2, 6.2)
    for (const z of [-1.7, 0, 1.7]) {
      part(m, 'cylinder', '#f4d478', -2.4, 2.35, z, 0.5, 0.5, 0.5)
    }
    // Two tiny visitors, not a moving crowd or a separate mesh per person.
    for (const z of [-1.8, 1.8]) {
      part(m, 'cylinder', '#3d647e', -4, 0.7, z, 0.75, 1.4, 0.75)
      part(m, 'sphere', '#efc79e', -4, 1.7, z, 0.7, 0.7, 0.7)
    }
  }

  function banners(m: THREE.Matrix4, index: number) {
    for (let pole = 0; pole < 3; pole++) {
      const z = (pole - 1) * 2.4
      const height = pole === 1 ? 5.4 : 4.6
      part(m, 'cylinder', '#eff0e0', 0, height / 2, z, 0.16, height, 0.16)
      // Thick, double-faced pennants remain readable from either side of the course.
      part(m, 'box', festive[(index + pole) % festive.length]!, 0, height - 0.9,
        z + 0.7, 0.1, 1.8, 1.5)
      part(m, 'box', '#fff3d7', -0.01, height - 0.65, z + 0.7, 0.13, 0.18, 1.2)
    }
  }

  function tireWall(m: THREE.Matrix4) {
    for (let tire = 0; tire < 6; tire++) {
      const z = (tire - 2.5) * 1.5
      for (const y of [0.25, 0.8]) {
        part(m, 'cylinder', tire % 3 === 0 ? '#e8e6d6' : '#34454b', 0, y, z, 1.5, 0.5, 1.5)
      }
      part(m, 'cylinder', '#1f3035', 0, 1.075, z, 0.65, 0.03, 0.65)
    }
  }

  // Large features get first choice, before the smaller plants fill the gaps.
  place(0.27, 14.5, pond, -1, 'pond')
  if (forest || alpine) place(0.73, 14.5, pond, -1, 'pond')
  if (circuit.scenery !== 'stadium') {
    place(0.54, 10, (m) => cottage(m, 0), 1, 'cottage')
    if (forest || alpine) place(0.14, 10, (m) => cottage(m, 1), 1, 'cottage')
  }
  for (let i = 0; i < (forest || alpine ? 2 : 3); i++) {
    place((i + 0.3) / 3, 8, (m) => pavilion(m, i), 1, 'pavilion')
  }
  for (let i = 0; i < 6; i++) {
    place((i + 0.45) / 6, 15, (m) => meadow(m, i), -1, 'meadow')
  }
  for (let i = 0; i < 8; i++) {
    place((i + 0.6) / 8, 4.5, (m) => banners(m, i), i % 2 ? -1 : 1, 'banners')
  }
  for (let i = 0; i < 4; i++) {
    place((i + 0.8) / 4, 5, tireWall, 1, 'tireWall')
  }
}
