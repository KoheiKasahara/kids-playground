import { MODE_RULES, type ChartNote, type Judgement, type RhythmChart } from './rhythmChart'

/**
 * リズムぽんぽん のステージを Canvas 2D で描く。
 * 奥から手前へのびる光る道（遠近法）、つやのある玉のノーツ、叩いたときの粒・波紋・ことばを
 * ここだけで描き、React側は1フレームごとの状態を渡すだけにする。
 */

export type LaneColor = { readonly main: string; readonly light: string; readonly dark: string }

export const LANE_COLORS: Readonly<Record<number, readonly LaneColor[]>> = {
  1: [{ main: '#ff8a3d', light: '#ffd29a', dark: '#c44a12' }],
  3: [
    { main: '#ff5fa2', light: '#ffc1dc', dark: '#b8246a' },
    { main: '#ffc933', light: '#fff0a8', dark: '#c98a00' },
    { main: '#35c9f2', light: '#b8f1ff', dark: '#0f82b0' },
  ],
}

export function laneColors(laneCount: number): readonly LaneColor[] {
  return LANE_COLORS[laneCount] ?? LANE_COLORS[3]
}

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  size: number
  color: string
  star: boolean
  spin: number
}

type Ring = { x: number; y: number; born: number; color: string; radius: number }
type Popup = { x: number; y: number; born: number; judgement: Judgement }

export type StageEffects = {
  particles: Particle[]
  rings: Ring[]
  popups: Popup[]
  /** レーンごとに、最後に押された時刻（秒）。 */
  laneFlash: number[]
}

export function createStageEffects(laneCount: number): StageEffects {
  return { particles: [], rings: [], popups: [], laneFlash: Array.from({ length: laneCount }, () => -10) }
}

export type StageGeometry = {
  width: number
  height: number
  cx: number
  horizonY: number
  hitY: number
  topHalfWidth: number
  bottomHalfWidth: number
}

export function stageGeometry(width: number, height: number, laneCount: number): StageGeometry {
  const bottomHalfWidth = Math.min(width * 0.46, laneCount === 1 ? 190 : 330, height * 0.62)
  return {
    width,
    height,
    cx: width / 2,
    horizonY: height * 0.1,
    hitY: height * 0.8,
    topHalfWidth: bottomHalfWidth * 0.2,
    bottomHalfWidth,
  }
}

/** 画面のx座標から、いちばん近いレーンを返す（道の外をタップしても端のレーンにする）。 */
export function laneAtX(x: number, geometry: StageGeometry, laneCount: number): number {
  const left = geometry.cx - geometry.bottomHalfWidth
  const ratio = (x - left) / (geometry.bottomHalfWidth * 2)
  return Math.max(0, Math.min(laneCount - 1, Math.floor(ratio * laneCount)))
}

/** z=1 が道のいちばん奥、z=0 が判定ライン。手前ほど速く近づいて見えるようにする。 */
function depth(z: number): number {
  return (1 - z) / (1 + 2.3 * z)
}

function project(geometry: StageGeometry, z: number, laneOffset: number) {
  const p = depth(z)
  const halfWidth = geometry.topHalfWidth + (geometry.bottomHalfWidth - geometry.topHalfWidth) * p
  return {
    x: geometry.cx + laneOffset * halfWidth * 2,
    y: geometry.horizonY + (geometry.hitY - geometry.horizonY) * p,
    scale: 0.16 + 0.84 * p,
    halfWidth,
  }
}

function laneOffset(lane: number, laneCount: number): number {
  return (lane + 0.5) / laneCount - 0.5
}

export function laneHitPoint(geometry: StageGeometry, lane: number, laneCount: number): { x: number; y: number } {
  const point = project(geometry, 0, laneOffset(lane, laneCount))
  return { x: point.x, y: point.y }
}

function orbRadius(geometry: StageGeometry, laneCount: number): number {
  return Math.min((geometry.bottomHalfWidth * 2) / laneCount * 0.33, laneCount === 1 ? 62 : 50)
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '')
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// 背景の星は毎フレーム同じ位置に置くため、固定の疑似乱数で作る。
const BACKDROP_STARS = Array.from({ length: 70 }, (_, index) => {
  const seed = Math.sin(index * 127.1) * 43758.5453
  const seed2 = Math.sin(index * 311.7) * 12345.6789
  return {
    x: seed - Math.floor(seed),
    y: (seed2 - Math.floor(seed2)) * 0.62,
    size: 0.6 + ((index * 37) % 10) / 7,
    phase: index * 0.7,
  }
})

