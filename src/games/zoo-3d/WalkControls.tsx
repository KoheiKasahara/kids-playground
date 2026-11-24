// 歩くモードの操作: 押しているあいだ歩く・向きを変えるボタンと、エリアの小さな地図。
// 地図の展示場をタップすると、その前まで自動で歩く（字が読めなくても、絵文字で行き先を選べる）。

import { forwardRef, useImperativeHandle, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { SPECIES } from './species'
import type { WalkInput } from './walk'
import { pathSegments, type Area } from './zooMap'
import styles from './Zoo3dPlay.module.css'

type Dir = 'forward' | 'back' | 'left' | 'right'

const PAD: { dir: Dir; label: string; emoji: string; area: string }[] = [
  { dir: 'forward', label: 'まえへ あるく', emoji: '⬆️', area: 'up' },
  { dir: 'left', label: 'ひだりを むく', emoji: '↩️', area: 'left' },
  { dir: 'right', label: 'みぎを むく', emoji: '↪️', area: 'right' },
  { dir: 'back', label: 'うしろへ さがる', emoji: '⬇️', area: 'down' },
]

function toInput(pressed: ReadonlySet<Dir>): WalkInput {
  return {
    forward: (pressed.has('forward') ? 1 : 0) - (pressed.has('back') ? 1 : 0),
    turn: (pressed.has('left') ? 1 : 0) - (pressed.has('right') ? 1 : 0),
  }
}

/** 押しているあいだだけ歩く十字ボタン（キーボードでも、Enter・スペースを押しているあいだ歩く）。 */
export function WalkPad({ disabled, onInput }: { disabled: boolean; onInput: (input: WalkInput) => void }) {
  const pressed = useRef(new Set<Dir>())
  const [shown, setShown] = useState<ReadonlySet<Dir>>(() => new Set())
  const set = (dir: Dir, on: boolean) => {
    const had = pressed.current.has(dir)
    if (on === had) return
    if (on) pressed.current.add(dir)
    else pressed.current.delete(dir)
    setShown(new Set(pressed.current))
    onInput(toInput(pressed.current))
  }
  const down = (dir: Dir) => (e: PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    set(dir, true)
  }
  const up = (dir: Dir) => () => set(dir, false)
  const key = (dir: Dir, on: boolean) => (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    set(dir, on)
  }
  return (
    <div className={styles.pad} role="group" aria-label="あるく ボタン">
      {PAD.map(p => (
        <button type="button" key={p.dir} className={styles.padButton} style={{ gridArea: p.area }} disabled={disabled}
          aria-label={p.label} aria-pressed={shown.has(p.dir)}
          onPointerDown={down(p.dir)} onPointerUp={up(p.dir)} onPointerCancel={up(p.dir)} onLostPointerCapture={up(p.dir)}
          onKeyDown={key(p.dir, true)} onKeyUp={key(p.dir, false)} onBlur={up(p.dir)}
          onContextMenu={e => e.preventDefault()}>
          <span aria-hidden="true">{p.emoji}</span>
        </button>
      ))}
    </div>
  )
}

export type MiniMapHandle = { update: (x: number, z: number, yaw: number) => void }

/** エリアの小さな地図。人の位置と向き（三角）を、まわりの描き直しなしで動かす。 */
export const MiniMap = forwardRef<MiniMapHandle, { area: Area; onPick: (enclosure: string) => void }>(function MiniMap({ area, onPick }, ref) {
  const marker = useRef<SVGGElement | null>(null)
  useImperativeHandle(ref, () => ({
    update(x, z, yaw) {
      // 地図は上が奥（-z）。人の向き yaw は +z が 0 なので、SVG の回転は 180 - yaw（度）
      marker.current?.setAttribute('transform', `translate(${x.toFixed(2)} ${z.toFixed(2)}) rotate(${(180 - (yaw * 180) / Math.PI).toFixed(1)})`)
    },
  }), [])
  const R = area.radius + 1
  return (
    <svg className={styles.miniMap} viewBox={`${-R} ${-R} ${R * 2} ${R * 2}`} role="group" aria-label={`${area.name}の ちず`}>
      <circle cx={0} cy={0} r={area.radius} fill={area.grass} stroke="#fff" strokeWidth={0.8} />
      <circle cx={0} cy={0} r={area.ring} fill="none" stroke="#f3e2b3" strokeWidth={2.4} />
      {pathSegments(area).map(([a, b], i) => <line key={i} x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke="#f3e2b3" strokeWidth={2.4} />)}
      {area.exits.map(x => <text key={x.to} x={x.at.x} y={x.at.z + (x.heading === 0 ? -1 : 2.5)} fontSize={4} textAnchor="middle" aria-hidden="true">🚪</text>)}
      {area.enclosures.map(e => {
        const emojis = e.species.map(id => SPECIES[id].emoji)
        return (
          <g key={e.id} role="button" tabIndex={0} aria-label={`${e.species.map(id => SPECIES[id].name).join('と')}の ところへ いく`}
            className={styles.miniEnclosure} onClick={() => onPick(e.id)}
            onKeyDown={ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPick(e.id) } }}>
            <circle cx={e.center.x} cy={e.center.z} r={e.radius} fill={e.ground} stroke={e.fence} strokeWidth={0.9} />
            {emojis.map((em, i) => (
              <text key={i} x={e.center.x + (i - (emojis.length - 1) / 2) * Math.min(5.4, e.radius * 0.9)} y={e.center.z + 2.2}
                fontSize={Math.min(7, e.radius * 1.15)} textAnchor="middle" aria-hidden="true">{em}</text>
            ))}
          </g>
        )
      })}
      <g ref={marker} aria-hidden="true">
        <circle r={2.4} fill="#ff6b4a" stroke="#fff" strokeWidth={0.8} />
        <path d="M 0 -4.6 L 2.2 -1.2 L -2.2 -1.2 Z" fill="#ff6b4a" stroke="#fff" strokeWidth={0.5} />
      </g>
    </svg>
  )
})
