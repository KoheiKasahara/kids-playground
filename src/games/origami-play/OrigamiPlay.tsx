import { useCallback, useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import OrigamiPaper from './OrigamiPaper'
import { ORIGAMI_TEMPLATES, PAPER_COLORS, type OrigamiId, type PaperColor } from './origamiTemplates'
import { initialOrigamiState, origamiReducer } from './origamiState'
import { playFoldSound, playFinishSound } from './sounds'
import styles from './OrigamiPlay.module.css'

const progressStore = createStageProgressStore('origami-play-progress', (id) => ORIGAMI_TEMPLATES.some((item) => item.id === id))
type Template = (typeof ORIGAMI_TEMPLATES)[number]

function PaperMark() {
  return <span className={styles.paperMark} aria-hidden="true"><i /><i /><i /></span>
}

function SoundButton({ sound, onToggle }: { sound: boolean; onToggle: () => void }) {
  return <button className={styles.sound} type="button" aria-label="おと" aria-pressed={sound} onClick={onToggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9H8L13 5V19L8 15H4Z" />{sound
      ? <path d="M16 8Q20 12 16 16M19 5Q25 12 19 19" />
      : <path d="M17 10L22 15M22 10L17 15" />}</svg>
  </button>
}

function FoldingDesk({ template, color, sound, toggleSound, onBack, onComplete, keyboardStart }: {
  template: Template; color: PaperColor; sound: boolean; toggleSound: () => void; onBack: () => void; onComplete: (id: OrigamiId) => void; keyboardStart: boolean
}) {
  const [state, dispatch] = useReducer(origamiReducer, initialOrigamiState)
  const foldButton = useRef<HTMLButtonElement>(null)
  const replayButton = useRef<HTMLButtonElement>(null)
  const keyboardFolding = useRef(false)
  const celebrated = useRef(false)
  const total = template.steps.length
  const finished = state.step === total
  const instruction = template.steps[state.step]

  useEffect(() => {
    if (!state.folding) return
    const timer = window.setTimeout(() => dispatch({ type: 'settle', total }), 850)
    return () => window.clearTimeout(timer)
  }, [state.folding, total])

  useEffect(() => {
    if (!finished) {
      celebrated.current = false
      return
    }
    if (celebrated.current) return
    celebrated.current = true
    onComplete(template.id)
    vibrate('celebrate')
    if (sound) playFinishSound()
  }, [finished, onComplete, template.id, sound])

  useEffect(() => {
    if (state.folding || !keyboardFolding.current) return
    if (finished) replayButton.current?.focus({ preventScroll: true })
    else foldButton.current?.focus({ preventScroll: true })
    keyboardFolding.current = false
  }, [state.step, state.folding, finished])

  return <GamePlaySurface><main className={`${styles.page} ${styles.play}`}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} />
      <h1>{template.name}を おろう</h1>
      <SoundButton sound={sound} onToggle={toggleSound} />
    </header>
    <div className={styles.workshop}>
      <div className={`${styles.desk} ${finished ? styles.finishedDesk : ''}`}>
        <span className={styles.tape} aria-hidden="true" />
        <div className={styles.board}>
          <OrigamiPaper templateId={template.id} color={color} step={state.step} folding={state.folding} />
          {!finished && <button ref={foldButton} type="button" className={styles.foldTarget} autoFocus={keyboardStart}
            aria-label="ここを おる" aria-describedby="origami-instruction" disabled={state.folding}
            style={{ left: `${instruction.hint.x / 4}%`, top: `${instruction.hint.y / 3.6}%` }}
            onClick={(event) => {
              if (state.folding) return
              keyboardFolding.current = event.detail === 0
              if (sound) {
                primeAudio()
                playFoldSound()
              }
              vibrate('tap')
              dispatch({ type: 'fold', total })
            }}>
            <span aria-hidden="true">{state.folding ? '✓' : '☝'}</span>
          </button>}
          {finished && <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 16 }, (_, index) =>
            <i key={index} style={{ '--piece': index, '--confetti-color': PAPER_COLORS[index % PAPER_COLORS.length].main } as CSSProperties} />)}</div>}
        </div>
        <span className={styles.deskLabel} aria-hidden="true">{finished ? '✦ じぶんで つくったよ ✦' : 'ぱたん、と おってみよう'}</span>
      </div>
      <section className={styles.guide} aria-label="おりがみの じゅんばん">
        <div className={styles.progress} role="progressbar" aria-label="おった かず" aria-valuemin={0} aria-valuemax={total} aria-valuenow={state.step}>
          {template.steps.map((_, index) => <span key={index} className={index < state.step ? styles.folded : ''} aria-hidden="true">{index < state.step ? '✓' : index + 1}</span>)}
        </div>
        <p className={styles.stepLabel}>{finished ? 'とっても すてき！' : `${state.step + 1} / ${total}`}</p>
        <h2 id="origami-instruction" role="status" className={styles.instruction}>{finished ? 'できた！' : state.folding ? 'ぱたん…' : instruction.instruction}</h2>
        {finished ? <>
          <p className={styles.finishName}>{color.name}の {template.name}</p>
          <button ref={replayButton} type="button" className={styles.primary} onClick={() => {
            keyboardFolding.current = true
            dispatch({ type: 'reset' })
          }}>もういちど おる <span aria-hidden="true">↻</span></button>
          <button type="button" className={styles.secondary} onClick={onBack}>ほかの おりがみ</button>
        </> : <p className={styles.hint}><span aria-hidden="true">☝</span> ひかる ところを タップ<br /><small>ゆっくりで だいじょうぶ</small></p>}
      </section>
    </div>
  </main></GamePlaySurface>
}

