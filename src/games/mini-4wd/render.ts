import { COLORS, PARTS, sampleTrack } from './data'
import { CHEER_BOOST_SECONDS, LANE_GAP, LANE_OFFSETS, lanePosition } from './race'
import type { Build, Course, PartCategory, RaceState, Racer } from './types'

type Context = CanvasRenderingContext2D
type Palette = { ground: string; light: string; dark: string; leaf: string; leafLight: string; trunk: string; edge: string }

const WIDTH = 720
const HEIGHT = 440
const INK = '#263848'
const LANES = LANE_OFFSETS
/** Sideways distance from the centreline to the outer guard walls. */
const EDGE = LANE_GAP * 1.5
/** How high the lane-change bridge carries a car over the other lanes. */
const BRIDGE_HEIGHT = 15
const THEMES: Record<Course['theme'], Palette> = {
  park: { ground: '#abc99a', light: '#b8d5a6', dark: '#95b786', leaf: '#4d8b65', leafLight: '#81b16b', trunk: '#92744f', edge: '#d7e8b5' },
  forest: { ground: '#809f80', light: '#8dab8a', dark: '#6d8e75', leaf: '#33685b', leafLight: '#63906a', trunk: '#8b7052', edge: '#b9ceaa' },
  coast: { ground: '#efd6aa', light: '#f7dfb9', dark: '#dfc596', leaf: '#599d7f', leafLight: '#8eb78b', trunk: '#ab8762', edge: '#fff0cb' },
  night: { ground: '#314257', light: '#394c61', dark: '#29394e', leaf: '#355b61', leafLight: '#577e7a', trunk: '#6b6c71', edge: '#70848c' },
}

const scenes = new WeakMap<Course, HTMLCanvasElement>()
const bridges = new WeakMap<Course, HTMLCanvasElement>()
const sprites = new Map<string, HTMLCanvasElement[]>()
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

/**
 * The car is a small voxel model: a stack of 48 × 60 pixel slices, one per unit of height.
 * Drawing the slices with a small vertical offset keeps the pixel art and adds real volume
 * at every angle, so the same model works on the turntable, the part cards and the track.
 */
const SLICE_WIDTH = 48
const SLICE_LENGTH = 60
const SLICE_COUNT = 18
const AXLES = [-15, 15]

type Slices = Context[]

function block(slices: Slices, color: string | ((z: number) => string), x: number, y: number, width: number, length: number, z0: number, z1: number) {
  for (let z = Math.max(0, z0); z < Math.min(SLICE_COUNT, z1); z++) {
    rect(slices[z], typeof color === 'string' ? color : color(z), x + SLICE_WIDTH / 2, y + SLICE_LENGTH / 2, width, length)
  }
}

function slab(slices: Slices, z: number, color: string, points: number[]) {
  if (z < 0 || z >= SLICE_COUNT) return
  polygon(slices[z], color, points.map((value, index) => value + (index % 2 ? SLICE_LENGTH / 2 : SLICE_WIDTH / 2)))
}

function disc(slices: Slices, color: string, x: number, y: number, radius: number, z: number) {
  if (z < 0 || z >= SLICE_COUNT) return
  oval(slices[z], color, x - radius + SLICE_WIDTH / 2, y - radius + SLICE_LENGTH / 2, radius * 2, radius * 2)
}

const TIRES: Record<string, { radius: number; width: number; rubber: string; wall: string; rim: string; tread: string | null }> = {
  normal: { radius: 5, width: 6, rubber: '#263443', wall: '#3e5262', rim: '#d9ddc4', tread: '#4f6271' },
  sponge: { radius: 5, width: 7, rubber: '#6f7f9a', wall: '#93a3ba', rim: '#fff4d6', tread: '#a9b7c9' },
  slick: { radius: 5, width: 6, rubber: '#1b2531', wall: '#2c3a48', rim: '#ef6f6c', tread: null },
  big: { radius: 7, width: 7, rubber: '#273240', wall: '#3d4b5a', rim: '#f6c650', tread: '#56687a' },
  spike: { radius: 5, width: 6, rubber: '#2f3b33', wall: '#465748', rim: '#9fe0a9', tread: '#c9d6c4' },
}

const ROLLERS: Record<string, { radius: number; color: string; tiers: [number, number][] }> = {
  standard: { radius: 2.5, color: '#dfe7dc', tiers: [[3, 6]] },
  bearing: { radius: 2.5, color: '#9cc2e3', tiers: [[3, 6]] },
  wide: { radius: 3.5, color: '#72c6c5', tiers: [[3, 6]] },
  double: { radius: 2.5, color: '#f3a3b5', tiers: [[2, 5], [7, 10]] },
  gold: { radius: 3, color: '#ffd34d', tiers: [[3, 7]] },
}

const MOTORS: Record<string, { color: string; stripe: string; big?: boolean }> = {
  balance: { color: '#bac7ca', stripe: '#5b7380' },
  dash: { color: '#f0a14f', stripe: '#ffe27a' },
  torque: { color: '#6fc48f', stripe: '#e9f7d9' },
  rocket: { color: '#e6505d', stripe: '#ffe08a', big: true },
  eco: { color: '#78c4e6', stripe: '#5fbf6a' },
}

