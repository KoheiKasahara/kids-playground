import { islandAt, sampleTrack } from './courses'
import { clearSpriteCache, itemSprite, kartSprite, scenerySprite } from './sprites'
import type { SceneryKind } from './sprites'
import type { Course, CourseId, ItemId, RaceState, Racer } from './types'

const WIDTH = 480, HEIGHT = 270, HORIZON = 91, FOCAL = 235, CAMERA_HEIGHT = 122, CAMERA_BACK = 230
type Ctx = CanvasRenderingContext2D
type Projection = { x: number; y: number; z: number; scale: number }
type Landmark = { distance: number; lane: number; kind: SceneryKind; size: number; variant: number }
type Sprite = { image: HTMLCanvasElement; x: number; y: number; z: number; width: number; height: number; shadow?: number; alpha?: number; flip?: boolean; racer?: Racer }
type Palette = { sky: string[]; ground: string[]; road: string[]; edge: string[]; line: string; haze: string; rough: string[] }
const PALETTES: Record<CourseId, Palette> = {
  forest: { sky: ['#7cbbbd', '#9dceca', '#c1dfcd', '#e6eacb'], ground: ['#75a56b', '#6b9a60', '#67905b'], road: ['#d2b88c', '#d8bf95', '#d3b98e'], edge: ['#f3e3b6', '#9eab77'], line: '#eddbaf', haze: '#d5dfba', rough: ['#9c7a52', '#876846', '#b8966a'] },
  coast: { sky: ['#a080a3', '#cb94a1', '#e8ad95', '#f7d0a1'], ground: ['#deb487', '#d5a77b', '#cb9b71'], road: ['#f0d3a5', '#f3dcb3', '#eecfa2'], edge: ['#fff0c9', '#6eb5b7'], line: '#ffeac5', haze: '#ebc5b0', rough: ['#8fc9c4', '#79b5b6', '#e3f4ea'] },
  crystal: { sky: ['#252840', '#343c58', '#4c647e', '#7394a1'], ground: ['#61758d', '#586981', '#4b5c76'], road: ['#a4bbc7', '#afc5ce', '#a5b8c9'], edge: ['#d7e7e7', '#727da8'], line: '#d0e5e4', haze: '#a7b5cd', rough: ['#76819f', '#667090', '#c9d2e8'] },
  sky: { sky: ['#292d50', '#464b77', '#7d719c', '#bd93ae'], ground: ['#a396b8', '#9182a8', '#84749b'], road: ['#e6d0c4', '#eddbcd', '#e1cbbf'], edge: ['#fff0d3', '#b887a4'], line: '#fff0d5', haze: '#d5b4cf', rough: ['#c2b1d8', '#ae9cc8', '#f6eef8'] },
}
const hash = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) }
const clamp = (x: number, low: number, high: number) => Math.max(low, Math.min(high, x))
const parallaxTiles = (offset: number, spacing: number) => Array.from({ length: Math.ceil(WIDTH / spacing) + 3 }, (_, i) => {
  const id = Math.floor(offset / spacing) + i - 1
  return { id, x: id * spacing - offset }
})
const rect = (g: Ctx, color: string, x: number, y: number, w: number, h: number) => { g.fillStyle = color; g.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h)) }
const poly = (g: Ctx, color: string, points: number[]) => {
  g.fillStyle = color; g.beginPath(); g.moveTo(Math.round(points[0]), Math.round(points[1]))
  for (let i = 2; i < points.length; i += 2) g.lineTo(Math.round(points[i]), Math.round(points[i + 1]))
  g.closePath(); g.fill()
}
const pixelOval = (g: Ctx, color: string, x: number, y: number, w: number, h: number) => {
  rect(g, color, x + w * 0.15, y, w * 0.7, h)
  rect(g, color, x, y + h * 0.25, w, h * 0.5)
}
function cloud(g: Ctx, x: number, y: number, size: number, fill: string, shadow: string) {
  const s = size
  rect(g, shadow, x + 6 * s, y + 12 * s, 40 * s, 4 * s)
  rect(g, fill, x + 8 * s, y + 6 * s, 29 * s, 7 * s)
  rect(g, fill, x + 16 * s, y, 12 * s, 7 * s)
  rect(g, fill, x + 11 * s, y + 3 * s, 23 * s, 7 * s)
  rect(g, fill, x, y + 10 * s, 50 * s, 3 * s)
  rect(g, fill, x + 35 * s, y + 7 * s, 7 * s, 4 * s)
}
function mountain(g: Ctx, x: number, base: number, height: number, width: number, color: string, light: string, snow?: string) {
  const peak = x + width * 0.48
  poly(g, color, [x, base, x + width * 0.15, base - height * 0.28, x + width * 0.28, base - height * 0.48, peak - 9, base - height + 7, peak, base - height, peak + 9, base - height + 7, x + width * 0.69, base - height * 0.51, x + width, base])
  poly(g, light, [x, base, peak, base - height, peak - 2, base - height * 0.66, peak - 15, base - height * 0.34, peak + 2, base])
  if (snow) poly(g, snow, [peak - 17, base - height + 18, peak - 8, base - height + 6, peak, base - height, peak + 10, base - height + 8, peak + 23, base - height + 27, peak + 9, base - height + 21, peak + 3, base - height + 25, peak - 3, base - height + 16, peak - 9, base - height + 22])
}
function ridge(g: Ctx, seed: number, y: number, height: number, color: string, offset: number) {
  const pts = [0, HEIGHT, 0, y]
  for (let x = -20; x <= WIDTH + 20; x += 8) pts.push(x, y - Math.floor((Math.sin((x + offset) * 0.023 + seed) * 0.35 + Math.sin((x + offset) * 0.047 + seed * 2) * 0.2 + 0.5) * height))
  pts.push(WIDTH, HEIGHT); poly(g, color, pts)
}
function distantCastle(g: Ctx, x: number, y: number, theme: CourseId) {
  const wall = theme === 'sky' ? '#dfcbd6' : '#9fbeb2', shade = theme === 'sky' ? '#b3a0bd' : '#80a79e', roof = theme === 'sky' ? '#9b91bb' : '#75989a'
  rect(g, wall, x + 13, y - 25, 50, 26); rect(g, shade, x + 44, y - 25, 20, 26)
  for (let i = 0; i < 4; i++) rect(g, wall, x + 13 + i * 13, y - 29, 8, 6)
  for (const [dx, h] of [[0, 46], [51, 56], [26, 68]]) {
    rect(g, shade, x + dx, y - h + 17, 18, h - 16); rect(g, wall, x + dx, y - h + 17, 10, h - 16)
    poly(g, roof, [x + dx - 4, y - h + 19, x + dx + 8, y - h, x + dx + 22, y - h + 19])
    rect(g, '#eee5cc', x + dx + 8, y - h - 6, 1, 8); rect(g, '#e0b8b1', x + dx + 9, y - h - 6, 9, 4)
    rect(g, roof, x + dx + 7, y - h + 26, 4, 8)
  }
  rect(g, shade, x + 31, y - 15, 12, 16); rect(g, '#c2c9c1', x + 33, y - 13, 7, 14)
}

