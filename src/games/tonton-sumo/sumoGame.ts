export type Side = 'left' | 'right'
export type Mode = 'solo' | 'duo'
export type Finish = 'out' | 'fall'

export type WrestlerStats = {
  /** Heavier figures move less from a tap but shove harder when they bump. */
  mass: number
  /** Drawn size of the figure; taller paper has a higher middle and tips over more easily. */
  scale: number
  /** Floor friction while touching the box. */
  grip: number
  /** How high a tap bounces the paper. */
  hop: number
  /** How much each bounce leans the figure toward its opponent. */
  lunge: number
  /** Resistance to wobbling and how far it can lean before it falls over. */
  stability: number
  /** Contact half-width in ring units. */
  width: number
}

/** Size and weight are rated as levels from 1 to STAT_LEVELS. */
export const STAT_LEVELS = 5

export type Wrestler = {
  key: string
  name: string
  /** A short hiragana hint about how it moves. */
  trait: string
  /** おおきさ: 1 (ちいさい) – 5 (おおきい). */
  size: number
  /** おもさ: 1 (かるい) – 5 (おもい). */
  weight: number
  stats: WrestlerStats
}

type Flavor = {
  /** Contact half-width of the art at its normal size. */
  width: number
  grip?: number
  hop?: number
  lunge?: number
  /** Extra steadiness on top of what size and weight give. */
  balance?: number
}

/**
 * Size and weight decide most of how a figure moves. Big ones reach farther and are
 * hard to shift, but stand tall and tip over easily; heavy ones barely bounce, shove
 * hard and sit steady; small light ones hop about and get knocked around.
 */
function wrestler(key: string, name: string, trait: string, size: number, weight: number, flavor: Flavor): Wrestler {
  const scale = 0.8 + 0.1 * size
  const mass = 0.75 + 0.1 * weight
  return {
    key, name, trait, size, weight,
    stats: {
      mass,
      scale,
      grip: flavor.grip ?? 1,
      hop: (flavor.hop ?? 1) / Math.sqrt(mass),
      lunge: flavor.lunge ?? 1,
      stability: ((flavor.balance ?? 1) * (0.95 + 0.05 * weight)) / Math.sqrt(scale),
      width: flavor.width * scale,
    },
  }
}

/** Everyday things folded into paper wrestlers. Their art lives in PaperWrestler.tsx. */
export const WRESTLERS: readonly Wrestler[] = [
  wrestler('mochi', 'おもち', 'もちもち', 3, 3, { width: 0.25, grip: 1.25 }),
  wrestler('onigiri', 'おにぎり', 'どっしり', 3, 4, { width: 0.25, balance: 1.08 }),
  wrestler('pencil', 'えんぴつ', 'のっぽ', 5, 2, { width: 0.2, lunge: 1.3 }),
  wrestler('penguin', 'ペンギン', 'すべる', 2, 3, { width: 0.25, grip: 0.7, lunge: 1.1 }),
  wrestler('robot', 'ロボット', 'おもたい', 4, 5, { width: 0.24, lunge: 0.9 }),
  wrestler('daikon', 'だいこん', 'ねばる', 4, 3, { width: 0.22, balance: 1.15 }),
  wrestler('octopus', 'たこ', 'くねくね', 3, 2, { width: 0.25, balance: 1.12 }),
  wrestler('pudding', 'プリン', 'ぷるぷる', 2, 2, { width: 0.25, hop: 1.05, lunge: 1.2 }),
  wrestler('bread', 'しょくパン', 'ふわふわ', 3, 1, { width: 0.24, lunge: 1.15, balance: 1.08 }),
  wrestler('frog', 'かえる', 'ぴょんぴょん', 1, 1, { width: 0.27, hop: 1.1, lunge: 1.2 }),
  wrestler('rocket', 'ロケット', 'とっしん', 4, 2, { width: 0.21, lunge: 1.3 }),
  wrestler('bear', 'くま', 'ちからもち', 5, 5, { width: 0.22 }),
]

export type Point = { x: number; z: number }

/**
 * One paper figure on the box. x is left → right, z is front → back (positive is
 * farther from the viewer), y is hop height. All lengths are in ring radii.
 */
export type Body = {
  x: number
  z: number
  y: number
  vx: number
  vz: number
  vy: number
  /** Lean toward the opponent in radians; negative is leaning back. */
  lean: number
  leanVel: number
  /** Facing direction in the x/z plane (0 faces right). */
  heading: number
  fallen: boolean
}

