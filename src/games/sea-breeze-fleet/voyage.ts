import { chartHeight, chartWidth, shoreDistance, type Chart, type Point } from './charts'

export type Hull = 'skipper' | 'pirate' | 'flagship' | 'mail'
export type Vessel = Point & {
  kind: Hull; heading: number; aim: number; hp: number; maxHp: number; speed: number
  home: Point; reload: number; flash: number; muzzle: number
}
type Shot = { start: Point; end: Point; age: number; duration: number; friendly: boolean }
export type Burst = Point & { age: number; type: 'splash' | 'hit' | 'stars' }
export type Voyage = {
  chart: Chart; phase: 'ready' | 'sailing' | 'won' | 'lost'
  player: Vessel; pirates: Vessel[]; mail?: Vessel; target: number
  course: Point | null; closingIn: boolean; time: number; shots: Shot[]; bursts: Burst[]
}
export type Cue = 'start' | 'water' | 'splash' | 'retreat' | 'bump' | 'clear' | 'return'
export type Helm = { dx: number; dy: number; firing: boolean }
export const emptyHelm = (): Helm => ({ dx: 0, dy: 0, firing: false })
export const reloadTime = 0.75
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function ship(kind: Hull, home: Point, hp: number, heading: number): Vessel {
  return { ...home, home, hp, maxHp: hp, kind, heading, aim: heading, speed: 0, reload: 0, flash: 0, muzzle: 0 }
}

export function newVoyage(chart: Chart): Voyage {
  const pirates = chart.pirates.map((home, i) => {
    const boss = chart.kind === 'flagship' && i === 0
    const pirate = ship(boss ? 'flagship' : 'pirate', home, boss ? 6 : 2, Math.PI - 0.25 - i * 0.28)
    pirate.reload = 3.5 + i * 1.6
    return pirate
  })
  return {
    chart, phase: 'ready', time: 0, course: null, closingIn: false, target: 0, shots: [], bursts: [], pirates,
    player: ship('skipper', { x: 173, y: 194 }, 5, -0.47),
    mail: chart.kind === 'escort' ? ship('mail', { x: 64, y: 144 }, 4, 0.18) : undefined,
  }
}

function nextPirate(v: Voyage, from: number) {
  for (let i = 1; i <= v.pirates.length; i++) {
    const index = (from + i) % v.pirates.length
    if (v.pirates[index].hp > 0) return index
  }
  return -1
}

export function cycleTarget(v: Voyage) {
  if (v.phase === 'sailing') {
    v.target = nextPirate(v, v.target)
    if (v.closingIn) { v.closingIn = false; v.course = null }
  }
}

function launch(v: Voyage, from: Vessel, end: Point, friendly: boolean) {
  from.aim = Math.atan2(end.y - from.y, end.x - from.x)
  from.muzzle = 0.16
  const reach = from.kind === 'skipper' || from.kind === 'flagship' ? 20 : 13
  // Start at the bow mount, so the water leaves the same rotating nozzle the player sees.
  const start = {
    x: from.x + reach * Math.cos(from.heading) + 9 * Math.cos(from.aim),
    y: from.y + reach * Math.sin(from.heading) + 9 * Math.sin(from.aim),
  }
  v.shots.push({ start, end: { ...end }, age: 0, duration: friendly ? 0.45 + distance(start, end) / 1200 : 2.0, friendly })
}

export function fireWater(v: Voyage) {
  const target = v.pirates[v.target]
  if (v.phase !== 'sailing' || !target || target.hp <= 0) return false
  if (distance(v.player, target) > 210) {
    v.closingIn = true
    return false
  }
  if (v.player.reload > 0) return false
  if (v.closingIn) v.course = null
  v.closingIn = false
  launch(v, v.player, target, true)
  v.player.reload = reloadTime
  return true
}

export function steerToward(v: Voyage, point: Point) {
  if (v.phase !== 'sailing') return
  v.closingIn = false
  v.course = {
    x: Math.max(22, Math.min(chartWidth - 22, point.x)),
    y: Math.max(28, Math.min(chartHeight - 17, point.y)),
  }
}

function turn(angle: number, toward: number, limit: number) {
  const delta = Math.atan2(Math.sin(toward - angle), Math.cos(toward - angle))
  return angle + Math.max(-limit, Math.min(limit, delta))
}

function underway(v: Voyage, s: Vessel, dx: number, dy: number, speed: number, dt: number) {
  s.speed = Math.min(1, s.speed + dt * 2.4)
  s.heading = turn(s.heading, Math.atan2(dy, dx), dt * 3.8)
  const advance = dt * speed * s.speed
  const x = Math.max(21, Math.min(chartWidth - 21, s.x + Math.cos(s.heading) * advance))
  const y = Math.max(26, Math.min(chartHeight - 16, s.y + Math.sin(s.heading) * advance))
  const open = (px: number, py: number) => shoreDistance(px, py, v.chart.islands) > 10
  if (open(x, y)) { s.x = x; s.y = y }
  else if (open(x, s.y)) s.x = x
  else if (open(s.x, y)) s.y = y
}

