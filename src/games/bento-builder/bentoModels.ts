import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { CUPS, type CupKind, DIVIDER_HALF, FLOOR_Y, FOODS, HALF_DEPTH, HALF_WIDTH, ROUND_RADIUS, type BoxKind, type FoodDefinition, type FoodKind } from './bentoState'

const BENTO_LINING_COLOR = '#f3e5c8'

function mesh(geometry: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.75 }))
  object.position.set(x, y, z)
  object.castShadow = true
  object.receiveShadow = true
  return object
}
function rounded(w: number, h: number, d: number, color: string, x = 0, y = 0, z = 0, radius = 0.1) {
  return mesh(new RoundedBoxGeometry(w, h, d, 2, radius), color, x, y, z)
}
export function createBox(kind: BoxKind, color: string): THREE.Group {
  const root = new THREE.Group()
  if (kind === 'round') {
    root.add(mesh(new THREE.CylinderGeometry(ROUND_RADIUS + 0.2, ROUND_RADIUS + 0.18, FLOOR_Y, 64), color, 0, FLOOR_Y / 2))
    const shape = new THREE.Shape()
    shape.absarc(0, 0, ROUND_RADIUS + 0.2, 0, Math.PI * 2, false)
    const hole = new THREE.Path()
    hole.absarc(0, 0, ROUND_RADIUS, 0, Math.PI * 2, true)
    shape.holes.push(hole)
    const wall = mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.48, bevelEnabled: true, bevelSize: 0.035, bevelThickness: 0.035, bevelSegments: 2, steps: 1, curveSegments: 32 }), color)
    wall.rotation.x = -Math.PI / 2
    wall.position.y = FLOOR_Y
    root.add(wall)
    const lining = mesh(new THREE.CircleGeometry(ROUND_RADIUS - 0.015, 64), BENTO_LINING_COLOR, 0, FLOOR_Y + 0.004)
    lining.rotation.x = -Math.PI / 2
    root.add(lining)
  } else {
    root.add(rounded(HALF_WIDTH * 2 + 0.4, FLOOR_Y, HALF_DEPTH * 2 + 0.4, color, 0, FLOOR_Y / 2))
    root.add(rounded(HALF_WIDTH * 2 - 0.02, 0.02, HALF_DEPTH * 2 - 0.02, BENTO_LINING_COLOR, 0, FLOOR_Y - 0.006, 0))
    for (const side of [-1, 1]) {
      root.add(rounded(0.2, 0.58, HALF_DEPTH * 2 + 0.4, color, side * (HALF_WIDTH + 0.1), 0.39))
      root.add(rounded(HALF_WIDTH * 2, 0.58, 0.2, color, 0, 0.39, side * (HALF_DEPTH + 0.1)))
    }
    if (kind === 'divided') root.add(rounded(DIVIDER_HALF * 2, 0.48, HALF_DEPTH * 2, color, 0, FLOOR_Y + 0.24, 0, 0.06))
  }
  return root
}

/** Bento foods the pack does not cover, built from flat-shaded primitives so they
 * sit beside the imported low-poly models without looking like a different set.
 * The pack's hotdog includes a bun and its chicken leg keeps the bone, so even the
 * shapes it does ship cannot stand in for single bento pieces. */