export type SumoState = {
  fighters: Record<Side, number>
  bodies: Record<Side, Body>
  taps: number
  lastTap: Record<Side, number>
  winner: Side | null
  finish: Finish | null
}

export const RING_RADIUS = 1
/** Half-size of the cardboard box top; taps beyond it hit its rim. */
export const BOX_HALF = { x: 1.3, z: 1 } as const
export const START_X = 0.44
export const TAP_COOLDOWN_MS = 90
export const COMPUTER_INTERVAL_MS = 1200
export const COMPUTER_STRENGTH = 0.85
export const STEP_SECONDS = 1 / 60

const GRAVITY = 9
const TAP_PUSH = 0.4
const TAP_LUNGE = 0.12
const TAP_DRIVE = 0.16
const TAP_HOP = 1.25
const TAP_WOBBLE = 3.6
const TAP_LEAN = 1.1
const GROUND_FRICTION = 15
const AIR_FRICTION = 0.8
const LEAN_SPRING = 34
const LEAN_DAMPING = 5.5
/** Paper figures that meet lean on each other instead of bouncing apart. */
const BUMP_RESTITUTION = 0
const BUMP_LEAN = 2.2
/** The figure doing the pushing tips forward onto its opponent. */
const PUSH_LEAN = 0.4
/** Gravity pulling a leaning figure further over; tall paper feels it more. */
const TOPPLE = 6
/** How far the hands may press past each other before the bodies are nudged apart. */
const CONTACT_SLOP = 0.05
const CONTACT_CORRECTION = 0.3
const FALL_ACCEL = 14
const LYING = 1.5

export const other = (side: Side): Side => (side === 'left' ? 'right' : 'left')
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const angleDiff = (to: number, from: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from))

export function tipAngle(stability: number) {
  return 0.42 + 0.36 * stability
}

function startBody(side: Side): Body {
  return {
    x: side === 'left' ? -START_X : START_X,
    z: 0,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    lean: 0,
    leanVel: 0,
    heading: side === 'left' ? 0 : Math.PI,
    fallen: false,
  }
}

export function createSumoState(left = 0, right = 1): SumoState {
  return {
    fighters: { left, right },
    bodies: { left: startBody('left'), right: startBody('right') },
    taps: 0,
    lastTap: { left: -Infinity, right: -Infinity },
    winner: null,
    finish: null,
  }
}

export function statsFor(state: SumoState, side: Side) {
  return WRESTLERS[state.fighters[side]]!.stats
}

/** Taps land on the box; anything beyond its edge counts as tapping the rim. */
export function clampToBox(point: Point): Point {
  return { x: clamp(point.x, -BOX_HALF.x, BOX_HALF.x), z: clamp(point.z, -BOX_HALF.z, BOX_HALF.z) }
}

/** In two-player games each half of the box belongs to one player, with its own cooldown for fair multitouch. */
export function tapSide(point: Point): Side {
  return point.x < 0 ? 'left' : 'right'
}

/**
 * Tapping the box shakes it: every paper figure bounces, and the closer it is to the
 * tap, the harder it is shoved away from that spot. Tapping behind your wrestler drives
 * it forward; tapping beside it makes it slide and turn. The tapping player's own
 * wrestler also leans in a little, so every tap helps the one who made it.
 */
