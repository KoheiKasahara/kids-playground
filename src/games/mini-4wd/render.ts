import { COLORS, sampleTrack } from './data'
import type { Build, Course, PartCategory, RaceState } from './types'

type Context = CanvasRenderingContext2D
type Palette = { ground: string; light: string; dark: string; leaf: string; leafLight: string; trunk: string; edge: string }

const WIDTH = 720
const HEIGHT = 440
const INK = '#263848'
const LANES = [-30, 0, 30]
const THEMES: Record<Course['theme'], Palette> = {
  park: { ground: '#abc99a', light: '#b8d5a6', dark: '#95b786', leaf: '#4d8b65', leafLight: '#81b16b', trunk: '#92744f', edge: '#d7e8b5' },
  forest: { ground: '#809f80', light: '#8dab8a', dark: '#6d8e75', leaf: '#33685b', leafLight: '#63906a', trunk: '#8b7052', edge: '#b9ceaa' },
  coast: { ground: '#efd6aa', light: '#f7dfb9', dark: '#dfc596', leaf: '#599d7f', leafLight: '#8eb78b', trunk: '#ab8762', edge: '#fff0cb' },
  night: { ground: '#314257', light: '#394c61', dark: '#29394e', leaf: '#355b61', leafLight: '#577e7a', trunk: '#6b6c71', edge: '#70848c' },
}

const scenes = new WeakMap<Course, HTMLCanvasElement>()
const sprites = new Map<string, HTMLCanvasElement>()
type MonitorBox = { x: number; y: number; width: number; height: number }
const monitorBoxes = new WeakMap<Course, MonitorBox>()
const random = (n: number) => { const value = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return value - Math.floor(value) }

function rect(g: Context, color: string, x: number, y: number, width: number, height: number) {
  g.fillStyle = color
  g.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height))
}

function polygon(g: Context, color: string, points: number[]) {
  g.fillStyle = color
  g.beginPath()
  g.moveTo(Math.round(points[0]), Math.round(points[1]))
  for (let index = 2; index < points.length; index += 2) g.lineTo(Math.round(points[index]), Math.round(points[index + 1]))
  g.closePath()
  g.fill()
}

function oval(g: Context, color: string, x: number, y: number, width: number, height: number) {
  rect(g, color, x + width * 0.18, y, width * 0.64, height)
  rect(g, color, x + width * 0.06, y + height * 0.17, width * 0.88, height * 0.66)
  rect(g, color, x, y + height * 0.33, width, height * 0.34)
}

function text(g: Context, value: string, x: number, y: number, size = 11, color = INK, align: CanvasTextAlign = 'left') {
  g.fillStyle = color
  g.font = `800 ${size}px "Trebuchet MS", sans-serif`
  g.textAlign = align
  g.textBaseline = 'middle'
  g.fillText(value, Math.round(x), Math.round(y))
}

function screw(g: Context, x: number, y: number, size = 3) {
  rect(g, '#1f2c3b', x - 1, y - 1, size + 2, size + 2)
  rect(g, '#b9c8c6', x, y, size, size)
  rect(g, '#5e7886', x, y + Math.floor(size / 2), size, 1)
}

function shade(hex: string, amount: number) {
  const color = hex.replace('#', '')
  return `#${[0, 2, 4].map((offset) => Math.max(0, Math.min(255, parseInt(color.slice(offset, offset + 2), 16) + amount)).toString(16).padStart(2, '0')).join('')}`
}

function carColor(build: Build) {
  return COLORS.find((color) => color.id === build.color)?.hex ?? '#ed684d'
}

