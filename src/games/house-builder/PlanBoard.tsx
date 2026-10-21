import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { findRoomStyle, findShape, type RoomTypeId } from './data'
import { fits, roomSize, roomsOn, type Cell, type HouseDesign, type PlacedRoom } from './plan'
import { CELL, RoomArt } from './RoomArt'
import styles from './HouseBuilderPlay.module.css'

// まどりずの ばん。え（svg）の うえに おなじ マスめの ボタンを かさねて、タップと キーボードで うごかせる。
// onMove を わたすと、おいた へやを ひっぱって うごかせる。

export type Ghost = { x: number; y: number; w: number; h: number; type: RoomTypeId; style: string }

type Props = {
  design: HouseDesign
  floor: number
  label: string
  selectedId?: number | null
  /** さっき おいた へや（ぽんっと でてくる）。 */
  popId?: number | null
  ghost?: Ghost | null
  onCell?: (cell: Cell) => void
  onRoom?: (room: PlacedRoom) => void
  onHover?: (cell: Cell | null) => void
  /** へやを ひっぱって はなした とき。to は うごかした さきの ひだりうえの マス（はいるか どうかは よびだしがわで みる）。 */
  onMove?: (room: PlacedRoom, to: Cell) => void
  roomLabel?: (room: PlacedRoom) => string
}

/** ひっぱっている へや。grab は へやの なかで つかんだ マス。 */
type Drag = { id: number; pointerId: number; grab: Cell; to: Cell; moved: boolean }

const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }

/** にわの マスに ちいさな くさと はなを かく。 */
function GardenCell({ x, y }: { x: number; y: number }) {
  const px = x * CELL, py = y * CELL
  return (
    <g>
      <rect x={px} y={py} width={CELL} height={CELL} fill="#a5d98a" />
      <path d={`M${px + 22} ${py + 70} l 6 -14 l 6 14 M${px + 64} ${py + 40} l 5 -12 l 5 12`} stroke="#6aa84f" strokeWidth={4} fill="none" strokeLinecap="round" />
      {(x + y) % 3 === 0 && <circle cx={px + 70} cy={py + 74} r={7} fill="#ffffff" stroke="#ffd54f" strokeWidth={4} />}
    </g>
  )
}

