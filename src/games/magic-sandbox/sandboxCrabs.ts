import { Cell, type Point, type Sandbox } from './sandboxSimulation'

export const MAX_CRABS = 2
export const MAX_TURTLES = 1
// At 60 steps/second, leave half a minute between meals.
export const FULL_STEPS = 1800
export const EATING_STEPS = 90
export const creatureScale = (creature: Creature) => 1 + creature.growth * 0.25
export type Creature = Point & {
  kind: 'crab' | 'turtle'
  growth: number
  fullness: number
  search: number
  target: Point | null
  pursuit: number
  eating: number
  celebration: number
  direction: number
  decision: number
  resting: boolean
  wave: number
  cooldown: number
  phase: number
  digging: boolean
  sleeping: number
  sleepDelay: number
}
// Simulation runs at 60 steps/second. Each animal gets its own bedtime.
export const nextSleepDelay = (random: () => number) => 480 + Math.floor(random() * 900)
export function wakeCreature(creature: Creature) {
  if (!creature.sleeping) return
  creature.sleeping = 0
  creature.sleepDelay = 480
  creature.resting = false
  creature.decision = 90
}
const blockingCell = (cell: number) => cell === Cell.Stone || cell === Cell.Seed
const soil = (cell: number) => cell === Cell.Sand || cell === Cell.Mud

function blocked(world: Sandbox, x: number, y: number, scale = 1) {
  for (let dy = -Math.ceil(7 * scale); dy <= 0; dy++) for (let dx = -Math.ceil(6 * scale); dx <= Math.ceil(6 * scale); dx++) {
    if (blockingCell(world.get(Math.round(x + dx), Math.round(y + dy)))) return true
  }
  return false
}

export const addCrab = (world: Sandbox, random: () => number) => addCreature(world, random, 'crab')
export const addTurtle = (world: Sandbox, random: () => number) => addCreature(world, random, 'turtle')
function addCreature(world: Sandbox, random: () => number, kind: Creature['kind']) {
  const group = kind === 'crab' ? world.crabs : world.turtles
  if (group.length >= (kind === 'crab' ? MAX_CRABS : MAX_TURTLES)) return false
  // Scan from a random column, so a crowded board cannot cause an unbounded retry.
  const start = Math.floor(random() * world.width)
  for (let i = 0; i < world.width; i++) {
    const x = (start + i) % world.width
    if (x < 7 || x >= world.width - 7) continue
    let y = 8
    while (y < world.height - 1 && !soil(world.get(x, y + 1)) && !blockingCell(world.get(x, y + 1))) y++
    if (blocked(world, x, y) || [...world.crabs, ...world.turtles].some(c => Math.hypot(c.x - x, c.y - y) < 20)) continue
    group.push({ kind, growth: 0, fullness: 600, search: 0, target: null, pursuit: 0, eating: 0, celebration: 0, x, y, direction: random() < 0.5 ? -1 : 1, decision: 90, resting: false, wave: 70, cooldown: 300, phase: 0, digging: false, sleeping: 0, sleepDelay: world.night ? nextSleepDelay(random) : 0 })
    return true
  }
  return false
}

export const tapCrab = (world: Sandbox, point: Point) => tapCreature(world, point, world.crabs)
export const tapTurtle = (world: Sandbox, point: Point) => tapCreature(world, point, world.turtles)
function tapCreature(world: Sandbox, point: Point, group: Creature[]) {
  const crab = group.find(c => Math.abs(c.x - point.x) <= 9 * creatureScale(c) && Math.abs(c.y - 4 * creatureScale(c) - point.y) <= 9 * creatureScale(c) &&
    !soil(world.get(Math.round(c.x), Math.round(c.y - 5))))
  if (!crab) return false
  wakeCreature(crab)
  crab.target = null; crab.eating = 0; crab.search = 90
  crab.wave = 90
  crab.direction *= -1
  crab.resting = true
  crab.decision = 90
  return true
}

