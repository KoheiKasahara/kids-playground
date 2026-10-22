import { findAnimal } from './animals'
import { ANCHOR_X, ANCHOR_Y, RUN_FRAMES, animalSprite, beeSprite, foodSprite, goalSign, numberSprite, type AnimalState, type EyeMode } from './art'
import { TUNNEL_GAP, type Block, type Course, type Pad, type Sign, type Spring, type ThemeId } from './courses'
import { FOODS } from './foods'
import { Grid, bayer, disc, hash2, makeCanvas, shade, type Img } from './pixel'
import { RUNNER_H, RUNNER_W, SLIDE_H, beeY, heightOf, type Race, type RaceEvent, type Runner, type Who } from './race'

// ごちそうレースの がめん。ちいさな ドットの がめん（バッファ）に かいてから、ぼかさずに おおきく うつす。
// race.ts の ようすを かくだけで、すすみかたは かえない。せかいの y は うえむき、がめんは したむき。

/** せかいの 2 = 1ドット。 */
export const PX = 2
/** よこに すくなくとも これだけの ドットを みせる（たて がめん・よこ がめん）。 */
const MIN_DOTS_PORTRAIT = 184
const MIN_DOTS_LANDSCAPE = 264
/** うえの おびの したに すくなくとも これだけの ドットの たかさを みせる。 */
const MIN_DOTS_TALL = 130
/** うえの おびの したから がめんの したまでの うち、じめんを おく ところ。 */
const GROUND_AT = .8
/** はしる ひとを がめんの ひだりから この わりあいの ところに おく。 */
const PLAYER_AT = .3
/** あなの そこ（みず など）の たかさ（せかい）。 */
const UNDER_Y = -64

export type View = {
  /** ほんものの canvas の おおきさ[px]。 */
  dw: number
  dh: number
  /** 1ドットが なんピクセルか。 */
  scale: number
  /** ドットの がめんの おおきさ。 */
  bw: number
  bh: number
  /** うえの おびの したはし（ドット）。 */
  top: number
  /** cam.y の たかさが うつる ぎょう（ドット）。 */
  ground: number
  /** よこに みえる せかいの はば。 */
  worldW: number
}

export function makeView(cssW: number, cssH: number, dpr: number, topCss: number): View {
  const dw = Math.max(1, Math.round(cssW * dpr))
  const dh = Math.max(1, Math.round(cssH * dpr))
  const minW = cssW < cssH ? MIN_DOTS_PORTRAIT : MIN_DOTS_LANDSCAPE
  const scale = Math.max(1, Math.floor(Math.min(dw / minW, Math.max(1, dh - topCss * dpr) / MIN_DOTS_TALL)))
  const bw = Math.ceil(dw / scale)
  const bh = Math.ceil(dh / scale)
  const top = Math.min(bh - 40, Math.round((topCss * dpr) / scale))
  return { dw, dh, scale, bw, bh, top, ground: Math.round(top + (bh - top) * GROUND_AT), worldW: bw * PX }
}

export type Cam = { x: number; y: number }

export function cameraTarget(race: Race, view: View): Cam {
  const p = race.player
  const room = (view.ground - view.top) * PX
  return {
    x: Math.max(-80, p.x + RUNNER_W / 2 - view.worldW * PLAYER_AT),
    y: Math.max(0, p.y + RUNNER_H + 60 - room),
  }
}

export function followCamera(cam: Cam, race: Race, view: View, dt: number): void {
  const target = cameraTarget(race, view)
  if (race.player.fall > 0) target.y = cam.y
  cam.x += (target.x - cam.x) * (1 - Math.exp(-dt * 9))
  cam.y += (target.y - cam.y) * (1 - Math.exp(-dt * 4))
}

const X = (wx: number) => Math.round(wx / PX)
const Y = (wy: number) => -Math.round(wy / PX)

// ---------------- いろ ----------------

type Palette = {
  sky: readonly string[]
  sun: string
  top: string
  topDark: string
  body: string
  stripe: string
  speck: string
  under: string
  underLight: string
  far: string
  near: string
  cloud: string
  cloudShade: string
  line: string
}

const PALETTES: Record<ThemeId, Palette> = {
  meadow: {
    sky: ['#5fb8ff', '#7cc8ff', '#9fd8ff', '#c4e8ff', '#e2f4ff'], sun: '#fff3a0',
    top: '#6cc24a', topDark: '#3f8f2e', body: '#c08347', stripe: '#a86d36', speck: '#8a5528', under: '#3d9be9', underLight: '#9fd3ff',
    far: '#9bd88a', near: '#5fae4b', cloud: '#ffffff', cloudShade: '#cfe6f5', line: '#3b2a1e',
  },
  sweets: {
    sky: ['#ff8fc2', '#ffa6cf', '#ffbedc', '#ffd4e7', '#ffe9f2'], sun: '#fff6c8',
    top: '#ff8fbd', topDark: '#e0608f', body: '#f4c27c', stripe: '#fff5e1', speck: '#d99a4f', under: '#8a5230', underLight: '#b97a4c',
    far: '#c98a5e', near: '#f783ac', cloud: '#fff3d6', cloudShade: '#e8b87a', line: '#5a2a3a',
  },
  starry: {
    sky: ['#0f1440', '#18205a', '#22296e', '#2e3384', '#3d3f94'], sun: '#fff6c8',
    top: '#54c79a', topDark: '#2f8a6a', body: '#5a4687', stripe: '#6b55a0', speck: '#463470', under: '#0a0e2e', underLight: '#3a4290',
    far: '#2c2a6b', near: '#24315f', cloud: '#b8b3ff', cloudShade: '#7d74e8', line: '#1a1236',
  },
}