function wheel(slices: Slices, build: Build, x: number, axle: number, outward: number) {
  const tire = TIRES[build.tires] ?? TIRES.normal
  const { radius, width } = tire
  const left = outward > 0 ? x : x - width
  const outer = outward > 0 ? left + width - 1 : left
  for (let z = 0; z < radius * 2; z++) {
    const dz = z + .5 - radius
    const half = Math.round(Math.sqrt(Math.max(0, radius * radius - dz * dz)))
    if (half < 1) continue
    block(slices, tire.rubber, left, axle - half, width, half * 2, z, z + 1)
    // Tread across the top and the round tire wall facing outward.
    if (tire.tread) for (let y = axle - half + 1; y < axle + half; y += 2) block(slices, tire.tread, left, y, width, 1, z, z + 1)
    block(slices, tire.wall, outer, axle - half, 1, half * 2, z, z + 1)
    if (Math.abs(dz) < radius * .62) {
      const rim = Math.max(1, Math.round(half * .62))
      block(slices, tire.rim, outer, axle - rim, 1, rim * 2, z, z + 1)
      if (Math.abs(dz) < 1) block(slices, '#2a3a46', outer, axle - 1, 1, 2, z, z + 1)
    }
    if (build.tires === 'spike' && z % 2 === 0) {
      block(slices, tire.tread!, left + 1, axle - half - 1, width - 2, 1, z, z + 1)
      block(slices, tire.tread!, left + 1, axle + half, width - 2, 1, z, z + 1)
    }
  }
}

function roller(slices: Slices, build: Build, x: number, y: number) {
  const part = ROLLERS[build.rollers] ?? ROLLERS.standard
  block(slices, '#3d5260', x - 1, y - 1, 2, 2, 3, part.tiers[part.tiers.length - 1][1] + 1)
  for (const [from, to] of part.tiers) {
    for (let z = from; z < to; z++) {
      disc(slices, '#1d2f3c', x, y, part.radius + .5, z)
      disc(slices, z === to - 1 ? shade(part.color, 30) : z === from ? shade(part.color, -40) : part.color, x, y, part.radius, z)
    }
    disc(slices, '#47717f', x, y, 1, to - 1)
    if (build.rollers === 'gold') block(slices, '#fffbe0', x - 1, y - 2, 1, 1, to - 1, to)
  }
}

function motor(slices: Slices, build: Build) {
  const part = MOTORS[build.motor] ?? MOTORS.balance
  const big = part.big ? 1 : 0
  const x = -5 - big, y = 13 - big, width = 10 + big * 2, length = 9 + big * 2
  block(slices, '#1c2c39', x - 1, y - 1, width + 2, length + 2, 4, 5)
  block(slices, z => z === 8 + big ? shade(part.color, 32) : z < 6 ? shade(part.color, -38) : part.color, x, y, width, length, 4, 9 + big)
  block(slices, part.stripe, x, y + 3, width, 2, 8 + big, 9 + big)
  block(slices, '#dcc572', -1, y + length, 2, 2, 5, 7)
  if (build.motor === 'eco') {
    block(slices, '#3f9a52', -1, y + 1, 3, 2, 9, 10)
    block(slices, '#7fd38a', 0, y + 2, 2, 3, 9, 10)
  }
  if (build.motor === 'dash' || build.motor === 'rocket') {
    // Exhaust flames make the faster motors read at a glance.
    const flame = build.motor === 'rocket' ? 5 : 3
    block(slices, '#f07a43', -3, y + length, 6, flame, 5, 8)
    block(slices, '#ffd56b', -2, y + length, 4, flame - 1, 6, 8)
    block(slices, '#fff3c0', -1, y + length, 2, flame - 2, 6, 7)
  }
}