const HANDMADE: Partial<Record<FoodKind, (root: THREE.Group) => void>> = {
  onigiri(root) {
    const triangle = new THREE.Shape()
    triangle.moveTo(-0.5, 0.04)
    triangle.quadraticCurveTo(-0.62, 0.08, -0.48, 0.29)
    triangle.lineTo(-0.1, 0.86)
    triangle.quadraticCurveTo(0, 1, 0.1, 0.86)
    triangle.lineTo(0.48, 0.29)
    triangle.quadraticCurveTo(0.62, 0.04, 0.43, 0.04)
    triangle.closePath()
    const rice = mesh(new THREE.ExtrudeGeometry(triangle, { depth: 0.36, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 2, steps: 1 }), '#fffaf0', 0, 0, -0.18)
    root.add(rice, rounded(0.36, 0.4, 0.51, '#24463b', 0, 0.21, 0, 0.035))
  },
  sausage(root) {
    const sausage = mesh(new THREE.CapsuleGeometry(0.22, 0.6, 3, 10), '#d66542', 0, 0.24)
    sausage.rotation.z = Math.PI / 2
    root.add(sausage)
    for (const x of [-0.22, 0, 0.22]) {
      const cut = rounded(0.035, 0.016, 0.21, '#f6b77b', x, 0.457, 0, 0.006)
      cut.rotation.y = 0.35
      root.add(cut)
    }
  },
  chicken(root) {
    const chunks = [[0, 0.29, 0, 0.36], [-0.2, 0.23, 0.09, 0.24], [0.18, 0.25, 0.13, 0.25], [0.03, 0.35, -0.13, 0.26]]
    chunks.forEach(([x, y, z, radius], index) => root.add(mesh(new THREE.IcosahedronGeometry(radius!, 1), index % 2 ? '#c58436' : '#dc9d47', x, y, z)))
  },
  carrot(root) {
    // A cone reads as a flat triangle once the carrot is laid on its side.
    // Use a softly bulging profile so the root stays round and recognisable.
    const profile = [
      new THREE.Vector2(0.015, 0),
      new THREE.Vector2(0.09, 0.13),
      new THREE.Vector2(0.19, 0.38),
      new THREE.Vector2(0.285, 0.66),
      new THREE.Vector2(0.29, 0.75),
      new THREE.Vector2(0.22, 0.82),
      new THREE.Vector2(0, 0.84),
    ]
    const carrot = mesh(new THREE.LatheGeometry(profile, 12), '#ff8a3d')
    root.add(carrot)
    for (const [x, angle, scale] of [[-0.13, -0.35, 0.92], [0, 0, 1.08], [0.13, 0.35, 0.92]] as const) {
      const leaf = mesh(new THREE.SphereGeometry(0.16, 8, 6), '#43a83c', x, 1.02)
      leaf.scale.set(0.62, 1.45 * scale, 0.48)
      leaf.rotation.z = angle
      root.add(leaf)
    }
  },
  shrimp(root) {
    const body = mesh(new THREE.CapsuleGeometry(0.21, 0.66, 4, 12), '#dfa257', -0.11, 0.21)
    body.rotation.z = Math.PI / 2
    root.add(body)
    // Panko lumps, lighter than the coating, keep this from reading as another sausage.
    for (const [x, z, size] of [[-0.34, 0.03, 0.09], [-0.11, -0.1, 0.11], [0.12, 0.08, 0.1], [0.01, 0.12, 0.08], [-0.24, -0.11, 0.08]] as const) {
      root.add(mesh(new THREE.IcosahedronGeometry(size, 0), '#f0c485', x, 0.35, z))
    }
    // The tail fan lies flat, so it stays visible from the game's overhead camera.
    const fan = new THREE.Shape()
    fan.moveTo(0, 0)
    fan.lineTo(0.3, 0.26)
    fan.lineTo(0.37, 0.02)
    fan.lineTo(0.3, -0.26)
    fan.closePath()
    const tail = mesh(new THREE.ExtrudeGeometry(fan, { depth: 0.06, bevelEnabled: false }), '#ef8462', 0.19, 0.14)
    tail.rotation.x = -Math.PI / 2
    root.add(tail)
  },
  potato(root) {
    // Crossed sticks with one on top: a tidy parallel row would read as a single slab.
    const sticks = [
      [-0.16, 0.08, -0.2, 0.42, '#f3c454'], [0.12, 0.08, -0.02, -0.24, '#e7ad3b'],
      [-0.04, 0.08, 0.22, 0.12, '#f3c454'], [0, 0.24, 0.02, 0.75, '#eeba48'],
    ] as const
    for (const [x, y, z, angle, color] of sticks) {
      const stick = rounded(0.86, 0.16, 0.16, color, x, y, z, 0.05)
      stick.rotation.y = angle
      root.add(stick)
    }
  },
  cheese(root) {
    const wedge = new THREE.Shape()
    wedge.moveTo(-0.5, -0.3)
    wedge.lineTo(0.5, -0.3)
    wedge.lineTo(0, 0.46)
    wedge.closePath()
    // Extruded upright, the holes read as real holes from above rather than painted dots.
    for (const [x, y, radius] of [[-0.17, -0.14, 0.08], [0.18, -0.12, 0.07], [0, 0.07, 0.06]] as const) {
      const hole = new THREE.Path()
      hole.absarc(x, y, radius, 0, Math.PI * 2, true)
      wedge.holes.push(hole)
    }
    const block = mesh(new THREE.ExtrudeGeometry(wedge, { depth: 0.26, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, steps: 1, curveSegments: 12 }), '#f6c23c')
    block.rotation.x = -Math.PI / 2
    root.add(block)
  },
  corn(root) {
    // Every other quad of the cob sits proud, so the flat-shaded surface reads as rows
    // of kernels. One mesh keeps it cheap: each placed piece clones this geometry.
    const rows = 11
    const columns = 12
    const height = 1.02
    const point = (row: number, column: number) => {
      const along = row / rows
      const taper = (1 - Math.abs(2 * along - 1) ** 6) ** 0.32
      const radius = 0.205 * taper + (taper > 0.72 && (row + column) % 2 ? 0.032 : 0)
      const angle = column / columns * Math.PI * 2
      return [Math.cos(angle) * radius, along * height, Math.sin(angle) * radius]
    }
    const vertices: number[] = []
    for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const [a, b, c, d] = [point(row, column), point(row + 1, column), point(row + 1, column + 1), point(row, column + 1)]
      vertices.push(...a, ...b, ...c, ...a, ...c, ...d)
    }
    // Unindexed, so computeVertexNormals leaves every kernel facet crisply flat.
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.computeVertexNormals()
    const cob = mesh(geometry, '#f6cc3c', height / 2, 0.24)
    cob.rotation.z = Math.PI / 2
    root.add(cob)
  },
  cucumber(root) {
    for (const [x, z, lean, turn] of [[-0.3, 0.12, -0.5, 0.3], [0, -0.02, -0.42, 0.05], [0.3, 0.1, -0.34, -0.22]] as const) {
      const slice = new THREE.Group()
      // The pale core pokes through both faces of the darker skin, leaving a green rim.
      slice.add(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.09, 18), '#4f9b3d'))
      slice.add(mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.095, 18), '#dcefb6'))
      slice.rotation.set(Math.PI / 2 + lean, turn, 0)
      slice.position.set(x, 0.3, z)
      root.add(slice)
    }
  },
  strawberry(root) {
    // A sharp taper and a pinker red keep it apart from the round tomato model.
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.09, 0.06),
      new THREE.Vector2(0.18, 0.19),
      new THREE.Vector2(0.27, 0.4),
      new THREE.Vector2(0.33, 0.62),
      new THREE.Vector2(0.31, 0.78),
      new THREE.Vector2(0.16, 0.88),
      new THREE.Vector2(0, 0.9),
    ]
    root.add(mesh(new THREE.LatheGeometry(profile, 12), '#ef4a56'))
    for (let index = 0; index < 5; index++) {
      const angle = index * Math.PI * 2 / 5
      const leaf = mesh(new THREE.SphereGeometry(0.14, 6, 5), '#43a83c', Math.sin(angle) * 0.17, 0.87, Math.cos(angle) * 0.17)
      leaf.scale.set(0.42, 0.2, 1.25)
      // Tilt inside the leaf's own frame so every leaf lifts away from the berry.
      leaf.rotation.order = 'YXZ'
      leaf.rotation.set(-0.3, angle, 0)
      root.add(leaf)
    }
    root.add(mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.14, 6), '#43a83c', 0, 0.96))
  },
}
export function createHandmadeFood(kind: FoodKind): THREE.Group {
  const root = new THREE.Group()
  HANDMADE[kind]?.(root)
  return root
}

