import { useCallback, useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { feedAnimal, shearSheep, type Animal, type Cell, type FeedResult, type Herd } from './animals'
import { biome, BIOMES } from './biomes'
import { MAX_WHEAT, newGame, readGame, readWool, writeGame, writeWool, type Game } from './save'
import {
  blockAt, brushCells, editWorld, growTree, isCrop, materialCode, materialDef, netMaterialChange, PALETTE, pickAs, settleWalker,
  startWalker, tendCrops, topBlock, undoChanges, walk, wheatAt, woolMaterial, type Changes, type Material, type Position, type WoolColor, type World,
} from './world'
import { useCraftScene } from './useCraftScene'
import CraftMap from './CraftMap'
import { playCraftSound, type CraftSound } from './sounds'
import styles from './BlockCraftPlay.module.css'

/** おしらせを だす じかん [ms]。 */
const TOAST_MS = 2400
type Farm = { wheat: number; herd: Herd }
const FEED_MESSAGES: Record<FeedResult, string> = {
  grow: '🐾 おおきく なった！',
  wool: '🐑 けが はえてきた！',
  love: '💕 なかよしに なった！',
  baby: '🐣 あかちゃんが うまれた！',
}
type HistoryEntry = { farm: Farm } & ({ changes: Changes } | { world: World })
const OBSIDIAN = materialCode('obsidian')
/** おしっぱなしで あるきつづける：はじめの まち [ms] と くりかえす はやさ [ms]。 */
const REPEAT_DELAY_MS = 380
const REPEAT_MS = 170

/** ボタンを おしている あいだ、おなじ うごきを くりかえす。 */
function useHoldRepeat(action: () => void) {
  const latest = useRef(action)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const repeated = useRef(false)
  useEffect(() => { latest.current = action })
  const stop = useCallback(() => { clearTimeout(timer.current); timer.current = undefined }, [])
  useEffect(() => {
    window.addEventListener('blur', stop)
    return () => { window.removeEventListener('blur', stop); stop() }
  }, [stop])
  const start = () => {
    stop()
    repeated.current = false
    const tick = () => {
      repeated.current = true
      latest.current()
      timer.current = setTimeout(tick, REPEAT_MS)
    }
    timer.current = setTimeout(tick, REPEAT_DELAY_MS)
  }
  // おしっぱなしの あとに はなした ときは、もう 1ぽ すすまない
  const click = () => { if (repeated.current) repeated.current = false; else latest.current() }
  return { onPointerDown: start, onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop, onClick: click }
}

const addWheat = (farm: Farm, harvested: number): Farm => harvested ? { ...farm, wheat: Math.min(MAX_WHEAT, farm.wheat + harvested) } : farm

function Craft({ initial, onBack }: { initial: Game; onBack: () => void }) {
  useGameIntroPlaying(true)
  const land = biome(initial.biome)
  const [world, setWorld] = useState(initial.world)
  const [farm, setFarm] = useState<Farm>({ wheat: initial.wheat, herd: initial.herd })
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [material, setMaterial] = useState<Material>('wood')
  const [mode, setMode] = useState<'place' | 'remove'>('place')
  const [wide, setWide] = useState(false)
  const [cursor, setCursor] = useState<Position>({ x: Math.floor(world.size / 2), y: 0, z: Math.floor(world.size / 2) })
  const [night, setNight] = useState(false)
  const [walker, setWalker] = useState<Position | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [mapOpen, setMapOpen] = useState(false)
  const [wool, setWool] = useState(readWool)
  const [sound, toggleSound] = useSoundToggle()
  const [saveFailed, setSaveFailed] = useState(false)
  const found = world.foundCount
  const treasureCount = world.treasures.length
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const settle = useCallback((next: World) => {
    setWalker(previous => previous && settleWalker(next, previous))
  }, [])
  /** せかい・こむぎ・どうぶつを かえて、もどす ための きろくを のこす。 */
  const commit = useCallback((changes: Changes, nextFarm: Farm, effect: CraftSound, message?: string) => {
    if (!changes.length && nextFarm === farm) return
    setHistory(previous => [...previous.slice(-29), { changes, farm }])
    if (changes.length) settle(world)
    setFarm(nextFarm)
    const discovered = world.discovered(changes)
    if (discovered.length) {
      const all = world.foundCount === world.treasures.length
      const treasure = materialDef(discovered[0].material)
      setToast(all ? '🎉 たからを ぜんぶ みつけた！' : `${treasure.emoji} ${treasure.label}を みつけた！`)
      playCraftSound(all ? 'complete' : 'treasure')
      vibrate(all ? 'celebrate' : 'success')
      return
    }
    if (message) setToast(message)
    playCraftSound(effect)
    vibrate(effect === 'baby' ? 'celebrate' : 'tap')
  }, [world, farm, settle])
  const pick = useCallback((position: Position, normal: Position) => {
    setCursor({ ...position, y: 0 })
    const touched = blockAt(world, position)?.material
    if (mode === 'place' && touched === 'sapling') {
      commit(growTree(world, position), farm, 'grow')
      return
    }
    if (mode === 'place' && touched && isCrop(touched)) {
      const { changes, harvested } = tendCrops(world, brushCells(position, normal, wide))
      commit(changes, addWheat(farm, harvested), harvested ? 'harvest' : 'grow', harvested ? `🌾 こむぎが ${harvested}こ とれた！` : undefined)
      return
    }
    if (mode === 'remove' && position.y === 0) return
    const target = mode === 'remove' ? position : { x: position.x + normal.x, y: position.y + normal.y, z: position.z + normal.z }
    const cells = brushCells(target, normal, wide)
    const harvested = mode === 'remove' ? wheatAt(world, cells) : 0
    const changes = editWorld(world, cells, material, mode)
    if (!changes.length) return
    // ようがんが みずに ふれて くろいしに なった
    const cooled = !(mode === 'place' && material === 'obsidian') && netMaterialChange(changes, OBSIDIAN) > 0
    commit(changes, addWheat(farm, harvested), cooled ? 'cool' : harvested ? 'harvest' : mode, cooled ? '⬛ ようがんが かたまった！' : undefined)
  }, [world, farm, material, mode, wide, commit])
  const unlockWool = useCallback((color: WoolColor) => {
    if (wool.includes(color)) return
    const next = [...wool, color]
    setWool(next)
    writeWool(next)
  }, [wool])
  /** ながおしした ブロックと おなじ ざいりょうを えらぶ（スポイト）。 */
  const hold = useCallback((position: Position) => {
    const block = blockAt(world, position)
    if (!block) return
    const picked = pickAs(block.material)
    const color = materialDef(picked).wool
    if (color) unlockWool(color)
    setMaterial(picked)
    setMode('place')
    playCraftSound('select')
    vibrate('tap')
  }, [world, unlockWool])
  /** こわす で ひつじに さわると けいとが とれ、こむぎが あれば えさを あげる。 */
  const touchAnimal = useCallback((animal: Animal, cell: Cell) => {
    if (mode === 'remove') {
      const shorn = shearSheep(farm.herd, animal.id)
      if (shorn) {
        commit([], { ...farm, herd: shorn.herd }, 'shear', `🧶 ${materialDef(woolMaterial(shorn.wool)).label}の けいとが とれた！`)
        unlockWool(shorn.wool)
        return
      }
    }
    const fed = farm.wheat > 0 ? feedAnimal(farm.herd, animal.id, cell) : null
    if (fed) {
      commit([], { wheat: farm.wheat - 1, herd: fed.herd }, fed.result === 'baby' ? 'baby' : 'feed', FEED_MESSAGES[fed.result])
      return
    }
    playCraftSound('pet')
    vibrate('tap')
  }, [farm, mode, commit, unlockWool])
  const { setContainer, failed, api } = useCraftScene({
    world, cursor, night, walker, herd: farm.herd, sky: land.sky, onPick: pick, onHold: hold, onAnimal: touchAnimal,
  })

  const move = (dx: number, dz: number) => {
    const next = { x: Math.max(0, Math.min(world.size - 1, cursor.x + dx)), y: 0, z: Math.max(0, Math.min(world.size - 1, cursor.z + dz)) }
    setCursor(next)
    // ひろい せかいでも カーソルを みうしなわない
    api.current?.focus(next.x, next.z)
  }
  const actAtCursor = () => pick(topBlock(world, cursor.x, cursor.z), { x: 0, y: 1, z: 0 })
  const step = (back: boolean) => {
    if (!walker) return
    const heading = api.current?.heading() ?? { x: 0, z: -1 }
    const next = walk(world, walker, back ? { x: -heading.x, z: -heading.z } : heading)
    if (next === walker) return
    setWalker(next)
    playCraftSound('step')
  }
  const turn = (side: 'left' | 'right') => {
    api.current?.turn(side)
    playCraftSound('select')
  }
  const toggleWalk = () => {
    // あるきおえた ばしょから つづけて つくれる
    if (walker) setCursor({ x: walker.x, y: 0, z: walker.z })
    setWalker(walker ? null : startWalker(world, cursor.x, cursor.z))
    playCraftSound('select')
  }
  /** ちずで タッチした ばしょへ とぶ。 */
  const jump = (event: React.MouseEvent<HTMLButtonElement>) => {
    setMapOpen(false)
    playCraftSound('select')
    // キーボードで おした ときは とじるだけ
    if (!event.detail) return
    const rect = event.currentTarget.querySelector('canvas')?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return
    const cell = (offset: number, length: number) => Math.max(0, Math.min(world.size - 1, Math.floor(offset / length * world.size)))
    const x = cell(event.clientX - rect.left, rect.width), z = cell(event.clientY - rect.top, rect.height)
    setCursor({ x, y: 0, z })
    if (walker) setWalker(startWalker(world, x, z))
    else api.current?.focus(x, z)
    vibrate('tap')
  }
  const forward = useHoldRepeat(() => step(false))
  const backward = useHoldRepeat(() => step(true))
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    if ('world' in previous) {
      setWorld(previous.world)
      settle(previous.world)
    } else {
      undoChanges(world, previous.changes)
      settle(world)
    }
    setFarm(previous.farm)
    setHistory(history.slice(0, -1))
    playCraftSound('select')
  }
  const save = () => {
    const saved = writeGame({ world, biome: land.id, seed: initial.seed, ...farm })
    setSaveFailed(!saved)
    if (!saved) return
    playCraftSound('select')
  }
  const reset = () => {
    const next = newGame(land.id, world, initial.seed)
    setHistory(previous => [...previous.slice(-29), { world, farm }])
    setWorld(next.world)
    settle(next.world)
    setFarm({ wheat: next.wheat, herd: next.herd })
    setResetting(false)
    playCraftSound('select')
    vibrate('tap')
  }
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === ' ') event.preventDefault()
    const act = (event.key === 'Enter' || event.key === ' ') && !event.repeat
    if (walker) {
      if (event.key === 'ArrowUp') step(false)
      if (event.key === 'ArrowDown') step(true)
      if (event.key === 'ArrowLeft') turn('left')
      if (event.key === 'ArrowRight') turn('right')
      if (act) api.current?.actAtCenter(event.shiftKey ? 'hold' : 'pick')
      return
    }
    if (event.key === 'ArrowLeft') move(-1, 0)
    if (event.key === 'ArrowRight') move(1, 0)
    if (event.key === 'ArrowUp') move(0, -1)
    if (event.key === 'ArrowDown') move(0, 1)
    if (act && event.shiftKey) hold(topBlock(world, cursor.x, cursor.z))
    else if (act) actAtCursor()
  }
  const here = walker ?? cursor
  return <div className={styles.game}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} ariaLabel="タイトルへ もどる" />
      <h1>ブロッククラフト</h1>
      <button className={styles.icon} onClick={() => { setNight(value => !value); playCraftSound('select') }} aria-pressed={night} aria-label="よる">{night ? '🌙' : '☀️'}</button>
      <button className={styles.icon} onClick={toggleSound} aria-pressed={sound} aria-label="おと">{sound ? '🔊' : '🔇'}</button>
    </header>
    <GamePlaySurface>
      <div className={styles.stage}>
        <div className={styles.scene} ref={setContainer} role="application" tabIndex={0} onKeyDown={onKeyDown} style={{ background: night ? undefined : land.sky }}
          aria-label={walker
            ? 'ブロックの せかいを あるく。やじるしで すすむ・むきを かえ、Enterで まんなかの ブロックを おく・こわす'
            : 'ブロックの せかい。やじるしで ばしょを えらび、Enterで おく・こわす。Shift＋Enterで その ブロックを えらぶ'} />
        {walker && <span className={styles.crosshair} aria-hidden="true">＋</span>}
        <button className={styles.mapButton} onClick={() => { setMapOpen(true); playCraftSound('select') }} aria-label="ちず" aria-expanded={mapOpen}>
          <CraftMap world={world} at={here} found={found} />
        </button>
        <div className={styles.hud}>
          <span className={styles.treasure} aria-label={`みつけた たから ${found}こ（ぜんぶで ${treasureCount}こ）`}>{found === treasureCount ? '🎉' : '💎'} {found}/{treasureCount}</span>
          <span className={styles.wheat} aria-label={`もっている こむぎ ${farm.wheat}こ`}>🌾 {farm.wheat}</span>
        </div>
        <button className={styles.walkToggle} onClick={toggleWalk} aria-pressed={!!walker} aria-label="あるく">🚶 あるく</button>
        {walker && <div className={styles.walkPad} role="group" aria-label="あるく そうさ">
          <button className={styles.turnLeft} onClick={() => turn('left')} aria-label="ひだりを むく">↶</button>
          <button className={styles.forward} {...forward} aria-label="まえへ すすむ">⬆</button>
          <button className={styles.turnRight} onClick={() => turn('right')} aria-label="みぎを むく">↷</button>
          <button className={styles.backward} {...backward} aria-label="うしろへ さがる">⬇</button>
        </div>}
        {toast && <p className={styles.toast} role="status">{toast}</p>}
        {failed && <p className={styles.notice} role="alert">りったいの ひょうじが できなかったよ。もどって もういちど あそんでね。</p>}
        {saveFailed && <p className={styles.notice} role="alert">ほぞん できなかったよ。まえの ほぞんは そのままだよ。</p>}
        {mapOpen && <div className={styles.mapPanel} role="dialog" aria-label="せかいの ちず">
          <p>🗺️ いきたい ばしょを タッチ！ <span aria-hidden="true">✖</span>は たから</p>
          <button className={styles.mapBig} onClick={jump} aria-label="ちずの ばしょへ いく">
            <CraftMap world={world} at={here} found={found} />
          </button>
          <button onClick={() => { setMapOpen(false); playCraftSound('select') }}>とじる</button>
        </div>}
      </div>
      <div className={styles.tools}>
        <div className={styles.modes}>
          <button aria-pressed={mode === 'place'} onClick={() => { setMode('place'); playCraftSound('select') }}>🧱 おく</button>
          <button aria-pressed={mode === 'remove'} onClick={() => { setMode('remove'); playCraftSound('select') }}>⛏️ こわす</button>
          <button aria-pressed={wide} onClick={() => { setWide(value => !value); playCraftSound('select') }}>🔲 ひろく</button>
          <button disabled={!history.length} onClick={undo}>↩ もどす</button>
        </div>
        <div className={styles.palette} role="group" aria-label="ブロックを えらぶ">
          {PALETTE.map(item => {
            // けいとは ひつじの けを とるまで つかえない
            const locked = 'wool' in item && !wool.includes(item.wool)
            return <button key={item.id} disabled={locked} aria-pressed={material === item.id} aria-label={locked ? 'ひつじの けを とると つかえる' : undefined}
              onClick={() => { setMaterial(item.id); setMode('place'); playCraftSound('select') }}>
              <span className={styles.swatch} style={{ background: locked ? '#e7e3d8' : item.color }} aria-hidden="true">{locked ? '❓' : item.emoji}</span>{locked ? '？' : item.label}
            </button>
          })}
        </div>
        <div className={styles.actions}>
          <button onClick={save}>💾 ほぞん</button>
          <button onClick={() => setResetting(true)}>🌱 はじめの せかい</button>
        </div>
      </div>
    </GamePlaySurface>
    {resetting && <div className={styles.confirm} role="group" aria-label="せかいを もどす かくにん">
      <p>つくったものを けして、はじめの せかいに もどす？</p>
      <button onClick={reset}>もどして あそぶ</button>
      <button onClick={() => setResetting(false)}>やめる</button>
    </div>}
  </div>
}