function background(g: Ctx, course: Course, angle: number, time: number) {
  const palette = PALETTES[course.id]
  rect(g, palette.sky[3], 0, 0, WIDTH, HEIGHT)
  for (let i = 0; i < 4; i++) rect(g, palette.sky[i], 0, i * 25, WIDTH, 26)
  // Sparse ordered dithering joins the four sky bands without a blurry gradient.
  for (let band = 1; band < 4; band++) for (let x = 0; x < WIDTH; x += 4) { rect(g, palette.sky[band - 1], x, band * 25 + 1, 2, 1); rect(g, palette.sky[band], x + 2, band * 25 - 2, 2, 1) }
  const scroll = angle * 32
  const moonX = 368 - Math.sin(angle * 0.25) * 35
  if (course.id === 'crystal') {
    // The grotto is lit from within: distant faceted crystals, a teal pool,
    // and a scalloped ceiling of stone and hanging amethyst.
    rect(g, '#789cab', 0, 82, WIDTH, 35); rect(g, '#94bcc0', 0, 100, WIDTH, 17)
    for (const { id: i, x } of parallaxTiles(scroll * 0.45, 43)) {
      const h = 23 + hash(i + 38) * 45, w = 10 + hash(i + 33) * 8
      poly(g, '#637b9b', [x - w, 106, x - w, 108 - h + 10, x, 102 - h, x + w, 108 - h + 10, x + w, 106])
      poly(g, i % 2 ? '#92b6c9' : '#acabd3', [x - w + 2, 105, x - w + 2, 109 - h + 10, x, 104 - h, x, 106])
      poly(g, '#c0d9de', [x - w + 2, 109 - h + 10, x, 104 - h, x + w - 2, 109 - h + 10, x, 112 - h + 12])
    }
    ridge(g, 4, 116, 15, '#637d97', scroll)
    const ceiling = [0, 0, WIDTH, 0, WIDTH, 83]
    for (let x = WIDTH; x >= 0; x -= 12) ceiling.push(x, 12 + Math.abs(x - WIDTH / 2) * 0.18 + hash(Math.floor(x / 12) + 90) * 15)
    poly(g, '#353951', ceiling)
    for (const { id: i, x } of parallaxTiles(scroll * 0.14, 47)) {
      const h = 28 + hash(i + 67) * 35
      poly(g, '#414960', [x, 0, x + 32, 0, x + 28, h - 18, x + 19, h, x + 10, h - 17])
      poly(g, '#56647a', [x + 7, 0, x + 16, 0, x + 20, h - 5, x + 13, h - 19])
      if (i % 3 === 0) { poly(g, '#9b90bd', [x + 26, 12, x + 38, 12, x + 38, 37, x + 32, 48, x + 26, 37]); poly(g, '#c0b3dd', [x + 27, 13, x + 32, 13, x + 32, 45, x + 27, 36]) }
    }
    for (let i = 0; i < 20; i++) {
      const x = hash(i + 111) * WIDTH, y = 55 + hash(i + 128) * 46
      rect(g, i % 3 ? '#9fccd1' : '#d1e8e6', x, y, 1, 1)
    }
  } else {
    if (course.id !== 'sky') pixelOval(g, course.id === 'coast' ? '#f6c47f' : '#f9efc8', moonX, course.id === 'coast' ? 43 : 19, course.id === 'coast' ? 39 : 29, course.id === 'coast' ? 39 : 29)
    if (course.id === 'sky') {
      poly(g, '#f1e1d1', [moonX + 18, 19, moonX + 12, 24, moonX + 10, 33, moonX + 13, 41, moonX + 20, 47, moonX + 10, 46, moonX + 3, 41, moonX, 35, moonX + 1, 27, moonX + 6, 22])
      for (let i = 0; i < 48; i++) {
        const x = (hash(i + 42) * WIDTH - scroll * 0.13 + WIDTH * 10) % WIDTH, y = 7 + hash(i + 19) * 70
        rect(g, i % 3 ? '#a9afcf' : '#f5e0c1', x, y, 1, 1)
        if (i % 11 === 0) { rect(g, '#f5e8d8', x - 1, y, 3, 1); rect(g, '#f5e8d8', x, y - 1, 1, 3) }
      }
    }
    for (const { id: i, x: startX } of parallaxTiles(scroll * 0.3, 95)) {
      const x = startX + hash(i + 15) * 30, y = 10 + hash(i + 10) * 30
      cloud(g, x, y + (course.id === 'sky' ? 28 : 0), 0.55 + hash(i + 4) * 0.5, course.id === 'sky' ? '#a99bbe' : course.id === 'coast' ? '#efd0b4' : '#eef0d9', course.id === 'sky' ? '#837fa5' : course.id === 'coast' ? '#cda5a5' : '#cde2d5')
    }
    if (course.id === 'forest') {
      for (const { id: i, x } of parallaxTiles(scroll * 0.35, 145)) mountain(g, x, 113, 47 + hash(i + 30) * 23, 170, '#93b4a4', '#acc5ad', '#d2dac3')
      distantCastle(g, 302 - Math.sin(angle * 0.3) * 22, 104, 'forest')
      ridge(g, 7, 116, 31, '#85ac92', scroll * 0.8)
      for (const { id: i, x } of parallaxTiles(scroll, 25)) {
        const y = 95 - hash(i + 20) * 10
        rect(g, '#719985', x + 10, y + 5, 13, 23); rect(g, '#719985', x + 5, y + 12, 23, 15)
        rect(g, '#90b498', x + 10, y + 5, 6, 5)
      }
      ridge(g, 1, 121, 13, '#799e79', scroll)
    } else if (course.id === 'coast') {
      rect(g, '#739fae', 0, 81, WIDTH, 45)
      rect(g, '#86b6bb', 0, 92, WIDTH, 30); rect(g, '#a6cbc4', 0, 111, WIDTH, 13)
      for (let i = 0; i < 48; i++) {
        const x = (hash(i + 210) * WIDTH + time * (i % 2 ? 1 : -1) + WIDTH * 10) % WIDTH, y = 84 + hash(i + 82) * 37
        rect(g, i % 3 ? '#b6d9cf' : '#e6dfc2', x, y, 3 + hash(i) * 14, 1)
      }
      for (let i = 0; i < 11; i++) rect(g, i % 2 ? '#efd0aa' : '#ebc69e', moonX + 16 - i * 2.5 + Math.sin(i * 2) * 5, 84 + i * 3, 12 + i * 5, 1)
      for (const { id: i, x } of parallaxTiles(scroll * 0.4, 173)) {
        mountain(g, x, 91, 21 + hash(i + 8) * 16, 96, '#8b969f', '#b0acaa')
        rect(g, '#e6c5a0', x - 3, 89, 105, 2)
      }
      const shipX = 112 - Math.sin(angle * 0.5) * 50
      rect(g, '#9c9d99', shipX + 12, 62, 1, 23); poly(g, '#eff1d9', [shipX + 10, 63, shipX + 10, 80, shipX - 1, 80])
      poly(g, '#b8a898', [shipX - 3, 83, shipX + 24, 83, shipX + 19, 87, shipX + 2, 87])
      ridge(g, 8, 135, 12, '#e5cf9f', scroll)
    } else {
      for (const { id: i, x } of parallaxTiles(scroll * 0.65, 110)) {
        cloud(g, x, 76 + hash(i + 74) * 19, 2.4, '#eee3e4', '#d0c2da')
      }
      distantCastle(g, 313 - Math.sin(angle * 0.4) * 35, 94, 'sky')
      poly(g, '#c1b1c9', [301, 94, 397, 94, 377, 110, 363, 113, 350, 126, 335, 110, 315, 108])
      poly(g, '#d9c6d6', [301, 94, 345, 94, 350, 121, 333, 108, 315, 107])
      for (const { id: i, x } of parallaxTiles(scroll, 89)) cloud(g, x, 98 + hash(i + 64) * 8, 1.7, '#f7e8e4', '#dbcddd')
      for (let i = 0; i < 3; i++) {
        const x = (74 + i * 149 - scroll * 0.3 + WIDTH * 10) % WIDTH, y = 36 + i * 9
        pixelOval(g, i % 2 ? '#d5a5b6' : '#d7bcc7', x, y, 13, 16); rect(g, '#f4d5cd', x + 4, y, 3, 14)
        rect(g, '#baa1b6', x + 4, y + 17, 5, 4)
      }
    }
  }
  rect(g, palette.ground[0], 0, 122, WIDTH, HEIGHT - 122)
  rect(g, palette.ground[1], 0, 169, WIDTH, HEIGHT - 169)
  rect(g, palette.ground[2], 0, 232, WIDTH, HEIGHT - 232)
}

