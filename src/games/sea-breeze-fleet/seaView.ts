import { chartHeight, chartWidth, shoreDistance, type Point } from './charts'
import { noiseSeed, paintCoast } from './coast'
import { createShipyard, keel } from './sprites'
import type { Vessel, Voyage } from './voyage'
import { createWaterLight } from './waterLight'

type Pen = CanvasRenderingContext2D
const tau = Math.PI * 2
const round = Math.round

function ripple(c: Pen, x: number, y: number, width: number, depth: number, color: string) {
  c.fillStyle = color
  for (let i = 0; i < 38; i++) {
    const a = tau * i / 38
    c.fillRect(round(x + Math.cos(a) * width), round(y + Math.sin(a) * depth), Math.max(1, round(width / 7)), 1)
  }
}

function sparkle(c: Pen, x: number, y: number, r: number) {
  c.fillRect(round(x) - r, round(y), 2 * r + 1, 1)
  c.fillRect(round(x), round(y) - r, 1, 2 * r + 1)
}

function perspective(angle: number, sx: number, sy: number) {
  return Math.atan2(Math.sin(angle) * sy / 0.61, Math.cos(angle) * sx)
}

function parts(s: Vessel, w: number, h: number, demoTime: number) {
  const sx = w / chartWidth, sy = h / chartHeight
  const angle = perspective(s.heading + Math.sin(demoTime * 0.45) * 0.36, sx, sy)
  const scale = Math.min(sx * 1.20, sy) * ({ skipper: 1.49, flagship: 1.59, pirate: 1.04, mail: 0.89 }[s.kind])
  return { x: round(s.x * sx), y: round(s.y * sy), angle, scale }
}

export function selectPirateAt(v: Voyage, point: Point, w: number, h: number) {
  // Include the mast and bridge in touch targets, and keep small ships tappable.
  const px = point.x * w / chartWidth, py = point.y * h / chartHeight
  let nearest = -1, best = Infinity
  v.pirates.forEach((s, i) => {
    if (!s.hp) return
    const { x, y, scale, angle } = parts(s, w, h, 0)
    const rx = Math.max(15, (28 + 19 * Math.abs(Math.cos(angle))) * scale)
    const ry = Math.max(16, (28 + 8 * Math.abs(Math.sin(angle))) * scale)
    const d = ((x - px) / rx) ** 2 + ((y - 12 * scale - py) / ry) ** 2
    if (d <= 1 && d < best) { nearest = i; best = d }
  })
  return nearest
}

function waves(c: Pen, v: Voyage, w: number, h: number, time: number) {
  const sunset = v.chart.kind === 'flagship'
  for (let i = 0; i < 190; i++) {
    const phase = time * 0.63 + i
    const x = (noiseSeed(i + 933) * w + Math.sin(phase * 0.53) * 3)
    const y = noiseSeed(i + 144) * h
    if (shoreDistance(x * chartWidth / w, y * chartHeight / h, v.chart.islands) < 4) continue
    const glint = Math.sin(phase)
    c.fillStyle = glint > 0.91 ? (sunset ? '#e4cca1' : '#a8ddcc') : (sunset ? '#a4a5a0' : '#68b1b7')
    c.globalAlpha = glint > 0.91 ? 0.8 : 0.19 + 0.12 * glint
    c.fillRect(round(x), round(y), Math.max(1, round((2.5 + glint * 2) * w / 520)), 1)
    if (glint > 0.96 && i % 9 === 0) sparkle(c, x + 2, y, 2)
  }
  c.globalAlpha = 1
  if (sunset) {
    // Low evening light breaks into long ribbons on the far side of the strait.
    for (let i = 0; i < 85; i++) {
      const depth = noiseSeed(i + 38)
      const x = 496 - depth * 86 + (noiseSeed(i + 582) - 0.5) * (18 + depth * 116)
      const y = 6 + depth * 230
      if (shoreDistance(x, y, v.chart.islands) < 2) continue
      const shimmer = 0.5 + 0.5 * Math.sin(i * 3.7 + time * 1.2)
      c.globalAlpha = (1 - depth * 0.82) * (0.18 + shimmer * 0.45)
      c.fillStyle = i % 3 === 0 ? '#ffdf9c' : '#f8bc92'
      c.fillRect(round(x * w / chartWidth), round(y * h / chartHeight), Math.max(2, round((2 + 12 * shimmer) * w / chartWidth)), 1)
    }
    c.globalAlpha = 1
  }
}

