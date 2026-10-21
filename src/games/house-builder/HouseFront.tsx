import type { KeyboardEvent, ReactNode } from 'react'
import {
  findDoor, findRoof, findShape, findWall,
  type DoghouseId, type DoorId, type Exterior, type ExtraId, type GardenId, type ParkingId, type RoofId, type WallId, type WindowId,
} from './data'
import { facadeOpenings, floorCount, frontEdge, type HouseDesign, type Opening } from './plan'
import styles from './HouseBuilderPlay.module.css'

// おうちを おもてから みた え。かべ・やね・まど・ドア・にわの ものは すべて コードで かいた オリジナル。

const CW = 60 // 1マスの はば
const FH = 140 // 1かいぶんの たかさ
const BASE = 14 // どだい
/** じめんの あつさ。まえの にわに ものを おくときは ひろく とる。 */
const GROUND = 96
const YARD = 205
const SKY = 46

export type Hotspot = 'door' | 'dog' | 'car'

const roofHeight = (kind: string, hw: number) =>
  kind === 'flat' ? 26 : kind === 'steep' ? Math.min(300, Math.max(150, hw * .55)) : kind === 'kawara' ? Math.min(150, Math.max(84, hw * .26)) : Math.min(170, Math.max(92, hw * .3))

const OVERHANG = 24

const CAR_SCALE = .85
const CAR_W = 182 * CAR_SCALE
/** げんかんから まっすぐ のびる こみちの はんぶんの はば。 */
const PATH = 46
const MIN_WIDTH = 760

/** にわに おく ものの x（なければ undefined）。 */
type Spots = {
  bike?: number
  parking?: { x: number; w: number; cars: number[] }
  mailbox?: number
  garden?: number
  doghouse?: number
  koinobori?: number
  swing?: number
  trees?: [number, number]
}

type Layout = {
  width: number
  height: number
  houseX: number
  houseW: number
  groundY: number
  /** じめんの あつさ。 */
  ground: number
  wallTop: number
  roofH: number
  floors: number
  doorX: number
  /** いえの よこ（おく）の ものを おく じめん。 */
  backY: number
  /** まえの にわ（てまえ）の ものを おく じめん。 */
  frontY: number
  spots: Spots
}

/**
 * おもてから みた えの ならべかた。くるま・いぬごや などは いえの まえの にわに ならべ、
 * き・こいのぼり・ブランコは いえの よこに おく。にわが ふえても いえが ちいさく なりすぎない。
 */
function layout(design: HouseDesign): Layout {
  const shape = findShape(design.shape)
  const ex = design.exterior
  const floors = floorCount(design)
  const houseW = shape.width * CW
  const roof = findRoof(ex.roof)
  const roofH = roofHeight(roof.kind, houseW)
  const has = (id: ExtraId) => ex.extras.includes(id)
  const door = facadeOpenings(design, 0).find((o) => o.kind === 'door')
  const doorOff = (door?.center ?? shape.width / 2) * CW
  const trees = ex.garden === 'trees'
  const cars = ex.parking === 'none' ? 0 : ex.parking === 'two' ? 2 : 1
  const parkingW = cars ? cars * (CAR_W + 14) + 20 : 0
  const gardenW = ex.garden === 'veggies' || ex.garden === 'pond' ? 170 : 0
  const dogW = ex.doghouse !== 'none' ? 175 : 0

  const sideLeft = 40 + (has('koinobori') ? 90 : 0) + (trees ? 110 : 0)
  const sideRight = 40 + (has('swing') ? 150 : 0) + (trees ? 110 : 0)
  const frontLeft = PATH + (has('bike') ? 120 : 0) + parkingW + 24
  const frontRight = PATH + (has('mailbox') ? 60 : 0) + gardenW + dogW + 24
  let houseX = Math.max(sideLeft, frontLeft - doorOff)
  let width = Math.max(houseX + houseW + sideRight, houseX + doorOff + frontRight)
  if (width < MIN_WIDTH) {
    houseX += (MIN_WIDTH - width) / 2
    width = MIN_WIDTH
  }
  const doorX = houseX + doorOff

  const spots: Spots = {}
  let at = doorX - PATH
  if (has('bike')) {
    spots.bike = at - 112
    at -= 120
  }
  if (cars) {
    const x = at - parkingW
    spots.parking = { x, w: parkingW - 10, cars: Array.from({ length: cars }, (_, i) => x + 10 + i * (CAR_W + 14)) }
  }
  at = doorX + PATH
  if (has('mailbox')) {
    spots.mailbox = at + 12
    at += 60
  }
  if (gardenW) {
    spots.garden = at + 10
    at += gardenW
  }
  if (dogW) spots.doghouse = at + 10
  at = houseX - 30
  if (has('koinobori')) {
    spots.koinobori = at - 40
    at -= 90
  }
  const leftTree = at - 50
  at = houseX + houseW + 30
  if (has('swing')) {
    spots.swing = at
    at += 150
  }
  if (trees) spots.trees = [leftTree, at + 50]

  // えんとつの けむりや こいのぼりが そらから はみださない たかさ。
  const chimneyRoom = has('chimney') ? (roof.kind === 'flat' ? 150 : 60) : 0
  const tall = Math.max(roofH + floors * FH + BASE + chimneyRoom, has('koinobori') ? 310 : 0, 200)
  const groundY = SKY + tall
  const frontYard = cars > 0 || has('bike') || has('mailbox') || gardenW > 0 || dogW > 0
  const ground = frontYard ? YARD : GROUND
  return {
    width,
    height: groundY + ground,
    ground,
    houseX,
    houseW,
    groundY,
    wallTop: groundY - BASE - floors * FH,
    roofH,
    floors,
    doorX,
    backY: groundY + 22,
    frontY: groundY + 150,
    spots,
  }
}

// ---------------- かべ ----------------

