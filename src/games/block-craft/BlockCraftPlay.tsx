import { useCallback, useEffect, useMemo, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import {
  blockAt, brushCells, createWorld, decodeWorld, editWorld, foundTreasures, growTree, materialDef, MATERIALS, SAVE_KEY, settleWalker, SIZE,
  startWalker, topBlock, TREASURES, walk, type Material, type Position, type World,
} from './world'
import { useCraftScene } from './useCraftScene'
import { playCraftSound, type CraftSound } from './sounds'
import styles from './BlockCraftPlay.module.css'

function readSaved(): World | null {
  try { return decodeWorld(localStorage.getItem(SAVE_KEY)) } catch { return null }
}
/** たからを みつけた おしらせを だす じかん [ms]。 */
const TOAST_MS = 2400

function Craft({ initial, onBack }: { initial: World; onBack: () => void }) {
  useGameIntroPlaying(true)
  const [world, setWorld] = useState(initial)
  const [history, setHistory] = useState<World[]>([])
  const [material, setMaterial] = useState<Material>('wood')
  const [mode, setMode] = useState<'place' | 'remove'>('place')
  const [wide, setWide] = useState(false)
  const [cursor, setCursor] = useState<Position>({ x: SIZE / 2, y: 0, z: SIZE / 2 })
  const [night, setNight] = useState(false)
  const [walker, setWalker] = useState<Position | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
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
  const change = useCallback((next: World, effect: CraftSound = mode) => {
    if (next === world) return
    setHistory(previous => [...previous.slice(-29), world])
    show(next)
    const before = new Set(foundTreasures(world))
    const discovered = foundTreasures(next).filter(t => !before.has(t))
    if (!discovered.length) {
      playCraftSound(effect)
      vibrate('tap')
      return
    }
    const all = foundTreasures(next).length === TREASURES.length
    const treasure = materialDef(discovered[0].material)
    setToast(all ? '🎉 たからを ぜんぶ みつけた！' : `${treasure.emoji} ${treasure.label}を みつけた！`)
    playCraftSound(all ? 'complete' : 'treasure')
    vibrate(all ? 'celebrate' : 'success')
  }, [world, mode, show])
  const pick = useCallback((position: Position, normal: Position) => {
    setCursor({ ...position, y: 0 })
    if (mode === 'place' && blockAt(world, position)?.material === 'sapling') {
      change(growTree(world, position), 'grow')
      return
    }
    if (mode === 'remove' && position.y === 0) return
    const target = mode === 'remove' ? position : { x: position.x + normal.x, y: position.y + normal.y, z: position.z + normal.z }
    change(editWorld(world, brushCells(target, normal, wide), material, mode))
  }, [world, material, mode, wide, change])
  /** ながおしした ブロックと おなじ ざいりょうを えらぶ（スポイト）。 */
  const hold = useCallback((position: Position) => {
    const block = blockAt(world, position)
    if (!block) return
    setMaterial(block.material)
    setMode('place')
    playCraftSound('select')
    vibrate('tap')
  }, [world])
  const pet = useCallback(() => { playCraftSound('pet'); vibrate('tap') }, [])
  const { setContainer, failed, api } = useCraftScene({ world, cursor, night, walker, onPick: pick, onHold: hold, onPet: pet })

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
    show(previous)
    setHistory(history.slice(0, -1))
    playCraftSound('select')
  }
  const save = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(world)) }
    catch { /* ほぞんできなくても このまま あそべる */ }
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
        <div className={styles.scene} ref={setContainer} role="application" tabIndex={0} onKeyDown={onKeyDown}
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
        {MATERIALS.map(item => <button key={item.id} aria-pressed={material === item.id} onClick={() => { setMaterial(item.id); setMode('place'); playCraftSound('select') }}>
          <span className={styles.swatch} style={{ background: item.color }} aria-hidden="true">{item.emoji}</span>{item.label}
        </button>)}
      </div>
    </GamePlaySurface>
    <footer className={styles.actions}>
      <button onClick={save}>💾 ほぞん</button>
      <button onClick={() => setResetting(true)}>🌱 はじめの せかい</button>
      <span className={styles.treasure} aria-label={`みつけた たから ${found}こ（ぜんぶで ${TREASURES.length}こ）`}>{found === TREASURES.length ? '🎉' : '💎'} {found}/{TREASURES.length}</span>
    </footer>
    <p className={styles.hint}>🌿なえぎを タッチすると きが そだつよ。ながおしで その ブロックを えらべるよ。<br />おわる まえに「ほぞん」を おしてね。</p>
    {resetting && <div className={styles.confirm} role="group" aria-label="せかいを もどす かくにん">
      <p>つくったものを けして、はじめの せかいに もどす？</p>
      <button onClick={() => { change(createWorld()); setResetting(false) }}>もどして あそぶ</button>
      <button onClick={() => setResetting(false)}>やめる</button>
    </div>}
  </div>
}

export default function BlockCraftPlay() {
  const [initial, setInitial] = useState<World | null>(null)
  const [saved, setSaved] = useState(readSaved)
  if (initial) return <Craft initial={initial} onBack={() => { setSaved(readSaved()); setInitial(null) }} />
  return <div className={styles.title}>
    <header className={styles.header}><GameBackButton to="/" /><h1>ブロッククラフト</h1></header>
    <div className={styles.hero} aria-hidden="true">🌳 🐑 🧱 🌳</div>
    <h2>じぶんだけの せかいを つくろう</h2>
    <p>おく・こわす・つみあげる。<br />じかんを きにせず、じゆうに あそぼう！</p>
    <button className={styles.start} onClick={() => { playCraftSound('select'); setInitial(createWorld()) }}>🌱 はじめから あそぶ</button>
    {saved && <button className={styles.start} onClick={() => { playCraftSound('select'); setInitial(saved) }}>💾 つづきから あそぶ</button>}
    <p>👆 タッチで ブロックを おく<br />👉 ドラッグで まわりを みる<br />✌️ 2ほんゆびで いどう・ちかづく<br />✋ ながおしで その ブロックを えらぶ<br />🚶 あるいて たんけんも できるよ<br />⛏️ じめんを ほると たからが あるかも？</p>
  </div>
}
