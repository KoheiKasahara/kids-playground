// 3Dで みる おうちの ならべかた。マスの へりに たてる かべ、やねを かける しかく、
// かべの まど・ドアの いち、にわに おく ものの ばしょを きめる。three.js を つかわないので そのまま テストできる。

import { OUTDOOR_EXTRAS, findShape, type ExtraId, type OutdoorExtraId, type Shape } from './data'
import {
  OPENING_BY_ROOM, facadeOpenings, frontEdge, isFloorCell, roomSize, roomsOn,
  type HouseDesign, type OpeningKind, type PlacedRoom,
} from './plan'

/** 1マスの ながさ（メートル）。 */
export const CELL = 1.8
/** 1かいぶんの たかさ。 */
export const STORY = 2.8
/** どだいの たかさ。 */
export const BASE_H = 0.3
/** へやの かべの たかさ（なかを みる とき）。 */
export const ROOM_WALL_H = 2.4

export type Side = 'front' | 'back' | 'left' | 'right'
export const SIDES: readonly Side[] = ['front', 'back', 'left', 'right']

const STEP: Readonly<Record<Side, { dx: number; dy: number }>> = {
  front: { dx: 0, dy: 1 }, back: { dx: 0, dy: -1 }, left: { dx: -1, dy: 0 }, right: { dx: 1, dy: 0 },
}

/** front / back は よこに ならぶ かべ（line は ぎょうの さかい、from〜to は れつ）。left / right は たてに ならぶ。 */
export const isAcross = (side: Side) => side === 'front' || side === 'back'

/** マス (x, y) の side がわが そと（にわ）に めんしているか。 */
export function isOutsideEdge(shape: Shape, x: number, y: number, side: Side): boolean {
  return isFloorCell(shape, x, y) && !isFloorCell(shape, x + STEP[side].dx, y + STEP[side].dy)
}

/** マスの へりに たてる かべ。line は マスの さかいめ、from〜to は かべの はし から はし（マス）。 */
export type WallRun = { side: Side; line: number; from: number; to: number }

/** そとに めんした へりを つなげた かべ。なかにわの まわりの かべも ふくむ。 */
export function wallRuns(shape: Shape): WallRun[] {
  const runs: WallRun[] = []
  for (const side of SIDES) {
    const across = isAcross(side)
    const lines = across ? shape.height : shape.width
    const length = across ? shape.width : shape.height
    for (let i = 0; i < lines; i++) {
      const line = side === 'front' || side === 'right' ? i + 1 : i
      let start = -1
      for (let j = 0; j <= length; j++) {
        const on = j < length && (across ? isOutsideEdge(shape, j, i, side) : isOutsideEdge(shape, i, j, side))
        if (on && start < 0) start = j
        if (!on && start >= 0) {
          runs.push({ side, line, from: start, to: j })
          start = -1
        }
      }
    }
  }
  return runs
}

export type Rect = { x: number; y: number; w: number; h: number }

/** ゆかを かさならない しかくに わける（やねを かける たんい）。おなじ はばの ぎょうは ひとつに まとめる。 */
export function footprintRects(shape: Shape): Rect[] {
  const rects: Rect[] = []
  let open: Rect[] = []
  for (let y = 0; y < shape.height; y++) {
    const next: Rect[] = []
    let start = -1
    for (let x = 0; x <= shape.width; x++) {
      const on = x < shape.width && isFloorCell(shape, x, y)
      if (on && start < 0) start = x
      if (!on && start >= 0) {
        const same = open.find((r) => r.x === start && r.x + r.w === x)
        if (same) {
          same.h++
          next.push(same)
        } else {
          const rect = { x: start, y, w: x - start, h: 1 }
          rects.push(rect)
          next.push(rect)
        }
        start = -1
      }
    }
    open = next
  }
  return rects
}

// ---------------- まど と ドア ----------------

/** かべに あける まど・ドア。center と span は かべに そった マスの たんい。 */
export type Opening3D = { side: Side; line: number; center: number; span: number; kind: OpeningKind; roomId?: number }

