import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { hitBlock } from './raycast'
import { createWorld, materialDef, World, type Block, type Position } from './world'

function legacyRaycast(blocks: readonly Block[]) {
  const geometry = new THREE.BoxGeometry(0.97, 0.97, 0.97)
  const material = new THREE.MeshBasicMaterial()
  const mesh = new THREE.InstancedMesh(geometry, material, blocks.length)
  const matrix = new THREE.Matrix4()
  blocks.forEach(({ x, y, z, material }, index) => {
    const def = materialDef(material)
    const height = def.height ?? 0.6
    if (def.plant) matrix.makeScale(0.45, height, 0.45).setPosition(x, y - 0.485 * (1 - height), z)
    else matrix.makeTranslation(x, y, z)
    mesh.setMatrixAt(index, matrix)
  })
  return {
    cast(origin: THREE.Vector3, direction: THREE.Vector3, far = Infinity) {
      const hit = new THREE.Raycaster(origin, direction, 0, far).intersectObject(mesh)[0]
      if (!hit) return null
      const { x, y, z } = blocks[hit.instanceId!]
      const normal = hit.face!.normal
      return { position: { x, y, z }, distance: hit.distance, normal: { x: normal.x || 0, y: normal.y || 0, z: normal.z || 0 } }
    },
    dispose() { mesh.dispose(); material.dispose(); geometry.dispose() },
  }
}

it('matches Three front faces, angles, plants, translucent boxes, gaps and the reach limit', () => {
  const world = createWorld()
  const blocks = [...world.blocks(), { x: 8, y: 7, z: 8, material: 'glass' } as const, { x: 9, y: 7, z: 8, material: 'ice' } as const]
  const grid = new World(world, blocks)
  const legacy = legacyRaycast(blocks)
  const compare = (from: Position, toward: Position, far = Infinity) => {
    const origin = new THREE.Vector3(from.x, from.y, from.z)
    const direction = new THREE.Vector3(toward.x, toward.y, toward.z).normalize()
    const expected = legacy.cast(origin, direction, far)
    const actual = hitBlock(grid, origin, direction, far)
    if (!expected) expect(actual).toBeNull()
    else {
      expect(actual?.position).toEqual(expected.position)
      expect(actual?.normal).toEqual(expected.normal)
      expect(actual?.distance).toBeCloseTo(expected.distance, 6)
    }
  }
  try {
    compare({ x: 8.49, y: 10, z: 8 }, { x: 0, y: -1, z: 0 })
    compare({ x: 8, y: 10, z: 8 }, { x: 0, y: -1, z: 0 }) // top, glass
    compare({ x: 8, y: 4, z: 8 }, { x: 0, y: 1, z: 0 }) // underside
    compare({ x: 8, y: 7, z: 8 }, { x: 0, y: 1, z: 0 }) // inside, front faces only
    compare({ x: 15, y: 7, z: 8 }, { x: -1, y: 0, z: 0 }) // side, ice
    compare({ x: 9, y: 7, z: 10 }, { x: -1, y: 0, z: -2 }) // diagonal
    compare({ x: 7, y: 8, z: 7 }, { x: 1, y: -1, z: 1 }) // corner
    compare({ x: 6, y: 10, z: 9 }, { x: 0, y: -1, z: 0 }) // flower
    compare({ x: 6.35, y: 10, z: 9 }, { x: 0, y: -1, z: 0 }) // beside flower
    compare({ x: 8, y: 16, z: 8 }, { x: 0, y: -1, z: 0 }, 7)
    compare({ x: 8, y: 14, z: 8 }, { x: 0, y: -1, z: 0 }, 7)
    let seed = 321
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
    for (let i = 0; i < 128; i++) {
      compare({ x: random() * 30 - 7, y: 8 + random() * 12, z: random() * 30 - 7 },
        { x: random() - 0.5, y: -0.5, z: random() - 0.5 })
    }
  } finally { legacy.dispose() }
})

it('visits the same cells for a fixed local ray even with more terrain outside its reach', () => {
  const counts = [16, 64, 128].map(size => {
    const world = createWorld({ size, height: 24 })
    const visits = vi.spyOn(world, 'codeAt')
    const hit = hitBlock(world, { x: 5, y: 8, z: size - 1 }, { x: 0, y: -1, z: 0 }, 7)
    expect(hit?.position.y).toBe(2)
    return visits.mock.calls.length
  })
  expect(counts).toEqual([7, 7, 7])
})

it('can see a block through diagonal gaps even when all six neighbors are opaque', () => {
  const center = { x: 8, y: 5, z: 8 }
  const blocks: Block[] = [{ ...center, material: 'gold' }]
  for (const axis of ['x', 'y', 'z'] as const) for (const side of [-1, 1]) {
    blocks.push({ ...center, [axis]: center[axis] + side, material: 'stone' })
  }
  const world = new World({ size: 64, height: 12 }, blocks)
  const origin = new THREE.Vector3(10, 7, 8)
  const direction = new THREE.Vector3(-1, -1, 0).normalize()
  const legacy = legacyRaycast(blocks)
  try {
    expect(legacy.cast(origin, direction)?.position).toEqual(center)
    expect(hitBlock(world, origin, direction)?.position).toEqual(center)
  } finally { legacy.dispose() }
})
