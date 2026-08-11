import { useEffect, useReducer, useState, type CSSProperties } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playColorMixSound, playCorrectSound, playIncorrectSound, primeAudio } from '../../utils/quizSound'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
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
  const { level } = useParams()
  if (!isQuizLevel(level)) return <Navigate to="/games/color-mix-quiz/level" replace />
  return <ColorMixQuizGame level={level} />
}

function ColorMixQuizGame({ level }: { level: QuizLevel }) {
  const navigate = useNavigate()
  const [questions] = useState<ColorMixQuestion[]>(() => generateColorMixQuestions(level))
  const [state, dispatch] = useReducer(reducer, initialState)
  const question = questions[state.index]
  const answered = state.selected !== null
  const correct = state.selected === question.problem.resultColor
  const last = state.index === questions.length - 1

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
    if (isCorrect) playColorMixSound()
    else playIncorrectSound()
    dispatch({ type: 'select', color, correct: isCorrect })
  }

  const next = () => {
    if (last) {
      navigate(`/games/color-mix-quiz/${level}/result`, { replace: true, state: { correctCount: state.correctCount, totalCount: questions.length } })
      return
    }
    dispatch({ type: 'next' })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>やめる</button>
        <div className={styles.progressArea}>
          <p className={styles.progressLabel}><span>{LEVEL_LABEL[level]}</span>{state.index + 1} / {questions.length}</p>
          <ProgressBar current={state.index + 1} total={questions.length} />
        </div>
      </header>
      <section className={styles.body} aria-label="いろを まぜる もんだい">
        <h1 className={styles.question}>この {question.problem.inputColors.length}しょくを まぜると？</h1>
        <div
          className={[styles.paintStage, answered ? styles.mixing : '', question.problem.inputColors.length === 3 ? styles.trio : ''].filter(Boolean).join(' ')}
          key={`${question.problem.id}-${state.selected ?? 'new'}`}
        >
          {question.problem.inputColors.flatMap((color, index) => {
            const paintClass = index === 0 ? styles.paintA : index === 1 ? styles.paintB : styles.paintC
            const nodes = []
            if (index > 0) nodes.push(<span key={`plus-${index}`} className={styles.plus} aria-hidden="true">＋</span>)
            nodes.push(<span key={`paint-${index}`} className={`${styles.paint} ${paintClass}`} style={{ '--paint-color': color } as CSSProperties} aria-hidden="true" />)
            return nodes
          })}
          {answered && correct && <><span className={styles.mixedPaint} data-testid="mixed-paint" style={{ '--paint-color': question.problem.resultColor } as CSSProperties} aria-hidden="true" /><span className={styles.done}>できた！</span></>}
          {answered && !correct && (
            <div className={styles.compare}>
              <div className={styles.compareItem}>
                <span className={styles.compareLabel}>えらんだいろ</span>
                <span className={styles.compareSwatch} style={{ '--paint-color': state.selected } as CSSProperties} aria-hidden="true" />
              </div>
              <div className={styles.compareItem}>
                <span className={styles.compareLabel}>まざったいろ</span>
                <span className={styles.compareSwatch} data-testid="mixed-paint" style={{ '--paint-color': question.problem.resultColor } as CSSProperties} aria-hidden="true" />
              </div>
            </div>
          )}
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