// ---------------- こうか ----------------

type Particle = { kind: 'number' | 'spark' | 'dust' | 'confetti'; x: number; y: number; vx: number; vy: number; age: number; life: number; text?: string; color: string; size: number }

export type Fx = {
  particles: Particle[]
  munch: Record<Who, number>
  reducedMotion: boolean
}

export function createFx(reducedMotion: boolean): Fx {
  return { particles: [], munch: { player: -9, rival: -9 }, reducedMotion }
}

export function spawnFx(fx: Fx, event: RaceEvent, race: Race, time: number): void {
  const add = (p: Omit<Particle, 'age'>) => {
    if (fx.particles.length < 160) fx.particles.push({ ...p, age: 0 })
  }
  const runnerOf = (who: Who) => (who === 'player' ? race.player : race.rival)
  switch (event.type) {
    case 'eat': {
      fx.munch[event.who] = time
      const mine = event.who === 'player'
      add({ kind: 'number', x: event.x, y: event.y + 16, vx: 0, vy: 50, life: .9, text: `+${event.points}`, color: mine ? '#ffd43b' : '#e9ecef', size: 1 })
      if (!fx.reducedMotion) {
        const n = mine ? 5 + Math.min(10, event.points) : 3
        for (let i = 0; i < n; i++) {
          const angle = (i / n) * Math.PI * 2
          add({ kind: 'spark', x: event.x, y: event.y, vx: Math.cos(angle) * 130, vy: Math.sin(angle) * 130 + 40, life: .45, color: mine ? '#fff3a0' : '#ffffff', size: mine && i % 2 ? 2 : 1 })
        }
      }
      break
    }
    case 'land':
    case 'spring':
    case 'jump': {
      if (fx.reducedMotion) break
      const r = runnerOf(event.who)
      for (let i = 0; i < 4; i++) add({ kind: 'dust', x: r.x + RUNNER_W / 2 + (i - 1.5) * 7, y: r.y + 2, vx: (i - 1.5) * 34, vy: 16, life: .35, color: '#ffffff', size: 2 })
      break
    }
    case 'slide':
    case 'boost': {
      if (fx.reducedMotion) break
      const r = runnerOf(event.who)
      const color = event.type === 'boost' ? '#ffd43b' : '#ffffff'
      for (let i = 0; i < 5; i++) add({ kind: 'dust', x: r.x + 4 - i * 5, y: r.y + 3 + (i % 2) * 4, vx: -60 - i * 24, vy: 20 + i * 6, life: .4, color, size: 2 })
      break
    }
    case 'respawn': {
      if (fx.reducedMotion) break
      const r = runnerOf(event.who)
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2
        add({ kind: 'dust', x: r.x + RUNNER_W / 2, y: r.y + RUNNER_H / 2, vx: Math.cos(angle) * 90, vy: Math.sin(angle) * 90, life: .45, color: '#ffffff', size: 3 })
      }
      break
    }
    case 'goal': {
      if (fx.reducedMotion) break
      const gx = race.course.goal
      for (let i = 0; i < 40; i++) {
        add({ kind: 'confetti', x: gx + (hash2(i, 1) - .5) * 120, y: 150 + hash2(i, 2) * 60, vx: (hash2(i, 3) - .5) * 160, vy: 60 + hash2(i, 4) * 120, life: 2.2, color: `hsl(${Math.round(hash2(i, 5) * 360)} 90% 62%)`, size: 2 })
      }
      break
    }
  }
}

export function updateFx(fx: Fx, dt: number): void {
  for (const p of fx.particles) {
    p.age += dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    if (p.kind === 'spark' || p.kind === 'dust') {
      p.vx *= 1 - dt * 4
      p.vy *= 1 - dt * 4
    } else if (p.kind === 'confetti') p.vy -= 160 * dt
    else p.vy *= 1 - dt * 2
  }
  fx.particles = fx.particles.filter(p => p.age < p.life)
}

// ---------------- はいけい ----------------

const skyCache = new Map<string, Img | null>()