/** A 96 × 140 original sprite. Its rollers, tread, motor and body are separate layers. */
function carSprite(build: Build) {
  const key = [build.body, build.motor, build.tires, build.rollers, build.color].join(':')
  const cached = sprites.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = 96
  canvas.height = 140
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const color = carColor(build), light = shade(color, 43), dark = shade(color, -39)
  const tire = build.tires === 'sponge' ? '#556278' : '#253342'
  const roller = build.rollers === 'bearing' ? '#f1c56d' : build.rollers === 'wide' ? '#72c6c5' : '#d7e2d7'
  const rollerRadius = build.rollers === 'wide' ? 9 : 7
  const rollerX = build.rollers === 'wide' ? 8 : 12

  // Carbon chassis, four axles, and the independently visible drive motor.
  polygon(g, '#172736', [30, 20, 66, 20, 73, 31, 73, 111, 66, 122, 30, 122, 23, 111, 23, 31])
  rect(g, '#405461', 29, 27, 38, 88)
  rect(g, '#6a7e83', 32, 29, 2, 82)
  rect(g, '#182a39', 61, 29, 3, 84)
  for (const y of [40, 91]) {
    rect(g, '#718a8f', 16, y + 9, 64, 5)
    rect(g, '#c9d8cf', 17, y + 9, 62, 1)
    for (const x of [13, 71]) {
      const width = build.tires === 'sponge' ? 13 : 12
      rect(g, '#172535', x - 1, y - 1, width + 2, 26)
      rect(g, tire, x, y, width, 24)
      rect(g, '#70838a', x + 3, y + 2, width - 6, 20)
      rect(g, '#d9ddc4', x + 4, y + 4, width - 8, 16)
      rect(g, '#6b7f84', x + 4, y + 10, width - 8, 4)
      if (build.tires !== 'slick') for (let step = 0; step < 6; step++) {
        rect(g, build.tires === 'sponge' ? '#85919f' : '#526371', x, y + step * 4, 3, 1)
        rect(g, '#182839', x + width - 3, y + step * 4 + 2, 3, 1)
      }
      else rect(g, '#697684', x + 1, y + 1, 1, 21)
    }
  }
  const motorColor = build.motor === 'dash' ? '#e9aa5c' : build.motor === 'torque' ? '#9acfc1' : '#bac7ca'
  rect(g, '#1d2d3b', 32, 102, 32, 13)
  rect(g, motorColor, 34, 103, 28, 10)
  rect(g, '#edf0d7', 36, 103, 22, 2)
  rect(g, shade(motorColor, -35), 34, 111, 28, 2)
  rect(g, '#dcc572', 31, 106, 4, 4)
  rect(g, '#cf805c', 61, 105, 4, 5)
  for (let x = 40; x < 58; x += 5) rect(g, '#536e79', x, 107, 2, 4)
  rect(g, '#ef8267', 65, 96, 2, 10)
  rect(g, '#ef8267', 60, 95, 7, 2)
  rect(g, '#ead68c', 29, 95, 2, 13)

  // Raised front/rear bumpers and their small outboard roller bearings.
  for (const y of [17, 122]) {
    polygon(g, '#1c2d3b', [9, y - 4, 32, y - 2, 38, y - 5, 58, y - 5, 64, y - 2, 87, y - 4, 87, y + 4, 64, y + 6, 32, y + 6, 9, y + 4])
    rect(g, '#768f92', 15, y - 1, 66, 2)
    for (let x = 30; x < 67; x += 9) rect(g, '#121f2c', x, y + 3, 4, 2)
    for (const x of [rollerX, 96 - rollerX]) {
      oval(g, '#182b3b', x - rollerRadius, y - rollerRadius, rollerRadius * 2, rollerRadius * 2)
      oval(g, roller, x - rollerRadius + 2, y - rollerRadius + 1, rollerRadius * 2 - 4, rollerRadius * 2 - 4)
      rect(g, '#f8f5d9', x - rollerRadius + 3, y - rollerRadius + 2, rollerRadius * 2 - 6, 2)
      rect(g, '#47717f', x - 3, y - 2, 6, 5)
      screw(g, x - 1, y - 1, 2)
    }
    screw(g, 35, y - 1, 2)
    screw(g, 59, y - 1, 2)
  }

  if (build.body === 'buggy') {
    polygon(g, '#192f3e', [35, 23, 61, 23, 68, 31, 68, 49, 64, 56, 67, 99, 61, 104, 35, 104, 29, 99, 32, 56, 28, 49, 28, 31])
    polygon(g, color, [36, 25, 60, 25, 65, 32, 65, 47, 61, 55, 64, 98, 58, 101, 38, 101, 32, 98, 35, 55, 31, 47, 31, 32])
    rect(g, light, 35, 28, 25, 3)
    rect(g, dark, 58, 33, 6, 13)
    rect(g, '#fff0cd', 38, 33, 20, 5)
    rect(g, '#d9a269', 39, 38, 18, 2)
    for (const x of [25, 61]) {
      rect(g, '#1d3140', x, 40, 11, 25)
      rect(g, color, x + 1, 41, 9, 22)
      rect(g, light, x + 1, 41, 3, 19)
      rect(g, dark, x + 7, 44, 3, 19)
      rect(g, '#fff0cf', x + 1, 55, 8, 3)
    }
    rect(g, '#283b47', 35, 78, 26, 19)
    rect(g, '#526a6c', 38, 81, 20, 13)
    for (let x = 38; x <= 56; x += 6) rect(g, '#273e4b', x, 82, 2, 11)
    rect(g, '#ead8ac', 32, 93, 32, 4)
  } else if (build.body === 'wing') {
    polygon(g, '#1b2d3d', [44, 21, 52, 21, 59, 38, 66, 49, 63, 70, 73, 83, 73, 101, 57, 105, 39, 105, 23, 101, 23, 83, 33, 70, 30, 49, 37, 38])
    polygon(g, color, [45, 23, 51, 23, 56, 39, 63, 50, 60, 72, 70, 85, 70, 98, 56, 102, 40, 102, 26, 98, 26, 85, 36, 72, 33, 50, 40, 39])
    polygon(g, light, [45, 25, 48, 25, 43, 46, 37, 53, 37, 69, 33, 75, 34, 50, 41, 39])
    polygon(g, dark, [51, 25, 58, 43, 63, 51, 60, 70, 69, 86, 69, 97, 59, 99, 58, 77, 57, 48])
    polygon(g, '#ffedc7', [47, 27, 50, 27, 53, 44, 50, 50, 44, 50])
    rect(g, '#1b3041', 24, 89, 48, 12)
    rect(g, color, 22, 87, 52, 10)
    rect(g, light, 23, 87, 50, 2)
    rect(g, dark, 23, 95, 50, 3)
    rect(g, '#fff1ce', 26, 90, 44, 3)
    rect(g, '#1b3041', 21, 84, 4, 16)
    rect(g, '#1b3041', 71, 84, 4, 16)
  } else {
    polygon(g, '#1b2d3d', [42, 22, 54, 22, 61, 42, 65, 60, 72, 87, 69, 99, 58, 105, 38, 105, 27, 99, 24, 87, 31, 60, 35, 42])
    polygon(g, color, [43, 24, 53, 24, 58, 43, 62, 61, 69, 87, 66, 97, 57, 102, 39, 102, 30, 97, 27, 87, 34, 61, 38, 43])
    polygon(g, light, [43, 26, 46, 26, 41, 44, 37, 65, 31, 86, 33, 94, 29, 91, 29, 86, 35, 62, 39, 42])
    polygon(g, dark, [52, 27, 58, 46, 63, 69, 68, 87, 65, 96, 57, 100, 57, 86, 58, 60])
    polygon(g, '#fff1d2', [46, 26, 50, 26, 54, 47, 52, 52, 44, 52, 42, 47])
    polygon(g, '#f9e4b7', [30, 82, 38, 86, 43, 99, 37, 98, 31, 92])
    polygon(g, '#f9e4b7', [66, 82, 58, 86, 53, 99, 59, 98, 65, 92])
    rect(g, '#243846', 39, 91, 18, 9)
    for (let y = 92; y < 100; y += 3) rect(g, '#718e92', 40, y, 16, 1)
  }

  // Glass canopy: no driver, because this is a miniature electric car.
  polygon(g, '#142c3c', [42, 45, 54, 45, 60, 57, 58, 77, 54, 82, 42, 82, 38, 77, 36, 57])
  polygon(g, '#416977', [43, 47, 53, 47, 57, 57, 55, 76, 41, 76, 39, 57])
  polygon(g, '#78afba', [43, 48, 51, 48, 54, 56, 53, 66, 41, 66, 41, 56])
  polygon(g, '#c2e9dd', [43, 48, 47, 48, 44, 63, 41, 63, 41, 56])
  rect(g, '#214553', 40, 68, 16, 3)
  rect(g, '#173747', 41, 75, 14, 3)
  rect(g, '#cbdace', 44, 79, 8, 1)
  for (const x of [33, 59]) {
    rect(g, '#243c48', x, 39, 4, 5)
    rect(g, '#f9ebae', x, 39, 3, 2)
  }
  screw(g, 45, 28, 2)
  screw(g, 45, 99, 2)
  // Tiny side vents and contrasting number decal complete the miniature.
  for (let y = 70; y < 80; y += 3) {
    rect(g, '#213644', 32, y, 3, 1)
    rect(g, '#213644', 61, y, 3, 1)
  }
  rect(g, '#fff1d5', 44, 84, 8, 7)
  rect(g, '#293c47', 47, 85, 2, 5)
  rect(g, '#293c47', 46, 85, 1, 1)
  if (sprites.size >= 48) sprites.delete(sprites.keys().next().value as string)
  sprites.set(key, canvas)
  return canvas
}

