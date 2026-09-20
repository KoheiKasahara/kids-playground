import type { Dot } from './sandboxCrabs'
import type { Sandbox } from './sandboxSimulation'

// Simulation runs at 60 steps/second, like the crabs and the butterfly.
/** A crow keeps to itself: one crossing, then a long quiet stretch of night. */
export const nextCrowDelay = (random: () => number) => 420 + Math.floor(random() * 1080)
// Room enough off the side for the whole bird, beak to tail, to be out of sight.
const OFFSCREEN = 14

export type Crow = { x: number; y: number; direction: number; speed: number; phase: number }

function addCrow(world: Sandbox, random: () => number) {
  const direction = random() < 0.5 ? -1 : 1
  world.crows.push({
    x: direction > 0 ? -OFFSCREEN : world.width + OFFSCREEN,
    // The lane just under the moon in the top of the sky, well above any sand hill.
    y: world.height * (0.18 + random() * 0.07),
    direction,
    // A few seconds from edge to edge, whatever shape the board has.
    speed: (world.width + OFFSCREEN * 2) / ((5 + random() * 2) * 60),
    phase: random() * Math.PI * 2,
  })
  world.crowDelay = nextCrowDelay(random)
}

export function stepCrows(world: Sandbox, random: () => number) {
  for (let i = world.crows.length - 1; i >= 0; i--) {
    const crow = world.crows[i]
    crow.phase += 0.22
    crow.x += crow.direction * crow.speed
    // It only ever crosses: nothing below can stop it, and it never turns back.
    if (crow.direction > 0 ? crow.x > world.width + OFFSCREEN : crow.x < -OFFSCREEN) world.crows.splice(i, 1)
  }
  // Only nightfall sends one over; one already in the air flies on into the daylight.
  if (!world.night || world.crows.length) return
  if (--world.crowDelay <= 0) addCrow(world, random)
}

/** Keep a crossing crow in its lane, and at its pace, when the board changes shape. */
export function reshapeCrows(world: Sandbox, previousWidth: number, previousHeight: number) {
  for (const crow of world.crows) {
    crow.x = crow.x / previousWidth * world.width
    crow.y = crow.y / previousHeight * world.height
    crow.speed = crow.speed / previousWidth * world.width
  }
}

const BODY = [45, 49, 68], FAR_WING = [33, 36, 53], EDGE = [128, 142, 176], BEAK = [240, 176, 74], EYE = [255, 250, 226]
export function renderCrows(world: Sandbox, pixels: Uint8ClampedArray) {
  for (const crow of world.crows) {
    const flap = Math.sin(crow.phase)
    // The body rides up on the downstroke, which gives the flight its bob.
    const dot = crowPainter(world, pixels, Math.round(crow.x), Math.round(crow.y - flap * 1.2))
    const forward = crow.direction
    // The far wing trails half a beat behind the near one, so the bird looks round.
    wing(dot, forward, Math.sin(crow.phase - 0.7), -1, FAR_WING, null)
    for (let dy = -2; dy <= 2; dy++) for (let dx = -5; dx <= 5; dx++) {
      if (dx * dx / 27 + dy * dy / 5.3 <= 1) dot(dx, dy, BODY)
    }
    // A tail fanning out behind, then the head with its heavy beak and one pale eye.
    for (let dx = 5; dx <= 9; dx++) for (let dy = dx > 7 ? -1 : 0; dy <= (dx > 6 ? 1 : 0); dy++) dot(-forward * dx, dy, BODY)
    for (let dy = -5; dy <= -1; dy++) for (let dx = 4; dx <= 8; dx++) {
      if ((dx - 6) ** 2 / 5.5 + (dy + 3) ** 2 / 5.5 <= 1) dot(forward * dx, dy, BODY)
    }
    for (const [dx, dy] of [[9, -3], [10, -3], [9, -2]]) dot(forward * dx, dy, BEAK)
    dot(forward * 7, -4, EYE)
    wing(dot, forward, flap, 1, BODY, EDGE)
  }
}

// One wing, from the shoulder out to a tip that swings a long way above and below.
function wing(dot: Dot, forward: number, flap: number, side: number, color: number[], rim: number[] | null) {
  const rootX = forward * side, rootY = -1 + side * 0.5
  const reach = -forward * 4, lift = -7.5 * flap
  const length = Math.hypot(reach, lift) || 1
  // The blade is broad at the shoulder and narrow at the tip, across the beat.
  const [nx, ny] = [-lift / length, reach / length]
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, x = rootX + reach * t, y = rootY + lift * t, spread = 3 - 2 * t
    for (let d = -spread / 2; d <= spread / 2; d += 0.5) dot(x + nx * d, y + ny * d, color)
    // A lit upper edge, so the silhouette still reads against the dark night sky.
    const lit = spread / (ny > 0 ? -2 : 2)
    if (rim) dot(x + nx * lit, y + ny * lit, rim)
  }
}

// Nothing masks a crow: it passes in front of the sand, the walls and the animals.
function crowPainter(world: Sandbox, pixels: Uint8ClampedArray, cx: number, cy: number): Dot {
  return (dx, dy, color) => {
    const x = Math.round(cx + dx), y = Math.round(cy + dy)
    if (x < 0 || x >= world.width || y < 0 || y >= world.height) return
    const offset = (y * world.width + x) * 4
    pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2]; pixels[offset + 3] = 255
  }
}