/** そら（あみかけの グラデーション・おひさま・ほし）。おおきさが かわらない かぎり 1かいだけ つくる。 */
function skyImage(theme: ThemeId, view: View): Img | null {
  const key = `${theme}|${view.bw}|${view.bh}|${view.top}|${view.ground}`
  let img = skyCache.get(key)
  if (img !== undefined) return img
  const made = makeCanvas(view.bw, view.bh)
  img = made?.canvas ?? null
  if (made) {
    const { ctx } = made
    const pal = PALETTES[theme]
    const levels = pal.sky.length
    for (let y = 0; y < view.bh; y++) {
      const t = Math.min(1, y / Math.max(1, view.ground)) * (levels - 1)
      for (let x = 0; x < view.bw; x++) {
        const i = Math.min(levels - 1, Math.floor(t + bayer(x, y)))
        ctx.fillStyle = pal.sky[i]
        ctx.fillRect(x, y, 1, 1)
      }
    }
    const sx = Math.round(view.bw * .8)
    const sy = view.top + 18
    if (theme === 'starry') {
      for (let i = 0; i < 70; i++) {
        const x = Math.floor(hash2(i, 7) * view.bw)
        const y = Math.floor(hash2(i, 9) * view.ground * .9)
        ctx.fillStyle = hash2(i, 3) > .7 ? '#fff6c8' : '#9aa6ff'
        ctx.fillRect(x, y, 1, 1)
      }
      disc(ctx, sx, sy, 9, pal.sun)
      disc(ctx, sx + 4, sy - 3, 8, pal.sky[1])
    } else {
      disc(ctx, sx, sy, 11, shade(pal.sun, -.3))
      disc(ctx, sx, sy, 9, pal.sun)
    }
    skyCache.set(key, img)
  }
  return img
}

const decoCache = new Map<string, Img | null>()

/** はいけいの き・キャンディ・おうち。 */
function decoImage(theme: ThemeId, variant: number): Img | null {
  const key = `${theme}|${variant}`
  let img = decoCache.get(key)
  if (img !== undefined) return img
  const g = new Grid(24, 30)
  if (theme === 'meadow') {
    g.rect(10, 18, 4, 12, '#8a5a35')
    g.rect(13, 18, 1, 12, '#6b4026')
    const leaf = variant ? '#4caf50' : '#5cbf55'
    g.ellipse(12, 11, 9, 8, leaf)
    g.ellipse(7, 15, 5, 4, leaf)
    g.ellipse(17, 15, 5, 4, leaf)
    g.shadeRim(12, 11, 9, 8, leaf, shade(leaf, .2))
    g.outline('#2f6b2a')
  } else if (theme === 'sweets') {
    g.rect(11, 14, 2, 16, '#ffffff')
    const candy = ['#ff6fa8', '#ffd43b', '#69db7c', '#74c0fc'][variant % 4]
    g.ellipse(12, 9, 8, 8, candy)
    for (let a = 0; a < 9; a += .25) g.set(Math.floor(12 + Math.cos(a) * a * .8), Math.floor(9 + Math.sin(a) * a * .8), '#ffffff')
    g.outline('#8a3a5a')
  } else {
    g.rect(3, 14, 18, 16, '#2b2a62')
    g.triangle(1, 15, 12, 4, 23, 15, '#3a3780')
    g.rect(6, 18, 4, 4, '#ffd36b')
    g.rect(14, 18, 4, 4, variant ? '#ffd36b' : '#7a6fbf')
    g.rect(10, 24, 4, 6, '#1a1840')
    g.outline('#120f30')
  }
  img = g.toCanvas()
  decoCache.set(key, img)
  return img
}

let cloudImg: Img | null | undefined
function farCloud(): Img | null {
  if (cloudImg === undefined) {
    const g = new Grid(34, 14)
    for (const [x, y, rx, ry] of [[9, 8, 7, 5], [17, 6, 8, 6], [25, 8, 7, 5], [17, 10, 14, 3.6]]) g.ellipse(x, y, rx, ry, '#ffffff')
    cloudImg = g.toCanvas()
  }
  return cloudImg
}

/** なだらかな やまの たかさ（よこの いちから きまる）。 */
function hillHeight(x: number, seed: number, height: number): number {
  return height * (.55 + .25 * Math.sin(x / 37 + seed) + .2 * Math.sin(x / 13 + seed * 3))
}

function drawBackground(ctx: CanvasRenderingContext2D, view: View, cam: Cam, theme: ThemeId, time: number) {
  const pal = PALETTES[theme]
  const sky = skyImage(theme, view)
  if (sky) ctx.drawImage(sky, 0, 0)
  else {
    ctx.fillStyle = pal.sky[2]
    ctx.fillRect(0, 0, view.bw, view.bh)
  }
  const camX = cam.x / PX
  const camY = cam.y / PX
  if (theme === 'starry') {
    for (let i = 0; i < 8; i++) {
      if (Math.sin(time * 2 + i * 1.7) < .6) continue
      const x = Math.floor(hash2(i, 21) * view.bw), y = Math.floor(hash2(i, 23) * view.ground * .7)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x - 1, y, 3, 1)
      ctx.fillRect(x, y - 1, 1, 3)
    }
  } else {
    const cloud = farCloud()
    if (cloud) {
      const span = 150
      const shift = Math.round(camX * .12 + time * 2)
      ctx.globalAlpha = theme === 'sweets' ? .8 : .95
      for (let i = Math.floor(shift / span) - 1; i <= Math.floor((shift + view.bw) / span) + 1; i++) {
        const x = i * span - shift + Math.floor(hash2(i, 31) * 70)
        const y = view.top + 8 + Math.floor(hash2(i, 33) * Math.max(8, (view.ground - view.top) * .3))
        ctx.drawImage(cloud, x, y)
      }
      ctx.globalAlpha = 1
    }
  }
  // とおくの やま と ちかくの やま。
  for (const [factor, color, height, seed] of [[.18, pal.far, 34, 1], [.32, pal.near, 22, 4]] as const) {
    const base = view.ground + Math.round(camY * factor * .5)
    const shift = Math.round(camX * factor)
    ctx.fillStyle = color
    for (let x = 0; x < view.bw; x++) {
      const h = Math.round(hillHeight(x + shift, seed, height))
      ctx.fillRect(x, base - h, 1, view.bh - base + h)
    }
    ctx.fillStyle = shade(color, -.18)
    for (let x = 0; x < view.bw; x++) {
      const h = Math.round(hillHeight(x + shift, seed, height))
      ctx.fillRect(x, base - h, 1, 1)
    }
  }
  // き・キャンディ・おうち。
  const gap = 90
  const shift = Math.round(camX * .5)
  const base = view.ground + Math.round(camY * .25)
  for (let i = Math.floor(shift / gap) - 1; i <= Math.floor((shift + view.bw) / gap) + 1; i++) {
    const img = decoImage(theme, i & 1)
    if (!img) continue
    ctx.drawImage(img, i * gap - shift + Math.floor(hash2(i, 41) * 40), base - img.height)
  }
}

