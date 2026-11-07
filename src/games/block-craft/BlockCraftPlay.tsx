import { useCallback, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { createWorld, decodeWorld, editWorld, MATERIALS, SAVE_KEY, SIZE, topBlock, type Material, type Position, type World } from './world'
import { useCraftScene } from './useCraftScene'
import { playCraftSound } from './sounds'
import styles from './BlockCraftPlay.module.css'

function readSaved(): World | null {
  try { return decodeWorld(localStorage.getItem(SAVE_KEY)) } catch { return null }
}

function Craft({ initial, onBack }: { initial: World; onBack: () => void }) {
  useGameIntroPlaying(true)
  const [world, setWorld] = useState(initial)
  const [history, setHistory] = useState<World[]>([])
  const [material, setMaterial] = useState<Material>('wood')
  const [mode, setMode] = useState<'place' | 'remove'>('place')
  const [cursor, setCursor] = useState<Position>({ x: SIZE / 2, y: 0, z: SIZE / 2 })
  const [night, setNight] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [sound, toggleSound] = useSoundToggle()
  const change = useCallback((next: World) => {
    if (next === world) return
    setHistory(previous => [...previous.slice(-29), world])
    setWorld(next)
    playCraftSound(mode)
    vibrate('tap')
  }, [world, mode])
  const pick = useCallback((position: Position, normal: Position) => {
    setCursor({ ...position, y: 0 })
    const target = mode === 'remove' ? position : { x: position.x + normal.x, y: position.y + normal.y, z: position.z + normal.z }
    if (mode === 'remove' && position.y === 0) return
    change(editWorld(world, target, material, mode))
  }, [world, material, mode, change])
  const { setContainer, failed } = useCraftScene(world, cursor, pick, night)
  const move = (dx: number, dz: number) => setCursor(previous => ({ x: Math.max(0, Math.min(SIZE - 1, previous.x + dx)), y: 0, z: Math.max(0, Math.min(SIZE - 1, previous.z + dz)) }))
  const actAtCursor = () => pick(topBlock(world, cursor.x, cursor.z), { x: 0, y: 1, z: 0 })
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setWorld(previous)
    setHistory(history.slice(0, -1))
    playCraftSound('select')
  }
  const save = () => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(world)) }
    catch { /* ほぞんできなくても このまま あそべる */ }
    playCraftSound('select')
  }
  return <div className={styles.game}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} ariaLabel="タイトルへ もどる" />
      <h1>ブロッククラフト</h1>
      <button className={styles.icon} onClick={() => { setNight(value => !value); playCraftSound('select') }} aria-pressed={night} aria-label="よる">{night ? '🌙' : '☀️'}</button>
      <button className={styles.icon} onClick={toggleSound} aria-pressed={sound} aria-label="おと">{sound ? '🔊' : '🔇'}</button>
    </header>
    <GamePlaySurface>
      <div className={styles.scene} ref={setContainer} role="application" aria-label="ブロックの せかい。やじるしで ばしょを えらび、Enterで おく・こわす" tabIndex={0}
        onKeyDown={event => {
          if (event.key.startsWith('Arrow') || event.key === 'Enter' || event.key === ' ') event.preventDefault()
          if (event.key === 'ArrowLeft') move(-1, 0)
          if (event.key === 'ArrowRight') move(1, 0)
          if (event.key === 'ArrowUp') move(0, -1)
          if (event.key === 'ArrowDown') move(0, 1)
          if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) actAtCursor()
        }} />
      {failed && <p role="alert">りったいの ひょうじが できなかったよ。もどって もういちど あそんでね。</p>}
      <div className={styles.modes}>
        <button aria-pressed={mode === 'place'} onClick={() => { setMode('place'); playCraftSound('select') }}>🧱 おく</button>
        <button aria-pressed={mode === 'remove'} onClick={() => { setMode('remove'); playCraftSound('select') }}>⛏️ こわす</button>
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
    </footer>
    <p className={styles.hint}>ざいりょうは つかいほうだい。おうちや おしろを つくろう！<br />おわる まえに「ほぞん」を おしてね。</p>
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
    <div className={styles.hero} aria-hidden="true">🌳 🧱 🌳</div>
    <h2>じぶんだけの せかいを つくろう</h2>
    <p>おく・こわす・つみあげる。<br />じかんを きにせず、じゆうに あそぼう！</p>
    <button className={styles.start} onClick={() => { playCraftSound('select'); setInitial(createWorld()) }}>🌱 はじめから あそぶ</button>
    {saved && <button className={styles.start} onClick={() => { playCraftSound('select'); setInitial(saved) }}>💾 つづきから あそぶ</button>}
    <p>👆 タッチで ブロックを おく<br />👉 ドラッグで まわりを みる<br />✌️ 2ほんゆびで いどう・ちかづく<br />⛏️ じめんを ほると たからが あるかも？</p>
  </div>
}