function WallPattern({ wall, x, y, w, h }: { wall: WallId; x: number; y: number; w: number; h: number }) {
  const v = findWall(wall)
  const lines: ReactNode[] = []
  switch (v.kind) {
    case 'brick':
      for (let row = 0, yy = y + 14; yy < y + h; yy += 14, row++) {
        lines.push(<line key={`h${yy}`} x1={x} y1={yy} x2={x + w} y2={yy} />)
        for (let xx = x + (row % 2 ? 15 : 0) + 30; xx < x + w; xx += 30) lines.push(<line key={`v${yy}-${xx}`} x1={xx} y1={yy - 14} x2={xx} y2={yy} />)
      }
      break
    case 'siding':
      for (let yy = y + 12; yy < y + h; yy += 12) lines.push(<line key={yy} x1={x} y1={yy} x2={x + w} y2={yy} />)
      break
    case 'log':
      for (let yy = y, i = 0; yy < y + h; yy += 18, i++) {
        lines.push(<rect key={`l${yy}`} x={x} y={yy + 1} width={w} height={16} rx={8} fill={i % 2 ? '#a66a38' : v.base} stroke={v.line} strokeWidth={2} />)
        lines.push(<circle key={`a${yy}`} cx={x + 4} cy={yy + 9} r={7} fill="#e0b77f" stroke={v.line} strokeWidth={2} />)
        lines.push(<circle key={`b${yy}`} cx={x + w - 4} cy={yy + 9} r={7} fill="#e0b77f" stroke={v.line} strokeWidth={2} />)
      }
      break
    case 'wa': {
      const split = y + h * .55
      lines.push(<rect key="low" x={x} y={split} width={w} height={y + h - split} fill="#3b3330" stroke="none" />)
      for (let xx = x + 16; xx < x + w; xx += 16) lines.push(<line key={`b${xx}`} x1={xx} y1={split} x2={xx} y2={y + h} stroke="#5a4e48" />)
      lines.push(<line key="split" x1={x} y1={split} x2={x + w} y2={split} stroke="#2a2220" strokeWidth={4} />)
      break
    }
    case 'stone':
      for (let row = 0, yy = y; yy < y + h; yy += 26, row++) {
        for (let xx = x + (row % 2 ? -20 : 0); xx < x + w; xx += 40) {
          const x0 = Math.max(x, xx + 2), x1 = Math.min(x + w, xx + 38)
          if (x1 - x0 > 6) lines.push(<rect key={`s${yy}-${xx}`} x={x0} y={yy + 2} width={x1 - x0} height={Math.min(22, y + h - yy - 2)} rx={7} fill="none" />)
        }
      }
      break
    case 'plain':
      break
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill={v.base} />
      <g stroke={v.line} strokeWidth={2}>{lines}</g>
    </g>
  )
}

// ---------------- まど と ドア ----------------

const GLASS = '#bfe6fb'

function WindowArt({ style, x, y, w, h, frame = '#ffffff' }: { style: WindowId; x: number; y: number; w: number; h: number; frame?: string }) {
  const cx = x + w / 2, cy = y + h / 2
  if (style === 'round') {
    const r = Math.min(w, h) / 2
    const rect = Math.abs(w - h) > 10
    return (
      <g>
        {rect
          ? <rect x={x} y={y} width={w} height={h} rx={Math.min(w, h) / 2} fill={GLASS} stroke={frame} strokeWidth={6} />
          : <circle cx={cx} cy={cy} r={r} fill={GLASS} stroke={frame} strokeWidth={6} />}
        <line x1={cx} y1={y + 3} x2={cx} y2={y + h - 3} stroke={frame} strokeWidth={4} />
        <path d={`M${cx - r * .5} ${cy - r * .2} q ${r * .2} ${-r * .4} ${r * .5} ${-r * .45}`} fill="none" stroke="#ffffff" strokeWidth={3} />
      </g>
    )
  }
  if (style === 'arch') {
    const r = w / 2
    const top = y + Math.min(r, h * .5)
    return (
      <g>
        <path d={`M${x} ${y + h} V${top} A ${r} ${r} 0 0 1 ${x + w} ${top} V${y + h} Z`} fill={GLASS} stroke={frame} strokeWidth={6} />
        <line x1={cx} y1={top - r + 3} x2={cx} y2={y + h} stroke={frame} strokeWidth={4} />
        <line x1={x} y1={top + 4} x2={x + w} y2={top + 4} stroke={frame} strokeWidth={4} />
      </g>
    )
  }
  if (style === 'shoji') {
    const lines: ReactNode[] = []
    for (let i = 1; i < Math.round(w / 12); i++) lines.push(<line key={`v${i}`} x1={x + (i * w) / Math.round(w / 12)} y1={y} x2={x + (i * w) / Math.round(w / 12)} y2={y + h} />)
    for (let i = 1; i < Math.round(h / 14); i++) lines.push(<line key={`h${i}`} x1={x} y1={y + (i * h) / Math.round(h / 14)} x2={x + w} y2={y + (i * h) / Math.round(h / 14)} />)
    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill="#fffaf0" stroke="#6d4c41" strokeWidth={6} />
        <g stroke="#8d6e63" strokeWidth={2}>{lines}</g>
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={3} fill={GLASS} stroke={frame} strokeWidth={6} />
      <line x1={cx} y1={y} x2={cx} y2={y + h} stroke={frame} strokeWidth={4} />
      {h > 36 && <line x1={x} y1={cy} x2={x + w} y2={cy} stroke={frame} strokeWidth={4} />}
      <path d={`M${x + 8} ${y + 16} l 10 -10`} stroke="#ffffff" strokeWidth={3} />
      {style === 'flowerbox' && (
        <g>
          <rect x={x - 6} y={y + h + 2} width={w + 12} height={12} rx={3} fill="#8d6e63" />
          {Array.from({ length: Math.max(2, Math.round(w / 16)) }, (_, i) => (
            <circle key={i} cx={x + ((i + .5) * w) / Math.max(2, Math.round(w / 16))} cy={y + h} r={6} fill={['#ff6b9a', '#ffd166', '#ef476f', '#c77dff'][i % 4]} />
          ))}
        </g>
      )}
    </g>
  )
}

