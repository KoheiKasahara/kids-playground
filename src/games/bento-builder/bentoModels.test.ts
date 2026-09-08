import { readFile } from 'node:fs/promises'
import { describe, expect, test } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { createFoodCup, freshenFoodMaterials, createHandmadeFood, disposeObjects, normalizeFood } from './bentoModels'
import { CUPS, FOODS } from './bentoState'

describe('実モデルと配置判定の整合性', () => {
  for (const food of FOODS) test(`${food.name}が接地し全回転で配置半径に収まる`, async () => {
    let source: THREE.Object3D
    if (food.model) {
      const file = await readFile(`public/models/bento-builder/${food.model}`)
      expect(file.byteLength).toBeLessThan(60_000)
      const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer
      source = (await new GLTFLoader().parseAsync(bytes, '')).scene
    } else source = createHandmadeFood(food.id)
    freshenFoodMaterials(source)
    source.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof THREE.MeshStandardMaterial) {
          expect(material.metalness).toBe(0)
          if (material.name === 'White') expect(material.color.getHexString()).toBe('fff9e9')
          if (material.name === 'DarkRed') expect(material.color.getHexString()).toBe('f34438')
        }
      }
    })
    const model = normalizeFood(source, food)
    for (let turn = 0; turn < 4; turn++) {
      model.rotation.y = turn * Math.PI / 2
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      expect(bounds.min.y).toBeCloseTo(0, 6)
      expect(bounds.max.y).toBeGreaterThan(0.03)
      expect(bounds.max.y).toBeLessThan(1.25)
      model.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return
        const positions = object.geometry.getAttribute('position')
        const vertex = new THREE.Vector3()
        for (let index = 0; index < positions.count; index++) {
          vertex.fromBufferAttribute(positions, index).applyMatrix4(object.matrixWorld)
          expect(Math.hypot(vertex.x, vertex.z)).toBeLessThanOrEqual(food.radius + 0.00001)
        }
      })
    }
    disposeObjects([model])
  })
})

test('全色・全サイズのカップが配置半径内に収まり浅い容器になる', () => {
  for (const food of FOODS) for (const kind of CUPS) {
    const cup = createFoodCup(food.radius, kind.id)
    cup.updateMatrixWorld(true)
    const bounds = new THREE.Box3().setFromObject(cup)
    expect(bounds.min.y).toBeCloseTo(0)
    expect(bounds.max.y).toBeCloseTo(0.18)
    cup.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return
      const positions = object.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld)
        expect(Math.hypot(vertex.x, vertex.z)).toBeLessThanOrEqual(food.radius + 0.00001)
      }
    })
    disposeObjects([cup])
  }
})
