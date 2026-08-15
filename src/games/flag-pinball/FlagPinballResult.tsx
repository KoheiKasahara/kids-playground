import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findPinballFlag } from './data/pinballFlags'
import { parsePinballResultState } from './playState'
import { playPinballTotalSound } from '../../utils/quizSound'
import styles from './FlagPinballResult.module.css'

/**
 * 締めの一言。得点にかかわらず必ずポジティブにするため、「ざんねん」「しっぱい」等は
 * 一切含めない。合計点そのものではなく合計点を種にした選択にして、同じ結果でも
 * 毎回同じ文言になり過ぎないよう軽くバリエーションを持たせる（低得点でも否定的にはしない）。
 */
const PRAISE_MESSAGES = ['たのしかったね！', 'ナイスボール！', 'ごうけい すごい！', 'また あそぼうね！']

function pickPraise(total: number): string {
  return PRAISE_MESSAGES[total % PRAISE_MESSAGES.length]
}

export default function FlagPinballResult() {
  const navigate = useNavigate()
  const location = useLocation()

  // フックはコンポーネント本体の先頭で無条件に呼ぶ必要があるため、parse による
  // early return より前に置く。location.state は不正な形のこともあるので、
  // 以降はこの検証済み変数だけを参照する（total は不正時は安全な0にフォールバックする）。
  const resultState = parsePinballResultState(location.state)
  const total = resultState ? resultState.scores.reduce((sum, score) => sum + score, 0) : 0

  // マウント時に一度だけ鳴らす。resultState は同じ画面にとどまる限り参照が変わらないため、
  // 依存配列に入れても「得点確定のたびに鳴り直す」ことにはならない。
  useEffect(() => {
    if (!resultState) return
    playPinballTotalSound()
  }, [resultState])

  if (!resultState) {
    return <Navigate to="/games/flag-pinball" replace />
  }
  const { mode, flagIds, scores } = resultState
  const isAllFlags = mode === 'allFlags'

  const rows = flagIds.map((flagId, ballIndex) => {
    const flag = findPinballFlag(flagId)
    if (!flag) throw new Error(`flag-pinball: 不明な flagId です: ${flagId}`)
    return { flag, score: scores[ballIndex] }
  })

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>けっか</h1>

      <div className={styles.summary}>
        {/*
          全射出モードは40行あり縦一列だと画面外へ出るため、この <ul> だけを
          max-height + overflow-y: auto のスクロール領域にする（.rowsCompact）。
          「ごうけい」「ほめ言葉」「3つのボタン」はこの要素の外に置いてあるので、
          どれだけスクロールしてもどの端末でも常に見える／押せる。
        */}
        <ul className={isAllFlags ? `${styles.rows} ${styles.rowsCompact}` : styles.rows}>
          {rows.map(({ flag, score }) => (
            <li key={flag.id} className={isAllFlags ? `${styles.row} ${styles.rowCompact}` : styles.row}>
              <FlagBall flag={flag} size={isAllFlags ? 36 : 56} />
              <span className={styles.name}>{flag.nameJa}</span>
              <span className={styles.rowScore}>{score}てん</span>
            </li>
          ))}
        </ul>

        {/* 「ごうけい」と点数を2行に分けて、狭い画面で「300て / ん！」のような
            読みにくい折り返しが起きないようにしつつ、点数そのものを最大に見せる */}
        <p className={styles.total}>
          <span className={styles.totalLabel}>ごうけい</span>
          <span className={styles.totalValue}>{total}てん！</span>
        </p>
        <p className={styles.praise}>{pickPraise(total)}</p>
      </div>

      <div className={styles.actions}>
        <BigButton
          variant="primary"
          onClick={() => navigate('/games/flag-pinball/play', { replace: true, state: { mode, flagIds } })}
        >
          もういちど
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/games/flag-pinball', { replace: true })}>
          ボールをかえる
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          ホームへ
        </BigButton>
      </div>
    </main>
  )
}