function car(g: Context, build: Build, x: number, y: number, scale: number, angle: number, shadow = true) {
  g.save()
  g.translate(Math.round(x), Math.round(y))
  g.rotate(angle)
  if (shadow) {
    g.globalAlpha = 0.22
    oval(g, '#162b3b', -43 * scale + 3, -55 * scale + 5, 89 * scale, 117 * scale)
    g.globalAlpha = 1
  }
  g.drawImage(carSprite(build), -48 * scale, -70 * scale, 96 * scale, 140 * scale)
  g.restore()
}

function setup(canvas: HTMLCanvasElement, width: number, height: number) {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  const g = canvas.getContext('2d')
  if (g) { g.imageSmoothingEnabled = false; g.clearRect(0, 0, width, height) }
  return g
}

function wrench(g: Context, x: number, y: number, angle = 0, scale = 1) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  g.scale(scale, scale)
  polygon(g, '#536d78', [-6, -19, -6, -10, -2, -6, -2, 18, 2, 21, 6, 18, 4, -7, 8, -12, 7, -20, 3, -15, 0, -15, -2, -20])
  rect(g, '#b6c9c7', 0, -7, 2, 23)
  rect(g, '#d9e5d3', -5, -11, 7, 2)
  rect(g, '#253e4b', 1, 16, 2, 2)
  g.restore()
}

function driver(g: Context, x: number, y: number, angle = 0) {
  g.save()
  g.translate(x, y)
  g.rotate(angle)
  rect(g, '#d7e0cf', -1, -30, 3, 30)
  rect(g, '#5c7780', -1, -31, 1, 34)
  rect(g, '#243a47', -5, 1, 11, 23)
  rect(g, '#eb9b5f', -4, 3, 8, 19)
  rect(g, '#f9cd82', -3, 5, 2, 14)
  rect(g, '#be734f', 2, 5, 2, 16)
  g.restore()
}

function tireIcon(g: Context, x: number, y: number, build: Build) {
  oval(g, '#233743', x, y, 34, 34)
  oval(g, build.tires === 'sponge' ? '#63768b' : '#394a58', x + 2, y + 2, 30, 29)
  oval(g, '#c3d1c6', x + 8, y + 8, 18, 18)
  oval(g, '#526f7b', x + 13, y + 13, 8, 8)
  rect(g, '#edf1d3', x + 11, y + 9, 12, 2)
  if (build.tires !== 'slick') for (let i = 0; i < 4; i++) rect(g, '#7c8c91', x + 4 + i * 7, y + 4, 2, 3)
}

