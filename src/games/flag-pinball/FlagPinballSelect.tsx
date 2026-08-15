import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from '../../components/flag-ball/FlagBall'
import { pinballFlags } from './data/pinballFlags'
import { isSelectionComplete, MAX_SELECTION, remainingCount, toggleSelection } from './selection'
import { primeAudio } from '../../utils/quizSound'
import styles from './FlagPinballSelect.module.css'

/** ボールの選択状況インジケータに並べる丸の数。MAX_SELECTION と同じ意味の値だが、
 * 「見た目の丸の数」と「選択できる上限」が今後別の理由で変わりうるので、あえて別名で持つ。 */
const INDICATOR_DOTS = MAX_SELECTION

export default function FlagPinballSelect() {
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>([])
  const complete = isSelectionComplete(selected)
  const remaining = remainingCount(selected)

  const toggle = (flagId: string) => {
    setSelected((prev) => toggleSelection(prev, flagId))
  }

  const play = () => {
    if (!complete) return
    // iOS はユーザー操作イベントの中で AudioContext を用意しないと、以降の効果音が鳴らない。
    primeAudio()
    navigate('/games/flag-pinball/play', { state: { flagIds: selected } })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>こっきピンボール</h1>
        <p className={styles.instruction}>ボールを 3こ えらんでね！</p>
        <div className={styles.indicator}>
          <span className={styles.dots} aria-hidden="true">
            {Array.from({ length: INDICATOR_DOTS }, (_, i) => (
              <span key={i} className={i < selected.length ? styles.dotFilled : styles.dotEmpty} />
            ))}
          </span>
          <p className={styles.status} role="status" aria-live="polite">
            {complete ? 'じゅんび OK！' : `あと${remaining}こ！`}
          </p>
        </div>
      </header>

      <div className={styles.grid}>
        {pinballFlags.map((flag) => {
          const isSelected = selected.includes(flag.id)
          const disabledLook = complete && !isSelected
          return (
            <button
              key={flag.id}
              type="button"
              className={[styles.cell, isSelected ? styles.selected : '', disabledLook ? styles.dimmed : ''].filter(Boolean).join(' ')}
              aria-pressed={isSelected}
              onClick={() => toggle(flag.id)}
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
        <BigButton variant="primary" disabled={!complete} onClick={play}>
          あそぶ！
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
