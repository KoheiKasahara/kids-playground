import type { ReactNode } from 'react'
import { findRoomStyle, findRoomType, type RoomStyle, type RoomTypeId } from './data'
import { HobbyRoomArt } from './HobbyRoomArt'

// まどりずの へやを うえから みた え。1マスは 100。ゆかの もようと かぐは すべて コードで かいた オリジナル。

export const CELL = 100
const WALL = '#4a3b30'

type Box = { x: number; y: number; w: number; h: number }

const inset = (b: Box, d: number): Box => ({ x: b.x + d, y: b.y + d, w: Math.max(0, b.w - d * 2), h: Math.max(0, b.h - d * 2) })

/** いつも おなじ ばしょに おなじ いしが ならぶ ための かんたんな みだれかず。 */
function hash(a: number, b: number) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453
  return s - Math.floor(s)
}

// ---------------- ゆか ----------------

function Floor({ b, s }: { b: Box; s: RoomStyle }) {
  const lines: ReactNode[] = []
  const wide = b.w >= b.h
  switch (s.floor) {
    case 'wood': {
      const step = 20
      const span = wide ? b.h : b.w
      for (let i = step, row = 0; i < span; i += step, row++) {
        lines.push(wide
          ? <line key={`l${i}`} x1={b.x} y1={b.y + i} x2={b.x + b.w} y2={b.y + i} />
          : <line key={`l${i}`} x1={b.x + i} y1={b.y} x2={b.x + i} y2={b.y + b.h} />)
        const length = wide ? b.w : b.h
        for (let j = (row % 2) * 45 + 30; j < length; j += 90) {
          lines.push(wide
            ? <line key={`j${i}-${j}`} x1={b.x + j} y1={b.y + i - step} x2={b.x + j} y2={b.y + i} />
            : <line key={`j${i}-${j}`} x1={b.x + i - step} y1={b.y + j} x2={b.x + i} y2={b.y + j} />)
        }
      }
      break
    }
    case 'tile':
      for (let i = 33; i < b.w; i += 33.3) lines.push(<line key={`v${i}`} x1={b.x + i} y1={b.y} x2={b.x + i} y2={b.y + b.h} />)
      for (let i = 33; i < b.h; i += 33.3) lines.push(<line key={`h${i}`} x1={b.x} y1={b.y + i} x2={b.x + b.w} y2={b.y + i} />)
      break
    case 'tatami':
      for (let row = 0; row * 50 < b.h; row++) {
        const offset = row % 2 ? -50 : 0
        for (let x = offset; x < b.w; x += 100) {
          const x0 = Math.max(0, x), x1 = Math.min(b.w, x + 100)
          const y0 = row * 50, y1 = Math.min(b.h, row * 50 + 50)
          lines.push(<rect key={`t${row}-${x}`} x={b.x + x0 + 1.5} y={b.y + y0 + 1.5} width={Math.max(0, x1 - x0 - 3)} height={Math.max(0, y1 - y0 - 3)} rx={2} fill="none" strokeWidth={3} />)
        }
      }
      break
    case 'carpet':
      for (let y = 25; y < b.h; y += 50) {
        for (let x = (y / 25) % 4 === 1 ? 25 : 50; x < b.w; x += 50) lines.push(<circle key={`c${x}-${y}`} cx={b.x + x} cy={b.y + y} r={5} fill={s.line} stroke="none" />)
      }
      break
    case 'checker':
      for (let y = 0; y < b.h; y += 50) {
        for (let x = (y / 50) % 2 ? 0 : 50; x < b.w; x += 100) {
          lines.push(<rect key={`k${x}-${y}`} x={b.x + x} y={b.y + y} width={Math.min(50, b.w - x)} height={Math.min(50, b.h - y)} fill={s.line} stroke="none" />)
        }
      }
      break
    case 'stone':
      for (let y = 0; y < b.h; y += 34) {
        for (let x = (y / 34) % 2 ? -17 : 0; x < b.w; x += 34) {
          const jx = hash(x + b.x, y + b.y) * 6, jy = hash(y + b.y, x + b.x) * 6
          const x0 = Math.max(0, x + 3 + jx / 2), y0 = y + 3 + jy / 2
          const w = Math.min(b.w - x0 - 2, 28 - jx / 2), h = Math.min(b.h - y0 - 2, 28 - jy / 2)
          if (w > 4 && h > 4) lines.push(<rect key={`s${x}-${y}`} x={b.x + x0} y={b.y + y0} width={w} height={h} rx={9} fill="none" strokeWidth={3} />)
        }
      }
      break
    case 'marble':
      for (let i = 0; i < Math.ceil((b.w + b.h) / 90); i++) {
        const sx = b.x + hash(i, b.x) * b.w, sy = b.y
        lines.push(<path key={`m${i}`} d={`M${sx} ${sy} q ${b.w * .1} ${b.h * .3} ${-b.w * .05} ${b.h * .55} t ${b.w * .08} ${b.h * .45}`} fill="none" strokeWidth={2.5} opacity={.6} />)
      }
      break
  }
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={s.base} />
      <g stroke={s.line} strokeWidth={2}>{lines}</g>
    </g>
  )
}

// ---------------- こもの ----------------

const Plant = ({ x, y, r = 14 }: { x: number; y: number; r?: number }) => (
  <g>
    <circle cx={x} cy={y} r={r * .62} fill="#b5673a" />
    <circle cx={x - r * .45} cy={y - r * .2} r={r * .55} fill="#4caf50" />
    <circle cx={x + r * .45} cy={y - r * .15} r={r * .55} fill="#43a047" />
    <circle cx={x} cy={y - r * .55} r={r * .55} fill="#66bb6a" />
  </g>
)