function body(slices: Slices, build: Build) {
  const color = carColor(build)
  const tone = (h: number, top: number) => shade(color, Math.round(-46 + 64 * Math.min(1, h / top)))
  const outline = '#1b2d3d'
  const glass = (z: number, points: number[], top: number) => slab(slices, z, z === top ? '#8fd0dc' : '#3c6d7d', points)
  if (build.body === 'buggy') {
    for (let h = 0; h <= 5; h++) {
      const z = 4 + h
      if (h === 0) slab(slices, z, outline, [-10, -24, 10, -24, 11, -22, 11, 13, -11, 13, -11, -22])
      else slab(slices, z, tone(h, 9), [-8, -23, 8, -23, 10, -21, 10, 12, -10, 12, -10, -21])
    }
    for (const axle of AXLES) for (const side of [-1, 1]) {
      const x = side < 0 ? -20 : 11
      block(slices, z => tone(z - 4, 9), x, axle - 7, 9, 14, 9, 11)
      block(slices, shade(color, 28), x, axle - 7, 9, 2, 11, 12)
    }
    for (let h = 0; h < 4; h++) {
      const z = 10 + h
      if (h < 3) glass(z, [-6, -10, 6, -10, 7, -8, 7, 6, -7, 6, -7, -8], 12)
      else slab(slices, z, tone(9, 9), [-7, -9, 7, -9, 7, 6, -7, 6])
    }
    block(slices, '#2b3d4a', -8, 7, 16, 2, 10, 15)
    block(slices, '#ffe8a8', -9, -24, 3, 2, 7, 9)
    block(slices, '#ffe8a8', 6, -24, 3, 2, 7, 9)
  } else if (build.body === 'truck') {
    for (let h = 0; h <= 10; h++) {
      const z = 4 + h
      slab(slices, z, h === 0 ? outline : tone(h, 10), [-11, -25, 11, -25, 12, -23, 12, -5, -12, -5, -12, -23])
      if (h >= 6 && h <= 9) slab(slices, z, '#3c6d7d', [-10, -26, 10, -26, 10, -24, -10, -24])
    }
    slab(slices, 14, shade(color, 30), [-10, -24, 10, -24, 11, -22, 11, -6, -11, -6, -11, -22])
    block(slices, '#fff3c7', -9, -26, 4, 1, 6, 8)
    block(slices, '#fff3c7', 5, -26, 4, 1, 6, 8)
    block(slices, '#2b3d4a', -5, -27, 10, 1, 5, 7)
    for (let h = 0; h <= 4; h++) {
      const z = 4 + h
      slab(slices, z, h === 0 ? outline : tone(h + 3, 10), [-12, -5, 12, -5, 12, 12, -12, 12])
    }
    // Open cargo bed with a lighter rim, so it reads as a pickup from above.
    slab(slices, 8, shade(color, -60), [-10, -3, 10, -3, 10, 10, -10, 10])
    for (const x of [-12, 10]) block(slices, shade(color, 26), x, -5, 2, 17, 9, 10)
    block(slices, shade(color, 26), -12, 10, 24, 2, 9, 10)
  } else {
    // The three low racers share a wedge, then differ by nose, fin and wing.
    const shark = build.body === 'shark'
    const wing = build.body === 'wing'
    const top = shark ? 6 : wing ? 4 : 5
    for (let h = 0; h <= top; h++) {
      const z = 4 + h
      const nose = shark ? -30 + h * 2 : -27 + h * 3
      const half = Math.max(4, (shark ? 10 : 11) - Math.round(h * .9))
      const rear = 12 - Math.max(0, h - 3) * 3
      const points = shark
        ? [0, nose, half, nose + 14, half, rear, -half, rear, -half, nose + 14]
        : [-2, nose, 2, nose, half, nose + 9, half, rear, -half, rear, -half, nose + 9]
      slab(slices, z, h === 0 ? outline : tone(h, top), points)
    }
    const canopyTop = 4 + top + 2
    for (let z = 4 + top - 1; z <= canopyTop; z++) {
      const shrink = z - (4 + top - 1)
      glass(z, [-4 + shrink, -7 + shrink, 4 - shrink, -7 + shrink, 5 - shrink, -3, 5 - shrink, 4 - shrink, -5 + shrink, 4 - shrink, -5 + shrink, -3], canopyTop)
    }
    // A bright racing stripe and headlights on top.
    for (let z = 5; z <= 4 + top; z++) block(slices, shade('#fff4d8', -(4 + top - z) * 18), -1, shark ? -26 + (z - 4) * 2 : -24 + (z - 4) * 3, 2, 3, z, z + 1)
    block(slices, '#fff3c7', -7, -18, 2, 2, 6, 7)
    block(slices, '#fff3c7', 5, -18, 2, 2, 6, 7)
    if (shark) {
      for (let z = 4 + top + 1; z < 4 + top + 8; z++) {
        const rise = z - (4 + top + 1)
        block(slices, z % 2 ? shade(color, -20) : color, -1, 2 + rise, 2, 8 - rise, z, z + 1)
      }
      for (const x of [-8, 6]) for (const y of [-6, -3, 0]) block(slices, '#22394a', x, y, 2, 1, 4 + top - 2, 4 + top - 1)
      block(slices, '#fff9ec', -4, -26, 1, 2, 5, 6)
      block(slices, '#fff9ec', 3, -26, 1, 2, 5, 6)
    }
    if (wing) {
      for (const x of [-6, 5]) block(slices, '#2b3d4a', x, 17, 1, 2, 9, 13)
      for (let z = 13; z <= 14; z++) slab(slices, z, z === 14 ? shade(color, 34) : shade(color, -24), [-17, 14, 17, 14, 18, 16, 18, 21, -18, 21, -17, 16])
      for (const x of [-18, 17]) block(slices, shade(color, -40), x, 13, 2, 9, 11, 15)
    }
  }
}

function buildSlices(build: Build): HTMLCanvasElement[] {
  const canvases = Array.from({ length: SLICE_COUNT }, () => {
    const canvas = document.createElement('canvas')
    canvas.width = SLICE_WIDTH
    canvas.height = SLICE_LENGTH
    return canvas
  })
  const slices = canvases.map(canvas => canvas.getContext('2d')).filter((g): g is Context => g !== null)
  if (slices.length !== SLICE_COUNT) return canvases
  // Chassis plate, axles and bumpers carry everything else.
  block(slices, '#1f2e3b', -11, -24, 22, 48, 2, 3)
  block(slices, '#43586a', -11, -24, 22, 48, 3, 4)
  const tire = TIRES[build.tires] ?? TIRES.normal
  for (const axle of AXLES) block(slices, '#8aa0a6', -14, axle - 1, 28, 2, tire.radius - 1, tire.radius)
  for (const y of [-28, 23]) {
    block(slices, '#22323f', -18, y, 36, 5, 3, 4)
    block(slices, '#5d7480', -18, y, 36, 5, 4, 5)
    block(slices, '#9fb3b4', -16, y + 2, 32, 1, 4, 5)
  }
  for (const axle of AXLES) {
    wheel(slices, build, -13, axle, -1)
    wheel(slices, build, 13, axle, 1)
  }
  motor(slices, build)
  body(slices, build)
  for (const x of [-20, 20]) for (const y of [-26, 26]) roller(slices, build, x, y)
  return canvases
}

