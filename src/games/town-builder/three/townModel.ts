import * as THREE from 'three'
import { findPart, isBuilding } from '../parts'
import { isConnected, type Town } from '../town'
import { buildBuilding, type Tick } from './buildingModels'
import { buildGround, type Crossing } from './groundModels'
import { Frame, matrixOf, TownKit } from './townKit'
import { facingAngle, facingOf, tileCenter, tileNoise } from './townLayout'

// まち ぜんたいの 3D を くみたてる。うごかない ものは まとめ、うごく ものは ticks で うごかす。

export type TownModel = {
  readonly root: THREE.Group
  readonly kit: TownKit
  readonly ticks: readonly Tick[]
  readonly crossings: readonly Crossing[]
  /** よるの がいとうの あかりの わ。 */
  readonly pool: THREE.MeshBasicMaterial
  /** ひる 0 〜 よる 1。 */
  setNight: (amount: number) => void
  dispose: () => void
}

export function buildTownModel(town: Town): TownModel {
  const kit = new TownKit()
  const root = new THREE.Group()
  root.name = 'town-3d'
  const ticks: Tick[] = []
  const { crossings, pool } = buildGround(kit, town, root)

  town.forEach((tile, index) => {
    const part = tile.part
    if (!isBuilding(part)) return
    const center = tileCenter(index)
    const base = matrixOf([center.x, 0, center.z], [0, facingAngle(facingOf(town, index)), 0])
    buildBuilding(part, new Frame(kit, base), {
      lit: !findPart(part)?.needsRoad || isConnected(town, index),
      noise: (salt) => tileNoise(index, salt),
      animate: (object, tick) => {
        object.name = `${part}-motion`
        root.add(object)
        ticks.push(tick)
      },
    })
  })

  const statics = new THREE.Group()
  statics.name = 'town-static'
  for (const mesh of kit.merge()) {
    mesh.updateMatrix()
    statics.add(mesh)
  }
  root.add(statics)

  return {
    root,
    kit,
    ticks,
    crossings,
    pool,
    setNight(amount) {
      kit.setNight(amount)
      pool.opacity = 0.42 * amount
      pool.visible = amount > 0.01
    },
    dispose() {
      root.removeFromParent()
      root.clear()
      kit.dispose()
    },
  }
}