const Flower = ({ x, y, r = 9, color }: { x: number; y: number; r?: number; color: string }) => (
  <g>
    {[0, 72, 144, 216, 288].map((a) => (
      <circle key={a} cx={x + Math.cos((a * Math.PI) / 180) * r * .7} cy={y + Math.sin((a * Math.PI) / 180) * r * .7} r={r * .5} fill={color} />
    ))}
    <circle cx={x} cy={y} r={r * .4} fill="#ffd54f" />
  </g>
)

function Star({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * .45 : r
    return `${(x + Math.cos(a) * rr).toFixed(1)},${(y + Math.sin(a) * rr).toFixed(1)}`
  }).join(' ')
  return <polygon points={points} fill={color} />
}

const Chair = ({ x, y, color, r = 11 }: { x: number; y: number; color: string; r?: number }) => (
  <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={r * .45} fill={color} stroke="#00000033" strokeWidth={2} />
)

// ---------------- へや ごとの かぐ ----------------

function Living({ b, s }: { b: Box; s: RoomStyle }) {
  const wide = b.w >= b.h
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const items: ReactNode[] = []
  // じゅうたん
  if (s.variant === 'pop') {
    const r = Math.min(b.w, b.h) * .3
    ;['#ffd166', '#06d6a0', '#4dc9ff', '#ff6b9a'].forEach((c, i) => items.push(<circle key={`rug${i}`} cx={cx} cy={cy} r={r * (1 - i * .22)} fill={c} opacity={.75} />))
  } else {
    items.push(<rect key="rug" x={cx - b.w * .28} y={cy - b.h * .22} width={b.w * .56} height={b.h * .44} rx={10} fill={s.accent} opacity={.45} />)
  }
  // ローテーブル
  items.push(<rect key="table" x={cx - 26} y={cy - 16} width={52} height={32} rx={6} fill={s.variant === 'pop' ? '#ffffff' : '#a0673a'} stroke="#00000033" strokeWidth={2} />)
  // ソファ と テレビ
  if (wide) {
    const sw = Math.min(b.w * .62, 230), sx = cx - sw / 2, sy = b.y + b.h - 46
    items.push(
      <g key="sofa">
        <rect x={sx} y={sy} width={sw} height={40} rx={10} fill={s.main} />
        <rect x={sx} y={sy + 26} width={sw} height={14} rx={6} fill="#00000033" />
        <rect x={sx - 4} y={sy - 2} width={16} height={44} rx={7} fill={s.main} stroke="#00000033" strokeWidth={2} />
        <rect x={sx + sw - 12} y={sy - 2} width={16} height={44} rx={7} fill={s.main} stroke="#00000033" strokeWidth={2} />
        {s.variant === 'pop' && [.3, .5, .7].map((p, i) => <circle key={p} cx={sx + sw * p} cy={sy + 14} r={8} fill={['#ffd166', '#4dc9ff', '#06d6a0'][i]} />)}
      </g>,
      <g key="tv">
        <rect x={cx - 50} y={b.y + 6} width={100} height={20} rx={4} fill="#6d4c41" />
        <rect x={cx - 40} y={b.y + 8} width={80} height={8} rx={2} fill="#263238" />
      </g>,
    )
  } else {
    const sh = Math.min(b.h * .62, 230), sy = cy - sh / 2, sx = b.x + 6
    items.push(
      <g key="sofa">
        <rect x={sx} y={sy} width={40} height={sh} rx={10} fill={s.main} />
        <rect x={sx} y={sy} width={14} height={sh} rx={6} fill="#00000033" />
      </g>,
      <g key="tv">
        <rect x={b.x + b.w - 26} y={cy - 50} width={20} height={100} rx={4} fill="#6d4c41" />
        <rect x={b.x + b.w - 16} y={cy - 40} width={8} height={80} rx={2} fill="#263238" />
      </g>,
    )
  }
  if (s.variant === 'fireplace') {
    const fx = b.x + b.w - 52, fy = b.y + 4
    items.push(
      <g key="fire">
        <rect x={fx} y={fy} width={46} height={30} rx={3} fill="#8d3b2b" />
        <rect x={fx + 8} y={fy + 6} width={30} height={18} rx={8} fill="#2b1b17" />
        <path d={`M${fx + 23} ${fy + 8} q 9 8 2 14 q -2 -5 -5 -3 q -6 -5 3 -11z`} fill="#ff9800" />
        <circle cx={fx + 23} cy={fy + 20} r={4} fill="#ffeb3b" />
      </g>,
    )
  } else {
    items.push(<Plant key="plant" x={b.x + b.w - 20} y={b.y + 22} />)
  }
  return <g>{items}</g>
}