/** Shallow, fluted plastic cup. Its rim stays inside the food's placement radius. */
export function createFoodCup(radius: number, kind: CupKind): THREE.Group {
  const root = new THREE.Group()
  root.name = 'food-cup'
  const color = CUPS.find(cup => cup.id === kind)!.color
  const segments = 64
  const vertices: number[] = []
  const indices: number[] = []
  for (let row = 0; row < 2; row++) for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI * 2
    const r = radius * (row === 0 ? 0.76 : (i % 2 ? 0.94 : 1))
    vertices.push(Math.cos(angle) * r, row === 0 ? 0.018 : 0.18, Math.sin(angle) * r)
  }
  for (let i = 0; i < segments; i++) {
    const top = i + segments + 1
    indices.push(i, top, i + 1, i + 1, top, top + 1)
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  const wall = mesh(geometry, color)
  wall.material.side = THREE.DoubleSide
  wall.material.roughness = 0.5
  wall.castShadow = false
  const bottom = mesh(new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, 0.025, 48), color, 0, 0.0125)
  root.add(bottom, wall)
  return root
}

// Imported FBX materials carry dark colors and 40% metalness. Food is dielectric;
// use a fresh palette without increasing every light and washing out the rice.
const FOOD_PALETTE: Record<string, string> = {
  White: '#fff9e9', Yellow: '#ffd23f', Orange: '#ff9347',
  LightGreen: '#9ddd60', DarkGreen: '#43a83c', DarkRed: '#f34438',
}
export function freshenFoodMaterials(source: THREE.Object3D) {
  source.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      const color = FOOD_PALETTE[material.name]
      if (color) material.color.set(color)
      material.metalness = 0
      material.roughness = material.name === 'DarkRed' ? 0.38 : 0.68
    }
    // Avoid harsh self-shadow bands on small low-poly foods; they still cast a floor shadow.
    object.receiveShadow = false
  })
}

