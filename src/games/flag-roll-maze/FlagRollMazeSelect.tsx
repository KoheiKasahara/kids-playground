import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { flagBalls } from '../../components/flag-ball/flagBalls'
import { primeAudio } from '../../utils/quizSound'
import {
  DEFAULT_MAZE_STAGE_ID,
  findMazeStageDefinition,
  MAZE_STAGES,
} from './mazeStages'
import styles from './FlagRollMazeSelect.module.css'

type SelectStep = 'flag' | 'stage'

/** こっきころころめいろの国旗とステージを順に選ぶ画面。 */
export default function FlagRollMazeSelect() {
  const navigate = useNavigate()
  const [step, setStep] = useState<SelectStep>('flag')
  const [selectedFlagId, setSelectedFlagId] = useState<string | null>(null)
  const [selectedStageId, setSelectedStageId] = useState(DEFAULT_MAZE_STAGE_ID)
  const selectedStage = findMazeStageDefinition(selectedStageId)

  const advanceToStage = () => {
    if (selectedFlagId === null) return
    // iOS Safariでは、ユーザー操作中にAudioContextを準備しておくとプレイ中の音が安定する。
    primeAudio()
    setStep('stage')
  }

  const start = () => {
    if (selectedFlagId === null) return
    navigate('/games/flag-roll-maze/play', {
      state: { flagId: selectedFlagId, stageId: selectedStageId },
    })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>こっきころころめいろ</h1>
        <p className={styles.instruction}>
          {step === 'flag' ? 'こっきを 1こ えらんでね！' : 'どの めいろで あそぶ？'}
        </p>
        <p className={styles.status} role="status" aria-live="polite">
          {step === 'flag'
            ? selectedFlagId
              ? 'じゅんび OK！'
              : 'すきな こっきを おしてね'
            : selectedStage
              ? `${selectedStage.emoji} ${selectedStage.nameJa} を えらんだよ`
              : ''}
        </p>
      </header>

      {step === 'flag' ? (
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
      ) : (
        <div className={styles.stageGrid} role="group" aria-label="ステージ">
          {MAZE_STAGES.map((stage) => {
            const isSelected = selectedStageId === stage.id
            return (
              <button
                key={stage.id}
                type="button"
                className={[styles.stageCell, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
                aria-pressed={isSelected}
                onClick={() => setSelectedStageId(stage.id)}
              >
                <span className={styles.stageEmoji} aria-hidden="true">{stage.emoji}</span>
                <span className={styles.stageName}>{stage.nameJa}</span>
                <span className={styles.stageHint}>{stage.hintJa}</span>
                {isSelected && (
                  <span className={styles.stageCheck} aria-hidden="true">
                    ✓
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className={styles.actions}>
        {step === 'flag' ? (
          <>
            <BigButton variant="primary" disabled={selectedFlagId === null} onClick={advanceToStage}>
              つぎへ
            </BigButton>
            <BigButton variant="secondary" onClick={() => navigate('/')}>
              もどる
            </BigButton>
          </>
        ) : (
          <>
            <BigButton variant="primary" onClick={start}>
              スタート！
            </BigButton>
            <BigButton variant="secondary" onClick={() => setStep('flag')}>
              こっきを かえる
            </BigButton>
          </>
        )}
      </div>
    </main>
  )
}
