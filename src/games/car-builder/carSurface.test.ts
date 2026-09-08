import { readFile } from 'node:fs/promises'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { describe, expect, test } from 'vitest'
import { CAR_VEHICLES, CAR_VEHICLE_ORDER } from './carVehicles'
import { DEFAULT_CAR_CONFIG } from './carConfig'
import { computeCarAttachments, computeCarDimensions } from './carDimensions'
import { CAR_PART_BUILDERS, disposeCarObject } from './carParts'
import { createCarSurface } from './carSurface'

describe('実車体への取り付け', () => {
  test.each(CAR_VEHICLE_ORDER)('%s: 全ライト・車高で実GLBに接する', async (body) => {
    const file = await readFile(`public/models/car-builder/${CAR_VEHICLES[body].modelFile}`)
    const gltf = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer, '')
    for (const wheel of ['small', 'big', 'offroad', 'racing', 'whitewall', 'flower'] as const) {
      for (const rideHeight of ['low', 'normal', 'high'] as const) {
        for (const front of ['round', 'square', 'slim', 'twin'] as const) {
          const config = { ...DEFAULT_CAR_CONFIG, body, wheel, rideHeight, front }
          const dimensions = computeCarDimensions(config)
          const attachments = computeCarAttachments(dimensions)
          const surface = createCarSurface(gltf.scene, dimensions.bodyLift)
          const part = CAR_PART_BUILDERS.front[front]({ config, dimensions, attachments, surface, color: '#ff0000' })!
          for (const child of part.children) {
            const probe = new THREE.Vector3(child.position.x, child.position.y, 10)
            const hit = surface(probe, new THREE.Vector3(0, 0, 1))
            expect(hit.z, `${body}/${front}/${child.name}: surface exists`).toBeLessThan(5)
            expect(Math.abs(child.position.z - hit.z), `${body}/${front}/${child.name}: mounted`).toBeLessThan(0.07)
          }
          disposeCarObject(part)
          // Other categories use the same real shell, including the lower roof behind a sign.
          for (const roof of ['policeLight', 'luggage', 'spoiler', 'rabbit', 'surfboard'] as const) {
            const roofPart = CAR_PART_BUILDERS.roof[roof]({ config: { ...config, roof }, dimensions, attachments, surface, color: '#ff0000' })!
            const supports = roofPart.children.filter((child) => child.name.includes('support') || child.name === 'car-roof-luggage' || child.name.endsWith('-base'))
            for (const support of supports) {
              const box = new THREE.Box3().setFromObject(support)
              const center = box.getCenter(new THREE.Vector3())
              const hit = surface(new THREE.Vector3(center.x, 10, center.z), new THREE.Vector3(0, 1, 0))
              expect(hit.y, `${body}/${roof}: roof exists`).toBeLessThan(5)
              expect(Math.abs(box.min.y - hit.y), `${body}/${roof}: foot touches roof`).toBeLessThan(0.035)
            }
            disposeCarObject(roofPart)
          }
        }
      }
    }
    disposeCarObject(gltf.scene)
  })

  test('親の車高移動を二重加算しない・看板は屋根として扱わない', () => {
    const group = new THREE.Group()
    const shell = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshBasicMaterial())
    shell.material.name = 'Body'
    shell.position.y = 1
    const sign = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial())
    sign.material.name = 'SignPlate'
    sign.position.y = 2
    group.add(shell, sign)
    const parent = new THREE.Group()
    parent.position.y = 0.2
    parent.add(group)
    const hit = createCarSurface(group, 0.2)(new THREE.Vector3(0, 3, 0), new THREE.Vector3(0, 1, 0))
    expect(hit.y).toBeCloseTo(1.7)
    disposeCarObject(group)
  })
})
