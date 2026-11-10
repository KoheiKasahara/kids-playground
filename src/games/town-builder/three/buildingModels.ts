import * as THREE from 'three'
import type { BuildingId } from '../parts'
import type { Frame, Mat } from './townKit'

// たてもの・しぜん・あそびばの 3D。いろは 2D の え（PartArt.tsx）に あわせる。
// しょうめんは ローカルの +z、マスは -0.5〜0.5、じめんは y=0。

/** うごく ものの まいフレームの しごと。seconds は みはじめてからの びょう。 */
export type Tick = (seconds: number) => void

export type BuildContext = {
  /** みちに つながって いて、よるに まどの あかりが つくか。 */
  readonly lit: boolean
  /** このマスで きまった 0〜1 の かず。 */
  readonly noise: (salt: number) => number
  /** うごく ものを まちに たす。 */
  readonly animate: (object: THREE.Object3D, tick: Tick) => void
}

type Win = readonly [x: number, y: number, width: number, height: number]

function grid(xs: readonly number[], ys: readonly number[], width: number, height: number): Win[] {
  return ys.flatMap((y) => xs.map((x) => [x, y, width, height] as const))
}

function windowMat(f: Frame, c: BuildContext): THREE.Material {
  return f.kit.glow(c.lit ? 'window' : 'windowOff')
}

/** しょうめん（+z）と うしろの かべの まど。z は かべの まんなか、depth は おくゆき。 */
function frontWindows(f: Frame, c: BuildContext, depth: number, list: readonly Win[], z = 0, back = false): void {
  const material = windowMat(f, c)
  for (const [x, y, width, height] of list) {
    f.box(material, [width, height, 0.02], [x, y - height / 2, z + depth / 2])
    if (back) f.box(material, [width, height, 0.02], [x, y - height / 2, z - depth / 2])
  }
}

/** みぎ・ひだりの かべの まど。list の x は おくゆきの いち。 */
function sideWindows(f: Frame, c: BuildContext, width: number, list: readonly Win[], x = 0): void {
  const material = windowMat(f, c)
  for (const [z, y, size, height] of list) {
    for (const side of [-1, 1]) f.box(material, [0.02, height, size], [x + (side * width) / 2, y - height / 2, z])
  }
}

function door(f: Frame, material: Mat, width: number, height: number, x: number, depth: number, z = 0): void {
  f.box(material, [width, height, 0.02], [x, 0, z + depth / 2])
}

/** かべに はりつけた まるい とけい。 */
function clock(f: Frame, x: number, y: number, z: number, radius: number): void {
  f.cyl('#ffffff', radius, 0.014, [x, y, z], 16, 1, [Math.PI / 2, 0, 0])
  f.box('#46404f', [0.01, radius * 0.7, 0.006], [x, y, z + 0.014])
  f.box('#46404f', [radius * 0.55, 0.01, 0.006], [x + radius * 0.27, y - 0.005, z + 0.014])
}

function tree(f: Frame, leaves: string, light: string, x: number, z: number, size: number): void {
  f.cyl('#8d5a2b', 0.045 * size, 0.24 * size, [x, 0, z], 7)
  f.ball(leaves, 0.23 * size, [x, 0.38 * size, z], 0)
  f.ball(light, 0.11 * size, [x - 0.08 * size, 0.47 * size, z + 0.08 * size], 0)
}

function grove(f: Frame, c: BuildContext, leaves: string, light: string): void {
  const size = 0.85 + c.noise(1) * 0.35
  const x = (c.noise(2) - 0.5) * 0.16
  const z = (c.noise(3) - 0.5) * 0.16
  if (c.noise(4) > 0.45) {
    tree(f, leaves, light, x - 0.12, z - 0.1, size * 0.85)
    tree(f, leaves, light, x + 0.2, z + 0.2, size * 0.55)
  } else {
    tree(f, leaves, light, x, z, size)
  }
}

const FLOWER_COLORS = ['#ff6b81', '#ffd43b', '#b197fc', '#ff8cc6', '#74c0fc', '#ff922b', '#ffd43b', '#ff6b81', '#ffffff'] as const
const GONDOLA_COLORS = ['#ffd43b', '#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'] as const

