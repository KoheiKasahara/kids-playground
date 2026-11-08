import { useCallback, useEffect, useMemo, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { feedAnimal, herdFrom, shearSheep, type Animal, type Cell, type FeedResult, type Herd } from './animals'
import { biome, BIOMES } from './biomes'
import { MAX_WHEAT, newGame, readGame, readWool, writeGame, writeWool, type Game } from './save'
import {
  blockAt, brushCells, editWorld, foundTreasures, growTree, isCrop, materialDef, PALETTE, pickAs, settleWalker, SIZE,
  startWalker, tendCrops, topBlock, TREASURES, walk, wheatAt, woolMaterial, type Material, type Position, type WoolColor, type World,
} from './world'
import { useCraftScene } from './useCraftScene'
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
const countOf = (world: World, material: Material) => world.reduce((n, b) => n + (b.material === material ? 1 : 0), 0)
const addWheat = (farm: Farm, harvested: number): Farm => harvested ? { ...farm, wheat: Math.min(MAX_WHEAT, farm.wheat + harvested) } : farm

function Craft({ initial, onBack }: { initial: Game; onBack: () => void }) {
  useGameIntroPlaying(true)
  const land = biome(initial.biome)
  const [world, setWorld] = useState(initial.world)
  const [farm, setFarm] = useState<Farm>({ wheat: initial.wheat, herd: initial.herd })
  const [history, setHistory] = useState<{ world: World; farm: Farm }[]>([])
  const [material, setMaterial] = useState<Material>('wood')
  const [mode, setMode] = useState<'place' | 'remove'>('place')
  const [wide, setWide] = useState(false)
  const [cursor, setCursor] = useState<Position>({ x: SIZE / 2, y: 0, z: SIZE / 2 })
  const [night, setNight] = useState(false)
  const [walker, setWalker] = useState<Position | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [wool, setWool] = useState(readWool)
  const [sound, toggleSound] = useSoundToggle()
  const found = useMemo(() => foundTreasures(world).length, [world])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), TOAST_MS)
    return () => clearTimeout(timer)
  }, [toast])

  const show = useCallback((next: World) => {
    setWorld(next)
    setWalker(previous => previous && settleWalker(next, previous))
  }, [])
  /** せかい・こむぎ・どうぶつを かえて、もどす ための きろくを のこす。 */
  const commit = useCallback((next: World, nextFarm: Farm, effect: CraftSound, message?: string) => {
    if (next === world && nextFarm === farm) return
    setHistory(previous => [...previous.slice(-29), { world, farm }])
    if (next !== world) show(next)
    setFarm(nextFarm)
    const before = new Set(foundTreasures(world))
    const discovered = next === world ? [] : foundTreasures(next).filter(t => !before.has(t))
    if (discovered.length) {
      const all = foundTreasures(next).length === TREASURES.length
      const treasure = materialDef(discovered[0].material)
      setToast(all ? '🎉 たからを ぜんぶ みつけた！' : `${treasure.emoji} ${treasure.label}を みつけた！`)
      playCraftSound(all ? 'complete' : 'treasure')
      vibrate(all ? 'celebrate' : 'success')
      return
    }
    if (message) setToast(message)
    playCraftSound(effect)
    vibrate(effect === 'baby' ? 'celebrate' : 'tap')
  }, [world, farm, show])
  const pick = useCallback((position: Position, normal: Position) => {
    setCursor({ ...position, y: 0 })
    const touched = blockAt(world, position)?.material
    if (mode === 'place' && touched === 'sapling') {
      commit(growTree(world, position), farm, 'grow')
      return
    }
    if (mode === 'place' && touched && isCrop(touched)) {
      const { world: next, harvested } = tendCrops(world, brushCells(position, normal, wide))
      commit(next, addWheat(farm, harvested), harvested ? 'harvest' : 'grow', harvested ? `🌾 こむぎが ${harvested}こ とれた！` : undefined)
      return
    }
    if (mode === 'remove' && position.y === 0) return
    const target = mode === 'remove' ? position : { x: position.x + normal.x, y: position.y + normal.y, z: position.z + normal.z }
    const cells = brushCells(target, normal, wide)
    const next = editWorld(world, cells, material, mode)
    if (next === world) return
    const harvested = mode === 'remove' ? wheatAt(world, cells) : 0
    // ようがんが みずに ふれて くろいしに なった
    const cooled = !(mode === 'place' && material === 'obsidian') && countOf(next, 'obsidian') > countOf(world, 'obsidian')
    commit(next, addWheat(farm, harvested), cooled ? 'cool' : harvested ? 'harvest' : mode, cooled ? '⬛ ようがんが かたまった！' : undefined)
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
        commit(world, { ...farm, herd: shorn.herd }, 'shear', `🧶 ${materialDef(woolMaterial(shorn.wool)).label}の けいとが とれた！`)
        unlockWool(shorn.wool)
        return
      }
    }
    const fed = farm.wheat > 0 ? feedAnimal(farm.herd, animal.id, cell) : null
    if (fed) {
      commit(world, { wheat: farm.wheat - 1, herd: fed.herd }, fed.result === 'baby' ? 'baby' : 'feed', FEED_MESSAGES[fed.result])
      return
    }
    playCraftSound('pet')
    vibrate('tap')
  }, [world, farm, mode, commit, unlockWool])
  const { setContainer, failed, api } = useCraftScene({
    world, cursor, night, walker, herd: farm.herd, sky: land.sky, onPick: pick, onHold: hold, onAnimal: touchAnimal,
  })

  const move = (dx: number, dz: number) => setCursor(previous => ({ x: Math.max(0, Math.min(SIZE - 1, previous.x + dx)), y: 0, z: Math.max(0, Math.min(SIZE - 1, previous.z + dz)) }))
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
    setWalker(walker ? null : startWalker(world, cursor.x, cursor.z))
    playCraftSound('select')
  }
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    show(previous.world)
    setFarm(previous.farm)
    setHistory(history.slice(0, -1))
    playCraftSound('select')
  }
  const save = () => {
    writeGame({ world, biome: land.id, ...farm })
    playCraftSound('select')
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
        <button className={styles.walkToggle} onClick={toggleWalk} aria-pressed={!!walker} aria-label="あるく">🚶 あるく</button>
        {toast && <p className={styles.toast} role="status">{toast}</p>}
      </div>
      {failed && <p role="alert">りったいの ひょうじが できなかったよ。もどって もういちど あそんでね。</p>}
      {walker && <div className={styles.walkPad} aria-label="あるく そうさ">
        <button onClick={() => turn('left')} aria-label="ひだりを むく">↶</button>
        <button onClick={() => step(false)} aria-label="まえへ すすむ">⬆</button>
        <button onClick={() => step(true)} aria-label="うしろへ さがる">⬇</button>
        <button onClick={() => turn('right')} aria-label="みぎを むく">↷</button>
      </div>}
      <div className={styles.modes}>
        <button aria-pressed={mode === 'place'} onClick={() => { setMode('place'); playCraftSound('select') }}>🧱 おく</button>
        <button aria-pressed={mode === 'remove'} onClick={() => { setMode('remove'); playCraftSound('select') }}>⛏️ こわす</button>
        <button aria-pressed={wide} onClick={() => { setWide(value => !value); playCraftSound('select') }}>🔲 ひろく</button>
        <button disabled={!history.length} onClick={undo}>↩ もどす</button>
      </div>
      <div className={styles.palette} aria-label="ブロックを えらぶ">
        {PALETTE.map(item => {
          // けいとは ひつじの けを とるまで つかえない
          const locked = 'wool' in item && !wool.includes(item.wool)
          return <button key={item.id} disabled={locked} aria-pressed={material === item.id} aria-label={locked ? 'ひつじの けを とると つかえる' : undefined}
            onClick={() => { setMaterial(item.id); setMode('place'); playCraftSound('select') }}>
            <span className={styles.swatch} style={{ background: locked ? '#e7e3d8' : item.color }} aria-hidden="true">{locked ? '❓' : item.emoji}</span>{locked ? '？' : item.label}
          </button>
        })}
      </div>
    </GamePlaySurface>
    <footer className={styles.actions}>
      <button onClick={save}>💾 ほぞん</button>
      <button onClick={() => setResetting(true)}>🌱 はじめの せかい</button>
      <span className={styles.treasure} aria-label={`みつけた たから ${found}こ（ぜんぶで ${TREASURES.length}こ）`}>{found === TREASURES.length ? '🎉' : '💎'} {found}/{TREASURES.length}</span>
      <span className={styles.wheat} aria-label={`もっている こむぎ ${farm.wheat}こ`}>🌾 {farm.wheat}</span>
    </footer>
    <p className={styles.hint}>
      🌿なえぎ・🌾たねは タッチで そだつよ。🌾こむぎを どうぶつに あげてね。<br />
      ⛏️こわす で ひつじに さわると けいとが とれるよ。おわる まえに「ほぞん」を おしてね。
    </p>
    {resetting && <div className={styles.confirm} role="group" aria-label="せかいを もどす かくにん">
      <p>つくったものを けして、はじめの せかいに もどす？</p>
      <button onClick={() => { commit(land.create(), { wheat: 0, herd: herdFrom(land.spawns) }, 'select'); setResetting(false) }}>もどして あそぶ</button>
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
    <h2>じぶんだけの せかいを つくろう</h2>
    <p>おく・こわす・つみあげる。<br />じかんを きにせず、じゆうに あそぼう！</p>
    <div className={styles.biomes} role="group" aria-label="あたらしい せかいを えらぶ">
      {BIOMES.map(land => <button key={land.id} className={styles.biome} style={{ background: land.sky }} onClick={() => begin(newGame(land.id))}>
        <span aria-hidden="true">{land.emoji}</span>{land.label}
      </button>)}
    </div>
    {saved && <button className={styles.start} onClick={() => begin(saved)}>💾 つづきから あそぶ</button>}
    <p>👆 タッチで ブロックを おく<br />👉 ドラッグで まわりを みる<br />✌️ 2ほんゆびで いどう・ちかづく<br />✋ ながおしで その ブロックを えらぶ<br />🚶 あるいて たんけんも できるよ<br />⛏️ じめんを ほると たからが あるかも？<br />🐑 こむぎを あげると どうぶつと なかよしに</p>
  </div>
}
