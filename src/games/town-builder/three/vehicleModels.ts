import * as THREE from 'three'
import { CAR_COLORS, TRAIN_COLORS, type VehicleKind } from '../vehicles'
import type { TownKit } from './townKit'

// くるまと でんしゃ。まえは ローカルの -z、y=0 が みちの うえ。
// 1だいの ぶひんは ざいりょうごとに 1つに まとめる（くるま 1だいを 13こ → 5こ の Mesh で えがく）。

function car(kit: TownKit, variant: number): THREE.Group {
  const color = CAR_COLORS[variant % CAR_COLORS.length]
  const { frame, flat, cluster } = kit.moving()
  frame.box(color, [0.15, 0.065, 0.27], [0, 0.025, 0])
  frame.box(kit.glow('windowOff'), [0.13, 0.055, 0.14], [0, 0.09, 0.02])
  frame.box(color, [0.136, 0.016, 0.146], [0, 0.145, 0.02])
  for (const z of [-0.085, 0.085]) {
    flat.cyl('#2b2b2b', 0.03, 0.026, [0.09, 0.03, z], 10, 1, [0, 0, Math.PI / 2])
    flat.cyl('#2b2b2b', 0.03, 0.026, [-0.09, 0.03, z], 10, 1, [0, 0, -Math.PI / 2])
  }
  for (const x of [-0.045, 0.045]) {
    flat.box(kit.glow('headlight'), [0.032, 0.02, 0.01], [x, 0.055, -0.137])
    flat.box(kit.glow('tail'), [0.03, 0.018, 0.01], [x, 0.055, 0.137])
  }
  return cluster.build()
}

function train(kit: TownKit, variant: number): THREE.Group {
  const color = TRAIN_COLORS[variant % TRAIN_COLORS.length]
  const { frame, flat, cluster } = kit.moving()
  flat.box('#46404f', [0.18, 0.05, 0.74], [0, 0, 0])
  frame.box(color, [0.22, 0.16, 0.82], [0, 0.045, 0])
  frame.box('#e9ecef', [0.2, 0.025, 0.78], [0, 0.205, 0])
  for (const side of [-0.111, 0.111]) flat.box(kit.glow('window'), [0.012, 0.06, 0.6], [side, 0.1, 0.04])
  flat.box(kit.glow('window'), [0.16, 0.06, 0.012], [0, 0.11, -0.411])
  flat.box(kit.glow('headlight'), [0.05, 0.022, 0.01], [0, 0.065, -0.413])
  return cluster.build()
}

export function vehicleModel(kit: TownKit, kind: VehicleKind, variant: number): THREE.Group {
  const group = kind === 'car' ? car(kit, variant) : train(kit, variant)
  group.userData.vehicle = kind
  return group
}

/** みちの うえで くるま・でんしゃを おく たかさ。 */
export const RIDE_HEIGHT: Record<VehicleKind, number> = { car: 0.03, train: 0.045 }