function buoy(c: Pen, x: number, y: number, time: number, s: number) {
  c.save()
  c.translate(round(x), round(y + Math.sin(time * 2.3 + x) * s))
  c.scale(s, s)
  ripple(c, 1, 1, 7, 2, '#9bd1bd')
  c.fillStyle = '#314b56'; c.fillRect(-4, -3, 8, 3)
  c.fillStyle = '#d35f46'; c.fillRect(-4, -5, 7, 3); c.fillRect(-2, -10, 3, 6)
  c.fillStyle = '#ffe0ac'; c.fillRect(-3, -4, 5, 1); c.fillRect(-1, -11, 2, 2)
  c.restore()
}

function gulls(c: Pen, w: number, h: number, time: number) {
  for (let i = 0; i < 3; i++) {
    const x = ((w * 0.32 + time * 4 + i * 11) % (w + 40)) - 12
    const y = h * 0.185 + i % 2 * 7 + Math.sin(time * 0.4 + i) * 3
    const flap = Math.round(Math.sin(time * 3.2 + i))
    c.fillStyle = '#355e6e'; c.fillRect(round(x + 5), round(y + 9), 4, 1)
    c.fillStyle = '#f9f0d4'; c.fillRect(round(x), round(y), 2, 1)
    c.fillRect(round(x - 2), round(y - flap), 2, 1); c.fillRect(round(x + 2), round(y - flap), 2, 1)
  }
}

type Trail = Point & { age: number; heading: number; size: number; id: number }