function buildLandmarks(course: Course): Landmark[] {
  const result: Landmark[] = []
  const sets: Record<CourseId, SceneryKind[]> = {
    forest: ['tree', 'tree', 'fir', 'flowers', 'mushroom', 'lantern', 'stump'],
    coast: ['palm', 'palm', 'coral', 'shell', 'flowers', 'sail', 'coral'],
    crystal: ['crystal', 'crystal', 'ice', 'lantern', 'arch', 'ice', 'crystal'],
    sky: ['cloudtree', 'cloudtree', 'flowers', 'tower', 'balloon', 'banner', 'cloudtree'],
  }
  const kinds = sets[course.id]
  for (let i = 0; i < Math.floor(course.length / 58); i++) {
    const width = sampleTrack(course, i * 58).width
    for (const side of [-1, 1]) {
      const seed = i * 31 + side * 13 + 77
      const kind = kinds[Math.floor(hash(seed) * kinds.length)]
      const distance = i * 58 + hash(seed + 2) * 26
      const near = kind === 'flowers' || kind === 'shell' || kind === 'stump'
      result.push({ distance, lane: side * (width + (near ? 17 : 45) + hash(seed + 3) * (near ? 35 : 120)), kind, size: near ? 0.45 : 0.9 + hash(seed + 8) * 0.4, variant: i % 3 })
      if (i % 3 === 0) result.push({ distance: distance + 20, lane: side * (width + 240 + hash(seed + 9) * 200), kind: kinds[i % 2], size: 1.3 + hash(seed) * 0.4, variant: i % 3 })
    }
    const point = sampleTrack(course, i * 58)
    if (Math.abs(point.curve) > 0.022 && i % 3 === 0) result.push({ distance: i * 58, lane: -Math.sign(point.curve) * (width + 22), kind: 'sign', size: 0.68, variant: point.curve < 0 ? 1 : 0 })
    if (i % 11 === 3) {
      result.push({ distance: i * 58, lane: -width - 12, kind: 'banner', size: 0.8, variant: 0 })
      result.push({ distance: i * 58, lane: width + 12, kind: 'banner', size: 0.8, variant: 0 })
    }
  }
  // Small plants and rocks crown each island so the split reads from far away.
  const islandKinds: Record<CourseId, SceneryKind[]> = {
    forest: ['tree', 'flowers', 'mushroom'], coast: ['palm', 'coral', 'shell'], crystal: ['crystal', 'ice', 'crystal'], sky: ['cloudtree', 'flowers', 'cloudtree'],
  }
  for (const zone of course.zones) {
    if (zone.kind !== 'island') continue
    for (let distance = zone.start + 60, i = 0; distance < zone.end - 40; distance += 52, i++) {
      const kind = islandKinds[course.id][i % 3]
      result.push({ distance, lane: zone.lane + (i % 2 ? -0.35 : 0.35) * zone.half, kind, size: kind === 'flowers' || kind === 'shell' ? 0.4 : 0.62, variant: i % 3 })
    }
  }
  return result
}

