import * as Matter from 'matter-js'
import {
  BALL_RADIUS,
  LIFTER_COOLDOWN_MS,
  LIFTER_HORIZONTAL_RETENTION,
  LIFTER_MAX_HORIZONTAL_SPEED,
  LIFTER_RANDOM_HORIZONTAL_MAX,
  LIFTER_RANDOM_HORIZONTAL_MIN,
  LIFTER_RESTITUTION,
  LIFTER_SPEED_CAP,
  SPINNER_BLADE_THICKNESS,
  SPINNER_BALL_SPEED_CAP,
  SPINNER_NUDGE_COOLDOWN_MS,
  SPINNER_NUDGE_SPEED,
  SPINNER_RESTITUTION,
  SPINNER_STALL_SPEED,
  STEP_MS,
  WALL_FRICTION,
} from './adventurePhysics'
import { AREAS } from './data/areas'
import { createLifterCore } from '../shared/toys/lifterCore'
import { createSpinnerCore } from '../shared/toys/spinnerCore'
import type { AreaLifter, AreaSpinner, AreaToy } from './types'

export type AdventureToyEvent = {
  kind: 'spinner-hit' | 'lifter-fire'
  id: string
}

export type AdventureToyRuntime = {
  readonly areaId: string
  readonly toy: AreaToy
  readonly bodies: readonly Matter.Body[]
  /** 毎ステップ呼ぶ。ボールが今このエリアで走行中のときだけballBodyを渡す。 */
  update(nowMs: number, ballBody: Matter.Body | null): AdventureToyEvent | null
  /** 描画用。spinnerは角度、lifterは発火直後かどうかを返す。 */
  readVisual(): { spinRad: number; firedAtMs: number | null }
}

export type AdventureToyRuntimeSet = {
  readonly runtimes: readonly AdventureToyRuntime[]
  readonly bodies: readonly Matter.Body[]
  readonly runtimeByAreaId: ReadonlyMap<string, readonly AdventureToyRuntime[]>
}

const SPINNER_INFLUENCE_MARGIN = 8
const LIFTER_INFLUENCE_MARGIN = 10
const MAX_UPDATE_DT_MS = 100

function worldPoint(areaId: string, x: number, y: number): { x: number; y: number } {
  const area = AREAS.find((candidate) => candidate.id === areaId)
  if (!area) throw new Error(`flag-roll-adventure: unknown area id: ${areaId}`)
  return { x: area.origin.x + x, y: area.origin.y + y }
}

function createSpinnerRuntime(areaId: string, toy: AreaSpinner): AdventureToyRuntime {
  const point = worldPoint(areaId, toy.x, toy.y)
  const core = createSpinnerCore({
    x: point.x,
    y: point.y,
    radius: toy.radius,
    bladeThickness: SPINNER_BLADE_THICKNESS,
    friction: WALL_FRICTION,
    restitution: SPINNER_RESTITUTION,
    label: `toy-spinner:${areaId}:${toy.id}`,
    ballSpeedCap: SPINNER_BALL_SPEED_CAP,
    influenceMargin: SPINNER_INFLUENCE_MARGIN,
    ballRadius: BALL_RADIUS,
    stepMs: STEP_MS,
  })
  const lastNudgeAt = new Map<number, number>()
  let lastUpdateAt: number | null = null

  return {
    areaId,
    toy,
    bodies: [core.body],
    update(nowMs, ballBody) {
      const rawDt = lastUpdateAt === null ? 0 : nowMs - lastUpdateAt
      const dtMs = Math.min(MAX_UPDATE_DT_MS, Math.max(0, rawDt))
      lastUpdateAt = nowMs
      core.advance(dtMs, toy.angularVelocity)
      if (!ballBody) return null

      core.capBallSpeed(ballBody)
      const lastNudge = lastNudgeAt.get(ballBody.id) ?? -Infinity
      if (nowMs - lastNudge < SPINNER_NUDGE_COOLDOWN_MS) return null
      if (!core.nudgeIfStalled(ballBody, SPINNER_STALL_SPEED, SPINNER_NUDGE_SPEED)) return null
      lastNudgeAt.set(ballBody.id, nowMs)
      // 実際の接触通知はEngineのcollisionStartで発火するため、ここでは重複通知しない。
      return null
    },
    readVisual() {
      return { spinRad: core.angle, firedAtMs: null }
    },
  }
}

function createLifterRuntime(areaId: string, toy: AreaLifter, random: () => number): AdventureToyRuntime {
  const point = worldPoint(areaId, toy.x, toy.y)
  const core = createLifterCore({
    x: point.x,
    y: point.y,
    radius: toy.radius,
    friction: WALL_FRICTION,
    restitution: LIFTER_RESTITUTION,
    label: `toy-lifter:${areaId}:${toy.id}`,
    ballRadius: BALL_RADIUS,
    influenceMargin: LIFTER_INFLUENCE_MARGIN,
    upSpeed: toy.upSpeed,
    maxHorizontalSpeed: LIFTER_MAX_HORIZONTAL_SPEED,
    randomHorizontalMin: LIFTER_RANDOM_HORIZONTAL_MIN,
    randomHorizontalMax: LIFTER_RANDOM_HORIZONTAL_MAX,
    horizontalRetention: LIFTER_HORIZONTAL_RETENTION,
    speedCap: LIFTER_SPEED_CAP,
    cooldownMs: toy.cooldownMs ?? LIFTER_COOLDOWN_MS,
  })
  let firedAtMs: number | null = null

  return {
    areaId,
    toy,
    bodies: [core.body],
    update(nowMs, ballBody) {
      if (!ballBody || !core.tryLaunch(nowMs, ballBody.id, ballBody, random)) return null
      firedAtMs = nowMs
      return { kind: 'lifter-fire', id: toy.id }
    },
    readVisual() {
      return { spinRad: 0, firedAtMs }
    },
  }
}

/** 全エリアのAreaToyから、物理Bodyと固定ステップ更新用ランタイムをまとめて作る。 */
export function createAdventureToyRuntimes(random: () => number): AdventureToyRuntimeSet {
  const runtimes: AdventureToyRuntime[] = []
  const bodies: Matter.Body[] = []
  const runtimeByAreaId = new Map<string, readonly AdventureToyRuntime[]>()

  for (const area of AREAS) {
    const areaRuntimes = (area.toys ?? []).map((toy) =>
      toy.kind === 'spinner'
        ? createSpinnerRuntime(area.id, toy)
        : createLifterRuntime(area.id, toy, random),
    )
    runtimeByAreaId.set(area.id, areaRuntimes)
    runtimes.push(...areaRuntimes)
    for (const runtime of areaRuntimes) bodies.push(...runtime.bodies)
  }

  return { runtimes, bodies, runtimeByAreaId }
}