const BUILDERS: Record<BuildingId, (f: Frame, c: BuildContext) => void> = {
  house: (f, c) => {
    f.box('#fff3d6', [0.56, 0.36, 0.48], [0, 0, 0])
    f.gable('#ef5a4f', [0.66, 0.26, 0.62], [0, 0.36, 0])
    f.box('#a65b3e', [0.08, 0.2, 0.08], [0.16, 0.42, -0.1])
    door(f, '#b9773f', 0.11, 0.2, 0, 0.48)
    frontWindows(f, c, 0.48, [[-0.17, 0.22, 0.11, 0.1], [0.17, 0.22, 0.11, 0.1]])
    sideWindows(f, c, 0.56, [[0, 0.2, 0.12, 0.1]])
  },
  'house-blue': (f, c) => {
    f.box('#f4f0ff', [0.52, 0.42, 0.5], [0, 0, 0])
    f.pyramid('#4d8be8', [0.64, 0.24, 0.62], [0, 0.42, 0])
    door(f, '#7a5a44', 0.1, 0.19, 0.14, 0.5)
    frontWindows(f, c, 0.5, [[-0.13, 0.31, 0.11, 0.1], [0.13, 0.31, 0.11, 0.1], [-0.13, 0.13, 0.11, 0.1]])
    sideWindows(f, c, 0.52, [[0, 0.28, 0.12, 0.1]])
  },
  apartment: (f, c) => {
    f.box('#f6d7a7', [0.66, 0.92, 0.56], [0, 0, 0])
    f.box('#b97a4b', [0.72, 0.06, 0.62], [0, 0.92, 0])
    door(f, '#7b5a43', 0.12, 0.17, 0, 0.56)
    for (const y of [0.31, 0.51, 0.71]) f.box('#c98d5c', [0.66, 0.025, 0.07], [0, y, 0.31])
    frontWindows(f, c, 0.56, [...grid([-0.2, 0, 0.2], [0.42, 0.62, 0.82], 0.12, 0.1), [-0.2, 0.15, 0.12, 0.1], [0.2, 0.15, 0.12, 0.1]], 0, true)
    sideWindows(f, c, 0.66, grid([-0.13, 0.13], [0.2, 0.42, 0.62, 0.82], 0.1, 0.1))
  },
  tower: (f, c) => {
    f.box('#8fc1ea', [0.46, 2, 0.46], [0, 0, 0])
    f.box('#4f78a8', [0.52, 0.08, 0.52], [0, 2, 0])
    f.box('#4f78a8', [0.22, 0.12, 0.22], [0, 2.08, 0])
    f.cyl('#7b8794', 0.012, 0.25, [0.13, 2.08, 0.13], 6)
    f.ball(f.kit.glow('red'), 0.026, [0.13, 2.35, 0.13], 1)
    door(f, '#3f5f86', 0.14, 0.16, 0, 0.46)
    const rows = Array.from({ length: 11 }, (_, index) => 0.32 + index * 0.16)
    frontWindows(f, c, 0.46, grid([-0.1, 0.1], rows, 0.13, 0.07), 0, true)
    sideWindows(f, c, 0.46, grid([-0.1, 0.1], rows, 0.13, 0.07))
  },
  shop: (f, c) => {
    f.box('#ffffff', [0.7, 0.34, 0.56], [0, 0, 0])
    f.box('#e9ecef', [0.72, 0.03, 0.58], [0, 0.34, 0])
    f.box('#2fa56b', [0.74, 0.07, 0.6], [0, 0.27, 0])
    f.box('#f08c2e', [0.74, 0.025, 0.6], [0, 0.245, 0])
    frontWindows(f, c, 0.56, [[-0.12, 0.15, 0.32, 0.17], [0.2, 0.12, 0.14, 0.22]])
    f.cyl('#7b8794', 0.014, 0.42, [-0.3, 0, 0.36], 6)
    f.box('#2fa56b', [0.14, 0.1, 0.03], [-0.3, 0.36, 0.36])
  },
  cake: (f, c) => {
    f.box('#ffe1ec', [0.62, 0.34, 0.52], [0, 0, 0])
    f.box('#f06d9b', [0.68, 0.06, 0.6], [0, 0.34, 0])
    for (let n = 0; n < 6; n += 1) f.ball('#f06d9b', 0.036, [-0.27 + n * 0.108, 0.34, 0.3], 1)
    f.cyl('#fff8f0', 0.16, 0.12, [0, 0.4, 0], 16)
    f.cyl('#ff9ec0', 0.166, 0.035, [0, 0.5, 0], 16)
    f.ball('#e53935', 0.045, [0, 0.58, 0], 1)
    door(f, '#b26a4a', 0.12, 0.22, 0.18, 0.52)
    frontWindows(f, c, 0.52, [[-0.12, 0.15, 0.24, 0.14]])
  },
  office: (f, c) => {
    f.box('#aebfd3', [0.6, 1.4, 0.56], [0, 0, 0])
    f.box('#6f7f95', [0.64, 0.06, 0.6], [0, 1.4, 0])
    f.box('#c5cdd8', [0.16, 0.08, 0.12], [0.12, 1.46, -0.1])
    door(f, '#4c5a6e', 0.16, 0.17, 0, 0.56)
    const rows = [0.36, 0.54, 0.72, 0.9, 1.08, 1.26]
    frontWindows(f, c, 0.56, [...grid([-0.18, 0, 0.18], rows, 0.13, 0.09), [-0.18, 0.12, 0.13, 0.09], [0.18, 0.12, 0.13, 0.09]], 0, true)
    sideWindows(f, c, 0.6, grid([-0.14, 0.14], rows, 0.13, 0.09))
  },
  depart: (f, c) => {
    f.box('#f3dfbf', [0.82, 0.72, 0.74], [0, 0, 0])
    f.box('#c0504d', [0.86, 0.08, 0.78], [0, 0.72, 0])
    f.cyl('#46404f', 0.012, 0.32, [0, 0.8, 0], 6)
    f.box('#ffd43b', [0.15, 0.09, 0.012], [0.075, 0.98, 0])
    f.box('#c0504d', [0.34, 0.025, 0.1], [0, 0.24, 0.41])
    frontWindows(f, c, 0.74, [...grid([-0.29, -0.1, 0.1, 0.29], [0.42, 0.6], 0.14, 0.1), [0, 0.11, 0.24, 0.2]])
    sideWindows(f, c, 0.82, grid([-0.2, 0.2], [0.42, 0.6], 0.14, 0.1))
  },
  factory: (f, c) => {
    f.box('#cfc6b8', [0.56, 0.26, 0.62], [-0.08, 0, 0])
    for (const z of [-0.2, 0, 0.2]) f.gable('#a9a196', [0.56, 0.12, 0.2], [-0.08, 0.26, z])
    f.cyl('#b5583a', 0.06, 0.9, [0.28, 0, -0.2], 10)
    f.cyl('#ffffff', 0.063, 0.06, [0.28, 0.7, -0.2], 10)
    door(f, '#7e7468', 0.16, 0.17, -0.08, 0.62)
    frontWindows(f, c, 0.62, [[-0.28, 0.18, 0.08, 0.06], [0.12, 0.18, 0.08, 0.06]])
    // えんとつの けむり。のぼりながら ふくらみ、きえて また でる。
    const smoke = f.group([0.28, 0.92, -0.2])
    const puff = f.kit.mat('#eef1f4', { opacity: 0.9, rough: 1 })
    const puffs = [0, 1, 2].map(() => {
      const mesh = f.kit.mesh(f.kit.ball(1), puff, [0, 0, 0], [0.05, 0.05, 0.05], [0, 0, 0], false)
      smoke.add(mesh)
      return mesh
    })
    c.animate(smoke, (seconds) => {
      puffs.forEach((mesh, index) => {
        const phase = (seconds * 0.35 + index / 3 + c.noise(5)) % 1
        const size = (0.05 + phase * 0.09) * (phase < 0.85 ? 1 : (1 - phase) / 0.15)
        mesh.position.set(phase * 0.15, phase * 0.6, 0)
        mesh.scale.setScalar(Math.max(0.001, size))
      })
    })
  },
  school: (f, c) => {
    f.box('#fff1d6', [0.84, 0.36, 0.44], [0, 0, 0.04])
    f.box('#8d6e63', [0.88, 0.04, 0.48], [0, 0.36, 0.04])
    f.box('#fff1d6', [0.22, 0.26, 0.22], [0, 0.36, 0.04])
    f.pyramid('#e57373', [0.28, 0.16, 0.28], [0, 0.62, 0.04])
    clock(f, 0, 0.49, 0.15, 0.07)
    door(f, '#a0703c', 0.13, 0.19, 0, 0.44, 0.04)
    frontWindows(f, c, 0.44, grid([-0.33, -0.18, 0.18, 0.33], [0.12, 0.27], 0.11, 0.09), 0.04, true)
    f.cyl('#adb5bd', 0.01, 0.42, [0.36, 0, 0.36], 6)
    f.box('#ff6b6b', [0.1, 0.06, 0.008], [0.41, 0.34, 0.36])
  },
  hospital: (f, c) => {
    f.box('#ffffff', [0.7, 0.6, 0.56], [0, 0, 0])
    f.box('#9fb3c8', [0.74, 0.05, 0.6], [0, 0.6, 0])
    f.box('#e53935', [0.06, 0.2, 0.02], [0, 0.3, 0.285])
    f.box('#e53935', [0.2, 0.06, 0.02], [0, 0.37, 0.285])
    f.cyl('#7c8a99', 0.17, 0.01, [0, 0.65, 0], 16)
    for (const x of [-0.045, 0.045]) f.box('#ffffff', [0.02, 0.006, 0.12], [x, 0.66, 0])
    f.box('#ffffff', [0.09, 0.006, 0.02], [0, 0.66, 0])
    frontWindows(f, c, 0.56, [...grid([-0.22, 0.22], [0.29, 0.47], 0.12, 0.1), [0, 0.1, 0.16, 0.18]])
    sideWindows(f, c, 0.7, grid([-0.13, 0.13], [0.15, 0.31, 0.47], 0.12, 0.1))
  },
  fire: (f, c) => {
    f.box('#e2483d', [0.72, 0.44, 0.56], [0, 0, 0])
    f.box('#9e2a22', [0.76, 0.06, 0.6], [0, 0.44, 0])
    for (const x of [-0.17, 0.17]) {
      f.box('#f1eee8', [0.24, 0.24, 0.02], [x, 0, 0.28])
      for (const y of [0.07, 0.14]) f.box('#c9c2b8', [0.22, 0.01, 0.024], [x, y, 0.28])
    }
    frontWindows(f, c, 0.56, grid([-0.22, 0, 0.22], [0.35], 0.12, 0.09))
    f.box('#e2483d', [0.14, 0.88, 0.14], [0.26, 0, -0.17])
    f.box('#9e2a22', [0.18, 0.05, 0.18], [0.26, 0.88, -0.17])
    f.ball(f.kit.glow('red'), 0.032, [0.26, 0.96, -0.17], 1)
  },
  police: (f, c) => {
    f.box('#eef3fb', [0.68, 0.42, 0.52], [0, 0, 0])
    f.box('#2f4fa2', [0.72, 0.08, 0.56], [0, 0.42, 0])
    f.cyl('#46404f', 0.04, 0.03, [0, 0.5, 0], 10)
    f.ball(f.kit.glow('red'), 0.045, [0, 0.55, 0], 1)
    f.cyl('#ffd43b', 0.05, 0.012, [0, 0.46, 0.28], 5, 1, [Math.PI / 2, 0, 0])
    door(f, '#6a7fb3', 0.13, 0.21, 0, 0.52)
    frontWindows(f, c, 0.52, grid([-0.2, 0.2], [0.13, 0.31], 0.13, 0.1))
    sideWindows(f, c, 0.68, [[0, 0.26, 0.14, 0.1]])
  },
  station: (f, c) => {
    f.box('#f2e4c9', [0.8, 0.36, 0.5], [0, 0, 0])
    f.pyramid('#5f7d95', [0.92, 0.2, 0.62], [0, 0.36, 0])
    clock(f, 0, 0.27, 0.25, 0.055)
    frontWindows(f, c, 0.5, [[-0.27, 0.18, 0.12, 0.1], [0.27, 0.18, 0.12, 0.1], [0, 0.1, 0.18, 0.2]], 0, true)
    sideWindows(f, c, 0.8, [[0, 0.18, 0.14, 0.1]])
  },
  tree: (f, c) => grove(f, c, '#4caf50', '#7dd181'),
  sakura: (f, c) => grove(f, c, '#f8bbd0', '#ff86b0'),
  flowers: (f) => {
    f.cyl('#7cc35a', 0.42, 0.04, [0, 0, 0], 18)
    FLOWER_COLORS.forEach((color, index) => {
      const angle = (index / FLOWER_COLORS.length) * Math.PI * 2
      const radius = index === FLOWER_COLORS.length - 1 ? 0 : 0.26
      const x = Math.cos(angle) * radius
      const z = Math.sin(angle) * radius
      f.cyl('#4f9a3a', 0.008, 0.07, [x, 0.04, z], 4)
      f.ball(color, 0.045, [x, 0.12, z], 1, 0.6)
      f.ball('#fff6cc', 0.018, [x, 0.14, z], 0)
    })
  },
  farm: (f) => {
    f.box('#b07a4a', [0.84, 0.04, 0.84], [0, 0, 0])
    for (const z of [-0.3, -0.1, 0.1, 0.3]) {
      f.box('#8a5a32', [0.74, 0.035, 0.09], [0, 0.04, z])
      for (const x of [-0.27, -0.09, 0.09, 0.27]) f.cone('#5cb85c', 0.035, 0.09, [x, 0.075, z], 5)
    }
  },
  park: (f) => {
    f.box('#a8e07a', [0.86, 0.02, 0.86], [0, 0, 0])
    f.cyl('#d9c08a', 0.155, 0.03, [-0.17, 0.02, 0.17], 14)
    f.cyl('#f1d9a6', 0.13, 0.035, [-0.17, 0.02, 0.17], 14)
    f.cyl('#8d5a2b', 0.03, 0.15, [-0.22, 0.02, -0.2], 7)
    f.ball('#43a047', 0.13, [-0.22, 0.28, -0.2], 0)
    for (const x of [0.08, 0.2]) f.box('#ff8a3d', [0.03, 0.26, 0.03], [x, 0.02, -0.22])
    f.box('#ff8a3d', [0.16, 0.025, 0.1], [0.14, 0.26, -0.2])
    f.box('#ffb703', [0.1, 0.02, 0.38], [0.14, 0.14, 0.01], [0.6, 0, 0])
    f.box('#8d5a2b', [0.22, 0.03, 0.07], [0.2, 0.09, 0.3])
    for (const x of [0.11, 0.29]) f.box('#6d4c2f', [0.02, 0.08, 0.05], [x, 0.02, 0.3])
  },
  fountain: (f, c) => {
    f.cyl('#cfd8dc', 0.36, 0.09, [0, 0, 0], 18)
    f.cyl(f.kit.mat('#64c4ef', { rough: 0.15 }), 0.31, 0.004, [0, 0.09, 0], 18)
    f.cyl('#b0bec5', 0.04, 0.2, [0, 0.09, 0], 10)
    f.cyl('#cfd8dc', 0.12, 0.03, [0, 0.27, 0], 14)
    // ふきあがる みずと、まわりに おちる しずく。
    const water = f.kit.mat('#9ee3ff', { opacity: 0.8, rough: 0.2 })
    const spray = f.group([0, 0.3, 0])
    const jet = f.kit.mesh(f.kit.cyl(8, 0.35), water, [0, 0, 0], [0.035, 0.2, 0.035], [0, 0, 0], false)
    spray.add(jet)
    const drops = [0, 1, 2, 3].map(() => {
      const drop = f.kit.mesh(f.kit.ball(1), water, [0, 0, 0], [0.025, 0.025, 0.025], [0, 0, 0], false)
      spray.add(drop)
      return drop
    })
    c.animate(spray, (seconds) => {
      jet.scale.y = 0.2 * (1 + Math.sin(seconds * 5) * 0.2)
      drops.forEach((drop, index) => {
        const phase = (seconds * 0.9 + index / 4) % 1
        const angle = (index * Math.PI) / 2 + Math.PI / 4
        const radius = 0.1 + phase * 0.17
        drop.position.set(Math.cos(angle) * radius, 0.14 * Math.sin(Math.PI * phase) - 0.2 * phase, Math.sin(angle) * radius)
      })
    })
  },
  ferris: (f, c) => {
    f.box('#6d6875', [0.62, 0.03, 0.24], [0, 0, 0])
    const length = Math.hypot(0.25, 0.62)
    const tilt = Math.asin(0.25 / length)
    for (const z of [-0.08, 0.08]) {
      f.box('#6d6875', [0.035, length, 0.035], [-0.25, 0, z], [0, 0, -tilt])
      f.box('#6d6875', [0.035, length, 0.035], [0.25, 0, z], [0, 0, tilt])
    }
    f.cyl('#46404f', 0.03, 0.2, [0, 0.62, -0.1], 10, 1, [Math.PI / 2, 0, 0])
    const kit = f.kit
    // むきを もつ はこの なかで まわす（はこ じたいの かいてんを かきかえない）。
    const holder = f.group([0, 0.62, 0])
    const wheel = new THREE.Group()
    holder.add(wheel)
    wheel.add(kit.mesh(kit.torus(0.42, 0.016), '#e05d8f'))
    wheel.add(kit.mesh(kit.torus(0.2, 0.012), '#e05d8f'))
    for (let n = 0; n < 4; n += 1) {
      const angle = (n * Math.PI) / 4
      wheel.add(kit.mesh(kit.box(), '#e05d8f', [0.42 * Math.sin(angle), -0.42 * Math.cos(angle), 0], [0.012, 0.84, 0.012], [0, 0, angle]))
    }
    const gondolas = GONDOLA_COLORS.map((color, index) => {
      const angle = (index * Math.PI) / 4
      const gondola = new THREE.Group()
      gondola.position.set(Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0)
      gondola.add(kit.mesh(kit.box(), '#46404f', [0, -0.04, 0], [0.008, 0.04, 0.008], [0, 0, 0], false))
      gondola.add(kit.mesh(kit.box(), color, [0, -0.12, 0], [0.09, 0.08, 0.09]))
      gondola.add(kit.mesh(kit.box(), kit.glow(c.lit ? 'window' : 'windowOff'), [0, -0.1, 0], [0.095, 0.03, 0.07], [0, 0, 0], false))
      wheel.add(gondola)
      return gondola
    })
    for (let n = 0; n < 8; n += 1) {
      const angle = ((n + 0.5) * Math.PI) / 4
      wheel.add(kit.mesh(kit.ball(1), kit.glow('bulb'), [Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0.02], [0.022, 0.022, 0.022], [0, 0, 0], false))
    }
    wheel.add(kit.mesh(kit.ball(1), '#ffffff', [0, 0, 0], [0.045, 0.045, 0.045]))
    c.animate(holder, (seconds) => {
      wheel.rotation.z = seconds * 0.25
      for (const gondola of gondolas) gondola.rotation.z = -wheel.rotation.z
    })
  },
  castle: (f, c) => {
    f.box('#e8e1d5', [0.62, 0.26, 0.3], [0, 0, 0.06])
    for (const x of [-0.24, -0.08, 0.08, 0.24]) f.box('#e8e1d5', [0.07, 0.06, 0.07], [x, 0.26, 0.17])
    f.box('#efe8dc', [0.28, 0.58, 0.28], [0, 0, -0.08])
    f.cone('#e64980', 0.21, 0.32, [0, 0.58, -0.08], 8)
    for (const x of [-0.3, 0.3]) {
      f.cyl('#ddd4c4', 0.1, 0.56, [x, 0, 0.06], 10)
      f.cone('#5c7cfa', 0.13, 0.26, [x, 0.56, 0.06], 10)
      f.cyl('#46404f', 0.006, 0.12, [x, 0.8, 0.06], 4)
      f.box('#ffd43b', [0.08, 0.05, 0.008], [x + 0.04, 0.87, 0.06])
    }
    f.box('#7b5a3c', [0.12, 0.17, 0.02], [0, 0, 0.21])
    frontWindows(f, c, 0.28, [[0, 0.44, 0.07, 0.1]], -0.08)
    frontWindows(f, c, 0.2, [[-0.3, 0.38, 0.05, 0.08], [0.3, 0.38, 0.05, 0.08]], 0.06)
  },
  'tv-tower': (f, c) => {
    f.cyl('#f76707', 0.22, 1.25, [0, 0, 0], 4, 0.18, [0, Math.PI / 4, 0])
    f.cyl('#ffffff', 0.17, 0.05, [0, 0.38, 0], 4, 0.95, [0, Math.PI / 4, 0])
    f.cyl('#ffffff', 0.112, 0.05, [0, 0.76, 0], 4, 0.95, [0, Math.PI / 4, 0])
    f.cyl('#ffffff', 0.15, 0.12, [0, 0.95, 0], 14)
    f.cyl(windowMat(f, c), 0.153, 0.04, [0, 0.99, 0], 14)
    f.cyl('#f76707', 0.06, 0.25, [0, 1.07, 0], 8, 0.5)
    f.cyl('#f76707', 0.012, 0.35, [0, 1.3, 0], 6)
    f.ball(f.kit.glow('red'), 0.03, [0, 1.66, 0], 1)
  },
  windmill: (f, c) => {
    f.cyl('#f2e2c4', 0.19, 0.5, [0, 0, 0], 8, 0.72)
    f.cone('#c0504d', 0.17, 0.18, [0, 0.5, 0], 8)
    door(f, '#8d5a2b', 0.09, 0.15, 0, 0.37)
    frontWindows(f, c, 0.3, [[0, 0.32, 0.07, 0.08]])
    const kit = f.kit
    const holder = f.group([0, 0.47, 0.2])
    const blades = new THREE.Group()
    holder.add(blades)
    blades.add(kit.mesh(kit.ball(1), '#6d6875', [0, 0, 0], [0.04, 0.04, 0.04]))
    for (let n = 0; n < 4; n += 1) {
      const angle = (n * Math.PI) / 2
      blades.add(kit.mesh(kit.box(), '#ffffff', [-0.03 * Math.sin(angle), 0.03 * Math.cos(angle), 0], [0.07, 0.3, 0.012], [0, 0, angle]))
    }
    c.animate(holder, (seconds) => { blades.rotation.z = -seconds * 0.9 })
  },
  igloo: (f, c) => {
    f.ball('#eef7ff', 0.36, [0, 0, 0], 1, 0.82)
    f.cyl('#dcebf7', 0.13, 0.16, [0, 0, 0.3], 10, 0.9)
    door(f, '#5b6b82', 0.13, 0.13, 0, 0.52, 0.17)
    f.box(windowMat(f, c), [0.08, 0.06, 0.02], [0, 0.05, 0.435])
  },
  lighthouse: (f) => {
    f.cyl('#ffffff', 0.17, 0.74, [0, 0, 0], 14, 0.6)
    f.cyl('#e5484d', 0.151, 0.14, [0, 0.2, 0], 14, 0.92)
    f.cyl('#e5484d', 0.123, 0.12, [0, 0.52, 0], 14, 0.93)
    f.cyl('#5b6b82', 0.13, 0.02, [0, 0.74, 0], 14)
    f.cyl(f.kit.glow('bulb'), 0.085, 0.11, [0, 0.76, 0], 10)
    f.cone('#e5484d', 0.13, 0.12, [0, 0.87, 0], 10)
    door(f, '#8d5a2b', 0.07, 0.13, 0, 0.33)
  },
  pine: (f, c) => {
    const size = 0.85 + c.noise(1) * 0.35
    const x = (c.noise(2) - 0.5) * 0.2
    const z = (c.noise(3) - 0.5) * 0.2
    f.cyl('#7b4a2c', 0.04 * size, 0.16 * size, [x, 0, z], 7)
    f.cone('#2f8f5b', 0.26 * size, 0.3 * size, [x, 0.12 * size, z], 8)
    f.cone('#37a268', 0.2 * size, 0.28 * size, [x, 0.28 * size, z], 8)
    f.cone('#2f8f5b', 0.13 * size, 0.24 * size, [x, 0.44 * size, z], 8)
    f.cone('#ffffff', 0.05 * size, 0.09 * size, [x, 0.6 * size, z], 8)
  },
  palm: (f, c) => {
    const size = 0.9 + c.noise(1) * 0.3
    const turn = c.noise(2) * Math.PI * 2
    f.cyl('#b9864a', 0.04, 0.56 * size, [0, 0, 0], 7, 0.7, [0.08, turn, 0.1])
    const top: [number, number, number] = [-0.05, 0.55 * size, 0.04]
    for (let n = 0; n < 6; n += 1) {
      const angle = turn + (n / 6) * Math.PI * 2
      const x = top[0] + Math.cos(angle) * 0.14
      const z = top[2] - Math.sin(angle) * 0.14
      f.put(f.kit.ball(0), n % 2 ? '#4fae5b' : '#5fbf6a', [x, top[1] - 0.03, z], [0.17, 0.025, 0.06], [0, angle, -0.35])
    }
    f.ball('#7b4a2c', 0.035, [top[0] + 0.03, top[1] - 0.05, top[2]], 0)
    f.ball('#7b4a2c', 0.035, [top[0] - 0.03, top[1] - 0.05, top[2] + 0.03], 0)
  },
  cactus: (f, c) => {
    const size = 0.8 + c.noise(1) * 0.4
    f.cyl('#6dbb63', 0.085 * size, 0.46 * size, [0, 0, 0], 10)
    f.ball('#6dbb63', 0.085 * size, [0, 0.46 * size, 0], 1)
    for (const side of [-1, 1]) {
      const y = (side < 0 ? 0.16 : 0.24) * size
      f.box('#5fa55a', [0.12 * size, 0.06 * size, 0.06 * size], [side * 0.12 * size, y, 0])
      f.cyl('#5fa55a', 0.035 * size, 0.14 * size, [side * 0.17 * size, y, 0], 8)
      f.ball('#5fa55a', 0.035 * size, [side * 0.17 * size, y + 0.14 * size, 0], 0)
    }
    f.ball('#ff8cc6', 0.035 * size, [0, 0.55 * size, 0], 0, 0.6)
  },
  snowman: (f) => {
    f.ball('#ffffff', 0.2, [0, 0.17, 0], 1)
    f.ball('#ffffff', 0.14, [0, 0.44, 0], 1)
    f.cyl('#e5484d', 0.115, 0.04, [0, 0.31, 0], 12)
    f.cyl('#46404f', 0.13, 0.015, [0, 0.55, 0], 12)
    f.cyl('#46404f', 0.085, 0.11, [0, 0.56, 0], 12)
    f.cone('#ff922b', 0.025, 0.1, [0, 0.44, 0.13], 6, [Math.PI / 2, 0, 0])
    for (const x of [-0.05, 0.05]) f.ball('#46404f', 0.018, [x, 0.49, 0.125], 0)
  },
  pyramid: (f) => {
    f.box('#d4a548', [0.92, 0.03, 0.92], [0, 0, 0])
    f.pyramid('#e9c46a', [0.86, 0.62, 0.86], [0, 0.03, 0])
    f.pyramid('#f4d98a', [0.16, 0.115, 0.16], [0, 0.535, 0])
    door(f, '#7b5a2c', 0.1, 0.1, 0, 0.84)
  },
  tent: (f) => {
    f.gable('#ff922b', [0.5, 0.36, 0.62], [-0.08, 0, -0.04], [0, Math.PI / 2, 0])
    f.box('#7b4a2c', [0.14, 0.2, 0.01], [-0.08, 0, 0.275])
    f.cyl('#8d5a2b', 0.012, 0.42, [-0.08, 0, -0.04], 6)
    for (const turn of [0, Math.PI / 2]) f.box('#8d5a2b', [0.14, 0.03, 0.03], [0.3, 0, 0.28], [0, turn, 0])
    f.cone(f.kit.glow('bulb'), 0.04, 0.1, [0.3, 0.03, 0.28], 6)
  },
}

export function buildBuilding(part: BuildingId, f: Frame, context: BuildContext): void {
  BUILDERS[part](f, context)
}