function DoorArt({ door, x, y, w, h }: { door: DoorId; x: number; y: number; w: number; h: number }) {
  const d = findDoor(door)
  const knob = <circle cx={x + w - 10} cy={y + h * .55} r={4} fill="#ffd54f" stroke="#a67c00" strokeWidth={1.5} />
  if (door === 'slide') {
    return (
      <g>
        <rect x={x - 6} y={y} width={w + 12} height={h} fill={d.color} stroke="#4e342e" strokeWidth={3} />
        {[0, 1].map((i) => (
          <g key={i}>
            <rect x={x - 2 + i * (w / 2 + 2)} y={y + 6} width={w / 2 + 2} height={h - 10} fill="#fffaf0" stroke="#4e342e" strokeWidth={3} />
            {[1, 2, 3, 4].map((k) => <line key={k} x1={x - 2 + i * (w / 2 + 2)} y1={y + 6 + ((h - 10) * k) / 5} x2={x + i * (w / 2 + 2) + w / 2} y2={y + 6 + ((h - 10) * k) / 5} stroke="#6d4c41" strokeWidth={2} />)}
          </g>
        ))}
      </g>
    )
  }
  if (door === 'round') {
    const r = w / 2
    return (
      <g>
        <path d={`M${x} ${y + h} V${y + r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h} Z`} fill={d.color} stroke="#1b5e20" strokeWidth={4} />
        <circle cx={x + r} cy={y + r + 6} r={9} fill={GLASS} stroke="#ffd54f" strokeWidth={3} />
        {[.3, .5, .7].map((p) => <line key={p} x1={x + w * p} y1={y + r + 20} x2={x + w * p} y2={y + h - 4} stroke="#2e7d32" strokeWidth={2} />)}
        <circle cx={x + r} cy={y + h * .62} r={5} fill="#ffd54f" />
      </g>
    )
  }
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill={d.color} stroke="#00000055" strokeWidth={3} />
      <rect x={x + 8} y={y + 10} width={w - 16} height={h * .32} rx={3} fill="none" stroke="#00000033" strokeWidth={3} />
      <rect x={x + 8} y={y + h * .5} width={w - 16} height={h * .4} rx={3} fill="none" stroke="#00000033" strokeWidth={3} />
      {door === 'white' && <rect x={x + 14} y={y + 16} width={w - 28} height={h * .2} rx={3} fill={GLASS} />}
      {knob}
    </g>
  )
}

function OpeningArt({ o, ex, x, floorTop, floor }: { o: Opening; ex: Exterior; x: number; floorTop: number; floor: number }) {
  const cx = x + o.center * CW
  const bottom = floorTop + FH
  switch (o.kind) {
    case 'door': {
      const w = 56, h = 98
      return (
        <g>
          <rect x={cx - w / 2 - 12} y={bottom - h - 16} width={w + 24} height={10} rx={3} fill="#5d4037" />
          <DoorArt door={ex.door} x={cx - w / 2} y={bottom - h} w={w} h={h} />
          <circle cx={cx + w / 2 + 14} cy={bottom - h + 6} r={6} fill="#fff59d" stroke="#f9a825" strokeWidth={2} />
        </g>
      )
    }
    case 'big': {
      const w = Math.min(o.span * CW - 22, 140)
      const h = floor === 0 ? 92 : 74
      return <WindowArt style={ex.window} x={cx - w / 2} y={floorTop + 30} w={w} h={h} />
    }
    case 'small':
      return <WindowArt style={ex.window === 'flowerbox' ? 'square' : ex.window} x={cx - 17} y={floorTop + 26} w={34} h={30} />
    case 'slim':
      return <WindowArt style={ex.window === 'flowerbox' ? 'square' : ex.window} x={cx - 12} y={floorTop + 28} w={24} h={78} />
    case 'window':
      return <WindowArt style={ex.window} x={cx - 26} y={floorTop + 32} w={52} h={58} />
  }
}

// ---------------- やね ----------------

function RoofArt({ roof, lay, extras }: { roof: RoofId; lay: Layout; extras: readonly ExtraId[] }) {
  const r = findRoof(roof)
  const x0 = lay.houseX - OVERHANG, x1 = lay.houseX + lay.houseW + OVERHANG
  const base = lay.wallTop
  const peak = base - lay.roofH
  const cx = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  const parts: ReactNode[] = []
  const hasChimney = extras.includes('chimney')
  const hasSolar = extras.includes('solar')
  // えんとつは やねの うしろに たてる。
  if (hasChimney) {
    const chx = r.kind === 'flat' ? x1 - 90 : cx + half * .45
    const roofAt = r.kind === 'flat' ? base - lay.roofH : base - lay.roofH * (1 - (chx + 15 - cx) / half)
    const top = r.kind === 'flat' ? base - lay.roofH - 60 : Math.min(roofAt - 34, peak + 10)
    parts.push(
      <g key="chimney">
        <rect x={chx} y={top} width={30} height={roofAt - top + 10} fill="#a5523a" stroke="#6d2f1f" strokeWidth={3} />
        <rect x={chx - 4} y={top - 8} width={38} height={10} fill="#6d2f1f" />
        <g className={styles.smoke}>
          <circle cx={chx + 15} cy={top - 22} r={10} fill="#ffffffcc" />
          <circle cx={chx + 26} cy={top - 42} r={13} fill="#ffffffaa" />
          <circle cx={chx + 14} cy={top - 66} r={16} fill="#ffffff88" />
        </g>
      </g>,
    )
  }
  if (r.kind === 'flat') {
    parts.push(
      <g key="roof">
        <rect x={lay.houseX - 8} y={peak} width={lay.houseW + 16} height={lay.roofH} fill={r.color} stroke={r.dark} strokeWidth={4} />
        <rect x={lay.houseX - 8} y={peak} width={lay.houseW + 16} height={7} fill={r.dark} />
      </g>,
    )
    if (hasSolar) {
      const n = Math.max(2, Math.floor(lay.houseW / 90))
      for (let i = 0; i < n; i++) {
        const px = lay.houseX + 20 + i * ((lay.houseW - 40) / n)
        parts.push(<path key={`sol${i}`} d={`M${px} ${peak} l 14 -34 h ${(lay.houseW - 40) / n - 24} l -14 34 z`} fill="#1a3d7c" stroke="#90caf9" strokeWidth={2} />)
      }
    }
    return <g>{parts}</g>
  }
  const lines: ReactNode[] = []
  if (r.kind === 'kawara') {
    for (let xx = x0 + 14; xx < x1; xx += 14) {
      const yTop = base - lay.roofH * (1 - Math.abs(xx - cx) / half)
      lines.push(<line key={xx} x1={xx} y1={yTop + 4} x2={xx} y2={base} />)
    }
  } else {
    for (let yy = base - 16; yy > peak + 10; yy -= 16) {
      const w = half * (1 - (base - yy) / lay.roofH)
      lines.push(<line key={yy} x1={cx - w} y1={yy} x2={cx + w} y2={yy} />)
    }
  }
  const shapePath = r.kind === 'kawara'
    ? `M${x0 - 10} ${base + 4} Q ${x0 + half * .5} ${base - lay.roofH * .38} ${cx} ${peak} Q ${x1 - half * .5} ${base - lay.roofH * .38} ${x1 + 10} ${base + 4} Z`
    : `M${x0} ${base} L ${cx} ${peak} L ${x1} ${base} Z`
  parts.push(
    <g key="roof">
      <path d={shapePath} fill={r.color} stroke={r.dark} strokeWidth={4} strokeLinejoin="round" />
      <g stroke={r.dark} strokeWidth={2} opacity={.55}>{lines}</g>
      <path d={`M${x0 - (r.kind === 'kawara' ? 10 : 0)} ${base} H ${x1 + (r.kind === 'kawara' ? 10 : 0)}`} stroke={r.dark} strokeWidth={8} strokeLinecap="round" />
      {r.kind === 'kawara' && <rect x={cx - 22} y={peak - 8} width={44} height={12} rx={4} fill={r.dark} />}
      {r.kind === 'steep' && (
        <g>
          <circle cx={cx} cy={base - lay.roofH * .42} r={Math.min(26, lay.roofH * .12)} fill={GLASS} stroke="#ffffff" strokeWidth={5} />
          <line x1={cx - 20} y1={base - lay.roofH * .42} x2={cx + 20} y2={base - lay.roofH * .42} stroke="#ffffff" strokeWidth={3} />
        </g>
      )}
    </g>,
  )
  if (hasSolar) {
    // ひだりの やねに ならべる。
    const n = 3
    const pts = (p: number, off: number) => {
      const xx = x0 + half * p
      const yy = base - lay.roofH * p
      return `${xx + off * .35},${yy + off}`
    }
    for (let i = 0; i < n; i++) {
      const a = .22 + i * .18, b2 = a + .15
      parts.push(<polygon key={`sol${i}`} points={`${pts(a, -6)} ${pts(b2, -6)} ${pts(b2, 18)} ${pts(a, 18)}`} fill="#1a3d7c" stroke="#90caf9" strokeWidth={2} />)
    }
  }
  return <g>{parts}</g>
}

