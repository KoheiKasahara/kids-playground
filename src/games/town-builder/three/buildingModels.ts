import * as THREE from 'three'
import type { BuildingId } from '../parts'
import type { Frame, Mat } from './townKit'

// たてもの・しぜん・あそびばの 3D。いろは 2D の え（PartArt.tsx）に あわせる。
// しょうめんは ローカルの +z、じめんは y=0。1マスの ものは -0.5〜0.5、
// よこ 2マスの ものは x が -1〜1、2×2 の ものは x・z とも -1〜1 に おさめる（おおきく おく ときは まるごと ばいに する）。
// うごく ものは いっしょに うごく ぶんを 1つに まとめ（kit.moving）、おなじ かたちが ならぶ ものは InstancedMesh に して、えがく かいすうを へらす。

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

const FORWARD = new THREE.Vector3(0, 0, 1)
const scratch = { matrix: new THREE.Matrix4(), position: new THREE.Vector3(), quaternion: new THREE.Quaternion(), scale: new THREE.Vector3(), color: new THREE.Color() }

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

/** さく（x0〜x1、z0〜z1 の しかく）。 */
function fence(f: Frame, x0: number, x1: number, z0: number, z1: number, color = '#8d5a2b'): void {
  const w = x1 - x0
  const d = z1 - z0
  for (const z of [z0, z1]) f.box(color, [w, 0.02, 0.015], [(x0 + x1) / 2, 0.08, z])
  for (const x of [x0, x1]) f.box(color, [0.015, 0.02, d], [x, 0.08, (z0 + z1) / 2])
  for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]] as const) f.box(color, [0.025, 0.11, 0.025], [x, 0, z])
}

function cow(f: Frame, x: number, z: number, turn: number): void {
  const along = (forward: number, side: number): [number, number] => [x + Math.sin(turn) * forward + Math.cos(turn) * side, z + Math.cos(turn) * forward - Math.sin(turn) * side]
  f.box('#ffffff', [0.09, 0.08, 0.16], [x, 0.07, z], [0, turn, 0])
  const [sx, sz] = along(-0.02, 0)
  f.box('#46404f', [0.092, 0.04, 0.05], [sx, 0.1, sz], [0, turn, 0])
  const [hx, hz] = along(0.1, 0)
  f.box('#ffffff', [0.06, 0.06, 0.06], [hx, 0.11, hz], [0, turn, 0])
  const [nx, nz] = along(0.135, 0)
  f.box('#ffc9c9', [0.05, 0.03, 0.02], [nx, 0.11, nz], [0, turn, 0])
  for (const [forward, side] of [[0.05, 0.03], [0.05, -0.03], [-0.05, 0.03], [-0.05, -0.03]] as const) {
    const [lx, lz] = along(forward, side)
    f.box('#46404f', [0.02, 0.07, 0.02], [lx, 0, lz])
  }
}

const FLOWER_COLORS = ['#ff6b81', '#ffd43b', '#b197fc', '#ff8cc6', '#74c0fc', '#ff922b', '#ffd43b', '#ff6b81', '#ffffff'] as const
const GONDOLA_COLORS = ['#ffd43b', '#4dabf7', '#69db7c', '#ff8787', '#b197fc', '#ffa94d', '#63e6be', '#f783ac'] as const
const HORSE_COLORS = ['#ffffff', '#ffc9c9', '#d0ebff', '#ffffff', '#fff3bf', '#d3f9d8'] as const
/** 2D の もり（200×200）の き（cx, cy, はんけい, はの いろ）。 */
const FOREST_TREES = [
  [124, 40, 26, '#4caf50'], [56, 48, 24, '#3f9b46'], [168, 78, 20, '#3f9b46'], [90, 92, 26, '#4caf50'],
  [38, 112, 22, '#5cb85c'], [148, 124, 26, '#3f9b46'], [70, 150, 22, '#4caf50'], [118, 162, 18, '#5cb85c'],
] as const

/** instanced の i ばんめを at に おく。 */
function setInstance(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, sx: number, sy = sx, sz = sx, quaternion?: THREE.Quaternion): void {
  scratch.matrix.compose(scratch.position.set(x, y, z), quaternion ?? scratch.quaternion.identity(), scratch.scale.set(sx, sy, sz))
  mesh.setMatrixAt(index, scratch.matrix)
}