function Dining({ b, s }: { b: Box; s: RoomStyle }) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  if (s.variant === 'round') {
    const r = Math.min(b.w, b.h) * .22
    return (
      <g>
        {[0, 90, 180, 270].map((a) => <Chair key={a} x={cx + Math.cos((a * Math.PI) / 180) * (r + 16)} y={cy + Math.sin((a * Math.PI) / 180) * (r + 16)} color={s.accent} />)}
        <circle cx={cx} cy={cy} r={r} fill={s.main} stroke="#00000033" strokeWidth={3} />
        <circle cx={cx} cy={cy} r={r * .3} fill="#ffcc80" />
        <Flower x={cx} y={cy} r={8} color="#ef5350" />
      </g>
    )
  }
  if (s.variant === 'cafe') {
    const tables = b.w >= b.h
      ? [{ x: b.x + b.w * .3, y: cy + 10 }, { x: b.x + b.w * .72, y: cy + 10 }]
      : [{ x: cx, y: b.y + b.h * .35 }, { x: cx, y: b.y + b.h * .75 }]
    return (
      <g>
        <rect x={b.x + 6} y={b.y + 6} width={b.w - 12} height={18} rx={4} fill={s.main} />
        {tables.map((t, i) => (
          <g key={i}>
            <Chair x={t.x - 32} y={t.y} color={s.accent} r={9} />
            <Chair x={t.x + 32} y={t.y} color={s.accent} r={9} />
            <circle cx={t.x} cy={t.y} r={20} fill="#ffffff" stroke={s.main} strokeWidth={4} />
            <circle cx={t.x} cy={t.y} r={6} fill="#a1887f" />
          </g>
        ))}
      </g>
    )
  }
  const wide = b.w >= b.h
  const tw = wide ? Math.min(b.w * .55, 170) : Math.min(b.w * .45, 80)
  const th = wide ? Math.min(b.h * .4, 80) : Math.min(b.h * .55, 170)
  const seats = Math.max(1, Math.round((wide ? tw : th) / 50))
  const chairs: ReactNode[] = []
  for (let i = 0; i < seats; i++) {
    const p = (i + .5) / seats
    if (wide) {
      chairs.push(<Chair key={`a${i}`} x={cx - tw / 2 + tw * p} y={cy - th / 2 - 12} color={s.accent} />, <Chair key={`b${i}`} x={cx - tw / 2 + tw * p} y={cy + th / 2 + 12} color={s.accent} />)
    } else {
      chairs.push(<Chair key={`a${i}`} x={cx - tw / 2 - 12} y={cy - th / 2 + th * p} color={s.accent} />, <Chair key={`b${i}`} x={cx + tw / 2 + 12} y={cy - th / 2 + th * p} color={s.accent} />)
    }
  }
  return (
    <g>
      {chairs}
      <rect x={cx - tw / 2} y={cy - th / 2} width={tw} height={th} rx={6} fill={s.main} stroke="#00000033" strokeWidth={3} />
      {Array.from({ length: seats }, (_, i) => {
        const p = (i + .5) / seats
        return wide
          ? [<circle key={`p${i}`} cx={cx - tw / 2 + tw * p} cy={cy - th / 4} r={9} fill="#fff" />, <circle key={`q${i}`} cx={cx - tw / 2 + tw * p} cy={cy + th / 4} r={9} fill="#fff" />]
          : [<circle key={`p${i}`} cx={cx - tw / 4} cy={cy - th / 2 + th * p} r={9} fill="#fff" />, <circle key={`q${i}`} cx={cx + tw / 4} cy={cy - th / 2 + th * p} r={9} fill="#fff" />]
      })}
    </g>
  )
}

function Kitchen({ b, s }: { b: Box; s: RoomStyle }) {
  const wide = b.w >= b.h
  const depth = 34
  const fridgeColor = s.id === 'retro' ? s.main : '#dfe6ea'
  const counter = wide ? { x: b.x + 4, y: b.y + 4, w: b.w - 52, h: depth } : { x: b.x + 4, y: b.y + 4, w: depth, h: b.h - 52 }
  const along = (p: number) => (wide ? { x: counter.x + counter.w * p, y: counter.y + depth / 2 } : { x: counter.x + depth / 2, y: counter.y + counter.h * p })
  const sink = along(.3), stove = along(.72)
  const fridge = wide ? { x: b.x + b.w - 46, y: b.y + 4 } : { x: b.x + 4, y: b.y + b.h - 46 }
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const counterColor = s.variant === 'island' ? '#f5f5f5' : s.main
  return (
    <g>
      <rect x={counter.x} y={counter.y} width={counter.w} height={counter.h} rx={4} fill={counterColor} stroke="#00000040" strokeWidth={2} />
      <rect x={sink.x - 14} y={sink.y - 10} width={28} height={20} rx={7} fill="#b0bec5" stroke="#78909c" strokeWidth={2} />
      <circle cx={sink.x} cy={sink.y - 6} r={3} fill="#607d8b" />
      <rect x={stove.x - 18} y={stove.y - 12} width={36} height={24} rx={3} fill="#37474f" />
      <circle cx={stove.x - 8} cy={stove.y} r={6} fill="none" stroke="#ff7043" strokeWidth={2.5} />
      <circle cx={stove.x + 8} cy={stove.y} r={6} fill="none" stroke="#ff7043" strokeWidth={2.5} />
      <rect x={fridge.x} y={fridge.y} width={42} height={42} rx={5} fill={fridgeColor} stroke="#00000040" strokeWidth={2} />
      <line x1={fridge.x + 6} y1={fridge.y + 16} x2={fridge.x + 36} y2={fridge.y + 16} stroke="#00000030" strokeWidth={2} />
      {s.variant === 'island' ? (
        <g>
          <rect x={cx - (wide ? 50 : 18)} y={cy - (wide ? 4 : 50) + (wide ? 18 : 0)} width={wide ? 100 : 36} height={wide ? 30 : 100} rx={6} fill="#fafafa" stroke={s.accent} strokeWidth={4} />
          {wide
            ? [-30, 0, 30].map((d) => <circle key={d} cx={cx + d} cy={cy + 46} r={8} fill={s.accent} />)
            : [-30, 0, 30].map((d) => <circle key={d} cx={cx + 30} cy={cy + d} r={8} fill={s.accent} />)}
        </g>
      ) : (
        <rect x={wide ? sink.x - 24 : sink.x + 22} y={wide ? sink.y + 22 : sink.y - 24} width={wide ? 48 : 22} height={wide ? 22 : 48} rx={6} fill={s.accent} opacity={.7} />
      )}
    </g>
  )
}

