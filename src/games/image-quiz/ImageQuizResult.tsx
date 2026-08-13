import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { isQuizResultState } from '../quiz-core/resultState'
import { IMAGE_QUIZ_MODE_PATH } from './types'
import type { ImageQuizConfig, ImageQuizMode } from './types'
import styles from './ImageQuiz.module.css'

type ImageQuizResultProps = {
  config: ImageQuizConfig
  mode: ImageQuizMode
}

function praiseFor(correctCount: number, totalCount: number): { emoji: string; message: string } {
  if (totalCount > 0 && correctCount === totalCount) return { emoji: '🏆', message: 'かんぺき！' }
  if (correctCount >= 7) return { emoji: '🎉', message: 'すごい！' }
  if (correctCount >= 4) return { emoji: '👍', message: 'よくできました' }
  return { emoji: '😊', message: 'またあそぼう！' }
}

export default function ImageQuizResult({ config, mode }: ImageQuizResultProps) {
  const navigate = useNavigate()
  const location = useLocation()

  if (!isQuizResultState(location.state)) return <Navigate to={config.basePath} replace />

  const { correctCount, totalCount } = location.state
  const praise = praiseFor(correctCount, totalCount)
  const modePath = IMAGE_QUIZ_MODE_PATH[mode]

  return (
    <main className={styles.resultPage}>
      <h1 className={styles.title}>けっか</h1>
      <p className={styles.modeLabel}>{mode === 'imageToName' ? 'イラスト → なまえ' : 'なまえ → イラスト'}</p>
      <p className={styles.score}>{correctCount} / {totalCount}もん せいかい！</p>
      <p className={styles.praise}><span aria-hidden="true">{praise.emoji}</span> {praise.message}</p>
      <div className={styles.actions}>
        <BigButton variant="primary" onClick={() => navigate(`${config.basePath}/${modePath}/play`, { replace: true })}>もういちど</BigButton>
        <BigButton variant="secondary" onClick={() => navigate(config.basePath)}>べつの こたえかた</BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>ホームへ</BigButton>
      </div>
    </main>
  )
}
