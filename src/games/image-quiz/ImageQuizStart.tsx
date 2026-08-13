import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import { IMAGE_QUIZ_MODE_PATH } from './types'
import type { ImageQuizConfig } from './types'
import styles from './ImageQuiz.module.css'

type ImageQuizStartProps = {
  config: ImageQuizConfig
}

export default function ImageQuizStart({ config }: ImageQuizStartProps) {
  const navigate = useNavigate()

  return (
    <main className={styles.startPage}>
      <span className={styles.hero} aria-hidden="true">{config.hero}</span>
      <h1 className={styles.title}>{config.title}</h1>
      <p className={styles.description}>ぜんぶで 10もん あるよ</p>
      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() => navigate(`${config.basePath}/${IMAGE_QUIZ_MODE_PATH.imageToName}/play`)}
        >
          <span aria-hidden="true">🖼️</span> イラストを みて こたえる
        </BigButton>
        <BigButton
          variant="primary"
          onClick={() => navigate(`${config.basePath}/${IMAGE_QUIZ_MODE_PATH.nameToImage}/play`)}
        >
          <span aria-hidden="true">🔎</span> なまえを みて こたえる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
