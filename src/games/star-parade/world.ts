import { formation } from './formation'
import { flightSeconds, GOAL_COUNT, METERS_PER_STAR } from './progression'
import type { GateRow } from './course'
import { meteorX } from './game'

export type WorldFrame = {
  distance: number
  playerX: number
  jump: number
  count: number
  gates: readonly GateRow[]
  finish: number
  phase: 'ready' | 'running' | 'launching' | 'finished'
  time: number
  celebration: number
}

type Brush = CanvasRenderingContext2D
type Point = readonly [number, number]
type Paint = string | CanvasGradient

const circle = Math.PI * 2

function polygon(ctx: Brush, points: readonly Point[], color: Paint) {
  ctx.beginPath()
  points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

function oval(ctx: Brush, x: number, y: number, rx: number, ry: number, color: Paint) {
  ctx.beginPath()
  ctx.ellipse(x, y, rx, ry, 0, 0, circle)
  ctx.fillStyle = color
  ctx.fill()
}

function sparkle(ctx: Brush, x: number, y: number, size: number, color: string) {
  ctx.beginPath()
  ctx.moveTo(x, y - size)
  ctx.quadraticCurveTo(x + size * 0.1, y - size * 0.12, x + size * 0.76, y)
  ctx.quadraticCurveTo(x + size * 0.1, y + size * 0.1, x, y + size)
  ctx.quadraticCurveTo(x - size * 0.1, y + size * 0.12, x - size * 0.76, y)
  ctx.quadraticCurveTo(x - size * 0.1, y - size * 0.12, x, y - size)
  ctx.fillStyle = color
  ctx.fill()
}

function planet(ctx: Brush, x: number, y: number, r: number) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(-0.28)
  ctx.scale(r, r)
  function ring(start: number, end: number, width: number, color: string, radius: number) {
    ctx.beginPath()
    ctx.ellipse(0, 0.08, radius, 0.32 * radius, 0, start, end)
    ctx.lineWidth = width
    ctx.strokeStyle = color
    ctx.stroke()
  }
  ring(Math.PI, circle, 0.175, '#ae81b6', 1.65)
  ctx.save()
  ctx.beginPath()
  ctx.arc(0, 0, 1, 0, circle)
  ctx.clip()
  const surface = ctx.createLinearGradient(-0.4, -1, 0.45, 1)
  surface.addColorStop(0, '#fff0bf')
  surface.addColorStop(0.45, '#ffb390')
  surface.addColorStop(1, '#d37aa1')
  ctx.fillStyle = surface
  ctx.fillRect(-1, -1, 2, 2)
  for (const [offset, thickness, color] of [
    [-0.62, 0.09, '#f8a997'], [-0.46, 0.04, '#ffe1b6'], [-0.17, 0.15, '#f99e92'],
    [0.02, 0.045, '#ffcea6'], [0.48, 0.18, '#bd77a4'], [0.79, 0.045, '#fbaa9f'],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(-1.5, offset - 0.15)
    ctx.bezierCurveTo(-0.7, offset + 0.16, 0.6, offset + 0.16, 1.5, offset - 0.15)
    ctx.lineWidth = thickness
    ctx.strokeStyle = color
    ctx.stroke()
  }
  ctx.restore()
  ring(0, Math.PI, 0.175, '#eab3c3', 1.65)
  ring(0, Math.PI, 0.052, '#ffe0ac', 1.71)
  ring(0, Math.PI, 0.023, '#fff0ce', 1.49)
  ctx.restore()
}

// Each crystal and its island are painted in local coordinates, with a light-facing facet.
function island(ctx: Brush, x: number, y: number, size: number, flip: boolean) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(flip ? -size : size, size)
  polygon(ctx, [[-1, 0], [-0.75, -0.12], [0.4, -0.15], [1, 0], [0.58, 0.12], [-0.55, 0.12]], '#7964a7')
  polygon(ctx, [[-1, 0], [-0.55, 0.12], [0.1, 0.11], [-0.22, 0.72], [-0.64, 0.49]], '#463b76')
  polygon(ctx, [[0.1, 0.11], [0.58, 0.12], [1, 0], [0.62, 0.45], [-0.22, 0.72]], '#322f61')
  polygon(ctx, [[0.1, 0.11], [0.35, 0.12], [-0.22, 0.72]], '#51477f')
  for (const [cx, height, tilt] of [[-0.27, 0.39, -0.1], [-0.02, 0.75, 0.07], [0.19, 0.36, 0.12]]) {
    const tip = cx + tilt
    polygon(ctx, [[cx - 0.105, -0.09], [tip - 0.06, -height * 0.75], [tip + 0.025, -height],
      [tip + 0.1, -height * 0.69], [cx + 0.12, -0.075]], '#b498e7')
    polygon(ctx, [[cx - 0.105, -0.09], [tip - 0.06, -height * 0.75], [tip + 0.025, -height], [cx, -0.08]], '#edbcf0')
  }
  ctx.restore()
}

