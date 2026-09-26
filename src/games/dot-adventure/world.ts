// ぼうけんの すすみかた（絵を かかない 純粋な けいさん）。
// マスの 地図・あるく ルートさがし・なかまの ついてくる うごき・かけらと たからばこ を あつかう。

import { hash2 } from './pixel'
import { GROUND_CHARS, OBJECT_CHARS, WATER_CHARS, type FriendDef, type GimmickDef, type StageDef } from './stages'

export const TILE = 16
/** 1フレーム（1/60びょう）に すすむ ドット数。 */
export const WALK_SPEED = 1.25
const FRIEND_GAP = 17
const PICK_RADIUS = 13
const JOIN_RADIUS = 15
const CHEST_RADIUS = 22
/** しかけの そばに きた と みなす きょり。 */
const GATE_RADIUS = 24
const TORCH_RADIUS = 22
const SWITCH_RADIUS = 10

export type Point = { x: number; y: number }
export type Dir = 'down' | 'up' | 'left' | 'right'
export type MapObject = { kind: string; tx: number; ty: number; seed: number }
export type Tile = { tx: number; ty: number }

export type Level = {
  w: number
  h: number
  /** マスごとの じめんの もじ。 */
  ground: string[]
  objects: MapObject[]
  solid: Uint8Array
  shards: Point[]
  friendSpawns: Point[]
  chest: Point
  start: Point
  /** しかけで とおせんぼ している マス。 */
  gates: Tile[]
  switches: Point[]
  torches: Tile[]
}

export const tileCenter = (tx: number, ty: number): Point => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 + 2 })

/** 地図の もじを じめん・もの・ばしょ に わける。 */
export function parseLevel(stage: StageDef): Level {
  const h = stage.map.length
  const w = stage.map[0].length
  const ground: string[] = new Array(w * h)
  const objects: MapObject[] = []
  const shards: Point[] = []
  const friendSpawns: Point[] = []
  const gates: Tile[] = []
  const switches: Point[] = []
  const torches: Tile[] = []
  let chest: Point | null = null
  let start: Point | null = null
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= w || y >= h ? '' : stage.map[y][x])
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = at(x, y)
    if (GROUND_CHARS.includes(c)) { ground[y * w + x] = c; continue }
    if (c === 'L') { ground[y * w + x] = '~'; objects.push({ kind: 'L', tx: x, ty: y, seed: x * 31 + y }); continue }
    // もの・ばしょ の 下の じめんは まわりで いちばん おおい じめんに する。
    const counts: Record<string, number> = {}
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
      const n = at(x + dx, y + dy)
      if (n && GROUND_CHARS.includes(n) && !'~#'.includes(n)) counts[n] = (counts[n] ?? 0) + (Math.abs(dx) + Math.abs(dy) === 1 ? 2 : 1)
    }
    const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
    // きれた はしの ところは みずの まま。
    ground[y * w + x] = c === 'h' ? 's' : c === 'G' && stage.gimmick.kind === 'bridge' ? '~' : best ?? '.'
    if (c === 'u') torches.push({ tx: x, ty: y })
    if (OBJECT_CHARS.includes(c) || c === 'h') objects.push({ kind: c, tx: x, ty: y, seed: x * 131 + y * 7 })
    else if (c === 'G') gates.push({ tx: x, ty: y })
    else if (c === 'k') switches.push(tileCenter(x, y))
    else if (c === '*') shards.push(tileCenter(x, y))
    else if (c === 'm') friendSpawns.push(tileCenter(x, y))
    else if (c === 'C') chest = tileCenter(x, y)
    else if (c === '@') start = tileCenter(x, y)
  }
  const solid = new Uint8Array(w * h)
  for (let i = 0; i < w * h; i++) if (WATER_CHARS.includes(ground[i])) solid[i] = 1
  for (const o of objects) if (o.kind !== 'h') solid[o.ty * w + o.tx] = 1
  for (const g of gates) solid[g.ty * w + g.tx] = 1
  if (!chest || !start) throw new Error(`stage ${stage.id} needs C and @`)
  return { w, h, ground, objects, solid, shards, friendSpawns, chest, start, gates, switches, torches }
}

export function isSolidTile(level: Level, tx: number, ty: number) {
  if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return true
  return level.solid[ty * level.w + tx] === 1
}

