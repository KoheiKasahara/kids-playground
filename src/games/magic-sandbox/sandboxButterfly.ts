import { nextSleepDelay, renderSleep, spritePainter, wakeCreature, type Dot } from './sandboxCrabs'
import { Cell, type Point, type Sandbox } from './sandboxSimulation'

export const MAX_BUTTERFLIES = 1
// Simulation runs at 60 steps/second, like the crabs and the turtle.
export const PERCH_STEPS = 150
export const POLLEN_STEPS = 70
export const SOW_COOLDOWN = 360
const FLY_SPEED = 0.22
const WANDER_SPEED = 0.16

export type Butterfly = Point & {
  target: Point | null
  search: number
  perch: number
  pollen: number
  cooldown: number
  phase: number
  direction: number
  drift: number
  decision: number
  resting: boolean
  wave: number
  digging: boolean
  sleeping: number
  sleepDelay: number
}

const soil = (cell: number) => cell === Cell.Sand || cell === Cell.Mud
// Wings brush past petals and stems; only grains and rock can fill the body.
function inBody(world: Sandbox, x: number, y: number, match: (cell: number) => boolean) {
  for (let dy = -4; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (match(world.get(Math.round(x + dx), Math.round(y + dy)))) return true
  }
  return false
}
const buried = (world: Sandbox, x: number, y: number) => inBody(world, x, y, soil)
const openSky = (world: Sandbox, x: number, y: number) =>
  x >= 6 && x < world.width - 6 && y >= 4 && y < world.height - 2 &&
  !inBody(world, x, y, cell => soil(cell) || cell === Cell.Stone)

export function addButterfly(world: Sandbox, random: () => number) {
  if (world.butterflies.length >= MAX_BUTTERFLIES) return false
  // Scan from a random column, so a crowded board cannot cause an unbounded retry.
  const start = Math.floor(random() * world.width)
  for (let i = 0; i < world.width; i++) {
    const x = (start + i) % world.width
    for (let y = 10; y < world.height - 6; y++) {
      if (!openSky(world, x, y)) continue
      world.butterflies.push({
        x, y, target: null, search: 60, perch: 0, pollen: 0, cooldown: 240, phase: 0,
        direction: random() < 0.5 ? -1 : 1, drift: 0, decision: 60, resting: false, wave: 40,
        digging: false, sleeping: 0, sleepDelay: world.night ? nextSleepDelay(random) : 0,
      })
      return true
    }
  }
  return false
}

export function tapButterfly(world: Sandbox, point: Point) {
  const butterfly = world.butterflies.find(b =>
    Math.abs(b.x - point.x) <= 8 && Math.abs(b.y - point.y) <= 7 && !buried(world, b.x, b.y))
  if (!butterfly) return false
  wakeCreature(butterfly)
  butterfly.target = null; butterfly.perch = 0; butterfly.resting = false
  butterfly.search = 120
  butterfly.wave = 90
  butterfly.direction *= -1
  // Flutters up and away from the finger instead of being caught.
  butterfly.drift = -0.22
  butterfly.decision = 90
  return true
}

export const stepButterflies = (world: Sandbox, random: () => number) => {
  for (const butterfly of world.butterflies) stepButterfly(world, butterfly, random)
}