function carSlices(build: Build) {
  const key = [build.body, build.motor, build.tires, build.rollers, build.color].join(':')
  const cached = sprites.get(key)
  if (cached) return cached
  const slices = buildSlices(build)
  if (sprites.size >= 64) sprites.delete(sprites.keys().next().value as string)
  sprites.set(key, slices)
  return slices
}

type View = { scale: number; angle: number; squash?: number; height?: number; lift?: number; shadow?: boolean }

/** Screen offset of a point on the model, relative to the car's ground position. */
function project(view: View, x: number, y: number, z: number) {
  const squash = view.squash ?? 1
  const cos = Math.cos(view.angle), sin = Math.sin(view.angle)
  return {
    x: (x * cos - y * sin) * view.scale,
    y: (x * sin + y * cos) * view.scale * squash - z * (view.height ?? view.scale * .5) - (view.lift ?? 0),
  }
}

function car(g: Context, build: Build, x: number, y: number, view: View) {
  const squash = view.squash ?? 1
  const height = view.height ?? view.scale * .5
  const lift = view.lift ?? 0
  if (view.shadow !== false) {
    g.save()
    g.translate(Math.round(x + view.scale * 2), Math.round(y + view.scale * 2))
    g.scale(1, squash)
    g.rotate(view.angle)
    g.globalAlpha = lift > 0 ? .16 : .26
    oval(g, '#142836', -21 * view.scale, -29 * view.scale, 42 * view.scale, 58 * view.scale)
    g.restore()
  }
  const slices = carSlices(build)
  const repeats = Math.max(1, Math.ceil(height))
  for (let z = 0; z < slices.length; z++) {
    for (let step = 0; step < repeats; step++) {
      g.save()
      g.translate(Math.round(x), Math.round(y - lift - z * height - step * height / repeats))
      g.scale(1, squash)
      g.rotate(view.angle)
      g.drawImage(slices[z], -SLICE_WIDTH / 2 * view.scale, -SLICE_LENGTH / 2 * view.scale, SLICE_WIDTH * view.scale, SLICE_LENGTH * view.scale)
      g.restore()
    }
  }
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

/** Showroom angle: the nose points right and slightly toward the viewer. */
const SHOWROOM_ANGLE = 2.1
const SHOWROOM_SQUASH = .62
/** Where each part sits on the model, for close-ups and the garage pointer. */
const FOCUS: Record<PartCategory, [number, number, number]> = {
  body: [0, -4, 8], motor: [0, 17, 7], tires: [16, -15, 5], rollers: [20, -26, 5],
}

function turntable(g: Context, x: number, y: number, width: number, height: number) {
  oval(g, '#203a43', x - width / 2, y - height / 2 + 10, width, height)
  oval(g, '#5d8b86', x - width / 2, y - height / 2, width, height)
  oval(g, '#6f9d95', x - width / 2 + 10, y - height / 2 + 5, width - 20, height - 12)
  oval(g, '#7aaa9f', x - width / 4, y - height / 4, width / 2, height / 2)
  for (let i = 0; i < 12; i++) {
    const angle = i * Math.PI / 6
    rect(g, '#93bfb1', x + Math.cos(angle) * width * .4, y + Math.sin(angle) * height * .38, 4, 2)
  }
}

/** The garage is a big turntable showroom for the assembled machine. */
export function drawGarage(canvas: HTMLCanvasElement, build: Build, selected: PartCategory = 'body') {
  const g = setup(canvas, 640, 420)
  if (!g) return
  rect(g, '#365e63', 0, 0, 640, 420)
  rect(g, '#426d70', 0, 0, 640, 150)
  for (let x = 14; x < 640; x += 16) for (let y = 12; y < 140; y += 16) rect(g, '#3a6467', x, y, 2, 2)
  rect(g, '#27474f', 0, 146, 640, 10)
  rect(g, '#f3d9aa', 0, 150, 640, 4)
  rect(g, '#d4b082', 0, 156, 640, 264)
  for (let y = 170; y < 420; y += 42) {
    rect(g, '#c5a075', 0, y + 24, 640, 2)
    rect(g, '#e0bd8f', 0, y + 27, 640, 1)
    for (let x = 8; x < 640; x += 84) rect(g, '#cea97b', x + random(x + y) * 30, y + 10, 22, 1)
  }
  // Spotlights over the turntable.
  for (const x of [170, 470]) {
    rect(g, '#22383f', x - 2, 0, 4, 18)
    polygon(g, '#2b444b', [x - 16, 18, x + 16, 18, x + 12, 34, x - 12, 34])
    rect(g, '#fff0bd', x - 10, 32, 20, 4)
  }
  g.globalAlpha = .14
  polygon(g, '#fff3cf', [150, 36, 190, 36, 300, 330, 60, 330])
  polygon(g, '#fff3cf', [450, 36, 490, 36, 580, 330, 340, 330])
  g.globalAlpha = 1
  wrench(g, 38, 60, -0.12, 1.2)
  wrench(g, 600, 66, 0.3, 1)
  rect(g, '#e8c792', 230, 14, 180, 34)
  rect(g, '#fff0c8', 233, 17, 174, 28)
  text(g, 'MINI 4WD LAB', 320, 31, 16, INK, 'center')
  turntable(g, 320, 300, 520, 150)

  const view: View = { scale: 6.4, angle: SHOWROOM_ANGLE, squash: SHOWROOM_SQUASH, height: 4.6 }
  const carX = 314, carY = 300
  car(g, build, carX, carY, view)

  // A pointer to the part currently being chosen.
  const [fx, fy, fz] = FOCUS[selected]
  const point = project(view, fx, fy, fz)
  const px = carX + point.x, py = carY + point.y
  const part = PARTS[selected].find((item) => item.id === build[selected])
  const label = part?.name ?? ''
  const labelX = Math.max(80, Math.min(560, px + (px < 320 ? -110 : 110)))
  const labelY = Math.max(76, Math.min(380, py - 74))
  g.strokeStyle = '#fff4cf'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(Math.round(px), Math.round(py))
  g.lineTo(Math.round(labelX), Math.round(labelY + 16))
  g.stroke()
  for (const [size, color] of [[18, '#fff4cf'], [12, '#e8784f'], [6, '#fff4cf']] as const) oval(g, color, px - size / 2, py - size / 2, size, size)
  g.font = '800 22px "Trebuchet MS", sans-serif'
  const width = Math.max(96, g.measureText(label).width + 32)
  rect(g, '#1d3340', labelX - width / 2 + 3, labelY - 17, width, 38)
  rect(g, '#fff0c6', labelX - width / 2, labelY - 20, width, 38)
  rect(g, '#e8784f', labelX - width / 2, labelY - 20, 5, 38)
  text(g, label, labelX + 2, labelY - 1, 22, INK, 'center')
}

const PREVIEW_ZOOM: Record<PartCategory, number> = { body: 2.1, motor: 4.2, tires: 4, rollers: 5 }

/** A close-up of one part on the assembled car, for the part cards. */
export function drawPartPreview(canvas: HTMLCanvasElement, build: Build, category: PartCategory) {
  const g = setup(canvas, 160, 110)
  if (!g) return
  rect(g, '#2a4a52', 0, 0, 160, 110)
  oval(g, '#335a60', 4, 46, 152, 60)
  const scale = PREVIEW_ZOOM[category]
  const view: View = { scale, angle: SHOWROOM_ANGLE, squash: SHOWROOM_SQUASH, height: scale * .75 }
  const [fx, fy, fz] = FOCUS[category]
  const point = project(view, fx, fy, fz)
  car(g, build, 80 - point.x, (category === 'body' ? 64 : 58) - point.y, view)
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
        if (trackDistance(course, x + width * col / 6, y + height * row / 4) < EDGE + 12) fits = false
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
  // The player's machine spins on a little turntable, showing off its parts in 3D.
  const scale = Math.min((width - 16) / 58, (height - 28) / 44)
  const spin = reducedMotion ? SHOWROOM_ANGLE : SHOWROOM_ANGLE + race.elapsed * 1.2
  car(g, player.build, x + width / 2, y + height - 14, { scale, angle: spin, squash: SHOWROOM_SQUASH, height: scale * .7, shadow: false })
  rect(g, '#89cfb0', x + width - 10, y + height - 4, 3, 2)
  rect(g, '#b29e76', x + 7, y + height - 4, width - 26, 1)
  for (const [xx, yy] of [[x + 2, y + 7], [x + width - 4, y + 7], [x + 2, y + height - 5]]) screw(g, xx, yy, 1)
}

type Along = number | ((distance: number) => number)

/** Strokes a whole lap at a sideways offset, or only the stretch between two distances along it. */
function trackPath(g: Context, course: Course, lane: Along, color: string, width: number, shiftY: Along = 0, from = 0, to = course.length) {
  const whole = to - from >= course.length
  const steps = Math.max(2, Math.ceil(300 * (to - from) / course.length))
  g.beginPath()
  let lastX = 0, lastY = 0
  for (let index = 0; index <= steps; index++) {
    const distance = from + (to - from) * index / steps
    const point = sampleTrack(course, distance)
    const offset = typeof lane === 'number' ? lane : lane(distance)
    const x = Math.round(point.x - Math.sin(point.angle) * offset)
    const y = Math.round(point.y + Math.cos(point.angle) * offset + (typeof shiftY === 'number' ? shiftY : shiftY(distance)))
    // Beside a tight bend an offset line can run backwards and knot itself; wait until it moves forward again.
    if (index > 0 && index < steps && (x - lastX) * Math.cos(point.angle) + (y - lastY) * Math.sin(point.angle) <= 0) continue
    if (index === 0) g.moveTo(x, y)
    else g.lineTo(x, y)
    lastX = x
    lastY = y
  }
  if (whole) g.closePath()
  g.strokeStyle = color
  g.lineWidth = width
  g.lineJoin = 'round'
  g.lineCap = whole ? 'round' : 'butt'
  g.stroke()
}

/** Distances along the lap where the lane changer starts and ends, and its eased progress between them. */
function laneChanger(course: Course) {
  const from = course.laneChange.start * course.length
  const to = course.laneChange.end * course.length
  const ease = (distance: number) => {
    const t = Math.max(0, Math.min(1, (distance - from) / (to - from)))
    return { t, eased: t * t * (3 - 2 * t) }
  }
  return { from, to, ease }
}

/**
 * The raised crossover of a real three-lane circuit: the outside lane climbs over the
 * others and lands on the inside. It is drawn above the cars passing underneath.
 */
function bridgeLayer(course: Course) {
  const cached = bridges.get(course)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const g = canvas.getContext('2d')
  if (!g) return canvas
  const night = course.theme === 'night'
  const { from, to, ease } = laneChanger(course)
  const deck = (side: number) => (distance: number) => LANES[0] + (LANES[2] - LANES[0]) * ease(distance).eased + side
  const height = (extra: number) => (distance: number) => -Math.sin(ease(distance).t * Math.PI) * BRIDGE_HEIGHT + extra
  // Pillars hold the deck up where it passes over the lower lanes.
  for (const t of [.3, .5, .7]) {
    const distance = from + (to - from) * t
    const point = sampleTrack(course, distance)
    const offset = deck(0)(distance)
    const x = point.x - Math.sin(point.angle) * offset
    const y = point.y + Math.cos(point.angle) * offset
    const top = height(0)(distance)
    rect(g, '#2b3f4a', x - 4, y + top, 8, -top + 2)
    rect(g, night ? '#7b8fa3' : '#9cb2b0', x - 3, y + top, 3, -top)
  }
  for (let shift = 6; shift > 0; shift--) trackPath(g, course, deck(0), shift > 3 ? '#2c3f4b' : '#36505c', LANE_GAP + 8, height(shift), from, to)
  trackPath(g, course, deck(0), '#3b515b', LANE_GAP + 8, height(0), from, to)
  trackPath(g, course, deck(0), night ? '#6c7ba1' : '#a5c5cf', LANE_GAP - 3, height(0), from, to)
  for (const side of [-LANE_GAP / 2, LANE_GAP / 2]) {
    for (let shift = 0; shift < 4; shift++) trackPath(g, course, deck(side), shift ? '#3f5864' : '#2f4550', 5, height(-shift), from, to)
    trackPath(g, course, deck(side), night ? '#adc6c3' : '#fff1cf', 3, height(-5), from, to)
    // Red and white guard stripes, like the bridge on a real lane changer.
    const stripes = Math.ceil((to - from) / 9)
    for (let stripe = 0; stripe < stripes; stripe += 2) {
      trackPath(g, course, deck(side), '#e5574f', 3, height(-5), from + (to - from) * stripe / stripes, from + (to - from) * (stripe + 1) / stripes)
    }
  }
  bridges.set(course, canvas)
  return canvas
}

function checkeredFlag(g: Context, x: number, y: number, scale = 1) {
  rect(g, '#375360', x, y, 2 * scale, 29 * scale)
  rect(g, '#f2ebc9', x + 2 * scale, y, 18 * scale, 14 * scale)
  for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) if ((row + col) % 2 === 0) rect(g, '#2d4651', x + (2 + col * 4.5) * scale, y + row * 4.5 * scale, 4.5 * scale, 4.5 * scale)
}