function fraction(seed: number) {
  const value = Math.sin(seed * 78.233 + 9.17) * 43758.5453
  return value - Math.floor(value)
}

function scenery(ctx: Brush, w: number, h: number) {
  const unit = Math.min(w, h)
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#111533')
  sky.addColorStop(0.18, '#343061')
  sky.addColorStop(0.34, '#905b8f')
  sky.addColorStop(0.42, '#f2ad9f')
  sky.addColorStop(0.53, '#a779ac')
  sky.addColorStop(1, '#191b3b')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  const glow = ctx.createRadialGradient(w * 0.51, h * 0.4, 0, w * 0.51, h * 0.4, w * 0.43)
  glow.addColorStop(0, '#ffc98e88')
  glow.addColorStop(0.55, '#fea19b22')
  glow.addColorStop(1, '#f69ba500')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < Math.min(230, w * 0.24); i++) {
    const x = fraction(i + 1) * w
    const y = fraction(i + 255) * h * 0.39
    const opacity = fraction(i + 555) * 0.64 + 0.18
    const radius = 0.4 + fraction(i + 800) * Math.min(1.1, unit * 0.002)
    const color = `rgba(255,236,218,${opacity})`
    if (i % 13 === 3) sparkle(ctx, x, y, radius * 4.3, color)
    else oval(ctx, x, y, radius, radius, color)
  }
  // A faint hand-drawn constellation sits opposite the warm planet.
  const constellation: Point[] = [[0.068, 0.235], [0.115, 0.205], [0.15, 0.235], [0.17, 0.166], [0.217, 0.178]]
  ctx.beginPath()
  constellation.forEach(([x, y], i) => i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h))
  ctx.strokeStyle = '#e5d5fe46'
  ctx.lineWidth = 1
  ctx.stroke()
  constellation.forEach(([x, y], i) => sparkle(ctx, x * w, y * h, i === 3 ? 5 : 3.1, '#e9deee'))
  planet(ctx, w * 0.787, h * 0.22, unit * 0.076)
  for (const [px, py, length] of [[0.31, 0.21, 0.046], [0.915, 0.33, 0.025]]) {
    const x = w * px, y = h * py, tail = unit * length
    const streak = ctx.createLinearGradient(x, y, x + tail, y - tail * 0.49)
    streak.addColorStop(0, '#fff1cebb')
    streak.addColorStop(1, '#ffdfc800')
    polygon(ctx, [[x, y - 0.65], [x + tail, y - tail * 0.49], [x, y + 0.65]], streak)
    sparkle(ctx, x, y, 2, '#ffe4c9')
  }
  for (const [base, amplitude, top, bottom, seed] of [
    [0.433, 0.088, '#9f7aaa', '#ad80a8', 12],
    [0.489, 0.107, '#805f94', '#7b5d94', 48],
    [0.577, 0.145, '#514775', '#5c4c7e', 79],
    [0.72, 0.205, '#37345c', '#202543', 104],
  ] as const) {
    const points: Point[] = []
    const peaks = Math.ceil(w / (unit * 0.1)) + 5
    for (let i = 0; i <= peaks; i++) {
      const x = i / peaks
      const valley = 0.15 + 0.85 * Math.min(1, Math.abs(x - 0.5) * 3.9)
      points.push([w * x, h * (base - valley * amplitude * (0.19 + fraction(i + seed) * 0.81))])
    }
    const face = ctx.createLinearGradient(0, h * (base - amplitude), 0, h)
    face.addColorStop(0, top)
    face.addColorStop(1, bottom)
    polygon(ctx, [...points, [w, h], [0, h]], face)
    for (let i = 1; i < peaks; i++) {
      if (points[i][1] < points[i - 1][1] && points[i][1] < points[i + 1][1]) {
        const [x, y] = points[i]
        polygon(ctx, [points[i], points[i + 1], [x + w * 0.008, y + amplitude * h * 0.95]], '#302b5c24')
      }
    }
  }
  island(ctx, w * 0.105, h * 0.55, unit * 0.076, false)
  island(ctx, w * 0.905, h * 0.46, unit * 0.045, true)
  island(ctx, w * 0.947, h * 0.694, unit * 0.086, true)
}