/** The assembly mat shows the actual selected components, including the exposed motor. */
export function drawGarage(canvas: HTMLCanvasElement, build: Build, selected: PartCategory = 'body') {
  const g = setup(canvas, 640, 380)
  if (!g) return
  rect(g, '#365e63', 0, 0, 640, 380)
  rect(g, '#426d70', 0, 0, 640, 95)
  for (let x = 14; x < 640; x += 16) for (let y = 12; y < 91; y += 16) rect(g, '#2e555a', x, y, 2, 2)
  rect(g, '#27474f', 0, 88, 640, 13)
  rect(g, '#f3d9aa', 0, 91, 640, 5)
  rect(g, '#d4b082', 0, 101, 640, 279)
  for (let y = 110; y < 380; y += 48) {
    rect(g, '#c5a075', 0, y + 28, 640, 2)
    rect(g, '#e0bd8f', 0, y + 31, 640, 1)
    for (let x = 8; x < 640; x += 84) rect(g, '#cea97b', x + random(x + y) * 30, y + 12, 22, 1)
  }
  // Pegboard: miniature parts cartons, dangling tools and warm task lamp.
  for (const [x, color] of [[29, '#e7ae67'], [72, '#9dc0a6'], [115, '#d98564']] as const) {
    rect(g, '#29494f', x + 3, 44, 35, 41)
    rect(g, color, x, 41, 34, 40)
    rect(g, '#fff0c7', x + 5, 50, 24, 17)
    rect(g, '#5c6b64', x + 9, 55, 16, 2)
    rect(g, '#899b84', x + 9, 60, 11, 2)
    rect(g, shade(color, -25), x, 73, 34, 8)
    rect(g, '#fae7b7', x + 2, 43, 30, 2)
  }
  wrench(g, 513, 49, -0.12, 1.1)
  driver(g, 555, 47, 0.1)
  rect(g, '#b8c7ab', 586, 27, 5, 48)
  rect(g, '#213c46', 585, 28, 7, 4)
  rect(g, '#d9e2c4', 587, 34, 2, 28)
  rect(g, '#e8c792', 194, 18, 251, 52)
  rect(g, '#fff0c8', 197, 21, 245, 44)
  text(g, 'MINI 4WD LAB', 319, 39, 20, INK, 'center')
  text(g, 'BUILD  ·  TUNE  ·  RACE', 319, 56, 8, '#6d847d', 'center')
  for (const x of [202, 434]) screw(g, x, 27, 3)

  // Dark gridded cutting mat makes the tiny individual pixels and silhouette read.
  rect(g, '#9b8063', 125, 116, 388, 248)
  rect(g, '#284b50', 119, 109, 388, 248)
  rect(g, '#456f6b', 123, 113, 380, 240)
  rect(g, '#365f5e', 128, 118, 370, 230)
  for (let x = 130; x < 498; x += 16) rect(g, '#416c67', x, 118, 1, 230)
  for (let y = 118; y < 348; y += 16) rect(g, '#416c67', 128, y, 370, 1)
  for (let x = 132; x < 495; x += 8) rect(g, '#96b2a1', x, 118, 1, x % 16 === 4 ? 5 : 3)
  for (let y = 132; y < 345; y += 8) rect(g, '#96b2a1', 128, y, y % 16 === 4 ? 5 : 3, 1)
  text(g, 'DESIGN / 01', 141, 337, 8, '#a6bfa9')
  rect(g, '#75978b', 454, 322, 28, 16)
  text(g, '4WD', 468, 330, 9, '#244b50', 'center')

  // Fine technical outline beneath the assembled model.
  g.strokeStyle = '#72978a'
  g.lineWidth = 1
  g.strokeRect(224, 142, 163, 181)
  for (const [x, y] of [[224, 142], [387, 142], [224, 323], [387, 323]]) {
    rect(g, '#abc2a6', x - 4, y, 9, 1)
    rect(g, '#abc2a6', x, y - 4, 1, 9)
  }
  car(g, build, 307, 232, 1.53, -0.28)

  // Each part has a real component swatch rather than an unrelated decorative icon.
  const rows: { category: PartCategory; y: number; name: string; value: string }[] = [
    { category: 'body', y: 126, name: 'BODY', value: build.body.toUpperCase() },
    { category: 'motor', y: 180, name: 'MOTOR', value: build.motor.toUpperCase() },
    { category: 'tires', y: 234, name: 'TIRES', value: build.tires.toUpperCase() },
    { category: 'rollers', y: 288, name: 'ROLLERS', value: build.rollers.toUpperCase() },
  ]
  for (const item of rows) {
    const active = item.category === selected
    rect(g, active ? '#f6d18a' : '#c3cbb1', 395, item.y, 92, 42)
    rect(g, active ? '#ffedbb' : '#dce1c7', 397, item.y + 2, 88, 36)
    rect(g, active ? '#dc855b' : '#88a295', 397, item.y + 2, 3, 36)
    text(g, item.name, 406, item.y + 12, 9, '#456265')
    text(g, item.value, 406, item.y + 27, 9, '#283e4a')
    if (active) {
      rect(g, '#f3d39a', 376, item.y + 19, 19, 1)
      rect(g, '#f3d39a', 372, item.y + 17, 4, 4)
    }
  }

  // Component tray to the left, hardware dishes and tools to the right.
  rect(g, '#967b60', 17, 123, 86, 221)
  rect(g, '#3c5761', 14, 119, 86, 221)
  rect(g, '#708b88', 18, 123, 78, 213)
  for (const y of [129, 196, 263]) {
    rect(g, '#35515b', 22, y, 70, 61)
    rect(g, '#29444e', 25, y + 3, 64, 55)
  }
  tireIcon(g, 39, 139, build)
  text(g, 'TIRE SET', 57, 181, 7, '#bbd0ba', 'center')
  rect(g, '#172d3e', 33, 215, 48, 23)
  rect(g, build.motor === 'dash' ? '#dda15a' : build.motor === 'torque' ? '#93c9b5' : '#a8bcba', 36, 211, 41, 23)
  rect(g, '#eaf1d5', 39, 211, 32, 4)
  rect(g, '#657e82', 44, 222, 3, 9)
  rect(g, '#657e82', 51, 222, 3, 9)
  rect(g, '#657e82', 58, 222, 3, 9)
  rect(g, '#edd081', 29, 219, 7, 7)
  rect(g, '#dc906a', 77, 217, 7, 10)
  text(g, 'MOTOR', 57, 248, 7, '#bbd0ba', 'center')
  for (const [x, y] of [[35, 278], [61, 278], [35, 302], [61, 302]]) {
    oval(g, '#182e3d', x - 1, y - 1, 19, 19)
    oval(g, build.rollers === 'bearing' ? '#e4bc76' : build.rollers === 'wide' ? '#78c7bf' : '#b3c8c5', x, y, 17, 17)
    oval(g, '#527783', x + 5, y + 5, 7, 7)
    screw(g, x + 7, y + 7, 2)
  }
  driver(g, 544, 207, 0.25)
  wrench(g, 585, 237, -0.4, 1.5)
  rect(g, '#a88c6a', 527, 282, 92, 57)
  rect(g, '#efe0bb', 523, 278, 92, 57)
  rect(g, '#c5b895', 529, 284, 80, 45)
  for (let i = 0; i < 8; i++) screw(g, 536 + random(i + 1) * 61, 289 + random(i + 20) * 28, 3)
  text(g, 'SMALL PARTS', 570, 348, 8, '#765f4a', 'center')
  // Two small batteries on their charging pad.
  rect(g, '#38515b', 530, 119, 76, 43)
  for (const y of [127, 143]) {
    rect(g, '#6e9291', 537, y, 56, 10)
    rect(g, '#eac67f', 537, y, 14, 10)
    rect(g, '#e3e6c5', 593, y + 3, 4, 4)
    rect(g, '#bdd0b7', 555, y + 2, 30, 2)
    rect(g, '#35565f', 558, y + 6, 18, 2)
  }
  rect(g, '#80d4a1', 599, 151, 3, 3)
}