function podium(g: Context, course: Course) {
  if (trackDistance(course, 360, 225) <= EDGE + 25) return
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
      if (trackDistance(course, x, y) > EDGE + 22) {
        rect(g, i % 3 ? '#779795' : '#c6d7ad', x, y, 2, 2)
        if (i % 4 === 0) rect(g, '#627c80', x - 2, y + 1, 6, 1)
      }
    }
  }
  // Small diorama trees keep away from every track route, including different hairpins.
  for (let index = 0; index < 36; index++) {
    const x = 22 + random(index + 700) * 676, y = 48 + random(index + 1500) * 370
    if (trackDistance(course, x, y - 18) > EDGE + 37 && !(x > 245 && x < 475 && y > 175 && y < 270)) {
      tree(g, x, y, 0.55 + random(index + 66) * 0.35, palette, course.theme === 'forest')
    }
  }
  for (const [x, y] of [[29, 79], [686, 77], [28, 350], [691, 345]]) {
    if (course.theme === 'coast') palm(g, x, y, x > WIDTH / 2 ? -1 : 1)
    else if (!night) tree(g, x, y, 0.95, palette, course.theme === 'forest')
  }
  for (let index = 0; index < 45; index++) {
    const x = 35 + random(index + 2600) * 650, y = 35 + random(index + 3600) * 350
    if (trackDistance(course, x, y) > EDGE + 21 && !(x > 288 && x < 432 && y > 157 && y < 248)) flowerbed(g, x, y, palette, night)
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
  trackPath(g, course, 0, night ? '#1e2c40' : '#688977', EDGE * 2 + 17, 10)
  // The raised plastic track has a visible side wall below its running surface.
  for (let shift = 7; shift > 0; shift--) trackPath(g, course, 0, shift > 3 ? '#2c3f4b' : '#36505c', EDGE * 2 + 11, shift)
  trackPath(g, course, 0, '#3b515b', EDGE * 2 + 11)
  trackPath(g, course, 0, '#f6e7c5', EDGE * 2 + 6)
  trackPath(g, course, 0, '#859b9c', EDGE * 2)
  const surfaces = night ? ['#6c7ba1', '#9f8a9d', '#6c999a'] : ['#a5c5cf', '#e8c4a9', '#a9cabe']
  const changer = laneChanger(course)
  LANES.forEach((lane, index) => trackPath(g, course, lane, surfaces[index], LANE_GAP - 3))
  // Under the bridge the middle and inside lanes bend outward, making room for the car landing inside.
  const stepOut = (lane: number) => (distance: number) => lane - LANE_GAP * changer.ease(distance).eased
  trackPath(g, course, 0, '#859b9c', EDGE * 2, 0, changer.from, changer.to)
  trackPath(g, course, stepOut(LANES[1]), surfaces[1], LANE_GAP - 3, 0, changer.from, changer.to)
  trackPath(g, course, stepOut(LANES[2]), surfaces[2], LANE_GAP - 3, 0, changer.from, changer.to)
  // Molded sectional joints every few centimetres of the miniature circuit.
  for (let distance = 0; distance < course.length; distance += 41) {
    const point = sampleTrack(course, distance)
    g.save()
    g.translate(Math.round(point.x), Math.round(point.y))
    g.rotate(point.angle)
    rect(g, night ? '#a0abb1' : '#e7e4ce', -1, 1 - EDGE, 1, EDGE * 2 - 2)
    rect(g, night ? '#526779' : '#8ba3a4', 0, 1 - EDGE, 1, EDGE * 2 - 2)
    for (const lane of LANES) {
      rect(g, '#6c888c', 1, lane - 8, 2, 2)
      rect(g, '#e5e5c9', 1, lane + 7, 2, 2)
    }
    g.restore()
  }
  const wall = (lane: Along, height: number, from = 0, to = course.length) => {
    const lip = typeof lane === 'number' ? lane + 1.5 : (distance: number) => lane(distance) + 1.5
    for (let shift = 0; shift < height; shift++) trackPath(g, course, lane, shift ? '#3f5864' : '#2f4550', 5, -shift, from, to)
    trackPath(g, course, lane, night ? '#adc6c3' : '#fff1cf', 3, -height - 1, from, to)
    trackPath(g, course, lip, night ? '#738ba0' : '#ccd9c7', 1, -height, from, to)
  }
  // Outer guard walls stand taller than the lane dividers.
  for (const lane of [-EDGE, EDGE]) wall(lane, 5)
  for (const lane of [-LANE_GAP / 2, LANE_GAP / 2]) wall(lane, 2, changer.to, changer.from + course.length)
  for (const lane of [-LANE_GAP / 2, LANE_GAP / 2, EDGE]) wall(stepOut(lane), 2, changer.from, changer.to)
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
  for (let y = 2 - EDGE; y < EDGE - 1; y += 6) for (let x = -6; x < 7; x += 6) rect(g, ((y + EDGE - 2) / 6 + (x + 6) / 6) % 2 ? '#fbefd0' : '#344b57', x, y, 6, 6)
  for (const lane of LANES) {
    polygon(g, '#fdf1cd', [23, lane - 5, 31, lane, 23, lane + 5, 25, lane, 23, lane - 5])
    rect(g, '#597b85', -37, lane - 10, 1, 20)
    rect(g, '#597b85', -37, lane - 10, 17, 1)
    rect(g, '#597b85', -37, lane + 10, 17, 1)
  }
  g.restore()

  rect(g, night ? '#283c51' : '#315f63', 260, 401, 200, 34)
  rect(g, '#e9d6a0', 263, 404, 194, 2)
  text(g, 'MINI 4WD GRAND PRIX', 360, 416, 11, '#fff0c5', 'center')
  text(g, '01  /  02  /  03', 360, 428, 7, '#b3d1c1', 'center')
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
  g.drawImage(bridgeLayer(course), 0, 0)
  podium(g, course)
}

