import { useEffect, useReducer, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { getSharedAudioContext, isSoundEnabled, playTone, primeAudio } from '../../audio/sound'
import { ANIMALS, PATCHES, STEPS, bathReducer, initialBath, type Animal, type Point } from './bath'
import AnimalPicture from './AnimalPicture'
import styles from './AnimalBathPlay.module.css'

function ToolIcon({ step }: { step: number }) {
  return step === 2
    ? <svg viewBox="0 0 48 40" width="30" height="25" aria-hidden="true"><rect x="4" y="4" width="40" height="32" rx="6" fill="#f6b4ce" stroke="#a8577b" strokeWidth="2" /><path d="M5 25 H43 M5 30 H43" stroke="#fff" strokeWidth="3" /><path d="M35 5 V24" stroke="#d88da9" strokeWidth="2" /></svg>
    : <span aria-hidden="true">{STEPS[step].emoji}</span>
}

function Bath({ animal, onBack }: { animal: Animal; onBack: () => void }) {
  const [state, dispatch] = useReducer(bathReducer, initialBath)
  const [sound, setSound] = useState(false)
  const [tool, setTool] = useState<Point | null>(null)
  const pointer = useRef<{ id: number; last: Point } | null>(null)
  const scene = useRef<SVGSVGElement>(null)
  const nextButton = useRef<HTMLButtonElement>(null)
  const board = useRef<HTMLButtonElement>(null)
  const previousCount = useRef(0)
  const step = STEPS[state.step]
  const ready = state.cleaned.length === PATCHES.length
  const finished = ready && state.step === STEPS.length - 1

  useEffect(() => {
    if (state.cleaned.length > previousCount.current && sound && isSoundEnabled()) {
      const context = getSharedAudioContext()
      if (context) {
        playTone(context, finished ? 784 : 440 + state.cleaned.length * 35, context.currentTime, 0.12, 0.045, 'sine')
        if (finished) playTone(context, 1047, context.currentTime + 0.15, 0.25, 0.045, 'sine')
      }
    }
    previousCount.current = state.cleaned.length
  }, [state.cleaned.length, finished, sound])

  // Keyboard users land on the next action when their last dab finishes a step.
  useEffect(() => {
    if (ready && document.activeElement === board.current) nextButton.current?.focus()
  }, [ready])

  function point(event: PointerEvent<HTMLButtonElement>): Point | null {
    const rect = scene.current?.getBoundingClientRect()
    if (!rect?.width || !rect.height) return null
    // SVG's default xMidYMid meet can letterbox on a narrow viewport.
    const size = Math.min(rect.width, rect.height)
    return { x: (event.clientX - rect.left - (rect.width - size) / 2) * 400 / size,
      y: (event.clientY - rect.top - (rect.height - size) / 2) * 400 / size }
  }

  function stopPointer(event: PointerEvent<HTMLButtonElement>) {
    if (pointer.current?.id !== event.pointerId) return
    pointer.current = null
    setTool(null)
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <GamePlaySurface><main className={styles.play}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} />
      <h1>{animal.name}の おふろ</h1>
      <button className={styles.sound} type="button" aria-label="おと" aria-pressed={sound} onClick={() => {
        if (!sound) primeAudio()
        setSound(!sound)
      }}>{sound ? '🔊' : '🔇'}</button>
    </header>
    <div className={styles.layout}>
      <button ref={board} type="button" className={styles.board} aria-label={`${animal.name}を ${step.name}で なでる`}
        aria-describedby="bath-instruction" aria-disabled={ready}
        onPointerDown={(event) => {
          if (ready || pointer.current || event.button !== 0) return
          const to = point(event)
          if (!to) return
          event.currentTarget.setPointerCapture?.(event.pointerId)
          pointer.current = { id: event.pointerId, last: to }
          setTool(to)
          dispatch({ type: 'stroke', from: to, to })
        }}
        onPointerMove={(event) => {
          const active = pointer.current
          if (!active || active.id !== event.pointerId || ready) return
          const to = point(event)
          if (!to) return
          dispatch({ type: 'stroke', from: active.last, to })
          pointer.current = { ...active, last: to }
          setTool(to)
        }}
        onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer}
        onClick={(event) => { if (event.detail === 0 && !ready) dispatch({ type: 'dab' }) }}>
        <svg ref={scene} viewBox="0 0 400 400" aria-hidden="true" className={styles.scene}>
          <path d="M0 75 H400 M0 150 H400 M0 225 H400 M75 0 V300 M150 0 V300 M225 0 V300 M300 0 V300 M375 0 V300" stroke="#fff" strokeWidth="3" opacity=".5" />
          <circle cx="46" cy="45" r="16" fill="#fff" opacity=".7" /><circle cx="354" cy="99" r="24" fill="#fff" opacity=".5" />
          <ellipse cx="200" cy="359" rx="147" ry="24" fill="#58a6b4" opacity=".2" />
          <g className={finished ? styles.happy : undefined}>
            <AnimalPicture animal={animal} happy={finished || state.cleaned.length > 3} />
            {PATCHES.map((patch, index) => {
              const cleaned = state.cleaned.includes(index)
              const appearance = state.step + (cleaned ? 1 : 0)
              return <g key={index} transform={`translate(${patch.x} ${patch.y})`}>
                {appearance === 0 && <g fill="#926345" stroke="#795137" strokeWidth="2">
                  <path d="M-22 -5 Q-29 -23 -9 -19 Q3 -31 13 -14 Q33 -16 24 4 Q29 24 6 20 Q-12 30 -19 12 Q-33 10 -22 -5" />
                  <circle cx="-6" cy="-5" r="4" fill="#b8895c" stroke="none" />
                </g>}
                {appearance === 1 && <g fill="#fff" stroke="#b4dbe4" strokeWidth="2" className={styles.bubbles}>
                  <circle cx="-15" cy="1" r="18" /><circle cx="9" cy="8" r="19" /><circle cx="0" cy="-13" r="18" /><circle cx="23" cy="-10" r="11" />
                  <circle cx="-5" cy="-18" r="4" fill="#e0f9ff" stroke="none" />
                </g>}
                {appearance === 2 && <g fill="#69c6ef" stroke="#3796c8" strokeWidth="2">
                  <path d="M0 -23 C-5 -11 -17 1 -14 10 C-10 28 14 22 14 8 C14 0 5 -12 0 -23" /><path d="M-7 5 Q-10 12 -3 15" stroke="#fff" fill="none" />
                </g>}
                {appearance === 3 && <path d="M0 -15 L4 -4 L15 0 L4 4 L0 15 L-4 4 L-15 0 L-4 -4 Z" fill="#ffcf4a" className={styles.sparkle} />}
              </g>
            })}
          </g>
          <path d="M38 329 Q200 353 362 329 L346 374 Q200 403 54 374 Z" fill="#fff8ec" stroke="#88bfc6" strokeWidth="4" />
          <path d="M38 329 Q200 353 362 329" fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" />
          <text x="200" y="379" textAnchor="middle" fontSize="30">{finished ? '💛 💛 💛' : '🫧'}</text>
          {tool && !ready && <g transform={`translate(${tool.x} ${tool.y})`} pointerEvents="none">
            <circle r="35" fill="#fff" opacity=".35" />
            {state.step === 2
              ? <g transform="translate(8 -44) rotate(12)"><rect width="52" height="40" rx="7" fill="#f6b4ce" stroke="#a8577b" strokeWidth="2" /><path d="M2 27 H50 M2 33 H50" stroke="#fff" strokeWidth="4" /></g>
              : <text x="12" y="-10" fontSize="44">{step.emoji}</text>}
          </g>}
        </svg>
      </button>
      <section className={styles.controls} aria-label="おふろの じゅんばん">
        <ol className={styles.steps}>{STEPS.map((item, index) => <li key={item.name} aria-current={index === state.step ? 'step' : undefined}>
          <span aria-hidden="true">{index < state.step || finished ? '✅' : <ToolIcon step={index} />}</span><span>{item.name}</span>
        </li>)}</ol>
        <p id="bath-instruction" className={styles.instruction} role="status">{finished ? 'ぴかぴか！ ありがとう！' : ready ? 'できた！' : step.instruction}</p>
        <div className={styles.progress} role="progressbar" aria-label="きれいに なった ところ" aria-valuemin={0} aria-valuemax={PATCHES.length} aria-valuenow={state.cleaned.length}>
          {PATCHES.map((_, index) => <span key={index} className={index < state.cleaned.length ? styles.filled : undefined} />)}
        </div>
        {ready ? <button ref={nextButton} className={styles.primary} type="button" onClick={() => {
          pointer.current = null
          setTool(null)
          if (finished) onBack()
          else {
            dispatch({ type: 'next' })
            board.current?.focus()
          }
        }}>{finished ? '🐾 ほかの こも あらう' : <><ToolIcon step={state.step + 1} /> {step.next}</>}</button>
          : <p className={styles.hint}>👆 ゆびで なでてね<br /><small>タップでも あらえるよ</small></p>}
      </section>
    </div>
  </main></GamePlaySurface>
}

export default function AnimalBathPlay() {
  const [animal, setAnimal] = useState<Animal | null>(null)
  useGameIntroPlaying(animal !== null)
  if (animal) return <Bath animal={animal} onBack={() => setAnimal(null)} />
  return <main className={styles.select}>
    <header className={styles.header}><GameBackButton to="/" /><h1>どうぶつのおふろ</h1></header>
    <div className={styles.welcome}><span aria-hidden="true">🧼 🫧 🚿</span><h2>だれを あらう？</h2><p>ごしごし、じゃぶじゃぶ、ぴかぴか！</p></div>
    <div className={styles.animals}>{ANIMALS.map((item) => <button key={item.id} className={styles.animal} type="button" onClick={() => {
      window.scrollTo(0, 0)
      setAnimal(item)
    }} aria-label={`${item.name}を あらう`}>
      <svg viewBox="0 0 400 370" aria-hidden="true"><AnimalPicture animal={item} /><g fill="#926345"><ellipse cx="130" cy="150" rx="24" ry="18" /><ellipse cx="235" cy="277" rx="25" ry="19" /></g></svg>
      <span>{item.name}</span>
    </button>)}</div>
    <p className={styles.selectHint}>すきな こを タップしてね</p>
  </main>
}
