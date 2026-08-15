import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { flagBalls } from '../../components/flag-ball/flagBalls'
import { primeAudio } from '../../utils/quizSound'
import styles from './FlagRollAdventureSelect.module.css'

export default function FlagRollAdventureSelect() {
  const navigate = useNavigate()
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null)

  const start = () => {
    if (!selectedFlagId) return
    // iOS Safariはユーザー操作の中でAudioContextを用意しないと、プレイ中の音を止めることがある。
    primeAudio()
    navigate('/games/flag-roll-adventure/play', { state: { flagId: selectedFlagId } })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>こっきコロコロぼうけん</h1>
        <p className={styles.instruction}>こっきを 1こ えらんでね！</p>
        <p className={styles.status} role="status" aria-live="polite">
          {selectedFlagId ? 'じゅんび OK！' : 'すきな こっきを おしてね'}
        </p>
      </header>

      <div className={styles.grid}>
        {flagBalls.map((flag) => {
          const isSelected = selectedFlagId === flag.id
          return (
            <button
              key={flag.id}
              type="button"
              className={[styles.cell, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
              aria-pressed={isSelected}
              onClick={() => setSelectedFlagId(flag.id)}
            >
              <span className={styles.ballWrap}>
                <FlagBall flag={flag} size={72} />
                {isSelected && (
                  <span className={styles.check} aria-hidden="true">
                    ✓
                  </span>
                )}
              </span>
              <span className={styles.name}>{flag.nameJa}</span>
            </button>
          )
        })}
      </div>

      <div className={styles.actions}>
        <BigButton variant="primary" disabled={!selectedFlagId} onClick={start}>
          スタート！
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
