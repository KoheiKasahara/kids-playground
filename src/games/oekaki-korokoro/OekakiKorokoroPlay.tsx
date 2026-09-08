import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import { PAPERS, PATTERNS, PAPER_WIDTH, ROLLER_COLORS, ROLLER_PAPER_HEIGHT, STAMP_SCALE, type Pattern } from './rollerData'
import { advanceStroke, finishStroke, startStroke, type StrokeCursor } from './rollerStroke'
import { drawPaper, drawStamps } from './rollerDrawing'
import styles from './OekakiKorokoroPlay.module.css'

function Motif({ pattern }: { pattern: Pattern }) {
  return <svg viewBox="-30 -30 60 60" aria-hidden="true"><path d={pattern.path} fill="currentColor" /><path d={pattern.detail} fill="#ffffff99" /></svg>
}

function Dialog({ children, title, close }: { children: ReactNode; title: string; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { ref.current?.showModal() }, [])
  return <dialog ref={ref} className={styles.dialog} aria-label={title} onCancel={close}>
    <h2>{title}</h2>{children}
  </dialog>
}

export default function OekakiKorokoroPlay() {
  const [pattern, setPattern] = useState<Pattern>(PATTERNS[0])
  const [color, setColor] = useState<string>(ROLLER_COLORS[0].value)
  const [paper, setPaper] = useState(PAPERS[0] as typeof PAPERS[number])
  const [hasInk, setHasInk] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [modal, setModal] = useState<'clear' | 'done' | null>(null)
  const [error, setError] = useState('')
  const ink = useRef<HTMLCanvasElement>(null)
  const background = useRef<HTMLCanvasElement>(null)
  const previous = useRef<HTMLCanvasElement | null>(null)
  const previousHasInk = useRef(false)
  const roller = useRef<HTMLDivElement>(null)
  const active = useRef<{ pointerId: number; cursor: StrokeCursor; pattern: Pattern; color: string } | null>(null)

  useEffect(() => {
    const ctx = background.current?.getContext('2d')
    if (ctx) drawPaper(ctx, paper)
  }, [paper])

  function endStroke() {
    const stroke = active.current
    const canvas = ink.current
    if (!stroke || !canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) drawStamps(ctx, finishStroke(stroke.cursor), stroke.pattern, stroke.color)
    active.current = null
    if (canvas.hasPointerCapture(stroke.pointerId)) canvas.releasePointerCapture(stroke.pointerId)
    if (roller.current) roller.current.style.opacity = '0'
  }

  useEffect(() => {
    // End the gesture before its client-to-paper transform changes on rotation.
    const stop = () => endStroke()
    window.addEventListener('resize', stop)
    window.addEventListener('blur', stop)
    return () => { window.removeEventListener('resize', stop); window.removeEventListener('blur', stop) }
  }, [])

  function point(event: { clientX: number; clientY: number }) {
    const box = ink.current!.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(PAPER_WIDTH, (event.clientX - box.left) * PAPER_WIDTH / box.width)),
      y: Math.max(0, Math.min(ROLLER_PAPER_HEIGHT, (event.clientY - box.top) * ROLLER_PAPER_HEIGHT / box.height)),
    }
  }

  function showRoller(x: number, y: number, angle: number) {
    if (!roller.current) return
    roller.current.style.left = `${x / PAPER_WIDTH * 100}%`
    roller.current.style.top = `${y / ROLLER_PAPER_HEIGHT * 100}%`
    roller.current.style.transform = `translate(-50%, -90%) rotate(${angle + Math.PI / 2}rad)`
    roller.current.style.opacity = '1'
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (active.current || event.button !== 0 || !event.isPrimary) return
    event.preventDefault()
    const canvas = ink.current!
    if (!canvas.getContext('2d')) { setError('おえかきが ひらけなかったよ。もういちど ひらいてね'); return }
    previous.current ??= document.createElement('canvas')
    previous.current.width = PAPER_WIDTH
    previous.current.height = ROLLER_PAPER_HEIGHT
    previous.current.getContext('2d')?.drawImage(canvas, 0, 0)
    previousHasInk.current = hasInk
    const p = point(event)
    active.current = { pointerId: event.pointerId, cursor: startStroke(p), pattern, color }
    canvas.setPointerCapture(event.pointerId)
    setHasInk(true)
    setCanUndo(true)
    setError('')
    showRoller(p.x, p.y, -Math.PI / 2)
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    const stroke = active.current
    if (!stroke || stroke.pointerId !== event.pointerId) return
    event.preventDefault()
    const ctx = ink.current!.getContext('2d')!
    const coalesced = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const sample of coalesced.length ? coalesced : [event]) {
      const p = point(sample)
      const angle = Math.atan2(p.y - stroke.cursor.point.y, p.x - stroke.cursor.point.x)
      drawStamps(ctx, advanceStroke(stroke.cursor, p, stroke.pattern.spacing * STAMP_SCALE), stroke.pattern, stroke.color)
      showRoller(p.x, p.y, angle)
    }
  }

  function finish(event: PointerEvent<HTMLCanvasElement>, includeEndpoint: boolean) {
    if (active.current?.pointerId !== event.pointerId) return
    if (includeEndpoint) move(event)
    endStroke()
  }

  function undo() {
    endStroke()
    const ctx = ink.current?.getContext('2d')
    if (!ctx || !previous.current) return
    ctx.clearRect(0, 0, PAPER_WIDTH, ROLLER_PAPER_HEIGHT)
    ctx.drawImage(previous.current, 0, 0)
    setHasInk(previousHasInk.current)
    setCanUndo(false)
  }

  function clear() {
    endStroke()
    // A confirmed clear can also be undone once.
    const canvas = ink.current!
    previous.current ??= document.createElement('canvas')
    previous.current.width = PAPER_WIDTH
    previous.current.height = ROLLER_PAPER_HEIGHT
    previous.current.getContext('2d')?.drawImage(canvas, 0, 0)
    previousHasInk.current = hasInk
    canvas.getContext('2d')?.clearRect(0, 0, PAPER_WIDTH, ROLLER_PAPER_HEIGHT)
    setHasInk(false)
    setCanUndo(true)
    setModal(null)
  }

  function celebrate() {
    endStroke()
    setModal('done')
    setError('')
  }

  return <main className={styles.page} style={{ '--ink': color } as CSSProperties}>
    <header className={styles.header}>
      <h1>おえかきコロコロ</h1>
      <span className={styles.badge} aria-hidden="true">じゆうに あそぼう</span>
    </header>
    <div className={`${styles.workspace} ${styles.rollerWorkspace}`}>
      <section className={styles.studio} aria-label="おえかき">
        <div className={styles.caption}>
          <span>ゆびで なぞって コロコロ！</span>
          <span className={styles.current} aria-label={`いまのローラー: ${pattern.name}・${ROLLER_COLORS.find(c => c.value === color)?.name}`}><Motif pattern={pattern} />{pattern.name}</span>
        </div>
        <div className={styles.mat}>
          <div className={`${styles.paper} ${styles.rollerPaper}`}>
            <canvas ref={background} width={PAPER_WIDTH} height={ROLLER_PAPER_HEIGHT} className={styles.background} aria-hidden="true" />
            <canvas ref={ink} width={PAPER_WIDTH} height={ROLLER_PAPER_HEIGHT} className={styles.canvas} aria-label="おえかきの かみ。ゆびや マウスで なぞってね"
              onPointerDown={begin} onPointerMove={move} onPointerUp={e => finish(e, true)} onPointerCancel={e => finish(e, false)} onLostPointerCapture={e => finish(e, false)}>
              ゆびや マウスで なぞると もようが えがけるよ。
            </canvas>
            {!hasInk && <div className={styles.hint} aria-hidden="true"><span>☝</span><div className={styles.trail}>{[0, 1, 2, 3].map(n => <Motif key={n} pattern={pattern} />)}</div><b>ここを コロコロ</b></div>}
            <div ref={roller} className={styles.roller} aria-hidden="true"><div className={styles.rollerHead}><Motif pattern={pattern} /><Motif pattern={pattern} /></div><div className={styles.handle} /></div>
          </div>
        </div>
        <div className={styles.paperPicker} role="group" aria-label="かみを えらぶ">
          <span>かみ</span>{PAPERS.map(p => <button key={p.id} aria-label={p.name} aria-pressed={paper.id === p.id} onClick={() => { endStroke(); setPaper(p) }}><span style={{ background: p.color, color: p.id === 'night' ? '#fff' : '#517461' }}>{p.icon}</span><small>{p.name}</small></button>)}
        </div>
      </section>
      <aside className={styles.tools} aria-label="おえかきの どうぐ">
        <div className={styles.toolGroup} role="group" aria-label="もようを えらぶ">
          <h2>もよう</h2><span className={styles.scrollHint} aria-hidden="true">↔ よこに うごくよ</span>
          <div className={styles.scrollWindow}><div className={styles.patterns} data-testid="pattern-picker">{PATTERNS.map(p => <button key={p.id} aria-label={p.name} aria-pressed={pattern.id === p.id} onClick={() => { endStroke(); setPattern(p) }}><Motif pattern={p} /><small>{p.name}</small></button>)}</div></div>
        </div>
        <div className={styles.toolGroup} role="group" aria-label="いろを えらぶ">
          <h2>いろ</h2><span className={styles.scrollHint} aria-hidden="true">↔ よこに うごくよ</span>
          <div className={styles.scrollWindow}><div className={styles.colors} data-testid="color-picker">{ROLLER_COLORS.map(c => <button key={c.value} aria-label={c.name} aria-pressed={color === c.value} style={{ '--swatch': c.value } as CSSProperties} onClick={() => { endStroke(); setColor(c.value) }}><span>{color === c.value ? '✓' : ''}</span></button>)}</div></div>
        </div>
        <div className={styles.actions}>
          <button disabled={!canUndo} onClick={undo}><span aria-hidden="true">↶</span>1かい もどす</button>
          <button disabled={!hasInk} onClick={() => { endStroke(); setModal('clear') }}><span aria-hidden="true">▱</span>ぜんぶ けす</button>
          <button className={styles.save} onClick={celebrate}><span aria-hidden="true">★</span>できた！</button>
        </div>
      </aside>
    </div>
    {error && <p className={styles.error} role="alert">{error}</p>}
    {modal === 'clear' && <Dialog title="ぜんぶ けしても いい？" close={() => setModal(null)}><p>あたらしい えを かこう</p><div className={styles.dialogActions}><button autoFocus onClick={() => setModal(null)}>まだ かく</button><button onClick={clear}>けす</button></div></Dialog>}
    {modal === 'done' && <Dialog title="できた！" close={() => setModal(null)}><div className={styles.celebration} aria-hidden="true">✦ 🌸 ★ 🌈 ✦</div><p>すてきな えに なったね！</p><div className={styles.dialogActions}><button autoFocus onClick={() => setModal(null)}>もっと かく</button></div></Dialog>}
  </main>
}
