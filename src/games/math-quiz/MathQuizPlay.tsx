import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import { SpeechToggle, useQuestionSpeech } from '../../speech'
import { isQuizLevel, LEVEL_LABEL } from '../quiz-core/types'
import type { QuizLevel } from '../quiz-core/types'
import { generateMathQuestions } from './questionGenerator'
import { MODE_PATH, OPERATION_SIGN, OPERATION_SPEECH_WORD } from './types'
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
  if (variant === 'correct') return '◯'
  if (variant === 'wrong') return '✕'
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

  useQuestionSpeech(
    `${question.problem.left} ${OPERATION_SPEECH_WORD[question.problem.operation]} ${question.problem.right} は？`,
    state.index,
  )

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

  return (
    <main className={styles.page}>
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
        <h1 className={styles.question}>
          {question.problem.left} {OPERATION_SIGN[question.problem.operation]}{' '}
          {question.problem.right} = ?
        </h1>

        <div className={styles.choices}>
          {question.choices.map((choice) => {
            const variant = choiceVariant(choice, question.problem.answer, state.selected)
            // secondary（正解でも選んだ誤答でもない、回答後の「その他」の選択肢）だけ、
            // 従来どおり枠線の色を見せる（PanelFlagQuizPlayと同じ方針）。
            const choiceButtonClassName = [
              styles.choiceButton,
              variant === 'secondary' ? styles.choiceButtonUnselected : '',
            ]
              .filter(Boolean)
              .join(' ')
            const mark = answered ? choiceMark(variant) : ''
            return (
              <BigButton
                key={choice}
                className={choiceButtonClassName}
                variant={variant}
                disabled={answered}
                onClick={() => handleSelect(choice)}
              >
                <span className={styles.choiceMark}>{mark}</span>
                {/* 記号は絶対配置で見た目には影響しないが、スクリーンリーダー向けの
                    読み上げ名（アクセシブルネーム）では「◯ すうじ」のように
                    記号とラベルの間に区切りが必要。半角スペースをspan内に含めると
                    アクセシブルネーム計算時に末尾空白として落ちてしまうため、
                    記号spanの外に独立したテキストノードとして置く。 */}
                {mark && ' '}
                {choice}
              </BigButton>
            )
          })}
        </div>
      </div>

      {/*
        正誤メッセージと「つぎのもんだい」は、通常フローから外し共通コンポーネント
        QuizResultOverlay が画面下部に固定して表示する。こうすることで画面の高さに
        関係なく必ず可視・操作可能になる。未回答時はDOMに置かず、回答直後にマウントして
        アニメーションを都度再生する。隠れ防止の余白は .page 側の padding-bottom で、
        回答したかどうかに関わらずビューポートの幅・高さだけで確保している。
      */}
      {answered && (
        <QuizResultOverlay
          result={isCorrect ? 'correct' : 'wrong'}
          answer={question.problem.answer}
          nextLabel={isLastQuestion ? 'けっかを みる' : 'つぎのもんだい'}
          onNext={handleNext}
        />
      )}
    </main>
  )
}