function tree(g: Context, x: number, y: number, size: number, palette: Palette, pine = false) {
  g.save()
  g.translate(Math.round(x), Math.round(y))
  g.scale(size, size)
  oval(g, palette.dark, -20, -3, 42, 12)
  rect(g, '#514b40', -3, -19, 7, 23)
  rect(g, palette.trunk, -3, -20, 3, 22)
  if (pine) {
    for (let i = 0; i < 3; i++) {
      const w = 14 + i * 7, top = -60 + i * 15
      polygon(g, palette.leaf, [0, top, w, top + 26, -w, top + 26])
      polygon(g, palette.leafLight, [0, top, 0, top + 23, -w + 4, top + 23])
      rect(g, palette.light, -w + 7, top + 21, w - 7, 2)
    }
  } else {
    oval(g, palette.leaf, -24, -58, 48, 44)
    oval(g, palette.leafLight, -23, -58, 37, 32)
    oval(g, palette.leafLight, -12, -66, 30, 26)
    rect(g, palette.light, -14, -56, 9, 3)
    rect(g, palette.light, -20, -46, 5, 3)
    rect(g, palette.leaf, 9, -50, 10, 3)
    rect(g, palette.leaf, -10, -24, 15, 4)
  }
  g.restore()
}

function person(g: Context, x: number, y: number, shirt: string, skin: string, seed: number) {
  rect(g, '#44585b', x - 3, y + 10, 3, 5)
  rect(g, '#44585b', x + 2, y + 10, 3, 5)
  rect(g, '#243d48', x - 4, y + 14, 4, 2)
  rect(g, '#243d48', x + 2, y + 14, 4, 2)
  rect(g, shirt, x - 4, y + 2, 9, 10)
  rect(g, shade(shirt, 27), x - 4, y + 2, 3, 8)
  rect(g, skin, x - 3, y - 5, 7, 8)
  rect(g, '#38434b', x - 4, y - 7, 8, 4)
  rect(g, '#38434b', x + 3, y - 4, 2, 3)
  rect(g, '#293d43', x + 1, y - 1, 1, 1)
  rect(g, skin, x - 7, y + (seed % 2 ? 2 : -2), 3, 6)
  rect(g, skin, x + 6, y + (seed % 2 ? -2 : 3), 3, 6)
}

function palm(g: Context, x: number, y: number, mirror = 1) {
  g.save()
  g.translate(x, y)
  g.scale(mirror, 1)
  oval(g, '#d5bb91', -18, -3, 43, 10)
  polygon(g, '#947b57', [-3, 0, 3, 0, 10, -20, 10, -40, 7, -45, 5, -26])
  polygon(g, '#d8ac6e', [-2, -1, 1, -1, 8, -23, 8, -41, 6, -42, 5, -25])
  for (let i = 0; i < 5; i++) rect(g, '#876f53', 1 + i, -7 - i * 6, 4, 2)
  polygon(g, '#4f8c72', [7, -42, -4, -53, -21, -53, -30, -44, -14, -49, 7, -40, -13, -41, -25, -27, -12, -36, 7, -40, 12, -25, 16, -20, 15, -37, 9, -44, 29, -32, 35, -34, 25, -45, 10, -47, 23, -57, 31, -57, 22, -61, 10, -53])
  polygon(g, '#90bb82', [7, -43, -6, -51, -20, -51, -26, -46, -13, -48, 7, -40, 12, -46, 24, -55, 28, -56, 20, -56, 9, -49])
  rect(g, '#806849', 7, -41, 5, 5)
  rect(g, '#b99a5e', 5, -42, 3, 3)
  g.restore()
}

function flowerbed(g: Context, x: number, y: number, palette: Palette, night: boolean) {
  oval(g, palette.dark, x - 13, y - 4, 29, 13)
  for (let i = 0; i < 5; i++) {
    const dx = x - 9 + i * 5, dy = y - (i % 2) * 4
    rect(g, palette.leaf, dx + 1, dy, 1, 6)
    rect(g, night ? '#d6beac' : i % 2 ? '#f4d58b' : '#edaa94', dx, dy - 3, 4, 3)
    rect(g, '#f9e6bb', dx + 1, dy - 2, 1, 1)
    rect(g, palette.leafLight, dx - 1, dy + 2, 3, 1)
  }
}

function fence(g: Context, x: number, y: number, width: number, night: boolean) {
  rect(g, night ? '#627684' : '#e7e6ca', x, y, width, 4)
  rect(g, night ? '#4a606d' : '#a7b2a2', x, y + 4, width, 2)
  rect(g, night ? '#4a606d' : '#b7c5af', x, y + 11, width, 3)
  for (let offset = 0; offset <= width; offset += 20) {
    rect(g, '#536d6b', x + offset, y - 4, 4, 24)
    rect(g, night ? '#9aaea9' : '#f1edcf', x + offset, y - 5, 3, 23)
  }
}

function trackDistance(course: Course, x: number, y: number) {
  let minimum = Infinity
  for (let index = 0; index < course.points.length; index += 2) {
    const point = course.points[index]
    minimum = Math.min(minimum, Math.hypot(point.x - x, point.y - y))
  }
  return minimum
}

