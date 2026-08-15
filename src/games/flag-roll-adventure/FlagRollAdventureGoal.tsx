import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findFlagBall } from '../../components/flag-ball/flagBalls'
import { playPinballTotalSound } from '../../utils/quizSound'
import { parseAdventureGoalState } from './playState'
import styles from './FlagRollAdventureGoal.module.css'

export default function FlagRollAdventureGoal() {
  const navigate = useNavigate()
  const location = useLocation()
  const goalState = parseAdventureGoalState(location.state)
  const flag = goalState ? findFlagBall(goalState.flagId) : undefined

  useEffect(() => {
    if (!goalState) return
    // 名前はピンボール寄りだが、既存の締め音として意味が一致するためPhase 1では新規音を増やさず再利用する。
    playPinballTotalSound()
  }, [goalState])

  if (!goalState || !flag) {
    return <Navigate to="/games/flag-roll-adventure" replace />
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>ゴール！</h1>
      <div className={styles.result}>
        <div className={styles.sparkles} aria-hidden="true">
          <span className={styles.sparkleOne}>✦</span>
          <span className={styles.sparkleTwo}>✧</span>
          <span className={styles.sparkleThree}>✦</span>
        </div>
        <FlagBall flag={flag} size={140} />
        <p className={styles.name}>{flag.nameJa}</p>
      </div>

      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() =>
            navigate('/games/flag-roll-adventure/play', { replace: true, state: { flagId: flag.id } })
          }
        >
          もういっかい
        </BigButton>
        <BigButton
          variant="secondary"
          onClick={() => navigate('/games/flag-roll-adventure', { replace: true })}
        >
          べつの こっき
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          やめる
        </BigButton>
      </div>
    </main>
  )
}