function Bath({ b, s }: { b: Box; s: RoomStyle }) {
  const wide = b.w >= b.h
  const tub = wide ? { x: b.x + 6, y: b.y + 6, w: b.w * .58, h: b.h - 12 } : { x: b.x + 6, y: b.y + 6, w: b.w - 12, h: b.h * .58 }
  const wash = wide ? { x: b.x + b.w * .58 + 12, y: b.y + 6, w: b.w * .42 - 18, h: b.h - 12 } : { x: b.x + 6, y: b.y + b.h * .58 + 12, w: b.w - 12, h: b.h * .42 - 18 }
  const wx = wash.x + wash.w / 2, wy = wash.y + wash.h / 2
  let tubArt: ReactNode
  if (s.variant === 'onsen') {
    const rocks: ReactNode[] = []
    const perim = 2 * (tub.w + tub.h)
    const n = Math.max(10, Math.round(perim / 28))
    for (let i = 0; i < n; i++) {
      let d = (i / n) * perim
      let x: number, y: number
      if (d < tub.w) { x = tub.x + d; y = tub.y } else if ((d -= tub.w) < tub.h) { x = tub.x + tub.w; y = tub.y + d } else if ((d -= tub.h) < tub.w) { x = tub.x + tub.w - d; y = tub.y + tub.h } else { d -= tub.w; x = tub.x; y = tub.y + tub.h - d }
      rocks.push(<circle key={i} cx={x} cy={y} r={11 + hash(i, perim) * 6} fill={hash(perim, i) > .5 ? '#8d8579' : '#a59d90'} stroke="#6b645a" strokeWidth={2} />)
    }
    tubArt = (
      <g>
        <rect x={tub.x + 6} y={tub.y + 6} width={tub.w - 12} height={tub.h - 12} rx={30} fill={s.accent} />
        {rocks}
        <path d={`M${tub.x + tub.w * .4} ${tub.y + tub.h * .45} q 8 -10 0 -20 q -8 -10 0 -20`} fill="none" stroke="#ffffffcc" strokeWidth={4} strokeLinecap="round" />
        <path d={`M${tub.x + tub.w * .6} ${tub.y + tub.h * .6} q 8 -10 0 -20 q -8 -10 0 -20`} fill="none" stroke="#ffffffcc" strokeWidth={4} strokeLinecap="round" />
      </g>
    )
  } else {
    const rim = s.variant === 'hinoki' ? 4 : 18
    tubArt = (
      <g>
        <rect x={tub.x} y={tub.y} width={tub.w} height={tub.h} rx={rim} fill={s.main} stroke="#00000040" strokeWidth={3} />
        {s.variant === 'hinoki' && Array.from({ length: Math.floor(tub.w / 18) }, (_, i) => <line key={i} x1={tub.x + 18 * (i + 1)} y1={tub.y} x2={tub.x + 18 * (i + 1)} y2={tub.y + 10} stroke="#b08850" strokeWidth={2} />)}
        <rect x={tub.x + 10} y={tub.y + 10} width={tub.w - 20} height={tub.h - 20} rx={Math.max(4, rim - 6)} fill={s.accent} />
        <path d={`M${tub.x + 18} ${tub.y + tub.h * .45} q 12 -8 24 0 t 24 0`} fill="none" stroke="#ffffffaa" strokeWidth={3} />
        {s.variant === 'bubble' && Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={tub.x + 18 + hash(i, 3) * (tub.w - 36)} cy={tub.y + 18 + hash(3, i) * (tub.h - 36)} r={5 + hash(i, i) * 7} fill="#ffffff" opacity={.85} />
        ))}
        {s.variant === 'bubble' ? null : <circle cx={tub.x + tub.w - 22} cy={tub.y + tub.h - 22} r={9} fill="#ffeb3b" stroke="#f9a825" strokeWidth={2} />}
      </g>
    )
  }
  return (
    <g>
      {tubArt}
      <rect x={wx - 12} y={wy - 8} width={24} height={18} rx={4} fill={s.variant === 'hinoki' || s.variant === 'onsen' ? '#c49a6c' : '#ffffff'} stroke="#00000040" strokeWidth={2} />
      <circle cx={wx + (wide ? 0 : 26)} cy={wy + (wide ? 28 : 0)} r={9} fill="#ffca28" stroke="#f57f17" strokeWidth={2} />
      <circle cx={wide ? wash.x + wash.w - 6 : wx} cy={wide ? wy : wash.y + wash.h - 6} r={5} fill="#90a4ae" />
    </g>
  )
}