export const stepCrabs = (world: Sandbox, random: () => number) => stepCreatures(world, random, world.crabs)
export const stepTurtles = (world: Sandbox, random: () => number) => stepCreatures(world, random, world.turtles)
function overlap(a: Creature, b: Creature, x = a.x, y = a.y) {
  const sa = creatureScale(a), sb = creatureScale(b)
  if (y <= b.y - 9 * sb || b.y <= y - 9 * sa) return 0
  return Math.max(0, 9 * (sa + sb) - Math.abs(x - b.x))
}

function separate(world: Sandbox, creature: Creature, scale: number) {
  const others = [...world.crabs, ...world.turtles].filter(c => c !== creature)
  const crowd = others.filter(c => overlap(creature, c) > 0)
  if (!crowd.length) return false
  wakeCreature(creature)
  const nearest = crowd.sort((a, b) => Math.abs(a.x - creature.x) - Math.abs(b.x - creature.x))[0]
  const order = [...world.crabs, ...world.turtles]
  const away = Math.sign(creature.x - nearest.x) || (order.indexOf(creature) < order.indexOf(nearest) ? -1 : 1)
  for (const direction of [away, -away]) {
    const nx = creature.x + direction * 0.12
    if (nx < 7 * scale || nx >= world.width - 7 * scale || blocked(world, nx, creature.y, scale)) continue
    // Escape existing overlaps without pushing into another animal.
    if (others.some(c => overlap(creature, c, nx) > overlap(creature, c))) continue
    creature.x = nx
    creature.direction = direction
    creature.resting = false; creature.wave = 0; creature.decision = 90
    break
  }
  creature.target = null; creature.eating = 0; creature.search = 90
  return true
}