// ---------------- コース ----------------

function drawGround(ctx: CanvasRenderingContext2D, course: Course, pal: Palette, left: number, right: number, bottom: number, theme: ThemeId, time: number) {
  // あなの そこ。
  const uy = Y(UNDER_Y)
  ctx.fillStyle = pal.under
  ctx.fillRect(left, uy, right - left, bottom - uy)
  ctx.fillStyle = pal.underLight
  const wave = Math.floor(time * 4) % 8
  for (let x = left - (left % 8); x < right; x += 8) ctx.fillRect(x + wave, uy + 2 + ((x / 8) & 1), 3, 1)

  for (const span of course.spans) {
    const x0 = Math.max(X(span.x0), left - 2)
    const x1 = Math.min(X(span.x1), right + 2)
    if (x1 <= x0) continue
    const top = Y(span.top)
    const w = x1 - x0
    // つち・スポンジ。
    ctx.fillStyle = pal.body
    ctx.fillRect(x0, top + 4, w, bottom - top)
    ctx.fillStyle = pal.stripe
    for (let y = top + 14; y < bottom; y += 12) ctx.fillRect(x0 + 1, y, w - 2, theme === 'sweets' ? 2 : 1)
    ctx.fillStyle = pal.speck
    for (let gx = Math.floor(x0 / 6) * 6; gx < x1; gx += 6) {
      for (let gy = top + 6; gy < Math.min(bottom, top + 80); gy += 6) {
        if (hash2(gx, gy - top, 5) < .22 && gx > x0 && gx < x1 - 2) ctx.fillRect(gx + 1, gy + 1, 2, 1)
      }
    }
    // くさ・クリーム。
    ctx.fillStyle = pal.top
    ctx.fillRect(x0, top, w, 4)
    ctx.fillStyle = pal.topDark
    ctx.fillRect(x0, top + 4, w, 1)
    if (theme === 'sweets') {
      ctx.fillStyle = pal.top
      for (let x = x0 + 2; x < x1 - 2; x += 5) {
        const drop = Math.floor(hash2(x, 3, 9) * 4)
        ctx.fillRect(x, top + 4, 2, 1 + drop)
      }
    } else {
      ctx.fillStyle = shade(pal.top, -.3)
      for (let x = x0 + 1; x < x1 - 1; x++) {
        if (hash2(Math.floor(x + span.x0), 1, 7) < .25) ctx.fillRect(x, top - 1, 1, 1)
      }
    }
    // はしの ふち。
    ctx.fillStyle = pal.line
    if (X(span.x0) >= left - 2) ctx.fillRect(x0, top + 1, 1, bottom - top)
    if (X(span.x1) <= right + 2) ctx.fillRect(x1 - 1, top + 1, 1, bottom - top)
    ctx.fillRect(x0 + 1, top - 1, w - 2, 1)
    ctx.clearRect(x0, top, 1, 1)
    ctx.clearRect(x1 - 1, top, 1, 1)
  }
}

function drawClouds(ctx: CanvasRenderingContext2D, course: Course, pal: Palette, left: number, right: number) {
  for (const c of course.clouds) {
    const x0 = X(c.x0), x1 = X(c.x1)
    if (x1 < left || x0 > right) continue
    const y = Y(c.top)
    ctx.fillStyle = pal.line
    ctx.fillRect(x0, y - 1, x1 - x0, 7)
    ctx.fillStyle = pal.cloudShade
    ctx.fillRect(x0 + 1, y + 2, x1 - x0 - 2, 3)
    ctx.fillStyle = pal.cloud
    ctx.fillRect(x0 + 1, y, x1 - x0 - 2, 2)
    for (let x = x0 + 3; x < x1 - 6; x += 9) {
      ctx.fillStyle = pal.line
      ctx.fillRect(x, y - 3, 6, 2)
      ctx.fillStyle = pal.cloud
      ctx.fillRect(x + 1, y - 2, 4, 2)
    }
  }
}