// ---------------- にわの もの ----------------

function Car({ x, y, color, label, onHit }: { x: number; y: number; color: string; label?: string; onHit?: () => void }) {
  return (
    <g {...hotspotProps(label, onHit)}>
      <path d={`M${x} ${y - 22} q 0 -24 26 -26 l 26 -26 h 64 q 14 0 26 22 l 22 4 q 18 4 18 20 v 6 z`} fill={color} stroke="#00000055" strokeWidth={3} />
      <path d={`M${x + 58} ${y - 70} h 56 q 8 0 16 18 h -80 z`} fill={GLASS} />
      <line x1={x + 94} y1={y - 72} x2={x + 94} y2={y - 52} stroke={color} strokeWidth={6} />
      <rect x={x + 168} y={y - 38} width={10} height={8} rx={2} fill="#fff59d" />
      <circle cx={x + 44} cy={y - 18} r={18} fill="#263238" />
      <circle cx={x + 44} cy={y - 18} r={8} fill="#b0bec5" />
      <circle cx={x + 144} cy={y - 18} r={18} fill="#263238" />
      <circle cx={x + 144} cy={y - 18} r={8} fill="#b0bec5" />
    </g>
  )
}

function hotspotProps(label: string | undefined, onHit: (() => void) | undefined) {
  if (!onHit || !label) return {}
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': label,
    className: styles.hotspot,
    onClick: onHit,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onHit()
      }
    },
  }
}

function Doghouse({ id, x, y, onHit }: { id: DoghouseId; x: number; y: number; onHit?: () => void }) {
  const roof = id === 'blue' ? '#3f7cc8' : id === 'log' ? '#6d4c41' : '#d9493b'
  const body = id === 'log' ? '#b07440' : '#f3e0c0'
  const dog = id === 'blue' ? '#ffffff' : '#c68642'
  return (
    <g {...hotspotProps('いぬ', onHit)}>
      <rect x={x} y={y - 70} width={84} height={70} fill={body} stroke="#5d4037" strokeWidth={3} />
      {id === 'log' && [14, 28, 42, 56].map((d) => <line key={d} x1={x} y1={y - d} x2={x + 84} y2={y - d} stroke="#7a4a24" strokeWidth={2} />)}
      <path d={`M${x - 12} ${y - 66} L ${x + 42} ${y - 112} L ${x + 96} ${y - 66} Z`} fill={roof} stroke="#00000055" strokeWidth={3} strokeLinejoin="round" />
      <path d={`M${x + 24} ${y} V ${y - 30} a 18 18 0 0 1 36 0 V ${y} Z`} fill="#3e2723" />
      <g>
        <ellipse cx={x + 118} cy={y - 22} rx={24} ry={18} fill={dog} stroke="#5d4037" strokeWidth={2.5} />
        <g className={styles.tail}>
          <path d={`M${x + 140} ${y - 30} q 16 -10 12 -26`} fill="none" stroke={dog} strokeWidth={8} strokeLinecap="round" />
        </g>
        <circle cx={x + 104} cy={y - 48} r={18} fill={dog} stroke="#5d4037" strokeWidth={2.5} />
        <ellipse cx={x + 90} cy={y - 50} rx={7} ry={12} fill="#8d5524" />
        <ellipse cx={x + 118} cy={y - 50} rx={7} ry={12} fill="#8d5524" />
        <circle cx={x + 98} cy={y - 50} r={2.6} fill="#1b1b1b" />
        <circle cx={x + 110} cy={y - 50} r={2.6} fill="#1b1b1b" />
        <ellipse cx={x + 104} cy={y - 42} rx={4} ry={3} fill="#1b1b1b" />
        <rect x={x + 100} y={y - 8} width={8} height={8} rx={3} fill={dog} stroke="#5d4037" strokeWidth={2} />
        <rect x={x + 124} y={y - 8} width={8} height={8} rx={3} fill={dog} stroke="#5d4037" strokeWidth={2} />
      </g>
    </g>
  )
}