function sideKind(room: PlacedRoom, span: number): OpeningKind {
  const kind = OPENING_BY_ROOM[room.type]
  if (kind === 'door') return 'window'
  if (kind === 'big' && span < 2) return 'window'
  return kind
}

/**
 * その かいの まわりの かべの まど・ドア。おもては そとから みた え（facadeOpenings）と おなじに し、
 * よこ と うらは そこに めんした へやに あわせる。へやが めんして いない かべにも まどを ならべる。
 */
export function sideOpenings(design: HouseDesign, floor: number): Opening3D[] {
  const shape = findShape(design.shape)
  const front = frontEdge(shape)
  const openings: Opening3D[] = []
  for (const o of facadeOpenings(design, floor)) {
    const line = front[Math.min(shape.width - 1, Math.max(0, Math.floor(o.center)))]
    if (line > 0) openings.push({ side: 'front', line, center: o.center, span: o.span, kind: o.kind, roomId: o.roomId })
  }
  const runs = wallRuns(shape)
  for (const side of ['back', 'left', 'right'] as const) {
    const found: Opening3D[] = []
    for (const room of roomsOn(design, floor)) {
      const { w, h } = roomSize(room)
      const across = isAcross(side)
      const length = across ? w : h
      const line = side === 'back' ? room.y : side === 'left' ? room.x : room.x + w
      const origin = across ? room.x : room.y
      let start = -1
      for (let j = 0; j <= length; j++) {
        const x = across ? room.x + j : line - (side === 'right' ? 1 : 0)
        const y = across ? line : room.y + j
        const on = j < length && isOutsideEdge(shape, x, y, side)
        if (on && start < 0) start = j
        if (!on && start >= 0) {
          const span = j - start
          found.push({ side, line, center: origin + (start + j) / 2, span, kind: sideKind(room, span), roomId: room.id })
          start = -1
        }
      }
    }
    if (found.length === 0) {
      for (const run of runs) {
        if (run.side !== side) continue
        const n = Math.floor((run.to - run.from) / 3)
        for (let i = 0; i < n; i++) found.push({ side, line: run.line, center: run.from + ((i + .5) * (run.to - run.from)) / n, span: 1, kind: 'window' })
      }
    }
    openings.push(...found)
  }
  return openings
}

/** へやの side がわの かべの line と、かべに そった はんい。 */
export function roomEdge(room: PlacedRoom, side: Side): { line: number; from: number; to: number } {
  const { w, h } = roomSize(room)
  switch (side) {
    case 'front': return { line: room.y + h, from: room.x, to: room.x + w }
    case 'back': return { line: room.y, from: room.x, to: room.x + w }
    case 'left': return { line: room.x, from: room.y, to: room.y + h }
    case 'right': return { line: room.x + w, from: room.y, to: room.y + h }
  }
}

/** へやの なかから みえる まど・ドア（そとがわの かべに あいた もの）。 */
export function roomOpenings(design: HouseDesign, room: PlacedRoom): Opening3D[] {
  return sideOpenings(design, room.floor).filter((o) => {
    const edge = roomEdge(room, o.side)
    return o.line === edge.line && o.center > edge.from && o.center < edge.to
  })
}

/**
 * となりの へやへ でる ドアの いち。そとに めんして いない へりが いちばん ながい かべの まんなか。
 * まわりが ぜんぶ そとの ときは null。
 */
export function innerDoor(design: HouseDesign, room: PlacedRoom): { side: Side; center: number } | null {
  const shape = findShape(design.shape)
  let best: { side: Side; center: number; length: number } | null = null
  // みえやすい おく と ひだりの かべを さきに えらぶ。
  for (const side of ['back', 'left', 'right', 'front'] as const) {
    const edge = roomEdge(room, side)
    let start = -1
    for (let j = edge.from; j <= edge.to; j++) {
      const x = isAcross(side) ? j : side === 'left' ? room.x : edge.line - 1
      const y = isAcross(side) ? (side === 'back' ? room.y : edge.line - 1) : j
      const on = j < edge.to && isFloorCell(shape, x, y) && !isOutsideEdge(shape, x, y, side)
      if (on && start < 0) start = j
      if (!on && start >= 0) {
        if (!best || j - start > best.length) best = { side, center: (start + j) / 2, length: j - start }
        start = -1
      }
    }
  }
  return best && { side: best.side, center: best.center }
}