function monitorBox(course: Course): MonitorBox {
  const cached = monitorBoxes.get(course)
  if (cached) return cached
  const candidates: { x: number; y: number }[] = []
  for (let x = 180; x <= 540; x += 12) for (let y = 170; y <= 270; y += 10) candidates.push({ x, y })
  candidates.sort((a, b) => Math.hypot(a.x - 360, a.y - 220) - Math.hypot(b.x - 360, b.y - 220))
  for (const [width, height] of [[142, 88], [126, 78], [110, 70], [94, 70]]) {
    for (const center of candidates) {
      const x = center.x - width / 2, y = center.y - height / 2
      let fits = true
      // Check the whole footprint; different courses leave very different infields.
      for (let col = 0; col <= 6 && fits; col++) for (let row = 0; row <= 4 && fits; row++) {
        if (trackDistance(course, x + width * col / 6, y + height * row / 4) < 57) fits = false
      }
      if (fits) {
        const result = { x, y, width, height }
        monitorBoxes.set(course, result)
        return result
      }
    }
  }
  const result = { x: 574, y: 3, width: 138, height: 65 }
  monitorBoxes.set(course, result)
  return result
}

function liveMonitor(g: Context, race: RaceState, reducedMotion: boolean) {
  const player = race.racers.find((racer) => racer.id === 0)
  if (!player) return
  const { x, y, width, height } = monitorBox(race.course)
  rect(g, '#2b4550', x + 4, y + 5, width, height)
  rect(g, '#d0cfad', x, y, width, height)
  rect(g, '#fff0c6', x + 2, y + 2, width - 4, 3)
  rect(g, '#344f5b', x + 5, y + 7, width - 10, height - 13)
  rect(g, '#26424f', x + 7, y + 21, width - 14, height - 29)
  for (let xx = x + 11; xx < x + width - 8; xx += 10) rect(g, '#31545d', xx, y + 21, 1, height - 30)
  for (let yy = y + 24; yy < y + height - 8; yy += 10) rect(g, '#31545d', x + 7, yy, width - 15, 1)
  text(g, '★', x + 14, y + 14, 13, '#ffe6a2')
  text(g, 'MY MACHINE', x + 27, y + 14, width < 100 ? 6 : 8, '#e5e9cf')
  const scale = Math.min((width - 19) / 140, (height - 29) / 96)
  const bounce = !reducedMotion && race.phase === 'racing' ? Math.sin(race.elapsed * 17) * 0.5 : 0
  car(g, player.build, x + width / 2, y + 22 + (height - 29) / 2 + bounce, scale, Math.PI / 2, false)
  rect(g, '#89cfb0', x + width - 10, y + height - 4, 3, 2)
  rect(g, '#b29e76', x + 7, y + height - 4, width - 26, 1)
  for (const [xx, yy] of [[x + 2, y + 7], [x + width - 4, y + 7], [x + 2, y + height - 5]]) screw(g, xx, yy, 1)
}

function trackPath(g: Context, course: Course, lane: number, color: string, width: number, shiftY = 0) {
  g.beginPath()
  for (let index = 0; index <= 300; index++) {
    const point = sampleTrack(course, course.length * index / 300)
    const x = Math.round(point.x - Math.sin(point.angle) * lane)
    const y = Math.round(point.y + Math.cos(point.angle) * lane + shiftY)
    if (index === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
  }
  g.closePath()
  g.strokeStyle = color
  g.lineWidth = width
  g.lineJoin = 'round'
  g.lineCap = 'round'
  g.stroke()
}

function checkeredFlag(g: Context, x: number, y: number, scale = 1) {
  rect(g, '#375360', x, y, 2 * scale, 29 * scale)
  rect(g, '#f2ebc9', x + 2 * scale, y, 18 * scale, 14 * scale)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) if ((row + col) % 2 === 0) rect(g, '#2d4651', x + (2 + col * 4.5) * scale, y + row * 4.5 * scale, 4.5 * scale, 4.5 * scale)
}

function podium(g: Context, course: Course) {
  if (trackDistance(course, 360, 225) <= 70) return
  oval(g, THEMES[course.theme].dark, 298, 227, 124, 26)
  rect(g, '#6f8e83', 316, 215, 88, 25)
  rect(g, '#e6dfb4', 315, 210, 90, 22)
  rect(g, '#fff1cb', 315, 210, 90, 3)
  rect(g, '#d3b67d', 344, 201, 31, 31)
  rect(g, '#fff0bd', 344, 201, 31, 4)
  text(g, '2', 329, 221, 10, '#547174', 'center')
  text(g, '1', 359, 218, 13, '#765c43', 'center')
  text(g, '3', 389, 221, 10, '#547174', 'center')
  rect(g, '#c18f4c', 354, 190, 11, 10)
  rect(g, '#f5d27e', 349, 176, 21, 14)
  rect(g, '#fff0b2', 352, 178, 5, 10)
  rect(g, '#c18f4c', 346, 179, 3, 7)
  rect(g, '#c18f4c', 370, 179, 3, 7)
  rect(g, '#f2d391', 349, 198, 21, 3)
  checkeredFlag(g, 303, 182)
  checkeredFlag(g, 409, 182)
}

