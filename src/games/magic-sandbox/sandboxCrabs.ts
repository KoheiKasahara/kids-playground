import { Cell, type Point, type Sandbox } from './sandboxSimulation'

export const MAX_CRABS = 2
export type Crab = Point & {
  direction: number
  decision: number
  resting: boolean
  wave: number
  cooldown: number
  phase: number
  digging: boolean
}
const protectedCell = (cell: number) => cell === Cell.Stone || cell === Cell.Seed || cell >= Cell.Stem
const soil = (cell: number) => cell === Cell.Sand || cell === Cell.Mud

function blocked(world: Sandbox, x: number, y: number) {
  for (let dy = -7; dy <= 0; dy++) for (let dx = -6; dx <= 6; dx++) {
    if (protectedCell(world.get(Math.round(x + dx), Math.round(y + dy)))) return true
  }
  return false
}

export function addCrab(world: Sandbox, random: () => number) {
  if (world.crabs.length >= MAX_CRABS) return false
  // Scan from a random column, so a crowded board cannot cause an unbounded retry.
  const start = Math.floor(random() * world.width)
  for (let i = 0; i < world.width; i++) {
    const x = (start + i) % world.width
    if (x < 7 || x >= world.width - 7) continue
    let y = 8
    while (y < world.height - 1 && !soil(world.get(x, y + 1)) && !protectedCell(world.get(x, y + 1))) y++
    if (blocked(world, x, y) || world.crabs.some(c => Math.hypot(c.x - x, c.y - y) < 20)) continue
    world.crabs.push({ x, y, direction: random() < 0.5 ? -1 : 1, decision: 90, resting: false, wave: 70, cooldown: 300, phase: 0, digging: false })
    return true
  }
  return false
}

export function tapCrab(world: Sandbox, point: Point) {
  const crab = world.crabs.find(c => Math.abs(c.x - point.x) <= 9 && Math.abs(c.y - 4 - point.y) <= 9 &&
    !soil(world.get(Math.round(c.x), Math.round(c.y - 5))))
  if (!crab) return false
  crab.wave = 90
  crab.direction *= -1
  crab.resting = true
  crab.decision = 90
  return true
}

export function stepCrabs(world: Sandbox, random: () => number) {
  for (const crab of world.crabs) {
    crab.phase += 0.12
    crab.wave = Math.max(0, crab.wave - 1)
    crab.cooldown = Math.max(0, crab.cooldown - 1)
    const x = Math.round(crab.x), feet = Math.round(crab.y)
    crab.digging = [-3, 0, 3].some(dx => soil(world.get(x + dx, feet)))
    if (crab.digging) {
      // Never snap to a surface: claws, eyes, then legs emerge as the body rises.
      if (!blocked(world, crab.x, crab.y - 0.055)) crab.y = Math.max(8, crab.y - 0.055)
      else crab.direction *= -1
      continue
    }
    if (feet < world.height - 1 && [-3, 0, 3].every(dx => {
      const cell = world.get(x + dx, feet + 1)
      return cell === Cell.Empty || cell === Cell.Water
    })) {
      if (!blocked(world, crab.x, crab.y + 0.35)) crab.y = Math.min(world.height - 1, crab.y + 0.35)
      continue
    }
    if (--crab.decision <= 0) {
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
    const other = world.crabs.find(c => c !== crab)
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
    const nx = crab.x + crab.direction * 0.075
    let ny = crab.y
    // Small sand slopes are climbed gradually; rocks and plants turn the crab around.
    if (soil(world.get(Math.round(nx + crab.direction * 4), feet))) ny -= 0.12
    if (nx < 7 || nx >= world.width - 7 || blocked(world, nx, ny)) {
      crab.direction *= -1; crab.resting = true; crab.decision = 35
    } else { crab.x = nx; crab.y = Math.max(8, ny) }
  }
}

export function renderCrabs(world: Sandbox, pixels: Uint8ClampedArray) {
  for (const [index, crab] of world.crabs.entries()) {
    const wobble = crab.digging ? Math.sin(crab.phase * 2) * 0.6 : 0
    const cx = Math.round(crab.x + wobble), cy = Math.round(crab.y)
    const shell = index === 0 ? [232, 91, 63] : [242, 151, 57]
    const dot = (dx: number, dy: number, color: number[]) => {
      const x = cx + dx, y = cy + dy
      if (x < 0 || x >= world.width || y < 0 || y >= world.height) return
      const cell = world.get(x, y)
      // The actual grains hide the crab, including the raised claws while deeply buried.
      if (cell !== Cell.Empty && cell !== Cell.Water) return
      const offset = (y * world.width + x) * 4
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255
    }
    const lift = crab.wave > 0 || crab.digging ? Math.round(1 + Math.sin(crab.phase * 2)) : 0
    const stride = !crab.resting && !crab.wave ? Math.round(Math.sin(crab.phase)) : 0
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
      dot(side * 2, -6, shell); dot(side * 2, -7, [255, 255, 236])
      dot(side * 2 + crab.direction, -7, [63, 56, 48])
    }
    dot(-1, -2, [120, 57, 40]); dot(0, -1, [120, 57, 40]); dot(1, -2, [120, 57, 40])
  }
}