// The sky, planet and terrain are stationary, so rasterize them once per canvas size.
const skies = new WeakMap<Brush, { canvas: HTMLCanvasElement; w: number; h: number; ratio: number }>()

function paintSky(ctx: Brush, w: number, h: number) {
  const ratio = ctx.getTransform().a
  let cached = skies.get(ctx)
  if (!cached || cached.w !== w || cached.h !== h || cached.ratio !== ratio) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(w * ratio))
    canvas.height = Math.max(1, Math.round(h * ratio))
    const brush = canvas.getContext('2d')
    if (!brush) return scenery(ctx, w, h)
    brush.scale(ratio, ratio)
    scenery(brush, w, h)
    cached = { canvas, w, h, ratio }
    skies.set(ctx, cached)
  }
  ctx.drawImage(cached.canvas, 0, 0, w, h)
}

type Road = { cx: number; horizon: number; depth: number; width: number; height: number }

export function trackHalfWidth(width: number, height: number) {
  return Math.min(width * 0.5, height * 0.88)
}

function perspective(z: number) {
  return 1 / (1 + 0.52 * z + 0.23 * z * Math.abs(z))
}

function roadPoint(road: Road, lane: number, scale: number): Point {
  return [road.cx + lane * road.width * scale, road.horizon + road.depth * scale]
}

function strip(ctx: Brush, road: Road, left: number, right: number, near: number, far: number, paint: Paint) {
  polygon(ctx, [roadPoint(road, left, far), roadPoint(road, right, far),
    roadPoint(road, right, near), roadPoint(road, left, near)], paint)
}

function track(ctx: Brush, road: Road, distance: number) {
  const near = (road.height - road.horizon) / road.depth + 0.1
  const surface = ctx.createLinearGradient(0, road.horizon, 0, road.height)
  surface.addColorStop(0, '#d59bcb')
  surface.addColorStop(0.22, '#aa7ea9')
  surface.addColorStop(0.57, '#8d66a0')
  surface.addColorStop(1, '#5d477e')
  strip(ctx, road, -1.2, 1.2, near, 0, surface)
  strip(ctx, road, -1 / 3, 1 / 3, near, 0, '#ffdfdb10')
  for (const divider of [-1 / 3, 1 / 3]) {
    strip(ctx, road, divider - 0.006, divider + 0.005, near, 0, '#50406e9c')
    strip(ctx, road, divider + 0.005, divider + 0.009, near, 0, '#f3c0da73')
  }
  const first = Math.floor(distance / 0.26) - 3
  for (let row = first + 29; row >= first; row--) {
    const z = row * 0.26 - distance
    if (z < -0.58) continue
    const scale = perspective(z)
    strip(ctx, road, -1, 1, scale, perspective(z + 0.008), '#49376580')
    strip(ctx, road, -1, 1, perspective(z - 0.003), scale, '#ead1ed60')
    for (const divider of [-1 / 3, 1 / 3]) {
      strip(ctx, road, divider - 0.005, divider + 0.005, perspective(z + 0.048), perspective(z + 0.182), '#f8d8e4aa')
    }
  }
  for (const sign of [-1, 1]) {
    for (const [inside, outside, paint] of [
      [0.905, 0.927, '#e7add1'], [0.927, 0.961, '#6d547e'], [0.961, 1.01, '#ffd1c3'],
      [1.01, 1.042, '#d597b0'], [1.042, 1.078, '#795582'], [1.078, 1.09, '#bc8abb'],
      [1.09, 1.13, '#413958'], [1.13, 1.139, '#a27698'], [1.139, 1.155, '#37314f'],
    ] as const) {
      strip(ctx, road, sign * (inside + 0.086), sign * (outside + 0.086), near, 0, paint)
    }
    for (let row = first + 29; row >= first; row--) {
      const z = row * 0.26 - distance + 0.06
      if (z < -0.58) continue
      strip(ctx, road, sign * 1.051, sign * 1.118, perspective(z), perspective(z + 0.016), '#9d768b')
      if (row % 2 === 0) {
        strip(ctx, road, sign * 1.14, sign * 1.158, perspective(z + 0.035), perspective(z + 0.14), '#ffe0bc')
      }
    }
  }
}

