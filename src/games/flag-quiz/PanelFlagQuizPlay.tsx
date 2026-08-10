import { useEffect, useMemo, useReducer, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import ProgressBar from '../../components/ProgressBar'
import QuizResultOverlay from '../../components/QuizResultOverlay'
import PanelFlag, { PANEL_COUNT } from './PanelFlag'
import { countriesForLevel } from './data/countries'
import { generateQuestions, shuffle } from './questionGenerator'
import { scoreForPanels } from './panelScore'
import { isQuizLevel, LEVEL_LABEL, MODE_PATH } from './types'
import type { Country, QuizLevel } from './types'
import {
  playCorrectSound,
  playIncorrectSound,
  playPanelOpenSound,
  playPanelRevealSound,
  primeAudio,
} from '../../utils/quizSound'
import styles from './PanelFlagQuizPlay.module.css'

/** 1問ぶんの満点（パネル1枚で正解したときの得点） */
const MAX_SCORE_PER_QUESTION = 100

/** シャッフル対象の 0〜PANEL_COUNT-1 のインデックス列。モジュールレベルの定数として使い回す */
const PANEL_INDICES = Array.from({ length: PANEL_COUNT }, (_, index) => index)

/** 正解後に残りパネルをパパパッと自動でめくり終えるまでの目標時間（ms）の目安 */
const AUTO_REVEAL_TOTAL_MS = 600
/** 自動めくりの1枚あたりの間隔の下限・上限（ms） */
const AUTO_REVEAL_MIN_INTERVAL_MS = 30
const AUTO_REVEAL_MAX_INTERVAL_MS = 70
/** 自動めくりを始めるまでの待ち時間（ms）。正解/不正解のフィードバック（表示・効果音）を先に見せるため。 */
const AUTO_REVEAL_START_DELAY_CORRECT_MS = 250
const AUTO_REVEAL_START_DELAY_WRONG_MS = 300

type PlayState = {
  index: number
  /** このもんだいで、これまでに開いた（めくった）パネルの枚数。1〜PANEL_COUNT。得点計算の対象 */
  openedCount: number
  /** 正解/不正解の回答後に自動でパパパッと開いたパネル。演出だけで得点には一切影響しない */
  revealedPanels: number[]
  selectedId: string | null
  correctCount: number
  /** ここまでの合計得点 */
  score: number
}

type PlayAction =
  | { type: 'reveal' }
  | { type: 'burst'; panel: number }
  | { type: 'select'; choiceId: string; correct: boolean }
  | { type: 'next' }

const initialState: PlayState = {
  index: 0,
  openedCount: 1,
  revealedPanels: [],
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
    case 'burst':
      // 回答後の自動めくり専用。同じ index が重複して積まれないようにする
      // （openedCount 側には絶対に足さない。得点や「〇まいで わかった！」表示が膨らむ事故を防ぐ）。
      if (state.revealedPanels.includes(action.panel)) return state
      return { ...state, revealedPanels: [...state.revealedPanels, action.panel] }
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
        revealedPanels: [],
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

/** 「動きを減らす」設定が有効かどうか。matchMedia 非対応環境（jsdom 等）でも例外を投げない */
function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
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
  const openedPanels = useMemo(() => openOrder.slice(0, state.openedCount), [openOrder, state.openedCount])
  // 画面に表示する「開いているパネル」は、ユーザーが自分で開いた分 ∪ 回答後に自動で開いた分。
  const displayOpenedPanels = useMemo(
    () => new Set([...openedPanels, ...state.revealedPanels]),
    [openedPanels, state.revealedPanels],
  )
  const remainingPanels = PANEL_COUNT - state.openedCount
  const questionScore = scoreForPanels(state.openedCount, isCorrect)

  const handleReveal = () => {
    if (answered || state.openedCount >= PANEL_COUNT) return
    // iOS Safari 対策: ユーザー操作イベントの中で AudioContext を先に用意しておく
    primeAudio()
    dispatch({ type: 'reveal' })
    playPanelOpenSound()
  }

  const handleSelect = (choiceId: string) => {
    if (answered) return
    primeAudio()
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

  /*
   * 回答後、まだ閉じているパネルをランダム順で時間差（stagger）に自動めくりし、
   * 国旗全体を「パパパッ」と見せる演出。
   * - openedCount（ユーザーが自分で開いた枚数）はここでは絶対に増やさない（burst アクションのみ）。
   * - 正解時は「🎉 せいかい！」表示・正解音を先に見せたいので約250ms、
   *   不正解時はブブー音と重ならないよう約300ms 待ってから開始する。
   * - 全部開き終わるまでをおよそ0.5〜1秒に収めるため、間隔は残り枚数から動的に決める。
   * - timer は必ず cleanup で clearTimeout する。問題切替（next）や unmount で
   *   古い timer が残って state を更新しないようにする。
   * - answered が true の間、openedPanels・isCorrect は変化しない（回答後は openedCount が
   *   固定されるため）ので、依存配列に含めても余計な再スケジュールは起きない。
   */
  useEffect(() => {
    if (!answered) return

    const alreadyOpen = new Set(openedPanels)
    const remaining = shuffle(PANEL_INDICES.filter((panel) => !alreadyOpen.has(panel)))
    if (remaining.length === 0) return

    const startDelay = isCorrect ? AUTO_REVEAL_START_DELAY_CORRECT_MS : AUTO_REVEAL_START_DELAY_WRONG_MS
    const timerIds: number[] = []

    if (prefersReducedMotion()) {
      // 動きを減らす設定では stagger をやめて残り全部を一度に開き、効果音も1回だけにする。
      const timerId = window.setTimeout(() => {
        remaining.forEach((panel) => dispatch({ type: 'burst', panel }))
        playPanelRevealSound(remaining.length, remaining.length)
      }, startDelay)
      timerIds.push(timerId)
    } else {
      const interval = Math.min(
        AUTO_REVEAL_MAX_INTERVAL_MS,
        Math.max(AUTO_REVEAL_MIN_INTERVAL_MS, Math.round(AUTO_REVEAL_TOTAL_MS / remaining.length)),
      )
      remaining.forEach((panel, order) => {
        const timerId = window.setTimeout(
          () => {
            dispatch({ type: 'burst', panel })
            playPanelRevealSound(order + 1, remaining.length)
          },
          startDelay + order * interval,
        )
        timerIds.push(timerId)
      })
    }

    return () => {
      timerIds.forEach((timerId) => window.clearTimeout(timerId))
    }
  }, [answered, state.index, openedPanels, isCorrect])

  return (
    <div className={styles.page}>
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
          <PanelFlag country={question.answer} openedPanels={displayOpenedPanels} />
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
              // secondary（正解でも選んだ誤答でもない、回答後の「その他」の選択肢）だけ、
              // 従来どおり枠線の色を見せる。枠線の太さ自体は styles.choiceButton 側で
              // 全variant共通の2pxに揃えているため、ここで色を足しても高さには影響しない。
              const choiceButtonClassName = [styles.choiceButton, variant === 'secondary' ? styles.choiceButtonUnselected : '']
                .filter(Boolean)
                .join(' ')
              return (
                <BigButton
                  key={choice.id}
                  className={choiceButtonClassName}
                  variant={variant}
                  disabled={answered}
                  onClick={() => handleSelect(choice.id)}
                >
                  <span className={styles.choiceMark}>{answered ? choiceMark(variant) : ''}</span>
                  {choice.nameJa}
                </BigButton>
              )
            })}
          </div>
        </div>
      </div>

      {/*
        正誤メッセージと「つぎのもんだい」は通常フローから外し、共通コンポーネント
        QuizResultOverlay が画面下部に固定したオーバーレイとして下から迫り上がるように
        表示する（背景を暗くするモーダルにはしない＝国旗やボタンは隠れるだけで、
        それ以外の画面は一切動かない）。
        回答の前後で .page 側のレイアウト・padding は変えていない（=下の要素は動かない）。
        下部余白の確保はビューポートの高さ・幅だけで決めており（PanelFlagQuizPlay.module.css）、
        背の低いスマホ縦では余白を確保せず、パネルは選択肢ボタンの上にそのまま重なる
        （回答後の選択肢は disabled のため操作上の問題はない）。
      */}
      {answered && (
        <QuizResultOverlay
          result={isCorrect ? 'correct' : 'wrong'}
          answer={question.answer.nameJa}
          detail={isCorrect ? `${state.openedCount}まいで わかった！ ${questionScore}てん` : '0てん'}
          nextLabel={isLastQuestion ? 'けっかを みる' : 'つぎのもんだい'}
          onNext={handleNext}
        />
      )}
    </div>
  )
}