/** Center X/Z and put the actual lowest vertex on the floor, independent of source origins. */
export function normalizeFood(source: THREE.Object3D, definition: FoodDefinition): THREE.Group {
  const root = new THREE.Group()
  root.add(source)
  source.rotation.z += definition.tilt ?? 0
  source.updateMatrixWorld(true)
  let bounds = new THREE.Box3().setFromObject(source)
  const size = bounds.getSize(new THREE.Vector3())
  // Circle footprint remains valid for all 90° rotations, including long foods.
  const factor = definition.radius * 2 / Math.max(0.01, Math.hypot(size.x, size.z))
  source.scale.multiplyScalar(factor)
  source.updateMatrixWorld(true)
  bounds = new THREE.Box3().setFromObject(source)
  const center = bounds.getCenter(new THREE.Vector3())
  source.position.sub(new THREE.Vector3(center.x, bounds.min.y, center.z))
  source.traverse(object => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true
      object.receiveShadow = false
    }
  })
  root.updateMatrixWorld(true)
  return root
}

/** Each scene owns one template per food; clones share geometry/material and are freed together. */
export async function loadFoodTemplates(): Promise<Map<FoodKind, THREE.Group>> {
  const loader = new GLTFLoader()
  const results = await Promise.allSettled(FOODS.map(async definition => {
    const source = definition.model
      ? (await loader.loadAsync(`${import.meta.env.BASE_URL}models/bento-builder/${definition.model}`)).scene
      : createHandmadeFood(definition.id)
    freshenFoodMaterials(source)
    return [definition.id, normalizeFood(source, definition)] as const
  }))
  const templates = new Map<FoodKind, THREE.Group>()
  for (const result of results) if (result.status === 'fulfilled') templates.set(...result.value)
  if (results.some(result => result.status === 'rejected')) {
    disposeObjects([...templates.values()])
    throw new Error('Food models could not be loaded')
  }
  return templates
}

export function disposeObjects(roots: THREE.Object3D[]) {
  const geometries = new Set<THREE.BufferGeometry>()
  const materials = new Set<THREE.Material>()
  const textures = new Set<THREE.Texture>()
  for (const root of roots) root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    geometries.add(object.geometry)
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material)
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value)
    }
  })
  geometries.forEach(value => value.dispose())
  materials.forEach(value => value.dispose())
  textures.forEach(value => value.dispose())
}
