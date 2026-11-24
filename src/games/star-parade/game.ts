import { formation } from './formation'
import type { GateLabel, GateRow } from './course'

const SECONDS_PER_GATE = 2.75
const STEERING_SPEED = 4
const TRACK_LIMIT = 0.84
const JUMP_SECONDS = 1.1
const LANDING_SECONDS = 0.15

type RunEvent = 'grow' | 'shrink' | 'hit' | 'dodge' | 'pass'

export type RunState = {
  distance: number
  playerX: number
  count: number
  passed: number
  finished: boolean
  jumpTime: number
  jumpCooldown: number
  lastEvent: RunEvent | null
}

export function initialRun(level = 0): RunState {
  return {
    distance: 0, playerX: 0, count: 3 + level, passed: 0, finished: false,
    jumpTime: 0, jumpCooldown: 0, lastEvent: null,
  }
}

export function jumpRun(state: RunState): RunState {
  if (state.finished || state.jumpCooldown > 0) return state
  return { ...state, jumpTime: JUMP_SECONDS, jumpCooldown: JUMP_SECONDS + LANDING_SECONDS }
}

function heightAt(remaining: number) {
  const fraction = Math.max(0, remaining) / JUMP_SECONDS
  return 4 * fraction * (1 - fraction)
}

export function jumpHeight(state: RunState) {
  return heightAt(state.jumpTime)
}

export function meteorX(row: GateRow, distance: number) {
  if (!row.meteor) return 0
  // ひとつ手前の区間で横切り、ぶつかる 0.25 区間前に着地レーンへ落ち着く。
  const t = Math.max(0, Math.min(1, distance - row.distance + 1.25))
  const glide = t * t * (3 - 2 * t)
  return (row.meteor.from + (row.meteor.to - row.meteor.from) * glide) * 2 / 3
}

function steer(start: number, target: number, seconds: number) {
  const delta = target - start
  return start + Math.sign(delta) * Math.min(Math.abs(delta), STEERING_SPEED * seconds)
}

function applyGate(count: number, label: GateLabel) {
  const amount = Number(label.slice(1))
  if (label.startsWith('×')) return count * amount
  if (label.startsWith('−')) return Math.max(1, count - amount)
  return count + amount
}

function crossRow(row: GateRow, x: number, height: number, count: number): { count: number; event: RunEvent } {
  const lane = Math.round(x * 1.5)
  if (row.meteor && height < 0.36) {
    const rockX = meteorX(row, row.distance)
    const hits = formation(count, x).filter(star => Math.abs(star.x - rockX) <= 0.13 + star.radius * 0.8)
    if (hits.length) return { count: Math.max(1, count - hits.length), event: 'hit' }
  }
  const gate = row.lanes[lane + 1]
  if (!gate) return { count, event: row.meteor ? 'dodge' : 'pass' }
  return { count: applyGate(count, gate), event: gate.startsWith('−') ? 'shrink' : 'grow' }
}

export function stepRun(state: RunState, dt: number, targetX: number, gates: readonly GateRow[]): RunState {
  if (state.finished || dt <= 0) return state

  const target = Math.max(-TRACK_LIMIT, Math.min(TRACK_LIMIT, targetX))
  const finish = (gates.at(-1)?.distance ?? 0) + 1
  const distance = Math.min(finish, state.distance + dt / SECONDS_PER_GATE)
  let { count, passed, lastEvent } = state
  while (passed < gates.length && gates[passed].distance <= distance) {
    const gate = gates[passed]
    // フレームの終端ではなく、この列を横切った瞬間の位置と高さを使う。
    const crossingTime = (gate.distance - state.distance) * SECONDS_PER_GATE
    const crossingX = steer(state.playerX, target, crossingTime)
    const crossing = crossRow(gate, crossingX, heightAt(state.jumpTime - crossingTime), count)
    count = crossing.count
    lastEvent = crossing.event
    passed++
  }

  const elapsed = (distance - state.distance) * SECONDS_PER_GATE
  const finished = distance === finish
  return {
    distance, playerX: steer(state.playerX, target, elapsed), count, passed,
    finished,
    jumpTime: finished ? 0 : Math.max(0, state.jumpTime - elapsed),
    jumpCooldown: finished ? 0 : Math.max(0, state.jumpCooldown - elapsed),
    lastEvent,
  }
}
