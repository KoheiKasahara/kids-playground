import { expect, test, vi } from 'vitest'
import { BoxGeometry, Group, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Quaternion, Sprite, Vector3 } from 'three'
import { createJourneyCourse, defaultRoutes } from './journeyModel'
import { createCountrysideScene } from './journeyCountryside'
import { disposeJourneyObject } from './journeyParts'

// Text textures need a browser canvas; all geometry and placement remain real.
vi.mock('./journeyParts', async importOriginal => ({
  ...await importOriginal<typeof import('./journeyParts')>(),
  journeyLabel: () => new Sprite(),
}))

for (const id of ['snow', 'coast', 'farm'] as const) {
  test(`${id}: scenery leaves the train clear and resources can be rebuilt`, () => {
    const course = createJourneyCourse(id)
    const rails = Object.values(course.curves).flatMap(curve => curve.getSpacedPoints(500))
    const sleeper = new Group().add(new Mesh(new BoxGeometry(1, 0.1, 0.2), new MeshStandardMaterial()))
    const world = createCountrysideScene(course, sleeper)
    const matrix = new Matrix4()
    const position = new Vector3()
    const scale = new Vector3()
    const rotation = new Quaternion()
    world.group.traverse(object => {
      if (!(object instanceof InstancedMesh) || !object.name.startsWith('journey-scenery-')) return
      for (let i = 0; i < object.count; i++) {
        object.getMatrixAt(i, matrix)
        matrix.decompose(position, rotation, scale)
        for (const rail of rails) {
          if (position.y + scale.y / 2 < rail.y + 0.05 || position.y - scale.y / 2 > rail.y + 2.6) continue
          const gap = Math.hypot(Math.max(0, Math.abs(rail.x - position.x) - scale.x / 2), Math.max(0, Math.abs(rail.z - position.z) - scale.z / 2))
          expect(gap, `${object.name} at ${position.toArray()}`).toBeGreaterThan(1.05)
        }
      }
    })
    world.setRoutes(defaultRoutes(course))
    world.setRoutes(course.switches.map(point => point.branches[1]))
    world.setOverview(false)
    world.update(1, false)
    disposeJourneyObject(world.group)
    disposeJourneyObject(sleeper)
  })
}
