import { useCallback, useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import PaperWrestler from './PaperWrestler'
import { COMPUTER_INTERVAL_MS, WRESTLERS, createSumoState, tapSumo, type Mode, type Side } from './sumoGame'
import { playFinishSound, playStartSound, playTapSound } from './sounds'
import styles from './TontonSumoPlay.module.css'

export default function TontonSumoPlay() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [selected, setSelected] = useState(0)
  const [sound, toggleSound] = useSoundToggle()
  const [match, setMatch] = useState(createSumoState)
  const matchRef = useRef(match)
  const tapGestureRef = useRef(false)
  const [lastSide, setLastSide] = useState<Side | null>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const leftButtonRef = useRef<HTMLButtonElement>(null)
  const opponent = (selected + 1) % WRESTLERS.length
  const totalTaps = match.taps.left + match.taps.right
  const started = mode !== null
  useGameIntroPlaying(started)

  const tap = useCallback((side: Side) => {
    if (document.hidden) return
    const previous = matchRef.current
    const next = tapSumo(previous, side, performance.now())
    if (previous === next) return
    matchRef.current = next
    setMatch(next)
    setLastSide(side)
    primeAudio()
    if (next.winner) {
      playFinishSound()
      vibrate('celebrate')
    } else {
      playTapSound()
      vibrate('tap')
    }
  }, [])

  const computerActive = mode === 'solo' && totalTaps > 0 && !match.winner
  useEffect(() => {
    if (!computerActive) return
    const timer = window.setInterval(() => tap('right'), COMPUTER_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [computerActive, tap])

  useEffect(() => {
    if (!mode || match.winner) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter / Space on focused buttons keep their native action. A / L work anywhere.
      const buttonFocused = event.target instanceof HTMLElement && Boolean(event.target.closest('button'))
      const key = event.key.toLowerCase()
      const side = key === 'a' || (event.code === 'Space' && mode === 'solo' && !buttonFocused)
        ? 'left' : key === 'l' && mode === 'duo' ? 'right' : null
      if (!side || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      if (!event.repeat) tap(side)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, match.winner, tap])

  useEffect(() => {
    if (match.winner) replayRef.current?.focus()
    else if (mode) leftButtonRef.current?.focus()
  }, [mode, match.winner])

  const resetMatch = () => {
    const fresh = createSumoState()
    matchRef.current = fresh
    setMatch(fresh)
    setLastSide(null)
  }

  const start = (nextMode: Mode) => {
    primeAudio()
    resetMatch()
    setMode(nextMode)
    playStartSound()
  }

  const backToSelect = () => {
    resetMatch()
    setMode(null)
  }

  const winnerName = match.winner === 'left' ? WRESTLERS[selected]!.name : WRESTLERS[opponent]!.name
  const message = match.winner ? `${winnerName}の かち！`
    : totalTaps === 0 ? 'はっけよい、のこった！' : 'のこった、のこった！'

  const page = (
    <main className={`${styles.page} ${started ? styles.playing : ''}`}
      onPointerDownCapture={() => { tapGestureRef.current = false }}
      onClickCapture={(event) => {
        // A winning pointerdown replaces the pad with replay controls before the
        // compatibility click arrives. Consume that click until a new gesture begins.
        if (event.detail > 0 && tapGestureRef.current) {
          event.preventDefault()
          event.stopPropagation()
        }
      }}>
      <header className={styles.header}>
        {started ? <GameBackButton onBack={backToSelect} /> : <GameBackButton to="/" />}
        <h1>トントンずもう</h1>
        <button type="button" className={styles.sound} onClick={toggleSound} aria-label={sound ? 'おとを けす' : 'おとを だす'}>
          <span aria-hidden="true">{sound ? '♪' : '♫'}</span><small>おと {sound ? 'あり' : 'なし'}</small>
        </button>
      </header>

      <div className={styles.content}>
        <div className={styles.caption}>
          <span className={styles.eyebrow}>{started ? (mode === 'solo' ? 'ひとりで おすもう' : 'ふたりで おすもう') : 'ちいさな かみの おすもう'}</span>
          <h2 role={started ? 'status' : undefined}>{started ? message : 'トントン、ころん。'}</h2>
          <p>{started ? (match.winner ? 'ふたりとも よく がんばったね' : 'じぶんの ボタンを たたこう') : 'たたくと はずむ。おすと すすむ。'}</p>
        </div>

        <div className={styles.arena}>
          <svg viewBox="0 0 720 440" role="img" aria-label={`${WRESTLERS[selected]!.name}と ${WRESTLERS[opponent]!.name}の かみずもう${match.winner ? `。${message}` : ''}`}>
            <path d="M64 50 Q360 118 656 50" fill="none" stroke="#c9b991" strokeWidth="2" />
            {[120, 200, 280, 360, 440, 520, 600].map((x, index) => <path key={x} d={`M${x - 15} ${index < 2 || index > 4 ? 64 : 78} l30 4 -16 30Z`} fill={['#dd8b76', '#85b5ae', '#e1c16e'][index % 3]} />)}
            <g fill="#e7dcca"><circle cx="80" cy="172" r="5" /><circle cx="654" cy="213" r="7" /><path d="M124 115 l6 12 -12 0Z M601 130 l8 16 -16 0Z" /></g>
            <ellipse cx="360" cy="384" rx="268" ry="24" fill="#c1a886" opacity=".18" />
            <g key={`box-${totalTaps}`} className={totalTaps && !match.winner ? styles.boxBounce : undefined}>
              <path d="M62 260 L360 189 L658 260 L641 362 L360 416 L79 362Z" fill="#c69b6a" stroke="#99754f" strokeWidth="3" />
              <path d="M62 260 L360 325 L658 260 L641 362 L360 416 L79 362Z" fill="#d5b184" />
              <path d="M360 325 L360 416 L641 362 L658 260Z" fill="#c69b6a" />
              <path d="M62 260 L360 189 L658 260 L360 332Z" fill="#f5e4c5" stroke="#a98a60" strokeWidth="3" />
              <ellipse cx="360" cy="259" rx="238" ry="56" fill="#faedd5" stroke="#c29a5f" strokeWidth="9" />
              <ellipse cx="360" cy="259" rx="238" ry="56" fill="none" stroke="#efce8d" strokeWidth="5" strokeDasharray="4 7" />
              <path d="M333 250 l0 20 M387 250 l0 20" stroke="#faf7ed" strokeWidth="7" strokeLinecap="round" />
              <path d="M112 304 l80 18 M112 320 l48 11 M540 328 l60 -13" stroke="#b58c5e" strokeWidth="2" opacity=".5" />
              <g transform="translate(328 350)"><rect width="64" height="40" rx="6" fill="#f4e9d0" /><text x="32" y="28" textAnchor="middle" fill="#916846" fontSize="22" fontWeight="800">福</text></g>
            </g>
            {(['left', 'right'] as const).map((side) => {
              const losing = Boolean(match.winner && match.winner !== side)
              const x = (side === 'left' ? 206 : 354) + match.position * 15
              return (
                <g key={side} transform={`translate(${x} 105)`} className={styles.wrestlerPosition}>
                  <ellipse cx="80" cy="170" rx="67" ry="12" fill="#9d774e" opacity=".17" />
                  <g transform={losing ? `rotate(${side === 'left' ? -72 : 72} 80 169)` : `rotate(${side === 'left' ? 5 : -5} 80 169)`} className={styles.paperTilt}>
                    <g key={`${side}-${totalTaps}`} className={match.winner ? (losing ? undefined : styles.cheer) : totalTaps ? styles.hop : styles.idle}>
                      <PaperWrestler index={side === 'left' ? selected : opponent} belt={side === 'left' ? '#c65b4b' : '#438c91'} />
                    </g>
                  </g>
                </g>
              )
            })}
            {lastSide && !match.winner && <text key={`tap-${totalTaps}`} x={lastSide === 'left' ? 160 : 560} y="175" className={styles.tapWord} textAnchor="middle" fill={lastSide === 'left' ? '#b94e3f' : '#367b80'}>トン!</text>}
            {match.winner && <g className={styles.confetti} aria-hidden="true">{[110, 180, 265, 360, 440, 530, 600].map((x, i) => <path key={x} d={`M${x} ${115 + (i % 3) * 26} l7 -12 7 12 -7 12Z`} fill={['#dba44b', '#dd8b76', '#85b5ae'][i % 3]} />)}</g>}
          </svg>
        </div>

        {!started ? (
          <section className={styles.selection} aria-label="あそびかたを えらぶ">
            <p id="wrestler-label">きみの おすもうさん</p>
            <div className={styles.characters} role="group" aria-labelledby="wrestler-label">
              {WRESTLERS.map((wrestler, index) => (
                <button key={wrestler.name} type="button" aria-pressed={selected === index} onClick={() => { setSelected(index); primeAudio(); playTapSound() }}>
                  <svg viewBox="0 0 160 180" aria-hidden="true"><PaperWrestler index={index} /></svg>
                  <span>{wrestler.name}</span>
                  <span className={styles.check} aria-hidden="true">{selected === index ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            <div className={styles.modes}>
              <button type="button" className={styles.solo} aria-label="ひとりで ゆっくり あいてと" onClick={() => start('solo')}><span>ひとりで</span><small>ゆっくり あいてと</small></button>
              <button type="button" className={styles.duo} aria-label="ふたりで いっしょに トントン" onClick={() => start('duo')}><span>ふたりで</span><small>いっしょに トントン</small></button>
            </div>
          </section>
        ) : (
          <section className={styles.controls} aria-label="おすもうの そうさ">
            {match.winner ? (
              <div className={styles.result}>
                <button ref={replayRef} type="button" className={styles.solo} onClick={() => start(mode)}>もういちど</button>
                <button type="button" className={styles.secondary} onClick={backToSelect}>えらびなおす</button>
              </div>
            ) : (
              <div className={styles.pads}>
                {(['left', 'right'] as const).map((side) => {
                  const computer = side === 'right' && mode === 'solo'
                  const name = WRESTLERS[side === 'left' ? selected : opponent]!.name
                  return computer ? (
                    <div key={side} className={styles.computer}><span>{name}</span><strong>おまかせ</strong><small>ゆっくり トントン</small></div>
                  ) : (
                    <button key={side} ref={side === 'left' ? leftButtonRef : undefined} type="button"
                      className={`${styles.pad} ${side === 'left' ? styles.redPad : styles.bluePad}`}
                      aria-label={`${side === 'left' ? 'ひだり' : 'みぎ'}の トン！`}
                      onPointerDown={(event) => {
                        if (event.button !== 0) return
                        tapGestureRef.current = true
                        event.preventDefault()
                        tap(side)
                      }}
                      onClick={(event) => { if (event.detail === 0) tap(side) }}
                      onKeyDown={(event) => { if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault() }}>
                      <span>{name}</span><strong>トン！</strong><small>{side === 'left' ? (mode === 'solo' ? 'A / スペース' : 'A') : 'L'}</small>
                    </button>
                  )
                })}
              </div>
            )}
            <p className={styles.hint}>{match.winner ? 'なんどでも あそぼう' : 'まるの そとへ おしだすと かち！'}</p>
          </section>
        )}
      </div>
    </main>
  )
  return started ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
