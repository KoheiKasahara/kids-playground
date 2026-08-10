import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
import { vehiclesForLevel } from './data/vehicles'
import { generateVehicleQuestions } from './questionGenerator'
import { MODE_PATH } from './types'
import type { Vehicle, VehicleQuizMode } from './types'
import VehiclePhoto from './VehiclePhoto'
import styles from './WorkingVehicleQuizPlay.module.css'

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
  if (action.type === 'select') {
    if (state.selectedId !== null) return state
    return {
      ...state,
      selectedId: action.choiceId,
      correctCount: state.correctCount + (action.correct ? 1 : 0),
    }
  }
  return { index: state.index + 1, selectedId: null, correctCount: state.correctCount }
}

type ChoiceVariant = 'primary' | 'secondary' | 'correct' | 'wrong'

function choiceVariant(
  choice: Vehicle,
  answer: Vehicle,
  selectedId: string | null,
): ChoiceVariant {
  if (selectedId === null) return 'primary'
  if (choice.id === answer.id) return 'correct'
  if (choice.id === selectedId) return 'wrong'
  return 'secondary'
}

function choiceMark(variant: ChoiceVariant): string {
  if (variant === 'correct') return '◯ '
  if (variant === 'wrong') return '✕ '
  return ''
}

function photoChoiceClassName(variant: ChoiceVariant): string {
  const classes = [styles.photoChoiceButton]
  if (variant === 'correct') classes.push(styles.photoChoiceCorrect)
  if (variant === 'wrong') classes.push(styles.photoChoiceWrong)
  return classes.join(' ')
}

type WorkingVehicleQuizPlayProps = {
  mode: VehicleQuizMode
}

export default function WorkingVehicleQuizPlay({ mode }: WorkingVehicleQuizPlayProps) {
  const { level } = useParams()

  if (!isQuizLevel(level)) {
    return (
      <Navigate to={`/games/working-vehicle-quiz/${MODE_PATH[mode]}`} replace />
    )
  }

  return <WorkingVehicleQuizPlayGame mode={mode} level={level} />
}

type WorkingVehicleQuizPlayGameProps = {
  mode: VehicleQuizMode
  level: QuizLevel
}

function WorkingVehicleQuizPlayGame({ mode, level }: WorkingVehicleQuizPlayGameProps) {
  const navigate = useNavigate()
  const [questions] = useState(() => generateVehicleQuestions(vehiclesForLevel(level)))
  const [state, dispatch] = useReducer(reducer, initialState)

  const question = questions[state.index]
  const totalCount = questions.length
  const answered = state.selectedId !== null
  const isCorrect = state.selectedId === question.answer.id
  const isLastQuestion = state.index === totalCount - 1

  const handleSelect = (choiceId: string) => {
    if (answered) return
    const correct = choiceId === question.answer.id
    dispatch({ type: 'select', choiceId, correct })
    if (correct) playCorrectSound()
    else playIncorrectSound()
  }

  const handleNext = () => {
    if (isLastQuestion) {
      navigate(`/games/working-vehicle-quiz/${MODE_PATH[mode]}/${level}/result`, {
        replace: true,
        state: { correctCount: state.correctCount, totalCount },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  const pageClassName = [
    styles.page,
    answered ? styles.pageAnswered : '',
    mode === 'nameToPhoto' ? styles.pageNameToPhoto : '',
  ]
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
        {mode === 'photoToName' ? (
          <>
            <div className={styles.photoArea}>
              <VehiclePhoto
                vehicle={question.answer}
                size="large"
                alt="もんだいの くるまの しゃしん"
              />
            </div>
            <div className={styles.content}>
              <h1 className={styles.question}>この くるまの なまえは？</h1>
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
          </>
        ) : (
          <>
            <h1 className={styles.question}>
              「<span className={styles.questionVehicle}>{question.answer.nameJa}</span>」は どれ？
            </h1>
            <div className={styles.photoChoices}>
              {question.choices.map((choice, index) => {
                const variant = choiceVariant(choice, question.answer, state.selectedId)
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={photoChoiceClassName(variant)}
                    disabled={answered}
                    aria-label={`${index + 1}ばんめ の くるまの しゃしん`}
                    onClick={() => handleSelect(choice.id)}
                  >
                    <VehiclePhoto vehicle={choice} size="choice" />
                    {answered && (variant === 'correct' || variant === 'wrong') && (
                      <span
                        className={`${styles.choiceBadge} ${
                          variant === 'correct' ? styles.badgeCorrect : styles.badgeWrong
                        }`}
                        aria-hidden="true"
                      >
                        {variant === 'correct' ? '◯' : '✕'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

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
              <p className={`${styles.feedbackText} ${isCorrect ? styles.correctText : styles.wrongText}`}>
                {isCorrect ? '🎉 せいかい！' : 'ざんねん！'}
              </p>
              <p className={styles.answerText}>こたえ: {question.answer.nameJa}</p>
              {mode === 'nameToPhoto' && (
                <div className={styles.answerPhoto}>
                  <VehiclePhoto vehicle={question.answer} size="small" revealName />
                </div>
              )}
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