function drawGoal(ctx: CanvasRenderingContext2D, course: Course, time: number) {
  const span = course.spans.find(s => s.x0 <= course.goal && s.x1 >= course.goal)
  const base = Y(span?.top ?? 0)
  const x = X(course.goal)
  const postH = 70
  for (const px of [x - 34, x + 32]) {
    ctx.fillStyle = '#3b2a1e'
    ctx.fillRect(px - 1, base - postH - 1, 5, postH + 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(px, base - postH, 3, postH)
    ctx.fillStyle = '#d0d8e2'
    ctx.fillRect(px + 2, base - postH, 1, postH)
  }
  // チェックの おび。
  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(x - 34, base - postH - 2, 69, 10)
  for (let i = 0; i < 17; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#222222' : '#ffffff'
      ctx.fillRect(x - 33 + i * 4, base - postH - 1 + j * 4, 4, 4)
    }
  }
  const sign = goalSign()
  if (sign) ctx.drawImage(sign, x - Math.floor(sign.width / 2), base - postH + 12 + (Math.floor(time * 3) % 2))
  // ゆかの チェック。
  for (let y = 0; y < 4; y++) {
    ctx.fillStyle = y % 2 ? '#222222' : '#ffffff'
    ctx.fillRect(x - 1, base + y, 2, 1)
    ctx.fillStyle = y % 2 ? '#ffffff' : '#222222'
    ctx.fillRect(x + 1, base + y, 2, 1)
  }
}

function drawStart(ctx: CanvasRenderingContext2D, course: Course) {
  const x = X(course.start) - 4
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x, 0, 2, 4)
  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(x - 22, -31, 3, 31)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x - 21, -30, 1, 30)
  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(x - 19, -31, 12, 9)
  ctx.fillStyle = '#4dabf7'
  ctx.fillRect(x - 19, -30, 11, 7)
  ctx.fillStyle = '#a5d8ff'
  ctx.fillRect(x - 19, -30, 11, 2)
}

/** トンネル。したの すきまは くらく して、てんじょうの ふちに しましまの めじるし。 */
function drawBlock(ctx: CanvasRenderingContext2D, block: Block, pal: Palette, theme: ThemeId) {
  const x0 = X(block.x0), x1 = X(block.x1)
  const top = Y(block.y1), bottom = Y(block.y0), floor = Y(block.y0 - TUNNEL_GAP)
  const w = x1 - x0
  // なかの かげ。
  ctx.fillStyle = 'rgba(20, 10, 40, .28)'
  ctx.fillRect(x0, bottom, w, floor - bottom)
  // かたまり。
  ctx.fillStyle = pal.line
  ctx.fillRect(x0 - 1, top - 1, w + 2, bottom - top + 2)
  ctx.fillStyle = pal.body
  ctx.fillRect(x0, top, w, bottom - top)
  ctx.fillStyle = pal.stripe
  for (let y = top + 12; y < bottom - 6; y += 12) ctx.fillRect(x0 + 1, y, w - 2, theme === 'sweets' ? 2 : 1)
  ctx.fillStyle = pal.top
  ctx.fillRect(x0, top, w, 4)
  ctx.fillStyle = pal.topDark
  ctx.fillRect(x0, top + 4, w, 1)
  // てんじょうの しましま（ここは スライディングで くぐる）。
  for (let x = x0; x < x1; x++) {
    ctx.fillStyle = Math.floor((x - x0) / 3) % 2 ? '#2b2b33' : '#ffd43b'
    ctx.fillRect(x, bottom - 3, 1, 3)
  }
  // いりぐちの あおい めじるし（スライディング ボタンと おなじ いろ）。
  const bx = x0 + 3, by = bottom - 16
  if (bottom - top >= 22) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx - 1, by - 1, 13, 11)
    ctx.fillStyle = '#1c7ed6'
    ctx.fillRect(bx, by, 11, 9)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(bx + 2, by + 5, 4, 2)
    for (let i = 0; i < 3; i++) ctx.fillRect(bx + 6 + i, by + 3 + i, 1, 5 - i * 2)
  }
}

/** ジャンプだい。だれかが のっていると ちぢむ。うえに ▲ を ちかちか させる。 */
function drawSpring(ctx: CanvasRenderingContext2D, spring: Spring, race: Race, time: number, reducedMotion: boolean) {
  const x0 = X(spring.x0), x1 = X(spring.x1)
  const base = Y(spring.top)
  const w = x1 - x0
  const pressed = [race.player, race.rival].some(r => r.x + RUNNER_W > spring.x0 && r.x < spring.x1 && r.y - spring.top < 24 && r.y >= spring.top - 1)
  const h = pressed ? 3 : 6
  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(x0, base - 2, w, 3)
  // ばね。
  ctx.fillStyle = '#adb5bd'
  for (let x = x0 + 3; x < x1 - 3; x += 6) {
    for (let y = 0; y < h - 1; y++) ctx.fillRect(x + (y % 2), base - 2 - y, 3, 1)
  }
  // うえの いた。
  ctx.fillStyle = '#7a2410'
  ctx.fillRect(x0 - 1, base - h - 4, w + 2, 4)
  ctx.fillStyle = '#ff6b6b'
  ctx.fillRect(x0, base - h - 3, w, 2)
  ctx.fillStyle = '#ffd43b'
  for (let x = x0 + 2; x < x1 - 2; x += 8) ctx.fillRect(x, base - h - 3, 3, 1)
  // ▲ ▲
  const blink = reducedMotion || Math.floor(time * 3) % 2 === 0
  if (!blink) return
  ctx.fillStyle = spring.fork ? '#fff3a0' : '#ffffff'
  const lift = reducedMotion ? 0 : Math.floor(time * 6) % 3
  for (const cx of [x0 + Math.floor(w / 3), x0 + Math.floor((w * 2) / 3)]) {
    for (let i = 0; i < 3; i++) ctx.fillRect(cx - i, base - h - 12 - lift + i, i * 2 + 1, 1)
  }
}