function stepButterfly(world: Sandbox, butterfly: Butterfly, random: () => number) {
  butterfly.pollen = Math.max(0, butterfly.pollen - 1)
  butterfly.cooldown = Math.max(0, butterfly.cooldown - 1)
  butterfly.wave = Math.max(0, butterfly.wave - 1)
  if (!butterfly.sleeping) butterfly.phase += butterfly.resting ? 0.05 : 0.38

  // Buried by poured sand: rise gradually, exactly like the crabs and the turtle.
  butterfly.digging = buried(world, butterfly.x, butterfly.y)
  if (butterfly.digging) {
    wakeCreature(butterfly)
    butterfly.target = null; butterfly.perch = 0; butterfly.resting = false
    if (!inBody(world, butterfly.x, butterfly.y - 0.06, cell => cell === Cell.Stone)) {
      butterfly.y = Math.max(4, butterfly.y - 0.06)
    }
    return
  }

  // Grains and water landing on the wings wake it; the ground it rests on does not.
  let disturbed = false
  for (let dy = -7; world.night && dy <= 0 && !disturbed; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      const cell = world.get(Math.round(butterfly.x + dx), Math.round(butterfly.y + dy))
      if (soil(cell) || cell === Cell.Water) { disturbed = true; break }
    }
  }
  if (!world.night || disturbed) wakeCreature(butterfly)
  if (butterfly.sleeping) {
    if (butterfly.sleeping === 1) { wakeCreature(butterfly); butterfly.sleepDelay = nextSleepDelay(random) }
    else { butterfly.sleeping--; return }
  } else if (world.night && !disturbed && !butterfly.wave && !butterfly.perch && --butterfly.sleepDelay <= 0) {
    // Settles down onto the sand or a bloom before folding its wings for the night.
    butterfly.target = null
    butterfly.resting = true
    if (openSky(world, butterfly.x, butterfly.y + 0.2)) { butterfly.y += 0.2; return }
    butterfly.sleeping = 180 + Math.floor(random() * 180)
    return
  }

  // Blooms are never eaten here: the butterfly only carries their pollen away.
  if (butterfly.target && !world.bloomingFlowers().some(p => p.x === butterfly.target!.x && p.y === butterfly.target!.y)) {
    butterfly.target = null; butterfly.perch = 0; butterfly.resting = false
  }
  if (butterfly.perch > 0) {
    butterfly.resting = true
    if (--butterfly.perch === 0) { butterfly.resting = false; butterfly.target = null; butterfly.search = 180 }
    return
  }
  if (!butterfly.target && !butterfly.wave && --butterfly.search <= 0) {
    butterfly.search = 90 + Math.floor(random() * 120)
    const blooms = world.bloomingFlowers()
    butterfly.target = blooms.length ? blooms[Math.floor(random() * blooms.length)] : null
  }
  const target = butterfly.target
  if (target) {
    const dx = target.x - butterfly.x, dy = target.y - 4 - butterfly.y
    const distance = Math.hypot(dx, dy)
    butterfly.direction = Math.sign(dx) || butterfly.direction
    if (distance <= 1) {
      butterfly.x = target.x; butterfly.y = target.y - 4
      butterfly.perch = PERCH_STEPS
      butterfly.resting = true
      pollinate(world, butterfly, random)
      return
    }
    const nx = butterfly.x + dx / distance * FLY_SPEED, ny = butterfly.y + dy / distance * FLY_SPEED
    if (openSky(world, nx, ny)) { butterfly.x = nx; butterfly.y = ny; return }
    // A wall or a sand hill is in the way: leave this bloom and flutter on.
    butterfly.target = null; butterfly.search = 120
  }

  if (--butterfly.decision <= 0) {
    butterfly.decision = 70 + Math.floor(random() * 140)
    butterfly.direction = random() < 0.5 ? -1 : 1
    butterfly.drift = (random() - 0.5) * 0.24
  }
  const nx = butterfly.x + butterfly.direction * (butterfly.wave ? 0.26 : WANDER_SPEED)
  const ny = butterfly.y + butterfly.drift
  if (openSky(world, nx, ny)) { butterfly.x = nx; butterfly.y = ny; return }
  if (openSky(world, nx, butterfly.y)) { butterfly.x = nx; butterfly.drift = -butterfly.drift || -0.1 }
  else if (openSky(world, butterfly.x, ny)) { butterfly.y = ny; butterfly.direction *= -1 }
  else { butterfly.direction *= -1; butterfly.drift = -butterfly.drift || -0.1 }
}