function scene(course: Course) {
  const cached = scenes.get(course)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const palette = THEMES[course.theme], night = course.theme === 'night'
  rect(g, palette.ground, 0, 0, WIDTH, HEIGHT)
  // Hand-placed pixel texture is deterministic: no shimmering terrain during a race.
  for (let index = 0; index < 560; index++) {
    const x = Math.floor(random(index + 100) * WIDTH / 3) * 3
    const y = Math.floor(random(index + 900) * HEIGHT / 3) * 3
    rect(g, index % 3 ? palette.light : palette.dark, x, y, 2 + index % 4 * 2, 2)
  }
  if (course.theme === 'coast') {
    polygon(g, '#73bfc0', [0, 0, 720, 0, 720, 27, 636, 22, 552, 37, 477, 24, 385, 35, 291, 20, 190, 30, 105, 20, 0, 33])
    for (let i = 0; i < 48; i++) rect(g, i % 3 ? '#a6ded0' : '#e6efd0', random(i + 32) * WIDTH, random(i + 70) * 25, 5 + i % 5 * 4, 2)
    rect(g, '#eaeac7', 0, 28, 97, 3)
    rect(g, '#f6e9c6', 160, 28, 79, 3)
    rect(g, '#dbeac4', 384, 32, 68, 3)
  }
  if (night) {
    // Distant neon blocks make this circuit a tiny city after sunset.
    for (let i = 0; i < 15; i++) {
      const x = 6 + i * 49, h = 17 + Math.round(random(i + 311) * 23)
      rect(g, '#223248', x + 3, 36 - h, 34, h)
      rect(g, i % 2 ? '#42536b' : '#3a4c65', x, 35 - h, 34, h)
      rect(g, i % 2 ? '#a593bd' : '#6aabad', x + 3, 35 - h, 28, 2)
      for (let yy = 41 - h; yy < 31; yy += 7) for (let xx = x + 5; xx < x + 31; xx += 7) {
        rect(g, random(xx + yy) > 0.4 ? '#e6c68f' : '#607b87', xx, yy, 3, 3)
      }
    }
    for (let i = 0; i < 35; i++) {
      const x = random(i + 50) * WIDTH, y = random(i + 300) * HEIGHT
      if (trackDistance(course, x, y) > 67) {
        rect(g, i % 3 ? '#779795' : '#c6d7ad', x, y, 2, 2)
        if (i % 4 === 0) rect(g, '#627c80', x - 2, y + 1, 6, 1)
      }
    }
  }
  // Small diorama trees keep away from every track route, including different hairpins.
  for (let index = 0; index < 36; index++) {
    const x = 22 + random(index + 700) * 676, y = 48 + random(index + 1500) * 370
    if (trackDistance(course, x, y - 18) > 82 && !(x > 245 && x < 475 && y > 175 && y < 270)) {
      tree(g, x, y, 0.55 + random(index + 66) * 0.35, palette, course.theme === 'forest')
    }
  }
  for (const [x, y] of [[29, 79], [686, 77], [28, 350], [691, 345]]) {
    if (course.theme === 'coast') palm(g, x, y, x > WIDTH / 2 ? -1 : 1)
    else if (!night) tree(g, x, y, 0.95, palette, course.theme === 'forest')
  }
  for (let index = 0; index < 45; index++) {
    const x = 35 + random(index + 2600) * 650, y = 35 + random(index + 3600) * 350
    if (trackDistance(course, x, y) > 66 && !(x > 288 && x < 432 && y > 157 && y < 248)) flowerbed(g, x, y, palette, night)
  }
  fence(g, 24, 412, 172, night)
  fence(g, 524, 412, 172, night)
  const shirts = ['#eb896c', '#f1cf78', '#73b7bc', '#b5a0c7', '#ebae89', '#8bbda2']
  for (let i = 0; i < 9; i++) {
    const x = 36 + i * 18
    person(g, x, 393 + (i % 2) * 2, shirts[i % shirts.length], i % 2 ? '#e1b18a' : '#f0d0a5', i)
    person(g, 544 + i * 17, 394 + (i % 2) * 2, shirts[(i + 3) % shirts.length], i % 3 ? '#f0d0a5' : '#bb886d', i + 1)
  }
  checkeredFlag(g, 18, 366)
  checkeredFlag(g, 687, 366)

  // Plastic rails: a raised shadow, graphite backing, colored lanes, polished lips.
  trackPath(g, course, 0, night ? '#1e2c40' : '#688977', 105, 7)
  trackPath(g, course, 0, '#3b515b', 101)
  trackPath(g, course, 0, '#f6e7c5', 96)
  trackPath(g, course, 0, '#859b9c', 90)
  const surfaces = night ? ['#6c7ba1', '#9f8a9d', '#6c999a'] : ['#a5c5cf', '#e8c4a9', '#a9cabe']
  LANES.forEach((lane, index) => trackPath(g, course, lane, surfaces[index], 27))
  // Molded sectional joints every few centimetres of the miniature circuit.
  for (let distance = 0; distance < course.length; distance += 41) {
    const point = sampleTrack(course, distance)
    g.save()
    g.translate(Math.round(point.x), Math.round(point.y))
    g.rotate(point.angle)
    rect(g, night ? '#a0abb1' : '#e7e4ce', -1, -44, 1, 88)
    rect(g, night ? '#526779' : '#8ba3a4', 0, -44, 1, 88)
    for (const lane of LANES) {
      rect(g, '#6c888c', 1, lane - 8, 2, 2)
      rect(g, '#e5e5c9', 1, lane + 7, 2, 2)
    }
    g.restore()
  }
  for (const lane of [-45, -15, 15, 45]) {
    trackPath(g, course, lane, '#455e69', 5)
    trackPath(g, course, lane, night ? '#adc6c3' : '#fff1cf', 3, -2)
    trackPath(g, course, lane + 1.5, night ? '#738ba0' : '#ccd9c7', 1, -1)
  }
  for (const zone of course.zones) {
    if (zone.kind === 'curve') continue
    if (zone.kind === 'wave') {
      const startDistance = zone.start * course.length
      const endDistance = zone.end * course.length
      const sections = Math.ceil((endDistance - startDistance) / 12)
      // Every physical bump is visible, including where the zone enters a bend.
      for (let section = 0; section <= sections; section++) {
        const point = sampleTrack(course, startDistance + (endDistance - startDistance) * section / sections)
        g.save()
        g.translate(Math.round(point.x), Math.round(point.y))
        g.rotate(point.angle)
        for (const lane of LANES) {
          rect(g, '#7b9eaa', 0, lane - 11, 5, 23)
          rect(g, '#deebd4', -1, lane - 11, 2, 23)
        }
        g.restore()
      }
      continue
    }
    const point = sampleTrack(course, (zone.start + zone.end) * 0.5 * course.length)
    g.save()
    g.translate(Math.round(point.x), Math.round(point.y))
    g.rotate(point.angle)
    for (const lane of LANES) {
      polygon(g, '#b7b9ae', [-19, lane - 12, 17, lane - 12, 24, lane - 8, 24, lane + 11, -19, lane + 11])
      rect(g, '#e3c77f', -16, lane - 12, 28, 24)
      rect(g, '#fff0bb', -16, lane - 12, 28, 3)
      for (let x = -11; x < 10; x += 7) polygon(g, '#9a825c', [x, lane - 6, x + 5, lane, x, lane + 6, x + 2, lane, x, lane - 6])
      rect(g, '#6e8181', 15, lane - 11, 4, 22)
    }
    g.restore()
  }
  const start = sampleTrack(course, 0)
  g.save()
  g.translate(Math.round(start.x), Math.round(start.y))
  g.rotate(start.angle)
  for (let y = -43; y < 44; y += 6) for (let x = -6; x < 7; x += 6) rect(g, ((y + 43) / 6 + (x + 6) / 6) % 2 ? '#fbefd0' : '#344b57', x, y, 6, 6)
  for (const lane of LANES) {
    polygon(g, '#fdf1cd', [23, lane - 5, 31, lane, 23, lane + 5, 25, lane, 23, lane - 5])
    rect(g, '#597b85', -37, lane - 10, 1, 20)
    rect(g, '#597b85', -37, lane - 10, 17, 1)
    rect(g, '#597b85', -37, lane + 10, 17, 1)
  }
  g.restore()

  rect(g, night ? '#283c51' : '#315f63', 260, 393, 200, 34)
  rect(g, '#e9d6a0', 263, 396, 194, 2)
  text(g, 'MINI 4WD GRAND PRIX', 360, 408, 11, '#fff0c5', 'center')
  text(g, '01  /  02  /  03', 360, 420, 7, '#b3d1c1', 'center')
  if (night) for (const x of [22, 697]) {
    rect(g, '#b8b9a0', x, 109, 3, 48)
    rect(g, '#1e3044', x - 9, 103, 21, 10)
    rect(g, '#f3d999', x - 7, 105, 17, 6)
    rect(g, '#fff2b7', x - 4, 105, 11, 3)
    rect(g, '#718488', x - 4, 154, 11, 4)
  }
  scenes.set(course, canvas)
  return canvas
}