export class KartRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly ctx: Ctx
  private course: Course | null = null
  private landmarks: Landmark[] = []
  private cameraLane = 0
  private cameraX = 0
  private cameraY = 0
  private cameraAngle = 0
  private backdropAngle = 0
  private lastTrackAngle = 0
  private lastTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas; canvas.width = WIDTH; canvas.height = HEIGHT
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('Canvas 2D is unavailable')
    this.ctx = context; this.ctx.imageSmoothingEnabled = false
  }

  private project(x: number, y: number): Projection {
    const dx = x - this.cameraX, dy = y - this.cameraY
    const z = dx * Math.cos(this.cameraAngle) + dy * Math.sin(this.cameraAngle)
    const across = -dx * Math.sin(this.cameraAngle) + dy * Math.cos(this.cameraAngle)
    const scale = FOCAL / Math.max(0.1, z)
    return { x: WIDTH / 2 + across * scale, y: HORIZON + CAMERA_HEIGHT * scale, z, scale }
  }

  private at(course: Course, distance: number, lane: number): Projection {
    const p = sampleTrack(course, distance)
    return this.project(p.x - Math.sin(p.angle) * lane, p.y + Math.cos(p.angle) * lane)
  }

  draw(state: RaceState, time: number, reducedMotion = false) {
    const g = this.ctx, course = state.course, player = state.racers[0], palette = PALETTES[course.id]
    if (this.course !== course) {
      this.course = course; this.landmarks = buildLandmarks(course); this.cameraLane = player.lane
      this.lastTrackAngle = sampleTrack(course, player.distance).angle; this.backdropAngle = this.lastTrackAngle
    }
    const dt = clamp(time - this.lastTime, 0, 0.06); this.lastTime = time
    this.cameraLane += (player.lane * 0.58 - this.cameraLane) * Math.min(1, dt * 10)
    const p = sampleTrack(course, player.distance)
    const turn = ((p.angle - this.lastTrackAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI
    this.backdropAngle += turn; this.lastTrackAngle = p.angle
    this.cameraAngle = p.angle
    this.cameraX = p.x - Math.cos(p.angle) * CAMERA_BACK - Math.sin(p.angle) * this.cameraLane
    this.cameraY = p.y - Math.sin(p.angle) * CAMERA_BACK + Math.cos(p.angle) * this.cameraLane
    g.globalAlpha = 1; g.imageSmoothingEnabled = false
    background(g, course, this.backdropAngle, reducedMotion ? 0 : time)
    this.drawGround(course, player.distance, time)
    this.drawRoad(course, player.distance, palette)
    this.drawZones(course, player.distance, palette, reducedMotion ? 0 : time)

    const sprites: Sprite[] = []
    for (const landmark of this.landmarks) {
      const ahead = ((landmark.distance - player.distance) % course.length + course.length) % course.length
      const delta = ahead > course.length - 170 ? ahead - course.length : ahead
      if (delta < -170 || delta > 1350) continue
      const at = this.at(course, landmark.distance, landmark.lane)
      if (at.z < 45 || at.z > 1700) continue
      const size = landmark.size * at.scale
      const width = 96 * size, height = 128 * size
      if (at.x + width / 2 < -25 || at.x - width / 2 > WIDTH + 25) continue
      sprites.push({ image: scenerySprite(landmark.kind, course.id, landmark.variant), x: at.x, y: at.y, z: at.z, width, height, shadow: landmark.kind === 'balloon' ? 0 : 0.35, flip: landmark.kind === 'sign' && landmark.variant === 1 })
    }
    for (const box of course.boxes) {
      const ahead = ((box.distance - player.distance) % course.length + course.length) % course.length
      if (ahead > 1200) continue
      const at = this.at(course, box.distance, box.lane)
      if (at.z < 50) continue
      const bob = reducedMotion ? 0 : Math.sin(time * 3 + box.lane * 0.05) * 2
      sprites.push({ image: itemSprite('pickup'), x: at.x, y: at.y - (8 + bob) * at.scale, z: at.z, width: 27 * at.scale, height: 31 * at.scale, shadow: 0.6 })
    }
    for (const hazard of state.hazards) {
      const ahead = ((hazard.distance - player.distance) % course.length + course.length) % course.length
      if (ahead > 1100 && ahead < course.length - 150) continue
      const at = this.at(course, hazard.distance, hazard.lane)
      if (at.z < 30) continue
      sprites.push({ image: itemSprite('puddle'), x: at.x, y: at.y, z: at.z, width: 53 * at.scale, height: 34 * at.scale, shadow: 0.15 })
    }
    for (const projectile of state.projectiles) {
      const ahead = ((projectile.distance - player.distance) % course.length + course.length) % course.length
      if (ahead > 1100 && ahead < course.length - 150) continue
      const at = this.at(course, projectile.distance, projectile.lane)
      if (at.z < 30) continue
      sprites.push({ image: itemSprite('bomb'), x: at.x, y: at.y - 4 * at.scale, z: at.z, width: 26 * at.scale, height: 29 * at.scale, shadow: 0.5 })
    }
    for (const racer of state.racers) {
      const ahead = ((racer.distance - player.distance) % course.length + course.length) % course.length
      // Keep the child's driver readable: opponents behind its plane have
      // already passed out of the race view, rather than filling the foreground.
      if (racer.id !== 0 && ahead > 1200) continue
      const at = this.at(course, racer.distance, racer.lane)
      if (at.z < 55) continue
      const jumpHeight = racer.jump > 0 ? Math.sin(clamp(racer.jump / 1.25, 0, 1) * Math.PI) * 47 : 0
      const direction = racer.drift || (racer.id === 0 ? -p.curve * 20 : 0)
      // Rough ground rattles the kart by a pixel.
      const rattle = racer.rough && !reducedMotion ? Math.floor(time * 24 + racer.id) % 2 : 0
      sprites.push({ image: kartSprite(racer.id, direction, Math.floor(time * (racer.speed > 5 ? 10 : 0)), racer.stun > 0), x: at.x, y: at.y - (jumpHeight + rattle) * at.scale, z: at.z, width: 52 * at.scale, height: 55 * at.scale, racer, shadow: 0.7 })
    }
    sprites.sort((a, b) => b.z - a.z)
    for (const sprite of sprites) this.drawSprite(sprite, time, reducedMotion)
    this.drawGate(course, player.distance)
    this.atmosphere(course, player, reducedMotion ? 0 : time, reducedMotion)
  }

  private drawGround(course: Course, distance: number, time: number) {
    const g = this.ctx, colors: Record<CourseId, string[]> = {
      forest: ['#97b576', '#587f57', '#aec28a'], coast: ['#f5dcac', '#cdab82', '#edd3a2'], crystal: ['#a4b4c5', '#596789', '#9d9db7'], sky: ['#e2ccd9', '#a798bd', '#d2b8cf'],
    }
    for (let i = 0; i < 170; i++) {
      const span = 1300, forward = ((i * 81.731 - distance) % span + span) % span - 100
      const lane = (hash(i + 2) < 0.5 ? -1 : 1) * (sampleTrack(course, distance + forward).width + 20 + hash(i + 17) * 1250)
      const at = this.at(course, distance + forward, lane)
      if (at.z < 80 || at.y < 121 || at.x < -10 || at.x > WIDTH + 10) continue
      const width = clamp(at.scale * (4 + hash(i) * 9), 1, 16), height = clamp(at.scale * 2, 1, 4)
      rect(g, colors[course.id][i % 3], at.x, at.y, width, height)
      if (i % 4 === 0 && course.id === 'forest') rect(g, '#bed095', at.x + 1, at.y - 2 * at.scale, 1, 3 * at.scale)
      if (course.id === 'crystal' && i % 13 === 0 && Math.sin(time + i) > 0.5) { rect(g, '#e3eff1', at.x, at.y - 2, 1, 5); rect(g, '#e3eff1', at.x - 2, at.y, 5, 1) }
      if (course.id === 'sky' && i % 9 === 0) {
        pixelOval(g, '#c3afca', at.x - 13 * at.scale, at.y - 2 * at.scale, 42 * at.scale, 8 * at.scale)
        pixelOval(g, '#dbc1d3', at.x - 7 * at.scale, at.y - 5 * at.scale, 26 * at.scale, 7 * at.scale)
        rect(g, '#eed3dc', at.x, at.y - 5 * at.scale, 9 * at.scale, at.scale)
      }
    }
  }

  private drawRoad(course: Course, distance: number, palette: Palette) {
    const g = this.ctx, step = 14, start = Math.floor((distance - 185) / step) * step
    for (let d = start + 1456; d >= start; d -= step) {
      const n = Math.floor(d / step), next = d + step + 0.8, near = this.at(course, d, 0), far = this.at(course, next, 0)
      if (near.z < 15 || far.z < 15 || (near.y > HEIGHT + 50 && far.y > HEIGHT + 50)) continue
      const wn = sampleTrack(course, d).width, wf = sampleTrack(course, next).width
      const leftNear = this.at(course, d, -wn), rightNear = this.at(course, d, wn)
      const leftFar = this.at(course, next, -wf), rightFar = this.at(course, next, wf)
      if ([leftNear, rightNear, leftFar, rightFar].some(v => v.z < 15)) continue
      const edge = 8
      const olN = this.at(course, d, -wn - edge), orN = this.at(course, d, wn + edge)
      const olF = this.at(course, next, -wf - edge), orF = this.at(course, next, wf + edge)
      const curb = palette.edge[(Math.floor(n / 3) % 2 + 2) % 2]
      poly(g, curb, [olN.x, olN.y, leftNear.x, leftNear.y, leftFar.x, leftFar.y, olF.x, olF.y])
      poly(g, curb, [rightNear.x, rightNear.y, orN.x, orN.y, orF.x, orF.y, rightFar.x, rightFar.y])
      poly(g, palette.road[(n % 3 + 3) % 3], [leftNear.x, leftNear.y, rightNear.x, rightNear.y, rightFar.x, rightFar.y, leftFar.x, leftFar.y])
      const inL = this.at(course, d, -wn + 5), inLF = this.at(course, next, -wf + 5)
      const inR = this.at(course, d, wn - 5), inRF = this.at(course, next, wf - 5)
      poly(g, palette.line, [leftNear.x, leftNear.y, inL.x, inL.y, inLF.x, inLF.y, leftFar.x, leftFar.y])
      poly(g, palette.line, [inR.x, inR.y, rightNear.x, rightNear.y, rightFar.x, rightFar.y, inRF.x, inRF.y])
      // Fine warm cobblestone flecks remain quiet enough for items and turns to read.
      if (near.scale > 0.22) for (let j = 0; j < 4; j++) {
        const lane = (hash(n * 7 + j * 3) - 0.5) * wn * 1.78
        const at = this.at(course, d + hash(n + j) * step, lane)
        rect(g, j % 2 ? palette.line : palette.road[0], at.x, at.y, Math.max(1, 3 * at.scale), Math.max(1, at.scale))
      }
      const wrapped = ((d % course.length) + course.length) % course.length
      if (wrapped < 44) {
        for (let j = 0; j < 12; j++) {
          const ln = this.at(course, d, -wn + j * wn / 6)
          const rn = this.at(course, d, -wn + (j + 1) * wn / 6)
          const lf = this.at(course, next, -wf + j * wf / 6)
          const rf = this.at(course, next, -wf + (j + 1) * wf / 6)
          poly(g, (j + Math.floor(wrapped / step)) % 2 ? '#66667b' : '#fff2d7', [ln.x, ln.y, rn.x, rn.y, rf.x, rf.y, lf.x, lf.y])
        }
      }
    }
  }

  /** Flat road features drawn over the asphalt, far to near: rough patches, dash panels and islands. */
  private drawZones(course: Course, distance: number, palette: Palette, time: number) {
    const g = this.ctx
    const quad = (color: string, d0: number, d1: number, a0: number, b0: number, a1: number, b1: number) => {
      const p = this.at(course, d0, a0), q = this.at(course, d0, b0), r = this.at(course, d1, b1), s = this.at(course, d1, a1)
      if (p.z < 15 || q.z < 15 || r.z < 15 || s.z < 15) return
      poly(g, color, [p.x, p.y, q.x, q.y, r.x, r.y, s.x, s.y])
    }
    const visible = course.zones.map(zone => {
      const ahead = ((zone.start - distance) % course.length + course.length) % course.length
      return { zone, ahead: ahead > course.length - (zone.end - zone.start) - 185 ? ahead - course.length : ahead }
    }).filter(({ ahead }) => ahead < 1400).sort((a, b) => b.ahead - a.ahead)
    for (const { zone, ahead } of visible) {
      const start = distance + ahead, length = zone.end - zone.start
      if (zone.kind === 'rough') {
        // A lumpy blob: rounded ends and jittered sides keep it from reading as a paint stripe.
        const step = 9, count = Math.max(2, Math.ceil(length / step))
        const halfAt = (i: number) => {
          const t = i / count * 2 - 1
          return zone.half * Math.sqrt(Math.max(0.05, 1 - t ** 4)) * (0.86 + hash(zone.start + i) * 0.14)
        }
        for (let i = 0; i < count; i++) {
          const d0 = start + i * length / count, d1 = start + (i + 1) * length / count, h0 = halfAt(i), h1 = halfAt(i + 1)
          quad(palette.rough[i % 2], d0, d1 + 0.8, zone.lane - h0, zone.lane + h0, zone.lane - h1, zone.lane + h1)
          const fleck = this.at(course, d0 + 4, zone.lane + (hash(i * 3 + zone.start) - 0.5) * h0 * 1.4)
          if (fleck.z > 15) rect(g, palette.rough[2], fleck.x, fleck.y, Math.max(1, 5 * fleck.scale), Math.max(1, 1.5 * fleck.scale))
        }
      } else if (zone.kind === 'dash') {
        quad('#6a5f86', start - 3, zone.end - zone.start + start + 3, zone.lane - zone.half - 3, zone.lane + zone.half + 3, zone.lane - zone.half - 3, zone.lane + zone.half + 3)
        quad('#f4a35f', start, start + length, zone.lane - zone.half, zone.lane + zone.half, zone.lane - zone.half, zone.lane + zone.half)
        // Three chevrons pulse forward so the panel reads as "go this way!"
        for (let i = 0; i < 3; i++) {
          const d = start + length * (0.12 + i * 0.3), bright = Math.floor(time * 6 - i + 30) % 3 === 0
          const color = bright ? '#fff6c4' : '#ffd66b', tip = length * 0.24
          const l = this.at(course, d, zone.lane - zone.half * 0.8), m = this.at(course, d + tip, zone.lane), r = this.at(course, d, zone.lane + zone.half * 0.8)
          const li = this.at(course, d + tip * 0.45, zone.lane - zone.half * 0.8), mi = this.at(course, d + tip * 1.5, zone.lane), ri = this.at(course, d + tip * 0.45, zone.lane + zone.half * 0.8)
          if ([l, m, r, li, mi, ri].some(v => v.z < 15)) continue
          poly(g, color, [l.x, l.y, m.x, m.y, r.x, r.y, ri.x, ri.y, mi.x, mi.y, li.x, li.y])
        }
      } else {
        const step = 10, count = Math.max(2, Math.ceil(length / step))
        for (let i = 0; i < count; i++) {
          const d0 = start + i * length / count, d1 = start + (i + 1) * length / count
          const a = islandAt(course, d0)?.half ?? 0, b = islandAt(course, Math.min(d1, start + length - 0.01))?.half ?? 0
          if (a < 0.5 && b < 0.5) continue
          quad(palette.edge[i % 2], d0, d1 + 0.8, zone.lane - a - 6, zone.lane + a + 6, zone.lane - b - 6, zone.lane + b + 6)
          quad(palette.ground[i % 2], d0, d1 + 0.8, zone.lane - a, zone.lane + a, zone.lane - b, zone.lane + b)
        }
      }
    }
  }

  private drawSprite(sprite: Sprite, time: number, reducedMotion: boolean) {
    const g = this.ctx, scale = FOCAL / sprite.z
    const w = Math.max(1, Math.round(sprite.width)), h = Math.max(1, Math.round(sprite.height)), x = Math.round(sprite.x - w / 2), y = Math.round(sprite.y - h)
    if (x + w < 0 || x > WIDTH || y > HEIGHT || y + h < HORIZON - 50) return
    const groundY = HORIZON + CAMERA_HEIGHT * scale
    if (sprite.shadow) { g.globalAlpha = sprite.shadow * 0.3; pixelOval(g, '#35344a', sprite.x - w * 0.3, groundY - 3 * scale, w * 0.6, 6 * scale); g.globalAlpha = 1 }
    if (sprite.racer) {
      const r = sprite.racer
      if (r.boost > 0 && !reducedMotion) for (let i = 0; i < 4; i++) {
        const tail = 7 + ((time * 80 + i * 5) % 11)
        poly(g, i % 2 ? '#ffdb85' : '#f0a679', [sprite.x + (i - 1.5) * 7 * scale, sprite.y - 4 * scale, sprite.x + (i - 1.5) * 7 * scale + 5 * scale, sprite.y - 4 * scale, sprite.x + (i - 1.5) * 8 * scale + 2 * scale, sprite.y + tail * scale])
      }
      if (r.star > 0) {
        g.globalAlpha = 0.25; pixelOval(g, ['#f7ce8c', '#b8e7b2', '#c4b2e7'][Math.floor(time * 4) % 3], x - 5 * scale, y - 3 * scale, w + 10 * scale, h + 6 * scale); g.globalAlpha = 1
        for (let i = 0; i < 5; i++) {
          const a = (reducedMotion ? 0 : time * 2) + i * Math.PI * 0.4, sx = sprite.x + Math.cos(a) * w * 0.58, sy = sprite.y - h * 0.5 + Math.sin(a) * h * 0.46
          rect(g, '#fff5bd', sx, sy - 2 * scale, scale, 5 * scale); rect(g, '#fff5bd', sx - 2 * scale, sy, 5 * scale, scale)
        }
      }
      if (Math.abs(r.drift) > 0.1 && r.speed > 70 && r.jump <= 0 && !reducedMotion) for (let i = 0; i < 5; i++) {
        const direction = Math.sign(r.drift), dx = (18 + i * 2) * direction * scale, dy = ((time * 42 + i * 4) % 14) * scale
        rect(g, i % 2 ? '#f9e6ac' : '#82d8df', sprite.x + dx, sprite.y - 6 * scale + dy, 2 * scale, 2 * scale)
      }
      if (r.rough && r.speed > 40 && !reducedMotion && this.course) {
        const dust = PALETTES[this.course.id].rough
        for (let i = 0; i < 6; i++) {
          const age = (time * 3 + i / 6) % 1, side = i % 2 ? 1 : -1
          const size = Math.max(1, (2 + age * 4) * scale)
          g.globalAlpha = 0.85 * (1 - age)
          rect(g, dust[i % 3], sprite.x + side * (10 + age * 16) * scale - size / 2, sprite.y - (3 + age * 12) * scale, size, size)
        }
        g.globalAlpha = 1
      }
      if (r.protection > 0 && r.stun <= 0) g.globalAlpha = reducedMotion ? 0.82 : 0.72 + Math.sin(time * 9) * 0.16
    }
    if (sprite.flip) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(sprite.image, 0, 0, w, h); g.restore() }
    else g.drawImage(sprite.image, x, y, w, h)
    g.globalAlpha = 1
    if (sprite.racer && sprite.racer.id === 0 && sprite.racer.jump > 0) {
      rect(g, '#fcecc7', sprite.x - 14 * scale, groundY - 2, 8 * scale, 1); rect(g, '#fcecc7', sprite.x + 6 * scale, groundY - 2, 8 * scale, 1)
    }
  }

  private drawGate(course: Course, distance: number) {
    const ahead = ((-distance % course.length) + course.length) % course.length
    if (ahead > 1050 && ahead < course.length - 80) return
    const width = sampleTrack(course, 0).width
    const left = this.at(course, 0, -width - 12), right = this.at(course, 0, width + 12)
    if (left.z < 60 || right.z < 60 || left.y > HEIGHT + 10 || right.y > HEIGHT + 10) return
    const g = this.ctx, h = 108 * left.scale
    rect(g, '#766381', left.x - 2 * left.scale, left.y - h, 4 * left.scale, h)
    rect(g, '#b59798', left.x - left.scale, left.y - h, left.scale, h)
    rect(g, '#766381', right.x - 2 * right.scale, right.y - 108 * right.scale, 4 * right.scale, 108 * right.scale)
    const y1 = left.y - h + 4 * left.scale, y2 = right.y - 104 * right.scale
    g.strokeStyle = '#9e8692'; g.lineWidth = Math.max(1, left.scale)
    g.beginPath(); g.moveTo(Math.round(left.x), Math.round(y1)); g.lineTo(Math.round(right.x), Math.round(y2)); g.stroke()
    for (let i = 0; i < 13; i++) {
      const f = i / 13, x = left.x + (right.x - left.x) * f, y = y1 + (y2 - y1) * f
      const end = left.x + (right.x - left.x) * (f + 0.06)
      poly(g, ['#efb69a', '#f6e4b6', '#a7ccc3', '#c6b3d7'][i % 4], [x, y, end, y, (x + end) / 2, y + 11 * left.scale])
    }
  }

  private atmosphere(course: Course, player: Racer, time: number, reducedMotion: boolean) {
    const g = this.ctx
    if (!reducedMotion) for (let i = 0; i < 14; i++) {
      const x = ((hash(i + 51) * WIDTH - time * (course.id === 'crystal' ? 4 : 9)) % WIDTH + WIDTH) % WIDTH
      const y = 78 + ((hash(i + 200) * 160 + time * (course.id === 'crystal' ? 5 : 2)) % 165)
      if (course.id === 'forest') {
        rect(g, i % 4 ? '#d8d598' : '#f5e8bc', x, y, 2, 1)
      } else if (course.id === 'crystal') {
        rect(g, '#d8e6e9', x, y, 1, 2); if (i % 4 === 0) rect(g, '#c2d7e0', x - 1, y, 3, 1)
      } else if (course.id === 'sky') {
        rect(g, '#f6e9d5', x, y, 2, 1); rect(g, '#ead0d9', x + 1, y + 1, 2, 1)
      }
    }
    if (player.boost > 0 && !reducedMotion) {
      g.globalAlpha = 0.6
      for (let i = 0; i < 12; i++) {
        const x = i % 2 ? 13 + hash(i) * 55 : WIDTH - 13 - hash(i) * 55, y = 120 + ((time * 90 + i * 19) % 140)
        poly(g, '#fff1c9', [x, y, x + (x < WIDTH / 2 ? -7 : 7), y + 17, x + (x < WIDTH / 2 ? -5 : 5), y + 8])
      }
      g.globalAlpha = 1
    }
  }

  dispose() { this.landmarks = []; this.course = null; clearSpriteCache(); this.canvas.width = 1; this.canvas.height = 1 }
}