function stepCreatures(world: Sandbox, random: () => number, group: Creature[]) {
  for (const crab of group) {
    const grownScale = creatureScale(crab)
    // A meal beside a wall can enlarge the shell into it. Keep the original
    // clearance until the animal walks out, instead of trapping it after growth.
    const scale = crab.x < 7 * grownScale || crab.x >= world.width - 7 * grownScale || blocked(world, crab.x, crab.y, grownScale) ? 1 : grownScale
    crab.fullness = Math.max(0, crab.fullness - 1)
    crab.celebration = Math.max(0, crab.celebration - 1)
    if (!crab.sleeping) crab.phase += 0.12
    crab.wave = Math.max(0, crab.wave - 1)
    crab.cooldown = Math.max(0, crab.cooldown - 1)
    const x = Math.round(crab.x), feet = Math.round(crab.y)
    crab.digging = [-3, 0, 3].some(dx => soil(world.get(x + dx, feet)))
    if (crab.digging) {
      wakeCreature(crab)
      crab.target = null; crab.eating = 0
      // Never snap to a surface: claws, eyes, then legs emerge as the body rises.
      if (!blocked(world, crab.x, crab.y - 0.055, scale)) crab.y = Math.max(8, crab.y - 0.055)
      else crab.direction *= -1
      continue
    }
    if (feet < world.height - 1 && [-3, 0, 3].every(dx => {
      const cell = world.get(x + dx, feet + 1)
      return !soil(cell) && !blockingCell(cell)
    })) {
      wakeCreature(crab)
      crab.target = null; crab.eating = 0
      if (!blocked(world, crab.x, crab.y + 0.35, scale)) crab.y = Math.min(world.height - 1, crab.y + 0.35)
      continue
    }
    if (separate(world, crab, scale)) continue
    const feeding = feed(world, crab, random)
    if (feeding || crab.target) wakeCreature(crab)
    if (feeding) continue
    // Falling grains and water can touch any part of a grown animal's body.
    let disturbed = false
    for (let dy = -Math.ceil(8 * grownScale); world.night && dy <= 0 && !disturbed; dy++) {
      for (let dx = -Math.ceil(6 * grownScale); dx <= Math.ceil(6 * grownScale); dx++) {
        const cell = world.get(x + dx, feet + dy)
        if (soil(cell) || cell === Cell.Water) { disturbed = true; break }
      }
    }
    if (!world.night || disturbed) wakeCreature(crab)
    if (crab.sleeping) {
      if (crab.sleeping === 1) { wakeCreature(crab); crab.sleepDelay = nextSleepDelay(random) }
      else { crab.sleeping--; continue }
    } else if (world.night && !disturbed && !crab.target && !crab.wave && !crab.celebration && --crab.sleepDelay <= 0) {
      crab.sleeping = 180 + Math.floor(random() * 180)
      crab.resting = true
      continue
    }
    if (!crab.target && --crab.decision <= 0) {
      crab.decision = 80 + Math.floor(random() * 160)
      crab.resting = random() < 0.35
      crab.direction = random() < 0.5 ? -1 : 1
      if (crab.resting && random() < 0.5) crab.wave = 45
      // A small, occasional preference, without a destination or pathfinding.
      if (!crab.resting && random() < 0.3) {
        let nearest = 25
        for (let dx = -24; dx <= 24; dx++) for (let dy = -5; dy <= 3; dy++) {
          if (Math.abs(dx) < nearest && world.get(x + dx, feet + dy) === Cell.Water) {
            nearest = Math.abs(dx)
            if (dx) crab.direction = Math.sign(dx)
          }
        }
      }
    }
    const other = crab.kind === 'crab' && !crab.target ? world.crabs.find(c => c !== crab && !c.target && !c.sleeping) : undefined
    if (other && !other.digging && Math.abs(other.y - crab.y) < 5) {
      const distance = Math.abs(other.x - crab.x)
      if (distance < 22 && crab.cooldown === 0 && other.cooldown === 0) {
        crab.direction = Math.sign(other.x - crab.x) || 1
        other.direction = -crab.direction
        for (const friend of [crab, other]) {
          friend.wave = 100; friend.resting = true; friend.decision = 100; friend.cooldown = 650
        }
      }
      // Finish the greeting by wandering apart; do not repeatedly meet in place.
      if (distance < 23 && crab.cooldown > 0 && crab.wave === 0) {
        crab.direction = Math.sign(crab.x - other.x) || 1
        crab.resting = false
      }
      if (distance < 15 && Math.sign(other.x - crab.x) === crab.direction) continue
    }
    if (crab.resting || crab.wave > 0) continue
    const nx = crab.x + crab.direction * (crab.kind === 'turtle' ? 0.04 : 0.075)
    let ny = crab.y
    // Small sand slopes are climbed gradually; rocks and ungerminated seeds turn the crab around.
    if (soil(world.get(Math.round(nx + crab.direction * 4), feet))) ny -= 0.12
    if ([...world.crabs, ...world.turtles].some(c => c !== crab && overlap(crab, c, nx, ny) > overlap(crab, c))) {
      crab.target = null; crab.eating = 0; crab.search = 90
      crab.direction *= -1; crab.decision = 90
      continue
    }
    if (nx < 7 * scale || nx >= world.width - 7 * scale || blocked(world, nx, ny, scale)) {
      crab.target = null; crab.eating = 0
      crab.direction *= -1; crab.resting = true; crab.decision = 35
    } else { crab.x = nx; crab.y = Math.max(8, ny) }
  }
}

