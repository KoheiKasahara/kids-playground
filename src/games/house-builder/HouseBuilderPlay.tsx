import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import {
  DOGHOUSES, DOORS, EXTRAS, GARDENS, HOUSE_TYPES, PARKINGS, ROOFS, ROOM_SIZES, ROOM_TYPES, SHAPES, WALLS, WINDOWS,
  findHouseType, findRoof, findRoomStyle, findRoomType, findShape,
  type Exterior, type ExteriorOption, type ExtraId, type HouseTypeId, type RoomSizeId, type RoomTypeId, type Shape, type ShapeId,
} from './data'
import {
  addRoom, changeRoom, createDesign, findSpot, floorCount, moveRoom, removeRoom, reshape, roomCounts, roomSize, roomsOn,
  type Cell, type HouseDesign, type PlacedRoom, type RoomPick,
} from './plan'
import { ALBUM_LIMIT, putHouse, readAlbum, readDraft, removeHouse, sameDesign, writeAlbum, writeDraft, type SavedHouse } from './save'
import { ROOM_VOICE, playHouseSound, startBgm, type HouseSound } from './sounds'
import PlanBoard, { type Ghost } from './PlanBoard'
import { RoomSwatch } from './RoomArt'
import { ExteriorSwatch, HouseFront, type ExteriorCategory, type Hotspot } from './HouseFront'
import type { HouseView, SceneSpot } from './three/houseScene'
import styles from './HouseBuilderPlay.module.css'

const House3D = lazy(() => import('./House3D'))

const TITLE = 'おうちづくり'

type Screen = 'type' | 'shape' | 'plan' | 'outside' | 'done'

/** たしかめる ダイアログ。 */
type Ask =
  | { kind: 'restart' }
  | { kind: 'open'; id: number }
  | { kind: 'remove'; id: number }
  | { kind: 'full' }

const SAVE_FAILED = 'この ブラウザでは ほぞん できないよ'

const BACK: Record<Exclude<Screen, 'type'>, Screen> = { shape: 'type', plan: 'shape', outside: 'plan', done: 'outside' }

const STEPS: readonly { name: string; screens: readonly Screen[] }[] = [
  { name: 'えらぶ', screens: ['type', 'shape'] },
  { name: 'まどり', screens: ['plan'] },
  { name: 'そとがわ', screens: ['outside'] },
  { name: 'かんせい', screens: ['done'] },
]

function sfx(kind: HouseSound, haptic?: Parameters<typeof vibrate>[0]) {
  primeAudio()
  playHouseSound(kind)
  if (haptic) vibrate(haptic)
}