/** Screen position of a car's lane at a distance, including the climb over the lane-change bridge. */
function lanePoint(course: Course, racer: Racer, distance: number, side = 0) {
  const point = sampleTrack(course, distance)
  const { offset, bridge, slope } = lanePosition(course, racer.startLane, distance)
  return {
    x: point.x - Math.sin(point.angle) * (offset + side),
    y: point.y + Math.cos(point.angle) * (offset + side) - bridge * BRIDGE_HEIGHT,
    angle: point.angle + Math.atan(slope),
    bridge,
  }
}

/** Cheer power: a long flame trail and speed lines behind the boosted car. */
function boostBehind(g: Context, race: RaceState, racer: Racer, reducedMotion: boolean) {
  const flicker = reducedMotion ? 0 : race.elapsed * 30
  const strength = Math.min(1, racer.boost / .4)
  for (let i = 0; i < 10; i++) {
    const trail = lanePoint(race.course, racer, racer.distance - 22 - i * 6)
    const size = Math.max(2, Math.round((9 - i * .7) * strength + Math.sin(flicker + i) * 1.5))
    rect(g, ['#fff5c2', '#ffd56b', '#f59a4a', '#e8644e'][Math.min(3, Math.floor(i / 2.5))], trail.x - size / 2, trail.y - size / 2, size, size)
  }
  for (const side of [-13, 13]) for (let i = 0; i < 3; i++) {
    const trail = lanePoint(race.course, racer, racer.distance - 30 - i * 14 - (flicker % 14), side)
    rect(g, '#fffbe6', trail.x, trail.y, 6, 2)
  }
}