export function renderCrabs(world: Sandbox, pixels: Uint8ClampedArray) {
  for (const [index, crab] of world.crabs.entries()) {
    const wobble = crab.digging ? Math.sin(crab.phase * 2) * 0.6 : 0
    const cx = Math.round(crab.x + wobble), cy = Math.round(crab.y)
    const shell = index === 0 ? [232, 91, 63] : [242, 151, 57]
    const dot = creaturePainter(world, pixels, crab, cx, cy)
    const lift = crab.wave > 0 || crab.digging ? Math.round(1 + Math.sin(crab.phase * 2)) : 0
    const stride = !crab.resting && !crab.wave ? Math.round(Math.sin(crab.phase)) : 0
    if (crab.eating && crab.target) {
      const scale = creatureScale(crab)
      const tx = (crab.target.x - cx) / scale, ty = (crab.target.y - cy) / scale
      const pinch = Math.sin(crab.phase * 3) > 0 ? 2 : 1
      line(dot, crab.direction * 5, -5, tx, ty + 2, shell)
      for (let dy = -2; dy <= 1; dy++) { dot(tx - pinch, ty + dy, shell); dot(tx + pinch, ty + dy, shell) }
    }
    for (const side of [-1, 1]) {
      for (let leg = 0; leg < 3; leg++) {
        dot(side * 5, -3 + leg, shell); dot(side * 6, -2 + leg + stride, shell)
      }
      dot(side * 5, -5, shell); dot(side * 6, -6, shell)
      for (let dy = -9 - lift; dy <= -7 - lift; dy++) {
        dot(side * 6, dy, shell); dot(side * 8, dy, shell)
      }
      dot(side * 7, -7 - lift, shell)
    }
    for (let dy = -5; dy <= -1; dy++) for (let dx = -4; dx <= 4; dx++) {
      if (dx * dx / 25 + (dy + 3) ** 2 / 9 <= 1) dot(dx, dy, dy === -5 ? [255, 184, 117] : shell)
    }
    for (const side of [-1, 1]) {
      dot(side * 2, -6, shell)
      if (crab.sleeping) {
        dot(side * 2, -7, [63, 56, 48]); dot(side * 2 + 1, -7, [63, 56, 48])
      } else {
        dot(side * 2, -7, [255, 255, 236]); dot(side * 2 + crab.direction, -7, [63, 56, 48])
      }
    }
    dot(-1, -2, [120, 57, 40]); dot(0, -1, [120, 57, 40]); dot(1, -2, [120, 57, 40])
    renderCelebration(dot, crab)
    renderSleep(dot, crab)
  }
}

// Only live blooms are food. Search occasionally, reserve one flower per animal,
// and abandon unreachable targets so wandering never gets stuck in a chase.
function feed(world: Sandbox, creature: Creature, random: () => number) {
  if (creature.fullness > 0) return false
  const blooms = world.bloomingFlowers()
  const scale = creatureScale(creature)
  if (creature.target && (!blooms.some(p => p.x === creature.target!.x && p.y === creature.target!.y) || creature.y - creature.target.y < 2 || creature.y - creature.target.y > 18 * scale || --creature.pursuit <= 0)) {
    creature.target = null; creature.eating = 0; creature.search = 240
  }
  if (!creature.target && --creature.search <= 0) {
    creature.search = 240 + Math.floor(random() * 240)
    const friends = [...world.crabs, ...world.turtles]
    creature.target = blooms.filter(p => Math.abs(p.x - creature.x) <= 40 &&
      creature.y - p.y >= 2 && creature.y - p.y <= 18 * scale &&
      !friends.some(c => c !== creature && c.target?.x === p.x && c.target.y === p.y))
      .sort((a, b) => Math.abs(a.x - creature.x) - Math.abs(b.x - creature.x))[0] ?? null
    creature.pursuit = 1000
  }
  const target = creature.target
  if (!target) return false
  creature.direction = Math.sign(target.x - creature.x) || creature.direction
  creature.resting = false; creature.wave = 0
  if (Math.abs(target.x - creature.x) > 10 * scale) return false
  // Do not reach through rock, sand, or an ungerminated seed to eat.
  const mouthY = creature.y - 5 * scale
  const length = Math.ceil(Math.hypot(target.x - creature.x, target.y - mouthY))
  for (let i = 0; i <= length; i++) {
    const t = i / Math.max(1, length)
    const cell = world.get(Math.round(creature.x + (target.x - creature.x) * t), Math.round(mouthY + (target.y - mouthY) * t))
    if (blockingCell(cell) || soil(cell)) {
      creature.target = null; creature.eating = 0; creature.search = 240
      return false
    }
  }
  if (!creature.eating) creature.eating = EATING_STEPS
  else if (--creature.eating === 0) {
    if (world.eatFlower(target)) {
      creature.growth = Math.min(2, creature.growth + 1)
      creature.fullness = FULL_STEPS
      creature.celebration = 120
      creature.resting = true; creature.decision = 120
    }
    creature.target = null
  }
  return true
}

