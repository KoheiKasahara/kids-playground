import { useEffect, useReducer, useRef, useState, type PointerEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { ANIMALS, PATCHES, STEPS, bathReducer, initialBath, type Animal, type Point } from './bath'
import AnimalPicture, { Mud } from './AnimalPicture'
import { Backdrop, BathDefs, Foam, Sparkle, ToolArt, ToolCursor, TubBack, TubFront, Wet } from './BathArt'
import { playBathCleanSound, playBathFinishSound, playBathRubSound, playBathSelectSound, playBathStepDoneSound } from './sounds'
import styles from './AnimalBathPlay.module.css'

function Bath({ animal, onBack }: { animal: Animal; onBack: () => void }) {
  const [state, dispatch] = useReducer(bathReducer, initialBath)
  const [sound, setSound] = useState(true)
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
    if (state.cleaned.length > previousCount.current && sound) {
      if (finished) playBathFinishSound()
      else if (ready) playBathStepDoneSound()
      else playBathCleanSound(state.step, state.cleaned.length)
    }
    previousCount.current = state.cleaned.length
  }, [state.cleaned.length, state.step, ready, finished, sound])

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
          // 最初のタッチで iOS でも音が出せるようにしておく。
          if (sound) primeAudio()
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
          if (sound) playBathRubSound(state.step)
          pointer.current = { ...active, last: to }
          setTool(to)
        }}
        onPointerUp={stopPointer} onPointerCancel={stopPointer} onLostPointerCapture={stopPointer}
        onClick={(event) => { if (event.detail === 0 && !ready) dispatch({ type: 'dab' }) }}>
        <svg ref={scene} viewBox="0 0 400 400" aria-hidden="true" className={styles.scene}>
          <BathDefs />
          <Backdrop />
          <TubBack />
          <g className={finished ? styles.happy : undefined}>
            <AnimalPicture animal={animal} happy={finished || state.cleaned.length > 3} />
            {PATCHES.map((patch, index) => {
              const cleaned = state.cleaned.includes(index)
              const appearance = state.step + (cleaned ? 1 : 0)
              return <g key={index} transform={`translate(${patch.x} ${patch.y})`}>
                {appearance === 0 && <Mud seed={index} />}
                {appearance === 1 && <g className={styles.bubbles}><Foam seed={index} /></g>}
                {appearance === 2 && <g className={styles.bubbles}><Wet seed={index} /></g>}
                {appearance === 3 && <Sparkle seed={index} />}
              </g>
            })}
          </g>
          <TubFront finished={finished} />
          {tool && !ready && <ToolCursor step={state.step} x={tool.x} y={tool.y} />}
        </svg>
      </button>
      <section className={styles.controls} aria-label="おふろの じゅんばん">
        <ol className={styles.steps}>{STEPS.map((item, index) => <li key={item.name} aria-current={index === state.step ? 'step' : undefined}>
          <span aria-hidden="true">{index < state.step || finished ? '✅' : <ToolArt step={index} />}</span><span>{item.name}</span>
        </li>)}</ol>
        <p id="bath-instruction" className={styles.instruction} role="status">{finished ? 'ぴかぴか！ ありがとう！' : ready ? 'できた！' : step.instruction}</p>
        <div className={styles.progress} role="progressbar" aria-label="きれいに なった ところ" aria-valuemin={0} aria-valuemax={PATCHES.length} aria-valuenow={state.cleaned.length}>
          {PATCHES.map((_, index) => <span key={index} className={index < state.cleaned.length ? styles.filled : undefined} />)}
        </div>
        {ready ? <button ref={nextButton} className={styles.primary} type="button" onClick={() => {
          pointer.current = null
          setTool(null)
          if (sound) playBathSelectSound()
          if (finished) onBack()
          else {
            dispatch({ type: 'next' })
            board.current?.focus()
          }
        }}>{finished ? '🐾 ほかの こも あらう' : <><ToolArt step={state.step + 1} /> {step.next}</>}</button>
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
      primeAudio()
      playBathSelectSound()
      setAnimal(item)
    }} aria-label={`${item.name}を あらう`}>
      <svg viewBox="0 0 400 370" aria-hidden="true"><AnimalPicture animal={item} /><g transform="translate(132 150) scale(.85)"><Mud seed={1} /></g><g transform="translate(236 280) scale(.9)"><Mud seed={4} /></g></svg>
      <span>{item.name}</span>
    </button>)}</div>
    <p className={styles.selectHint}>すきな こを タップしてね</p>
  </main>
}