function updateSkipper(v: Voyage, helm: Helm, dt: number) {
  const p = v.player
  const target = v.pirates[v.target]
  if (v.closingIn && target) v.course = { x: target.x, y: target.y }
  if (helm.dx || helm.dy) {
    v.closingIn = false
    v.course = null
    underway(v, p, helm.dx, helm.dy, 86, dt)
  } else if (v.course && distance(v.course, p) > 5) {
    underway(v, p, v.course.x - p.x, v.course.y - p.y, 86, dt)
  } else {
    p.speed = Math.max(0, p.speed - dt * 2)
    v.course = null
  }
  if (target) p.aim = Math.atan2(target.y - p.y, target.x - p.x)
}

function advancePirate(v: Voyage, s: Vessel, index: number, dt: number) {
  const angle = v.time * 0.27 + index * 1.95
  const x = s.home.x + 36 * Math.cos(angle)
  const y = s.home.y + 19 * Math.sin(angle)
  underway(v, s, x - s.x, y - s.y, 15, dt)
  const target = v.mail && index % 2 === 0 ? v.mail : v.player
  s.aim = Math.atan2(target.y - s.y, target.x - s.x)
  if (s.reload <= 0) {
    const landing = target === v.mail ? { x: target.x + 14, y: target.y } : target
    launch(v, s, landing, false)
    if (s.kind === 'flagship') {
      // The parent ship paints a line of three rings; there is room to sail around either end.
      launch(v, s, { x: landing.x - 40, y: landing.y }, false)
      launch(v, s, { x: landing.x + 40, y: landing.y }, false)
      s.aim = Math.atan2(target.y - s.y, target.x - s.x)
    }
    s.reload = (s.kind === 'flagship' ? 5.5 : 9.5) + index * 0.35
  }
}

function splashDown(v: Voyage, shot: Shot, cues: Cue[]) {
  const candidates = shot.friendly ? v.pirates : v.mail ? [v.player, v.mail] : [v.player]
  const hit = candidates.filter(s => s.hp > 0 && distance(s, shot.end) < (s.kind === 'flagship' ? 34 : 23))
    .sort((a, b) => distance(a, shot.end) - distance(b, shot.end))[0]
  let type: Burst['type'] = 'splash'
  if (hit && (shot.friendly || hit.flash <= 0)) {
    hit.hp--
    hit.flash = shot.friendly ? 0.24 : 1.3
    type = hit.hp === 0 && shot.friendly ? 'stars' : 'hit'
    if (shot.friendly && v.pirates[v.target]?.hp === 0) cycleTarget(v)
    cues.push(type === 'stars' ? 'retreat' : shot.friendly ? 'splash' : 'bump')
  }
  v.bursts.push({ ...shot.end, type, age: 0 })
}

export function voyageStars(v: Voyage) {
  const health = Math.min(v.player.hp / v.player.maxHp, v.mail ? v.mail.hp / v.mail.maxHp : 1)
  return health >= 0.8 ? 3 : health >= 0.4 ? 2 : 1
}

export function tickVoyage(v: Voyage, helm: Helm, dt: number): Cue[] {
  if (v.phase !== 'sailing') return []
  const cues: Cue[] = []
  v.time += dt
  for (const s of [v.player, ...v.pirates, ...(v.mail ? [v.mail] : [])]) {
    s.flash = Math.max(0, s.flash - dt)
    s.muzzle = Math.max(0, s.muzzle - dt)
    s.reload = Math.max(0, s.reload - dt)
  }
  updateSkipper(v, helm, dt)
  if ((v.closingIn || helm.firing) && fireWater(v)) cues.push('water')
  v.pirates.forEach((s, i) => { if (s.hp > 0) advancePirate(v, s, i, dt) })
  if (v.mail) {
    const speed = v.pirates.every(s => !s.hp) ? 48 : 15
    underway(v, v.mail, 1, 0.16 * Math.sin(v.time * 0.17), speed, dt)
  }
  v.bursts = v.bursts.filter(b => (b.age += dt) < 1.15)
  for (const shot of v.shots) {
    shot.age += dt
    if (shot.age >= shot.duration) splashDown(v, shot, cues)
  }
  v.shots = v.shots.filter(shot => shot.age < shot.duration)
  if (v.player.hp <= 0 || v.mail?.hp === 0) v.phase = 'lost'
  else if (v.mail ? v.mail.x >= 535 : v.pirates.every(s => !s.hp)) v.phase = 'won'
  if (v.phase !== 'sailing') cues.push(v.phase === 'won' ? 'clear' : 'return')
  return cues
}