export default function PlanBoard({ design, floor, label, selectedId = null, popId = null, ghost = null, onCell, onRoom, onHover, onMove, roomLabel }: Props) {
  const shape = findShape(design.shape)
  const rooms = roomsOn(design, floor)
  const boardRef = useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = useState<Cell | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  // ひっぱった あとの click で へやを えらばない ように する。
  const dragged = useRef(false)
  const readOnly = !onCell

  const covering = (x: number, y: number) => rooms.find((r) => {
    const { w, h } = roomSize(r)
    return x >= r.x && x < r.x + w && y >= r.y && y < r.y + h
  })
  const isTarget = (x: number, y: number) => shape.mask[y]?.[x] === true && (!readOnly || covering(x, y) !== undefined)

  // キーボードで うごかす ときの いま いる マス（はじめは ひだりうえの ゆか）。
  const first = (() => {
    for (let y = 0; y < shape.height; y++) for (let x = 0; x < shape.width; x++) if (isTarget(x, y)) return { x, y }
    return null
  })()
  const active = cursor && isTarget(cursor.x, cursor.y) ? cursor : first
  const activeRoom = active ? covering(active.x, active.y) : undefined

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    const step = ARROWS[event.key]
    if (!step || !active) return
    event.preventDefault()
    let { x, y } = active
    const from = covering(x, y)
    for (;;) {
      x += step[0]
      y += step[1]
      if (x < 0 || y < 0 || x >= shape.width || y >= shape.height) return
      if (!isTarget(x, y)) continue
      const room = covering(x, y)
      if (room && room === from) continue
      break
    }
    setCursor({ x, y })
    const room = covering(x, y)
    const selector = room ? `[data-room="${room.id}"]` : `[data-cell="${x},${y}"]`
    boardRef.current?.querySelector<HTMLButtonElement>(selector)?.focus()
  }

  /** ゆびの いちに ある マス（ばんの そとでも はしの マスに よせない）。 */
  function cellAt(event: PointerEvent): Cell | null {
    const rect = boardRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0 || rect.height <= 0) return null
    return {
      x: Math.floor(((event.clientX - rect.left) / rect.width) * shape.width),
      y: Math.floor(((event.clientY - rect.top) / rect.height) * shape.height),
    }
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, room: PlacedRoom) {
    dragged.current = false
    if (!onMove || !event.isPrimary || event.button !== 0) return
    const at = cellAt(event)
    if (!at) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDrag({ id: room.id, pointerId: event.pointerId, grab: { x: at.x - room.x, y: at.y - room.y }, to: { x: room.x, y: room.y }, moved: false })
  }

  function moveDrag(event: PointerEvent, room: PlacedRoom) {
    if (!drag || drag.id !== room.id || drag.pointerId !== event.pointerId) return
    const at = cellAt(event)
    if (!at) return
    const { w, h } = roomSize(room)
    const to = {
      x: Math.max(0, Math.min(shape.width - w, at.x - drag.grab.x)),
      y: Math.max(0, Math.min(shape.height - h, at.y - drag.grab.y)),
    }
    if (to.x === drag.to.x && to.y === drag.to.y) return
    setDrag({ ...drag, to, moved: true })
  }

  function endDrag(event: PointerEvent, room: PlacedRoom) {
    if (!drag || drag.id !== room.id || drag.pointerId !== event.pointerId) return
    setDrag(null)
    if (!drag.moved) return
    dragged.current = true
    if (drag.to.x !== room.x || drag.to.y !== room.y) {
      setCursor(drag.to)
      onMove?.(room, drag.to)
    }
  }

  const buttons: ReactNode[] = []
  for (const room of rooms) {
    const { w, h } = roomSize(room)
    const isActive = activeRoom === room
    buttons.push(
      <button
        key={`r${room.id}`}
        type="button"
        className={styles.roomHit}
        style={{ gridColumn: `${room.x + 1} / span ${w}`, gridRow: `${room.y + 1} / span ${h}` }}
        data-room={room.id}
        data-selected={room.id === selectedId || undefined}
        data-draggable={onMove ? true : undefined}
        aria-label={roomLabel ? roomLabel(room) : `おいた ${findRoomStyle(room.type, room.style).name}`}
        aria-pressed={readOnly ? undefined : room.id === selectedId}
        tabIndex={isActive ? 0 : -1}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false
            return
          }
          setCursor({ x: room.x, y: room.y })
          onRoom?.(room)
        }}
        onPointerEnter={() => onHover?.(null)}
        onPointerDown={(event) => startDrag(event, room)}
        onPointerMove={(event) => moveDrag(event, room)}
        onPointerUp={(event) => endDrag(event, room)}
        onPointerCancel={() => setDrag(null)}
      />,
    )
  }
  if (!readOnly) {
    for (let y = 0; y < shape.height; y++) {
      for (let x = 0; x < shape.width; x++) {
        if (!shape.mask[y][x] || covering(x, y)) continue
        const isActive = active?.x === x && active.y === y
        buttons.push(
          <button
            key={`c${x}-${y}`}
            type="button"
            className={styles.cellHit}
            style={{ gridColumn: x + 1, gridRow: y + 1 }}
            data-cell={`${x},${y}`}
            aria-label={`よこ ${x + 1}・たて ${y + 1} に おく`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              setCursor({ x, y })
              onCell?.({ x, y })
            }}
            onPointerEnter={() => onHover?.({ x, y })}
            onFocus={() => onHover?.({ x, y })}
          />,
        )
      }
    }
  }

  // そとがわの かべ（ゆかと にわの さかいめ）。
  const walls: string[] = []
  for (let y = 0; y < shape.height; y++) {
    for (let x = 0; x < shape.width; x++) {
      if (!shape.mask[y][x]) continue
      const px = x * CELL, py = y * CELL
      if (!shape.mask[y - 1]?.[x]) walls.push(`M${px} ${py}h${CELL}`)
      if (!shape.mask[y + 1]?.[x]) walls.push(`M${px} ${py + CELL}h${CELL}`)
      if (!shape.mask[y][x - 1]) walls.push(`M${px} ${py}v${CELL}`)
      if (!shape.mask[y][x + 1]) walls.push(`M${px + CELL} ${py}v${CELL}`)
    }
  }

  const selected = rooms.find((r) => r.id === selectedId)
  const dragRoom = drag?.moved ? rooms.find((r) => r.id === drag.id) : undefined
  const dragOk = dragRoom && drag ? fits(design, { ...dragRoom, ...drag.to }) : false
  const boardStyle = {
    aspectRatio: `${shape.width} / ${shape.height}`,
    gridTemplateColumns: `repeat(${shape.width}, 1fr)`,
    gridTemplateRows: `repeat(${shape.height}, 1fr)`,
    '--aspect': shape.width / shape.height,
  } as CSSProperties

  return (
    <div className={styles.board} style={boardStyle} ref={boardRef} role="group" aria-label={label} data-dragging={dragRoom ? true : undefined} onKeyDown={handleKey} onPointerLeave={() => onHover?.(null)}>
      <svg className={styles.boardArt} viewBox={`0 0 ${shape.width * CELL} ${shape.height * CELL}`} aria-hidden="true" focusable="false">
        {shape.mask.map((row, y) => row.map((on, x) => (on
          ? <rect key={`${x}-${y}`} x={x * CELL} y={y * CELL} width={CELL} height={CELL} fill="#f7fbff" stroke="#c9dcf0" strokeWidth={2} strokeDasharray="6 6" />
          : <GardenCell key={`${x}-${y}`} x={x} y={y} />)))}
        {rooms.map((room) => {
          const { w, h } = roomSize(room)
          return (
            <g key={room.id} className={room.id === popId ? styles.pop : undefined} opacity={room === dragRoom ? .35 : undefined} style={{ transformOrigin: `${(room.x + w / 2) * CELL}px ${(room.y + h / 2) * CELL}px` }}>
              <RoomArt type={room.type} style={room.style} x={room.x} y={room.y} w={w} h={h} />
            </g>
          )
        })}
        {ghost && (
          <g opacity={.55} className={styles.ghost}>
            <RoomArt type={ghost.type} style={ghost.style} x={ghost.x} y={ghost.y} w={ghost.w} h={ghost.h} label={false} />
          </g>
        )}
        {dragRoom && drag && (() => {
          const { w, h } = roomSize(dragRoom)
          return (
            <g className={styles.dragGhost} data-ok={dragOk || undefined}>
              <RoomArt type={dragRoom.type} style={dragRoom.style} x={drag.to.x} y={drag.to.y} w={w} h={h} label={false} />
              {!dragOk && (
                <g stroke="#e53935" strokeWidth={10} strokeLinecap="round" fill="none">
                  <rect x={drag.to.x * CELL + 6} y={drag.to.y * CELL + 6} width={w * CELL - 12} height={h * CELL - 12} rx={10} fill="#e5393533" />
                  <path d={`M${(drag.to.x + w / 2) * CELL - 24} ${(drag.to.y + h / 2) * CELL - 24}l48 48m0 -48l-48 48`} />
                </g>
              )}
            </g>
          )
        })()}
        <path d={walls.join('')} stroke="#4a3b30" strokeWidth={12} strokeLinecap="square" fill="none" />
        {selected && (() => {
          const { w, h } = roomSize(selected)
          return <rect className={styles.selectedRing} x={selected.x * CELL + 6} y={selected.y * CELL + 6} width={w * CELL - 12} height={h * CELL - 12} rx={10} fill="none" stroke="#ff8a3d" strokeWidth={10} />
        })()}
      </svg>
      {buttons}
    </div>
  )
}