// Landing shakes the pollen loose. It drifts down beside the bloom and settles
// as fresh seeds, so new flowers keep appearing without anyone sowing them.
export function pollinate(world: Sandbox, butterfly: Butterfly, random: () => number) {
  butterfly.pollen = POLLEN_STEPS
  if (butterfly.cooldown > 0) return 0
  // Far enough from the bloom, and from each other, that every seed has room to sprout.
  const offsets = [-18, -12, 12, 18]
  const start = Math.floor(random() * offsets.length)
  let sown = 0
  // Damp sand first: there a seed really sprouts. Dry sand waits for the watering can.
  for (const damp of [true, false]) {
    for (let i = 0; i < offsets.length && sown < 2; i++) {
      const x = Math.round(butterfly.x + offsets[(start + i) % offsets.length])
      const y = groundAbove(world, x, Math.round(butterfly.y))
      if (y < 0 || world.get(x, y + 1) !== (damp ? Cell.Mud : Cell.Sand) || world.crowdedForSeed(x, y)) continue
      world.paint({ x, y }, Cell.Seed, 0)
      sown++
    }
    if (sown) break
  }
  if (sown) butterfly.cooldown = SOW_COOLDOWN
  return sown
}
// The open cell resting on top of the ground, or -1 when something is in the way.
function groundAbove(world: Sandbox, x: number, from: number) {
  for (let y = Math.max(0, from); y < world.height - 1; y++) {
    if (world.get(x, y) !== Cell.Empty) return -1
    if (world.get(x, y + 1) !== Cell.Empty) return y
  }
  return -1
}

export function renderButterflies(world: Sandbox, pixels: Uint8ClampedArray) {
  for (const butterfly of world.butterflies) {
    const flying = !butterfly.resting && !butterfly.sleeping && !butterfly.digging
    const bob = flying ? Math.sin(butterfly.phase * 0.4) * 1.5 : 0
    const dot = spritePainter(world, pixels, Math.round(butterfly.x), Math.round(butterfly.y + bob), 1)
    // Wings fold over the back at rest and beat wide open in flight.
    const spread = flying ? 0.78 + Math.abs(Math.sin(butterfly.phase)) * 0.22 : 0.5
    const wing = [176, 122, 226], edge = [124, 78, 176], spot = [255, 246, 214], body = [74, 55, 92]
    // Scaling the wing radius keeps a round pair of wings at every beat.
    const upper = 6 * spread, lower = 4 * spread
    for (const side of [-1, 1]) {
      for (let dy = -5; dy <= -1; dy++) for (let dx = 1; dx <= Math.ceil(upper); dx++) {
        if ((dx / upper) ** 2 + ((dy + 3) / 3) ** 2 <= 1) dot(side * dx, dy, dx > upper - 1.5 || dy === -5 ? edge : wing)
      }
      for (let dy = 0; dy <= 3; dy++) for (let dx = 1; dx <= Math.ceil(lower); dx++) {
        if ((dx / lower) ** 2 + ((dy - 1) / 2) ** 2 <= 1) dot(side * dx, dy, edge)
      }
      dot(side * Math.round(upper * 0.55), -3, spot)
      dot(side * Math.round(lower * 0.5), 1, spot)
      dot(side, -6, body); dot(side * 2, -7, body)
    }
    for (let dy = -4; dy <= 2; dy++) dot(0, dy, body)
    dot(0, -5, body)
    renderPollen(dot, butterfly)
    renderSleep(dot, butterfly)
  }
}
function renderPollen(dot: Dot, butterfly: Butterfly) {
  if (!butterfly.pollen) return
  const drift = (POLLEN_STEPS - butterfly.pollen) / POLLEN_STEPS
  const pollen = [255, 226, 97]
  for (const [dx, dy] of [[-4, -2], [4, -3], [-6, 1], [6, 0], [-2, 3], [2, 4], [0, -6]]) {
    dot(dx * (1 + drift), dy + drift * 7, pollen)
  }
}