export default function HouseBuilderPlay() {
  const [screen, setScreen] = useState<Screen>('type')
  const [draft] = useState(readDraft)
  const [design, setDesign] = useState<HouseDesign | null>(draft?.design ?? null)
  const [savedId, setSavedId] = useState<number | null>(draft?.savedId ?? null)
  const [album, setAlbum] = useState<SavedHouse[]>(readAlbum)
  const [pendingType, setPendingType] = useState<HouseTypeId>(() => design?.houseType ?? 'nikai')
  const [begun, setBegun] = useState(false)
  const [ask, setAsk] = useState<Ask | null>(null)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [sound, toggleSound] = useSoundToggle()
  const current: Screen = screen !== 'type' && screen !== 'shape' && !design ? 'type' : screen
  const playing = current !== 'type'
  useGameIntroPlaying(playing)

  useEffect(() => {
    if (!sound || !begun) return undefined
    return startBgm()
  }, [sound, begun])

  const linked = album.find((house) => house.id === savedId) ?? null
  const isSaved = useMemo(() => !!design && !!linked && sameDesign(linked.design, design), [design, linked])

  useEffect(() => writeDraft(design ? { design, savedId } : null), [design, savedId])

  useEffect(() => {
    // がめんを きりかえたら いちばん うえから みせる。
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [current])

  const go = (next: Screen) => {
    setBegun(true)
    setSaveNote(null)
    setScreen(next)
  }

  const back = () => {
    if (current === 'type') return
    sfx('tap')
    go(BACK[current])
  }

  function pickType(type: HouseTypeId) {
    sfx('tap', 'tap')
    setPendingType(type)
    go('shape')
  }

  function pickShape(shape: ShapeId) {
    sfx('place', 'tap')
    setDesign((d) => (d ? reshape(d, pendingType, shape) : createDesign(pendingType, shape)))
    go('plan')
  }

  function restart() {
    sfx('remove', 'tap')
    setAsk(null)
    setDesign(null)
    setSavedId(null)
    setPendingType('nikai')
    go('type')
  }

  /** いちらんを かきかえる。ほぞん できなかったら そのまま に して おしえる。 */
  function commitAlbum(next: SavedHouse[]): boolean {
    if (!writeAlbum(next)) {
      sfx('blocked', 'error')
      setSaveNote(SAVE_FAILED)
      return false
    }
    setAlbum(next)
    return true
  }

  function saveAs(id: number | null) {
    if (!design) return
    const result = putHouse(album, design, id, Date.now())
    if (!result) {
      sfx('tap')
      setAsk({ kind: 'full' })
      return
    }
    setAsk(null)
    if (!commitAlbum(result.album)) return
    setSavedId(result.id)
    sfx('place', 'success')
    setSaveNote('ほぞんしたよ！ さいしょの がめんから また ひらけるよ')
  }

  function openSaved(id: number, confirmed = false) {
    const house = album.find((h) => h.id === id)
    if (!house) return
    if (!confirmed && design && !isSaved) {
      sfx('tap')
      setAsk({ kind: 'open', id })
      return
    }
    setAsk(null)
    setDesign(house.design)
    setSavedId(house.id)
    setPendingType(house.design.houseType)
    sfx('bell', 'tap')
    go('done')
  }

  function removeSaved(id: number) {
    setAsk(null)
    if (!commitAlbum(removeHouse(album, id))) return
    sfx('remove', 'tap')
    setSaveNote('ほぞんした おうちを けしたよ')
  }

  let body: ReactNode
  if (current === 'type' || !design) {
    body = current === 'shape'
      ? <ShapeScreen houseType={pendingType} current={design?.shape} onPick={pickShape} />
      : (
        <TypeScreen
          draft={design}
          current={design?.houseType}
          album={album}
          note={saveNote}
          onPick={pickType}
          onContinue={() => {
            sfx('tap', 'tap')
            go('plan')
          }}
          onRestart={() => {
            sfx('tap')
            setAsk({ kind: 'restart' })
          }}
          onOpen={(id) => openSaved(id)}
          onRemove={(id) => {
            sfx('tap')
            setAsk({ kind: 'remove', id })
          }}
        />
      )
  } else if (current === 'shape') {
    body = <ShapeScreen houseType={pendingType} current={design.shape} onPick={pickShape} />
  } else if (current === 'plan') {
    body = (
      <PlanScreen
        design={design}
        onChange={setDesign}
        onNext={() => {
          sfx('floor', 'tap')
          go('outside')
        }}
      />
    )
  } else if (current === 'outside') {
    body = (
      <OutsideScreen
        design={design}
        onChange={setDesign}
        onDone={() => {
          sfx('complete', 'celebrate')
          go('done')
        }}
      />
    )
  } else {
    body = (
      <DoneScreen
        design={design}
        saved={isSaved}
        note={saveNote}
        onSave={() => saveAs(savedId)}
        onEditPlan={() => {
          sfx('tap')
          go('plan')
        }}
        onEditOutside={() => {
          sfx('tap')
          go('outside')
        }}
        onRestart={() => {
          sfx('tap')
          setAsk({ kind: 'restart' })
        }}
      />
    )
  }

  const cancelAsk = () => setAsk(null)
  let dialog: ReactNode = null
  if (ask?.kind === 'restart') {
    dialog = (
      <Dialog title={isSaved ? 'あたらしい おうちを つくる？ ほぞんした おうちは のこるよ' : 'いまの おうちを けして、さいしょから つくる？'}>
        <button type="button" className={`${styles.btn} ${isSaved ? styles.btnPrimary : styles.btnDanger}`} onClick={restart}>{isSaved ? 'あたらしく つくる' : 'けして つくる'}</button>
        <button type="button" className={styles.btn} onClick={cancelAsk} autoFocus>やめる</button>
      </Dialog>
    )
  } else if (ask?.kind === 'open') {
    const id = ask.id
    dialog = (
      <Dialog title="つくりかけの おうちは きえるよ。ほぞんした おうちを ひらく？">
        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => openSaved(id, true)}>ひらく</button>
        <button type="button" className={styles.btn} onClick={cancelAsk} autoFocus>やめる</button>
      </Dialog>
    )
  } else if (ask?.kind === 'remove') {
    const id = ask.id
    const house = album.find((h) => h.id === id)
    dialog = (
      <Dialog title="この おうちを けす？">
        {house && <div className={styles.dialogArt}><HouseFront design={house.design} title="けす おうち" /></div>}
        <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={() => removeSaved(id)}>けす</button>
        <button type="button" className={styles.btn} onClick={cancelAsk} autoFocus>やめる</button>
      </Dialog>
    )
  } else if (ask?.kind === 'full') {
    dialog = (
      <Dialog title={`ほぞんは ${ALBUM_LIMIT}こ まで。どの おうちと いれかえる？`}>
        <ul className={styles.swapGrid} aria-label="いれかえる おうち">
          {album.map((house, i) => (
            <li key={house.id}>
              <button type="button" className={styles.swapCard} aria-label={`${i + 1}ばんめの おうちと いれかえる`} onClick={() => saveAs(house.id)}>
                <span className={styles.swapArt}><HouseFront design={house.design} /></span>
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className={styles.btn} onClick={cancelAsk} autoFocus>やめる</button>
      </Dialog>
    )
  }

  const content = (
    <main className={styles.page} data-screen={current}>
      <header className={styles.header}>
        <GameBackButton to="/" onBack={current === 'type' ? undefined : back} />
        <h1 className={styles.title}>{TITLE}</h1>
        <button type="button" className={styles.soundButton} aria-label={sound ? 'おとを けす' : 'おとを だす'} aria-pressed={sound} onClick={toggleSound}>
          <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        </button>
      </header>
      <ol className={styles.steps} aria-label="すすみぐあい">
        {STEPS.map((step, i) => {
          const at = step.screens.includes(current)
          const done = STEPS.findIndex((s) => s.screens.includes(current)) > i
          return (
            <li key={step.name} className={styles.step} data-current={at || undefined} data-done={done || undefined} aria-current={at ? 'step' : undefined}>
              <span className={styles.stepNum} aria-hidden="true">{done ? '✓' : i + 1}</span>
              {step.name}
            </li>
          )
        })}
      </ol>
      {body}
      {dialog}
    </main>
  )

  return playing ? <GamePlaySurface>{content}</GamePlaySurface> : content
}

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="house-dialog-title">
      <div className={styles.dialog}>
        <h2 id="house-dialog-title" className={styles.dialogTitle}>{title}</h2>
        <div className={styles.dialogButtons}>{children}</div>
      </div>
    </div>
  )
}

// ---------------- いえの しゅるい ----------------

function TypeIcon({ floors }: { floors: number }) {
  const h = 22 * floors
  const top = 96 - h
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <rect x={0} y={96} width={100} height={4} fill="#8bc34a" />
      <rect x={24} y={top} width={52} height={h} fill="#fff6e4" stroke="#4a3b30" strokeWidth={3} />
      <path d={`M16 ${top + 2} L 50 ${top - 22} L 84 ${top + 2} Z`} fill="#e8604c" stroke="#4a3b30" strokeWidth={3} strokeLinejoin="round" />
      {Array.from({ length: floors }, (_, i) => (
        <g key={i}>
          <rect x={32} y={top + 5 + i * 22} width={12} height={11} fill="#bfe6fb" stroke="#4a3b30" strokeWidth={2} />
          {i === floors - 1
            ? <rect x={54} y={top + 3 + i * 22} width={12} height={19} fill="#a0673a" stroke="#4a3b30" strokeWidth={2} />
            : <rect x={56} y={top + 5 + i * 22} width={12} height={11} fill="#bfe6fb" stroke="#4a3b30" strokeWidth={2} />}
        </g>
      ))}
    </svg>
  )
}

