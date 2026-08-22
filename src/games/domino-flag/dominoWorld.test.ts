import RAPIER from '@dimforge/rapier3d-compat'
import { beforeAll, describe, expect, it } from 'vitest'
import { createDominoPlacements } from './dominoLayout'
import { createDominoWorld, isTiltAtLeast, tiltOf } from './dominoWorld'

describe('dominoWorld', () => {
  beforeAll(async () => {
    await RAPIER.init()
  })

  it('tiltOfはクォータニオンの上向きY成分と一致する', () => {
    const dominoWorld = createDominoWorld(RAPIER, [createDominoPlacements()[0]!])
    const body = dominoWorld.bodies[0]!.body
    body.setRotation(
      {
        x: 0.2,
        y: 0.3,
        z: 0.4,
        w: 0.8426149773176358,
      },
      true,
    )

    const { x, z } = body.rotation()
    const upY = 1 - 2 * (x * x + z * z)
    expect(tiltOf(body)).toBe(Math.acos(Math.max(-1, Math.min(1, upY))))
    expect(isTiltAtLeast(body, tiltOf(body) - 0.001)).toBe(true)
    expect(isTiltAtLeast(body, tiltOf(body) + 0.001)).toBe(false)
    dominoWorld.world.free()
  })

  it('solverIterationsを指定した課だけRapierの反復回数を変更する', () => {
    const placements = [createDominoPlacements()[0]!]
    const defaultWorld = createDominoWorld(RAPIER, placements)
    const optimizedWorld = createDominoWorld(RAPIER, placements, { solverIterations: 2 })

    expect(optimizedWorld.world.integrationParameters.numSolverIterations).toBe(2)
    expect(defaultWorld.world.integrationParameters.numSolverIterations).not.toBe(2)
    defaultWorld.world.free()
    optimizedWorld.world.free()
  })
})