/** A burst when the cheer arrives, then sparkles that orbit the car while the boost lasts. */
function boostAround(g: Context, race: RaceState, x: number, y: number, boost: number, reducedMotion: boolean) {
  const age = CHEER_BOOST_SECONDS - boost
  if (age < .45 && !reducedMotion) {
    const radius = 14 + age * 110
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6
      rect(g, i % 2 ? '#fff0b4' : '#ff9b5c', x + Math.cos(angle) * radius - 3, y + Math.sin(angle) * radius - 3, 6, 6)
    }
  }
  const step = reducedMotion ? 0 : race.elapsed * 6
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + step
    const radius = 26 + Math.sin(step * 2 + i) * 3
    rect(g, i % 2 ? '#fff6c8' : '#ffc45e', x + Math.cos(angle) * radius - 2, y + Math.sin(angle) * radius - 2, 4, 4)
  }
}

export function drawRace(canvas: HTMLCanvasElement, race: RaceState, options: { reducedMotion?: boolean } = {}) {
  const g = setup(canvas, WIDTH, HEIGHT)
  if (!g) return
  g.drawImage(scene(race.course), 0, 0)
  liveMonitor(g, race, options.reducedMotion ?? false)
  const reducedMotion = options.reducedMotion ?? false
  const placed = race.racers.map(racer => ({ racer, ...lanePoint(race.course, racer, racer.distance) }))
  // Cars under the bridge go first, then the bridge, then the car crossing over it; the player stays on top of its group.
  const order = (on: boolean) => placed.filter(item => (item.bridge > 0) === on).sort((a, b) => Number(a.racer.id === 0) - Number(b.racer.id === 0))
  let marker: { x: number; y: number; boosted: boolean; boost: number } | null = null
  for (const [index, group] of [order(false), order(true)].entries()) {
    if (index === 1) g.drawImage(bridgeLayer(race.course), 0, 0)
    for (const { racer, x, y, angle } of group) {
      const fraction = ((racer.distance % race.course.length) + race.course.length) % race.course.length / race.course.length
      const jump = race.course.zones.find((zone) => zone.kind === 'jump' && fraction >= zone.start && fraction <= zone.end)
      const lift = jump && !reducedMotion ? Math.sin((fraction - jump.start) / (jump.end - jump.start) * Math.PI) * 8 : 0
      const wobble = reducedMotion ? 0 : Math.sin(race.clock * 29 + racer.id) * Math.min(0.14, racer.wobble * 0.08)
      if (racer.speed > 12 && race.phase === 'racing' && !reducedMotion) {
        for (let i = 0; i < 3; i++) {
          const trail = lanePoint(race.course, racer, racer.distance - 25 - i * 8)
          rect(g, i % 2 ? '#fff0c1' : '#dce4cb', trail.x, trail.y, 3 - Math.floor(i / 2), 2)
        }
      }
      const boosted = racer.boost > 0 && race.phase === 'racing'
      if (boosted) boostBehind(g, race, racer, reducedMotion)
      car(g, racer.build, x, y, { scale: .7, angle: angle + Math.PI / 2 + wobble, height: .42, lift })
      if (racer.id === 0) marker = { x, y: y - lift, boosted, boost: racer.boost }
    }
  }
  if (marker) {
    // The ★ stays visible even while the player's car passes under the bridge.
    const { x, y, boosted, boost } = marker
    const markerY = y - 40
    const color = boosted ? '#ffb35c' : '#ffedab'
    rect(g, '#263d4b', x - 23, markerY - 10, 46, 16)
    rect(g, color, x - 21, markerY - 9, 42, 13)
    text(g, '★', x, markerY - 2, 14, '#283f4c', 'center')
    polygon(g, '#263d4b', [x - 6, markerY + 5, x + 6, markerY + 5, x, markerY + 13])
    polygon(g, color, [x - 4, markerY + 5, x + 4, markerY + 5, x, markerY + 10])
    if (boosted) boostAround(g, race, x, y, boost, reducedMotion)
  }
  if (race.phase === 'finished' && !options.reducedMotion) {
    for (let index = 0; index < 55; index++) {
      const x = random(index + 501) * WIDTH
      const y = (random(index + 1001) * HEIGHT + race.clock * (12 + index % 4 * 4)) % HEIGHT
      rect(g, ['#f3cc77', '#e99175', '#b3d7c0', '#fcf0bc'][index % 4], x, y, index % 2 ? 4 : 2, index % 2 ? 2 : 5)
    }
  }
}
