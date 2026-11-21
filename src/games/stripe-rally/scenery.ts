import { BOOST_TIME, RECHARGE, rivals, type Race } from './race'

// Cubic segments join tangent-to-tangent at the start line, bends and chicane.
const bends = [
  [615, 455, 713, 440, 712, 337], [711, 256, 623, 265, 582, 235],
  [520, 189, 558, 117, 467, 102], [393, 90, 357, 114, 303, 150],
  [238, 194, 135, 139, 118, 221], [95, 328, 223, 300, 246, 367],
  [269, 434, 296, 455, 425, 455],
]
const line = [{ x: 425, y: 455, length: 0 }]
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

export function makeCircuit() {
  const map = document.createElement('canvas')
  map.width = 844
  map.height = 566
  const g = map.getContext('2d')
  if (!g) return map
  g.fillStyle = '#85b958'
  g.fillRect(0, 0, map.width, map.height)
  let seed = 17
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32)
  for (let i = 0; i < 16000; i++) {
    g.fillStyle = i % 3 ? '#79ad50' : '#9bc96a'
    g.fillRect(Math.floor(random() * map.width), Math.floor(random() * map.height), 2, 2)
  }
  // Trees have a stepped silhouette so they stay legible at the game's native resolution.
  for (let i = 0; i < 200; i++) {
    const x = Math.floor(random() * map.width), y = Math.floor(random() * map.height)
    if (line.some(p => Math.hypot(x - p.x, y - p.y) < 52)) continue
    g.fillStyle = '#71954a'
    g.fillRect(x - 5, y + 3, 18, 6)
    g.fillStyle = '#79563a'
    g.fillRect(x - 2, y, 4, 7)
    for (const [dy, width] of [[-18, 6], [-15, 12], [-10, 17], [-4, 20]]) {
      g.fillStyle = '#357754'
      g.fillRect(x - (width >> 1), y + dy, width, 5)
      g.fillStyle = '#529450'
      g.fillRect(x - (width >> 1), y + dy, width >> 1, 3)
    }
  }
  g.beginPath()
  g.moveTo(line[0].x, line[0].y)
  line.slice(1).forEach(p => g.lineTo(p.x, p.y))
  g.closePath()
  g.lineJoin = 'round'
  for (const [width, color, dash] of [[77, '#658e49', []], [73, '#faf0dc', []],
    [73, '#d64d49', [9, 9]], [64, '#404658', []], [1, '#929398', [10, 14]]] as const) {
    g.lineWidth = width
    g.strokeStyle = color
    g.setLineDash([...dash])
    g.stroke()
  }
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 2; col++) {
      g.fillStyle = (row + col) % 2 ? '#34394c' : '#fff4da'
      g.fillRect(425 + col * 4, 423 + row * 4, 4, 4)
    }
  }
  return map
}

const paints = [
  ['#234995', '#3975dc', '#74a7ff'], ['#a34228', '#e76f3b', '#ffa763'],
  ['#00766f', '#1ca79a', '#79d8bb'],
]

function car(g: CanvasRenderingContext2D, x: number, y: number, angle: number, index: number, boosting: boolean) {
  const [dark, body, shine] = paints[index]
  // Lift each rotated slice vertically in screen space to give the body depth at every heading.
  for (let height = -1; height <= 4; height++) {
    g.save()
    g.translate(Math.round(x) + (height < 0 ? 2 : 0), Math.round(y) - height)
    g.rotate(angle)
    if (height === 0 && boosting) {
      g.fillStyle = '#ffb54c'
      g.fillRect(-22, -4, 12, 3)
      g.fillRect(-20, 2, 10, 3)
    }
    if (height <= 2) {
      g.fillStyle = height < 0 ? '#303440' : height === 0 ? '#1f273a' : height === 1 ? dark : body
      g.fillRect(-12, -6, 25, 12)
      g.fillRect(-10, -7, 20, 14)
      if (height === 2) {
        g.fillStyle = '#fff4d9'
        g.fillRect(-12, -2, 25, 3)
        g.fillStyle = '#ffe79f'
        g.fillRect(11, -5, 2, 2)
        g.fillRect(11, 3, 2, 2)
        g.fillStyle = '#f05948'
        g.fillRect(-12, -5, 2, 2)
        g.fillRect(-12, 3, 2, 2)
      }
    } else {
      g.fillStyle = height === 3 ? '#1e344a' : '#446584'
      g.fillRect(-7, -5, 13, 10)
      g.fillStyle = shine
      g.fillRect(3, -4, 2, 6)
      g.fillStyle = body
      g.fillRect(-5, -5, 6, 10)
      g.fillStyle = '#fff4d9'
      g.fillRect(-5, -2, 6, 3)
    }
    g.restore()
  }
}

export function drawRace(g: CanvasRenderingContext2D, map: HTMLCanvasElement, race: Race) {
  const player = pose(race.distance, 0)
  const { width, height } = g.canvas
  const cameraX = Math.max(0, Math.min(map.width - width, Math.round(player.x - width / 2 + 22 * Math.cos(player.angle))))
  const cameraY = Math.max(0, Math.min(map.height - height, Math.round(player.y - height / 2 + 15 * Math.sin(player.angle))))
  g.drawImage(map, cameraX, cameraY, width, height, 0, 0, width, height)
  const [orange, green] = rivals(race.elapsed)
  const cars = [player, pose(orange, -19), pose(green, 19)]
  cars.forEach((p, index) => car(g, p.x - cameraX, p.y - cameraY, p.angle, index,
    index === 0 && race.cooldown > RECHARGE - BOOST_TIME))
}
