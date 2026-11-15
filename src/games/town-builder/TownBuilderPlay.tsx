import { lazy, memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent, type RefObject } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { useGameInterval } from '../../utils/useGameInterval'
import { vibrate } from '../../utils/haptics'
import { SharedTileArt, TileArt, ToolIcon, TownPreview, VehicleArt } from './PartArt'
import {
  CATEGORIES, ERASE_LABEL, findPart, fitScale, isBuildingTool, isGroundTool, isLarge, partsInCategory, scaleLabel, SCALES, scalesOf, spanOf,
  type CategoryId, type Scale, type ToolId,
} from './parts'
import { createMapTown, findMap, MAPS, type MapId } from './maps'
import TownMap from './TownMap'
import { sharedArtKeys } from './sharedArt'
import { boardOf, type Board, type TileView } from './tileViews'
import { clearSlot, migrateLegacySave, readAllSlots, readSlot, writeSlot } from './saves'
import {
  applyTool, buildingCells, CENTER_INDEX, COLS, colOf, rankOf, RANKS, ROWS, rowOf,
  type Town,
} from './town'
import { isOnTrack, stepVehicles, syncVehicles, vehiclePose } from './vehicles'
import { playTownSound, type TownSound } from './sounds'
import { randomSeed } from './worlds'
import {
  centerOfTile, comfortableZoom, tileAtCenter, tileSizeFor, visibleRange, ZOOM_LEVELS, type TileRange, type ViewCenter,
} from './zoom'
import styles from './TownBuilderPlay.module.css'

// まちづくり。さいしょに ちずを えらぶ がめん、えらぶと まちを つくる がめんに なる。

// 3D は three.js を つかうので、「3Dで みる」を おした ときに はじめて よみこむ。
const Town3D = lazy(() => import('./Town3D'))

const HISTORY_LIMIT = 50
const START_CENTER = centerOfTile(CENTER_INDEX)

function soundFor(tool: ToolId): TownSound {
  if (tool === 'erase') return 'erase'
  if (isGroundTool(tool)) return 'water'
  if (tool === 'road' || tool === 'rail') return 'road'
  return 'build'
}

const TileButton = memo(function TileButton({ index, tabbable, view, pop, dust }: { index: number; tabbable: boolean; view: TileView; pop: number; dust: boolean }) {
  const { label, ...art } = view
  return <button type="button" className={styles.tile} data-index={index} aria-label={label} tabIndex={tabbable ? 0 : -1}
    style={{ gridColumn: colOf(index) + 1, gridRow: rowOf(index) + 1 }}>
    <TileArt {...art} pop={pop} dust={dust} shared />
  </button>
})

function inRange(range: TileRange, index: number): boolean {
  const col = colOf(index)
  const row = rowOf(index)
  return col >= range.col0 && col <= range.col1 && row >= range.row0 && row <= range.row1
}

function sameRange(a: TileRange, b: TileRange): boolean {
  return a.col0 === b.col0 && a.col1 === b.col1 && a.row0 === b.row0 && a.row1 === b.row1
}

/** ひろい ちずでも かるいよう、みえて いる マス（と カーソルの マス）だけを ならべる。 */
function visibleTiles(range: TileRange, cursor: number): number[] {
  const tiles: number[] = []
  for (let row = range.row0; row <= range.row1; row += 1) {
    for (let col = range.col0; col <= range.col1; col += 1) tiles.push(row * COLS + col)
  }
  if (!inRange(range, cursor)) tiles.push(cursor)
  return tiles
}