const Tree = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <g>
    <rect x={x - 9 * s} y={y - 60 * s} width={18 * s} height={60 * s} fill="#8d6e63" />
    <circle cx={x} cy={y - 100 * s} r={44 * s} fill="#4caf50" />
    <circle cx={x - 30 * s} cy={y - 76 * s} r={30 * s} fill="#43a047" />
    <circle cx={x + 30 * s} cy={y - 78 * s} r={30 * s} fill="#66bb6a" />
    <circle cx={x + 14 * s} cy={y - 118 * s} r={6 * s} fill="#ef5350" />
    <circle cx={x - 16 * s} cy={y - 92 * s} r={6 * s} fill="#ef5350" />
  </g>
)

function Swing({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <path d={`M${x} ${y} L ${x + 30} ${y - 120} L ${x + 60} ${y} M${x + 70} ${y} L ${x + 100} ${y - 120} L ${x + 130} ${y}`} fill="none" stroke="#e53935" strokeWidth={8} strokeLinecap="round" />
      <line x1={x + 26} y1={y - 120} x2={x + 104} y2={y - 120} stroke="#e53935" strokeWidth={10} strokeLinecap="round" />
      <g className={styles.swing} style={{ transformOrigin: `${x + 65}px ${y - 120}px` }}>
        <line x1={x + 48} y1={y - 118} x2={x + 48} y2={y - 34} stroke="#5d4037" strokeWidth={3} />
        <line x1={x + 82} y1={y - 118} x2={x + 82} y2={y - 34} stroke="#5d4037" strokeWidth={3} />
        <rect x={x + 40} y={y - 36} width={50} height={10} rx={3} fill="#ffb300" />
      </g>
    </g>
  )
}

function Bike({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="#1e88e5" strokeWidth={4} strokeLinejoin="round">
      <circle cx={x + 18} cy={y - 20} r={18} stroke="#37474f" />
      <circle cx={x + 82} cy={y - 20} r={18} stroke="#37474f" />
      <path d={`M${x + 18} ${y - 20} L ${x + 40} ${y - 50} L ${x + 70} ${y - 50} L ${x + 82} ${y - 20} M${x + 40} ${y - 50} L ${x + 50} ${y - 20} L ${x + 70} ${y - 50} M${x + 36} ${y - 58} h 14 M${x + 68} ${y - 50} l 4 -12 h 10`} />
      <rect x={x + 30} y={y - 62} width={16} height={6} rx={3} fill="#37474f" stroke="none" />
    </g>
  )
}

function Mailbox({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <rect x={x + 12} y={y - 50} width={8} height={50} fill="#6d4c41" />
      <rect x={x} y={y - 78} width={32} height={30} rx={8} fill="#e53935" stroke="#9a2018" strokeWidth={2.5} />
      <rect x={x + 6} y={y - 70} width={20} height={4} rx={2} fill="#9a2018" />
    </g>
  )
}

function Koinobori({ x, y }: { x: number; y: number }) {
  const fish = (fy: number, w: number, color: string, i: number) => (
    <g key={i} className={styles.carp} style={{ transformOrigin: `${x}px ${fy}px` }}>
      <path d={`M${x + 4} ${fy - 14} h ${w} l -14 14 l 14 14 h ${-w} z`} fill={color} stroke="#00000044" strokeWidth={2} />
      <circle cx={x + 18} cy={fy - 2} r={7} fill="#ffffff" />
      <circle cx={x + 18} cy={fy - 2} r={3.5} fill="#1b1b1b" />
      <path d={`M${x + 34} ${fy - 6} q 8 6 0 12 M${x + 48} ${fy - 6} q 8 6 0 12`} fill="none" stroke="#ffffff88" strokeWidth={2} />
    </g>
  )
  return (
    <g>
      <rect x={x - 4} y={y - 290} width={8} height={290} fill="#bdbdbd" />
      <circle cx={x} cy={y - 294} r={8} fill="#ffd54f" />
      {fish(y - 250, 74, '#263238', 0)}
      {fish(y - 210, 62, '#e53935', 1)}
      {fish(y - 172, 50, '#1e88e5', 2)}
    </g>
  )
}

function GardenFront({ garden, lay, doorXs }: { garden: GardenId; lay: Layout; doorXs: number[] }) {
  if (garden !== 'flowers') return null
  const items: ReactNode[] = []
  for (let x = lay.houseX + 10; x < lay.houseX + lay.houseW - 6; x += 22) {
    if (doorXs.some((d) => Math.abs(d - x) < 46)) continue
    const c = ['#ff6b9a', '#ffd166', '#ef476f', '#c77dff', '#ffffff'][Math.round(x / 22) % 5]
    items.push(
      <g key={x}>
        <line x1={x} y1={lay.groundY + 2} x2={x} y2={lay.groundY - 20} stroke="#388e3c" strokeWidth={3} />
        <circle cx={x} cy={lay.groundY - 24} r={8} fill={c} />
        <circle cx={x} cy={lay.groundY - 24} r={3} fill="#ffeb3b" />
      </g>,
    )
  }
  return <g>{items}</g>
}

/** にわの いちばん てまえの さく。こみちの ところは あけておく。 */
function Fence({ lay }: { lay: Layout }) {
  const y = lay.groundY + lay.ground - 8
  const items: ReactNode[] = []
  for (let x = 14; x < lay.width - 10; x += 26) {
    if (Math.abs(lay.doorX - x - 9) < PATH + 4) continue
    items.push(<path key={x} d={`M${x} ${y} v -30 l 9 -9 l 9 9 v 30 z`} fill="#ffffff" stroke="#9e9e9e" strokeWidth={2} />)
  }
  return (
    <g>
      <rect x={6} y={y - 24} width={lay.doorX - PATH - 6} height={6} fill="#eeeeee" stroke="#9e9e9e" strokeWidth={1.5} />
      <rect x={lay.doorX + PATH} y={y - 24} width={lay.width - lay.doorX - PATH - 6} height={6} fill="#eeeeee" stroke="#9e9e9e" strokeWidth={1.5} />
      {items}
    </g>
  )
}

// ---------------- ぜんたい ----------------

type HouseFrontProps = {
  design: HouseDesign
  /** うごく かざり（くも・けむり・しっぽ）。 */
  lively?: boolean
  onHotspot?: (spot: Hotspot) => void
  title?: string
}