export function drawItemIcon(canvas: HTMLCanvasElement, item: ItemId) {
  canvas.width = 32; canvas.height = 36
  const g = canvas.getContext('2d')!; g.imageSmoothingEnabled = false; g.clearRect(0, 0, 32, 36); g.drawImage(itemSprite(item), 0, 0)
}

export function drawCoursePreview(canvas: HTMLCanvasElement, course: Course) {
  canvas.width = 240; canvas.height = 130
  const target = canvas.getContext('2d')
  // Selection and its accessible course names remain usable without Canvas 2D.
  if (!target) return
  const stage = document.createElement('canvas'); stage.width = WIDTH; stage.height = HEIGHT
  const g = stage.getContext('2d')
  if (!g) return
  g.imageSmoothingEnabled = false
  background(g, course, 0, 0)
  const palette = PALETTES[course.id]
  // A composition tailored to the card: the race world, its signature landmark,
  // and a winding path that leads the eye into the next adventure.
  poly(g, palette.edge[0], [107, 270, 354, 270, 292, 209, 258, 171, 265, 144, 293, 125, 277, 117, 238, 140, 228, 169, 251, 210])
  poly(g, palette.road[1], [118, 270, 340, 270, 282, 211, 248, 173, 255, 144, 286, 123, 278, 121, 244, 145, 239, 171, 263, 211])
  poly(g, palette.road[0], [212, 270, 291, 270, 270, 222, 238, 183, 242, 167, 248, 187, 280, 226])
  const objectSets: Record<CourseId, { kind: SceneryKind; x: number; y: number; s: number }[]> = {
    forest: [{ kind: 'tree', x: -24, y: 238, s: 1.7 }, { kind: 'fir', x: 392, y: 187, s: 0.85 }, { kind: 'tree', x: 323, y: 234, s: 1.4 }, { kind: 'mushroom', x: 76, y: 248, s: 0.65 }, { kind: 'flowers', x: 315, y: 261, s: 0.6 }, { kind: 'lantern', x: 281, y: 180, s: 0.55 }],
    coast: [{ kind: 'palm', x: 2, y: 254, s: 1.8 }, { kind: 'palm', x: 338, y: 223, s: 1.35 }, { kind: 'sail', x: 339, y: 130, s: 0.52 }, { kind: 'coral', x: 358, y: 257, s: 0.8 }, { kind: 'shell', x: 85, y: 252, s: 0.5 }],
    crystal: [{ kind: 'crystal', x: -10, y: 247, s: 1.8 }, { kind: 'arch', x: 331, y: 204, s: 1.15 }, { kind: 'crystal', x: 334, y: 262, s: 1.15 }, { kind: 'ice', x: 95, y: 255, s: 0.75 }, { kind: 'lantern', x: 290, y: 179, s: 0.52 }],
    sky: [{ kind: 'cloudtree', x: -22, y: 244, s: 1.8 }, { kind: 'tower', x: 329, y: 230, s: 1.15 }, { kind: 'cloudtree', x: 345, y: 266, s: 1.25 }, { kind: 'flowers', x: 77, y: 246, s: 0.65 }, { kind: 'balloon', x: 71, y: 112, s: 0.65 }],
  }
  for (const obj of objectSets[course.id]) g.drawImage(scenerySprite(obj.kind, course.id), obj.x, obj.y - 128 * obj.s, 96 * obj.s, 128 * obj.s)
  g.drawImage(itemSprite('pickup'), 245, 176, 19, 21)
  g.drawImage(kartSprite(0, 0, 0), 194, 217, 43, 45)
  target.imageSmoothingEnabled = false
  target.drawImage(stage, 0, 0, WIDTH, HEIGHT, 0, 0, 240, 130)
}