export function tapSumo(state: SumoState, rawPoint: Point, player: Side, now: number, random: () => number = Math.random, strength = 1): SumoState {
  const point = clampToBox(rawPoint)
  if (state.winner || now - state.lastTap[player] < TAP_COOLDOWN_MS) return state
  const bodies = { ...state.bodies }
  for (const who of ['left', 'right'] as const) {
    const body = bodies[who]
    if (body.fallen) continue
    const stat = statsFor(state, who)
    const dx = body.x - point.x
    const dz = body.z - point.z
    const distance = Math.hypot(dx, dz)
    const angle = distance > 1e-3 ? Math.atan2(dz, dx) : random() * Math.PI * 2
    const airborne = body.y > 0.02
    const force = clamp(1.25 - distance * 0.62, 0.2, 1) * strength * (airborne ? 0.5 : 1)
    const push = (TAP_PUSH * force * (0.85 + random() * 0.3)) / (0.5 + 0.5 * stat.mass)
    // The player tapping their own half puts their wrestler's weight forward; light ones dart in.
    const lunge = TAP_LUNGE * stat.lunge * force + (who === player ? TAP_DRIVE * stat.lunge * strength / stat.mass : 0)
    const along = Math.cos(angle - body.heading)
    bodies[who] = {
      ...body,
      vx: body.vx + Math.cos(angle) * push + Math.cos(body.heading) * lunge,
      vz: body.vz + Math.sin(angle) * push + Math.sin(body.heading) * lunge,
      // Only paper resting on the box is thrown up again; a figure in the air just drifts.
      vy: airborne ? body.vy : Math.max(body.vy, TAP_HOP * stat.hop * force * (0.85 + random() * 0.3)),
      leanVel: body.leanVel + ((random() - 0.5) * TAP_WOBBLE + along * TAP_LEAN * force) / stat.stability,
      heading: body.heading + (random() - 0.5) * 0.5 * force,
    }
  }
  return { ...state, bodies, taps: state.taps + 1, lastTap: { ...state.lastTap, [player]: now } }
}

function stepBody(body: Body, opponent: Body, { stability, grip, scale }: WrestlerStats, dt: number): Body {
  let { x, z, y, vx, vz, vy, lean, leanVel, heading, fallen } = body
  if (!fallen) heading += angleDiff(Math.atan2(opponent.z - z, opponent.x - x), heading) * Math.min(1, 4 * dt)
  if (y > 0 || vy > 0) {
    vy -= GRAVITY * dt
    y += vy * dt
    if (y <= 0) { y = 0; vy = 0 }
  }
  const grounded = y <= 0
  const friction = Math.exp(-(grounded ? GROUND_FRICTION * grip : AIR_FRICTION) * dt)
  vx *= friction
  vz *= friction
  x += vx * dt
  z += vz * dt
  if (fallen) {
    leanVel += Math.sign(lean || 1) * FALL_ACCEL * dt
    lean += leanVel * dt
    if (Math.abs(lean) >= LYING) { lean = Math.sign(lean) * LYING; leanVel = 0 }
  } else {
    const spring = LEAN_SPRING * stability * (grounded ? 1 : 0.35)
    leanVel += (-spring * lean + TOPPLE * scale * Math.sin(lean) - LEAN_DAMPING * leanVel) * dt
    lean += leanVel * dt
    if (Math.abs(lean) > tipAngle(stability)) fallen = true
  }
  if (Math.abs(x) > BOX_HALF.x || Math.abs(z) > BOX_HALF.z) {
    // Slid off the edge of the box: it topples over the rim.
    const outward = Math.atan2(Math.abs(z) > BOX_HALF.z ? Math.sign(z) : 0, Math.abs(x) > BOX_HALF.x ? Math.sign(x) : 0)
    if (!fallen) lean = Math.cos(outward - heading) >= 0 ? Math.abs(lean) + 0.2 : -Math.abs(lean) - 0.2
    x = clamp(x, -BOX_HALF.x, BOX_HALF.x)
    z = clamp(z, -BOX_HALF.z, BOX_HALF.z)
    vx = 0
    vz = 0
    fallen = true
  }
  return { x, z, y, vx, vz, vy, lean, leanVel, heading, fallen }
}

/**
 * Paper figures shove each other when their bodies meet; the lighter one rocks back more.
 * They stay locked together and push as a pair rather than being thrown apart, and a
 * little overlap is only eased out slowly so they can grapple at close range.
 */