const houseSummary = (design: HouseDesign) => `${findHouseType(design.houseType).name}・へや ${design.rooms.length}こ`

function TypeScreen({ draft, current, album, note, onPick, onContinue, onRestart, onOpen, onRemove }: {
  draft: HouseDesign | null
  current?: HouseTypeId
  album: readonly SavedHouse[]
  note: string | null
  onPick: (type: HouseTypeId) => void
  onContinue: () => void
  onRestart: () => void
  onOpen: (id: number) => void
  onRemove: (id: number) => void
}) {
  return (
    <section className={styles.section} aria-labelledby="house-type-title">
      {draft && (
        <div className={styles.draft}>
          <div className={styles.draftArt}><HouseFront design={draft} title="つくりかけの おうち" /></div>
          <p className={styles.draftText}>つくりかけの おうちが あるよ</p>
          <div className={styles.draftButtons}>
            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onContinue}>つづきから つくる</button>
            <button type="button" className={styles.btn} onClick={onRestart}>さいしょから</button>
          </div>
        </div>
      )}
      {note && <p className={styles.message} role="status">{note}</p>}
      {album.length > 0 && (
        <section className={styles.album} aria-labelledby="house-album-title">
          <h2 id="house-album-title" className={styles.albumTitle}>
            <span aria-hidden="true">📒 </span>ほぞんした おうち（{album.length}/{ALBUM_LIMIT}）
          </h2>
          <ul className={styles.albumGrid} aria-label="ほぞんした おうち">
            {album.map((house, i) => (
              <li key={house.id} className={styles.albumItem}>
                <button type="button" className={styles.albumCard} aria-label={`${i + 1}ばんめの おうちを ひらく（${houseSummary(house.design)}）`} onClick={() => onOpen(house.id)}>
                  <span className={styles.albumArt}><HouseFront design={house.design} /></span>
                  <span className={styles.albumName} aria-hidden="true">{houseSummary(house.design)}</span>
                </button>
                <button type="button" className={styles.albumRemove} aria-label={`${i + 1}ばんめの おうちを けす`} onClick={() => onRemove(house.id)}>
                  <span aria-hidden="true">けす</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <h2 id="house-type-title" className={styles.lead}>どんな おうちに する？</h2>
      <ul className={styles.cardGrid} aria-label="いえの しゅるい">
        {HOUSE_TYPES.map((type) => (
          <li key={type.id}>
            <button type="button" className={styles.card} aria-pressed={current === type.id} onClick={() => onPick(type.id)}>
              <span className={styles.cardArt}><TypeIcon floors={type.floors} /></span>
              <span className={styles.cardName}>{type.name}</span>
              <span className={styles.cardLead}>{type.lead}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------- かたち ----------------

function ShapeIcon({ shape }: { shape: Shape }) {
  const size = 10
  return (
    <svg viewBox={`-2 -2 ${shape.width * size + 4} ${shape.height * size + 4}`} aria-hidden="true" focusable="false">
      {shape.mask.map((row, y) => row.map((on, x) => (
        <rect key={`${x}-${y}`} x={x * size} y={y * size} width={size} height={size} fill={on ? '#fff6e4' : '#a5d98a'} stroke={on ? '#c9a676' : '#8cc66f'} strokeWidth={.8} />
      )))}
    </svg>
  )
}

function ShapeScreen({ houseType, current, onPick }: { houseType: HouseTypeId; current?: ShapeId; onPick: (shape: ShapeId) => void }) {
  return (
    <section className={styles.section} aria-labelledby="house-shape-title">
      <p className={styles.chosen}>{findHouseType(houseType).name} の おうち</p>
      <h2 id="house-shape-title" className={styles.lead}>おうちの かたちを えらぼう</h2>
      <ul className={styles.cardGrid} aria-label="おうちの かたち">
        {SHAPES.map((shape) => (
          <li key={shape.id}>
            <button type="button" className={styles.card} aria-pressed={current === shape.id} onClick={() => onPick(shape.id)}>
              <span className={styles.cardArt}><ShapeIcon shape={shape} /></span>
              <span className={styles.cardName}>{shape.name}</span>
              <span className={styles.cardLead}>{shape.lead}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------------- まどり ----------------

function SizeIcon({ w, h }: { w: number; h: number }) {
  return (
    <svg viewBox="-1 -1 42 42" aria-hidden="true" focusable="false">
      {Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => (
        <rect key={`${x}-${y}`} x={x * 10 + (40 - w * 10) / 2} y={y * 10 + (40 - h * 10) / 2} width={10} height={10} fill="#ffcf99" stroke="#c9822f" strokeWidth={1.2} />
      )))}
    </svg>
  )
}

function SizePicker({ type, size, turned, onSize, onTurn }: { type: RoomTypeId; size: RoomSizeId; turned: boolean; onSize: (size: RoomSizeId) => void; onTurn: () => void }) {
  const square = (() => {
    const { w, h } = roomSize({ type, size, turned: false })
    return w === h
  })()
  return (
    <div className={styles.sizeRow} role="group" aria-label="おおきさ">
      {ROOM_SIZES.map((option) => {
        const { w, h } = roomSize({ type, size: option.id, turned })
        return (
          <button key={option.id} type="button" className={styles.chip} aria-pressed={size === option.id} aria-label={`${option.name}（よこ ${w}・たて ${h}）`} onClick={() => onSize(option.id)}>
            <span className={styles.sizeArt}><SizeIcon w={w} h={h} /></span>
            <span aria-hidden="true">{option.name}</span>
          </button>
        )
      })}
      <button type="button" className={styles.chip} aria-pressed={turned} disabled={square} aria-label="くるっと まわす" onClick={onTurn}>
        <span className={styles.turnArt} aria-hidden="true">↻</span>
        <span aria-hidden="true">くるっ</span>
      </button>
    </div>
  )
}

function StylePicker({ type, value, w, h, onPick }: { type: RoomTypeId; value: string; w: number; h: number; onPick: (style: string) => void }) {
  return (
    <ul className={styles.scrollRow} aria-label="みための しゅるい">
      {findRoomType(type).styles.map((style) => (
        <li key={style.id}>
          <button type="button" className={styles.styleCard} aria-pressed={value === style.id} onClick={() => onPick(style.id)}>
            <span className={styles.styleArt}><RoomSwatch type={type} style={style.id} w={w} h={h} /></span>
            <span className={styles.styleName}>{style.name}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

const MESSAGE_START = 'へやを えらんで、おきたい ところを タップしてね。おいた へやは ひっぱると うごかせるよ'

function PlanScreen({ design, onChange, onNext }: { design: HouseDesign; onChange: (design: HouseDesign) => void; onNext: () => void }) {
  const floors = floorCount(design)
  const [floorState, setFloor] = useState(0)
  const floor = Math.min(floorState, floors - 1)
  const [pickType, setPickType] = useState<RoomTypeId>('living')
  const [styleOf, setStyleOf] = useState<Partial<Record<RoomTypeId, string>>>({})
  const [size, setSize] = useState<RoomSizeId>('m')
  const [turned, setTurned] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [hover, setHover] = useState<Cell | null>(null)
  const [popId, setPopId] = useState<number | null>(null)
  const [message, setMessage] = useState(MESSAGE_START)
  const selected = design.rooms.find((room) => room.id === selectedId && room.floor === floor) ?? null
  const styleFor = (type: RoomTypeId) => styleOf[type] ?? findRoomType(type).styles[0].id
  const pick: RoomPick = { type: pickType, style: styleFor(pickType), size, turned }
  const counts = roomCounts(design)

  let ghost: Ghost | null = null
  if (hover && !selected) {
    const spot = findSpot(design, floor, pick, hover)
    if (spot) ghost = { ...spot, ...roomSize(pick), type: pick.type, style: pick.style }
  }

  function placeAt(cell: Cell) {
    if (selected) {
      setSelectedId(null)
      setMessage(MESSAGE_START)
      sfx('tap')
      return
    }
    const result = addRoom(design, floor, pick, cell)
    if (!result) {
      sfx('blocked', 'error')
      setMessage('ここには はいらないよ。ちいさく するか、ほかの ところに おいてね')
      return
    }
    onChange(result.design)
    setPopId(result.room.id)
    setHover(null)
    sfx('place', 'tap')
    setMessage(`${findRoomType(pick.type).name}を おいたよ！`)
  }

  function selectRoom(room: PlacedRoom) {
    if (room.id === selectedId) {
      setSelectedId(null)
      setMessage(MESSAGE_START)
      sfx('tap')
      return
    }
    setSelectedId(room.id)
    setPopId(null)
    sfx('tap', 'tap')
    setMessage(`${findRoomStyle(room.type, room.style).name}。みためや おおきさを かえられるよ`)
  }

  function moveTo(room: PlacedRoom, to: Cell) {
    const next = moveRoom(design, room.id, to)
    if (!next) {
      sfx('blocked', 'error')
      setMessage('そこには うごかせないよ。あいている ところに もっていってね')
      return
    }
    onChange(next)
    setPopId(room.id)
    sfx('place', 'tap')
    setMessage(`${findRoomType(room.type).name}を うごかしたよ`)
  }

  function edit(patch: Partial<RoomPick>, okSound: HouseSound) {
    if (!selected) return
    const next = changeRoom(design, selected.id, patch)
    if (!next) {
      sfx('blocked', 'error')
      setMessage('ここでは そう できないよ。まわりを あけてみてね')
      return
    }
    onChange(next)
    sfx(okSound, 'tap')
    if (patch.style) {
      setStyleOf((s) => ({ ...s, [selected.type]: patch.style }))
      setMessage(`${findRoomStyle(selected.type, patch.style).name}に したよ`)
    }
  }

  function remove() {
    if (!selected) return
    onChange(removeRoom(design, selected.id))
    setSelectedId(null)
    sfx('remove', 'tap')
    setMessage(`${findRoomType(selected.type).name}を けしたよ`)
  }

  function changeFloor(next: number) {
    setFloor(next)
    setSelectedId(null)
    setPopId(null)
    sfx('floor', 'tap')
    setMessage(`${next + 1}かいの まどりだよ`)
  }

  const needsStairs = floors > 1 && !roomsOn(design, floor).some((room) => room.type === 'stairs')

  return (
    <section className={styles.planLayout} aria-label="まどりを つくる">
      <div className={styles.planMain}>
        {floors > 1 && (
          <div className={styles.floorTabs} role="group" aria-label="なんかい">
            {Array.from({ length: floors }, (_, i) => i).map((i) => (
              <button key={i} type="button" className={styles.floorTab} aria-pressed={floor === i} onClick={() => changeFloor(i)}>
                {`${i + 1}かい`}
                <span className={styles.floorCount} aria-label={`へや ${counts[i]}こ`}>{counts[i]}</span>
              </button>
            ))}
          </div>
        )}
        <p className={styles.message} role="status" aria-live="polite">{message}</p>
        <PlanBoard
          design={design}
          floor={floor}
          label={`${floor + 1}かいの まどり`}
          selectedId={selected?.id ?? null}
          popId={popId}
          ghost={ghost}
          onCell={placeAt}
          onRoom={selectRoom}
          onMove={moveTo}
          onHover={setHover}
        />
        {needsStairs && <p className={styles.hint}>かいだんを おくと うえと したが つながるよ</p>}
      </div>

      <div className={styles.panel}>
        {selected ? (
          <div className={styles.editPanel} aria-label="えらんだ へや">
            <p className={styles.panelTitle}>
              <span className={styles.panelBadge}>えらんだ へや</span>
              {findRoomStyle(selected.type, selected.style).name}
            </p>
            <h3 className={styles.panelHead}>みため</h3>
            <StylePicker type={selected.type} value={selected.style} {...roomSize(selected)} onPick={(style) => edit({ style }, 'paint')} />
            <h3 className={styles.panelHead}>おおきさ</h3>
            <SizePicker type={selected.type} size={selected.size} turned={selected.turned} onSize={(s) => edit({ size: s }, 'place')} onTurn={() => edit({ turned: !selected.turned }, 'turn')} />
            <div className={styles.editButtons}>
              <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={remove}>けす</button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => {
                  setSelectedId(null)
                  setMessage(MESSAGE_START)
                  sfx('tap')
                }}
              >できた</button>
            </div>
          </div>
        ) : (
          <div>
            <h3 className={styles.panelHead}>へや</h3>
            <ul className={styles.scrollRow} aria-label="へやの しゅるい">
              {ROOM_TYPES.map((type) => (
                <li key={type.id}>
                  <button
                    type="button"
                    className={styles.roomChip}
                    aria-pressed={pickType === type.id}
                    onClick={() => {
                      setPickType(type.id)
                      sfx('tap')
                      setMessage(`${type.name}を おく ところを タップしてね`)
                    }}
                  >
                    <span className={styles.roomChipArt}><RoomSwatch type={type.id} style={styleFor(type.id)} /></span>
                    <span>{type.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            <h3 className={styles.panelHead}>みため</h3>
            <StylePicker
              type={pickType}
              value={pick.style}
              {...roomSize(pick)}
              onPick={(style) => {
                setStyleOf((s) => ({ ...s, [pickType]: style }))
                sfx('paint')
                setMessage(`${findRoomStyle(pickType, style).name}を おこう`)
              }}
            />
            <h3 className={styles.panelHead}>おおきさ</h3>
            <SizePicker
              type={pickType}
              size={size}
              turned={turned}
              onSize={(s) => {
                setSize(s)
                sfx('tap')
              }}
              onTurn={() => {
                setTurned((t) => !t)
                sfx('turn')
              }}
            />
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} onClick={onNext}>
          そとがわを つくる <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}

// ---------------- そとがわ ----------------

const CATEGORIES: readonly { id: ExteriorCategory; name: string; options: readonly ExteriorOption<string>[] }[] = [
  { id: 'wall', name: 'かべ', options: WALLS },
  { id: 'roof', name: 'やね', options: ROOFS },
  { id: 'window', name: 'まど', options: WINDOWS },
  { id: 'door', name: 'ドア', options: DOORS },
  { id: 'parking', name: 'ちゅうしゃじょう', options: PARKINGS },
  { id: 'doghouse', name: 'いぬごや', options: DOGHOUSES },
  { id: 'garden', name: 'にわ', options: GARDENS },
  { id: 'extras', name: 'おまけ', options: EXTRAS },
]

function OutsideScreen({ design, onChange, onDone }: { design: HouseDesign; onChange: (design: HouseDesign) => void; onDone: () => void }) {
  const [category, setCategory] = useState<ExteriorCategory>('wall')
  const [message, setMessage] = useState('かべや やねを えらんで、おうちの そとがわを つくろう')
  const ex = design.exterior
  const options = CATEGORIES.find((c) => c.id === category)!.options

  function choose(id: string, name: string) {
    let exterior: Exterior
    let kind: HouseSound = 'paint'
    if (category === 'extras') {
      const on = ex.extras.includes(id as ExtraId)
      const extras = EXTRAS.map((e) => e.id).filter((e) => (e === id ? !on : ex.extras.includes(e)))
      exterior = { ...ex, extras }
      setMessage(on ? `${name}を はずしたよ` : `${name}を つけたよ！`)
      if (on) kind = 'remove'
    } else {
      exterior = { ...ex, [category]: id } as Exterior
      setMessage(id === 'none' ? `${CATEGORIES.find((c) => c.id === category)!.name}は なしに したよ` : `${name}に したよ！`)
      if (category === 'doghouse' && id !== 'none') kind = 'bark'
      if (category === 'parking' && id !== 'none') kind = 'horn'
      if (category === 'door') kind = 'bell'
    }
    onChange({ ...design, exterior })
    sfx(kind, 'tap')
  }

  const isOn = (id: string) => (category === 'extras' ? ex.extras.includes(id as ExtraId) : ex[category] === id)

  return (
    <section className={styles.outsideLayout} aria-label="そとがわを つくる">
      <div className={styles.frontWrap}>
        <HouseFront design={design} lively title="いま つくっている おうちの そとがわ" />
      </div>
      <p className={styles.message} role="status" aria-live="polite">{message}</p>
      <div className={styles.panel}>
        <ul className={styles.tabRow} aria-label="えらぶ もの">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={styles.tab}
                aria-pressed={category === c.id}
                onClick={() => {
                  setCategory(c.id)
                  sfx('tap')
                }}
              >{c.name}</button>
            </li>
          ))}
        </ul>
        <ul className={styles.optionGrid} aria-label={CATEGORIES.find((c) => c.id === category)!.name}>
          {options.map((option) => (
            <li key={option.id}>
              <button type="button" className={styles.optionCard} aria-pressed={isOn(option.id)} onClick={() => choose(option.id, option.name)}>
                <span className={styles.optionArt}><ExteriorSwatch category={category} id={option.id} /></span>
                <span className={styles.optionName}>{option.name}</span>
              </button>
            </li>
          ))}
        </ul>
        {category === 'extras' && <p className={styles.hint}>おまけは いくつでも つけられるよ</p>}
      </div>
      <div className={styles.footer}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} onClick={onDone}>
          かんせい！
        </button>
      </div>
    </section>
  )
}

// ---------------- かんせい ----------------

const ROOM_TALK: Readonly<Record<RoomTypeId, string>> = {
  living: 'みんなで くつろごう', dining: 'いただきます！', kitchen: 'じゅうじゅう おりょうり', bath: 'ちゃぷん！ いいゆだな',
  toilet: 'じゃー！ すっきり', washroom: 'てを あらおうね', bedroom: 'おやすみなさい', kids: 'なにして あそぶ？',
  washitsu: 'ほっと ひといき', entrance: 'ただいま！', stairs: 'とん とん とん', hall: 'てくてく',
}

const HOTSPOT: Readonly<Record<Hotspot, { sound: HouseSound; text: string }>> = {
  door: { sound: 'bell', text: 'ピンポーン！ おかえりなさい' },
  dog: { sound: 'bark', text: 'わん わん！' },
  car: { sound: 'horn', text: 'ブッブー！ おでかけ しよう' },
}

function RoofCap({ design }: { design: HouseDesign }) {
  const roof = findRoof(design.exterior.roof)
  const flat = roof.kind === 'flat'
  return (
    <svg className={styles.roofCap} viewBox="0 0 400 60" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      {flat
        ? <rect x={6} y={36} width={388} height={22} fill={roof.color} stroke={roof.dark} strokeWidth={4} />
        : <path d="M2 58 L 200 4 L 398 58 Z" fill={roof.color} stroke={roof.dark} strokeWidth={4} strokeLinejoin="round" />}
    </svg>
  )
}

/** なかを みる じゅんばん（1かいから、おくから、ひだりから）。 */
function orderedRooms(design: HouseDesign): PlacedRoom[] {
  return [...design.rooms].sort((a, b) => a.floor - b.floor || a.y - b.y || a.x - b.x)
}

const roomTitle = (room: PlacedRoom) => `${room.floor + 1}かいの ${findRoomStyle(room.type, room.style).name}`

function DoneScreen({ design, saved, note, onSave, onEditPlan, onEditOutside, onRestart }: {
  design: HouseDesign
  saved: boolean
  note: string | null
  onSave: () => void
  onEditPlan: () => void
  onEditOutside: () => void
  onRestart: () => void
}) {
  const [view, setView] = useState<'outside' | 'inside'>('outside')
  const [bubble, setBubble] = useState<{ key: number; text: string } | null>(null)
  const [roomId, setRoomId] = useState<number | null>(null)
  const [status, setStatus] = useState<'ready' | 'error'>('ready')
  const [generation, setGeneration] = useState(0)
  const floors = floorCount(design)
  const total = design.rooms.length
  const rooms = useMemo(() => orderedRooms(design), [design])
  const room = rooms.find((r) => r.id === roomId) ?? rooms[0] ?? null
  const roomKey = room?.id ?? null
  const scene = useMemo<HouseView>(() => (view === 'inside' && roomKey !== null ? { kind: 'room', roomId: roomKey } : { kind: 'outside' }), [view, roomKey])
  const show3d = status === 'ready' && (view === 'outside' || room !== null)

  const say = (text: string, sound: HouseSound) => {
    sfx(sound, 'tap')
    setBubble((b) => ({ key: (b?.key ?? 0) + 1, text }))
  }

  const switchView = (next: 'outside' | 'inside') => {
    setView(next)
    setBubble(null)
    sfx(next === 'inside' ? 'bell' : 'tap', 'tap')
  }

  const pickRoom = (next: PlacedRoom) => {
    setRoomId(next.id)
    sfx('floor', 'tap')
    setBubble(null)
  }

  const stepRoom = (step: number) => {
    if (!room) return
    const at = rooms.findIndex((r) => r.id === room.id)
    pickRoom(rooms[(at + step + rooms.length) % rooms.length])
  }

  const talk = (target: PlacedRoom) => say(`${findRoomStyle(target.type, target.style).name}「${ROOM_TALK[target.type]}」`, ROOM_VOICE[target.type])

  const onSpot = (spot: SceneSpot) => {
    if (spot === 'room') {
      if (room) talk(room)
      return
    }
    say(HOTSPOT[spot].text, HOTSPOT[spot].sound)
  }

  const hint = view === 'outside'
    ? 'ゆびで うごかすと まわるよ。ドアや いぬ、くるまを タップしてみてね'
    : room ? 'ゆびで うごかすと まわるよ。へやを タップしてみてね' : 'へやを タップしてみてね'

  let stage: ReactNode
  if (show3d) {
    stage = (
      <div className={styles.stage3d} data-view={scene.kind}>
        <Suspense fallback={<p className={styles.stageLoading} role="status">じゅんびちゅう…</p>}>
          <House3D
            key={generation}
            design={design}
            view={scene}
            label={scene.kind === 'room' && room ? `${roomTitle(room)}（3D）` : 'できあがった おうち（3D）'}
            onSpot={onSpot}
            onStatus={setStatus}
          />
        </Suspense>
      </div>
    )
  } else if (view === 'inside' && !room) {
    stage = <p className={styles.hint}>へやが まだ ないよ。「まどりを なおす」で へやを おいてね</p>
  } else if (view === 'outside') {
    stage = (
      <div className={styles.frontWrap} data-big>
        <HouseFront design={design} lively title="できあがった おうちの そとがわ" onHotspot={(spot) => say(HOTSPOT[spot].text, HOTSPOT[spot].sound)} />
      </div>
    )
  } else {
    stage = (
      <div className={styles.inside}>
        <RoofCap design={design} />
        {Array.from({ length: floors }, (_, i) => floors - 1 - i).map((floor) => (
          <div key={floor} className={styles.insideFloor}>
            <p className={styles.insideLabel}>{floor + 1}かい</p>
            {roomsOn(design, floor).length === 0 && <p className={styles.hint}>この かいは まだ からっぽ</p>}
            <PlanBoard
              design={design}
              floor={floor}
              label={`${floor + 1}かいの なか`}
              onRoom={talk}
              roomLabel={(r) => `${floor + 1}かいの ${findRoomStyle(r.type, r.style).name}`}
            />
          </div>
        ))}
        <div className={styles.insideGround} aria-hidden="true" />
      </div>
    )
  }

  return (
    <section className={styles.doneLayout} aria-labelledby="house-done-title">
      <h2 id="house-done-title" className={styles.doneTitle}>
        <span aria-hidden="true">🎉 </span>かんせい！ すてきな おうちが できたね
      </h2>
      <p className={styles.summary}>
        {findHouseType(design.houseType).name}・{findShape(design.shape).name}・へや {total}こ
      </p>
      <div className={styles.viewToggle} role="group" aria-label="みかた">
        <button type="button" className={styles.tab} aria-pressed={view === 'outside'} onClick={() => switchView('outside')}>そとから みる</button>
        <button type="button" className={styles.tab} aria-pressed={view === 'inside'} onClick={() => switchView('inside')}>なかを みる</button>
      </div>
      <p className={styles.bubble} role="status" aria-live="polite" key={bubble?.key ?? 0} data-show={bubble ? true : undefined}>
        {bubble?.text ?? hint}
      </p>
      {view === 'inside' && room && status === 'ready' && (
        <div className={styles.roomNav}>
          <button type="button" className={styles.navButton} aria-label="まえの へや" onClick={() => stepRoom(-1)}><span aria-hidden="true">◀</span></button>
          <p className={styles.roomNow}>{roomTitle(room)}</p>
          <button type="button" className={styles.navButton} aria-label="つぎの へや" onClick={() => stepRoom(1)}><span aria-hidden="true">▶</span></button>
        </div>
      )}
      {stage}
      {status === 'error' && (
        <div className={styles.fallbackNote}>
          <p className={styles.hint}>3Dで みられない ので、えで みせているよ</p>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              sfx('tap')
              setStatus('ready')
              setGeneration((g) => g + 1)
            }}
          >もういちど 3Dで みる</button>
        </div>
      )}
      {view === 'inside' && room && status === 'ready' && (
        <div className={styles.roomPicker} role="group" aria-label="みる へや">
          {Array.from({ length: floors }, (_, floor) => floor).filter((floor) => rooms.some((r) => r.floor === floor)).map((floor) => (
            <div key={floor} className={styles.pickerFloor}>
              <span className={styles.pickerLabel}>{floor + 1}かい</span>
              <ul className={styles.scrollRow} aria-label={`${floor + 1}かいの へや`}>
                {rooms.filter((r) => r.floor === floor).map((r) => (
                  <li key={r.id}>
                    <button type="button" className={styles.roomChip} aria-pressed={r.id === room.id} aria-label={roomTitle(r)} onClick={() => pickRoom(r)}>
                      <span className={styles.roomChipArt}><RoomSwatch type={r.type} style={r.style} {...roomSize(r)} /></span>
                      <span aria-hidden="true">{findRoomType(r.type).short}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <div className={styles.saveBox}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBig}`} disabled={saved} onClick={onSave}>
          {saved ? <><span aria-hidden="true">✓ </span>ほぞんずみ</> : <><span aria-hidden="true">📒 </span>おうちを ほぞんする</>}
        </button>
        {note && <p className={styles.saveNote} role="status">{note}</p>}
      </div>
      <div className={styles.doneButtons}>
        <button type="button" className={styles.btn} onClick={onEditPlan}>まどりを なおす</button>
        <button type="button" className={styles.btn} onClick={onEditOutside}>そとがわを なおす</button>
        <button type="button" className={styles.btn} onClick={onRestart}>さいしょから つくる</button>
      </div>
    </section>
  )
}