function Toilet({ b, s }: { b: Box; s: RoomStyle }) {
  const cx = b.x + b.w / 2
  const tank = { w: 38, h: 14 }
  return (
    <g>
      <rect x={cx - tank.w / 2} y={b.y + 4} width={tank.w} height={tank.h} rx={4} fill={s.main} stroke="#00000055" strokeWidth={2} />
      <ellipse cx={cx} cy={b.y + 4 + tank.h + 18} rx={15} ry={20} fill={s.main} stroke="#00000055" strokeWidth={2} />
      <ellipse cx={cx} cy={b.y + 4 + tank.h + 20} rx={9} ry={13} fill="#d9eef7" />
      {s.id === 'hotel' && <rect x={cx - tank.w / 2} y={b.y + 4} width={tank.w} height={4} fill={s.accent} />}
      <circle cx={b.x + b.w - 10} cy={b.y + b.h * .55} r={6} fill="#ffffff" stroke="#00000040" strokeWidth={2} />
      <rect x={b.x + 4} y={b.y + b.h - 18} width={b.w - 8} height={12} rx={5} fill={s.accent} opacity={.6} />
      {s.variant === 'flower' && <Flower x={b.x + 14} y={b.y + 14} r={9} color={s.accent} />}
      {s.variant === 'plant' && <Plant x={b.x + 14} y={b.y + 18} r={11} />}
    </g>
  )
}

function Washroom({ b, s }: { b: Box; s: RoomStyle }) {
  const wide = b.w >= b.h
  const vanity = wide ? { x: b.x + 4, y: b.y + 4, w: Math.min(b.w * .55, 120), h: 30 } : { x: b.x + 4, y: b.y + 4, w: b.w - 8, h: 30 }
  const machine = wide ? { x: b.x + b.w - 46, y: b.y + 6 } : { x: b.x + b.w / 2 - 21, y: b.y + b.h - 50 }
  const vx = vanity.x + vanity.w / 2
  return (
    <g>
      <rect x={vanity.x} y={vanity.y} width={vanity.w} height={vanity.h} rx={4} fill={s.main} stroke="#00000040" strokeWidth={2} />
      <rect x={vanity.x} y={vanity.y} width={vanity.w} height={5} fill={s.accent} />
      <ellipse cx={vx} cy={vanity.y + 17} rx={14} ry={9} fill="#e3f2fd" stroke="#90a4ae" strokeWidth={2} />
      <rect x={machine.x} y={machine.y} width={42} height={42} rx={5} fill="#ffffff" stroke="#00000040" strokeWidth={2} />
      <circle cx={machine.x + 21} cy={machine.y + 22} r={13} fill="#bbdefb" stroke={s.accent} strokeWidth={3} />
      <g>
        <rect x={wide ? vx - 22 : b.x + b.w / 2 - 20} y={wide ? b.y + b.h - 34 : b.y + b.h * .45} width={40} height={24} rx={5} fill={s.variant === 'marine' ? '#ffffff' : s.accent} />
        {s.variant === 'marine' && [0, 8, 16].map((d) => <rect key={d} x={(wide ? vx - 22 : b.x + b.w / 2 - 20)} y={(wide ? b.y + b.h - 34 : b.y + b.h * .45) + d + 2} width={40} height={4} fill={s.accent} />)}
      </g>
    </g>
  )
}

function Bed({ x, y, w, h, s, kid = false }: { x: number; y: number; w: number; h: number; s: RoomStyle; kid?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={s.main} stroke="#00000040" strokeWidth={3} />
      <rect x={x} y={y} width={w} height={10} rx={4} fill={kid ? s.accent : '#6d4c41'} />
      <rect x={x + w * .15} y={y + 14} width={w * .7} height={Math.min(26, h * .18)} rx={8} fill="#ffffff" stroke="#00000022" strokeWidth={2} />
      <rect x={x + 3} y={y + h * .42} width={w - 6} height={h * .55} rx={8} fill={kid ? '#ffffff' : s.accent} opacity={kid ? 1 : .9} />
      {kid && <rect x={x + 3} y={y + h * .42} width={w - 6} height={h * .55} rx={8} fill={s.accent} opacity={.55} />}
    </g>
  )
}

function Bedroom({ b, s }: { b: Box; s: RoomStyle }) {
  const items: ReactNode[] = []
  if (s.variant === 'stars') {
    for (let i = 0; i < 7; i++) items.push(<Star key={`st${i}`} x={b.x + 14 + hash(i, b.w) * (b.w - 28)} y={b.y + 14 + hash(b.h, i) * (b.h - 28)} r={8} color={s.accent} />)
  }
  const twin = s.variant === 'twin' && b.w >= 180
  const bw = twin ? Math.min(70, b.w * .32) : Math.min(110, b.w * .55)
  const bh = Math.min(170, b.h * .8)
  const by = b.y + 6
  if (twin) {
    const gap = 22
    items.push(<Bed key="bed1" x={b.x + b.w / 2 - bw - gap / 2} y={by} w={bw} h={bh} s={s} />, <Bed key="bed2" x={b.x + b.w / 2 + gap / 2} y={by} w={bw} h={bh} s={s} />)
    items.push(<rect key="stand" x={b.x + b.w / 2 - 9} y={by + 4} width={18} height={18} rx={3} fill="#8d6e63" />, <circle key="lamp" cx={b.x + b.w / 2} cy={by + 13} r={6} fill="#fff59d" />)
  } else {
    const bx = b.x + Math.max(6, b.w * .14)
    if (s.variant === 'canopy') items.push(<rect key="canopy" x={bx - 10} y={by - 2} width={bw + 20} height={bh + 10} rx={20} fill="none" stroke={s.accent} strokeWidth={4} strokeDasharray="10 8" />)
    items.push(<Bed key="bed" x={bx} y={by} w={bw} h={bh} s={s} />)
    if (b.w - (bx - b.x + bw) > 34) {
      const sx = bx + bw + (s.variant === 'canopy' ? 16 : 8)
      items.push(<rect key="stand" x={sx} y={by + 4} width={22} height={22} rx={4} fill="#8d6e63" />, <circle key="lamp" cx={sx + 11} cy={by + 15} r={7} fill="#fff59d" />)
    }
    if (s.variant === 'canopy') items.push(<path key="heart" d={`M${b.x + b.w - 24} ${b.y + b.h - 22} c -6 -8 -16 -2 -10 6 l 10 10 l 10 -10 c 6 -8 -4 -14 -10 -6z`} fill={s.accent} />)
  }
  return <g>{items}</g>
}

