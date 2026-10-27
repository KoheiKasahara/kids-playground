import type { World } from '@dimforge/rapier3d-compat'

/** These games' small gaps and contact surfaces were authored at metre scale
 * with 1 mm penetration tolerance and 2 mm predictive contacts. Rapier 0.21
 * changed those defaults to 5 mm / 20 mm; retain the geometry's original scale. */
export function configureGameContacts(world: World): void {
  world.integrationParameters.normalizedAllowedLinearError = 0.001
  world.integrationParameters.normalizedPredictionDistance = 0.002
}