export function HouseFront({ design, lively = false, onHotspot, title }: HouseFrontProps) {
  const lay = layout(design)
  const ex = design.exterior
  const shape = findShape(design.shape)
  const front = frontEdge(shape)
  const deepest = Math.max(...front)
  const has = (id: ExtraId) => ex.extras.includes(id)
  const hit = (spot: Hotspot) => (onHotspot ? () => onHotspot(spot) : undefined)

  // かべ と まど（1かいから うえへ）。
  const floorsArt: ReactNode[] = []
  for (let floor = 0; floor < lay.floors; floor++) {
    const top = lay.groundY - BASE - (floor + 1) * FH
    floorsArt.push(
      <g key={`f${floor}`}>
        {facadeOpenings(design, floor).map((o, i) => <OpeningArt key={i} o={o} ex={ex} x={lay.houseX} floorTop={top} floor={floor} />)}
        {floor > 0 && <rect x={lay.houseX - 4} y={top + FH - 5} width={lay.houseW + 8} height={10} fill="#00000026" />}
      </g>,
    )
  }
  // おくに ひっこんだ れつ（にわに めんした ところ）は すこし くらく する。
  const recessed: ReactNode[] = []
  for (let x = 0; x < shape.width; x++) {
    if (front[x] < deepest) recessed.push(<rect key={x} x={lay.houseX + x * CW} y={lay.wallTop} width={CW} height={lay.floors * FH} fill="#00000022" />)
  }
  // ベランダ（2かいいじょう）か ウッドデッキ（ひらや）。
  const balcony: ReactNode[] = []
  if (has('balcony')) {
    if (lay.floors === 1) {
      const dx = lay.houseX + lay.houseW * .55
      balcony.push(
        <g key="deck">
          <rect x={dx} y={lay.groundY - 26} width={lay.houseW * .4 + 30} height={26} fill="#b07440" stroke="#7a4a24" strokeWidth={3} />
          {[8, 16].map((d) => <line key={d} x1={dx} y1={lay.groundY - 26 + d} x2={dx + lay.houseW * .4 + 30} y2={lay.groundY - 26 + d} stroke="#7a4a24" strokeWidth={2} />)}
        </g>,
      )
    } else {
      for (let floor = 1; floor < lay.floors; floor++) {
        const bottom = lay.groundY - BASE - floor * FH
        const bw = Math.max(120, lay.houseW * .5)
        const bx = lay.houseX + (lay.houseW - bw) / 2
        balcony.push(
          <g key={`b${floor}`}>
            <rect x={bx - 6} y={bottom - 4} width={bw + 12} height={10} fill="#9e9e9e" />
            <rect x={bx} y={bottom - 44} width={bw} height={6} fill="#ffffff" stroke="#757575" strokeWidth={2} />
            {Array.from({ length: Math.floor(bw / 14) }, (_, i) => <line key={i} x1={bx + 7 + i * 14} y1={bottom - 40} x2={bx + 7 + i * 14} y2={bottom - 4} stroke="#ffffff" strokeWidth={3} />)}
            {floor === 1 && (
              <g>
                <line x1={bx + 10} y1={bottom - 70} x2={bx + bw - 10} y2={bottom - 70} stroke="#757575" strokeWidth={2} />
                {[['#4fc3f7', .2], ['#ff8a80', .4], ['#fff176', .6], ['#a5d6a7', .8]].map(([c, p]) => (
                  <path key={p as number} d={`M${bx + bw * (p as number) - 12} ${bottom - 70} h 24 l 4 24 h -32 z`} fill={c as string} stroke="#00000033" strokeWidth={1.5} />
                ))}
              </g>
            )}
          </g>,
        )
      }
    }
  }

  const { spots } = lay
  const doorX = lay.doorX

  // いえの よこ（おく）: き・こいのぼり・ブランコ。
  const backItems: ReactNode[] = []
  if (spots.trees) {
    backItems.push(<Tree key="treeL" x={spots.trees[0]} y={lay.backY} />, <Tree key="treeR" x={spots.trees[1]} y={lay.backY} s={.9} />)
  }
  if (spots.koinobori !== undefined) backItems.push(<Koinobori key="koi" x={spots.koinobori} y={lay.backY} />)
  if (spots.swing !== undefined) backItems.push(<Swing key="swing" x={spots.swing} y={lay.backY} />)

  // まえの にわ（てまえ）: くるま・じてんしゃ・ポスト・はたけ・いけ・いぬごや。
  const frontItems: ReactNode[] = []
  const fy = lay.frontY
  if (spots.parking) {
    const { x, w, cars } = spots.parking
    frontItems.push(<rect key="pad" x={x} y={fy - 20} width={w} height={36} rx={6} fill="#b0b5ba" stroke="#8c9196" strokeWidth={2} />)
    if (ex.parking === 'garage') {
      frontItems.push(
        <g key="garage">
          <rect x={x + 4} y={fy - 128} width={8} height={120} fill="#78909c" />
          <rect x={x + w - 12} y={fy - 128} width={8} height={120} fill="#78909c" />
          <path d={`M${x - 8} ${fy - 126} L ${x + w + 8} ${fy - 140} v 12 L ${x - 8} ${fy - 114} z`} fill="#546e7a" />
        </g>,
      )
    }
    const colors = ex.parking === 'blue' ? ['#1e88e5'] : ex.parking === 'garage' ? ['#43a047'] : ex.parking === 'two' ? ['#e53935', '#fdd835'] : ['#e53935']
    cars.forEach((cx, i) => {
      frontItems.push(
        <g key={`car${i}`} transform={`translate(${cx} ${fy}) scale(${CAR_SCALE})`}>
          <Car x={0} y={0} color={colors[i]} label={cars.length > 1 ? `くるま ${i + 1}` : 'くるま'} onHit={hit('car')} />
        </g>,
      )
    })
  }
  if (spots.bike !== undefined) frontItems.push(<Bike key="bike" x={spots.bike} y={fy} />)
  if (spots.mailbox !== undefined) frontItems.push(<Mailbox key="mail" x={spots.mailbox} y={fy} />)
  if (spots.garden !== undefined) {
    const gx = spots.garden
    frontItems.push(ex.garden === 'veggies' ? (
      <g key="veg">
        <rect x={gx} y={fy - 44} width={150} height={44} rx={10} fill="#8d6e63" />
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <path d={`M${gx + 18 + i * 28} ${fy - 30} q -10 -18 -2 -24 q 4 10 2 24 q 6 -16 14 -18 q -2 12 -14 18z`} fill="#43a047" />
            <circle cx={gx + 18 + i * 28} cy={fy - 22} r={i % 2 ? 7 : 5} fill={i % 2 ? '#e53935' : '#ff9800'} />
          </g>
        ))}
      </g>
    ) : (
      <g key="pond">
        <ellipse cx={gx + 75} cy={fy - 22} rx={74} ry={22} fill="#4fc3f7" stroke="#90a4ae" strokeWidth={6} />
        <path d={`M${gx + 60} ${fy - 22} q 12 -10 24 0 q -12 10 -24 0 l -8 -6 v 12z`} fill="#ff7043" className={styles.fish} />
        <ellipse cx={gx + 108} cy={fy - 28} rx={10} ry={4} fill="#81c784" />
      </g>
    ))
  }
  if (spots.doghouse !== undefined && ex.doghouse !== 'none') {
    frontItems.push(<Doghouse key="dog" id={ex.doghouse} x={spots.doghouse} y={fy} onHit={hit('dog')} />)
  }

  const label = title ?? 'おうちの そとがわ'

  return (
    <svg
      viewBox={`0 0 ${lay.width} ${lay.height}`}
      className={styles.front}
      role={onHotspot ? 'group' : 'img'}
      aria-label={label}
      data-lively={lively || undefined}
    >
      <defs>
        <linearGradient id="house-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fd3ff" />
          <stop offset="1" stopColor="#e6f7ff" />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={lay.width} height={lay.height} fill="url(#house-sky)" />
      <circle cx={lay.width - 70} cy={60} r={34} fill="#ffe066" />
      <g className={styles.cloud}>
        <ellipse cx={120} cy={70} rx={50} ry={20} fill="#ffffff" />
        <ellipse cx={150} cy={58} rx={34} ry={20} fill="#ffffff" />
      </g>
      <g className={styles.cloudSlow}>
        <ellipse cx={lay.width * .55} cy={46} rx={44} ry={16} fill="#ffffffdd" />
        <ellipse cx={lay.width * .55 + 26} cy={36} rx={28} ry={16} fill="#ffffffdd" />
      </g>
      <path d={`M0 ${lay.groundY} Q ${lay.width * .25} ${lay.groundY - 70} ${lay.width * .5} ${lay.groundY} T ${lay.width} ${lay.groundY} Z`} fill="#b9e4a0" />

      {backItems}

      <rect x={lay.houseX - 6} y={lay.groundY - BASE} width={lay.houseW + 12} height={BASE + 4} fill="#9e9e9e" />
      <WallPattern wall={ex.wall} x={lay.houseX} y={lay.wallTop} w={lay.houseW} h={lay.floors * FH} />
      {recessed}
      <rect x={lay.houseX} y={lay.wallTop} width={lay.houseW} height={lay.floors * FH} fill="none" stroke="#00000044" strokeWidth={3} />
      <RoofArt roof={ex.roof} lay={lay} extras={ex.extras} />
      {floorsArt}
      {onHotspot && (
        <rect x={doorX - 36} y={lay.groundY - BASE - 104} width={72} height={104} fill="transparent" {...hotspotProps('げんかんの ドア', hit('door'))} />
      )}
      {balcony}

      <rect x={0} y={lay.groundY} width={lay.width} height={lay.ground} fill="#8bc34a" />
      <rect x={0} y={lay.groundY} width={lay.width} height={8} fill="#7cb342" />
      <GardenFront garden={ex.garden} lay={lay} doorXs={[doorX]} />
      <path d={`M${doorX - 30} ${lay.groundY + 4} L ${doorX - PATH} ${lay.height} H ${doorX + PATH} L ${doorX + 30} ${lay.groundY + 4} Z`} fill="#e3d5c3" />
      {[0, 1, 2, 3, 4].filter((i) => 20 + i * 38 < lay.ground - 8).map((i) => (
        <ellipse key={i} cx={doorX + (i % 2 ? 9 : -7)} cy={lay.groundY + 20 + i * 38} rx={24 + i * 2} ry={9 + i} fill="#cfc0ad" stroke="#a1887f" strokeWidth={2} />
      ))}
      {frontItems}
      {has('fence') && <Fence lay={lay} />}
    </svg>
  )
}

