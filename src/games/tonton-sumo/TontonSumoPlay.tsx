import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { PaperSheet } from './PaperWrestler'
import SumoScene, { type Ripple } from './SumoScene'
import {
  COMPUTER_INTERVAL_MS, COMPUTER_STRENGTH, STAT_LEVELS, STEP_SECONDS, WRESTLERS,
  behindPoint, clampToBox, computerTapPoint, createSumoState, isSettled, other, stepSumo, tapSide, tapSumo,
  type Mode, type Point, type Side,
} from './sumoGame'
import { SIDE_COLORS, TALL_VIEW, WIDE_VIEW, clientToView, unproject } from './projection'
import { playFinishSound, playStartSound, playTapSound, startBgm } from './sounds'
import styles from './TontonSumoPlay.module.css'

/** Leave the fall on screen for a moment before the replay buttons appear. */
export const RESULT_DELAY_MS = 900

const SIDE_NAMES: Record<Side, string> = { left: 'あか', right: 'あお' }
/** The biggest wrestler fills the picker card; smaller ones are drawn smaller. */
const LARGEST = Math.max(...WRESTLERS.map((wrestler) => wrestler.stats.scale))

function StatDots({ label, value }: { label: string; value: number }) {
  return (
    <span className={styles.stat}>
      {label}<b>{'●'.repeat(value)}<i>{'●'.repeat(STAT_LEVELS - value)}</i></b>
    </span>
  )
}

const PORTRAIT_QUERY = '(orientation: portrait)'
function subscribePortrait(onChange: () => void) {
  const query = window.matchMedia?.(PORTRAIT_QUERY)
  query?.addEventListener('change', onChange)
  return () => query?.removeEventListener('change', onChange)
}
const isPortrait = () => window.matchMedia?.(PORTRAIT_QUERY).matches ?? false