type Dot = (x: number, y: number, color: number[]) => void
function creaturePainter(world: Sandbox, pixels: Uint8ClampedArray, creature: Creature, cx: number, cy: number): Dot {
  const scale = creatureScale(creature)
  return (dx, dy, color) => {
    // Fill scaled pixels, avoiding gaps in the larger growth stages.
    for (let y = Math.round(cy + dy * scale); y < Math.round(cy + (dy + 1) * scale); y++) {
      for (let x = Math.round(cx + dx * scale); x < Math.round(cx + (dx + 1) * scale); x++) {
        if (x < 0 || x >= world.width || y < 0 || y >= world.height) continue
        const cell = world.get(x, y)
        // Grains mask the body as claws / head / shell gradually emerge.
        if (soil(cell) || blockingCell(cell)) continue
        const offset = (y * world.width + x) * 4
        pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255
      }
    }
  }
}
function line(dot: Dot, x: number, y: number, tx: number, ty: number, color: number[]) {
  const steps = Math.ceil(Math.hypot(tx - x, ty - y))
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps)
    dot(x + (tx - x) * t, y + (ty - y) * t, color)
  }
}
function renderCelebration(dot: Dot, creature: Creature) {
  if (!creature.celebration || creature.digging) return
  const rise = Math.floor((120 - creature.celebration) / 40)
  const pink = [246, 105, 144]
  for (const [x, y] of [[-2, -15], [-1, -15], [1, -15], [2, -15], [-2, -14], [-1, -14], [0, -14], [1, -14], [2, -14], [-1, -13], [0, -13], [1, -13], [0, -12]]) dot(x, y - rise, pink)
}
function renderSleep(dot: Dot, creature: Creature) {
  if (!creature.sleeping) return
  const rise = Math.floor((creature.sleeping % 120) / 40)
  const blue = [215, 233, 255]
  // Two quiet pixel Zs, with a slow breath instead of sparkling particles.
  for (const [ox, oy] of [[0, -14 - rise], [5, -18 - rise]]) {
    for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2]]) dot(ox + dx, oy + dy, blue)
  }
}
export function renderTurtles(world: Sandbox, pixels: Uint8ClampedArray) {
  for (const turtle of world.turtles) {
    const wobble = turtle.digging ? Math.sin(turtle.phase * 2) * 0.6 : 0
    const cx = Math.round(turtle.x + wobble), cy = Math.round(turtle.y)
    const dot = creaturePainter(world, pixels, turtle, cx, cy)
    const skin = [133, 184, 77], dark = [58, 112, 65], shell = [73, 145, 82]
    const stride = !turtle.resting && !turtle.eating ? Math.round(Math.sin(turtle.phase * 0.6)) : 0
    for (const side of [-1, 1]) {
      for (let dx = 2; dx <= 4; dx++) { dot(side * dx, -1, skin); dot(side * dx + stride, 0, skin) }
    }
    dot(-turtle.direction * 7, -2, skin)
    let hx = turtle.direction * (turtle.sleeping ? 5 : 7), hy = -4
    if (turtle.eating && turtle.target) {
      const stretch = Math.min(1, (EATING_STEPS - turtle.eating) / 30)
      hx += ((turtle.target.x - cx) / creatureScale(turtle) - turtle.direction * 2 - hx) * stretch
      hy += ((turtle.target.y - cy) / creatureScale(turtle) - hy) * stretch
    } else if (turtle.wave || turtle.digging) hy -= 1 + Math.sin(turtle.phase)
    for (let dy = 0; dy <= 1; dy++) line(dot, turtle.direction * 4, -3 + dy, hx, hy + dy, skin)
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 2; dx++) dot(hx + dx, hy + dy, skin)
    if (!turtle.sleeping) dot(hx + turtle.direction, hy - 1, [255, 255, 236])
    dot(hx + turtle.direction, hy, [42, 62, 47])
    if (turtle.eating && Math.sin(turtle.phase * 3) > 0) dot(hx + turtle.direction * 2, hy + 1, dark)
    for (let dy = -7; dy <= -2; dy++) for (let dx = -6; dx <= 6; dx++) {
      if (dx * dx / 42 + (dy + 3) ** 2 / 20 <= 1) {
        dot(dx, dy, dy === -2 || dx % 4 === 0 || dy === -5 ? dark : shell)
      }
    }
    dot(-2, -6, [159, 196, 103]); dot(-1, -6, [159, 196, 103])
    renderCelebration(dot, turtle)
    renderSleep(dot, turtle)
  }
}