/** かそくそうち。>>> が はしる。 */
function drawBoost(ctx: CanvasRenderingContext2D, pad: Pad, time: number, reducedMotion: boolean) {
  const x0 = X(pad.x0), x1 = X(pad.x1)
  const y = Y(pad.top) - 3
  const w = x1 - x0
  ctx.fillStyle = '#7a2410'
  ctx.fillRect(x0 - 1, y - 1, w + 2, 9)
  ctx.fillStyle = '#ff922b'
  ctx.fillRect(x0, y, w, 7)
  ctx.fillStyle = '#ffc078'
  ctx.fillRect(x0, y, w, 1)
  const shift = reducedMotion ? 0 : Math.floor(time * 24) % 8
  ctx.fillStyle = '#fff3a0'
  for (let x = x0 + shift - 8; x < x1 - 4; x += 8) {
    if (x < x0) continue
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + i, y + 1 + i, 2, 1)
      ctx.fillRect(x + i, y + 5 - i, 2, 1)
    }
  }
}

/** わかれみちの かんばん（うえ と まっすぐ）。 */
function drawSign(ctx: CanvasRenderingContext2D, sign: Sign) {
  const x = X(sign.x)
  const base = Y(sign.top)
  ctx.fillStyle = '#3b2a1e'
  ctx.fillRect(x - 1, base - 28, 4, 28)
  ctx.fillStyle = '#c48a52'
  ctx.fillRect(x, base - 27, 2, 27)
  for (const [py, up] of [[base - 30, true], [base - 18, false]] as const) {
    ctx.fillStyle = '#3b2a1e'
    ctx.fillRect(x - 8, py - 1, 18, 10)
    ctx.fillStyle = up ? '#ff8787' : '#74c0fc'
    ctx.fillRect(x - 7, py, 16, 8)
    ctx.fillStyle = '#ffffff'
    if (up) {
      // ↗
      for (let i = 0; i < 6; i++) ctx.fillRect(x - 3 + i, py + 6 - i, 1, 1)
      ctx.fillRect(x, py + 1, 3, 1)
      ctx.fillRect(x + 2, py + 1, 1, 3)
    } else {
      // →
      ctx.fillRect(x - 4, py + 4, 8, 1)
      ctx.fillRect(x + 1, py + 2, 1, 5)
      ctx.fillRect(x + 2, py + 3, 1, 3)
      ctx.fillRect(x + 3, py + 4, 1, 1)
    }
  }
}

// ---------------- はしる ひと ----------------

function poseState(race: Race, r: Runner): AnimalState {
  if (r.fall > 0 || r.stun > 0) return 'hurt'
  if (r.slide > 0) return 'slide'
  if (race.result && Math.abs(r.vx) < 30 && r.onGround) {
    const won = race.result.outcome === 'win' ? r.who === 'player' : race.result.outcome === 'lose' ? r.who === 'rival' : true
    return won ? 'cheer' : 'sad'
  }
  if (r.finishedAt !== null && Math.abs(r.vx) < 40 && r.onGround) return 'cheer'
  if (!r.onGround) return 'jump'
  return Math.abs(r.vx) > 15 ? 'run' : 'stand'
}

function eyesFor(state: AnimalState, munch: boolean, time: number): EyeMode {
  if (state === 'hurt') return 'dizzy'
  if (state === 'cheer' || munch) return 'happy'
  if (state === 'sad') return 'closed'
  return time % 3.4 < .12 ? 'closed' : 'open'
}

function groundBelow(course: Course, x: number, y: number): number | null {
  let best: number | null = null
  for (const span of course.spans) {
    if (span.x0 > x) break
    if (span.x1 > x && span.top <= y + 1 && (best === null || span.top > best)) best = span.top
  }
  for (const c of course.clouds) {
    if (c.x0 <= x && c.x1 > x && c.top <= y + 1 && (best === null || c.top > best)) best = c.top
  }
  for (const b of course.blocks) {
    if (b.x0 <= x && b.x1 > x && b.y1 <= y + 1 && (best === null || b.y1 > best)) best = b.y1
  }
  return best
}

const STAR = ['.o.', 'ooo', '.o.']
function pixelStar(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color
  STAR.forEach((row, dy) => { for (let dx = 0; dx < 3; dx++) if (row[dx] === 'o') ctx.fillRect(x + dx - 1, y + dy - 1, 1, 1) })
}

