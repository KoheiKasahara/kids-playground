import { useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import PanelFlag, { PANEL_COUNT } from './PanelFlag'
import { countriesForLevel } from './data/countries'
import { generateQuestions, shuffle } from './questionGenerator'
import { scoreForPanels } from './panelScore'
import { isQuizLevel, LEVEL_LABEL, MODE_PATH } from './types'
import type { Country, QuizLevel } from './types'
import { playCorrectSound, playIncorrectSound } from '../../utils/quizSound'
import styles from './PanelFlagQuizPlay.module.css'

/** 1問ぶんの満点（パネル1枚で正解したときの得点） */
const MAX_SCORE_PER_QUESTION = 100

/** シャッフル対象の 0〜PANEL_COUNT-1 のインデックス列。モジュールレベルの定数として使い回す */
const PANEL_INDICES = Array.from({ length: PANEL_COUNT }, (_, index) => index)

type PlayState = {
  index: number
  /** このもんだいで、これまでに開いた（めくった）パネルの枚数。1〜PANEL_COUNT */
  openedCount: number
  selectedId: string | null
  correctCount: number
  /** ここまでの合計得点 */
  score: number
}

type PlayAction =
  | { type: 'reveal' }
  | { type: 'select'; choiceId: string; correct: boolean }
  | { type: 'next' }

const initialState: PlayState = {
  index: 0,
  openedCount: 1,
  selectedId: null,
  correctCount: 0,
  score: 0,
}

function reducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case 'reveal':
      // 回答済み、またはすでに全パネルが開いている場合は何もしない
      // （連打してもopenedCountがPANEL_COUNTを超えない、状態が壊れないことをここで保証する）。
      if (state.selectedId !== null) return state
      if (state.openedCount >= PANEL_COUNT) return state
      return { ...state, openedCount: state.openedCount + 1 }
    case 'select':
      if (state.selectedId !== null) return state
      return {
        ...state,
        selectedId: action.choiceId,
        correctCount: state.correctCount + (action.correct ? 1 : 0),
        score: state.score + scoreForPanels(state.openedCount, action.correct),
      }
    case 'next':
      return {
        index: state.index + 1,
        openedCount: 1,
        selectedId: null,
        correctCount: state.correctCount,
        score: state.score,
      }
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

export default function PanelFlagQuizPlay() {
  const { level } = useParams()

  // 不正な level（URL直打ちなど）の場合は、パネルめくりモードのむずかしさ選択画面へ戻す
  if (!isQuizLevel(level)) {
    return <Navigate to={`/games/flag-quiz/${MODE_PATH.panelFlag}`} replace />
  }

  return <PanelFlagQuizPlayGame level={level} />
}

type PanelFlagQuizPlayGameProps = {
  level: QuizLevel
}

function PanelFlagQuizPlayGame({ level }: PanelFlagQuizPlayGameProps) {
  const navigate = useNavigate()
  const [questions] = useState(() => generateQuestions(countriesForLevel(level)))
  // もんだいごとに「パネルを開ける順番」をあらかじめシャッフルしておく
  // （既存の questions と同じく useState の遅延初期化で1回だけ生成し、reducer 自体は
  // 乱数に依存しない純粋な状態遷移だけを行う）。
  const [openOrders] = useState(() => questions.map(() => shuffle(PANEL_INDICES)))
  const [state, dispatch] = useReducer(reducer, initialState)

  const totalCount = questions.length
  const question = questions[state.index]
  const isLastQuestion = state.index === totalCount - 1
  const answered = state.selectedId !== null
  const isCorrect = state.selectedId === question.answer.id

  // 「開いているパネル」は openOrder の先頭 openedCount 件から導出する。
  // シャッフル済みの配列から slice するだけなので、重複や PANEL_COUNT 超過は構造的に起こらない。
  const openOrder = openOrders[state.index]
  const openedPanels = openOrder.slice(0, state.openedCount)
  const remainingPanels = PANEL_COUNT - state.openedCount
  const questionScore = scoreForPanels(state.openedCount, isCorrect)

  const handleReveal = () => {
    if (answered || state.openedCount >= PANEL_COUNT) return
    dispatch({ type: 'reveal' })
  }

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
      navigate(`/games/flag-quiz/${MODE_PATH.panelFlag}/${level}/result`, {
        replace: true,
        state: {
          correctCount: state.correctCount,
          totalCount,
          score: state.score,
          maxScore: totalCount * MAX_SCORE_PER_QUESTION,
        },
      })
      return
    }
    dispatch({ type: 'next' })
  }

  const pageClassName = [styles.page, answered ? styles.pageAnswered : ''].filter(Boolean).join(' ')

  return (
    <div className={pageClassName}>
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
        <div className={styles.flagArea}>
          <PanelFlag country={question.answer} openedPanels={openedPanels} revealAll={answered} />
        </div>

        <div className={styles.content}>
          <h1 className={styles.question}>この くにの なまえは？</h1>

          <div className={styles.revealRow}>
            <BigButton
              variant="secondary"
              className={styles.revealButton}
              disabled={answered || state.openedCount >= PANEL_COUNT}
              onClick={handleReveal}
            >
              <span aria-hidden="true">🧩</span> もう1まい めくる！
            </BigButton>
            <p className={styles.remainingText}>あと {remainingPanels}まい</p>
          </div>

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
        正誤メッセージと「つぎのもんだい」は、既存の FlagQuizPlay と同じく通常フローから外して
        画面下部に固定する。こうすることで画面の高さに関係なく操作ボタンが必ず可視・操作可能になる
        （iPhone SE 相当の低背端末でも画面外に出ない）。
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
              {isCorrect ? (
                <p className={styles.detailText}>
                  {state.openedCount}まいで わかった！ {questionScore}てん
                </p>
              ) : (
                <p className={styles.detailText}>0てん</p>
              )}
            </div>

            <BigButton variant="primary" className={styles.nextButton} onClick={handleNext}>
              {isLastQuestion ? 'けっかを みる' : 'つぎのもんだい'}
            </BigButton>
          </div>
        </div>
      )}
    </div>
  )
}