function Kids({ b, s }: { b: Box; s: RoomStyle }) {
  const items: ReactNode[] = []
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  // テーマの かざり
  if (s.variant === 'space') {
    for (let i = 0; i < 6; i++) items.push(<Star key={`s${i}`} x={b.x + 12 + hash(i, 7) * (b.w - 24)} y={b.y + 12 + hash(7, i) * (b.h - 24)} r={6} color="#fff59d" />)
    items.push(
      <g key="planet">
        <circle cx={cx + b.w * .18} cy={cy + b.h * .18} r={16} fill={s.accent} />
        <ellipse cx={cx + b.w * .18} cy={cy + b.h * .18} rx={26} ry={7} fill="none" stroke="#ffe082" strokeWidth={3} />
      </g>,
      <g key="rocket" transform={`translate(${cx - b.w * .05} ${cy + b.h * .12}) rotate(-30)`}>
        <path d="M0 -24 q 10 10 9 28 h -18 q -1 -18 9 -28z" fill="#eceff1" />
        <circle cx={0} cy={-6} r={4} fill="#4fc3f7" />
        <path d="M-9 4 l -6 9 h 6z M9 4 l 6 9 h -6z" fill="#ef5350" />
        <path d="M-4 5 l 4 9 l 4 -9z" fill="#ffb300" />
      </g>,
    )
  } else if (s.variant === 'flower') {
    for (let i = 0; i < 6; i++) items.push(<Flower key={`f${i}`} x={b.x + 16 + hash(i, 5) * (b.w - 32)} y={b.y + 16 + hash(5, i) * (b.h - 32)} r={9} color={['#ff70a6', '#ffd166', '#c77dff'][i % 3]} />)
  } else if (s.variant === 'dino') {
    const dx = cx + b.w * .12, dy = cy + b.h * .16
    items.push(
      <g key="dino">
        <path d={`M${dx - 30} ${dy + 4} q -14 -2 -20 6 q 14 2 22 0z`} fill={s.accent} />
        <ellipse cx={dx} cy={dy} rx={30} ry={16} fill={s.accent} />
        <path d={`M${dx - 16} ${dy - 14} l 6 -10 l 6 9 l 6 -10 l 6 10 l 6 -9 l 4 10z`} fill="#ffb703" />
        <path d={`M${dx + 22} ${dy - 6} q 10 -22 22 -18 q 8 4 0 12 q -8 4 -12 14z`} fill={s.accent} />
        <circle cx={dx + 41} cy={dy - 18} r={2.5} fill="#1b1b1b" />
        <rect x={dx - 18} y={dy + 10} width={8} height={10} rx={3} fill={s.accent} />
        <rect x={dx + 10} y={dy + 10} width={8} height={10} rx={3} fill={s.accent} />
      </g>,
    )
  } else if (s.variant === 'train') {
    const tw = Math.min(b.w - 40, 170), th = Math.min(b.h - 40, 110)
    const tx = cx - tw / 2 + (b.w > 200 ? b.w * .12 : 0), ty = cy - th / 2 + 10
    items.push(
      <g key="rail">
        <rect x={tx} y={ty} width={tw} height={th} rx={th / 2.4} fill="none" stroke="#8d6e63" strokeWidth={12} />
        <rect x={tx} y={ty} width={tw} height={th} rx={th / 2.4} fill="none" stroke="#d7ccc8" strokeWidth={6} strokeDasharray="4 8" />
        <rect x={tx + tw * .35} y={ty - 10} width={30} height={20} rx={5} fill={s.accent} />
        <rect x={tx + tw * .35 + 33} y={ty - 9} width={22} height={18} rx={4} fill="#ffd166" />
        <rect x={tx + tw * .35 + 4} y={ty - 6} width={10} height={8} rx={2} fill="#bbdefb" />
      </g>,
    )
  }
  // ベッド と つくえ
  const bw = Math.min(70, b.w * .38), bh = Math.min(120, b.h * .6)
  items.push(<Bed key="bed" x={b.x + 6} y={b.y + 6} w={bw} h={bh} s={s} kid />)
  const dx = b.x + b.w - 56
  if (dx > b.x + bw + 10) {
    items.push(
      <g key="desk">
        <rect x={dx} y={b.y + 6} width={50} height={28} rx={3} fill="#c49a6c" stroke="#00000033" strokeWidth={2} />
        <circle cx={dx + 25} cy={b.y + 46} r={10} fill={s.accent} />
        <rect x={dx + 8} y={b.y + 10} width={16} height={12} rx={1} fill="#ffffff" />
      </g>,
    )
  }
  items.push(
    <g key="toy">
      <rect x={b.x + 8} y={b.y + b.h - 34} width={34} height={26} rx={4} fill={s.accent} stroke="#00000033" strokeWidth={2} />
      <circle cx={b.x + 18} cy={b.y + b.h - 34} r={6} fill="#ffd166" />
      <rect x={b.x + 26} y={b.y + b.h - 42} width={10} height={10} fill="#06d6a0" />
    </g>,
  )
  return <g>{items}</g>
}