export function drawCoursePreview(canvas: HTMLCanvasElement, course: Course) {
  const g = setup(canvas, WIDTH, HEIGHT)
  if (!g) return
  g.drawImage(scene(course), 0, 0)
  podium(g, course)
}

export function drawRace(canvas: HTMLCanvasElement, race: RaceState, options: { cheer?: number; reducedMotion?: boolean } = {}) {
  const g = setup(canvas, WIDTH, HEIGHT)
  if (!g) return
  g.drawImage(scene(race.course), 0, 0)
  liveMonitor(g, race, options.reducedMotion ?? false)
  for (const racer of [...race.racers].sort((a, b) => Number(a.id === 0) - Number(b.id === 0))) {
    const point = sampleTrack(race.course, racer.distance)
    const lane = racer.id === 0 ? 0 : racer.id === 1 ? -30 : 30
    const x = point.x - Math.sin(point.angle) * lane
    const y = point.y + Math.cos(point.angle) * lane
    const fraction = ((racer.distance % race.course.length) + race.course.length) % race.course.length / race.course.length
    const jump = race.course.zones.find((zone) => zone.kind === 'jump' && fraction >= zone.start && fraction <= zone.end)
    const lift = jump && !options.reducedMotion ? Math.sin((fraction - jump.start) / (jump.end - jump.start) * Math.PI) * 8 : 0
    const wobble = options.reducedMotion ? 0 : Math.sin(race.elapsed * 29 + racer.id) * Math.min(0.14, racer.wobble * 0.08)
    if (racer.speed > 12 && race.phase === 'racing' && !options.reducedMotion) {
      for (let i = 0; i < 3; i++) {
        const trail = sampleTrack(race.course, racer.distance - 25 - i * 8)
        rect(g, i % 2 ? '#fff0c1' : '#dce4cb', trail.x - Math.sin(trail.angle) * lane, trail.y + Math.cos(trail.angle) * lane, 3 - Math.floor(i / 2), 2)
      }
    }
    car(g, racer.build, x, y - lift, 0.345 + lift * 0.0015, point.angle + Math.PI / 2 + wobble)
    if (racer.id === 0) {
      const markerY = y - lift - 38
      rect(g, '#263d4b', x - 23, markerY - 10, 46, 16)
      rect(g, '#ffedab', x - 21, markerY - 9, 42, 13)
      text(g, '★', x, markerY - 2, 14, '#283f4c', 'center')
      polygon(g, '#263d4b', [x - 6, markerY + 5, x + 6, markerY + 5, x, markerY + 13])
      polygon(g, '#ffedab', [x - 4, markerY + 5, x + 4, markerY + 5, x, markerY + 10])
      if ((options.cheer ?? 0) > 0 && !options.reducedMotion) {
        const step = race.elapsed * 8
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3 + step * 0.1
          const radius = 24 + Math.sin(step + i) * 4
          rect(g, i % 2 ? '#fff0b4' : '#efb75e', x + Math.cos(angle) * radius, y - lift + Math.sin(angle) * radius, 3, 3)
        }
      }
    }
  }
  if (race.phase === 'finished' && !options.reducedMotion) {
    for (let index = 0; index < 55; index++) {
      const x = random(index + 501) * WIDTH
      const y = (random(index + 1001) * HEIGHT + race.elapsed * (12 + index % 4 * 4)) % HEIGHT
      rect(g, ['#f3cc77', '#e99175', '#b3d7c0', '#fcf0bc'][index % 4], x, y, index % 2 ? 4 : 2, index % 2 ? 2 : 5)
    }
  }
}