export function createSeaView(canvas: HTMLCanvasElement) {
  const c = canvas.getContext('2d', { alpha: false })
  if (!c) return () => {}
  const sprite = createShipyard()
  let coast: HTMLCanvasElement | undefined
  let current: Voyage | undefined
  let surfaceLight: ReturnType<typeof createWaterLight> | undefined
  let wakes: Trail[] = []
  let trailTime = 0
  let lastTime = 0
  let trailId = 0

  function drawBoat(ctx: Pen, s: Vessel, v: Voyage, w: number, h: number, t: number) {
    const demo = v.phase === 'ready'
    const { x, y, scale, angle } = parts(s, w, h, demo ? t : 0)
    const selected = v.pirates[v.target] === s && !demo
    const own = s === v.player
    const bob = round(Math.sin(t * 2.3 + s.home.x) * 0.9 * scale)
    ctx.save()
    ctx.translate(x, y + bob)
    ctx.scale(scale, scale)

    // A dark, offset reflection anchors the stack at the waterline.
    ctx.save()
    ctx.scale(1, 0.61)
    ctx.rotate(angle)
    ctx.fillStyle = '#123e5075'
    ctx.beginPath(); ctx.ellipse(1, 5, 46, 14, 0, 0, tau); ctx.fill()
    ctx.strokeStyle = '#d1ead2'; ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.ellipse(0, 0, 45, 14.5, 0, -1, 1.25); ctx.stroke()
    if (demo || s.speed > 0.15) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 13; i++) {
          const f = (i / 13 + t * 0.5) % 1
          ctx.globalAlpha = 0.75 * (1 - f)
          ctx.fillStyle = '#c8f2e0'
          ctx.fillRect(round(-27 - f * 37), round(side * (11 + f * 6 + Math.sin(i * 4) * 2)), 3 + f * 3, 2)
        }
      }
    }
    ctx.restore()
    const body = sprite(s.kind, angle)
    if (s.flash > 0 && Math.floor(s.flash * 12) % 2 === 1) ctx.globalAlpha = 0.64
    ctx.drawImage(body, -keel.x, -keel.y)
    ctx.globalAlpha = 1
    const azimuth = perspective(s.aim, w / chartWidth, h / chartHeight)
    if (s.kind !== 'mail') {
      const gx = round(Math.cos(angle) * 24), gy = round(Math.sin(angle) * 24 * 0.61) - 9
      ctx.drawImage(sprite('nozzle', azimuth), gx - keel.x, gy - keel.y)
      if (s.muzzle > 0) {
        ctx.fillStyle = '#fff2b1'
        sparkle(ctx, gx + 15 * Math.cos(azimuth), gy - 5 + 9 * Math.sin(azimuth), 3)
      }
    }
    // Drifting steam issues from the aft funnel, including when moored.
    for (let i = 0; i < 6; i++) {
      const f = (i / 6 + t * 0.44) % 1
      const px = -Math.cos(angle) * 15 - 16 * f - 7 * f * f + Math.sin(i + t) * f * 2
      const py = -Math.sin(angle) * 15 * 0.61 - (s.kind === 'flagship' ? 37 : 32) - f * 16
      const rad = Math.max(1, round(1 + f * 3.5))
      ctx.globalAlpha = (1 - f) * 0.68
      ctx.fillStyle = f > 0.3 ? '#e7e7d5' : '#aab5af'
      ctx.fillRect(round(px) - rad, round(py) - rad + 1, rad * 2 + 1, rad * 2 - 1)
      ctx.fillRect(round(px) - rad + 1, round(py) - rad, rad * 2 - 1, rad * 2 + 1)
    }
    ctx.globalAlpha = 1
    if (s.kind === 'mail') {
      ctx.fillStyle = '#37535a'; ctx.fillRect(-8, -46, 17, 12)
      ctx.fillStyle = '#ffdea0'; ctx.fillRect(-7, -45, 15, 10)
      ctx.fillStyle = '#aa7154'
      for (let i = 0; i < 7; i++) {
        ctx.fillRect(-7 + i, -44 + Math.floor(i * 0.7), 2, 1)
        ctx.fillRect(6 - i, -44 + Math.floor(i * 0.7), 2, 1)
      }
    }
    if (!demo || own) {
      const bottom = Math.abs(Math.sin(angle)) * 17 + 16
      const col = s.kind === 'mail' ? '#ffdd87' : own ? '#a5ecd0' : '#ffc096'
      ctx.fillStyle = '#214953'; ctx.fillRect(-15, round(bottom), 30, 4)
      ctx.fillStyle = col; ctx.fillRect(-14, round(bottom) + 1, round(28 * s.hp / s.maxHp), 2)
      if (own || selected) {
        ctx.fillRect(-3, round(bottom) + 6, 7, 1)
        ctx.fillRect(-2, round(bottom) + 7, 5, 1); ctx.fillRect(-1, round(bottom) + 8, 3, 1)
      }
    }
    if (selected) {
      ctx.strokeStyle = '#ffe49e'; ctx.lineWidth = 2
      const rx = 31 + Math.abs(Math.cos(angle)) * 15
      const ry = 20 + Math.abs(Math.sin(angle)) * 14
      for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(dx * (rx - 6), -12 + dy * ry)
        ctx.lineTo(dx * rx, -12 + dy * ry)
        ctx.lineTo(dx * rx, -12 + dy * (ry - 5)); ctx.stroke()
      }
    }
    ctx.restore()
  }

  return (v: Voyage, time: number) => {
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const pixel = Math.max(1.15, Math.min(2.25, rect.width / 555))
    const w = Math.max(1, round(rect.width / pixel)), h = Math.max(1, round(rect.height / pixel))
    const resized = canvas.width !== w || canvas.height !== h
    if (resized) { canvas.width = w; canvas.height = h }
    if (!coast || current?.chart !== v.chart || resized) coast = paintCoast(v.chart, w, h)
    if (!surfaceLight || current !== v) surfaceLight = createWaterLight(v.chart)
    if (resized || current !== v) { wakes = []; trailTime = time }
    current = v
    const dt = Math.max(0, Math.min(0.1, time - lastTime))
    lastTime = time
    c.imageSmoothingEnabled = false
    c.drawImage(coast, 0, 0)
    c.imageSmoothingEnabled = true
    c.drawImage(surfaceLight(v, dt), 0, 0, w, h)
    c.imageSmoothingEnabled = false
    waves(c, v, w, h, time)
    const sx = w / chartWidth, sy = h / chartHeight, scale = Math.min(sx, sy)
    buoy(c, w * 0.255, h * 0.34, time, scale)
    buoy(c, w * 0.82, h * 0.76, time + 1, scale)
    if (v.mail) {
      const x = round(w * 0.91), y = round(h * 0.46)
      ripple(c, x, y, 10 * scale, 5 * scale, '#ffe0a2')
      c.fillStyle = '#ffefd2'; c.fillRect(x, y - 15 * scale, 2 * scale, 15 * scale)
      c.fillStyle = '#eeb95c'; c.fillRect(x + 2 * scale, y - 15 * scale, 8 * scale, 5 * scale)
    }
    const boats = [v.player, ...v.pirates, ...(v.mail ? [v.mail] : [])].filter(s => s.hp > 0)
    if (time - trailTime >= 0.14) {
      trailTime = time
      for (const s of boats) {
        if (s.speed < 0.2) continue
        const p = parts(s, w, h, 0)
        wakes.push({ x: p.x - Math.cos(p.angle) * 35 * p.scale, y: p.y - Math.sin(p.angle) * 21 * p.scale,
          age: 0, heading: p.angle, size: p.scale, id: ++trailId })
      }
    }
    wakes = wakes.filter(p => (p.age += dt) < 1.6)
    for (const p of wakes) {
      c.globalAlpha = (1 - p.age / 1.6) * 0.55
      c.fillStyle = '#c6e9d4'
      for (const side of [-1, 1]) {
        const spread = (4 + p.age * 8 + noiseSeed(p.id) * 4) * p.size * side
        c.fillRect(round(p.x - Math.sin(p.heading) * spread), round(p.y + Math.cos(p.heading) * spread * 0.61), 3, 1)
      }
    }
    c.globalAlpha = 1
    if (v.course) ripple(c, v.course.x * sx, v.course.y * sy, 7 * scale, 4 * scale, '#e7ead1')
    for (const shot of v.shots.filter(s => !s.friendly)) {
      const f = shot.age / shot.duration
      ripple(c, shot.end.x * sx, shot.end.y * sy, (19 - f * 9) * scale, (12 - f * 6) * scale,
        Math.floor(f * 8) % 2 ? '#ffe0a7' : '#f79f78')
    }
    boats.sort((a, b) => a.y - b.y)
    for (const s of boats) drawBoat(c, s, v, w, h, time)
    for (const shot of v.shots) {
      const f = shot.age / shot.duration
      const x = (shot.start.x + (shot.end.x - shot.start.x) * f) * sx
      const y = (shot.start.y + (shot.end.y - shot.start.y) * f) * sy
      const z = ((1 - f) * 12 + 4 * f * (1 - f) * (shot.friendly ? 23 : 33)) * scale
      c.fillStyle = '#18445788'; c.fillRect(round(x + 1), round(y), 5, 2)
      c.fillStyle = shot.friendly ? '#98e0df' : '#ee9671'
      const r = Math.max(2, round(3.3 * scale))
      c.fillRect(round(x - r), round(y - z - r + 1), 2 * r, 2 * r - 2)
      c.fillRect(round(x - r + 1), round(y - z - r), 2 * r - 2, 2 * r)
      c.fillStyle = '#ffefbf'; c.fillRect(round(x - r + 1), round(y - z - r + 1), r, 1)
    }
    for (const b of v.bursts) {
      const x = b.x * sx, y = b.y * sy, f = b.age / 1.15
      c.globalAlpha = 1 - f
      ripple(c, x, y, (6 + f * 28) * scale, (4 + f * 15) * scale, '#e2f2da')
      for (let i = 0; i < 17; i++) {
        const a = i * 2.4
        const spread = f * (12 + noiseSeed(i + 9) * 30) * scale
        const z = 4 * f * (1 - f) * (13 + i % 5 * 5) * scale
        c.fillStyle = b.type === 'stars' && i % 2 ? '#ffdb8a' : i % 3 ? '#e5f3df' : '#8dd9d6'
        const px = x + Math.cos(a) * spread, py = y + Math.sin(a) * spread * 0.6 - z
        if (b.type === 'stars' && i % 2) sparkle(c, px, py, 2)
        else c.fillRect(round(px), round(py), 2, Math.max(2, round((4 - f * 2) * scale)))
      }
    }
    c.globalAlpha = 1
    gulls(c, w, h, time)
  }
}
