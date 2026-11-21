import { BOOST_TIME, RECHARGE, rivals, type Race } from './race'

// Centerline in the painted circuit's native 1536 × 1024 coordinates.
// Control points follow the middle of the cobbles, inside the two kerbs.
const bends = [
  [1080, 739, 1285, 758, 1285, 572],
  [1285, 445, 1163, 449, 1061, 380],
  [954, 308, 1010, 182, 817, 169],
  [678, 160, 624, 211, 542, 258],
  [414, 331, 272, 233, 214, 358],
  [165, 463, 233, 511, 347, 559],
  [442, 599, 361, 739, 587, 739],
  [650, 739, 712, 739, 780, 739],
]
const line = [{ x: 780, y: 739, length: 0 }]
for (const [ax, ay, bx, by, cx, cy] of bends) {
  const start = line[line.length - 1]
  for (let step = 1; step <= 80; step++) {
    const t = step / 80, u = 1 - t
    const x = u ** 3 * start.x + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * cx
    const y = u ** 3 * start.y + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * cy
    const prev = line[line.length - 1]
    line.push({ x, y, length: prev.length + Math.hypot(x - prev.x, y - prev.y) })
  }
}
const total = line[line.length - 1].length

function pose(laps: number, lane: number) {
  const length = (laps % 1) * total
  let lo = 0, hi = line.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (line[mid].length <= length) lo = mid
    else hi = mid
  }
  const a = line[lo], b = line[hi]
  const t = (length - a.length) / (b.length - a.length)
  const angle = Math.atan2(b.y - a.y, b.x - a.x)
  return { angle, x: a.x + (b.x - a.x) * t - lane * Math.sin(angle),
    y: a.y + (b.y - a.y) * t + lane * Math.cos(angle) }
}

export function makeLoadingCircuit() {
  const map = document.createElement('canvas')
  map.width = 1536
  map.height = 1024
  const g = map.getContext('2d')!
  g.fillStyle = '#92a65f'
  g.fillRect(0, 0, map.width, map.height)
  g.beginPath()
  g.moveTo(line[0].x, line[0].y)
  for (const point of line) g.lineTo(point.x, point.y)
  g.closePath()
  g.lineWidth = 131
  g.strokeStyle = '#756d6a'
  g.stroke()
  return map
}

const carColors = ['#4478c8', '#d7713b', '#298267']
const carLengths = [76, 73, 70]
const spriteWidth = 144
const spriteHeight = 72

function drawCar(g: CanvasRenderingContext2D, sheet: HTMLImageElement | null,
  index: number, x: number, y: number, angle: number, boostFrame: number | null) {
  const length = carLengths[index]
  // The shadow lies on the stones. Its sun offset stays fixed as the car turns.
  g.fillStyle = '#29273555'
  g.beginPath()
  g.ellipse(x + 4, y + 6, length * 0.49, length * 0.22, angle, 0, Math.PI * 2)
  g.fill()
  g.save()
  g.translate(Math.round(x), Math.round(y))
  g.rotate(angle)
  if (boostFrame !== null) {
    const exhaust = -length * 0.46
    for (const offset of [-7, 7]) {
      const tail = 15 + (boostFrame + offset + 7) % 9
      g.fillStyle = '#e9843d'
      g.beginPath()
      g.moveTo(exhaust - tail, offset)
      g.lineTo(exhaust, offset - 4)
      g.lineTo(exhaust, offset + 4)
      g.fill()
      g.fillStyle = '#fff0a8'
      g.fillRect(exhaust - 9, offset - 1, 10, 3)
    }
  }
  if (sheet) {
    g.drawImage(sheet, 0, index * spriteHeight, spriteWidth, spriteHeight,
      -length / 2, -length / 4, length, length / 2)
  } else {
    g.fillStyle = carColors[index]
    g.fillRect(-length / 2, -15, length, 30)
    g.fillStyle = '#fff1d4'
    g.fillRect(-length / 2, -2, length, 4)
  }
  g.restore()
}

const reflections = [[641, 477], [715, 505], [790, 483], [685, 521], [804, 617], [857, 642]]

export function drawRace(g: CanvasRenderingContext2D, map: HTMLCanvasElement | HTMLImageElement,
  sheet: HTMLImageElement | null, race: Race) {
  const player = pose(race.distance, 0)
  const { width, height } = g.canvas
  const cameraX = Math.max(0, Math.min(map.width - width, Math.round(player.x - width / 2 + 36 * Math.cos(player.angle))))
  const cameraY = Math.max(0, Math.min(map.height - height, Math.round(player.y - height / 2 + 25 * Math.sin(player.angle))))
  g.drawImage(map, cameraX, cameraY, width, height, 0, 0, width, height)
  reflections.forEach(([x, y], i) => {
    const ripple = Math.sin(race.elapsed * 2.6 + i * 2)
    if (ripple <= 0) return
    g.fillStyle = `rgba(225,255,238,${ripple * 0.75})`
    g.fillRect(x - cameraX - Math.round(ripple), y - cameraY, 1 + Math.round(6 * ripple), 1)
  })
  const [orange, green] = rivals(race.elapsed)
  const cars = [player, pose(orange, -34), pose(green, 34)]
  cars.forEach((p, index) => drawCar(g, sheet, index, p.x - cameraX, p.y - cameraY, p.angle,
    index === 0 && race.cooldown > RECHARGE - BOOST_TIME ? Math.floor(race.elapsed * 24) : null))
}
