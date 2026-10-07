import { item, oval, rect, sprite } from './art'
import { EFFECT_SECONDS, GET_HOLD, GET_RISE, effectAge, isEffectActive, type Effect } from './effects'

function hash(n: number) {
  const value = Math.sin(n * 91.7 + 17.3) * 43758.5453
  return value - Math.floor(value)
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const easeOut = (value: number) => 1 - (1 - value) * (1 - value)

const HEART = ['.o.o.', 'oaoao', 'oaaao', '.oao.', '..o..']
const HEART_COLORS = { o: '#c45b6c', a: '#f39aa8' }

function withAlpha(ctx: CanvasRenderingContext2D, alpha: number, draw: () => void) {
  if (alpha <= 0) return
  ctx.save()
  ctx.globalAlpha = Math.min(1, alpha)
  draw()
  ctx.restore()
}

/** Four-point twinkle: a plus with a bright center. */
function twinkle(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color = '#fff3b8') {
  const arm = Math.max(1, Math.round(size))
  rect(ctx, color, x - arm, y, arm * 2 + 1, 1)
  rect(ctx, color, x, y - arm, 1, arm * 2 + 1)
  rect(ctx, '#ffffff', x, y, 1, 1)
}

/** Item sprite at an integer scale, centered on (x, y), so pixels stay crisp. */
function bigItem(ctx: CanvasRenderingContext2D, effect: Effect, x: number, y: number, scale: 1 | 2) {
  ctx.save()
  ctx.translate(Math.round(x - 8 * scale), Math.round(y - 8 * scale))
  ctx.scale(scale, scale)
  item(ctx, effect.item, 0, 0)
  ctx.restore()
}

function burst(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number, rays = 8, reach = 22) {
  const k = clamp01(progress)
  withAlpha(ctx, 1 - k, () => {
    for (let i = 0; i < rays; i++) {
      const angle = i / rays * Math.PI * 2 + 0.2
      const distance = 6 + easeOut(k) * reach
      const px = Math.round(x + Math.cos(angle) * distance)
      const py = Math.round(y + Math.sin(angle) * distance)
      twinkle(ctx, px, py, i % 2 ? 1 : 2, i % 3 === 0 ? '#ffe6a0' : '#fff7d6')
    }
  })
}

function drawGet(ctx: CanvasRenderingContext2D, effect: Effect, age: number) {
  const { from, to } = effect
  if (effect.dig && age < 0.6) {
    // Soil flies out of the furrow as the carrot is pulled.
    for (let i = 0; i < 9; i++) {
      const t = age / 0.6
      const vx = (hash(i) - 0.5) * 34
      const vy = -18 - hash(i + 9) * 22
      const px = from.x + vx * t
      const py = from.y + vy * t + 60 * t * t
      withAlpha(ctx, 1 - t, () => rect(ctx, i % 3 ? '#8a6542' : '#b48a5c', px, py, 2, 2))
    }
  }
  if (age < GET_RISE) {
    const k = age / GET_RISE
    const x = from.x + (to.x - from.x) * k
    const y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 16
    bigItem(ctx, effect, x, y, 1)
    return
  }
  if (age < GET_HOLD) {
    const k = (age - GET_RISE) / (GET_HOLD - GET_RISE)
    // A soft halo and a ring of twinkles while the courier shows off the find.
    const glow = Math.round(Math.sin(age * 10) * 1)
    withAlpha(ctx, 0.45 * (1 - k * 0.4), () => oval(ctx, '#fff3bf', to.x - 22 - glow, to.y - 21 - glow, 45 + glow * 2, 43 + glow * 2))
    withAlpha(ctx, 0.55 * (1 - k * 0.4), () => oval(ctx, '#fffbe6', to.x - 15, to.y - 14, 31, 29))
    burst(ctx, to.x, to.y, k * 1.3, 10, 24)
    for (let i = 0; i < 4; i++) {
      const angle = age * 2.6 + i * Math.PI / 2
      const blink = Math.sin(age * 14 + i * 2) > -0.2
      if (blink) twinkle(ctx, Math.round(to.x + Math.cos(angle) * 21), Math.round(to.y + Math.sin(angle) * 17), 1)
    }
    const bob = Math.round(Math.sin(age * 7) * 1)
    bigItem(ctx, effect, to.x, to.y + bob, 2)
    return
  }
  const k = clamp01((age - GET_HOLD) / (EFFECT_SECONDS.get - GET_HOLD))
  // Into the satchel: shrink back to size and drop toward the courier's side.
  withAlpha(ctx, 1 - k * 0.8, () => bigItem(ctx, effect, to.x + k * 6, to.y + k * 20, 1))
}

function drawWater(ctx: CanvasRenderingContext2D, effect: Effect, age: number) {
  const { x, y } = effect.from
  // A little watering can tips over the rows, then the leaves perk up with sparkles.
  const tilt = age < 0.15 ? 0 : 1
  const canX = Math.round(x + 18), canY = Math.round(y - 20 + Math.sin(age * 8) * 1)
  if (age < 1.05) {
    rect(ctx, '#45605d', canX - 1, canY - 1, 11, 9)
    rect(ctx, '#8daf9b', canX, canY, 9, 7)
    rect(ctx, '#bed1b0', canX + 1, canY, 6, 1)
    rect(ctx, '#45605d', canX - 4 - tilt, canY + 2 + tilt * 2, 4, 2)
    rect(ctx, '#45605d', canX - 6 - tilt, canY + 3 + tilt * 3, 3, 2)
    rect(ctx, '#45605d', canX + 3, canY - 4, 4, 1)
    rect(ctx, '#45605d', canX + 2, canY - 4, 1, 4)
    rect(ctx, '#45605d', canX + 7, canY - 4, 1, 4)
  }
  for (let i = 0; i < 16; i++) {
    const start = 0.12 + i * 0.045
    const t = (age - start) / 0.32
    if (t < 0 || t > 1.35) continue
    const dx = x - 18 + Math.round(hash(i + 3) * 28)
    const top = canY + 6
    const bottom = y + 8 + (i % 3) * 5
    if (t <= 1) {
      rect(ctx, '#bfe6f2', dx, top + (bottom - top) * t, 1, 3)
      rect(ctx, '#ffffff', dx, top + (bottom - top) * t, 1, 1)
    } else {
      const splash = Math.round((t - 1) * 8)
      rect(ctx, '#bfe6f2', dx - 1 - splash, bottom + 2, 1, 1)
      rect(ctx, '#bfe6f2', dx + 1 + splash, bottom + 2, 1, 1)
    }
  }
  if (age > 0.8) {
    const k = clamp01((age - 0.8) / 0.6)
    withAlpha(ctx, 1 - k, () => {
      for (let i = 0; i < 6; i++) {
        const sx = x - 15 + Math.round(hash(i + 30) * 30)
        const sy = y + 10 - Math.round(easeOut(k) * 14) - (i % 3) * 3
        twinkle(ctx, sx, sy, i % 2 ? 1 : 2, i % 2 ? '#d9f7a8' : '#fff3b8')
      }
    })
  }
}

function drawRepair(ctx: CanvasRenderingContext2D, effect: Effect, age: number) {
  const { x, y } = effect.from
  // Dust puffs as the planks land (the planks themselves are drawn by the bridge).
  for (let i = 0; i < 6; i++) {
    const t = (age - 0.12 - i * 0.14) / 0.35
    if (t < 0 || t > 1) continue
    const side = i % 2 ? 1 : -1
    const px = x + (i - 2.5) * 6
    withAlpha(ctx, 1 - t, () => {
      rect(ctx, '#efe1bf', px + side * (3 + t * 6), y + 6 - t * 4, 2, 2)
      rect(ctx, '#efe1bf', px - side * (2 + t * 5), y + 4 - t * 6, 2, 1)
    })
  }
  // "トントン": a hammer bounces over the gap while planks drop in.
  if (age < 1.0) {
    const swing = Math.abs(Math.sin(age * 15)) * 5
    const hx = Math.round(x + 10 - age * 18), hy = Math.round(y - 20 - swing)
    rect(ctx, '#8a6542', hx, hy, 2, 9)
    rect(ctx, '#4a4744', hx - 3, hy - 2, 8, 4)
    rect(ctx, '#8d8b85', hx - 2, hy - 2, 6, 1)
  }
  if (age > 1.0) burst(ctx, x, y - 2, (age - 1.0) / 0.6, 10, 26)
}

function drawDeliver(ctx: CanvasRenderingContext2D, effect: Effect, age: number) {
  const { from, to } = effect
  const flight = 0.5
  if (age < flight) {
    const k = age / flight
    const x = from.x + (to.x - from.x) * k
    const y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 26
    bigItem(ctx, effect, x, y, 1)
    if (Math.floor(age * 30) % 2 === 0) twinkle(ctx, Math.round(x - (to.x - from.x) * 0.08), Math.round(y + 6), 1)
    return
  }
  const k = (age - flight) / (EFFECT_SECONDS.deliver - flight)
  burst(ctx, to.x, to.y - 4, k * 1.6, 8, 18)
  // Hearts float up from the happy recipient.
  for (let i = 0; i < 7; i++) {
    const t = clamp01((age - flight - i * 0.08) / 0.9)
    if (t <= 0 || t >= 1) continue
    const hx = to.x + (i - 3) * 6 + Math.round(Math.sin(t * 7 + i) * 3)
    const hy = to.y - 6 - easeOut(t) * (26 + (i % 3) * 6)
    withAlpha(ctx, 1 - t * t, () => sprite(ctx, HEART, HEART_COLORS, Math.round(hx) - 2, Math.round(hy) - 2))
  }
}

const CONFETTI = ['#f39aa8', '#ffd479', '#9fd2c8', '#c7b6ef', '#f7b36b', '#b5dd8a']

function drawConfetti(ctx: CanvasRenderingContext2D, age: number) {
  const fade = clamp01((EFFECT_SECONDS.confetti - age) / 0.6)
  withAlpha(ctx, fade, () => {
    for (let i = 0; i < 96; i++) {
      const delay = hash(i) * 1.1
      const t = age - delay
      if (t < 0) continue
      const speed = 50 + hash(i + 100) * 55
      const x = Math.round(6 + hash(i + 200) * 308 + Math.sin(t * 3 + i) * 8)
      const y = Math.round(-8 + t * speed)
      if (y > 292) continue
      const flutter = Math.floor(t * 8 + i) % 3
      const color = CONFETTI[i % CONFETTI.length]
      if (flutter === 0) rect(ctx, color, x, y, 4, 2)
      else if (flutter === 1) rect(ctx, color, x + 1, y, 2, 3)
      else rect(ctx, color, x, y + 1, 3, 2)
    }
    // Big twinkles pop across the scene in turn.
    for (let i = 0; i < 10; i++) {
      const t = (age - i * 0.22) % 1.1
      if (t < 0 || t > 0.45) continue
      twinkle(ctx, Math.round(24 + hash(i + 300) * 272), Math.round(20 + hash(i + 400) * 240), t < 0.15 ? 2 : t < 0.3 ? 3 : 1)
    }
  })
}

/** Draws every running effect on top of the scene. Expired effects are ignored. */
export function drawEffects(ctx: CanvasRenderingContext2D, effects: readonly Effect[], now: number) {
  for (const effect of effects) {
    if (!isEffectActive(effect, now)) continue
    const age = effectAge(effect, now)
    if (effect.kind === 'get') drawGet(ctx, effect, age)
    else if (effect.kind === 'water') drawWater(ctx, effect, age)
    else if (effect.kind === 'repair') drawRepair(ctx, effect, age)
    else if (effect.kind === 'deliver') drawDeliver(ctx, effect, age)
    else drawConfetti(ctx, age)
  }
}