function Washitsu({ b, s }: { b: Box; s: RoomStyle }) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2
  const zabuton = (x: number, y: number, key: string) => <rect key={key} x={x - 14} y={y - 14} width={28} height={28} rx={6} fill={s.accent} stroke="#00000033" strokeWidth={2} />
  const items: ReactNode[] = []
  if (s.variant === 'tokonoma') {
    items.push(
      <g key="toko">
        <rect x={b.x + 4} y={b.y + 4} width={Math.min(110, b.w * .5)} height={26} fill="#a1887f" stroke="#5d4037" strokeWidth={2} />
        <rect x={b.x + 18} y={b.y + 6} width={18} height={6} fill="#fff8e1" stroke="#5d4037" strokeWidth={1.5} />
        <circle cx={b.x + Math.min(110, b.w * .5) - 14} cy={b.y + 17} r={7} fill="#5d4037" />
        <Flower x={b.x + Math.min(110, b.w * .5) - 14} y={b.y + 10} r={7} color={s.accent} />
      </g>,
    )
  }
  if (s.variant === 'tea') {
    items.push(
      <g key="ro">
        <rect x={cx - 22} y={cy - 22} width={44} height={44} fill="#3e2723" />
        <rect x={cx - 15} y={cy - 15} width={30} height={30} fill="#9e9e9e" />
        <circle cx={cx - 4} cy={cy + 2} r={5} fill="#ff7043" />
        <circle cx={cx + 6} cy={cy - 4} r={4} fill="#ff5722" />
      </g>,
      zabuton(cx, cy + 46, 'z1'),
      <g key="bowl"><circle cx={cx + 40} cy={cy + 14} r={10} fill="#4e342e" /><circle cx={cx + 40} cy={cy + 14} r={6} fill={s.accent} /></g>,
    )
  } else if (s.variant === 'kotatsu') {
    items.push(
      zabuton(cx - 54, cy, 'z1'), zabuton(cx + 54, cy, 'z2'),
      <rect key="futon" x={cx - 40} y={cy - 40} width={80} height={80} rx={14} fill={s.main} />,
      <rect key="top" x={cx - 28} y={cy - 28} width={56} height={56} rx={3} fill="#a1887f" stroke="#5d4037" strokeWidth={2} />,
      <circle key="m1" cx={cx - 8} cy={cy - 4} r={7} fill="#ff9800" />,
      <circle key="m2" cx={cx + 8} cy={cy + 2} r={7} fill="#fb8c00" />,
      <circle key="m3" cx={cx} cy={cy + 12} r={7} fill="#ffa726" />,
    )
  } else {
    items.push(
      zabuton(cx - 46, cy, 'z1'), zabuton(cx + 46, cy, 'z2'),
      <circle key="table" cx={cx} cy={cy} r={28} fill={s.main} stroke="#00000033" strokeWidth={3} />,
      <circle key="tea1" cx={cx - 8} cy={cy - 6} r={6} fill="#ffffff" />,
      <circle key="tea2" cx={cx + 9} cy={cy + 6} r={6} fill="#ffffff" />,
    )
  }
  return <g>{items}</g>
}

function Entrance({ b, s }: { b: Box; s: RoomStyle }) {
  const step = b.y + b.h * .45
  return (
    <g>
      <rect x={b.x} y={b.y} width={b.w} height={step - b.y} fill="#e9d2ad" />
      <line x1={b.x} y1={step} x2={b.x + b.w} y2={step} stroke="#8d6e63" strokeWidth={5} />
      <rect x={b.x + 4} y={b.y + 4} width={Math.min(60, b.w * .45)} height={18} rx={3} fill={s.main} />
      <ellipse cx={b.x + b.w * .42} cy={step + 18} rx={6} ry={10} fill={s.accent} />
      <ellipse cx={b.x + b.w * .42 + 15} cy={step + 18} rx={6} ry={10} fill={s.accent} />
      <path d={`M${b.x + b.w - 8} ${b.y + b.h - 4} A ${Math.min(b.w, b.h) * .5} ${Math.min(b.w, b.h) * .5} 0 0 0 ${b.x + b.w - 8 - Math.min(b.w, b.h) * .5} ${b.y + b.h - 4 - Math.min(b.w, b.h) * .5}`} fill="none" stroke="#8d6e63" strokeWidth={2.5} strokeDasharray="6 5" />
      <circle cx={b.x + 14} cy={b.y + b.h - 16} r={8} fill="#90caf9" stroke="#1e88e5" strokeWidth={2} />
    </g>
  )
}

