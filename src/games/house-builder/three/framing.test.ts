import { describe, expect, test } from 'vitest'
import * as THREE from 'three'
import { EXTRAS, ROOFS, SHAPES, type RoofId, type ShapeId } from '../data'
import { createDesign } from '../plan'
import { buildExterior } from './exterior'
import { fitExterior } from './framing'

describe('house-builder exterior framing', () => {
  test('たてなが・よこなが がめんで まわしても、いえ・やね・ひろい にわが がめんに おさまる', () => {
    // かたちとやねの全種類を別々に通し、描画モデルの総当たりはしない。
    const designs: [ShapeId, RoofId][] = [
      ...SHAPES.map((shape): [ShapeId, RoofId] => [shape.id, 'shed']),
      ...ROOFS.filter((roof) => roof.id !== 'shed').map((roof): [ShapeId, RoofId] => ['square', roof.id]),
    ]
    for (const [shape, roof] of designs) {
      const base = createDesign('yonkai', shape)
      const built = buildExterior({ ...base, exterior: { ...base.exterior, roof, pool: 'rectangle', garden: 'orchard', parking: 'two', doghouse: 'red', extras: EXTRAS.map((extra) => extra.id) } })
      const points = built.framing!
      expect(points.length).toBeGreaterThan(0)
      for (const aspect of [.7, 1.4]) for (const yaw of [.42, 1.5, 3]) for (const pitch of [.3, .8]) {
        const camera = new THREE.PerspectiveCamera(38, aspect, .1, 400)
        const vfov = THREE.MathUtils.degToRad(camera.fov)
        const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
        const fitted = fitExterior(points, yaw, pitch, vfov, hfov)
        camera.position.copy(fitted.target).add(new THREE.Vector3().setFromSphericalCoords(fitted.distance, Math.PI / 2 - pitch, yaw))
        camera.lookAt(fitted.target)
        camera.updateMatrixWorld(true)
        const label = `${shape}/${roof}/${aspect}/${yaw}/${pitch}`
        const projected = points.map((point) => point.clone().project(camera))
        expect(projected.every((point) => Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z > -1 && point.z < 1), label).toBe(true)
      }
      built.dispose()
    }
  })

  test('カメラに おさめる はんいは えらんだ にわの ものを ふくみ、とおい くもを ふくめない', () => {
    const base = createDesign('hiraya', 'narrow')
    const built = buildExterior({ ...base, exterior: { ...base.exterior, pool: 'round', garden: 'strawberries', extras: ['picnic', 'fountain'] } })
    for (const name of ['pool-round', 'strawberries', 'picnic', 'fountain']) {
      const box = new THREE.Box3().setFromObject(built.root.getObjectByName(name)!)
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        expect(built.framing!.some((point) => point.distanceTo(new THREE.Vector3(x, y, z)) < 1e-6), name).toBe(true)
      }
    }
    const contents = new THREE.Box3().setFromPoints([...built.framing!])
    const scenery = new THREE.Box3().setFromObject(built.root)
    expect(contents.max.y).toBeLessThan(scenery.max.y)
    expect(contents.max.x - contents.min.x).toBeLessThan(scenery.max.x - scenery.min.x)
    built.dispose()
  })
})