/** 足もとの 小さな はこ（はば10・たかさ6）が かべに ぶつかるか。 */
export function blocked(level: Level, x: number, y: number, extra?: Point | null) {
  const x0 = Math.floor((x - 5) / TILE), x1 = Math.floor((x + 4.99) / TILE)
  const y0 = Math.floor((y - 4) / TILE), y1 = Math.floor((y + 1.99) / TILE)
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (isSolidTile(level, tx, ty)) return true
  if (extra && Math.abs(x - extra.x) < 11 && y > extra.y - 9 && y < extra.y + 5) return true
  return false
}

/** マスの 上を 8ほうこうに すすむ A*。かどを ななめに すりぬけない。 */
export function findPath(level: Level, from: Point, to: Point, extraSolid?: (tx: number, ty: number) => boolean): Point[] | null {
  const { w, h } = level
  const sx = Math.floor(from.x / TILE), sy = Math.floor((from.y - 2) / TILE)
  const solidAt = (x: number, y: number) => isSolidTile(level, x, y) || (extraSolid?.(x, y) ?? false)
  let gx = Math.floor(to.x / TILE), gy = Math.floor((to.y - 2) / TILE)
  if (solidAt(gx, gy)) {
    const near = nearestOpen(level, gx, gy, sx, sy, solidAt)
    if (!near) return null
    ;[gx, gy] = near
  }
  if (sx === gx && sy === gy) return [to]
  const size = w * h
  const g = new Float32Array(size).fill(Infinity)
  const f = new Float32Array(size).fill(Infinity)
  const came = new Int32Array(size).fill(-1)
  const closed = new Uint8Array(size)
  const open: number[] = []
  const start = sy * w + sx, goal = gy * w + gx
  g[start] = 0
  f[start] = Math.hypot(gx - sx, gy - sy)
  open.push(start)
  while (open.length) {
    let bi = 0
    for (let i = 1; i < open.length; i++) if (f[open[i]] < f[open[bi]]) bi = i
    const cur = open[bi]
    open[bi] = open[open.length - 1]
    open.pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    const cx = cur % w, cy = (cur - cx) / w
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue
      const nx = cx + dx, ny = cy + dy
      if (solidAt(nx, ny)) continue
      if (dx && dy && (solidAt(cx + dx, cy) || solidAt(cx, cy + dy))) continue
      const ni = ny * w + nx
      if (closed[ni]) continue
      const cost = g[cur] + (dx && dy ? 1.414 : 1)
      if (cost < g[ni]) {
        g[ni] = cost
        f[ni] = cost + Math.hypot(gx - nx, gy - ny)
        came[ni] = cur
        open.push(ni)
      }
    }
  }
  if (came[goal] < 0) return null
  const tiles: number[] = []
  for (let c = goal; c !== start; c = came[c]) tiles.push(c)
  tiles.reverse()
  const points = tiles.map(i => tileCenter(i % w, Math.floor(i / w)))
  // さいごは タップした ばしょ（とおれるなら）へ。
  if (!solidAt(Math.floor(to.x / TILE), Math.floor((to.y - 2) / TILE)) && !blocked(level, to.x, to.y)) points[points.length - 1] = { ...to }
  return smoothPath(level, from, points, solidAt)
}

function nearestOpen(level: Level, gx: number, gy: number, sx: number, sy: number, solidAt: (x: number, y: number) => boolean): [number, number] | null {
  let best: [number, number] | null = null
  let bestScore = Infinity
  for (let r = 1; r <= 4 && !best; r++) {
    for (let y = gy - r; y <= gy + r; y++) for (let x = gx - r; x <= gx + r; x++) {
      if (Math.max(Math.abs(x - gx), Math.abs(y - gy)) !== r || solidAt(x, y) || x < 0 || y < 0 || x >= level.w || y >= level.h) continue
      // タップした ところに ちかく、いまいる ほうに ちかい マスを えらぶ。
      const score = Math.hypot(x - gx, y - gy) * 4 + Math.hypot(x - sx, y - sy) * .1
      if (score < bestScore) { bestScore = score; best = [x, y] }
    }
  }
  return best
}

/** まっすぐ いける ところは まがりかどを はぶく。 */
function smoothPath(level: Level, from: Point, points: Point[], solidAt: (x: number, y: number) => boolean): Point[] {
  const out: Point[] = []
  let anchor = from
  let i = 0
  while (i < points.length) {
    let j = points.length - 1
    while (j > i && !clearLine(level, anchor, points[j], solidAt)) j--
    out.push(points[j])
    anchor = points[j]
    i = j + 1
  }
  return out
}