function Stairs({ b, s }: { b: Box; s: RoomStyle }) {
  if (s.variant === 'spiral') {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = Math.min(b.w, b.h) / 2 - 8
    return (
      <g>
        <circle cx={cx} cy={cy} r={r} fill={s.main} stroke={s.accent} strokeWidth={3} />
        {Array.from({ length: 10 }, (_, i) => {
          const a = (i / 10) * Math.PI * 2
          return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r} y2={cy + Math.sin(a) * r} stroke={s.accent} strokeWidth={2.5} />
        })}
        <circle cx={cx} cy={cy} r={8} fill={s.accent} />
        <path d={`M${cx + r * .6} ${cy} A ${r * .6} ${r * .6} 0 1 1 ${cx} ${cy - r * .6}`} fill="none" stroke="#e53935" strokeWidth={4} markerEnd="" />
        <path d={`M${cx - 7} ${cy - r * .6 - 7} l 9 7 l -9 7z`} fill="#e53935" />
      </g>
    )
  }
  const tall = b.h >= b.w
  const length = tall ? b.h : b.w
  const steps = Math.max(4, Math.floor(length / 22))
  const lines: ReactNode[] = []
  for (let i = 1; i < steps; i++) {
    const p = (i / steps) * length
    lines.push(tall
      ? <line key={i} x1={b.x + 6} y1={b.y + p} x2={b.x + b.w - 6} y2={b.y + p} stroke={s.accent} strokeWidth={3} />
      : <line key={i} x1={b.x + p} y1={b.y + 6} x2={b.x + p} y2={b.y + b.h - 6} stroke={s.accent} strokeWidth={3} />)
  }
  const ax = b.x + b.w / 2, ay = b.y + b.h / 2
  return (
    <g>
      <rect x={b.x + 6} y={b.y + 6} width={b.w - 12} height={b.h - 12} rx={3} fill={s.main} />
      {lines}
      {tall ? (
        <g>
          <line x1={ax} y1={b.y + b.h - 16} x2={ax} y2={b.y + 22} stroke="#e53935" strokeWidth={4} />
          <path d={`M${ax - 9} ${b.y + 26} l 9 -12 l 9 12z`} fill="#e53935" />
        </g>
      ) : (
        <g>
          <line x1={b.x + 16} y1={ay} x2={b.x + b.w - 22} y2={ay} stroke="#e53935" strokeWidth={4} />
          <path d={`M${b.x + b.w - 26} ${ay - 9} l 12 9 l -12 9z`} fill="#e53935" />
        </g>
      )}
    </g>
  )
}

function Hall({ b, s }: { b: Box; s: RoomStyle }) {
  const tall = b.h >= b.w
  if (s.variant === 'runner') {
    return tall
      ? <rect x={b.x + b.w * .25} y={b.y + 8} width={b.w * .5} height={b.h - 16} rx={4} fill={s.accent} stroke="#ffd54f" strokeWidth={3} />
      : <rect x={b.x + 8} y={b.y + b.h * .25} width={b.w - 16} height={b.h * .5} rx={4} fill={s.accent} stroke="#ffd54f" strokeWidth={3} />
  }
  if (s.id === 'shiny') {
    return (
      <g stroke="#ffffff" strokeWidth={4} strokeLinecap="round" opacity={.9}>
        <line x1={b.x + 14} y1={b.y + 30} x2={b.x + 30} y2={b.y + 14} />
        <line x1={b.x + 14} y1={b.y + 46} x2={b.x + 44} y2={b.y + 16} />
      </g>
    )
  }
  return <Plant x={tall ? b.x + b.w / 2 : b.x + b.w - 20} y={tall ? b.y + b.h - 22 : b.y + b.h / 2 + 4} r={13} />
}

const FURNITURE: Record<RoomTypeId, (props: { b: Box; s: RoomStyle }) => ReactNode> = {
  living: Living, dining: Dining, kitchen: Kitchen, bath: Bath, toilet: Toilet, washroom: Washroom,
  bedroom: Bedroom, kids: Kids, washitsu: Washitsu, entrance: Entrance, stairs: Stairs, hall: Hall,
  library: (p) => <HobbyRoomArt {...p} type="library" />,
  music: (p) => <HobbyRoomArt {...p} type="music" />,
  art: (p) => <HobbyRoomArt {...p} type="art" />,
  playroom: (p) => <HobbyRoomArt {...p} type="playroom" />,
  pet: (p) => <HobbyRoomArt {...p} type="pet" />,
  laundry: (p) => <HobbyRoomArt {...p} type="laundry" />,
  closet: (p) => <HobbyRoomArt {...p} type="closet" />,
  plants: (p) => <HobbyRoomArt {...p} type="plants" />,
}

type RoomArtProps = {
  type: RoomTypeId
  style: string
  /** へやの ひだりうえ と おおきさ（マス）。 */
  x: number
  y: number
  w: number
  h: number
  label?: boolean
}

/** へや ひとつぶんの え（ゆか・かぐ・かべ・なまえ）。 */
export function RoomArt({ type, style, x, y, w, h, label = true }: RoomArtProps) {
  const s = findRoomStyle(type, style)
  const outer: Box = { x: x * CELL, y: y * CELL, w: w * CELL, h: h * CELL }
  const room = inset(outer, 3)
  const Furniture = FURNITURE[type]
  const name = findRoomType(type).short
  const fontSize = Math.min(24, (outer.w - 16) / name.length)
  return (
    <g>
      <Floor b={room} s={s} />
      <Furniture b={inset(room, 4)} s={s} />
      <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="none" stroke={WALL} strokeWidth={6} />
      {label && (
        <g>
          <rect x={outer.x + 8} y={outer.y + outer.h - fontSize - 16} width={fontSize * name.length + 10} height={fontSize + 8} rx={(fontSize + 8) / 2} fill="#ffffffe6" stroke={WALL} strokeWidth={1.5} />
          <text x={outer.x + 13} y={outer.y + outer.h - 15} fontSize={fontSize} fontWeight={800} fill={WALL}>{name}</text>
        </g>
      )}
    </g>
  )
}

/** えらぶ ボタンに のせる ちいさな みほん。 */
export function RoomSwatch({ type, style, w = 2, h = 2 }: { type: RoomTypeId; style: string; w?: number; h?: number }) {
  return (
    <svg viewBox={`0 0 ${w * CELL} ${h * CELL}`} aria-hidden="true" focusable="false">
      <RoomArt type={type} style={style} x={0} y={0} w={w} h={h} label={false} />
    </svg>
  )
}