/** くるまと でんしゃ。1びょうに 1かい だけ すすめ、あいだの うごきは CSS に まかせる（まいコマ かきなおさない）。 */
const Vehicles = memo(function Vehicles({ town, tile, range }: { town: Town; tile: number; range: TileRange }) {
  const [vehicles, setVehicles] = useState(() => syncVehicles(town, [], Math.random))
  useGameInterval(() => setVehicles((current) => stepVehicles(town, current, Math.random)), 1000)
  return <div className={styles.vehicles} style={{ '--tile': `${tile}px` } as CSSProperties} aria-hidden="true">
    {vehicles.filter((vehicle) => isOnTrack(town, vehicle) && inRange(range, vehicle.index)).map((vehicle) => {
      const pose = vehiclePose(vehicle)
      return <div key={vehicle.id} className={styles.vehicle} data-kind={vehicle.kind} style={{ '--x': pose.x, '--y': pose.y } as CSSProperties}>
        <div className={styles.vehicleBody} style={{ transform: `rotate(${pose.angle}deg)` }}>
          <VehicleArt kind={vehicle.kind} variant={vehicle.variant} />
        </div>
      </div>
    })}
  </div>
})

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

/** おいた・けした ときの うごきを だす マス（おおきな たてものは ぜんぶの マス）。 */
type Effect = { cells: readonly number[]; stamp: number; dust: boolean }

function effectCells(before: Town, after: Town, index: number, tool: ToolId, scale: Scale): number[] {
  if (isLarge(tool, scale)) return buildingCells(after, index)
  if (tool === 'erase') return buildingCells(before, index)
  return [index]
}

/** おおきな たてものが いくつの マスを つかうか しめす ちいさな ます目。 */
function SizeBadge({ tool, scale }: { tool: ToolId; scale: Scale }) {
  const [cols, rows] = spanOf(tool, scale)
  if (cols * rows === 1) return null
  return <span className={styles.sizeBadge} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} data-cells={cols * rows} aria-hidden="true">
    {Array.from({ length: cols * rows }, (_, n) => <span key={n} />)}
  </span>
}

/** おおきさ ボタンの え（ちいさい 1つ・おおきい 2×2・とくだい 3×3 の ます目）。 */
function ScaleIcon({ scale }: { scale: Scale }) {
  return <span className={styles.scaleIcon} style={{ gridTemplateColumns: `repeat(${scale}, 1fr)` }} aria-hidden="true">
    {Array.from({ length: scale * scale }, (_, n) => <span key={n} />)}
  </span>
}

function SoundButton({ sound, onToggle }: { sound: boolean; onToggle: () => void }) {
  return <button type="button" className={styles.iconButton} onClick={onToggle} aria-label="おと" aria-pressed={sound}>
    <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
  </button>
}

// ---- ちずを えらぶ がめん ------------------------------------------------------

type MapSelectProps = { sound: boolean; onToggleSound: () => void; focusMap: MapId | null; onChoose: (id: MapId) => void }

function MapSelect({ sound, onToggleSound, focusMap, onChoose }: MapSelectProps) {
  // つづきが ある ちずは その まちを、ない ちずは さいしょの まちを みほんに する。
  const [cards] = useState(() => {
    const slots = readAllSlots()
    return MAPS.map((map) => ({ map, saved: slots[map.id] !== null, town: slots[map.id] ?? createMapTown(map.id) }))
  })
  const focusTarget = useRef<HTMLButtonElement>(null)

  // まちから もどったら、あそんで いた ちずの カードに フォーカスを もどす。
  useEffect(() => { if (focusMap) focusTarget.current?.focus() }, [focusMap])

  return <div className={styles.selectScreen}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1 className={styles.title}>まちづくり</h1>
      <SoundButton sound={sound} onToggle={onToggleSound} />
    </header>
    <h2 id="town-map-title" className={styles.selectTitle}>どの まちで あそぶ？</h2>
    <ul className={styles.mapCards} aria-labelledby="town-map-title">
      {cards.map(({ map, saved, town }) => <li key={map.id}>
        <button
          type="button"
          ref={map.id === focusMap ? focusTarget : undefined}
          className={styles.mapCard}
          data-saved={saved}
          aria-label={saved ? `${map.name}・つづきから` : map.name}
          onClick={() => onChoose(map.id)}
        >
          <span className={styles.mapPreview}><TownPreview town={town} /></span>
          <span className={styles.mapName}><span aria-hidden="true">{map.emoji} </span>{map.name}</span>
          <span className={styles.mapBadge} aria-hidden="true">{saved ? '▶ つづきから' : '✨ あたらしく'}</span>
        </button>
      </li>)}
    </ul>
  </div>
}

