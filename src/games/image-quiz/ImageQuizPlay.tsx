import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import ImageQuizImage from './ImageQuizImage'
import { generateImageQuizQuestions } from './questionGenerator'
import type { ImageQuizConfig, ImageQuizItem, ImageQuizMode } from './types'
import styles from './ImageQuiz.module.css'

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

function choiceVariant(choice: ImageQuizItem, answer: ImageQuizItem, selectedId: string | null): ChoiceVariant {
  if (selectedId === null) return 'primary'
  if (choice.id === answer.id) return 'correct'
  if (choice.id === selectedId) return 'wrong'
  return 'secondary'
}

type ImageQuizPlayProps = {
  config: ImageQuizConfig
  mode: ImageQuizMode
}

export default function ImageQuizPlay({ config, mode }: ImageQuizPlayProps) {
  const navigate = useNavigate()
  const [questions] = useState(() => generateImageQuizQuestions(config.items))
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
      navigate(`${config.basePath}/${mode === 'imageToName' ? 'image-to-name' : 'name-to-image'}/result`, {
        replace: true,
        state: { correctCount: state.correctCount, totalCount },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  return (
    <main className={[styles.playPage, mode === 'nameToImage' ? styles.playPageNameToImage : ''].filter(Boolean).join(' ')}>
      <header className={styles.header}>
        <button type="button" className={styles.quit} onClick={() => navigate('/')}>やめる</button>
        <div className={styles.progressArea}>
          <p className={styles.progressLabel}>{state.index + 1} / {totalCount}</p>
          <ProgressBar current={state.index + 1} total={totalCount} />
        </div>
      </header>

      <div className={styles.body}>
        {mode === 'imageToName' ? (
          <>
            <div className={styles.imageArea}>
              <ImageQuizImage item={question.answer} size="large" alt="もんだいの イラスト" />
            </div>
            <div className={styles.nameContent}>
              <h1 className={styles.question}>これは なに？</h1>
              <div className={styles.nameChoices}>
                {question.choices.map((choice) => {
                  const variant = choiceVariant(choice, question.answer, state.selectedId)
                  const mark = answered && variant === 'correct' ? '◯' : answered && variant === 'wrong' ? '✕' : ''
                  return (
                    <BigButton
                      key={choice.id}
                      className={[styles.nameChoice, variant === 'secondary' ? styles.nameChoiceUnselected : ''].filter(Boolean).join(' ')}
                      variant={variant}
                      disabled={answered}
                      onClick={() => handleSelect(choice.id)}
                    >
                      <span className={styles.choiceMark}>{mark}</span>{mark && ' '}{choice.name}
                    </BigButton>
                  )
                })}
              </div>
            </div>
          </>
        ) : (
          <>
            <h1 className={styles.question}>「<span className={styles.questionName}>{question.answer.name}</span>」は どれ？</h1>
            <div className={styles.imageChoices}>
              {question.choices.map((choice, index) => {
                const variant = choiceVariant(choice, question.answer, state.selectedId)
                const mark = variant === 'correct' ? '◯' : '✕'
                return (
                  <button
                    key={choice.id}
                    type="button"
                    className={[styles.imageChoice, variant === 'correct' && answered ? styles.imageChoiceCorrect : '', variant === 'wrong' ? styles.imageChoiceWrong : ''].filter(Boolean).join(' ')}
                    disabled={answered}
                    aria-label={answered ? `${index + 1}ばんめ の イラスト、${variant === 'correct' ? 'せいかい' : variant === 'wrong' ? 'ふせいかい' : ''}` : `${index + 1}ばんめ の イラスト`}
                    onClick={() => handleSelect(choice.id)}
                  >
                    <ImageQuizImage item={choice} size="choice" />
                    {answered && (variant === 'correct' || variant === 'wrong') && (
                      <span className={[styles.choiceBadge, variant === 'correct' ? styles.badgeCorrect : styles.badgeWrong].join(' ')} aria-hidden="true">{mark}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {answered && (
        <QuizResultOverlay
          result={isCorrect ? 'correct' : 'wrong'}
          answer={question.answer.name}
          media={mode === 'nameToImage' ? <ImageQuizImage item={question.answer} size="small" alt={`せいかいの ${question.answer.name}`} /> : undefined}
          nextLabel={isLastQuestion ? 'けっかを みる' : 'つぎのもんだい'}
          onNext={handleNext}
        />
      )}
    </main>
  )
}
