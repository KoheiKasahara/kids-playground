import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { observeGameActivity } from '../../utils/gameActivity'
import { columnAt, COLUMNS, GOAL, landingRow, ROWS, type Jelly } from './jellyGame'
import { useJellyGame } from './useJellyGame'
import styles from './JellyMergePlay.module.css'

function JellyFace({ tier }: { tier: number }) {
  return <span className={styles.jelly} data-tier={tier} aria-hidden="true">
    <span className={styles.shine} /><span className={styles.eyes} /><span className={styles.mouth} />
    <span className={styles.cheeks} /><span className={styles.number}>{tier}</span>
    {tier === GOAL && <span className={styles.crown}>✦</span>}
  </span>
}

const position = (piece: Pick<Jelly, 'col' | 'row'>): CSSProperties => ({
  '--col': piece.col, '--row': ROWS - 1 - piece.row,
} as CSSProperties)

export default function JellyMergePlay() {
  const { game, frame, busy, canUndo, drop, undo, restart } = useJellyGame()
  const [sound, toggleSound] = useSoundToggle()
  const [started, setStarted] = useState(false)
  const [aim, setAim] = useState(2)
  const [preview, setPreview] = useState(false)
  const [inside, setInside] = useState(true)
  const boardRef = useRef<HTMLDivElement>(null)
  const laneRefs = useRef<(HTMLButtonElement | null)[]>([])
  const pointer = useRef<number | null>(null)
  const helpRef = useRef<HTMLDialogElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const pieces = frame?.pieces ?? game.pieces
  const row = landingRow(game.pieces, aim)
  const available = game.status === 'playing' && !busy
  const chain = frame?.chain ?? 0
  useGameIntroPlaying(started)

  useEffect(() => {
    function cancel() {
      pointer.current = null
      setPreview(false)
    }
    const stop = observeGameActivity((active) => { if (!active) cancel() })
    window.addEventListener('resize', cancel)
    return () => { stop(); window.removeEventListener('resize', cancel) }
  }, [])
  useEffect(() => {
    if (game.status !== 'playing') replayRef.current?.focus({ preventScroll: true })
  }, [game.status])

  function aimAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const within = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom
    const col = columnAt(event.clientX, rect.left, rect.width)
    setAim(col)
    setInside(within)
    return { col, within }
  }
  function releaseCapture(element: HTMLDivElement, id: number) {
    if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id)
  }
  function cancelPointer() {
    pointer.current = null
    setPreview(false)
  }
  function release(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return
    const { col, within } = aimAt(event)
    cancelPointer()
    releaseCapture(event.currentTarget, event.pointerId)
    if (within && available) { primeAudio(); drop(col) }
  }
  function retry() {
    primeAudio()
    restart()
    setPreview(false)
    laneRefs.current[aim]?.focus({ preventScroll: true })
  }
  function goBackOne() {
    undo()
    laneRefs.current[aim]?.focus({ preventScroll: true })
  }
  const status = game.status === 'won' ? 'にじゼリー できた！'
    : game.status === 'full' ? 'いっぱいに なっちゃった'
      : chain > 1 ? `${chain} れんさ！` : chain === 1 ? 'がったい！'
        : game.turn === 0 ? 'さわって、はなして ポン' : ''

  return <GamePlaySurface><div className={styles.page}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1><small>ぽんぽん</small> ゼリーがったい！</h1>
      <button className={styles.iconButton} type="button" onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
        <span aria-hidden="true">{sound ? '♪' : '×♪'}</span>
      </button>
    </header>
    <main className={styles.arena}>
      <div className={styles.hud}>
        <div className={styles.score} aria-label={`てんすう ${frame?.score ?? game.score}`}><span aria-hidden="true">✦</span> <strong>{frame?.score ?? game.score}</strong></div>
        <div className={styles.next} aria-label={`つぎは ${game.next.join('、')}`}><small>つぎ</small>{game.next.map((tier, i) => <span key={i} className={styles.mini}><JellyFace tier={tier} /></span>)}</div>
        <div className={styles.tools}>
          <button className={styles.iconButton} type="button" onClick={goBackOne} disabled={!canUndo || busy} aria-label="ひとつ もどす">↶</button>
          <button className={styles.iconButton} type="button" aria-label="あそびかた" onClick={() => {
            cancelPointer()
            returnFocus.current = document.activeElement as HTMLElement
            helpRef.current?.showModal()
          }}>?</button>
        </div>
      </div>
      <div className={styles.field} ref={boardRef} data-testid="jelly-board" data-busy={busy} data-turn={game.turn}
        onPointerDown={(event) => {
          if (!available || event.button !== 0 || event.isPrimary === false || pointer.current !== null) return
          primeAudio()
          setStarted(true)
          event.preventDefault()
          pointer.current = event.pointerId
          event.currentTarget.setPointerCapture?.(event.pointerId)
          aimAt(event)
          setPreview(true)
        }}
        onPointerMove={(event) => { if (pointer.current === event.pointerId) aimAt(event) }}
        onPointerUp={release}
        onPointerCancel={(event) => { if (pointer.current === event.pointerId) cancelPointer() }}
        onLostPointerCapture={(event) => { if (pointer.current === event.pointerId) cancelPointer() }}
      >
        <div className={styles.limit} aria-hidden="true"><span>!</span></div>
        {available && <>
          <div className={`${styles.guide} ${preview && inside ? styles.guideActive : ''}`} style={{ '--col': aim } as CSSProperties} aria-hidden="true" />
          <div className={`${styles.incoming} ${preview && !inside ? styles.canceled : ''}`} style={position({ col: aim, row: ROWS - 1 })}><JellyFace tier={game.current} /><span className={styles.arrow} aria-hidden="true">↓</span></div>
          {preview && inside && row < ROWS - 1 && <div className={styles.ghost} style={position({ col: aim, row })} data-testid="jelly-preview"><JellyFace tier={game.current} /></div>}
        </>}
        {pieces.map((piece) => {
          const affected = frame?.affected.includes(piece.id)
          const motion = affected ? frame?.kind : undefined
          return <div key={piece.id} className={styles.piece} style={position(piece)} data-motion={motion} data-tier={piece.tier} data-testid="jelly-piece">
            <div className={styles.squish} key={`${piece.tier}-${motion ?? ''}`}><JellyFace tier={piece.tier} /></div>
          </div>
        })}
        {frame?.kind === 'merge' && <div className={styles.burst} key={`${game.turn}-${chain}`} style={position(frame.focus)} aria-hidden="true">
          <span className={styles.ring} />{Array.from({ length: 8 }, (_, i) => <i key={i} style={{ '--angle': `${i * 45}deg` } as CSSProperties} />)}
          <b>+{2 ** (frame.focus.tier - 1) * 10 * chain}</b>
        </div>}
        {game.turn === 0 && !busy && !preview && <div className={styles.gesture} aria-hidden="true"><span>☝</span><i>↔</i></div>}
        <div className={styles.lanes} role="group" aria-label="ゼリーを おとす ばしょ" aria-busy={busy}>
          {Array.from({ length: COLUMNS }, (_, col) => <button key={col} ref={(el) => { laneRefs.current[col] = el }}
            type="button" aria-label={`${col + 1}れつめ、${game.pieces.filter((p) => p.col === col).map((p) => p.tier).join('、') || 'からっぽ'}。${game.current}を おとす`}
            aria-disabled={!available} aria-pressed={preview && aim === col}
            onFocus={() => { setAim(col); setInside(true); setPreview(true) }}
            onBlur={() => { if (pointer.current === null) setPreview(false) }}
            onClick={(event) => { if (event.detail === 0 && available) { setStarted(true); setPreview(false); primeAudio(); drop(col) } }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault()
                laneRefs.current[Math.max(0, Math.min(COLUMNS - 1, col + (event.key === 'ArrowLeft' ? -1 : 1)))]?.focus()
              }
              if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
            }} />)}
        </div>
        <div className={`${styles.callout} ${chain > 1 ? styles.combo : ''}`} key={`${game.turn}-${chain}`} role="status" aria-live="polite">{status}</div>
        {game.status !== 'playing' && <section className={styles.result} aria-label="けっか">
          {game.status === 'won' && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}</div>}
          <div className={styles.resultJelly}><JellyFace tier={game.status === 'won' ? 5 : game.current} /></div>
          <h2>{status}</h2><p>✦ {game.score}</p>
          <button ref={replayRef} type="button" onClick={retry}>もういちど ↻</button>
          {canUndo && <button className={styles.resultUndo} type="button" onClick={goBackOne}>↶ ひとつ もどす</button>}
        </section>}
      </div>
      <div className={styles.evolution} aria-label="おなじ すうじが くっつくと ひとつ おおきくなるよ。5を つくろう">
        {[1, 2, 3, 4, 5].map((tier) => <span key={tier}><span className={styles.mini}><JellyFace tier={tier} /></span>{tier < GOAL && <i aria-hidden="true">›</i>}</span>)}
      </div>
    </main>
    <dialog className={styles.help} ref={helpRef} aria-labelledby="jelly-help-title" onClose={() => returnFocus.current?.focus()}>
      <h2 id="jelly-help-title">あそびかた</h2>
      <div className={styles.helpGesture} aria-hidden="true">☝ ↔ ↓</div><p>うごかして、はなすと おちるよ</p>
      <div className={styles.equation} aria-hidden="true"><span className={styles.mini}><JellyFace tier={1} /></span> + <span className={styles.mini}><JellyFace tier={1} /></span> → <span className={styles.mini}><JellyFace tier={2} /></span></div>
      <p>おなじ すうじを くっつけよう</p><p>「5」で クリア。せんまで つむと おしまい。</p>
      <small>キーボード：← → で えらぶ / Enter・Spaceで おとす</small>
      <form method="dialog"><button type="submit">あそぶ</button></form>
    </dialog>
  </div></GamePlaySurface>
}