/** ジェットコースターの せんろ（0〜1 で 1しゅう）。 */
function coasterPoint(t: number): THREE.Vector3 {
  const angle = t * Math.PI * 2
  return new THREE.Vector3(Math.cos(angle) * 0.7, 0.3 + 0.2 * Math.sin(angle * 2 + 0.6) + 0.12 * Math.sin(angle), Math.sin(angle) * 0.55)
}

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
  'big-apartment': (f, c) => {
    f.box('#f9e0b8', [1.76, 0.8, 0.56], [0, 0, 0])
    f.box('#b97a4b', [1.84, 0.06, 0.62], [0, 0.8, 0])
    for (const y of [0.3, 0.55]) f.box('#c98d5c', [1.76, 0.025, 0.07], [0, y, 0.31])
    door(f, '#7b5a43', 0.16, 0.18, 0, 0.56)
    frontWindows(f, c, 0.56, [...grid([-0.72, -0.5, -0.28, 0.28, 0.5, 0.72], [0.45, 0.7], 0.13, 0.1), ...grid([-0.72, -0.5, 0.5, 0.72], [0.2], 0.13, 0.1)], 0, true)
    sideWindows(f, c, 1.76, grid([-0.13, 0.13], [0.45, 0.7], 0.1, 0.1))
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
  icecream: (f, c) => {
    f.box('#fff0f6', [0.62, 0.34, 0.52], [0, 0, 0])
    f.box('#74c0fc', [0.68, 0.06, 0.58], [0, 0.34, 0])
    for (let n = 0; n < 5; n += 1) f.box('#ffffff', [0.06, 0.062, 0.585], [-0.24 + n * 0.12, 0.34, 0])
    f.cone('#e0a458', 0.07, 0.16, [0, 0.56, 0], 10, [Math.PI, 0, 0])
    f.ball('#ff8cc6', 0.065, [-0.035, 0.6, 0], 1)
    f.ball('#fff3bf', 0.06, [0.04, 0.6, 0.02], 1)
    f.ball('#8ce99a', 0.055, [0, 0.67, 0], 1)
    door(f, '#c2255c', 0.12, 0.22, 0.18, 0.52)
    frontWindows(f, c, 0.52, [[-0.12, 0.22, 0.24, 0.14]])
  },
  bakery: (f, c) => {
    f.box('#fbe3c0', [0.62, 0.36, 0.52], [0, 0, 0])
    f.gable('#a0522d', [0.7, 0.2, 0.6], [0, 0.36, 0])
    f.box('#8d5a2b', [0.08, 0.2, 0.08], [0.18, 0.42, -0.12])
    f.box('#ffffff', [0.24, 0.1, 0.02], [-0.12, 0.27, 0.27])
    f.ball('#e8a849', 0.06, [-0.12, 0.32, 0.29], 1, 0.5)
    door(f, '#8d5a2b', 0.12, 0.2, 0.18, 0.52)
    frontWindows(f, c, 0.52, [[-0.12, 0.17, 0.22, 0.12]])
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
    // えんとつの けむり。のぼりながら ふくらみ、きえて また でる。3つの たまを 1かいで えがく。
    const smoke = f.group([0.28, 0.92, -0.2])
    const puffs = f.kit.instanced(f.kit.ball(1), f.kit.mat('#eef1f4', { opacity: 0.9, rough: 1 }), 3, false)
    smoke.add(puffs)
    c.animate(smoke, (seconds) => {
      for (let index = 0; index < 3; index += 1) {
        const phase = (seconds * 0.35 + index / 3 + c.noise(5)) % 1
        const size = (0.05 + phase * 0.09) * (phase < 0.85 ? 1 : (1 - phase) / 0.15)
        setInstance(puffs, index, phase * 0.15, phase * 0.6, 0, Math.max(0.001, size))
      }
      puffs.instanceMatrix.needsUpdate = true
    })
  },
  supermarket: (f, c) => {
    f.box('#fffaf0', [1.8, 0.4, 0.6], [0, 0, 0])
    f.box('#e8590c', [1.86, 0.08, 0.66], [0, 0.4, 0])
    for (let n = 0; n < 9; n += 1) f.box('#ffd8a8', [0.1, 0.06, 0.012], [-0.8 + n * 0.2, 0.33, 0.305])
    f.box('#ffd43b', [0.6, 0.18, 0.04], [0, 0.48, 0.24])
    f.box('#46404f', [0.12, 0.04, 0.01], [-0.12, 0.55, 0.262])
    f.ball('#e03131', 0.035, [0.15, 0.57, 0.27], 1)
    f.ball('#fd7e14', 0.032, [0.22, 0.57, 0.27], 1)
    f.box('#b9773f', [0.32, 0.1, 0.16], [-0.66, 0, 0.42])
    for (const [x, color] of [[-0.76, '#e03131'], [-0.66, '#fd7e14'], [-0.56, '#82c91e']] as const) f.ball(color, 0.04, [x, 0.13, 0.42], 1)
    frontWindows(f, c, 0.6, [[-0.45, 0.24, 0.5, 0.16], [0.5, 0.24, 0.5, 0.16], [0, 0.15, 0.24, 0.3]])
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
  heliport: (f, c) => {
    f.box('#7d8590', [0.86, 0.04, 0.86], [0, 0, 0])
    f.cyl('#fcc419', 0.32, 0.006, [0, 0.04, 0], 24)
    f.cyl('#7d8590', 0.29, 0.008, [0, 0.04, 0], 24)
    for (const x of [-0.09, 0.09]) f.box('#ffffff', [0.04, 0.01, 0.24], [x, 0.042, 0])
    f.box('#ffffff', [0.18, 0.01, 0.04], [0, 0.042, 0])
    f.put(f.kit.ball(1), '#e03131', [0, 0.15, 0.03], [0.1, 0.08, 0.13])
    f.put(f.kit.ball(1), windowMat(f, c), [0, 0.17, 0.1], [0.06, 0.045, 0.06])
    f.box('#e03131', [0.03, 0.03, 0.24], [0, 0.14, -0.18])
    f.box('#e03131', [0.012, 0.08, 0.05], [0, 0.15, -0.29])
    for (const x of [-0.07, 0.07]) f.box('#46404f', [0.012, 0.012, 0.22], [x, 0.05, 0.03])
    f.box('#46404f', [0.02, 0.06, 0.02], [0, 0.22, 0.03])
    for (const x of [-0.38, 0.38]) for (const z of [-0.38, 0.38]) f.ball(f.kit.glow('bulb'), 0.02, [x, 0.05, z], 1)
    // くるくる まわる プロペラ。
    const holder = f.group([0, 0.28, 0.03])
    const { frame: m, cluster } = f.kit.moving()
    m.box('#46404f', [0.56, 0.008, 0.03], [0, 0, 0])
    m.box('#46404f', [0.03, 0.008, 0.56], [0, 0, 0])
    const rotor = cluster.build()
    holder.add(rotor)
    c.animate(holder, (seconds) => { rotor.rotation.y = seconds * 7 })
  },
  shrine: (f) => {
    f.box('#f1e3c6', [0.3, 0.22, 0.26], [0, 0, -0.18])
    f.gable('#5c5f66', [0.42, 0.14, 0.36], [0, 0.22, -0.18])
    f.box('#c92a2a', [0.08, 0.12, 0.02], [0, 0, -0.045])
    f.box('#d9d4c7', [0.12, 0.01, 0.34], [0, 0, 0.14])
    for (const x of [-0.17, 0.17]) f.cyl('#e8590c', 0.025, 0.42, [x, 0, 0.2], 8)
    f.box('#e8590c', [0.52, 0.04, 0.06], [0, 0.42, 0.2])
    f.box('#e8590c', [0.42, 0.03, 0.04], [0, 0.34, 0.2])
  },
  lighthouse: (f, c) => {
    f.cyl('#9aa5b1', 0.32, 0.06, [0, 0, 0], 9)
    f.cyl('#ffffff', 0.15, 0.9, [0, 0.06, 0], 14, 0.7)
    f.cyl('#e03131', 0.141, 0.12, [0, 0.27, 0], 14, 0.957)
    f.cyl('#e03131', 0.126, 0.12, [0, 0.57, 0], 14, 0.95)
    f.box(windowMat(f, c), [0.05, 0.07, 0.02], [0, 0.42, 0.13])
    f.cyl('#46404f', 0.14, 0.03, [0, 0.96, 0], 14)
    f.cyl(f.kit.glow('bulb'), 0.08, 0.12, [0, 0.99, 0], 10)
    f.cone('#e03131', 0.11, 0.12, [0, 1.11, 0], 10)
    // くるくる まわる あかり。
    const holder = f.group([0, 1.03, 0])
    const { flat: m, cluster } = f.kit.moving()
    m.box(f.kit.glow('bulb'), [0.035, 0.03, 0.28], [0, -0.015, 0.14])
    m.box(f.kit.glow('bulb'), [0.035, 0.03, 0.28], [0, -0.015, -0.14])
    const beam = cluster.build()
    holder.add(beam)
    c.animate(holder, (seconds) => { beam.rotation.y = seconds * 1.4 })
  },
  airport: (f, c) => {
    f.box('#c9ced6', [1.92, 0.02, 1.92], [0, 0, 0])
    f.box('#5d6470', [1.84, 0.012, 0.44], [0, 0.02, -0.56])
    for (let n = 0; n < 6; n += 1) f.box('#ffffff', [0.14, 0.004, 0.03], [-0.75 + n * 0.3, 0.032, -0.56])
    // ひこうき。
    f.box('#ffffff', [0.62, 0.09, 0.1], [0, 0.05, -0.56])
    f.ball('#ffffff', 0.05, [0.31, 0.095, -0.56], 1)
    f.box('#4dabf7', [0.14, 0.015, 0.62], [0.02, 0.08, -0.56])
    f.box('#e8590c', [0.08, 0.13, 0.015], [-0.27, 0.13, -0.56])
    f.box('#4dabf7', [0.08, 0.012, 0.24], [-0.27, 0.12, -0.56])
    f.box(windowMat(f, c), [0.4, 0.025, 0.104], [0.02, 0.1, -0.56])
    // ターミナルと かんせいとう。
    f.box('#eef3fb', [1.2, 0.36, 0.56], [-0.3, 0.02, 0.5])
    f.box('#4f78a8', [1.26, 0.05, 0.62], [-0.3, 0.38, 0.5])
    frontWindows(f, c, 0.56, grid([-0.75, -0.5, -0.25, 0, 0.15], [0.26], 0.16, 0.12), 0.5)
    door(f, '#6a7fb3', 0.16, 0.16, -0.3, 0.56, 0.5)
    f.cyl('#eef3fb', 0.07, 0.8, [0.7, 0.02, 0.45], 10)
    f.cyl(windowMat(f, c), 0.13, 0.1, [0.7, 0.82, 0.45], 10)
    f.cyl('#4f78a8', 0.15, 0.04, [0.7, 0.92, 0.45], 10)
    f.ball(f.kit.glow('red'), 0.025, [0.7, 0.99, 0.45], 1)
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
    // ふきあがる みずと、まわりに おちる しずく（4つを 1かいで えがく）。
    const water = f.kit.mat('#9ee3ff', { opacity: 0.8, rough: 0.2 })
    const spray = f.group([0, 0.3, 0])
    const jet = f.kit.mesh(f.kit.cyl(8, 0.35), water, [0, 0, 0], [0.035, 0.2, 0.035], [0, 0, 0], false)
    spray.add(jet)
    const drops = f.kit.instanced(f.kit.ball(1), water, 4, false)
    spray.add(drops)
    c.animate(spray, (seconds) => {
      jet.scale.y = 0.2 * (1 + Math.sin(seconds * 5) * 0.2)
      for (let index = 0; index < 4; index += 1) {
        const phase = (seconds * 0.9 + index / 4) % 1
        const angle = (index * Math.PI) / 2 + Math.PI / 4
        const radius = 0.1 + phase * 0.17
        setInstance(drops, index, Math.cos(angle) * radius, 0.14 * Math.sin(Math.PI * phase) - 0.2 * phase, Math.sin(angle) * radius, 0.025)
      }
      drops.instanceMatrix.needsUpdate = true
    })
  },
  beach: (f) => {
    f.box('#f6dfa0', [0.9, 0.03, 0.9], [0, 0, 0])
    f.box(f.kit.mat('#5bbde8', { rough: 0.18 }), [0.9, 0.012, 0.22], [0, 0.03, 0.34])
    f.cyl('#8d5a2b', 0.012, 0.36, [0.05, 0.03, -0.05], 6)
    f.cone('#ff6b6b', 0.24, 0.1, [0.05, 0.36, -0.05], 8)
    f.box('#4dabf7', [0.16, 0.01, 0.28], [-0.22, 0.03, -0.05], [0, 0.15, 0])
    f.ball('#ffd43b', 0.05, [0.26, 0.08, 0.1], 1)
  },
  ranch: (f) => {
    f.box('#b2e08a', [1.9, 0.02, 0.88], [0, 0, 0])
    f.box('#d9480f', [0.5, 0.38, 0.46], [-0.62, 0.02, 0])
    f.gable('#a61e4d', [0.56, 0.18, 0.52], [-0.62, 0.4, 0])
    f.box('#ffffff', [0.18, 0.22, 0.02], [-0.62, 0.02, 0.235])
    fence(f, -0.25, 0.9, -0.38, 0.38)
    cow(f, 0.1, 0.05, 0.8)
    cow(f, 0.55, -0.12, -1.2)
    f.cyl('#f6dfa0', 0.06, 0.1, [0.72, 0.08, 0.2], 10, 1, [0, 0, Math.PI / 2])
  },
  forest: (f) => {
    f.box('#7fbf5a', [1.86, 0.02, 1.86], [0, 0, 0])
    for (const [cx, cy, r, leaves] of FOREST_TREES) tree(f, leaves, '#9be29b', cx / 100 - 1, cy / 100 - 1, (r / 24) * 1.25)
    f.cyl('#fff3d6', 0.015, 0.05, [0.62, 0.02, 0.72], 6)
    f.put(f.kit.ball(1), '#e03131', [0.62, 0.07, 0.72], [0.05, 0.03, 0.05])
  },
  mountain: (f) => {
    f.cone('#94b86f', 0.78, 1.3, [-0.2, 0, 0.18], 10)
    f.cone('#ffffff', 0.25, 0.42, [-0.2, 0.88, 0.18], 10)
    f.cone('#7c9a5e', 0.66, 1.0, [0.38, 0, -0.38], 10)
    f.cone('#ffffff', 0.22, 0.33, [0.38, 0.67, -0.38], 10)
    for (const [x, z] of [[-0.8, 0.8], [0.78, 0.72], [0.82, 0.2], [-0.75, -0.75]] as const) tree(f, '#3f7d34', '#5cb85c', x, z, 0.75)
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
    // むきを もつ はこの なかで まわす（はこ じたいの かいてんを かきかえない）。わは 1つに まとめる。
    const holder = f.group([0, 0.62, 0])
    const { frame: m, flat, cluster } = kit.moving()
    m.put(kit.torus(0.42, 0.016), '#e05d8f', [0, 0, 0], [1, 1, 1])
    m.put(kit.torus(0.2, 0.012), '#e05d8f', [0, 0, 0], [1, 1, 1])
    for (let n = 0; n < 4; n += 1) {
      const angle = (n * Math.PI) / 4
      m.box('#e05d8f', [0.012, 0.84, 0.012], [0.42 * Math.sin(angle), -0.42 * Math.cos(angle), 0], [0, 0, angle])
    }
    for (let n = 0; n < 8; n += 1) {
      const angle = ((n + 0.5) * Math.PI) / 4
      flat.ball(kit.glow('bulb'), 0.022, [Math.cos(angle) * 0.42, Math.sin(angle) * 0.42, 0.02], 1)
    }
    m.ball('#ffffff', 0.045, [0, 0, 0], 0)
    const wheel = cluster.build()
    holder.add(wheel)
    // ゴンドラは いつも まっすぐ さがる ので、わと べつに 8つを 1かいで えがく。
    const bodies = kit.instanced(kit.box(), kit.mat('#ffffff'), GONDOLA_COLORS.length)
    GONDOLA_COLORS.forEach((color, index) => bodies.setColorAt(index, scratch.color.set(color)))
    const glass = kit.instanced(kit.box(), windowMat(f, c), GONDOLA_COLORS.length, false)
    const rods = kit.instanced(kit.box(), '#46404f', GONDOLA_COLORS.length, false)
    holder.add(bodies, glass, rods)
    c.animate(holder, (seconds) => {
      wheel.rotation.z = seconds * 0.25
      for (let index = 0; index < GONDOLA_COLORS.length; index += 1) {
        const angle = (index * Math.PI) / 4 + wheel.rotation.z
        const x = Math.cos(angle) * 0.42
        const y = Math.sin(angle) * 0.42
        setInstance(rods, index, x, y - 0.04, 0, 0.008, 0.04, 0.008)
        setInstance(bodies, index, x, y - 0.12, 0, 0.09, 0.08, 0.09)
        setInstance(glass, index, x, y - 0.1, 0, 0.095, 0.03, 0.07)
      }
      for (const mesh of [rods, bodies, glass]) mesh.instanceMatrix.needsUpdate = true
    })
  },
  merry: (f, c) => {
    f.cyl('#f3d9fa', 0.42, 0.06, [0, 0, 0], 20)
    f.cyl('#ffd43b', 0.035, 0.62, [0, 0.06, 0], 8)
    // うまと やねが いっしょに まわる。
    const holder = f.group([0, 0.06, 0])
    const kit = f.kit
    const { frame: m, flat, cluster } = kit.moving()
    m.cone('#e64980', 0.46, 0.2, [0, 0.44, 0], 12)
    m.cyl('#ffffff', 0.465, 0.04, [0, 0.4, 0], 20)
    HORSE_COLORS.forEach((color, index) => {
      const angle = (index / HORSE_COLORS.length) * Math.PI * 2
      const x = Math.cos(angle) * 0.3
      const z = Math.sin(angle) * 0.3
      const y = 0.14 + (index % 2) * 0.05
      m.cyl('#ffd43b', 0.01, 0.36, [x, 0.02, z], 6)
      m.box(color, [0.06, 0.06, 0.14], [x, y, z], [0, -angle, 0])
      m.box(color, [0.04, 0.07, 0.04], [x - Math.sin(angle) * 0.07, y + 0.04, z + Math.cos(angle) * 0.07], [0, -angle, 0])
    })
    for (let n = 0; n < 12; n += 1) {
      const angle = (n / 12) * Math.PI * 2
      flat.ball(kit.glow('bulb'), 0.018, [Math.cos(angle) * 0.47, 0.42, Math.sin(angle) * 0.47], 1)
    }
    const top = cluster.build()
    holder.add(top)
    c.animate(holder, (seconds) => { top.rotation.y = seconds * 0.8 })
  },
  circus: (f) => {
    f.cyl('#ffffff', 0.38, 0.3, [0, 0, 0], 12)
    for (let n = 0; n < 6; n += 1) {
      const angle = (n / 6) * Math.PI * 2 + Math.PI / 6
      f.box('#e03131', [0.12, 0.3, 0.02], [Math.sin(angle) * 0.372, 0, Math.cos(angle) * 0.372], [0, angle, 0])
    }
    f.cone('#4c6ef5', 0.43, 0.32, [0, 0.3, 0], 12)
    f.cyl('#46404f', 0.008, 0.16, [0, 0.6, 0], 4)
    f.box('#ffd43b', [0.08, 0.05, 0.008], [0.04, 0.7, 0])
    f.box('#46404f', [0.14, 0.2, 0.02], [0, 0, 0.39])
    for (let n = 0; n < 10; n += 1) {
      const angle = (n / 10) * Math.PI * 2
      f.ball(f.kit.glow('bulb'), 0.018, [Math.cos(angle) * 0.42, 0.31, Math.sin(angle) * 0.42], 1)
    }
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
    const holder = f.group([0, 0.47, 0.2])
    const { frame: m, cluster } = f.kit.moving()
    m.ball('#6d6875', 0.04, [0, 0, 0], 0)
    for (let n = 0; n < 4; n += 1) {
      const angle = (n * Math.PI) / 2
      m.box('#ffffff', [0.07, 0.3, 0.012], [-0.03 * Math.sin(angle), 0.03 * Math.cos(angle), 0], [0, 0, angle])
    }
    const blades = cluster.build()
    holder.add(blades)
    c.animate(holder, (seconds) => { blades.rotation.z = -seconds * 0.9 })
  },
  rocket: (f, c) => {
    f.cyl('#868e96', 0.32, 0.05, [0, 0, 0], 12)
    f.box('#adb5bd', [0.06, 0.9, 0.06], [0.27, 0.05, 0])
    for (const y of [0.4, 0.7]) f.box('#adb5bd', [0.14, 0.03, 0.03], [0.2, y, 0])
    f.cyl('#46404f', 0.07, 0.06, [0, 0.09, 0], 10)
    f.cyl('#ffffff', 0.11, 0.66, [0, 0.15, 0], 14)
    f.cone('#e03131', 0.11, 0.24, [0, 0.81, 0], 14)
    f.cyl(windowMat(f, c), 0.045, 0.012, [0, 0.62, 0.105], 12, 1, [Math.PI / 2, 0, 0])
    for (let n = 0; n < 3; n += 1) {
      const angle = (n / 3) * Math.PI * 2
      f.box('#e03131', [0.014, 0.17, 0.12], [Math.sin(angle) * 0.13, 0.15, Math.cos(angle) * 0.13], [0, angle, 0])
    }
    // ほのおが ちらちら ゆれる。
    const holder = f.group([0, 0.09, 0])
    const flame = f.kit.mesh(f.kit.cone(8), f.kit.glow('fire'), [0, 0, 0], [0.06, 0.12, 0.06], [Math.PI, 0, 0], false)
    holder.add(flame)
    c.animate(holder, (seconds) => { flame.scale.y = 0.12 * (1 + Math.sin(seconds * 17) * 0.25) })
  },
  pool: (f) => {
    f.box('#f1e3c6', [1.9, 0.04, 0.86], [0, 0, 0])
    f.box('#ffffff', [1.6, 0.05, 0.56], [0, 0, 0])
    f.box(f.kit.mat('#4dc3f0', { rough: 0.1 }), [1.5, 0.054, 0.46], [0, 0, 0])
    for (const z of [-0.08, 0.08]) f.box('#ff8787', [1.48, 0.012, 0.012], [0, 0.055, z])
    f.put(f.kit.torus(1, 0.3), '#ff6b6b', [0.3, 0.06, 0.12], [0.05, 0.05, 0.05], [Math.PI / 2, 0, 0])
    f.ball('#ffd43b', 0.04, [-0.2, 0.07, -0.12], 1)
    for (const x of [0.66, 0.74]) f.box('#adb5bd', [0.012, 0.14, 0.012], [x, 0.04, -0.27])
    f.box('#ff922b', [0.1, 0.02, 0.42], [-0.82, 0.04, 0.08], [0.35, 0, 0])
    f.cyl('#8d5a2b', 0.01, 0.3, [-0.85, 0.04, -0.32], 6)
    f.cone('#ffd43b', 0.14, 0.07, [-0.85, 0.32, -0.32], 8)
  },
  coaster: (f, c) => {
    f.box('#cfe8a5', [1.9, 0.02, 1.9], [0, 0, 0])
    // ぐるっと 1しゅうする せんろと はしら。
    const steps = 48
    for (let n = 0; n < steps; n += 1) {
      const a = coasterPoint(n / steps)
      const b = coasterPoint((n + 1) / steps)
      const direction = b.clone().sub(a)
      const length = direction.length()
      const quaternion = new THREE.Quaternion().setFromUnitVectors(FORWARD, direction.normalize())
      const matrix = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5).setY((a.y + b.y) / 2 - 0.0125), quaternion, new THREE.Vector3(0.08, 0.025, length + 0.01))
      f.kit.place(f.kit.box(), '#e03131', f.base.clone().multiply(matrix))
      if (n % 4 === 0) f.cyl('#adb5bd', 0.012, a.y, [a.x, 0, a.z], 6)
    }
    f.box('#f08c00', [0.34, 0.1, 0.2], [-0.62, 0.02, 0.72])
    // はしる くるま（2りょう）。
    const holder = f.group()
    const cars = ['#fcc419', '#4dabf7'].map((color) => {
      const { frame: m, cluster } = f.kit.moving()
      m.box(color, [0.1, 0.06, 0.15], [0, 0, 0])
      m.box('#46404f', [0.08, 0.02, 0.06], [0, 0.06, 0.02])
      const car = cluster.build()
      holder.add(car)
      return car
    })
    const heading = new THREE.Vector3()
    c.animate(holder, (seconds) => {
      cars.forEach((car, index) => {
        const t = (seconds * 0.11 + c.noise(7) - index * 0.03 + 1) % 1
        const at = coasterPoint(t)
        car.position.copy(at)
        car.quaternion.setFromUnitVectors(FORWARD, heading.copy(coasterPoint((t + 0.01) % 1)).sub(at).normalize())
      })
    })
  },
  stadium: (f) => {
    f.cyl('#d0d7e2', 0.92, 0.22, [0, 0, 0], 32)
    f.cyl('#4dabf7', 0.8, 0.004, [0, 0.22, 0], 32)
    f.cyl('#a5d8ff', 0.7, 0.006, [0, 0.22, 0], 32)
    f.cyl('#69c048', 0.6, 0.01, [0, 0.222, 0], 32)
    for (const x of [-0.42, 0, 0.42]) f.box('#ffffff', [0.012, 0.004, 0.62], [x, 0.232, 0])
    for (const z of [-0.31, 0.31]) f.box('#ffffff', [0.84, 0.004, 0.012], [0, 0.232, z])
    for (const x of [-0.4, 0.4]) f.box('#ffffff', [0.02, 0.06, 0.14], [x, 0.232, 0])
    f.ball('#ffffff', 0.025, [0.12, 0.257, 0.05], 1)
    for (const [x, z] of [[-0.86, -0.86], [0.86, -0.86], [-0.86, 0.86], [0.86, 0.86]] as const) {
      f.cyl('#6d6875', 0.02, 0.7, [x, 0, z], 6)
      f.box(f.kit.glow('bulb'), [0.16, 0.08, 0.03], [x, 0.7, z], [0, Math.atan2(-x, -z), 0])
    }
  },
  zoo: (f) => {
    const pond = f.kit.mat('#5bbde8', { rough: 0.15 })
    f.box('#cfe8a5', [1.9, 0.02, 1.9], [0, 0, 0])
    f.box('#f1d9a6', [0.16, 0.012, 0.9], [0, 0.02, 0.5])
    f.box('#f1d9a6', [1.6, 0.012, 0.16], [0, 0.02, 0.04])
    // きりん
    fence(f, -0.86, -0.14, -0.86, -0.14)
    for (const [x, z] of [[-0.58, -0.54], [-0.42, -0.54], [-0.58, -0.46], [-0.42, -0.46]] as const) f.box('#c07a2c', [0.025, 0.18, 0.025], [x, 0, z])
    f.box('#f4c542', [0.22, 0.1, 0.12], [-0.5, 0.17, -0.5])
    f.box('#f4c542', [0.05, 0.34, 0.05], [-0.4, 0.22, -0.5], [0, 0, -0.35])
    f.box('#f4c542', [0.1, 0.05, 0.06], [-0.32, 0.53, -0.5])
    // ぞう
    fence(f, 0.14, 0.86, -0.86, -0.14)
    for (const [x, z] of [[0.44, -0.56], [0.6, -0.56], [0.44, -0.44], [0.6, -0.44]] as const) f.cyl('#9aa5b1', 0.03, 0.12, [x, 0, z], 8)
    f.ball('#9aa5b1', 0.14, [0.52, 0.2, -0.5], 1, 0.8)
    f.ball('#9aa5b1', 0.08, [0.36, 0.26, -0.5], 1)
    f.cyl('#8a95a1', 0.022, 0.16, [0.3, 0.06, -0.5], 6)
    for (const z of [-0.58, -0.42]) f.put(f.kit.ball(1), '#b6c0cb', [0.38, 0.26, z], [0.02, 0.07, 0.05])
    // ライオン
    fence(f, -0.86, -0.14, 0.18, 0.86)
    f.box('#f4b942', [0.2, 0.08, 0.08], [-0.45, 0.06, 0.55])
    f.ball('#c8641e', 0.07, [-0.58, 0.13, 0.55], 1)
    f.ball('#f4c542', 0.045, [-0.62, 0.13, 0.55], 1)
    // ペンギンの いけ
    f.cyl(pond, 0.3, 0.03, [0.5, 0.02, 0.52], 20)
    for (const [x, z] of [[0.42, 0.46], [0.58, 0.6], [0.66, 0.4]] as const) {
      f.cyl('#2b2d42', 0.03, 0.09, [x, 0.04, z], 8)
      f.ball('#ffffff', 0.022, [x, 0.08, z + 0.02], 0)
    }
    // いりぐち
    for (const x of [-0.12, 0.12]) f.box('#8d5a2b', [0.04, 0.24, 0.04], [x, 0, 0.88])
    f.box('#f08c00', [0.34, 0.08, 0.04], [0, 0.24, 0.88])
  },
  igloo: (f, c) => {
    f.ball('#eef7ff', 0.36, [0, 0, 0], 1, 0.82)
    f.cyl('#dcebf7', 0.13, 0.16, [0, 0, 0.3], 10, 0.9)
    door(f, '#5b6b82', 0.13, 0.13, 0, 0.52, 0.17)
    f.box(windowMat(f, c), [0.08, 0.06, 0.02], [0, 0.05, 0.435])
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
