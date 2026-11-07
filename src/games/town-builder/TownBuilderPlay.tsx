import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { useGameInterval } from '../../utils/useGameInterval'
import { vibrate } from '../../utils/haptics'
import { TileArt, ToolIcon, VehicleArt, type TileArtProps } from './PartArt'
import { CATEGORIES, ERASE_LABEL, findPart, isBuilding, partLabel, partsInCategory, type CategoryId, type ToolId } from './parts'
import {
  applyTool, COLS, colOf, createEmptyTown, createTown, decodeTown, encodeTown, isConnected, populationOf,
  railMask, rankOf, RANKS, roadMask, ROWS, rowOf, SAVE_KEY, wantsRoad, waterMask, type Town,
} from './town'
import { isOnTrack, stepVehicles, syncVehicles, vehiclePose } from './vehicles'
import { playTownSound, type TownSound } from './sounds'
import { comfortableZoom, tileSizeFor, ZOOM_LEVELS } from './zoom'
import styles from './TownBuilderPlay.module.css'

const HISTORY_LIMIT = 50
const START_CURSOR = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2)

function readSavedTown(): Town | null {
  try { return decodeTown(localStorage.getItem(SAVE_KEY)) } catch { return null }
}

function saveTown(town: Town): boolean {
  try { localStorage.setItem(SAVE_KEY, encodeTown(town)); return true } catch { return false }
}

function soundFor(tool: ToolId): TownSound {
  if (tool === 'erase') return 'erase'
  if (tool === 'water') return 'water'
  if (tool === 'road' || tool === 'rail') return 'road'
  return 'build'
}

function tileLabel(town: Town, index: number): string {
  const tile = town[index]
  const place = `${colOf(index) + 1}-${rowOf(index) + 1}`
  let name = tile.ground === 'water' ? 'かわ' : 'くさはら'
  if (tile.part) name = tile.ground === 'water' ? `${partLabel(tile.part)}の はし` : partLabel(tile.part)
  return `${place} ${name}${wantsRoad(town, index) ? '・みちが ほしい' : ''}`
}

type TileView = Omit<TileArtProps, 'pop' | 'dust'> & { label: string }

function describeTiles(town: Town): TileView[] {
  return town.map((tile, index) => {
    const part = tile.part
    const needsRoad = isBuilding(part) && Boolean(findPart(part)?.needsRoad)
    return {
      ground: tile.ground,
      part,
      roadMask: part === 'road' || part === 'crossing' ? roadMask(town, index) : 0,
      railMask: part === 'rail' || part === 'crossing' ? railMask(town, index) : 0,
      waterMask: tile.ground === 'water' ? waterMask(town, index) : 0,
      checker: (colOf(index) + rowOf(index)) % 2 === 0,
      lit: !needsRoad || isConnected(town, index),
      wantsRoad: wantsRoad(town, index),
      label: tileLabel(town, index),
    }
  })
}

/** TileView は かずと もじだけ なので、ちがう ものが ある マスだけ かきなおす。 */
function sameView(previous: TileView, next: TileView): boolean {
  return (Object.keys(next) as (keyof TileView)[]).every((key) => previous[key] === next[key])
}

const TileButton = memo(function TileButton({ index, tabbable, view, pop, dust }: { index: number; tabbable: boolean; view: TileView; pop: number; dust: boolean }) {
  const { label, ...art } = view
  return <button type="button" className={styles.tile} data-index={index} aria-label={label} tabIndex={tabbable ? 0 : -1}>
    <TileArt {...art} pop={pop} dust={dust} />
  </button>
}, (previous, next) => previous.index === next.index && previous.tabbable === next.tabbable && previous.pop === next.pop
  && previous.dust === next.dust && sameView(previous.view, next.view))

function Vehicles({ town }: { town: Town }) {
  const [vehicles, setVehicles] = useState(() => syncVehicles(town, [], Math.random))
  useGameInterval(() => setVehicles((current) => stepVehicles(town, current, Math.random)), 1000)
  return <div className={styles.vehicles} aria-hidden="true">
    {vehicles.filter((vehicle) => isOnTrack(town, vehicle)).map((vehicle) => {
      const pose = vehiclePose(vehicle)
      return <div key={vehicle.id} className={styles.vehicle} data-kind={vehicle.kind} style={{ '--x': pose.x, '--y': pose.y } as CSSProperties}>
        <div className={styles.vehicleBody} style={{ transform: `rotate(${pose.angle}deg)` }}>
          <VehicleArt kind={vehicle.kind} variant={vehicle.variant} />
        </div>
      </div>
    })}
  </div>
}

/** ちずの みえる おおきさ。ResizeObserver が ない ときは さいしょの あたいの まま。 */
function useViewportSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 360, height: 520 })
  useEffect(() => {
    const node = ref.current
    if (!node || typeof ResizeObserver !== 'function') return
    const observer = new ResizeObserver(() => {
      const width = node.clientWidth
      const height = node.clientHeight
      if (width && height) setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height })
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])
  return size
}