// ---------------- えらぶ ボタンの みほん ----------------

export type ExteriorCategory = 'wall' | 'roof' | 'window' | 'door' | 'parking' | 'doghouse' | 'garden' | 'extras'

const None = () => (
  <g>
    <circle cx={60} cy={45} r={26} fill="none" stroke="#b0bec5" strokeWidth={8} />
    <line x1={42} y1={63} x2={78} y2={27} stroke="#b0bec5" strokeWidth={8} />
  </g>
)

export function ExteriorSwatch({ category, id }: { category: ExteriorCategory; id: string }) {
  let art: ReactNode
  switch (category) {
    case 'wall':
      art = <g><WallPattern wall={id as WallId} x={8} y={8} w={104} h={74} /><rect x={8} y={8} width={104} height={74} fill="none" stroke="#00000033" strokeWidth={3} /></g>
      break
    case 'roof': {
      const r = findRoof(id as RoofId)
      const lay: Layout = {
        width: 120, height: 90, houseX: 30, houseW: 60, groundY: 88, ground: 2, wallTop: 60, roofH: r.kind === 'flat' ? 10 : r.kind === 'steep' ? 50 : 32,
        floors: 1, doorX: 60, backY: 88, frontY: 88, spots: {},
      }
      art = (
        <g>
          <rect x={30} y={60} width={60} height={28} fill="#fbf8f0" stroke="#00000033" strokeWidth={2} />
          <RoofArtMini kind={r.kind} color={r.color} dark={r.dark} lay={lay} />
        </g>
      )
      break
    }
    case 'window':
      art = <g><rect x={8} y={8} width={104} height={74} fill="#f3ead8" /><WindowArt style={id as WindowId} x={34} y={14} w={52} h={id === 'flowerbox' ? 46 : 58} frame="#ffffff" /></g>
      break
    case 'door':
      art = <g><rect x={8} y={8} width={104} height={74} fill="#f3ead8" /><DoorArt door={id as DoorId} x={38} y={12} w={44} h={70} /></g>
      break
    case 'parking':
      if (id === 'none') art = <None />
      else {
        const pid = id as ParkingId
        const color = pid === 'blue' ? '#1e88e5' : pid === 'garage' ? '#43a047' : '#e53935'
        art = (
          <g transform="translate(6 10) scale(.56)">
            {pid === 'garage' && <path d="M-4 30 L 200 18 v 10 L -4 42 z" fill="#546e7a" />}
            {pid === 'two' && <Car x={10} y={130} color="#fdd835" />}
            <Car x={pid === 'two' ? 0 : 6} y={pid === 'two' ? 146 : 140} color={color} />
          </g>
        )
      }
      break
    case 'doghouse':
      art = id === 'none' ? <None /> : <g transform="translate(14 6) scale(.62)"><Doghouse id={id as DoghouseId} x={0} y={130} /></g>
      break
    case 'garden':
      art = id === 'none' ? <None /> : <GardenSwatch id={id as GardenId} />
      break
    case 'extras':
      art = <ExtraSwatch id={id as ExtraId} />
      break
  }
  return <svg viewBox="0 0 120 90" aria-hidden="true" focusable="false">{art}</svg>
}

