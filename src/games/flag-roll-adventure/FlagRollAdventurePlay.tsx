import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findFlagBall } from '../../components/flag-ball/flagBalls'
import AdventureStage from './AdventureStage'
import { beginAreaMove, createAdventureState, enterArea, reachGoal, type AdventureState } from './adventureState'
import { findArea, START_AREA_ID } from './data/areas'
import { parseAdventurePlayState } from './playState'
import styles from './FlagRollAdventurePlay.module.css'

/** ゴールのボールを少し見せてから結果画面へ進む待ち時間(ms)。 */
const GOAL_TRANSITION_DELAY_MS = 800

export default function FlagRollAdventurePlay() {
  const location = useLocation()
  const playState = parseAdventurePlayState(location.state)
  if (!playState) {
    return <Navigate to="/games/flag-roll-adventure" replace />
  }

  // 「もういっかい」で同じURLへreplaceしても、エンジン・カメラ・状態を丸ごと初期化する。
  return <AdventureGame key={location.key} flagId={playState.flagId} />
}

function AdventureGame({ flagId }: { flagId: string }) {
  const navigate = useNavigate()
  const flag = findFlagBall(flagId)
  if (!flag) throw new Error(`flag-roll-adventure: 不明な flagId です: ${flagId}`)

  const [adventureState, setAdventureState] = useState<AdventureState>(() =>
    createAdventureState(START_AREA_ID),
  )
  const [announcement, setAnnouncement] = useState('')
  const goalTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const goalHandledRef = useRef(false)

  useEffect(() => {
    return () => {
      if (goalTimeoutRef.current !== null) clearTimeout(goalTimeoutRef.current)
    }
  }, [])

  const currentArea = findArea(adventureState.currentAreaId)
  if (!currentArea) throw new Error(`flag-roll-adventure: 不明な現在エリアです: ${adventureState.currentAreaId}`)

  const handleAreaEnter = (areaId: string) => {
    const enteredArea = findArea(areaId)
    if (!enteredArea) return
    setAdventureState((state) => {
      if (state.visitedAreaIds.includes(areaId)) return state
      return enterArea(beginAreaMove(state), areaId)
    })
    setAnnouncement(`${enteredArea.nameJa}エリアに はいったよ`)
  }

  const handleGoal = () => {
    if (goalHandledRef.current) return
    goalHandledRef.current = true
    setAdventureState((state) => reachGoal(state))
    setAnnouncement('ゴール！')
    goalTimeoutRef.current = setTimeout(() => {
      navigate('/games/flag-roll-adventure/goal', { replace: true, state: { flagId } })
    }, GOAL_TRANSITION_DELAY_MS)
  }

  return (
    <main className={styles.page}>
      <button type="button" className={styles.quit} onClick={() => navigate('/')}>
        やめる
      </button>

      <header className={styles.header}>
        <FlagBall flag={flag} size={32} />
        <span className={styles.areaName}>{currentArea.nameJa}</span>
      </header>

      <div className={styles.stageArea}>
        <AdventureStage
          flag={flag}
          runId={0}
          onAreaEnter={handleAreaEnter}
          onGoal={handleGoal}
        />
      </div>

      <div role="status" aria-live="polite" className={styles.announcement}>
        {announcement}
      </div>
    </main>
  )
}
