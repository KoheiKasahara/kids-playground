import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DIVIDER_HALF, FLOOR_Y, FOODS, HALF_DEPTH, HALF_WIDTH, ROUND_RADIUS, type BoxKind, type FoodDefinition, type FoodKind } from './bentoState'

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
    const lining = mesh(new THREE.CircleGeometry(ROUND_RADIUS - 0.015, 64), '#fff7e1', 0, FLOOR_Y + 0.004)
    lining.rotation.x = -Math.PI / 2
    root.add(lining)
  } else {
    root.add(rounded(HALF_WIDTH * 2 + 0.4, FLOOR_Y, HALF_DEPTH * 2 + 0.4, color, 0, FLOOR_Y / 2))
    root.add(rounded(HALF_WIDTH * 2 - 0.02, 0.02, HALF_DEPTH * 2 - 0.02, '#fff7e1', 0, FLOOR_Y - 0.006, 0))
    for (const side of [-1, 1]) {
      root.add(rounded(0.2, 0.58, HALF_DEPTH * 2 + 0.4, color, side * (HALF_WIDTH + 0.1), 0.39))
      root.add(rounded(HALF_WIDTH * 2, 0.58, 0.2, color, 0, 0.39, side * (HALF_DEPTH + 0.1)))
    }
    if (kind === 'divided') root.add(rounded(DIVIDER_HALF * 2, 0.48, HALF_DEPTH * 2, color, 0, FLOOR_Y + 0.24, 0, 0.06))
  }
  return root
}

/** Three Japanese bento foods absent from the pack (hotdog includes a bun). */
export function createHandmadeFood(kind: FoodKind): THREE.Group {
  const root = new THREE.Group()
  if (kind === 'onigiri') {
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
  } else if (kind === 'sausage') {
    const sausage = mesh(new THREE.CapsuleGeometry(0.22, 0.6, 3, 10), '#d66542', 0, 0.24)
    sausage.rotation.z = Math.PI / 2
    root.add(sausage)
    for (const x of [-0.22, 0, 0.22]) {
      const cut = rounded(0.035, 0.016, 0.21, '#f6b77b', x, 0.457, 0, 0.006)
      cut.rotation.y = 0.35
      root.add(cut)
    }
  } else {
    const chunks = [[0, 0.29, 0, 0.36], [-0.2, 0.23, 0.09, 0.24], [0.18, 0.25, 0.13, 0.25], [0.03, 0.35, -0.13, 0.26]]
    chunks.forEach(([x, y, z, radius], index) => root.add(mesh(new THREE.IcosahedronGeometry(radius!, 1), index % 2 ? '#c58436' : '#dc9d47', x, y, z)))
  }
  return root
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
      object.receiveShadow = true
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