export default function OrigamiPlay() {
  const [selected, setSelected] = useState<Template | null>(null)
  const [color, setColor] = useState<PaperColor>(PAPER_COLORS[0])
  const [sound, setSound] = useState(false)
  const [progress, setProgress] = useState(progressStore.read)
  const selectionHeading = useRef<HTMLHeadingElement>(null)
  const returning = useRef(false)
  const [keyboardStart, setKeyboardStart] = useState(false)
  useGameIntroPlaying(selected !== null)

  const onComplete = useCallback((id: OrigamiId) => setProgress(progressStore.record(id, 3)), [])
  function toggleSound() {
    if (!sound) primeAudio()
    setSound(!sound)
  }
  function returnToSelection() {
    returning.current = true
    setSelected(null)
  }
  useEffect(() => {
    if (!selected && returning.current) {
      selectionHeading.current?.focus({ preventScroll: true })
      returning.current = false
    }
  }, [selected])

  if (selected) return <FoldingDesk template={selected} color={color} sound={sound} toggleSound={toggleSound} onBack={returnToSelection} onComplete={onComplete} keyboardStart={keyboardStart} />

  return <main className={`${styles.page} ${styles.selection}`}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1>ぱたぱた おりがみ</h1>
      <SoundButton sound={sound} onToggle={toggleSound} />
    </header>
    <div className={styles.selectionBody}>
      <div className={styles.welcome}>
        <PaperMark />
        <p className={styles.eyebrow}>おって、あそんで、できあがり。</p>
        <h2 ref={selectionHeading} tabIndex={-1}>なにを おろう？</h2>
        <p>いちまいの かみが、たからものに。</p>
      </div>
      <fieldset className={styles.palette}>
        <legend>かみの いろ</legend>
        <div className={styles.swatches}>{PAPER_COLORS.map((item) => <button key={item.id} type="button"
          aria-label={item.name} aria-pressed={color.id === item.id} className={styles.swatch}
          style={{ '--paper-color': item.main } as CSSProperties} onClick={() => setColor(item)}>
          <span aria-hidden="true">{color.id === item.id ? '✓' : ''}</span>
        </button>)}</div>
        <p className={styles.colorName}>{color.name}</p>
      </fieldset>
      <div className={styles.cards}>{ORIGAMI_TEMPLATES.map((template, index) => <button key={template.id} type="button" className={styles.card}
        aria-label={`${template.name}を おる`} style={{ '--card-index': index } as CSSProperties} onClick={(event) => {
          window.scrollTo(0, 0)
          setKeyboardStart(event.detail === 0)
          setSelected(template)
        }}>
        <span className={styles.cardPicture}><OrigamiPaper templateId={template.id} color={color} step={template.steps.length} preview /></span>
        <span className={styles.cardName}>{template.name}</span>
        <span className={styles.cardCaption}>{template.subtitle}</span>
        <span className={styles.cardArrow} aria-hidden="true">↗</span>
        <StageClearBadge stars={progress[template.id] ?? 0} corner />
      </button>)}</div>
      <p className={styles.selectionHint}><span aria-hidden="true">☝</span> すきな おりがみを タップしてね</p>
    </div>
  </main>
}