function drawRunner(ctx: CanvasRenderingContext2D, race: Race, r: Runner, fx: Fx, time: number, mine: boolean) {
  const animal = findAnimal(r.animal)
  if (!animal) return
  const cx = X(r.x + RUNNER_W / 2)
  const feet = Y(r.y)
  if (r.fall <= 0) {
    const g = groundBelow(race.course, r.x + RUNNER_W / 2, r.y)
    if (g !== null) {
      const lift = Math.min(1, (r.y - g) / 160)
      const w = Math.round(14 * (1 - lift * .4))
      ctx.fillStyle = 'rgba(0, 0, 0, .22)'
      ctx.fillRect(cx - Math.floor(w / 2), Y(g) - 1, w, 2)
      ctx.fillRect(cx - Math.floor(w / 2) + 2, Y(g) - 2, w - 4, 1)
    }
  }
  // はやく はしっている ときの かぜの せん。
  if (!fx.reducedMotion && r.onGround && r.vx > 170 && r.stun <= 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, .8)'
    for (let i = 0; i < 3; i++) {
      const len = 5 + Math.floor(((time * 9 + i * .37) % 1) * 8)
      ctx.fillRect(cx - 12 - i * 2 - len, feet - 6 - i * 6, len, 1)
    }
  }
  const blinkOut = r.invuln > 0 && r.stun <= 0 && Math.floor(time * 14) % 2 === 0
  const state = poseState(race, r)
  const munch = time - fx.munch[r.who] < .25
  const frame = state === 'run' ? Math.floor(r.stride / 16) % RUN_FRAMES : state === 'cheer' ? Math.floor(time * 6) % 2 : 0
  const img = animalSprite(animal, { state, frame, eyes: eyesFor(state, munch, time + (mine ? 0 : 1.3)), munch })
  if (img && !blinkOut) {
    const x = cx - ANCHOR_X
    const y = feet - ANCHOR_Y - 1
    if (state === 'slide') {
      // ひくく すべる（せの たかさに あわせて たてに ちぢめる）。
      const h = Math.round(img.height * (SLIDE_H + 2) / RUNNER_H)
      ctx.drawImage(img, x - 1, y + img.height - h, img.width + 6, h)
      if (!fx.reducedMotion) {
        ctx.fillStyle = 'rgba(255, 255, 255, .85)'
        for (let i = 0; i < 3; i++) {
          const k = Math.floor((time * 12 + i * .4) % 3)
          ctx.fillRect(cx - 12 - i * 4 - k, feet - 2 - (i % 2) * 2, 2, 1)
        }
      }
    } else ctx.drawImage(img, x, y)
  }
  // ふらふら の ほし。
  if (r.stun > 0) {
    for (let i = 0; i < 3; i++) {
      const angle = time * 6 + (i / 3) * Math.PI * 2
      pixelStar(ctx, cx + Math.round(Math.cos(angle) * 8), feet - 30 + Math.round(Math.sin(angle) * 2), '#ffe066')
    }
  }
  // じぶんの めじるし。
  if (mine && r.fall <= 0) {
    const y = feet - Math.round(heightOf(r) / PX) - 14 + (Math.floor(time * 4) % 2)
    ctx.fillStyle = '#7a2410'
    ctx.fillRect(cx - 4, y - 1, 9, 1)
    ctx.fillRect(cx - 4, y, 1, 1)
    ctx.fillRect(cx + 4, y, 1, 1)
    ctx.fillStyle = '#ffd43b'
    ctx.fillRect(cx - 3, y, 7, 1)
    ctx.fillRect(cx - 2, y + 1, 5, 1)
    ctx.fillRect(cx - 1, y + 2, 3, 1)
    ctx.fillStyle = '#7a2410'
    ctx.fillRect(cx - 3, y + 1, 1, 1)
    ctx.fillRect(cx + 3, y + 1, 1, 1)
    ctx.fillRect(cx - 2, y + 2, 1, 1)
    ctx.fillRect(cx + 2, y + 2, 1, 1)
    ctx.fillRect(cx, y + 3, 1, 1)
  }
}

/** がめんの そとに いる あいての いち（みぎ か ひだりの はしに だす）。 */
function drawRivalArrow(ctx: CanvasRenderingContext2D, race: Race, view: View, cam: Cam, time: number) {
  const r = race.rival
  const animal = findAnimal(r.animal)
  if (!animal || r.fall > 0) return
  const sx = X(r.x + RUNNER_W / 2) - Math.round(cam.x / PX)
  const ahead = sx > view.bw + 4
  if (!ahead && sx > -4) return
  const sy = Math.max(view.top + 16, Math.min(view.ground - 18, view.ground + Math.round(cam.y / PX) + Y(r.y) - 14))
  const x = ahead ? view.bw - 16 : 15
  const d = ahead ? 1 : -1
  ctx.fillStyle = animal.color
  for (let i = 0; i < 4; i++) ctx.fillRect(x + d * (13 + i), sy - 3 + i, 1, 7 - i * 2)
  disc(ctx, x, sy, 12, '#3b2a1e')
  disc(ctx, x, sy, 11, animal.color)
  disc(ctx, x, sy, 9, '#ffffff')
  const img = animalSprite(animal, { state: 'run', frame: Math.floor(time * 8) % RUN_FRAMES, eyes: 'open', munch: false })
  if (img) ctx.drawImage(img, 0, 0, img.width, 25, x - 15, sy - 16, img.width, 25)
}

// ---------------- ぜんぶ かく ----------------

