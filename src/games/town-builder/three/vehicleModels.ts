import * as THREE from 'three'
import { CAR_COLORS, TRAIN_COLORS, type VehicleKind } from '../vehicles'
import type { TownKit } from './townKit'

// くるまと でんしゃ。まえは ローカルの -z、y=0 が みちの うえ。

function car(kit: TownKit, variant: number): THREE.Group {
  const color = CAR_COLORS[variant % CAR_COLORS.length]
  const group = new THREE.Group()
  group.add(kit.mesh(kit.box(), color, [0, 0.025, 0], [0.15, 0.065, 0.27]))
  group.add(kit.mesh(kit.box(), kit.glow('windowOff'), [0, 0.09, 0.02], [0.13, 0.055, 0.14]))
  group.add(kit.mesh(kit.box(), color, [0, 0.145, 0.02], [0.136, 0.016, 0.146]))
  for (const z of [-0.085, 0.085]) {
    group.add(kit.mesh(kit.cyl(10), '#2b2b2b', [0.09, 0.03, z], [0.03, 0.026, 0.03], [0, 0, Math.PI / 2], false))
    group.add(kit.mesh(kit.cyl(10), '#2b2b2b', [-0.09, 0.03, z], [0.03, 0.026, 0.03], [0, 0, -Math.PI / 2], false))
  }
  for (const x of [-0.045, 0.045]) {
    group.add(kit.mesh(kit.box(), kit.glow('headlight'), [x, 0.055, -0.137], [0.032, 0.02, 0.01], [0, 0, 0], false))
    group.add(kit.mesh(kit.box(), kit.glow('tail'), [x, 0.055, 0.137], [0.03, 0.018, 0.01], [0, 0, 0], false))
  }
  return group
}

function train(kit: TownKit, variant: number): THREE.Group {
  const color = TRAIN_COLORS[variant % TRAIN_COLORS.length]
  const group = new THREE.Group()
  group.add(kit.mesh(kit.box(), '#46404f', [0, 0, 0], [0.18, 0.05, 0.74], [0, 0, 0], false))
  group.add(kit.mesh(kit.box(), color, [0, 0.045, 0], [0.22, 0.16, 0.82]))
  group.add(kit.mesh(kit.box(), '#e9ecef', [0, 0.205, 0], [0.2, 0.025, 0.78]))
  for (const side of [-0.111, 0.111]) {
    group.add(kit.mesh(kit.box(), kit.glow('window'), [side, 0.1, 0.04], [0.012, 0.06, 0.6], [0, 0, 0], false))
  }
  group.add(kit.mesh(kit.box(), kit.glow('window'), [0, 0.11, -0.411], [0.16, 0.06, 0.012], [0, 0, 0], false))
  group.add(kit.mesh(kit.box(), kit.glow('headlight'), [0, 0.065, -0.413], [0.05, 0.022, 0.01], [0, 0, 0], false))
  return group
}

export function vehicleModel(kit: TownKit, kind: VehicleKind, variant: number): THREE.Group {
  const group = kind === 'car' ? car(kit, variant) : train(kit, variant)
  group.userData.vehicle = kind
  return group
}

/** みちの うえで くるま・でんしゃを おく たかさ。 */
export const RIDE_HEIGHT: Record<VehicleKind, number> = { car: 0.03, train: 0.045 }