const FLOATING_NOTES = ['♪', '♫', '♩', '♬']

export type StageFrame = {
  readonly chart: RhythmChart
  readonly judged: ReadonlyMap<number, Judgement>
  /** 曲の頭からの時刻（ms）。カウントダウン中は負。 */
  readonly songMs: number
  /** 演出用の経過時間（秒）。一時停止中も止めない。 */
  readonly clock: number
  readonly theme: { readonly sky: string; readonly glow: string }
  readonly effects: StageEffects
  readonly reducedMotion: boolean
}

function drawBackdrop(ctx: CanvasRenderingContext2D, geometry: StageGeometry, frame: StageFrame, beatPulse: number) {
  const { width, height, cx, horizonY } = geometry
  const sky = ctx.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, '#080620')
  sky.addColorStop(0.45, frame.theme.sky)
  sky.addColorStop(1, '#0b0718')
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, width, height)

  const glow = ctx.createRadialGradient(cx, horizonY, 0, cx, horizonY, Math.max(width, height) * 0.7)
  glow.addColorStop(0, hexToRgba(frame.theme.glow, 0.42 + beatPulse * 0.12))
  glow.addColorStop(0.35, hexToRgba(frame.theme.glow, 0.1))
  glow.addColorStop(1, hexToRgba(frame.theme.glow, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const star of BACKDROP_STARS) {
    const twinkle = frame.reducedMotion ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(frame.clock * 2.1 + star.phase))
    ctx.fillStyle = `rgba(255, 255, 240, ${0.55 * twinkle})`
    ctx.beginPath()
    ctx.arc(star.x * width, star.y * height, star.size, 0, Math.PI * 2)
    ctx.fill()
  }

  // ステージの左右から、ゆっくり首をふるスポットライト。
  if (!frame.reducedMotion) {
    for (const side of [-1, 1]) {
      const sway = Math.sin(frame.clock * 0.7 + (side > 0 ? 1.4 : 0)) * 0.35
      const originX = cx + side * width * 0.55
      const angle = Math.PI / 2 + side * (0.55 + sway * 0.6)
      const length = height * 1.05
      const spread = 0.16
      const beam = ctx.createLinearGradient(originX, -10, originX + Math.cos(angle) * length, Math.sin(angle) * length)
      beam.addColorStop(0, hexToRgba(frame.theme.glow, 0.22))
      beam.addColorStop(1, hexToRgba(frame.theme.glow, 0))
      ctx.fillStyle = beam
      ctx.beginPath()
      ctx.moveTo(originX, -10)
      ctx.lineTo(originX + Math.cos(angle - spread) * length, Math.sin(angle - spread) * length)
      ctx.lineTo(originX + Math.cos(angle + spread) * length, Math.sin(angle + spread) * length)
      ctx.closePath()
      ctx.fill()
    }

    ctx.font = '600 22px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let index = 0; index < 7; index += 1) {
      const cycle = (frame.clock * 0.07 + index / 7) % 1
      const x = ((index * 0.37 + 0.08) % 1) * width + Math.sin(frame.clock * 0.9 + index) * 18
      const y = height * (0.72 - cycle * 0.7)
      ctx.fillStyle = `rgba(255, 255, 255, ${0.16 * Math.sin(cycle * Math.PI)})`
      ctx.fillText(FLOATING_NOTES[index % FLOATING_NOTES.length], x, y)
    }
  }
  ctx.restore()
}