// ---------------- にわ ----------------

/** マスの いち → メートル（いえの まんなかが 0、おもてが +z）。 */
export function toWorld(shape: Shape, x: number, y: number): { x: number; z: number } {
  return { x: (x - shape.width / 2) * CELL, z: (y - shape.height / 2) * CELL }
}

export type Box2 = { minX: number; maxX: number; minZ: number; maxZ: number }

/** にわに おく ものの ばしょ（メートル）。ない ものは undefined。 */
export type YardLayout = {
  house: Box2
  door: { x: number; z: number }
  /** いちばん てまえの かべ。 */
  frontZ: number
  path: Box2
  parking?: Box2 & { cars: { x: number; z: number }[] }
  bike?: { x: number; z: number }
  mailbox?: { x: number; z: number }
  plot?: Box2
  pool?: Box2
  picnic?: Box2
  fountain?: Box2
  outdoor: { id: OutdoorExtraId; box: Box2 }[]
  doghouse?: { x: number; z: number }
  koinobori?: { x: number; z: number }
  swing?: { x: number; z: number }
  trees: { x: number; z: number; s: number }[]
  /** しばふと さくの はんい。 */
  yard: Box2
}

export const CAR_W = 1.9
export const CAR_L = 4.1
const CAR_GAP = .6
const PATH_HALF = .7

/**
 * いえの まえの にわに くるま・じてんしゃ・ポスト・はたけ・いぬごやを ならべ、よこに こいのぼり・ブランコ・きを おく。
 * こみちの ひだりに くるま、みぎに ポスト・はたけ・いぬごや（そとから みた え と おなじ じゅん）。
 */
