import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import FlagChoiceGrid from './FlagChoiceGrid'
import FlagImage from './FlagImage'
import { countriesForLevel } from './data/countries'
import { generateQuestions } from './questionGenerator'
import { isQuizLevel, LEVEL_LABEL, MODE_PATH } from './types'
import type { Country, QuizLevel, QuizMode } from './types'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import { SpeechToggle, useQuestionSpeech } from '../../speech'
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
  if (variant === 'correct') return '◯'
  if (variant === 'wrong') return '✕'
  return ''
}

// panelFlag はパネル専用の PanelFlagQuizPlay を使うため、このコンポーネントの
// props からは型レベルで除外する（誤って panelFlag を渡すとコンパイルエラーになる）。
type FlagQuizPlayProps = {
  mode: Exclude<QuizMode, 'panelFlag'>
}

export default function FlagQuizPlay({ mode }: FlagQuizPlayProps) {
  const { level } = useParams()

  if (!isQuizLevel(level)) {
    return <Navigate to={`/games/flag-quiz/${MODE_PATH[mode]}`} replace />
  }

  return <FlagQuizPlayGame mode={mode} level={level} />
}

type FlagQuizPlayGameProps = {
  mode: Exclude<QuizMode, 'panelFlag'>
  level: QuizLevel
}

function FlagQuizPlayGame({ mode, level }: FlagQuizPlayGameProps) {
  const navigate = useNavigate()
  const [questions] = useState(() => generateQuestions(countriesForLevel(level)))
  const [state, dispatch] = useReducer(reducer, initialState)

  const totalCount = questions.length
  const question = questions[state.index]
  const isLastQuestion = state.index === totalCount - 1
  const answered = state.selectedId !== null
  const isCorrect = state.selectedId === question.answer.id

  useQuestionSpeech(
    mode === 'flagToName' ? 'この くにの なまえは？' : `${question.answer.nameJa}の こっきは どれ？`,
    state.index,
  )

  const handleSelect = (choiceId: string) => {
    if (answered) return
    const correct = choiceId === question.answer.id
    dispatch({ type: 'select', choiceId, correct })
    if (correct) {
      playCorrectSound()
    } else {
      playIncorrectSound()
    }
  }

  const handleNext = () => {
    if (isLastQuestion) {
      navigate(`/games/flag-quiz/${MODE_PATH[mode]}/${level}/result`, {
        replace: true,
        state: { correctCount: state.correctCount, totalCount },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  const pageClassName = [styles.page, mode === 'nameToFlag' ? styles.pageNameToFlag : '']
    .filter(Boolean)
    .join(' ')

  return (
    <main className={pageClassName}>
      <div className={styles.header}>
        <SpeechToggle />
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
        {mode === 'flagToName' ? (
          <>
            <div className={styles.flagArea}>
              <FlagImage country={question.answer} size="large" />
            </div>

            <div className={styles.content}>
              <h1 className={styles.question}>この くにの なまえは？</h1>

              <div className={styles.choices}>
                {question.choices.map((choice) => {
                  const variant = choiceVariant(choice, question.answer, state.selectedId)
                  const choiceButtonClassName = [
                    styles.choiceButton,
                    variant === 'secondary' ? styles.choiceButtonUnselected : '',
                  ]
                    .filter(Boolean)
                    .join(' ')
                  const mark = answered ? choiceMark(variant) : ''
                  return (
                    <BigButton
                      key={choice.id}
                      className={choiceButtonClassName}
                      variant={variant}
                      disabled={answered}
                      onClick={() => handleSelect(choice.id)}
                    >
                      <span className={styles.choiceMark}>{mark}</span>
                      {mark && ' '}
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
              「<span className={styles.questionCountry}>{question.answer.nameJa}</span>」の こっきは どれ？
            </h1>
            <FlagChoiceGrid
              choices={question.choices}
              answer={question.answer}
              selectedId={state.selectedId}
              disabled={answered}
              onSelect={handleSelect}
              className={styles.flagChoices}
            />
          </>
        )}
      </div>

      {answered && (
        <QuizResultOverlay
          result={isCorrect ? 'correct' : 'wrong'}
          answer={question.answer.nameJa}
          media={mode === 'nameToFlag' ? <FlagImage country={question.answer} size="small" /> : undefined}
          nextLabel={isLastQuestion ? 'けっかを みる' : 'つぎのもんだい'}
          onNext={handleNext}
        />
      )}
    </main>
  )
}