const mint = { light: '#d0fff0', top: '#a8f7de', main: '#65dfcb', shadow: '#299f9d', rim: '#30596a', pane: '90,231,203' }
const lime = { light: '#ffffd5', top: '#e2ffa4', main: '#c5eb72', shadow: '#7caa53', rim: '#4c693f', pane: '188,228,107' }
const coral = { light: '#fff0d8', top: '#ffc4a4', main: '#ff997f', shadow: '#cd6c73', rim: '#834e70', pane: '255,154,137' }

function gate(ctx: Brush, road: Road, scale: number, lane: number, label: string, opacity: number) {
  const [x, y] = roadPoint(road, lane, scale)
  const width = road.width * 0.608 * scale
  const height = Math.min(road.height * 0.245, road.width * 0.53) * scale
  const tone = label.startsWith('×') ? lime : label.startsWith('+') ? mint : coral
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.translate(x, y)
  const left = -width / 2, right = width / 2
  const post = Math.max(1, width * 0.045)
  const bevel = Math.min(height, width) * 0.1
  // A transparent light curtain leaves the lane visible through each arched gate.
  const pane = ctx.createLinearGradient(0, -height, 0, 0)
  pane.addColorStop(0, `rgba(${tone.pane},.89)`)
  pane.addColorStop(0.65, `rgba(${tone.pane},.63)`)
  pane.addColorStop(1, `rgba(${tone.pane},.28)`)
  oval(ctx, 0, height * 0.015, width * 0.54, height * 0.073, '#3628493f')
  polygon(ctx, [[left, 0], [left, -height + bevel], [left + bevel, -height],
    [right - bevel, -height], [right, -height + bevel], [right, 0]], pane)
  for (const offset of [0.12, 0.18]) {
    polygon(ctx, [[left + width * offset, -height + post], [left + width * (offset + 0.03), -height + post],
      [left + post, -height * (1 - offset * 2.6)], [left + post, -height * (1.09 - offset * 2.6)]], '#ffffff2a')
  }
  polygon(ctx, [[left - post * 0.4, 0], [left - post * 0.4, -height + bevel], [left + bevel, -height - post * 0.42],
    [right - bevel, -height - post * 0.42], [right + post * 0.65, -height + bevel],
    [right + post * 0.65, 0], [right - post * 0.3, 0], [right - post * 0.3, -height + bevel * 1.5],
    [right - bevel * 1.3, -height + post], [left + bevel * 1.3, -height + post],
    [left + post * 0.58, -height + bevel * 1.5], [left + post * 0.58, 0]], tone.rim)
  ctx.beginPath()
  ctx.moveTo(left, -post * 0.7)
  ctx.lineTo(left, -height + bevel)
  ctx.lineTo(left + bevel, -height)
  ctx.lineTo(right - bevel, -height)
  ctx.lineTo(right, -height + bevel)
  ctx.lineTo(right, -post * 0.7)
  ctx.lineWidth = post * 0.72
  ctx.strokeStyle = tone.top
  ctx.stroke()
  ctx.fillStyle = tone.light
  ctx.fillRect(left + bevel, -height - post * 0.29, width - 2 * bevel, post * 0.24)
  for (const position of [left, right]) {
    ctx.fillStyle = tone.shadow
    ctx.fillRect(position - post * 0.9, -post * 1.15, post * 1.85, post * 1.5)
    ctx.fillStyle = tone.top
    ctx.fillRect(position - post, -post * 1.15, post * 2.05, post * 0.48)
  }
  ctx.fillStyle = tone.main
  ctx.fillRect(left + post, -post * 0.32, width - post * 2, post * 0.38)
  const font = Math.min(height * 0.65, width * 0.42)
  ctx.font = `900 ${font}px "Arial Rounded MT Bold", "Arial", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(1, font * 0.085)
  ctx.strokeStyle = tone.rim
  ctx.strokeText(label, 0, -height * 0.5, width * 0.87)
  ctx.fillStyle = '#fff9e7'
  ctx.fillText(label, 0, -height * 0.5, width * 0.87)
  ctx.restore()
}

function clearLane(ctx: Brush, road: Road, scale: number, lane: number, opacity: number) {
  const [x, y] = roadPoint(road, lane, scale)
  const wide = road.width * 0.115 * scale
  const high = road.depth * 0.033 * scale
  ctx.save()
  ctx.globalAlpha = opacity * 0.66
  polygon(ctx, [[x - wide, y], [x, y - high], [x + wide, y], [x + wide, y + high * 0.55],
    [x, y - high * 0.45], [x - wide, y + high * 0.55]], '#f9e2e6')
  ctx.restore()
}

function landingZone(ctx: Brush, road: Road, scale: number, lane: number, opacity: number) {
  // The brackets mark the entire affected lane even while the rock slides toward it.
  ctx.save()
  ctx.globalAlpha = opacity
  const near = scale * 1.028, far = scale * 0.967
  strip(ctx, road, lane - 0.32, lane + 0.32, near, far, '#ff995244')
  for (const sign of [-1, 1]) {
    strip(ctx, road, lane + sign * 0.31, lane + sign * 0.32, near, far, '#ffcc98')
    strip(ctx, road, lane + sign * 0.19, lane + sign * 0.32, near, near - scale * 0.01, '#ffcc98')
  }
  ctx.restore()
}

function meteor(ctx: Brush, road: Road, scale: number, lane: number, direction: number, time: number, opacity: number) {
  const [x, y] = roadPoint(road, lane, scale)
  const radius = Math.min(road.height * 0.051, road.width * 0.131) * scale
  ctx.save()
  ctx.globalAlpha = opacity
  oval(ctx, x, y, radius * 1.29, radius * 0.22, '#562e53aa')
  oval(ctx, x, y, radius * 1.13, radius * 0.15, '#ff99535c')
  ctx.translate(x, y - radius * 0.83)
  ctx.scale(direction < 0 ? radius : -radius, radius)
  // The tail trails its sideways travel; the craters remain legible as it approaches.
  const flicker = Math.sin(time * 10) * 0.07
  ctx.beginPath()
  ctx.moveTo(-0.69, -0.21)
  ctx.bezierCurveTo(-0.6, -0.96, 0.11, -1.04, 0.43, -1.62 - flicker)
  ctx.quadraticCurveTo(0.48, -1.33, 0.4, -1.02)
  ctx.quadraticCurveTo(1.16, -1.36, 1.48 + flicker, -2.13)
  ctx.quadraticCurveTo(1.64, -1.41, 1.21, -0.91)
  ctx.lineTo(1.74, -1.1 - flicker)
  ctx.quadraticCurveTo(1.62, -0.35, 0.66, 0.48)
  ctx.closePath()
  ctx.fillStyle = '#ff994f'
  ctx.fill()
  polygon(ctx, [[0.09, -0.69], [0.69, -1.14], [0.48, -0.73], [1.24, -1.36], [1.03, -0.53], [0.45, 0.12]], '#ffe397')
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.85 + i / 3) % 1
    const size = 0.085 * (1 - t) + 0.018
    oval(ctx, 0.46 + i * 0.37 + t * 0.6, -1.06 - t * 1.35, size, size * 1.3, '#ffd593')
  }
  ctx.rotate(Math.sin(time * 4) * 0.075)
  const rock = ctx.createLinearGradient(-0.5, -0.85, 0.5, 0.85)
  rock.addColorStop(0, '#978398')
  rock.addColorStop(0.48, '#77637b')
  rock.addColorStop(1, '#4d455f')
  polygon(ctx, [[-0.95, -0.29], [-0.54, -0.78], [0.17, -0.89], [0.77, -0.59],
    [1.04, 0.02], [0.78, 0.59], [0.22, 0.84], [-0.43, 0.75], [-0.99, 0.29]], '#ffb36c')
  polygon(ctx, [[-0.9, -0.24], [-0.51, -0.73], [0.13, -0.79], [0.73, -0.53],
    [0.96, 0.04], [0.7, 0.55], [0.18, 0.75], [-0.42, 0.66], [-0.92, 0.24]], rock)
  for (const [cx, cy, rx, ry] of [[-0.4, -0.34, 0.23, 0.154], [0.42, -0.19, 0.19, 0.22], [-0.13, 0.34, 0.16, 0.12]]) {
    oval(ctx, cx, cy + 0.035, rx, ry, '#b39bae')
    oval(ctx, cx, cy - 0.014, rx, ry * 0.93, '#554b67')
    oval(ctx, cx - 0.025, cy + ry * 0.38, rx * 0.67, ry * 0.43, '#726077')
  }
  ctx.restore()
}

function finishLine(ctx: Brush, road: Road, scale: number) {
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 2; j++) {
      const lane = -0.91 + i * 1.82 / 12
      strip(ctx, road, lane, lane + 1.82 / 12, scale * (1 - j * 0.024), scale * (0.976 - j * 0.024),
        (i + j) % 2 ? '#5c4675' : '#fff3d2')
    }
  }
}

const starPoints: Point[] = Array.from({ length: 10 }, (_, i) => {
  const angle = -Math.PI / 2 + i * Math.PI / 5
  const radius = i % 2 ? 0.57 : 1
  return [Math.cos(angle) * radius, Math.sin(angle) * radius]
})

function starShape(ctx: Brush) {
  ctx.beginPath()
  starPoints.forEach(([x, y], i) => {
    const [px, py] = starPoints[(i + 9) % 10]
    const [nx, ny] = starPoints[(i + 1) % 10]
    const sx = x * 0.77 + px * 0.23, sy = y * 0.77 + py * 0.23
    if (i === 0) ctx.moveTo(sx, sy)
    else ctx.lineTo(sx, sy)
    ctx.quadraticCurveTo(x, y, x * 0.77 + nx * 0.23, y * 0.77 + ny * 0.23)
  })
  ctx.closePath()
}

function paintStarFace(ctx: Brush) {
  ctx.save()
  ctx.translate(0.04, 0.075)
  starShape(ctx)
  ctx.lineWidth = 0.063
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#ae6850'
  ctx.stroke()
  ctx.fillStyle = '#d88a42'
  ctx.fill()
  ctx.restore()
  starShape(ctx)
  const gold = ctx.createLinearGradient(-0.4, -0.8, 0.55, 0.8)
  gold.addColorStop(0, '#fff5a3')
  gold.addColorStop(0.36, '#ffe475')
  gold.addColorStop(0.72, '#ffc34d')
  gold.addColorStop(1, '#f7a13c')
  ctx.fillStyle = gold
  ctx.fill()
  ctx.strokeStyle = '#ffed9d'
  ctx.lineWidth = 0.039
  ctx.stroke()
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-0.71, -0.255)
  ctx.lineTo(-0.34, -0.32)
  ctx.quadraticCurveTo(-0.28, -0.34, -0.24, -0.43)
  ctx.strokeStyle = '#fff9ce'
  ctx.lineWidth = 0.055
  ctx.stroke()
  for (const side of [-1, 1]) {
    oval(ctx, side * 0.22, 0.02, 0.062, 0.105, '#4f3949')
    oval(ctx, side * 0.22 - 0.014, -0.022, 0.019, 0.027, '#fff6ce')
    oval(ctx, side * 0.36, 0.17, 0.093, 0.046, '#f79d75')
  }
  ctx.beginPath()
  ctx.moveTo(-0.083, 0.2)
  ctx.quadraticCurveTo(0, 0.295, 0.088, 0.193)
  ctx.strokeStyle = '#73474a'
  ctx.lineWidth = 0.045
  ctx.stroke()
}

// All runners share the same face; only their pose and feet change every frame.
let face: HTMLCanvasElement | undefined

function starBuddy(ctx: Brush, x: number, floor: number, radius: number, step: number, lift: number) {
  if (!face) {
    const sprite = document.createElement('canvas')
    sprite.width = sprite.height = 256
    const brush = sprite.getContext('2d')
    if (brush) {
      brush.translate(128, 128)
      brush.scale(122, 122)
      paintStarFace(brush)
      face = sprite
    }
  }
  const shadowScale = Math.max(0.48, 1 - lift / (radius * 5))
  oval(ctx, x, floor, radius * 0.81 * shadowScale, radius * 0.19 * shadowScale, '#49345670')
  ctx.save()
  ctx.translate(x, floor - lift - radius * (0.89 + Math.abs(Math.sin(step)) * 0.082))
  ctx.rotate(Math.sin(step) * 0.047)
  ctx.scale(radius, radius)
  for (const side of [-1, 1]) {
    const footY = 0.73 + side * Math.sin(step) * 0.1
    oval(ctx, side * 0.33, footY, 0.21, 0.12, '#a9574e')
    oval(ctx, side * 0.33, footY - 0.035, 0.205, 0.1, '#f4a34f')
  }
  if (face) ctx.drawImage(face, -128 / 122, -128 / 122, 256 / 122, 256 / 122)
  else paintStarFace(ctx)
  ctx.restore()
}

function squad(ctx: Brush, road: Road, frame: WorldFrame) {
  const stars = formation(frame.count, frame.playerX)
  const [x, ground] = roadPoint(road, frame.playerX, 1)
  const unit = Math.min(road.width, road.height * 0.72)
  const playerScale = stars[0].radius * unit
  const lift = frame.jump * Math.min(road.height * 0.235, road.width * 0.60)
  const beat = frame.time * (frame.phase === 'running' ? 8.5 : 2.5)
  for (let i = stars.length - 1; i >= 0; i--) {
    const star = stars[i]
    starBuddy(ctx, road.cx + road.width * star.x, ground - star.depth * playerScale,
      star.radius * unit, beat + i, lift)
  }
  for (let i = 0; i < 4; i++) {
    const t = (frame.time * 0.55 + i * 0.27) % 1
    const dx = (i % 2 ? -1 : 1) * (0.82 + i * 0.24)
    sparkle(ctx, x + dx * playerScale, ground - lift - playerScale * (0.3 + t * 1.12),
      playerScale * 0.115 * Math.sin(t * Math.PI), '#fff0ac')
  }
}

function ascent(ctx: Brush, w: number, h: number, frame: WorldFrame, road: Road) {
  const t = Math.min(1, frame.celebration / flightSeconds(frame.count))
  const rise = t * (2 - t)
  const meters = frame.count * METERS_PER_STAR * rise
  const travel = meters / 160
  const sky = ctx.createLinearGradient(0, 0, 0, h)
  sky.addColorStop(0, '#101034')
  sky.addColorStop(0.55, '#39295e')
  sky.addColorStop(1, '#946899')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)
  for (let i = 0; i < 76; i++) {
    const depth = 0.15 + fraction(i + 113) * 0.7
    sparkle(ctx, fraction(i + 9) * w, ((fraction(i + 88) + travel * depth) % 1) * h,
      0.8 + depth * 2, '#f7dfc4')
  }
  // Let the runway fall away as the camera follows the same stars into orbit.
  const takeoff = Math.min(1, t * 3)
  const launchEase = takeoff * (2 - takeoff)
  if (takeoff < 1) {
    ctx.save()
    ctx.globalAlpha = 1 - takeoff
    ctx.translate(0, h * takeoff)
    paintSky(ctx, w, h)
    track(ctx, road, frame.distance)
    finishLine(ctx, road, 1)
    ctx.restore()
  }
  const leadY = h * (0.79 - 0.27 * launchEase - 0.22 * Math.min(1, meters / (GOAL_COUNT * METERS_PER_STAR)))
  const moonY = leadY + (meters - GOAL_COUNT * METERS_PER_STAR) * h / 190
  const moonR = Math.min(w, h) * 0.09
  oval(ctx, w * 0.76, moonY, moonR, moonR, '#ffdf96')
  oval(ctx, w * 0.76 - moonR * 0.3, moonY + moonR * 0.22, moonR * 0.2, moonR * 0.18, '#eabc7f')
  const size = Math.min(w, h)
  const launchFormation = formation(frame.count, frame.playerX)
  for (let i = frame.count - 1; i >= 0; i--) {
    const depth = Math.sqrt(i / frame.count)
    const radius = size * (i === 0 ? 0.066 : 0.032 - depth * 0.013)
    const star = launchFormation[i]
    const y = leadY + depth * h * 0.33 * launchEase - size * 0.06 * star.depth * (1 - launchEase)
    const x = road.cx + star.x * road.width * (1 - launchEase)
      + w * depth * 0.32 * Math.sin(i * 2.4 + t * 5) * launchEase
    const tail = radius * (2 + rise * 2)
    const glow = ctx.createLinearGradient(x, y, x, y + tail)
    glow.addColorStop(0, '#ffe694bb')
    glow.addColorStop(1, '#ffaec900')
    polygon(ctx, [[x - radius * 0.6, y], [x + radius * 0.6, y], [x, y + tail]], glow)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(radius, radius)
    if (face) ctx.drawImage(face, -1, -1, 2, 2)
    else paintStarFace(ctx)
    ctx.restore()
  }
  ctx.textAlign = 'center'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillStyle = '#fff3c7'
  ctx.fillText(Math.floor(meters) + ' m', w / 2, leadY - size * 0.09)
}

export function drawWorld(ctx: Brush, width: number, height: number, frame: WorldFrame): void {
  if (width <= 0 || height <= 0) return
  const road: Road = {
    cx: width * 0.5, horizon: height * 0.365, depth: height * 0.442,
    width: trackHalfWidth(width, height), height,
  }
  ctx.save()
  if (frame.phase === 'launching' || frame.phase === 'finished') {
    ascent(ctx, width, height, frame, road)
    ctx.restore()
    return
  }
  paintSky(ctx, width, height)
  track(ctx, road, frame.distance)
  finishLine(ctx, road, perspective(frame.finish - frame.distance))
  for (let i = frame.gates.length - 1; i >= 0; i--) {
    const row = frame.gates[i]
    const z = row.distance - frame.distance
    if (z < -0.36 || z > 4) continue
    const scale = perspective(z)
    const opacity = Math.max(0.18, Math.min(1, 1.6 - z * 0.49)) * Math.min(1, 1 + z / 0.36)
    if (row.meteor) landingZone(ctx, road, scale, row.meteor.to * 2 / 3, opacity)
    if (z >= 0) row.lanes.forEach((label, index) => {
      const lane = (index - 1) * 2 / 3
      if (label) gate(ctx, road, scale, lane, label, opacity)
      else if (row.meteor?.to !== index - 1) clearLane(ctx, road, scale, lane, opacity)
    })
    if (row.meteor) {
      meteor(ctx, road, scale, meteorX(row, frame.distance), row.meteor.to - row.meteor.from, frame.time, opacity)
    }
  }
  squad(ctx, road, frame)
  ctx.restore()
}