type PaletteProps = {
  category: CategoryId
  tool: ToolId
  chosenScale: Scale
  onCategory: (category: CategoryId) => void
  onTool: (tool: ToolId) => void
  onScale: (scale: Scale) => void
}

/** おく もの を えらぶ ところ。ちずを タップしても かわらないので かきなおさない。 */
const Palette = memo(function Palette({ category, tool, chosenScale, onCategory, onTool, onScale }: PaletteProps) {
  const scale = fitScale(tool, chosenScale)
  const toolScales = scalesOf(tool)
  return <nav className={styles.palette} aria-label="おく もの">
    <div className={styles.tabs} role="group" aria-label="しゅるい">
      {CATEGORIES.map((item) => <button key={item.id} type="button" className={styles.tab}
        aria-pressed={tool !== 'erase' && category === item.id} aria-label={item.label} title={item.label}
        onClick={() => onCategory(item.id)}>
        <ToolIcon tool={item.icon} />
      </button>)}
      <button type="button" className={`${styles.tab} ${styles.erase}`} aria-pressed={tool === 'erase'} aria-label={ERASE_LABEL} title={ERASE_LABEL}
        onClick={() => onTool('erase')}>
        <ToolIcon tool="erase" />
      </button>
    </div>
    <div className={styles.scales} role="group" aria-label="おおきさ">
      {SCALES.map((item) => <button key={item.scale} type="button" className={styles.scale}
        aria-pressed={isBuildingTool(tool) && scale === item.scale} disabled={!toolScales.includes(item.scale) || !isBuildingTool(tool)}
        onClick={() => onScale(item.scale)}>
        <ScaleIcon scale={item.scale} />
        <span>{item.label}</span>
      </button>)}
    </div>
    <div className={styles.parts} role="group" aria-label={CATEGORIES.find((item) => item.id === category)?.label}>
      {partsInCategory(category).map((part) => <button key={part.id} type="button" className={styles.part}
        aria-pressed={tool === part.id} aria-label={part.label} title={part.label} onClick={() => onTool(part.id)}>
        <ToolIcon tool={part.id} />
        <SizeBadge tool={part.id} scale={fitScale(part.id, chosenScale)} />
      </button>)}
    </div>
  </nav>
})

// ---- まちを つくる がめん --------------------------------------------------------

type TownEditorProps = { mapId: MapId; sound: boolean; onToggleSound: () => void; onBack: () => void }