function clearLine(level: Level, a: Point, b: Point, solidAt: (x: number, y: number) => boolean) {
  const d = Math.hypot(b.x - a.x, b.y - a.y)
  const n = Math.ceil(d / 3)
  for (let s = 1; s <= n; s++) {
    const x = a.x + (b.x - a.x) * s / n, y = a.y + (b.y - a.y) * s / n
    if (blocked(level, x, y)) return false
    for (const [ox, oy] of [[-5, -4], [5, -4], [-5, 2], [5, 2]]) if (solidAt(Math.floor((x + ox) / TILE), Math.floor((y + oy) / TILE))) return false
  }
  return true
}

// ---------------- せかいの じょうたい ----------------

export type Friend = {
  def: FriendDef
  x: number
  y: number
  home: Point
  dir: Dir
  joined: boolean
  /** はねる うごきの じかん。 */
  hop: number
  target: Point | null
  wait: number
  moving: boolean
}

export type WorldEvent =
  | { type: 'shard'; x: number; y: number; left: number }
  | { type: 'join'; friend: FriendDef; x: number; y: number }
  | { type: 'chest-appear'; x: number; y: number }
  | { type: 'chest-open'; x: number; y: number }
  | { type: 'bump'; x: number; y: number }
  /** しかけの そばに きたけど まだ とけていない。need は あと なんにん / なんこ。 */
  | { type: 'gimmick-hint'; kind: GimmickDef['kind']; x: number; y: number; need: number }
  | { type: 'switch'; x: number; y: number }
  | { type: 'torch'; x: number; y: number; left: number }
  | { type: 'gate-open'; kind: GimmickDef['kind']; x: number; y: number }

export type Hero = { x: number; y: number; dir: Dir; moving: boolean; walk: number }

export type Gimmick = {
  def: GimmickDef
  open: boolean
  /** ひらいた ときの world.frame（えんしゅつ よう）。 */
  openFrame: number
  pressed: boolean
  lit: boolean[]
  /** いわを おした むき。 */
  push: Point
  /** いま しかけの そばに いるか（ヒントを 1かいだけ だす ため）。 */
  near: boolean
}

export type World = {
  level: Level
  hero: Hero
  path: Point[]
  trail: Point[]
  friends: Friend[]
  shards: { x: number; y: number; taken: boolean }[]
  chest: { x: number; y: number; visible: boolean; open: boolean }
  gimmick: Gimmick
  state: 'play' | 'clear'
  frame: number
  events: WorldEvent[]
  stuck: number
}

export function createWorld(stage: StageDef): World {
  const level = parseLevel(stage)
  const hero: Hero = { x: level.start.x, y: level.start.y, dir: 'down', moving: false, walk: 0 }
  return {
    level,
    hero,
    path: [],
    trail: [{ x: hero.x, y: hero.y }],
    friends: level.friendSpawns.map((p, i) => ({
      def: stage.friends[i % stage.friends.length], x: p.x, y: p.y, home: { ...p }, dir: 'down' as Dir,
      joined: false, hop: i * 17, target: null, wait: 30 + i * 40, moving: false,
    })),
    shards: level.shards.map(p => ({ ...p, taken: false })),
    chest: { ...level.chest, visible: false, open: false },
    gimmick: {
      def: stage.gimmick, open: level.gates.length === 0, openFrame: -1, pressed: false,
      lit: level.torches.map(() => false), push: { x: 0, y: -1 }, near: false,
    },
    state: 'play',
    frame: 0,
    events: [],
    stuck: 0,
  }
}

const chestBlock = (world: World) => (world.chest.visible ? world.chest : null)

/** タップした ばしょへ あるきだす。とどかない ときは false。 */
export function walkTo(world: World, target: Point): boolean {
  if (world.state !== 'play') return false
  const chest = chestBlock(world)
  const ctx = chest ? Math.floor(chest.x / TILE) : -1, cty = chest ? Math.floor((chest.y - 2) / TILE) : -1
  const extra = chest ? (x: number, y: number) => x === ctx && y === cty : undefined
  let path = findPath(world.level, world.hero, target, extra)
  // しかけの むこうを タップしたら、とおせんぼの まえまで いく。
  if (!path && !world.gimmick.open) {
    const gate = gateApproach(world, target)
    if (gate) path = findPath(world.level, world.hero, gate, extra)
  }
  if (!path) return false
  world.path = path
  world.stuck = 0
  return true
}

