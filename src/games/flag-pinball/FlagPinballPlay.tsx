import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import FlagBall from '../../components/flag-ball/FlagBall'
import PinballBoard from './PinballBoard'
import { findPinballFlag } from './data/pinballFlags'
import { isPinballPlayState } from './playState'
import { createScoreState, recordBallScore, type PinballScoreState } from './scoring'
import styles from './FlagPinballPlay.module.css'

/** 最後の得点ポップ（例: 「1000てん！」）を見せてから結果画面へ進むまでの待ち時間(ms) */
const FINISH_TRANSITION_DELAY_MS = 700

export default function FlagPinballPlay() {
  const location = useLocation()
  if (!isPinballPlayState(location.state)) {
    return <Navigate to="/games/flag-pinball" replace />
  }
  // key={location.key} で内部コンポーネントを丸ごと作り直す。「もういちど」で同じURLへ
  // 遷移し直したときも、物理エンジン・得点・演出のすべてが確実に初期化され、
  // 「再プレイ時に前回の得点や物理状態が残らない」を構造で保証できる。
  return <PinballGame key={location.key} flagIds={location.state.flagIds} />
}

function PinballGame({ flagIds }: { flagIds: string[] }) {
  const navigate = useNavigate()
  const [scoreState, setScoreState] = useState<PinballScoreState>(() => createScoreState(flagIds))
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // onFinished は「3球目の得点を確定した直後」に物理エンジンから同期的に呼ばれるため、
  // そのときのクロージャが持つ scoreState はまだ再レンダー前の古い値になる。
  // 遷移時に最新の得点を読めるよう、コミットのたびに ref へ写しておく
  // （setState の更新関数の中で navigate すると副作用が更新関数に混ざり、
  //  StrictMode の二重実行で遷移が2回走りうるため、その方式は採らない）。
  const scoreStateRef = useRef(scoreState)
  useEffect(() => {
    scoreStateRef.current = scoreState
  })

  useEffect(() => {
    return () => {
      if (finishTimeoutRef.current !== null) clearTimeout(finishTimeoutRef.current)
    }
  }, [])

  const handleBallScored = (ballIndex: number, score: number) => {
    setScoreState((state) => recordBallScore(state, ballIndex, score))
  }

  const handleFinished = () => {
    // 最後の得点ポップ演出を見せてから結果画面へ進む。
    finishTimeoutRef.current = setTimeout(() => {
      // onFinished は3球すべての得点確定後にのみ呼ばれる契約（usePinballEngine）なので
      // null は残らない想定だが、型の上では number | null のままなので
      // ?? 0 で安全に number[] へ変換する（as によるアンセーフなキャストは避ける）。
      const scores = scoreStateRef.current.scores.map((score) => score ?? 0)
      navigate('/games/flag-pinball/result', { replace: true, state: { flagIds, scores } })
    }, FINISH_TRANSITION_DELAY_MS)
  }

  const flags = flagIds.map((flagId) => {
    const flag = findPinballFlag(flagId)
    if (!flag) throw new Error(`flag-pinball: 不明な flagId です: ${flagId}`)
    return flag
  })

  return (
    <main className={styles.page}>
      <button type="button" className={styles.quit} onClick={() => navigate('/')}>
        やめる
      </button>

      <header className={styles.header}>
        {flags.map((flag, ballIndex) => {
          const score = scoreState.scores[ballIndex]
          return (
            <div key={flag.id} className={styles.ballScore}>
              <FlagBall flag={flag} size={32} />
              <span className={styles.score}>{score === null ? '・・・' : `${score}てん`}</span>
            </div>
          )
        })}
      </header>

      <div className={styles.boardArea}>
        <PinballBoard flagIds={flagIds} runId={0} onBallScored={handleBallScored} onFinished={handleFinished} />
      </div>
    </main>
  )
}