function RoofArtMini({ kind, color, dark, lay }: { kind: string; color: string; dark: string; lay: Layout }) {
  const x0 = lay.houseX - 10, x1 = lay.houseX + lay.houseW + 10, base = lay.wallTop, peak = base - lay.roofH, cx = (x0 + x1) / 2
  if (kind === 'flat') return <rect x={lay.houseX - 4} y={peak} width={lay.houseW + 8} height={lay.roofH} fill={color} stroke={dark} strokeWidth={3} />
  if (kind === 'kawara') return <path d={`M${x0 - 6} ${base + 2} Q ${x0 + 20} ${base - lay.roofH * .4} ${cx} ${peak} Q ${x1 - 20} ${base - lay.roofH * .4} ${x1 + 6} ${base + 2} Z`} fill={color} stroke={dark} strokeWidth={3} />
  return <path d={`M${x0} ${base} L ${cx} ${peak} L ${x1} ${base} Z`} fill={color} stroke={dark} strokeWidth={3} strokeLinejoin="round" />
}

function GardenSwatch({ id }: { id: GardenId }) {
  if (id === 'trees') return <g><Tree x={40} y={86} s={.55} /><Tree x={84} y={86} s={.6} /></g>
  if (id === 'veggies') {
    return (
      <g>
        <rect x={10} y={50} width={100} height={32} rx={8} fill="#8d6e63" />
        {[0, 1, 2, 3].map((i) => <g key={i}><path d={`M${24 + i * 24} ${60} q -8 -14 -2 -20 q 4 8 2 20 q 5 -12 12 -14 q -2 10 -12 14z`} fill="#43a047" /><circle cx={24 + i * 24} cy={68} r={6} fill={i % 2 ? '#e53935' : '#ff9800'} /></g>)}
      </g>
    )
  }
  if (id === 'pond') {
    return (
      <g>
        <ellipse cx={60} cy={58} rx={48} ry={22} fill="#4fc3f7" stroke="#90a4ae" strokeWidth={5} />
        <path d="M48 58 q 12 -10 24 0 q -12 10 -24 0 l -8 -6 v 12z" fill="#ff7043" />
      </g>
    )
  }
  return (
    <g>
      {[20, 40, 60, 80, 100].map((x, i) => (
        <g key={x}>
          <line x1={x} y1={84} x2={x} y2={52} stroke="#388e3c" strokeWidth={3} />
          <circle cx={x} cy={46 + (i % 2) * 8} r={10} fill={['#ff6b9a', '#ffd166', '#ef476f', '#c77dff', '#ff8a65'][i]} />
          <circle cx={x} cy={46 + (i % 2) * 8} r={4} fill="#ffeb3b" />
        </g>
      ))}
    </g>
  )
}

function ExtraSwatch({ id }: { id: ExtraId }) {
  switch (id) {
    case 'mailbox': return <Mailbox x={44} y={86} />
    case 'bike': return <Bike x={10} y={78} />
    case 'swing': return <g transform="translate(-4 4) scale(.7)"><Swing x={20} y={118} /></g>
    case 'chimney':
      return (
        <g>
          <path d="M10 84 L 60 40 L 110 84 Z" fill="#d9493b" />
          <rect x={72} y={22} width={20} height={46} fill="#a5523a" stroke="#6d2f1f" strokeWidth={2} />
          <circle cx={84} cy={14} r={8} fill="#cfd8dc" />
        </g>
      )
    case 'solar':
      return (
        <g>
          <path d="M10 84 L 60 30 L 110 84 Z" fill="#8a939b" />
          <polygon points="28,68 52,42 64,54 40,80" fill="#1a3d7c" stroke="#90caf9" strokeWidth={2} />
          <polygon points="56,40 70,26 82,38 68,52" fill="#1a3d7c" stroke="#90caf9" strokeWidth={2} />
        </g>
      )
    case 'fence':
      return (
        <g>
          <rect x={6} y={46} width={108} height={6} fill="#eeeeee" stroke="#9e9e9e" />
          {[10, 32, 54, 76, 98].map((x) => <path key={x} d={`M${x} 84 v -40 l 8 -10 l 8 10 v 40 z`} fill="#ffffff" stroke="#9e9e9e" strokeWidth={2} />)}
        </g>
      )
    case 'koinobori': return <g transform="translate(0 -4) scale(.3)"><Koinobori x={60} y={300} /></g>
    case 'balcony':
      return (
        <g>
          <rect x={14} y={10} width={92} height={74} fill="#fbf8f0" stroke="#00000033" />
          <rect x={20} y={48} width={80} height={5} fill="#ffffff" stroke="#757575" />
          {[26, 38, 50, 62, 74, 86].map((x) => <line key={x} x1={x} y1={52} x2={x} y2={80} stroke="#9e9e9e" strokeWidth={3} />)}
          <rect x={14} y={80} width={92} height={6} fill="#9e9e9e" />
          <line x1={24} y1={20} x2={96} y2={20} stroke="#757575" strokeWidth={2} />
          <path d="M36 20 h 18 l 3 22 h -24 z" fill="#4fc3f7" />
          <path d="M66 20 h 18 l 3 22 h -24 z" fill="#ff8a80" />
        </g>
      )
  }
}