type Effect = { index: number; stamp: number; dust: boolean }

export default function TownBuilderPlay() {
  const [town, setTown] = useState<Town>(() => readSavedTown() ?? createTown())
  const [history, setHistory] = useState<Town[]>([])
  const [category, setCategory] = useState<CategoryId>('home')
  const [tool, setTool] = useState<ToolId>('house')
  /** null の あいだは がめんに あわせた ズーム。＋・− を おすと きまる。 */
  const [chosenZoom, setChosenZoom] = useState<number | null>(null)
  const [night, setNight] = useState(false)
  const [cursor, setCursor] = useState(START_CURSOR)
  const [effect, setEffect] = useState<Effect | null>(null)
  const [bestRank, setBestRank] = useState(() => rankOf(populationOf(town)))
  const [celebration, setCelebration] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const [started, setStarted] = useState(false)
  const [sound, toggleSound] = useSoundToggle()
  useGameIntroPlaying(started)

  const viewportRef = useRef<HTMLDivElement>(null)
  const size = useViewportSize(viewportRef)
  const zoom = chosenZoom ?? comfortableZoom(size.width, size.height)
  const tile = tileSizeFor(size.width, size.height, zoom)
  const center = useRef({ x: 0.5, y: 0.5 })
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const firstChoice = useRef<HTMLButtonElement>(null)

  const views = useMemo(() => describeTiles(town), [town])
  const population = useMemo(() => populationOf(town), [town])
  const rank = rankOf(population)

  // ズームや がめんの おおきさが かわっても、みて いた ばしょを まんなかに たもつ。
  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollLeft = center.current.x * viewport.scrollWidth - viewport.clientWidth / 2
    viewport.scrollTop = center.current.y * viewport.scrollHeight - viewport.clientHeight / 2
  }, [tile])

  useEffect(() => {
    if (celebration === null) return
    const timer = setTimeout(() => setCelebration(null), 2600)
    return () => clearTimeout(timer)
  }, [celebration])

  useEffect(() => { if (confirming) firstChoice.current?.focus() }, [confirming])

  function commit(next: Town) {
    setHistory((previous) => [...previous.slice(1 - HISTORY_LIMIT), town])
    setTown(next)
    setSaveFailed(!saveTown(next))
    setStarted(true)
  }

  function place(index: number) {
    setCursor(index)
    const next = applyTool(town, index, tool)
    if (next === town) return
    primeAudio()
    commit(next)
    setEffect((previous) => ({ index, stamp: (previous?.stamp ?? 0) + 1, dust: tool === 'erase' }))
    const nextRank = rankOf(populationOf(next))
    if (nextRank > bestRank) {
      setBestRank(nextRank)
      setCelebration(nextRank)
      playTownSound('grow')
      vibrate('celebrate')
    } else {
      playTownSound(soundFor(tool))
      vibrate('tap')
    }
  }

  function undo() {
    const previous = history.at(-1)
    if (!previous) return
    primeAudio()
    setHistory(history.slice(0, -1))
    setTown(previous)
    setSaveFailed(!saveTown(previous))
    setEffect(null)
    playTownSound('undo')
  }

  function chooseTool(next: ToolId) {
    primeAudio()
    setTool(next)
    setStarted(true)
    playTownSound('select')
  }

  function chooseCategory(next: CategoryId) {
    setCategory(next)
    const parts = partsInCategory(next)
    chooseTool(parts.some((part) => part.id === tool) ? tool : parts[0].id)
  }

  function changeZoom(step: number) {
    const next = Math.max(0, Math.min(ZOOM_LEVELS - 1, zoom + step))
    if (next === zoom) return
    primeAudio()
    setChosenZoom(next)
    setStarted(true)
    playTownSound('select')
  }

  function toggleNight() {
    primeAudio()
    setNight((value) => !value)
    setStarted(true)
    playTownSound('select')
  }

  function resetTown(kind: 'empty' | 'starter') {
    setConfirming(false)
    commit(kind === 'empty' ? createEmptyTown() : createTown())
    setEffect(null)
    playTownSound('erase')
    vibrate('tap')
  }

  function onMapClick(event: MouseEvent<HTMLDivElement>) {
    if (suppressClick.current) { suppressClick.current = false; return }
    const target = (event.target as Element).closest<HTMLElement>('[data-index]')
    if (target) place(Number(target.dataset.index))
  }

  function onMapKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    const col = Math.max(0, Math.min(COLS - 1, colOf(cursor) + move[0]))
    const row = Math.max(0, Math.min(ROWS - 1, rowOf(cursor) + move[1]))
    const next = row * COLS + col
    setCursor(next)
    event.currentTarget.querySelector<HTMLElement>(`[data-index="${next}"]`)?.focus()
  }

  // マウスでは ドラッグで ちずを うごかす（タッチは ブラウザの スクロールに まかせる）。
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return
    drag.current = { x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop, moved: false }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.moved && Math.hypot(dx, dy) < 8) return
    current.moved = true
    event.currentTarget.scrollLeft = current.left - dx
    event.currentTarget.scrollTop = current.top - dy
  }

  function onPointerEnd() {
    suppressClick.current = Boolean(drag.current?.moved)
    drag.current = null
  }

  function onScroll() {
    const viewport = viewportRef.current
    if (!viewport || !viewport.scrollWidth || !viewport.scrollHeight) return
    center.current = {
      x: (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth,
      y: (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight,
    }
  }

  const rankInfo = RANKS[rank]
  const toolLabel = tool === 'erase' ? ERASE_LABEL : findPart(tool)?.label ?? ''

  return <GamePlaySurface>
    <div className={styles.screen} data-night={night}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>まちづくり</h1>
        <span className={styles.stats} role="img" aria-label={`${rankInfo.label}・${population}にん`}>
          <span className={styles.rankIcon}>{rankInfo.icon}</span>
          <span>👤{population}</span>
        </span>
        <button type="button" className={styles.iconButton} onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
          <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        </button>
      </header>

      <div className={styles.mapArea}>
        <div
          className={styles.viewport}
          ref={viewportRef}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <div
            className={styles.map}
            style={{ '--tile': `${tile}px` } as CSSProperties}
            role="group"
            aria-label={`まちの ちず。${toolLabel}を おく ばしょを えらんでね`}
            onClick={onMapClick}
            onKeyDown={onMapKeyDown}
          >
            {views.map((view, index) => <TileButton
              key={index}
              index={index}
              view={view}
              tabbable={index === cursor}
              pop={effect?.index === index ? effect.stamp : 0}
              dust={effect?.index === index && effect.dust}
            />)}
            <Vehicles town={town} />
          </div>
        </div>

        <div className={`${styles.mapTools} ${styles.mapToolsLeft}`}>
          <button type="button" onClick={undo} disabled={!history.length} aria-label="ひとつ もどす"><span aria-hidden="true">↩</span></button>
          <button type="button" onClick={() => setConfirming(true)} aria-label="あたらしい まちに する"><span aria-hidden="true">🗑️</span></button>
        </div>
        <div className={styles.mapTools}>
          <button type="button" onClick={() => changeZoom(1)} disabled={zoom === ZOOM_LEVELS - 1} aria-label="おおきく みる"><span aria-hidden="true">＋</span></button>
          <button type="button" onClick={() => changeZoom(-1)} disabled={zoom === 0} aria-label="ちいさく みる"><span aria-hidden="true">－</span></button>
          <button type="button" onClick={toggleNight} aria-label={night ? 'ひるに する' : 'よるに する'} aria-pressed={night}><span aria-hidden="true">{night ? '☀️' : '🌙'}</span></button>
        </div>

        {saveFailed && <p className={styles.saveFailed} role="status">ほぞん できなかったよ</p>}

        {celebration !== null && <div className={styles.celebrate} role="status">
          <div className={styles.celebrateCard}>
            <span className={styles.celebrateIcon} aria-hidden="true">{RANKS[celebration].icon}</span>
            <span className={styles.celebrateText}>{RANKS[celebration].label}に なった！</span>
            <span className={styles.confetti} aria-hidden="true">🎉✨🎉</span>
          </div>
        </div>}

        {confirming && <div className={styles.dialogBackdrop}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="town-reset-title"
            onKeyDown={(event) => { if (event.key === 'Escape') setConfirming(false) }}>
            <p id="town-reset-title">あたらしく つくる？</p>
            <div className={styles.dialogChoices}>
              <button type="button" ref={firstChoice} onClick={() => resetTown('empty')}><span aria-hidden="true">🌱</span>まっさら</button>
              <button type="button" onClick={() => resetTown('starter')}><span aria-hidden="true">🏞️</span>はじめの まち</button>
              <button type="button" className={styles.cancel} onClick={() => setConfirming(false)}>やめる</button>
            </div>
          </div>
        </div>}
      </div>

      <nav className={styles.palette} aria-label="おく もの">
        <div className={styles.tabs} role="group" aria-label="しゅるい">
          {CATEGORIES.map((item) => <button key={item.id} type="button" className={styles.tab}
            aria-pressed={tool !== 'erase' && category === item.id} aria-label={item.label} title={item.label}
            onClick={() => chooseCategory(item.id)}>
            <ToolIcon tool={item.icon} />
          </button>)}
          <button type="button" className={`${styles.tab} ${styles.erase}`} aria-pressed={tool === 'erase'} aria-label={ERASE_LABEL} title={ERASE_LABEL}
            onClick={() => chooseTool('erase')}>
            <ToolIcon tool="erase" />
          </button>
        </div>
        <div className={styles.parts} role="group" aria-label={CATEGORIES.find((item) => item.id === category)?.label}>
          {partsInCategory(category).map((part) => <button key={part.id} type="button" className={styles.part}
            aria-pressed={tool === part.id} aria-label={part.label} title={part.label} onClick={() => chooseTool(part.id)}>
            <ToolIcon tool={part.id} />
          </button>)}
        </div>
      </nav>
    </div>
  </GamePlaySurface>
}
