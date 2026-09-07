import { describe, expect, it } from 'vitest'
import {
  AREA_WIDTH,
  SPINNER_BLADE_THICKNESS,
} from '../adventurePhysics'
import { AREAS } from './areas'
import type { AreaToy } from '../types'

type AreaObstacle = (typeof AREAS)[number]['objects'][number] | AreaToy

function obstaclesOf(area: (typeof AREAS)[number]): readonly AreaObstacle[] {
  return [...area.objects, ...(area.toys ?? [])]
}

describe('コース配置の不変条件', () => {
  it('外壁ぎわにボールが止まる切り欠きを作らない', () => {
    const leftWallInnerX = 14
    const rightWallInnerX = AREA_WIDTH - 14
    const violations: string[] = []

    for (const area of AREAS) {
      for (const obstacle of obstaclesOf(area)) {
        const halfWidth =
          obstacle.kind === 'pin' || obstacle.kind === 'lifter'
            ? obstacle.radius
            : obstacle.kind === 'spinner'
              ? obstacle.radius + SPINNER_BLADE_THICKNESS / 2
              : Math.abs(Math.cos(obstacle.angle)) * obstacle.width / 2 +
                Math.abs(Math.sin(obstacle.angle)) * obstacle.height / 2
        const leftGap = obstacle.x - halfWidth - leftWallInnerX
        const rightGap = rightWallInnerX - (obstacle.x + halfWidth)
        if (leftGap > 0 && leftGap < 60) violations.push(`${area.id}:${obstacle.id} gap=${leftGap}`)
        if (rightGap > 0 && rightGap < 60) violations.push(`${area.id}:${obstacle.id} gap=${rightGap}`)
      }
    }

    expect(violations).toEqual([])
  })

})