function TownEditor({ mapId, sound, onToggleSound, onBack }: TownEditorProps) {
  const map = findMap(mapId)!
  const [board, setBoard] = useState<Board>(() => boardOf(readSlot(mapId) ?? createMapTown(mapId)))
  const { town, views, population } = board
  const [history, setHistory] = useState<Town[]>([])
  const [category, setCategory] = useState<CategoryId>('home')
  const [tool, setTool] = useState<ToolId>('house')
  /** えらんだ おおきさ。えらべない どうぐの ときは えらべる いちばん ちかい おおきさで おく。 */
  const [chosenScale, setChosenScale] = useState<Scale>(1)
  /** null の あいだは がめんに あわせた ズーム。＋・− を おすと きまる。 */
  const [chosenZoom, setChosenZoom] = useState<number | null>(null)
  const [night, setNight] = useState(false)
  const [cursor, setCursor] = useState(CENTER_INDEX)
  const [effect, setEffect] = useState<Effect | null>(null)
  const [bestRank, setBestRank] = useState(() => rankOf(board.population))
  const [celebration, setCelebration] = useState<number | null>(null)
  /** 「さいしょから」で つくる まち（せかいは きく たびに かたちが かわる）。null の あいだは きかない。 */
  const [restartTown, setRestartTown] = useState<Town | null>(null)
  const [mapOpen, setMapOpen] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  /** 3D で みて いる あいだ、2D で みて いた ばしょの マス。 */
  const [focus3d, setFocus3d] = useState<number | null>(null)
  const viewing3d = focus3d !== null
  const view3dButton = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  const viewportRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const size = useViewportSize(viewportRef)
  const zoom = chosenZoom ?? comfortableZoom(size.width, size.height)
  const tile = tileSizeFor(size.width, size.height, zoom)
  /** いま みて いる ばしょ。スクロールの たびに かわるので、えがきなおしには つかわない。 */
  const center = useRef<ViewCenter>(START_CENTER)
  /** えがく はんいを きめた ときの ばしょ。はんいが かわる ときだけ かえる。 */
  const [anchor, setAnchor] = useState<ViewCenter>(START_CENTER)
  const range = useMemo(() => visibleRange(anchor, size.width, size.height, tile), [anchor, size, tile])
  const shown = useMemo(() => visibleTiles(range, cursor), [range, cursor])
  const drag = useRef<{ x: number; y: number; left: number; top: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const focusCursor = useRef(false)
  const firstChoice = useRef<HTMLButtonElement>(null)
  const mapClose = useRef<HTMLButtonElement>(null)

  // ちずで つかう え の なまえ。かわらない あいだは おなじ もじ なので <defs> は かきなおさない。
  const artKeys = useMemo(() => [...new Set(views.flatMap(sharedArtKeys))].sort().join(' '), [views])
  const rank = rankOf(population)
  const scale = fitScale(tool, chosenScale)

  // ちずを ひらいたら、キーボードでも すぐ うごかせる よう まんなかの マスに フォーカスする。
  useEffect(() => {
    mapRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus({ preventScroll: true })
  }, [])

  function scrollToCenter() {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollLeft = center.current.x * viewport.scrollWidth - viewport.clientWidth / 2
    viewport.scrollTop = center.current.y * viewport.scrollHeight - viewport.clientHeight / 2
  }

  // ズームや がめんの おおきさが かわっても、みて いた ばしょを まんなかに たもつ。
  useLayoutEffect(scrollToCenter, [tile])

  // やじるしキーで うごかした カーソルの マスへ フォーカスを うつす（みえて いなければ ブラウザが スクロール する）。
  useEffect(() => {
    if (!focusCursor.current) return
    focusCursor.current = false
    viewportRef.current?.querySelector<HTMLElement>(`[data-index="${cursor}"]`)?.focus()
  }, [cursor])

  useEffect(() => {
    if (celebration === null) return
    const timer = setTimeout(() => setCelebration(null), 2600)
    return () => clearTimeout(timer)
  }, [celebration])

  const confirming = restartTown !== null
  useEffect(() => { if (confirming) firstChoice.current?.focus() }, [confirming])
  useEffect(() => { if (mapOpen) mapClose.current?.focus() }, [mapOpen])

  // 3D から もどったら「3Dで みる」ボタンに フォーカスを もどす。
  useEffect(() => {
    if (viewing3d || !returnFocus.current) return
    returnFocus.current = false
    view3dButton.current?.focus()
  }, [viewing3d])

  /** まちを かえて、まえの まちを ひとつ もどす ために のこす。 */
  function remember(next: Town): Board {
    const nextBoard = boardOf(next, board)
    setHistory((previous) => [...previous.slice(1 - HISTORY_LIMIT), town])
    setBoard(nextBoard)
    return nextBoard
  }

  function place(index: number) {
    setCursor(index)
    const next = applyTool(town, index, tool, scale)
    if (next === town) return
    primeAudio()
    const nextBoard = remember(next)
    setSaveFailed(!writeSlot(mapId, next))
    setEffect((previous) => ({ cells: effectCells(town, next, index, tool, scale), stamp: (previous?.stamp ?? 0) + 1, dust: tool === 'erase' }))
    const nextRank = rankOf(nextBoard.population)
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
    setBoard((current) => boardOf(previous, current))
    setSaveFailed(!writeSlot(mapId, previous))
    setEffect(null)
    playTownSound('undo')
  }

  const chooseTool = useCallback((next: ToolId) => {
    primeAudio()
    setTool(next)
    playTownSound('select')
  }, [])

  const chooseCategory = useCallback((next: CategoryId) => {
    setCategory(next)
    const parts = partsInCategory(next)
    primeAudio()
    setTool((current) => (parts.some((part) => part.id === current) ? current : parts[0].id))
    playTownSound('select')
  }, [])

  const chooseScale = useCallback((next: Scale) => {
    primeAudio()
    setChosenScale(next)
    playTownSound('select')
  }, [])

  function changeZoom(step: number) {
    const next = Math.max(0, Math.min(ZOOM_LEVELS - 1, zoom + step))
    if (next === zoom) return
    primeAudio()
    setChosenZoom(next)
    playTownSound('select')
  }

  function toggleNight() {
    primeAudio()
    setNight((value) => !value)
    playTownSound('select')
  }

  /** みる ばしょを うつす。 */
  function lookAt(next: ViewCenter) {
    center.current = next
    setAnchor(next)
    scrollToCenter()
  }

  function open3d() {
    primeAudio()
    setFocus3d(tileAtCenter(center.current))
    playTownSound('view')
    vibrate('tap')
  }

  function close3d() {
    returnFocus.current = true
    setFocus3d(null)
    playTownSound('select')
  }

  function openMap() {
    primeAudio()
    setMapOpen(true)
    playTownSound('select')
  }

  function jumpTo(index: number) {
    setMapOpen(false)
    setCursor(index)
    lookAt(centerOfTile(index))
    playTownSound('view')
    vibrate('tap')
  }

  /** 「さいしょから」を きく。せかいは あたらしい たねで つくった かたちを みほんに だす。 */
  function askRestart() {
    primeAudio()
    setRestartTown(map.kind === 'world' ? createMapTown(mapId, randomSeed()) : createMapTown(mapId))
    playTownSound('select')
  }

  /** この ちずを さいしょの まちに もどす（ひとつ もどす で とりけせる）。 */
  function restart() {
    if (!restartTown) return
    const next = restartTown
    setRestartTown(null)
    const nextBoard = remember(next)
    // せかいは かたちが かわるので つくった まちを ほぞんし、てがきの ちずは つづきを けす。
    setSaveFailed(!(map.kind === 'world' ? writeSlot(mapId, next) : clearSlot(mapId)))
    setEffect(null)
    // さいしょから やりなおすので、おおきさの おいわいも やりなおす。
    setBestRank(rankOf(nextBoard.population))
    setCursor(CENTER_INDEX)
    lookAt(START_CENTER)
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
    focusCursor.current = true
    setCursor(row * COLS + col)
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
    const next = {
      x: (viewport.scrollLeft + viewport.clientWidth / 2) / viewport.scrollWidth,
      y: (viewport.scrollTop + viewport.clientHeight / 2) / viewport.scrollHeight,
    }
    center.current = next
    if (!sameRange(range, visibleRange(next, size.width, size.height, tile))) setAnchor(next)
  }

  const rankInfo = RANKS[rank]
  const toolName = tool === 'erase' ? ERASE_LABEL : findPart(tool)?.label ?? ''
  const toolLabel = isBuildingTool(tool) && scale > 1 ? `${scaleLabel(scale)} ${toolName}` : toolName

  return <>
    <div className={styles.screen} data-night={night} inert={viewing3d} aria-hidden={viewing3d || undefined}>
      <header className={styles.header}>
        <GameBackButton onBack={onBack} ariaLabel="ちずを えらぶ" />
        <h1 className={styles.title}><span className={styles.titleEmoji} aria-hidden="true">{map.emoji} </span>{map.name}</h1>
        <span className={styles.stats} role="img" aria-label={`${rankInfo.label}・${population}にん`}>
          <span className={styles.rankIcon}>{rankInfo.icon}</span>
          <span>👤{population}</span>
        </span>
        <SoundButton sound={sound} onToggle={onToggleSound} />
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
            ref={mapRef}
            // マスの おおきさは グリッドだけに わたす（--tile を ちず ぜんたいに うけつがせると、ズームの たびに ぜんぶの え の スタイルを けいさんしなおす）。
            // ひろい ちずでも かるいよう、えがくのは みえて いる マスだけ（ばしょは グリッドの れつ・ぎょうで きめる）。
            style={{ gridTemplateColumns: `repeat(${COLS}, ${tile}px)`, gridTemplateRows: `repeat(${ROWS}, ${tile}px)` }}
            role="group"
            aria-label={`まちの ちず。${toolLabel}を おく ばしょを えらんでね`}
            onClick={onMapClick}
            onKeyDown={onMapKeyDown}
          >
            {shown.map((index) => <TileButton
              key={index}
              index={index}
              view={views[index]}
              tabbable={index === cursor}
              pop={effect?.cells.includes(index) ? effect.stamp : 0}
              dust={Boolean(effect?.cells.includes(index) && effect.dust)}
            />)}
            {!viewing3d && <Vehicles town={town} tile={tile} range={range} />}
            <SharedTileArt keys={artKeys} />
          </div>
        </div>

        <button type="button" ref={view3dButton} className={styles.view3d} onClick={open3d} aria-label="3Dで みる">
          <span aria-hidden="true">👀</span><span aria-hidden="true" className={styles.view3dText}>3D</span>
        </button>

        <div className={`${styles.mapTools} ${styles.mapToolsLeft}`}>
          <button type="button" onClick={undo} disabled={!history.length} aria-label="ひとつ もどす"><span aria-hidden="true">↩</span></button>
          <button type="button" onClick={askRestart} aria-label="この まちを さいしょから"><span aria-hidden="true">🗑️</span></button>
          <button type="button" onClick={openMap} aria-label="ちずを みる"><span aria-hidden="true">🗺️</span></button>
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

        {restartTown && <div className={styles.dialogBackdrop}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="town-reset-title"
            onKeyDown={(event) => { if (event.key === 'Escape') setRestartTown(null) }}>
            <span className={styles.dialogPreview}><TownPreview town={restartTown} /></span>
            <p id="town-reset-title">{map.name}を さいしょから つくる？</p>
            <div className={styles.dialogChoices}>
              <button type="button" ref={firstChoice} onClick={restart}><span aria-hidden="true">🔄</span>さいしょから</button>
              <button type="button" className={styles.cancel} onClick={() => setRestartTown(null)}><span aria-hidden="true">✋</span>やめる</button>
            </div>
          </div>
        </div>}

        {mapOpen && <div className={styles.dialogBackdrop}>
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="town-whole-map-title"
            onKeyDown={(event) => { if (event.key === 'Escape') setMapOpen(false) }}>
            <p id="town-whole-map-title">ちず</p>
            <TownMap town={town} range={range} onJump={jumpTo} />
            <button type="button" ref={mapClose} className={styles.cancel} onClick={() => setMapOpen(false)}>とじる</button>
          </div>
        </div>}
      </div>

      <Palette category={category} tool={tool} chosenScale={chosenScale} onCategory={chooseCategory} onTool={chooseTool} onScale={chooseScale} />
    </div>

    {focus3d !== null && <Suspense fallback={<p className={styles.loading3d} role="status">じゅんびちゅう…</p>}>
      <Town3D town={town} focus={focus3d} night={night} onToggleNight={toggleNight} sound={sound} onToggleSound={onToggleSound} onClose={close3d} />
    </Suspense>}
  </>
}

export default function TownBuilderPlay() {
  const [sound, toggleSound] = useSoundToggle()
  // まえの ほぞん（ちずが 1つ だった ころ）を「はじめの まち」に うつしてから ちずを えらぶ。
  const [mapId, setMapId] = useState<MapId | null>(() => { migrateLegacySave(); return null })
  const [lastMap, setLastMap] = useState<MapId | null>(null)
  useGameIntroPlaying(mapId !== null)

  function choose(id: MapId) {
    primeAudio()
    setMapId(id)
    playTownSound('view')
    vibrate('tap')
  }

  function backToMaps() {
    setLastMap(mapId)
    setMapId(null)
    playTownSound('select')
  }

  return <GamePlaySurface>
    {mapId === null
      ? <MapSelect sound={sound} onToggleSound={toggleSound} focusMap={lastMap} onChoose={choose} />
      : <TownEditor key={mapId} mapId={mapId} sound={sound} onToggleSound={toggleSound} onBack={backToMaps} />}
  </GamePlaySurface>
}