function drawRoad(ctx: CanvasRenderingContext2D, geometry: StageGeometry, frame: StageFrame, beatPulse: number) {
  const { chart } = frame
  const approachMs = MODE_RULES[chart.mode].approachMs
  const far = project(geometry, 1, 0)
  const near = project(geometry, -0.32, 0)

  // 道の本体：奥が暗く手前がほんのり明るい、半透明のガラスの板。
  const road = ctx.createLinearGradient(0, far.y, 0, near.y)
  road.addColorStop(0, 'rgba(20, 12, 50, 0.35)')
  road.addColorStop(0.7, 'rgba(34, 22, 78, 0.78)')
  road.addColorStop(1, 'rgba(18, 10, 44, 0.92)')
  ctx.fillStyle = road
  ctx.beginPath()
  ctx.moveTo(far.x - far.halfWidth, far.y)
  ctx.lineTo(far.x + far.halfWidth, far.y)
  ctx.lineTo(near.x + near.halfWidth, near.y)
  ctx.lineTo(near.x - near.halfWidth, near.y)
  ctx.closePath()
  ctx.fill()

  const colors = laneColors(chart.laneCount)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  // レーンの色をうすく敷いて、どこを叩けばよいかを色でも示す。
  for (let lane = 0; lane < chart.laneCount; lane += 1) {
    const leftFar = project(geometry, 1, lane / chart.laneCount - 0.5)
    const rightFar = project(geometry, 1, (lane + 1) / chart.laneCount - 0.5)
    const leftNear = project(geometry, -0.32, lane / chart.laneCount - 0.5)
    const rightNear = project(geometry, -0.32, (lane + 1) / chart.laneCount - 0.5)
    const tint = ctx.createLinearGradient(0, far.y, 0, near.y)
    tint.addColorStop(0, hexToRgba(colors[lane].main, 0))
    tint.addColorStop(0.85, hexToRgba(colors[lane].main, 0.13))
    tint.addColorStop(1, hexToRgba(colors[lane].main, 0.05))
    ctx.fillStyle = tint
    ctx.beginPath()
    ctx.moveTo(leftFar.x, leftFar.y)
    ctx.lineTo(rightFar.x, rightFar.y)
    ctx.lineTo(rightNear.x, rightNear.y)
    ctx.lineTo(leftNear.x, leftNear.y)
    ctx.closePath()
    ctx.fill()
  }

  // 拍ごとに流れてくる横線。音楽の「いち・に・さん・し」を目で見せる。
  const firstBeat = Math.floor(frame.songMs / chart.beatMs)
  const lastBeat = Math.ceil((frame.songMs + approachMs) / chart.beatMs)
  for (let beat = firstBeat; beat <= lastBeat; beat += 1) {
    const z = (beat * chart.beatMs - frame.songMs) / approachMs
    if (z < 0 || z > 1) continue
    const left = project(geometry, z, -0.5)
    const right = project(geometry, z, 0.5)
    const strong = ((beat % 2) + 2) % 2 === 0
    ctx.strokeStyle = `rgba(255, 255, 255, ${(strong ? 0.28 : 0.13) * left.scale})`
    ctx.lineWidth = Math.max(1, (strong ? 3 : 1.5) * left.scale)
    ctx.beginPath()
    ctx.moveTo(left.x, left.y)
    ctx.lineTo(right.x, right.y)
    ctx.stroke()
    // 道のふちの電球。
    for (const point of [left, right]) {
      ctx.fillStyle = hexToRgba(frame.theme.glow, 0.85 * point.scale)
      ctx.beginPath()
      ctx.arc(point.x, point.y, 1.5 + 4 * point.scale, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // レーンの区切りと、ふちの光るライン。
  ctx.shadowColor = frame.theme.glow
  ctx.shadowBlur = 10 + beatPulse * 14
  for (let edge = 0; edge <= chart.laneCount; edge += 1) {
    const offset = edge / chart.laneCount - 0.5
    const outer = edge === 0 || edge === chart.laneCount
    const top = project(geometry, 1, offset)
    const bottom = project(geometry, -0.32, offset)
    const line = ctx.createLinearGradient(0, top.y, 0, bottom.y)
    const alpha = outer ? 0.75 + beatPulse * 0.25 : 0.3
    line.addColorStop(0, hexToRgba(frame.theme.glow, 0))
    line.addColorStop(0.6, hexToRgba(outer ? frame.theme.glow : '#ffffff', alpha))
    line.addColorStop(1, hexToRgba(outer ? frame.theme.glow : '#ffffff', alpha * 0.4))
    ctx.strokeStyle = line
    ctx.lineWidth = outer ? 4 : 2
    ctx.beginPath()
    ctx.moveTo(top.x, top.y)
    ctx.lineTo(bottom.x, bottom.y)
    ctx.stroke()
  }
  ctx.restore()
}

function drawReceptors(ctx: CanvasRenderingContext2D, geometry: StageGeometry, frame: StageFrame, beatPulse: number) {
  const { chart } = frame
  const colors = laneColors(chart.laneCount)
  const radius = orbRadius(geometry, chart.laneCount) * 1.18
  const left = project(geometry, 0, -0.5)
  const right = project(geometry, 0, 0.5)

  // 判定ラインの光の帯。
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const band = ctx.createLinearGradient(0, geometry.hitY - 26, 0, geometry.hitY + 26)
  band.addColorStop(0, 'rgba(255,255,255,0)')
  band.addColorStop(0.5, `rgba(255,255,255,${0.16 + beatPulse * 0.12})`)
  band.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = band
  ctx.fillRect(left.x, geometry.hitY - 26, right.x - left.x, 52)
  ctx.restore()

  for (let lane = 0; lane < chart.laneCount; lane += 1) {
    const { x, y } = laneHitPoint(geometry, lane, chart.laneCount)
    const color = colors[lane]
    const flash = Math.max(0, 1 - (frame.clock - frame.effects.laneFlash[lane]) / 0.22)
    const pulse = 1 + beatPulse * 0.05 + flash * 0.08
    const rx = radius * pulse
    const ry = rx * 0.46

    ctx.save()
    // 台座の側面（立体感）。
    ctx.fillStyle = hexToRgba(color.dark, 0.9)
    ctx.beginPath()
    ctx.ellipse(x, y + ry * 0.45, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    // 台座の上面。
    const top = ctx.createRadialGradient(x, y - ry * 0.3, rx * 0.1, x, y, rx)
    top.addColorStop(0, flash > 0 ? hexToRgba(color.light, 0.95) : 'rgba(40, 26, 80, 0.95)')
    top.addColorStop(1, flash > 0 ? hexToRgba(color.main, 0.95) : 'rgba(18, 10, 40, 0.95)')
    ctx.fillStyle = top
    ctx.beginPath()
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowColor = color.main
    ctx.shadowBlur = 16 + flash * 24
    ctx.lineWidth = 4 + flash * 2
    ctx.strokeStyle = color.main
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.lineWidth = 2
    ctx.strokeStyle = hexToRgba(color.light, 0.8)
    ctx.beginPath()
    ctx.ellipse(x, y, rx * 0.62, ry * 0.62, 0, 0, Math.PI * 2)
    ctx.stroke()
    ctx.restore()
  }
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: LaneColor, alpha: number, missed: boolean) {
  ctx.save()
  ctx.globalAlpha = alpha
  // 道に落ちる影。
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
  ctx.beginPath()
  ctx.ellipse(x, y + r * 0.92, r * 0.85, r * 0.26, 0, 0, Math.PI * 2)
  ctx.fill()

  const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.42, r * 0.08, x, y, r)
  if (missed) {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.3, '#b9b4cc')
    body.addColorStop(1, '#4d4866')
  } else {
    body.addColorStop(0, '#ffffff')
    body.addColorStop(0.2, color.light)
    body.addColorStop(0.62, color.main)
    body.addColorStop(1, color.dark)
    ctx.shadowColor = color.main
    ctx.shadowBlur = r * 0.9
  }
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.shadowBlur = 0

  // 下側の照り返しと、上のつやで「ぷるん」とした玉にする。
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
  ctx.lineWidth = Math.max(1, r * 0.07)
  ctx.beginPath()
  ctx.arc(x, y, r * 0.86, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
  ctx.beginPath()
  ctx.ellipse(x - r * 0.3, y - r * 0.46, r * 0.36, r * 0.17, -0.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = missed ? 'rgba(255,255,255,0.6)' : 'rgba(255, 255, 255, 0.96)'
  ctx.font = `800 ${Math.round(r * 0.95)}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = r * 0.15
  ctx.fillText('♪', x + r * 0.04, y + r * 0.1)
  ctx.restore()
}

function drawNotes(ctx: CanvasRenderingContext2D, geometry: StageGeometry, frame: StageFrame) {
  const { chart } = frame
  const approachMs = MODE_RULES[chart.mode].approachMs
  const colors = laneColors(chart.laneCount)
  const baseRadius = orbRadius(geometry, chart.laneCount)
  const visible: { note: ChartNote; z: number }[] = []
  for (const note of chart.notes) {
    const z = (note.timeMs - frame.songMs) / approachMs
    if (z > 1.02 || z < -0.3) continue
    const judgement = frame.judged.get(note.index)
    if (judgement === 'perfect' || judgement === 'good') continue
    if (!note.target && z < 0) continue
    visible.push({ note, z })
  }
  // 奥のノーツから描いて、手前のノーツが上に重なるようにする。
  visible.sort((a, b) => b.z - a.z)

  for (const { note, z } of visible) {
    const point = project(geometry, z, laneOffset(note.lane, chart.laneCount))
    const fadeIn = Math.min(1, (1.02 - z) / 0.15)
    if (!note.target) {
      // 自動で鳴る音は、小さなきらきらで旋律の流れだけを見せる。
      const size = baseRadius * 0.28 * point.scale
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.7 * fadeIn
      ctx.fillStyle = colors[note.lane].light
      ctx.shadowColor = colors[note.lane].main
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(point.x, point.y - size)
      ctx.lineTo(point.x + size * 0.6, point.y)
      ctx.lineTo(point.x, point.y + size)
      ctx.lineTo(point.x - size * 0.6, point.y)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      continue
    }
    const missed = frame.judged.get(note.index) === 'miss'
    const fadeOut = z < 0 ? Math.max(0, 1 + z / 0.3) : 1
    const radius = baseRadius * point.scale
    // 判定ラインに近づいたら、足もとの輪を光らせて「いまだよ」を知らせる。
    if (!missed && z < 0.14 && z > -0.05) {
      const near = 1 - Math.abs(z) / 0.14
      const hit = laneHitPoint(geometry, note.lane, chart.laneCount)
      ctx.save()
      ctx.globalCompositeOperation = 'lighter'
      ctx.strokeStyle = hexToRgba(colors[note.lane].light, 0.7 * near)
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(hit.x, hit.y, baseRadius * (1.25 + near * 0.3), baseRadius * (1.25 + near * 0.3) * 0.46, 0, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
    }
    drawOrb(ctx, point.x, point.y - radius * 0.35, radius, colors[note.lane], fadeIn * fadeOut * (missed ? 0.55 : 1), missed)
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rotation: number) {
  ctx.beginPath()
  for (let point = 0; point < 10; point += 1) {
    const angle = rotation + (point * Math.PI) / 5 - Math.PI / 2
    const radius = point % 2 === 0 ? r : r * 0.45
    ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius)
  }
  ctx.closePath()
  ctx.fill()
}

const POPUP_TEXT: Readonly<Record<Judgement, { text: string; from: string; to: string }>> = {
  perfect: { text: 'すごい！', from: '#fff6b0', to: '#ffb300' },
  good: { text: 'いいね！', from: '#d8fbff', to: '#35c9f2' },
  miss: { text: 'おしい', from: '#f1ecff', to: '#a79cd6' },
}

function drawEffects(ctx: CanvasRenderingContext2D, frame: StageFrame) {
  const { effects, clock } = frame
  effects.rings = effects.rings.filter((ring) => clock - ring.born < 0.5)
  effects.particles = effects.particles.filter((particle) => clock - particle.born < particle.life)
  effects.popups = effects.popups.filter((popup) => clock - popup.born < 0.8)

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (const ring of effects.rings) {
    const t = (clock - ring.born) / 0.5
    const radius = ring.radius * (1 + t * 1.4)
    ctx.strokeStyle = hexToRgba(ring.color, 0.85 * (1 - t))
    ctx.lineWidth = 7 * (1 - t) + 1
    ctx.beginPath()
    ctx.ellipse(ring.x, ring.y, radius, radius * 0.46, 0, 0, Math.PI * 2)
    ctx.stroke()
  }
  for (const particle of effects.particles) {
    const age = clock - particle.born
    const t = age / particle.life
    const x = particle.x + particle.vx * age
    const y = particle.y + particle.vy * age + 520 * age * age
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = particle.color
    if (particle.star) drawStar(ctx, x, y, particle.size * (1 - t * 0.4), particle.spin * age)
    else {
      ctx.beginPath()
      ctx.arc(x, y, particle.size * (1 - t * 0.5), 0, Math.PI * 2)
      ctx.fill()
    }
  }
  ctx.restore()

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (const popup of effects.popups) {
    const t = (clock - popup.born) / 0.8
    const pop = t < 0.18 ? 0.6 + (t / 0.18) * 0.55 : 1.15 - Math.min(1, (t - 0.18) / 0.2) * 0.15
    const style = POPUP_TEXT[popup.judgement]
    const size = (popup.judgement === 'miss' ? 22 : 30) * pop
    const y = popup.y - t * 12
    ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1
    ctx.font = `900 ${size}px system-ui, sans-serif`
    const fill = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2)
    fill.addColorStop(0, style.from)
    fill.addColorStop(1, style.to)
    ctx.lineJoin = 'round'
    ctx.lineWidth = 7
    ctx.strokeStyle = 'rgba(30, 14, 60, 0.85)'
    ctx.strokeText(style.text, popup.x, y)
    ctx.fillStyle = fill
    ctx.fillText(style.text, popup.x, y)
  }
  ctx.restore()
}

/** いまの拍の頭で1になり、次の拍へむけて0へ減る値。ライトの脈動に使う。 */
function beatPulseAt(songMs: number, beatMs: number): number {
  if (songMs < 0) return 0
  const phase = (songMs % beatMs) / beatMs
  return (1 - phase) ** 3
}

export function drawStage(ctx: CanvasRenderingContext2D, geometry: StageGeometry, frame: StageFrame): void {
  const beatPulse = frame.reducedMotion ? 0 : beatPulseAt(frame.songMs, frame.chart.beatMs)
  ctx.clearRect(0, 0, geometry.width, geometry.height)
  drawBackdrop(ctx, geometry, frame, beatPulse)
  drawRoad(ctx, geometry, frame, beatPulse)
  drawReceptors(ctx, geometry, frame, beatPulse)
  drawNotes(ctx, geometry, frame)
  drawEffects(ctx, frame)
}

/** 叩いたときの粒・波紋・ことばを足す。 */
export function emitHitEffects(
  effects: StageEffects,
  geometry: StageGeometry,
  laneCount: number,
  lane: number,
  judgement: Judgement,
  clock: number,
  reducedMotion: boolean,
): void {
  const color = laneColors(laneCount)[lane]
  const { x, y } = laneHitPoint(geometry, lane, laneCount)
  const radius = orbRadius(geometry, laneCount) * 1.18
  // ことばは受け皿の下に出す。上に出すと、次に落ちてくるノーツと重なって見えにくい。
  effects.popups.push({ x, y: Math.min(y + radius * 0.76 + 20, geometry.height - 20), born: clock, judgement })
  if (judgement === 'miss') return
  effects.rings.push({ x, y, born: clock, color: color.light, radius })
  if (judgement === 'perfect') effects.rings.push({ x, y, born: clock + 0.08, color: '#ffffff', radius: radius * 0.8 })
  const count = reducedMotion ? 6 : judgement === 'perfect' ? 26 : 14
  const palette = [color.main, color.light, '#ffffff', '#ffe066']
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.5
    const speed = 160 + Math.random() * (judgement === 'perfect' ? 380 : 240)
    effects.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      born: clock,
      life: 0.55 + Math.random() * 0.45,
      size: 3 + Math.random() * (judgement === 'perfect' ? 7 : 5),
      color: palette[index % palette.length],
      star: index % 3 === 0,
      spin: (Math.random() - 0.5) * 10,
    })
  }
}

/** 自動で鳴る音が判定ラインを通ったときの、小さなきらめき。 */
export function emitAutoSparkle(effects: StageEffects, geometry: StageGeometry, laneCount: number, lane: number, clock: number): void {
  const color = laneColors(laneCount)[lane]
  const { x, y } = laneHitPoint(geometry, lane, laneCount)
  for (let index = 0; index < 4; index += 1) {
    const angle = -Math.PI / 2 + (index - 1.5) * 0.5
    effects.particles.push({
      x, y, vx: Math.cos(angle) * 120, vy: Math.sin(angle) * 160, born: clock, life: 0.4, size: 2.5, color: color.light, star: false, spin: 0,
    })
  }
}

export function markLanePressed(effects: StageEffects, lane: number, clock: number): void {
  effects.laneFlash[lane] = clock
}
