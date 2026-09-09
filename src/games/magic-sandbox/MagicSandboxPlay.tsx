import { useCallback, useEffect, useRef, useState } from 'react'
import GamePlaySurface from '../../components/GamePlaySurface'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { Cell, type Material } from './sandboxSimulation'
import { useSandbox } from './useSandbox'
import styles from './MagicSandboxPlay.module.css'

const MATERIALS: { id: Material; name: string; icon: string; hint: string }[] = [
  { id: Cell.Sand, name: 'すな', icon: '🏜️', hint: 'さらさら おやまを つくろう' },
  { id: Cell.Water, name: 'みず', icon: '💧', hint: 'すなに かけると しっとり！' },
  { id: Cell.Stone, name: 'いし', icon: '🪨', hint: 'かべを かいて みずを ためよう' },
  { id: Cell.Seed, name: 'たね', icon: '🌱', hint: 'ぬれた すなに まいてみよう' },
  { id: Cell.Empty, name: 'けす', icon: '🧽', hint: 'なぞって けそう。トンネルも つくれるよ' },
]
function ClearDialog({ close, clear }: { close: () => void; clear: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="sandbox-clear-title" onCancel={close}>
    <h2 id="sandbox-clear-title">ぜんぶ けす？</h2><p>あたらしい すなばに なるよ</p>
    <div><button autoFocus onClick={close}>まだ あそぶ</button><button onClick={clear}>けす</button></div>
  </dialog>
}
function Playground({ back }: { back: () => void }) {
  const [material, setMaterial] = useState(MATERIALS[0])
  const [wide, setWide] = useState(false)
  const [paused, setPaused] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [discovery, setDiscovery] = useState(false)
  const [shaking, setShaking] = useState(false)
  const onFlower = useCallback(() => setDiscovery(true), [])
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sandbox = useSandbox(canvasRef, { material: material.id, radius: material.id === Cell.Seed ? 0 : wide ? 6 : 3 }, paused || confirmClear, onFlower)
  useEffect(() => {
    if (!shaking) return
    const timer = window.setTimeout(() => setShaking(false), 450)
    return () => window.clearTimeout(timer)
  }, [shaking])
  useEffect(() => {
    if (!discovery) return
    const timer = window.setTimeout(() => setDiscovery(false), 3500)
    return () => window.clearTimeout(timer)
  }, [discovery])
  return <main className={styles.page}>
    <header className={styles.header}><GameBackButton onBack={back} /><h1>まほうのすなば</h1><span aria-hidden="true">☀️</span></header>
    <div className={styles.workspace}>
      <aside className={styles.tools} aria-label="すなばの どうぐ">
        <div className={styles.materials} role="group" aria-label="そざい">
          {MATERIALS.map(m => <button key={m.id} aria-label={m.name} aria-pressed={m.id === material.id} onClick={() => { sandbox.stop(); setMaterial(m) }}><span aria-hidden="true">{m.icon}</span><b>{m.id === material.id ? '✓ ' : ''}{m.name}</b></button>)}
          <button aria-label={`カニを ふやす（${sandbox.crabCount}/2）`} disabled={sandbox.crabCount >= 2} onClick={sandbox.addCrab}><span aria-hidden="true">🦀</span><b>カニ {sandbox.crabCount}/2</b></button>
        </div>
        <div className={styles.sizes} role="group" aria-label="ふとさ">
          <button aria-pressed={!wide} onClick={() => { sandbox.stop(); setWide(false) }}>● すこし</button>
          <button aria-pressed={wide} onClick={() => { sandbox.stop(); setWide(true) }}>⬤ たっぷり</button>
        </div>
        <p className={styles.toolHint}>{sandbox.crabMessage.startsWith('カニの') ? sandbox.crabMessage : material.hint}</p>
        <span className={styles.crabStatus} role="status">{sandbox.crabMessage}</span>
      </aside>
      <section className={`${styles.board} ${shaking ? styles.shaking : ''}`} aria-label="すなば">
        <div className={styles.cloud} aria-hidden="true">☁</div>
        <canvas ref={canvasRef} {...sandbox.canvasProps} className={styles.canvas} tabIndex={0} aria-label="すなば。なぞって そざいを ふらせよう。キーボードは やじるしで ばしょ、スペースで そざいを おくよ">
          すなと みずと たねを まぜて あそぼう。
        </canvas>
        <div className={styles.notice} role="status">{sandbox.unavailable ? 'すなばを ひらけなかったよ。もういちど ひらいてね' : discovery ? '🌸 おはなが さいたよ！' : paused ? '⏸ とまっているよ。かいても OK！' : ''}</div>
      </section>
      <div className={styles.actions}>
        <button onClick={() => { sandbox.shake(); setShaking(true); setPaused(false) }}>〰 ゆらす</button>
        <button aria-pressed={paused} onClick={() => { sandbox.stop(); setPaused(p => !p) }}>{paused ? '▶ うごかす' : '⏸ とめる'}</button>
        <button onClick={() => { sandbox.stop(); setConfirmClear(true) }}>↺ ぜんぶけす</button>
      </div>
    </div>
    {confirmClear && <ClearDialog close={() => setConfirmClear(false)} clear={() => { sandbox.clear(); setDiscovery(false); setConfirmClear(false) }} />}
  </main>
}
export default function MagicSandboxPlay() {
  const [playing, setPlaying] = useState(false)
  useGameIntroPlaying(playing)
  if (playing) return <GamePlaySurface><Playground back={() => setPlaying(false)} /></GamePlaySurface>
  return <main className={styles.start}>
    <header className={styles.header}><GameBackButton to="/" /></header>
    <div className={styles.intro}>
      <div className={styles.illustration} aria-hidden="true"><span>☀️</span><div>💧<span>🌼 🌱 🌸</span></div><footer>・ . ・ . ・ . ・ . ・ . ・</footer></div>
      <p className={styles.eyebrow}>さらさら、じゃぶじゃぶ、にょきっ！</p>
      <h1>まほうのすなば</h1>
      <p>すなと みずを まぜたら<br />なにが おこるかな？</p>
      <button className={styles.play} onClick={() => setPlaying(true)}>あそぶ！</button>
      <p className={styles.small}>ゆびで なぞるだけ。じゆうに つくろう</p>
    </div>
  </main>
}
