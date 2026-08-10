import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
import { generateMathQuestions } from './questionGenerator'
import { MODE_PATH, OPERATION_SIGN } from './types'
import type { MathQuestion, MathQuizMode } from './types'
import styles from './MathQuizPlay.module.css'

type PlayState = {
  index: number
  selected: number | null
  correctCount: number
}

type PlayAction = { type: 'select'; choice: number; correct: boolean } | { type: 'next' }

const initialState: PlayState = { index: 0, selected: null, correctCount: 0 }

function reducer(state: PlayState, action: PlayAction): PlayState {
  if (action.type === 'select') {
    // 回答済みなら二重回答を無視する
    if (state.selected !== null) return state
    return {
      ...state,
      selected: action.choice,
      correctCount: state.correctCount + (action.correct ? 1 : 0),
    }
  }
  return { index: state.index + 1, selected: null, correctCount: state.correctCount }
}

type ChoiceVariant = 'primary' | 'secondary' | 'correct' | 'wrong'

function choiceVariant(choice: number, answer: number, selected: number | null): ChoiceVariant {
  if (selected === null) return 'primary'
  if (choice === answer) return 'correct'
  if (choice === selected) return 'wrong'
  return 'secondary'
}

/** 色だけに頼らず判別できるよう、回答後の正解・不正解の選択肢に記号を添える */
function choiceMark(variant: ChoiceVariant): string {
  if (variant === 'correct') return '◯ '
  if (variant === 'wrong') return '✕ '
  return ''
}

type MathQuizPlayProps = {
  mode: MathQuizMode
}

export default function MathQuizPlay({ mode }: MathQuizPlayProps) {
  const { level } = useParams()

  // 不正な level（URL直打ちなど）の場合は、このモードのむずかしさ選択画面へ戻す
  if (!isQuizLevel(level)) {
    return <Navigate to={`/games/math-quiz/${MODE_PATH[mode]}`} replace />
  }

  return <MathQuizPlayGame mode={mode} level={level} />
}

type MathQuizPlayGameProps = {
  mode: MathQuizMode
  level: QuizLevel
}

function MathQuizPlayGame({ mode, level }: MathQuizPlayGameProps) {
  const navigate = useNavigate()
  const [questions] = useState<MathQuestion[]>(() => generateMathQuestions(mode, level))
  const [state, dispatch] = useReducer(reducer, initialState)

  const question = questions[state.index]
  const totalCount = questions.length
  // 0 が正解になりうるため、falsy 判定ではなく null 比較で回答済みかを判定する
  const answered = state.selected !== null
  const isCorrect = state.selected === question.problem.answer
  const isLastQuestion = state.index === totalCount - 1

  const handleSelect = (choice: number) => {
    if (answered) return
    const correct = choice === question.problem.answer
    dispatch({ type: 'select', choice, correct })
    if (correct) {
      playCorrectSound()
    } else {
      playIncorrectSound()
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      navigate(`/games/math-quiz/${MODE_PATH[mode]}/${level}/result`, {
        replace: true,
        state: { correctCount: state.correctCount, totalCount },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  const pageClassName = [styles.page, answered ? styles.pageAnswered : '']
    .filter(Boolean)
    .join(' ')

  return (
    <main className={pageClassName}>
      <div className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>
          やめる
        </button>
        <div className={styles.progressArea}>
          <p className={styles.progressLabel}>
            <span className={styles.levelLabel}>{LEVEL_LABEL[level]}</span>
            {state.index + 1} / {totalCount}
          </p>
          <ProgressBar current={state.index + 1} total={totalCount} />
        </div>
      </div>

      <div className={styles.body}>
        <h1 className={styles.question}>
          {question.problem.left} {OPERATION_SIGN[question.problem.operation]}{' '}
          {question.problem.right} = ?
        </h1>

        <div className={styles.choices}>
          {question.choices.map((choice) => {
            const variant = choiceVariant(choice, question.problem.answer, state.selected)
            return (
              <BigButton
                key={choice}
                className={styles.choiceButton}
                variant={variant}
                disabled={answered}
                onClick={() => handleSelect(choice)}
              >
                {answered ? choiceMark(variant) : ''}
                {choice}
              </BigButton>
            )
          })}
        </div>
      </div>

      {/*
        正誤メッセージと「つぎへ」は、通常フローから外して画面下部に固定する。
        こうすることで画面の高さに関係なく「つぎへ」が必ず可視・操作可能になる。
        未回答時はDOMに置かず、回答直後にマウントしてアニメーションを都度再生する。
        隠れ防止の余白は .pageAnswered の padding-bottom で確保している。
      */}
      {answered && (
        <div
          className={`${styles.feedbackBar} ${
            isCorrect ? styles.feedbackBarSuccess : styles.feedbackBarWrong
          }`}
          role="status"
          aria-live="polite"
        >
          <div className={styles.feedbackBarInner}>
            <div className={styles.feedbackTexts}>
              <p
                className={`${styles.feedbackText} ${
                  isCorrect ? styles.correctText : styles.wrongText
                }`}
              >
                {isCorrect ? '🎉 せいかい！' : 'ざんねん！'}
              </p>
              <p className={styles.answerText}>こたえ: {question.problem.answer}</p>
            </div>
            <BigButton variant="primary" className={styles.nextButton} onClick={handleNext}>
              {isLastQuestion ? 'けっかを みる' : 'つぎへ'}
            </BigButton>
          </div>
        </div>
      )}
    </main>
  )
}