let buffer: { canvas: Img; ctx: CanvasRenderingContext2D } | null = null

export type SceneOptions = { view: View; cam: Cam; race: Race; fx: Fx; time: number }

export function drawScene(ctx: CanvasRenderingContext2D, { view, cam, race, fx, time }: SceneOptions): void {
  if (!buffer || buffer.canvas.width !== view.bw || buffer.canvas.height !== view.bh) buffer = makeCanvas(view.bw, view.bh)
  if (!buffer) return
  const b = buffer.ctx
  const { course } = race
  const pal = PALETTES[course.theme]
  b.setTransform(1, 0, 0, 1, 0, 0)
  b.imageSmoothingEnabled = false
  drawBackground(b, view, cam, course.theme, time)

  // ここから せかいの ざひょう（ドット）。
  const camX = Math.round(cam.x / PX)
  const camY = Math.round(cam.y / PX)
  b.setTransform(1, 0, 0, 1, -camX, view.ground + camY)
  const left = camX - 8
  const right = camX + view.bw + 8
  const bottom = view.bh - view.ground - camY + 2
  drawStart(b, course)
  drawGround(b, course, pal, left, right, bottom, course.theme, time)
  const visible = (x0: number, x1: number) => X(x1) >= left && X(x0) <= right
  for (const pad of course.boosts) if (visible(pad.x0, pad.x1)) drawBoost(b, pad, time, fx.reducedMotion)
  for (const spring of course.springs) if (visible(spring.x0, spring.x1)) drawSpring(b, spring, race, time, fx.reducedMotion)
  for (const sign of course.signs) if (visible(sign.x - 20, sign.x + 20)) drawSign(b, sign)
  for (const block of course.blocks) if (visible(block.x0, block.x1)) drawBlock(b, block, pal, course.theme)
  drawClouds(b, course, pal, left, right)
  drawGoal(b, course, time)

  // ごちそう。
  for (const spot of course.foods) {
    const fx0 = X(spot.x)
    if (fx0 < left - 10 || fx0 > right + 10 || race.eatenBy[spot.id] !== null) continue
    const img = foodSprite(spot.kind)
    if (!img) continue
    const bob = fx.reducedMotion ? 0 : Math.round(Math.sin(time * 4 + spot.id))
    const x = fx0 - Math.floor(img.width / 2)
    const y = Y(spot.y) - Math.floor(img.height / 2) + bob
    b.drawImage(img, x, y)
    if (FOODS[spot.kind].points >= 5 && !fx.reducedMotion) {
      const k = Math.floor(time * 6 + spot.id) % 4
      const sparkle = [[-3, -2], [img.width + 1, 1], [img.width - 1, img.height + 1], [-2, img.height - 2]][k]
      pixelStar(b, x + sparkle[0], y + sparkle[1], '#fff6a0')
    }
  }

  const beeFrame = Math.floor(time * 16) % 2
  for (const bee of course.bees) {
    const img = beeSprite(beeFrame)
    if (!img || X(bee.x) < left - 10 || X(bee.x) > right + 10) continue
    b.drawImage(img, X(bee.x) - Math.floor(img.width / 2), Y(beeY(bee, race.clock)) - Math.floor(img.height / 2))
  }

  drawRunner(b, race, race.rival, fx, time, false)
  drawRunner(b, race, race.player, fx, time, true)

  // こうか。
  for (const p of fx.particles) {
    const fade = 1 - p.age / p.life
    const x = X(p.x), y = Y(p.y)
    if (p.kind === 'number') {
      const img = numberSprite(p.text ?? '', p.color)
      if (img && (fade > .3 || Math.floor(p.age * 20) % 2)) b.drawImage(img, x - Math.floor(img.width / 2), y - Math.floor(img.height / 2))
    } else {
      b.globalAlpha = p.kind === 'dust' ? fade * .9 : Math.min(1, fade * 2)
      b.fillStyle = p.color
      const size = p.kind === 'dust' ? Math.max(1, Math.round(p.size * (1 + p.age * 2))) : p.size
      b.fillRect(x - Math.floor(size / 2), y - Math.floor(size / 2), size, p.kind === 'confetti' ? 1 : size)
      b.globalAlpha = 1
    }
  }

  b.setTransform(1, 0, 0, 1, 0, 0)
  drawRivalArrow(b, race, view, cam, time)

  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(buffer.canvas, 0, 0, view.bw * view.scale, view.bh * view.scale)
}

/** えらぶ がめんの どうぶつの え。size は canvas の ピクセル。 */
export function drawPortrait(ctx: CanvasRenderingContext2D, animalId: string, size: number, state: AnimalState = 'stand', crop = false): void {
  const animal = findAnimal(animalId)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, size, size)
  if (!animal) return
  const img = animalSprite(animal, { state, frame: 0, eyes: state === 'cheer' ? 'happy' : state === 'sad' ? 'closed' : 'open', munch: false })
  if (!img) return
  // かおだけ（うえの 25ドット）を うつす ことも できる。
  const sh = crop ? 25 : img.height
  const k = Math.max(1, Math.floor(size / Math.max(img.width, sh)))
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, 0, 0, img.width, sh, Math.floor((size - img.width * k) / 2), Math.floor((size - sh * k) / 2), img.width * k, sh * k)
}