function bump(state: SumoState, left: Body, right: Body): [Body, Body] {
  const a = statsFor(state, 'left')
  const b = statsFor(state, 'right')
  const dx = right.x - left.x
  const dz = right.z - left.z
  const distance = Math.hypot(dx, dz) || 1e-6
  const reach = a.width + b.width
  if (distance >= reach || left.y > 0.12 || right.y > 0.12) return [left, right]
  const nx = dx / distance
  const nz = dz / distance
  const overlap = reach - distance
  const inverseA = left.fallen ? 0.2 / a.mass : 1 / a.mass
  const inverseB = right.fallen ? 0.2 / b.mass : 1 / b.mass
  const share = (Math.max(0, overlap - CONTACT_SLOP) * CONTACT_CORRECTION) / (inverseA + inverseB)
  const l = { ...left, x: left.x - nx * share * inverseA, z: left.z - nz * share * inverseA }
  const r = { ...right, x: right.x + nx * share * inverseB, z: right.z + nz * share * inverseB }
  const closing = (r.vx - l.vx) * nx + (r.vz - l.vz) * nz
  if (closing < 0) {
    const impulse = (-(1 + BUMP_RESTITUTION) * closing) / (inverseA + inverseB)
    l.vx -= nx * impulse * inverseA
    l.vz -= nz * impulse * inverseA
    r.vx += nx * impulse * inverseB
    r.vz += nz * impulse * inverseB
    // A push on the chest rocks each figure back along its own facing, the lighter one
    // more. Whoever came in faster tips forward and leans on the other.
    const facingA = Math.max(0, nx * Math.cos(l.heading) + nz * Math.sin(l.heading))
    const facingB = Math.max(0, -nx * Math.cos(r.heading) - nz * Math.sin(r.heading))
    const driveA = Math.max(0, left.vx * nx + left.vz * nz)
    const driveB = Math.max(0, -(right.vx * nx + right.vz * nz))
    if (!l.fallen) l.leanVel += (-impulse * inverseA * BUMP_LEAN + driveA * PUSH_LEAN) * facingA / a.stability
    if (!r.fallen) r.leanVel += (-impulse * inverseB * BUMP_LEAN + driveB * PUSH_LEAN) * facingB / b.stability
  }
  return [l, r]
}

/** Out once the paper's feet cross the ring line, not just its middle. */
function lost(body: Body, width: number) {
  if (body.fallen) return 'fall' as const
  if (Math.hypot(body.x, body.z) > RING_RADIUS - width * 0.4) return 'out' as const
  return null
}

export function stepSumo(state: SumoState, dt = STEP_SECONDS): SumoState {
  const a = statsFor(state, 'left')
  const b = statsFor(state, 'right')
  let left = stepBody(state.bodies.left, state.bodies.right, a, dt)
  let right = stepBody(state.bodies.right, state.bodies.left, b, dt)
  ;[left, right] = bump(state, left, right)
  const next = { ...state, bodies: { left, right } }
  if (state.winner) return next
  const leftLost = lost(left, a.width)
  const rightLost = lost(right, b.width)
  if (!leftLost && !rightLost) return next
  // On a double fall, whoever ends up farther from the middle loses.
  const loser: Side = leftLost && rightLost
    ? (Math.hypot(left.x, left.z) >= Math.hypot(right.x, right.z) ? 'left' : 'right')
    : leftLost ? 'left' : 'right'
  const finish = (loser === 'left' ? leftLost : rightLost)!
  const body = next.bodies[loser]
  // Pushed over the line, the paper tips over backward and lands outside.
  const toppled = body.fallen ? body : { ...body, fallen: true, lean: -Math.max(0.2, Math.abs(body.lean)), leanVel: Math.min(body.leanVel, -1) }
  return { ...next, bodies: { ...next.bodies, [loser]: toppled }, winner: other(loser), finish }
}

/** True when nothing on the box is still moving, so the animation loop can rest. */
export function isSettled(state: SumoState) {
  return (['left', 'right'] as const).every((side) => {
    const body = state.bodies[side]
    const target = body.fallen ? Math.sign(body.lean || 1) * LYING : 0
    return body.y <= 0 && body.vy === 0 && Math.hypot(body.vx, body.vz) < 0.004
      && Math.abs(body.lean - target) < 0.004 && Math.abs(body.leanVel) < 0.01
  })
}

/** Just behind a wrestler, away from its opponent: the spot that drives it forward. */
export function behindPoint(state: SumoState, side: Side, random: () => number = () => 0.5, spread = 0.9): Point {
  const self = state.bodies[side]
  const opponent = state.bodies[other(side)]
  const angle = Math.atan2(self.z - opponent.z, self.x - opponent.x) + (random() - 0.5) * spread
  const reach = 0.42 + random() * spread * 0.3
  return clampToBox({ x: self.x + Math.cos(angle) * reach, z: self.z + Math.sin(angle) * reach })
}

/** The computer taps slowly and a little carelessly, so small children can win. */
export function computerTapPoint(state: SumoState, random: () => number = Math.random): Point {
  return behindPoint(state, 'right', random, 2.2)
}
