import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isQuizResultState } from '../quiz-core/resultState'
import { isQuizLevel, LEVEL_LABEL, MODE_LABEL, MODE_PATH } from './types'
import type { QuizMode } from './types'
import styles from './FlagQuizResult.module.css'

type ResultState = {
  correctCount: number
  totalCount: number
  /** パネルめくりモードなど、得点制のモードでだけ渡される。既存の flagToName/nameToFlag は渡さない */
  score?: number
  maxScore?: number
}

function isResultState(value: unknown): value is ResultState {
  if (!isQuizResultState(value)) return false
  const candidate = value as Record<string, unknown>
  const hasScore = candidate.score !== undefined
  const hasMaxScore = candidate.maxScore !== undefined
  // score/maxScore は任意だが、どちらかを渡すなら得点として一貫した整数の組にする。
  if (hasScore !== hasMaxScore) return false
  if (!hasScore) return true
  if (
    typeof candidate.score !== 'number' ||
    !Number.isInteger(candidate.score) ||
    typeof candidate.maxScore !== 'number' ||
    !Number.isInteger(candidate.maxScore) ||
    candidate.maxScore < 0 ||
    candidate.score < 0 ||
    candidate.score > candidate.maxScore
  ) return false
  return true
}

function getPraise(correctCount: number, totalCount: number): { emoji: string; message: string } {
  if (totalCount > 0 && correctCount === totalCount) {
    return { emoji: '🏆', message: 'かんぺき！' }
  }
  if (correctCount >= 7) {
    return { emoji: '🎉', message: 'すごい！' }
  }
  if (correctCount >= 4) {
    return { emoji: '👍', message: 'よくできました' }
  }
  return { emoji: '😊', message: 'またあそぼう！' }
}

type FlagQuizResultProps = {
  mode: QuizMode
}

export default function FlagQuizResult({ mode }: FlagQuizResultProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { level } = useParams()

  if (!isResultState(location.state)) {
    return <Navigate to="/games/flag-quiz" replace />
  }

  // 不正な level（URL直打ちなど）の場合は、このモードのむずかしさ選択画面へ戻す
  if (!isQuizLevel(level)) {
    return <Navigate to={`/games/flag-quiz/${MODE_PATH[mode]}`} replace />
  }

  const { correctCount, totalCount, score, maxScore } = location.state
  const praise = getPraise(correctCount, totalCount)
  const hasScore = typeof score === 'number' && typeof maxScore === 'number'

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.modeLabel}>
        {MODE_LABEL[mode]} ・ {LEVEL_LABEL[level]}
      </p>
      <p className={styles.score}>
        {correctCount} / {totalCount}もん せいかい！
      </p>
      {hasScore && (
        <p className={styles.scoreLine}>
          とくてん: {score} / {maxScore}てん
        </p>
      )}
      <p className={styles.praise}>
        <span aria-hidden="true">{praise.emoji}</span> {praise.message}
      </p>
      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() => navigate(`/games/flag-quiz/${MODE_PATH[mode]}/${level}/play`, { replace: true })}
        >
          もういちど
        </BigButton>
        <BigButton
          variant="secondary"
          onClick={() => navigate(`/games/flag-quiz/${MODE_PATH[mode]}`)}
        >
          べつの むずかしさ
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/games/flag-quiz')}>
          べつの クイズ
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          ホームへ
        </BigButton>
      </div>
    </main>
  )
}
