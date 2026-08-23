import { describe, expect, it } from 'vitest'
import {
  AREA_HEIGHT,
  AREA_WIDTH,
  BALL_RADIUS,
  PORTAL_FLOOR_HEIGHT,
  SPINNER_BLADE_THICKNESS,
} from '../adventurePhysics'
import { AREAS } from './areas'
import type { AreaToy } from '../types'

type AreaObstacle = (typeof AREAS)[number]['objects'][number] | AreaToy

function obstaclesOf(area: (typeof AREAS)[number]): readonly AreaObstacle[] {
  return [...area.objects, ...(area.toys ?? [])]
}

function touchesBall(obstacle: AreaObstacle, x: number, y: number): boolean {
  if (obstacle.kind === 'pin') {
    return Math.hypot(x - obstacle.x, y - obstacle.y) <= obstacle.radius + BALL_RADIUS
  }
  if (obstacle.kind === 'spinner') {
    return (
      Math.hypot(x - obstacle.x, y - obstacle.y) <=
      obstacle.radius + SPINNER_BLADE_THICKNESS / 2 + BALL_RADIUS
    )
  }
  if (obstacle.kind === 'lifter') {
    return Math.hypot(x - obstacle.x, y - obstacle.y) <= obstacle.radius + BALL_RADIUS
  }

  const cosine = Math.cos(obstacle.angle)
  const sine = Math.sin(obstacle.angle)
  const deltaX = x - obstacle.x
  const deltaY = y - obstacle.y
  // 回転矩形へ点を逆回転し、ボール半径ぶん外側へ広げた近似で格子を調べる。
  const localX = cosine * deltaX + sine * deltaY
  const localY = -sine * deltaX + cosine * deltaY
  return (
    Math.abs(localX) <= obstacle.width / 2 + BALL_RADIUS &&
    Math.abs(localY) <= obstacle.height / 2 + BALL_RADIUS
  )
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

  it('各x列の無接触落下帯を185px以下にする', () => {
    const violations: string[] = []

    for (const area of AREAS) {
      const floorY = area.cup ? area.cup.rimY : AREA_HEIGHT - PORTAL_FLOOR_HEIGHT
      const obstacles = obstaclesOf(area)
      for (let x = 36; x <= 444; x += 8) {
        let runStart: number | null = null
        let longestFrom = 0
        let longestTo = 0
        let longestLength = 0

        for (let y = 140; y <= floorY; y += 10) {
          const touches = obstacles.some((obstacle) => touchesBall(obstacle, x, y))
          if (!touches && runStart === null) runStart = y
          if (touches && runStart !== null) {
            const length = y - runStart
            if (length > longestLength) {
              longestLength = length
              longestFrom = runStart
              longestTo = y - 10
            }
            runStart = null
          }
        }

        if (runStart !== null) {
          const length = floorY + 10 - runStart
          if (length > longestLength) {
            longestLength = length
            longestFrom = runStart
            longestTo = floorY
          }
        }

        if (longestLength > 185) {
          violations.push(`${area.id} x=${x} で y=${longestFrom}〜${longestTo} が ${longestLength}px 素通り`)
        }
      }
    }

    expect(violations).toEqual([])
  })
})