export default function TontonSumoPlay() {
  const [mode, setMode] = useState<Mode | null>(null)
  const [fighters, setFighters] = useState<Record<Side, number>>({ left: 0, right: 1 })
  const [picking, setPicking] = useState<Side>('left')
  const [sound, toggleSound] = useSoundToggle()
  const [match, setMatch] = useState(() => createSumoState(0, 1))
  const matchRef = useRef(match)
  const [ripples, setRipples] = useState<Ripple[]>([])
  const [resultReady, setResultReady] = useState(false)
  const frameRef = useRef<number | null>(null)
  const clockRef = useRef<{ last: number | null; carry: number }>({ last: null, carry: 0 })
  const resultTimerRef = useRef<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const arenaRef = useRef<HTMLDivElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const started = mode !== null
  const view = useSyncExternalStore(subscribePortrait, isPortrait) ? TALL_VIEW : WIDE_VIEW
  useGameIntroPlaying(started)

  const stopTimers = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current)
    resultTimerRef.current = null
  }, [])
  useEffect(() => stopTimers, [stopTimers])

  /** Runs the paper physics until everything on the box has come to rest. */
  const runPhysics = useCallback(() => {
    if (frameRef.current !== null) return
    clockRef.current = { last: null, carry: 0 }
    const frame = (time: number) => {
      const clock = clockRef.current
      clock.carry += clock.last === null ? STEP_SECONDS : Math.min(0.1, Math.max(0, time - clock.last) / 1000)
      clock.last = time
      const before = matchRef.current
      let next = before
      while (clock.carry >= STEP_SECONDS) {
        next = stepSumo(next)
        clock.carry -= STEP_SECONDS
      }
      matchRef.current = next
      setMatch(next)
      if (!before.winner && next.winner) {
        playFinishSound()
        vibrate('celebrate')
        resultTimerRef.current = window.setTimeout(() => {
          resultTimerRef.current = null
          setResultReady(true)
        }, RESULT_DELAY_MS)
      }
      frameRef.current = isSettled(next) ? null : requestAnimationFrame(frame)
    }
    frameRef.current = requestAnimationFrame(frame)
  }, [])

  const tap = useCallback((point: Point, player: Side, strength = 1) => {
    if (document.hidden) return
    const previous = matchRef.current
    const next = tapSumo(previous, point, player, performance.now(), Math.random, strength)
    if (previous === next) return
    matchRef.current = next
    setMatch(next)
    setRipples((list) => [...list.slice(-3), { id: next.taps, ...clampToBox(point), player }])
    primeAudio()
    playTapSound()
    vibrate('tap')
    runPhysics()
  }, [runPhysics])

  // とりくみ ちゅうだけ 8ビットの BGM。きまったら とめて、きまりの おとを きかせる。
  const bouting = started && !match.winner
  useEffect(() => {
    if (!sound || !bouting) return undefined
    return startBgm()
  }, [sound, bouting])

  const computerActive = mode === 'solo' && match.taps > 0 && !match.winner
  useEffect(() => {
    if (!computerActive) return
    const timer = window.setInterval(() => tap(computerTapPoint(matchRef.current), 'right', COMPUTER_STRENGTH), COMPUTER_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [computerActive, tap])

  useEffect(() => {
    if (!mode || match.winner) return
    const onKeyDown = (event: KeyboardEvent) => {
      // Enter / Space on focused buttons keep their native action. A / L work anywhere.
      const buttonFocused = event.target instanceof HTMLElement && Boolean(event.target.closest('button'))
      const key = event.key.toLowerCase()
      const player = key === 'a' || (event.code === 'Space' && mode === 'solo' && !buttonFocused)
        ? 'left' : key === 'l' && mode === 'duo' ? 'right' : null
      if (!player || event.altKey || event.ctrlKey || event.metaKey) return
      event.preventDefault()
      if (!event.repeat) tap(behindPoint(matchRef.current, player, Math.random), player)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mode, match.winner, tap])

  useEffect(() => {
    if (resultReady) replayRef.current?.focus()
    else if (mode) arenaRef.current?.focus()
  }, [mode, resultReady])

  const onArenaPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!mode || event.button !== 0) return
    if (event.target instanceof Element && event.target.closest('button')) return
    const svg = svgRef.current
    const at = svg ? clientToView(view, svg.getBoundingClientRect(), event.clientX, event.clientY) : null
    if (!at) return
    event.preventDefault()
    const point = clampToBox(unproject(at.x, at.y))
    tap(point, mode === 'solo' ? 'left' : tapSide(point))
  }

  const resetMatch = (next = fighters) => {
    stopTimers()
    const fresh = createSumoState(next.left, next.right)
    matchRef.current = fresh
    setMatch(fresh)
    setRipples([])
    setResultReady(false)
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

  const pick = (index: number) => {
    const next = { ...fighters, [picking]: index }
    setFighters(next)
    resetMatch(next)
    primeAudio()
    playTapSound()
  }

  const preview = useMemo(() => createSumoState(fighters.left, fighters.right), [fighters])
  const scene = started ? match : preview
  const nameOf = (side: Side) => WRESTLERS[fighters[side]]!.name
  const loser = match.winner ? other(match.winner) : null
  const message = match.winner ? `${nameOf(match.winner)}の かち！`
    : match.taps === 0 ? 'はっけよい、のこった！' : 'のこった、のこった！'
  const detail = loser
    ? (match.finish === 'fall' ? `${nameOf(loser)}が ころん！` : `${nameOf(loser)}が まるの そとへ！`)
    : mode === 'solo' ? 'どこでも トントン！ うしろを たたくと まえへ' : 'じぶんの がわを トントン！'

  const page = (
    <main className={`${styles.page} ${started ? styles.playing : ''}`}>
      <header className={styles.header}>
        {started ? <GameBackButton onBack={backToSelect} /> : <GameBackButton to="/" />}
        <h1>トントンずもう</h1>
        <button type="button" className={styles.sound} onClick={toggleSound} aria-label={sound ? 'おとを けす' : 'おとを だす'}>
          <span aria-hidden="true">{sound ? '♪' : '♫'}</span><small>おと {sound ? 'あり' : 'なし'}</small>
        </button>
      </header>

      <div className={styles.content} onPointerDown={started ? onArenaPointerDown : undefined}>
        <div className={styles.caption}>
          <span className={styles.eyebrow}>{started ? (mode === 'solo' ? 'ひとりで おすもう' : 'ふたりで おすもう') : 'おりがみの かみずもう'}</span>
          <h2 role={started ? 'status' : undefined}>{started ? message : 'トントン、ころん。'}</h2>
          <p>{started ? detail : 'はこを たたくと、ぴょこぴょこ うごくよ'}</p>
        </div>

        <div ref={arenaRef} className={styles.arena}
          tabIndex={started ? 0 : undefined}
          role={started ? 'button' : undefined}
          aria-label={started ? `はこを トントン（${mode === 'solo' ? 'A か スペース' : 'あかは A、あおは L'}）` : undefined}
          onKeyDown={started ? (event) => {
            if (event.key !== 'Enter' || event.repeat || match.winner) return
            event.preventDefault()
            if (mode === 'solo') tap(behindPoint(matchRef.current, 'left', Math.random), 'left')
            else tap({ x: 0, z: 0 }, 'left')
          } : undefined}>
          <SumoScene state={scene} ripples={ripples} svgRef={svgRef} idle={!started} view={view}
            label={`${nameOf('left')}と ${nameOf('right')}の かみずもう${match.winner && started ? `。${message}` : ''}`} />
        </div>

        {!started ? (
          <section className={styles.selection} aria-label="あそびかたを えらぶ">
            <div className={styles.corners} role="group" aria-label="どちらの おすもうさんを えらぶ">
              {(['left', 'right'] as const).map((side) => (
                <button key={side} type="button" aria-pressed={picking === side} onClick={() => setPicking(side)}
                  className={`${styles.corner} ${side === 'left' ? styles.redCorner : styles.blueCorner}`}>
                  <span className={styles.dot} aria-hidden="true" />{SIDE_NAMES[side]}<strong>{nameOf(side)}</strong>
                </button>
              ))}
            </div>
            <div className={styles.characters} role="group" aria-label={`${SIDE_NAMES[picking]}の おすもうさん`}>
              {WRESTLERS.map((wrestler, index) => (
                <button key={wrestler.key} type="button" aria-label={`${wrestler.name}（おおきさ ${wrestler.size}、おもさ ${wrestler.weight}）`}
                  aria-pressed={fighters[picking] === index} onClick={() => pick(index)}>
                  <svg viewBox="72 0 100 182" aria-hidden="true">
                    <g transform={`translate(80 172) scale(${(wrestler.stats.scale / LARGEST).toFixed(3)}) translate(-80 -172)`}>
                      <PaperSheet index={index} belt={fighters[picking] === index ? SIDE_COLORS[picking].belt : undefined} />
                    </g>
                  </svg>
                  <span>{wrestler.name}</span>
                  <small>{wrestler.trait}</small>
                  <span className={styles.stats} aria-hidden="true">
                    <StatDots label="おおきさ" value={wrestler.size} />
                    <StatDots label="おもさ" value={wrestler.weight} />
                  </span>
                  {(['left', 'right'] as const).filter((side) => fighters[side] === index).map((side) => (
                    <span key={side} className={`${styles.badge} ${side === 'left' ? styles.redBadge : styles.blueBadge}`} aria-hidden="true">{SIDE_NAMES[side]}</span>
                  ))}
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
            {resultReady ? (
              <div className={styles.result}>
                <button ref={replayRef} type="button" className={styles.solo} onClick={() => start(mode)}>もういちど</button>
                <button type="button" className={styles.secondary} onClick={backToSelect}>えらびなおす</button>
              </div>
            ) : mode === 'duo' ? (
              <div className={styles.halves} aria-hidden="true">
                <span className={styles.redHalf}>{nameOf('left')}<small>ひだりがわを トントン</small></span>
                <span className={styles.blueHalf}>{nameOf('right')}<small>みぎがわを トントン</small></span>
              </div>
            ) : (
              <p className={styles.hint}>{match.winner ? 'きまった！' : `${nameOf('right')}は ゆっくり トントン`}</p>
            )}
          </section>
        )}
      </div>
    </main>
  )
  return started ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