export function yardLayout(design: HouseDesign): YardLayout {
  const shape = findShape(design.shape)
  const ex = design.exterior
  const has = (id: ExtraId) => ex.extras.includes(id)
  const front = frontEdge(shape)
  const half = { x: (shape.width * CELL) / 2, z: (shape.height * CELL) / 2 }
  const house: Box2 = { minX: -half.x, maxX: half.x, minZ: -half.z, maxZ: half.z }
  const frontZ = (Math.max(...front) - shape.height / 2) * CELL
  const door3d = sideOpenings(design, 0).find((o) => o.kind === 'door')
  const doorCenter = door3d?.center ?? shape.width / 2
  const doorLine = door3d?.line ?? Math.max(...front)
  const door = { x: (doorCenter - shape.width / 2) * CELL, z: (doorLine - shape.height / 2) * CELL }

  // みずあそび・ピクニックは 2れつめ。はたけや くるまを けさずに いっしょに おける。
  const secondRow = ex.pool !== 'none' || has('picnic') || has('fountain')
  const outdoor = OUTDOOR_EXTRAS.filter((item) => has(item.id))
  const outdoorStart = frontZ + (secondRow ? 12 : 6.6)
  const yardFront = outdoorStart + Math.ceil(outdoor.length / 4) * 4.2
  const path: Box2 = { minX: door.x - PATH_HALF, maxX: door.x + PATH_HALF, minZ: door.z, maxZ: yardFront }
  const layout: YardLayout = { house, door, frontZ, path, trees: [], outdoor: [], yard: { ...house } }
  // 4こずつ、こみちの りょうがわに ならべる。さきに えらんだ ものを けさない。
  outdoor.forEach(({ id }, i) => {
    const offset = .6 + Math.floor((i % 4) / 2) * 3.8
    const minX = i % 2 === 0 ? path.minX - offset - 3.2 : path.maxX + offset
    const minZ = outdoorStart + .2 + Math.floor(i / 4) * 4.2
    layout.outdoor.push({ id, box: { minX, maxX: minX + 3.2, minZ, maxZ: minZ + 3.4 } })
  })

  // こみちの ひだり。
  let at = path.minX - .5
  const cars = ex.parking === 'none' ? 0 : ex.parking === 'two' ? 2 : 1
  if (cars) {
    const w = cars * CAR_W + (cars + 1) * CAR_GAP
    const minZ = frontZ + 1.2
    const parking = { minX: at - w, maxX: at, minZ, maxZ: minZ + CAR_L + .8, cars: [] as { x: number; z: number }[] }
    for (let i = 0; i < cars; i++) parking.cars.push({ x: parking.maxX - CAR_GAP - CAR_W / 2 - i * (CAR_W + CAR_GAP), z: minZ + .4 + CAR_L / 2 })
    layout.parking = parking
    at -= w + .5
  }
  if (has('bike')) layout.bike = { x: at - .5, z: frontZ + 3.2 }
  // こみちの みぎ。
  at = path.maxX + .5
  if (has('mailbox')) {
    layout.mailbox = { x: at + .3, z: frontZ + 5.6 }
    at += 1.1
  }
  if (['veggies', 'pond', 'strawberries', 'orchard'].includes(ex.garden)) {
    layout.plot = { minX: at, maxX: at + 3.6, minZ: frontZ + 1.8, maxZ: frontZ + 4.8 }
    at += 4.2
  }
  if (ex.doghouse !== 'none') layout.doghouse = { x: at + .9, z: frontZ + 2.6 }

  if (ex.pool !== 'none') {
    layout.pool = { minX: path.minX - 5.4, maxX: path.minX - .6, minZ: frontZ + 7, maxZ: frontZ + 11.2 }
  }
  at = path.maxX + .6
  if (has('picnic')) {
    layout.picnic = { minX: at, maxX: at + 3, minZ: frontZ + 7.1, maxZ: frontZ + 10.3 }
    at += 3.6
  }
  if (has('fountain')) layout.fountain = { minX: at, maxX: at + 2.8, minZ: frontZ + 7.2, maxZ: frontZ + 10 }

  // いえの よこ。
  let left = house.minX - 2.4
  let right = house.maxX + 1.6
  if (has('koinobori')) {
    layout.koinobori = { x: left, z: frontZ - 1.2 }
    left -= 2.2
  }
  if (has('swing')) {
    layout.swing = { x: right + .6, z: Math.max(house.minZ + 1.6, frontZ - 2.6) }
    right += 3.6
  }
  if (ex.garden === 'trees') {
    layout.trees.push({ x: left - .4, z: house.minZ + 1.2, s: 1 }, { x: right + .4, z: house.minZ + .6, s: .9 }, { x: house.maxX - 1.2, z: house.minZ - 2.2, s: 1.1 })
  }

  const xs = [house.minX - 1.4, house.maxX + 1.4, path.minX, path.maxX]
  if (layout.parking) xs.push(layout.parking.minX)
  if (layout.bike) xs.push(layout.bike.x - .8)
  if (layout.plot) xs.push(layout.plot.maxX)
  if (layout.pool) xs.push(layout.pool.minX, layout.pool.maxX)
  if (layout.picnic) xs.push(layout.picnic.minX, layout.picnic.maxX)
  if (layout.fountain) xs.push(layout.fountain.minX, layout.fountain.maxX)
  for (const { box } of layout.outdoor) xs.push(box.minX, box.maxX)
  if (layout.doghouse) xs.push(layout.doghouse.x + 1.8)
  if (layout.mailbox) xs.push(layout.mailbox.x + .5)
  if (layout.koinobori) xs.push(layout.koinobori.x - 1)
  if (layout.swing) xs.push(layout.swing.x + 2)
  for (const tree of layout.trees) xs.push(tree.x - 1.4 * tree.s, tree.x + 1.4 * tree.s)
  layout.yard = { minX: Math.min(...xs) - .8, maxX: Math.max(...xs) + .8, minZ: house.minZ - 3.4, maxZ: yardFront }
  return layout
}