export default function BlockCraftPlay() {
  const [initial, setInitial] = useState<Game | null>(null)
  const [saved, setSaved] = useState(readGame)
  if (initial) return <Craft initial={initial} onBack={() => { setSaved(readGame()); setInitial(null) }} />
  const begin = (game: Game) => { playCraftSound('select'); setInitial(game) }
  return <div className={styles.title}>
    <header className={styles.header}><GameBackButton to="/" /><h1>ブロッククラフト</h1></header>
    <div className={styles.hero} aria-hidden="true">🌳 🐑 🧱 🌳</div>
    <h2>ひろい せかいを たんけんして つくろう</h2>
    <p>やま・うみ・おしろ・そらの しま…<br />えらぶ たびに あたらしい せかいが できるよ！</p>
    <div className={styles.biomes} role="group" aria-label="あたらしい せかいを えらぶ">
      {BIOMES.map(land => <button key={land.id} className={styles.biome} style={{ background: land.sky }} onClick={() => begin(newGame(land.id))}>
        <span aria-hidden="true">{land.emoji}</span>{land.label}
      </button>)}
    </div>
    {saved && <button className={styles.start} onClick={() => begin(saved)}>💾 つづきから あそぶ</button>}
    <p className={styles.tips}>👆 タッチで ブロックを おく<br />👉 ドラッグで まわりを みる<br />✌️ 2ほんゆびで いどう・ちかづく<br />✋ ながおしで その ブロックを えらぶ<br />🚶 あるいて たんけん（おしっぱなしで すすむ）<br />🗺️ ちずを タッチすると そこへ とべるよ<br />⛏️ ちずの ✖ を ほると たからが あるよ<br />🌿 なえぎ・🌾 たねは タッチで そだつよ<br />🐑 こむぎを あげると どうぶつと なかよしに<br />💾 おわる まえに「ほぞん」を おしてね</p>
  </div>
}
