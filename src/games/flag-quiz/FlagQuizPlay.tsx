import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import FlagImage from './FlagImage'
import { countries } from './data/countries'
import { generateQuestions } from './questionGenerator'
import type { Country } from './types'
import styles from './FlagQuizPlay.module.css'

type PlayState = {
  index: number
  selectedId: string | null
  correctCount: number
}

type PlayAction =
  | { type: 'select'; choiceId: string; correct: boolean }
  | { type: 'next' }

const initialState: PlayState = { index: 0, selectedId: null, correctCount: 0 }

function reducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case 'select':
      if (state.selectedId !== null) return state
      return {
        ...state,
        selectedId: action.choiceId,
        correctCount: state.correctCount + (action.correct ? 1 : 0),
      }
    case 'next':
      return { index: state.index + 1, selectedId: null, correctCount: state.correctCount }
    default:
      return state
  }
}

type ChoiceVariant = 'primary' | 'secondary' | 'correct' | 'wrong'

function choiceVariant(choice: Country, answer: Country, selectedId: string | null): ChoiceVariant {
  if (selectedId === null) return 'primary'
  if (choice.id === answer.id) return 'correct'
  if (choice.id === selectedId) return 'wrong'
  return 'secondary'
}

/** 色だけに頼らず判別できるよう、回答後の正解・不正解の選択肢に記号を添える */
function choiceMark(variant: ChoiceVariant): string {
  if (variant === 'correct') return '◯ '
  if (variant === 'wrong') return '✕ '
  return ''
}

export default function FlagQuizPlay() {
  const navigate = useNavigate()
  const [questions] = useState(() => generateQuestions(countries))
  const [state, dispatch] = useReducer(reducer, initialState)

  const totalCount = questions.length
  const question = questions[state.index]
  const isLastQuestion = state.index === totalCount - 1
  const answered = state.selectedId !== null
  const isCorrect = state.selectedId === question.answer.id

  const handleSelect = (choiceId: string) => {
    if (answered) return
    dispatch({ type: 'select', choiceId, correct: choiceId === question.answer.id })
  }

  const handleNext = () => {
    if (isLastQuestion) {
      navigate('/games/flag-quiz/result', {
        replace: true,
        state: { correctCount: state.correctCount, totalCount },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  return (
    <div className={answered ? `${styles.page} ${styles.pageAnswered}` : styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>
          やめる
        </button>
        <div className={styles.progressArea}>
          <p className={styles.progressLabel}>
            {state.index + 1} / {totalCount}
          </p>
          <ProgressBar current={state.index + 1} total={totalCount} />
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.flagArea}>
          <FlagImage country={question.answer} size="large" />
        </div>

        <div className={styles.content}>
          <h1 className={styles.question}>この くにの なまえは？</h1>

          <div className={styles.choices}>
            {question.choices.map((choice) => {
              const variant = choiceVariant(choice, question.answer, state.selectedId)
              return (
                <BigButton
                  key={choice.id}
                  className={styles.choiceButton}
                  variant={variant}
                  disabled={answered}
                  onClick={() => handleSelect(choice.id)}
                >
                  {answered ? choiceMark(variant) : ''}
                  {choice.nameJa}
                </BigButton>
              )
            })}
          </div>
        </div>
      </div>

      {/*
        正誤メッセージと「つぎへ」は、通常フローから外して画面下部に固定する。
        こうすることで画面の高さに関係なく「つぎへ」が必ず可視・操作可能になる
        （iPhone SE 相当の低背端末でも画面外に出ない）。
        未回答時はDOMに置かず、回答直後にマウントしてアニメーションを都度再生する。
        隠れ防止の余白は .pageAnswered の padding-bottom で確保している。
      */}
      {answered && (
        <div
          className={
            isCorrect
              ? `${styles.feedbackBar} ${styles.feedbackBarSuccess}`
              : `${styles.feedbackBar} ${styles.feedbackBarWrong}`
          }
          role="status"
          aria-live="polite"
        >
          <div className={styles.feedbackBarInner}>
            <div className={styles.feedbackTexts}>
              <p
                className={
                  isCorrect
                    ? `${styles.feedbackText} ${styles.correctText}`
                    : `${styles.feedbackText} ${styles.wrongText}`
                }
              >
                {isCorrect ? '🎉 せいかい！' : 'ざんねん！'}
              </p>
              <p className={styles.answerText}>こたえ: {question.answer.nameJa}</p>
            </div>

            <BigButton variant="primary" className={styles.nextButton} onClick={handleNext}>
              {isLastQuestion ? 'けっかを みる' : 'つぎへ'}
            </BigButton>
          </div>
        </div>
      )}
    </div>
  )
}