export function stopWalking(world: World) {
  world.path = []
}

const dirOf = (dx: number, dy: number, prev: Dir): Dir => {
  if (Math.abs(dx) < .01 && Math.abs(dy) < .01) return prev
  // よこと たての どちらが 大きいかで むきを きめる（ななめは すこし たて よりに）。
  if (Math.abs(dx) > Math.abs(dy) * 1.15) return dx > 0 ? 'right' : 'left'
  return dy > 0 ? 'down' : 'up'
}

/** からだを うごかす。かべに あたったら かべに そって すべる。 */
function moveBody(world: World, x: number, y: number, dx: number, dy: number) {
  const chest = chestBlock(world)
  let nx = x, ny = y
  if (!blocked(world.level, x + dx, y, chest)) nx = x + dx
  if (!blocked(world.level, nx, y + dy, chest)) ny = y + dy
  return { x: nx, y: ny }
}

/**
 * 1フレーム すすめる。input は キーボードの むき（-1〜1）。
 * キーを おしている あいだは タップの ルートより キーを ゆうせんする。
 */
export function stepWorld(world: World, input: Point = { x: 0, y: 0 }) {
  world.frame++
  const hero = world.hero
  let dx = 0, dy = 0
  if (world.state === 'play') {
    if (input.x || input.y) {
      world.path = []
      const l = Math.hypot(input.x, input.y)
      dx = input.x / l * WALK_SPEED
      dy = input.y / l * WALK_SPEED
    } else if (world.path.length) {
      const next = world.path[0]
      const ddx = next.x - hero.x, ddy = next.y - hero.y
      const d = Math.hypot(ddx, ddy)
      if (d <= WALK_SPEED) {
        dx = ddx; dy = ddy
        world.path.shift()
      } else {
        dx = ddx / d * WALK_SPEED
        dy = ddy / d * WALK_SPEED
      }
    }
  }
  const before = { x: hero.x, y: hero.y }
  if (dx || dy) {
    const moved = moveBody(world, hero.x, hero.y, dx, dy)
    hero.x = moved.x
    hero.y = moved.y
    hero.dir = dirOf(dx, dy, hero.dir)
  }
  const traveled = Math.hypot(hero.x - before.x, hero.y - before.y)
  hero.moving = traveled > .05
  if (hero.moving) {
    hero.walk += traveled
    world.stuck = 0
    const last = world.trail[world.trail.length - 1]
    if (Math.hypot(hero.x - last.x, hero.y - last.y) >= 1) {
      world.trail.push({ x: hero.x, y: hero.y })
      if (world.trail.length > 400) world.trail.splice(0, world.trail.length - 400)
    }
  } else if (world.path.length) {
    // なにかに ひっかかって すすめない ときは あきらめる。
    if (++world.stuck > 20) { world.path = []; world.events.push({ type: 'bump', x: hero.x, y: hero.y }) }
  }
  updateFriends(world)
  if (world.state !== 'play') return
  updateGimmick(world)
  for (const shard of world.shards) {
    if (shard.taken || Math.hypot(shard.x - hero.x, shard.y - hero.y) > PICK_RADIUS) continue
    shard.taken = true
    const left = world.shards.filter(s => !s.taken).length
    world.events.push({ type: 'shard', x: shard.x, y: shard.y, left })
    if (left === 0) {
      world.chest.visible = true
      world.events.push({ type: 'chest-appear', x: world.chest.x, y: world.chest.y })
      // もし たからばこの ばしょに たっていたら すこし どく。
      if (blocked(world.level, hero.x, hero.y, world.chest)) hero.y = world.chest.y + 8
    }
  }
  if (world.chest.visible && !world.chest.open && Math.hypot(world.chest.x - hero.x, world.chest.y - hero.y) < CHEST_RADIUS) {
    world.chest.open = true
    world.state = 'clear'
    world.path = []
    world.events.push({ type: 'chest-open', x: world.chest.x, y: world.chest.y })
  }
}

/** trail を うしろから distance だけ たどった ばしょ。 */
export function trailPoint(trail: readonly Point[], distance: number): Point {
  let remain = distance
  for (let i = trail.length - 1; i > 0; i--) {
    const a = trail[i], b = trail[i - 1]
    const seg = Math.hypot(a.x - b.x, a.y - b.y)
    if (seg >= remain) {
      const t = seg ? remain / seg : 0
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    }
    remain -= seg
  }
  return { ...trail[0] }
}

