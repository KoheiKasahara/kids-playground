import { Fragment, useEffect, useReducer, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playColorMixSound, playCorrectSound, playIncorrectSound, primeAudio } from '../../utils/quizSound'
import { generateColorMixQuestions } from './questionGenerator'
import type { ColorMixQuestion } from './types'
import styles from './ColorMixQuizPlay.module.css'

type State = { index: number; selected: string | null; correctCount: number }
type Action = { type: 'select'; color: string; correct: boolean } | { type: 'next' }
const initialState: State = { index: 0, selected: null, correctCount: 0 }

function reducer(state: State, action: Action): State {
  if (action.type === 'select') {
    if (state.selected !== null) return state
    return { ...state, selected: action.color, correctCount: state.correctCount + (action.correct ? 1 : 0) }
  }
  return { ...state, index: state.index + 1, selected: null }
}

export default function ColorMixQuizPlay() {
  return <ColorMixQuizGame />
}

function ColorMixQuizGame() {
  const navigate = useNavigate()
  const [questions] = useState<ColorMixQuestion[]>(() => generateColorMixQuestions())
  const [state, dispatch] = useReducer(reducer, initialState)
  const question = questions[state.index]
  const answered = state.selected !== null
  const correct = state.selected === question.problem.resultColor
  const last = state.index === questions.length - 1
  const isSubtraction = question.problem.kind === 'subtraction'
  const isSubtracting = isSubtraction && answered
  const shouldRevealResult = answered

  // The success chime follows the visual mix. The timer is always cleared on next question/unmount.
  useEffect(() => {
    if (!correct) return undefined
    const timer = window.setTimeout(playCorrectSound, 460)
    return () => window.clearTimeout(timer)
  }, [correct, question.problem.id])

  const select = (color: string) => {
    if (answered) return
    const isCorrect = color === question.problem.resultColor
    // This runs inside the tap event so iOS can unlock the shared AudioContext before delayed audio.
    primeAudio()
    if (isCorrect) {
      if (!isSubtraction) playColorMixSound()
    } else {
      playIncorrectSound()
    }
    dispatch({ type: 'select', color, correct: isCorrect })
  }

  const next = () => {
    if (last) {
      navigate('/games/color-mix-quiz/result', { replace: true, state: { correctCount: state.correctCount, totalCount: questions.length } })
      return
    }
    dispatch({ type: 'next' })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>やめる</button>
        <div className={styles.progressArea}>
          <p className={styles.progressLabel}>{state.index + 1} / {questions.length}</p>
          <ProgressBar current={state.index + 1} total={questions.length} />
        </div>
      </header>
      <section className={styles.body} aria-label={isSubtraction ? 'いろを ひく もんだい' : 'いろを まぜる もんだい'}>
        <h1 className={styles.question}>{question.problem.kind === 'subtraction' ? 'この いろから ひくと？' : `この ${question.problem.inputColors.length}しょくを まぜると？`}</h1>
        <div className={[styles.paintStage, question.problem.inputColors.length === 3 ? styles.threePaintStage : '', answered && !isSubtraction ? styles.mixing : '', isSubtraction && isSubtracting ? styles.removing : ''].filter(Boolean).join(' ')} aria-busy={isSubtracting} key={`${question.problem.id}-${state.selected ?? 'new'}`}>
          {question.problem.inputColors.map((color, index) => (
            <Fragment key={`${color}-${index}`}>
              <span className={`${styles.paint} ${index === 0 ? styles.paintA : index === 1 ? styles.paintB : styles.paintC}`} style={{ '--paint-color': color } as CSSProperties} aria-hidden="true" />
              {index < question.problem.inputColors.length - 1 && <span className={styles.plus} aria-hidden="true">{question.problem.kind === 'subtraction' ? '−' : '＋'}</span>}
            </Fragment>
          ))}
          {isSubtraction && <span className={styles.removalParticles} style={{ '--paint-color': question.problem.inputColors[1] } as CSSProperties} aria-hidden="true" data-testid="subtraction-removal-particles"><i /><i /><i /></span>}
          {shouldRevealResult && <><span className={styles.mixedPaint} style={{ '--paint-color': question.problem.resultColor } as CSSProperties} aria-hidden="true" /><span className={styles.done}>できた！</span></>}
        </div>
        <div className={styles.choices}>
          {question.choices.map((color, index) => {
            const isAnswer = color === question.problem.resultColor
            const selected = color === state.selected
            const className = [styles.choice, answered && isAnswer ? styles.answer : '', answered && selected && !isAnswer ? styles.wrong : ''].filter(Boolean).join(' ')
            return <button key={color} type="button" className={className} style={{ backgroundColor: color }} aria-label={`${index + 1}ばんめの いろ`} disabled={answered} onClick={() => select(color)}>
              {answered && isAnswer && <span aria-hidden="true">◯</span>}
              {answered && selected && !isAnswer && <span aria-hidden="true">✕</span>}
            </button>
          })}
        </div>
      </section>
      {answered && <QuizResultOverlay result={correct ? 'correct' : 'wrong'} nextLabel={last ? 'けっかを みる' : 'つぎのもんだい'} onNext={next} />}
    </main>
  )
}