function updateFriends(world: World) {
  const hero = world.hero
  let order = 0
  for (const f of world.friends) {
    f.hop++
    if (f.joined) {
      order++
      const p = trailPoint(world.trail, FRIEND_GAP * order)
      const ddx = p.x - f.x, ddy = p.y - f.y
      const d = Math.hypot(ddx, ddy)
      if (d > .3) {
        // すこし おくれて ついてくる。
        const k = Math.min(1, WALK_SPEED * 1.4 / d)
        f.x += ddx * k
        f.y += ddy * k
        f.dir = dirOf(ddx, ddy, f.dir)
        f.moving = true
      } else f.moving = hero.moving
      continue
    }
    // まだ なかまに なっていない ときは おうちの まわりを ぶらぶら。
    if (world.state === 'play' && Math.hypot(f.x - hero.x, f.y - hero.y) < JOIN_RADIUS) {
      f.joined = true
      f.moving = false
      world.events.push({ type: 'join', friend: f.def, x: f.x, y: f.y })
      continue
    }
    if (f.target) {
      const ddx = f.target.x - f.x, ddy = f.target.y - f.y
      const d = Math.hypot(ddx, ddy)
      if (d < .6) { f.target = null; f.wait = 60 + Math.floor(hash2(world.frame, f.home.x, 3) * 90); f.moving = false; continue }
      const s = .45
      const moved = moveBody(world, f.x, f.y, ddx / d * s, ddy / d * s)
      if (moved.x === f.x && moved.y === f.y) { f.target = null; f.wait = 40; f.moving = false; continue }
      f.dir = dirOf(ddx, ddy, f.dir)
      f.x = moved.x
      f.y = moved.y
      f.moving = true
    } else if (--f.wait <= 0) {
      const a = hash2(world.frame, f.home.y, 5) * Math.PI * 2
      const r = 6 + hash2(world.frame, f.home.x, 6) * 18
      f.target = { x: f.home.x + Math.cos(a) * r, y: f.home.y + Math.sin(a) * r * .7 }
    }
  }
}

function nearestGate(level: Level, p: Point): Point | null {
  let best: Point | null = null, bd = Infinity
  for (const g of level.gates) {
    const c = tileCenter(g.tx, g.ty)
    const d = Math.hypot(c.x - p.x, c.y - p.y)
    if (d < bd) { bd = d; best = c }
  }
  return best
}

/** とおせんぼの てまえで、いま いける マスのうち target に いちばん ちかい ところ。 */
function gateApproach(world: World, target: Point): Point | null {
  const reach = reachMap(world)
  if (!reach) return null
  const { level } = world
  let best: Point | null = null, bd = Infinity
  for (const g of level.gates) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = g.tx + dx, y = g.ty + dy
    if (x < 0 || y < 0 || x >= level.w || y >= level.h || !reach[y * level.w + x]) continue
    const c = tileCenter(x, y)
    const d = Math.hypot(c.x - target.x, c.y - target.y)
    if (d < bd) { bd = d; best = c }
  }
  return best
}

function gateCenter(level: Level): Point {
  const cs = level.gates.map(g => tileCenter(g.tx, g.ty))
  return { x: cs.reduce((a, c) => a + c.x, 0) / cs.length, y: cs.reduce((a, c) => a + c.y, 0) / cs.length }
}

function openGate(world: World) {
  const g = world.gimmick
  const level = world.level
  g.open = true
  g.openFrame = world.frame
  for (const t of level.gates) level.solid[t.ty * level.w + t.tx] = 0
  const c = gateCenter(level)
  world.events.push({ type: 'gate-open', kind: g.def.kind, x: c.x, y: c.y })
}

/** しかけを しらべる。とけたら とおせんぼの マスを とおれるように する。 */
function updateGimmick(world: World) {
  const g = world.gimmick
  if (g.open) return
  const hero = world.hero
  const level = world.level
  const dist = (p: Point) => Math.hypot(p.x - hero.x, p.y - hero.y)
  let near: Point | null = null
  for (const t of level.gates) {
    const c = tileCenter(t.tx, t.ty)
    if (dist(c) < GATE_RADIUS) { near = c; break }
  }
  const def = g.def
  if (def.kind === 'boulder') {
    if (near && friendsJoined(world) >= def.need) {
      const d = Math.hypot(near.x - hero.x, near.y - hero.y) || 1
      g.push = { x: (near.x - hero.x) / d, y: (near.y - hero.y) / d }
      openGate(world)
      return
    }
  } else if (def.kind === 'bridge') {
    const sw = level.switches.find(s => dist(s) < SWITCH_RADIUS)
    if (sw && !g.pressed) {
      g.pressed = true
      world.events.push({ type: 'switch', x: sw.x, y: sw.y })
      openGate(world)
      return
    }
  } else {
    level.torches.forEach((t, i) => {
      if (g.lit[i]) return
      const c = tileCenter(t.tx, t.ty)
      if (dist(c) >= TORCH_RADIUS) return
      g.lit[i] = true
      world.events.push({ type: 'torch', x: c.x, y: c.y, left: g.lit.filter(l => !l).length })
    })
    if (g.lit.every(Boolean)) { openGate(world); return }
  }
  if (near && !g.near) {
    const need = def.kind === 'boulder' ? def.need - friendsJoined(world) : def.kind === 'torch' ? g.lit.filter(l => !l).length : 1
    world.events.push({ type: 'gimmick-hint', kind: def.kind, x: near.x, y: near.y, need })
  }
  g.near = !!near
}

/** 主人公から あるいて いける マス（しかけの むこうは はいらない）。 */
function reachMap(world: World) {
  const level = world.level
  const seen = new Uint8Array(level.w * level.h)
  const sx = Math.floor(world.hero.x / TILE), sy = Math.floor((world.hero.y - 2) / TILE)
  if (isSolidTile(level, sx, sy)) return null
  const queue = [sy * level.w + sx]
  seen[queue[0]] = 1
  while (queue.length) {
    const i = queue.pop()!
    const x = i % level.w, y = (i - x) / level.w
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (isSolidTile(level, nx, ny)) continue
      const ni = ny * level.w + nx
      if (seen[ni]) continue
      seen[ni] = 1
      queue.push(ni)
    }
  }
  return seen
}

/** しかけを とく ために いく ところ。 */
function gimmickGoal(world: World): Point | null {
  const g = world.gimmick
  const level = world.level
  const hero = world.hero
  const nearest = (list: Point[]) => {
    let best: Point | null = null, bd = Infinity
    for (const p of list) {
      const d = Math.hypot(p.x - hero.x, p.y - hero.y)
      if (d < bd) { bd = d; best = p }
    }
    return best
  }
  if (g.def.kind === 'boulder' && friendsJoined(world) < g.def.need) return nearest(world.friends.filter(f => !f.joined)) ?? nearestGate(level, hero)
  if (g.def.kind === 'bridge') return nearest(level.switches)
  if (g.def.kind === 'torch') return nearest(level.torches.filter((_, i) => !g.lit[i]).map(t => tileCenter(t.tx, t.ty)))
  return nearestGate(level, hero)
}

export function drainEvents(world: World): WorldEvent[] {
  const out = world.events
  world.events = []
  return out
}

export const shardsLeft = (world: World) => world.shards.filter(s => !s.taken).length
export const friendsJoined = (world: World) => world.friends.filter(f => f.joined).length

/**
 * いちばん ちかい のこりの かけら（たからばこが でたら たからばこ）。
 * のこりが しかけの むこうに しか ない ときは、しかけを とく ところを さす。
 */
export function nextGoal(world: World): Point | null {
  if (world.chest.visible) return world.chest.open ? null : world.chest
  const reach = world.gimmick.open ? null : reachMap(world)
  const canReach = (p: Point) => !reach || reach[Math.floor((p.y - 2) / TILE) * world.level.w + Math.floor(p.x / TILE)] === 1
  let best: Point | null = null, bd = Infinity
  for (const s of world.shards) {
    if (s.taken || !canReach(s)) continue
    const d = Math.hypot(s.x - world.hero.x, s.y - world.hero.y)
    if (d < bd) { bd = d; best = s }
  }
  if (best || !reach) return best
  const key = gimmickGoal(world)
  if (key) return key
  for (const s of world.shards) {
    if (s.taken) continue
    const d = Math.hypot(s.x - world.hero.x, s.y - world.hero.y)
    if (d < bd) { bd = d; best = s }
  }
  return best
}
