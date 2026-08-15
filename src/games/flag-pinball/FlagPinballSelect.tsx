import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BigButton from '../../components/BigButton'
import FlagBall from './FlagBall'
import { PINBALL_FLAG_IDS, pinballFlags } from './data/pinballFlags'
import { isSelectionComplete, MAX_SELECTION, remainingCount, toggleSelection } from './selection'
import type { PinballMode } from './types'
import { primeAudio } from '../../utils/quizSound'
import styles from './FlagPinballSelect.module.css'

/** ボールの選択状況インジケータに並べる丸の数。MAX_SELECTION と同じ意味の値だが、
 * 「見た目の丸の数」と「選択できる上限」が今後別の理由で変わりうるので、あえて別名で持つ。 */
const INDICATOR_DOTS = MAX_SELECTION

export default function FlagPinballSelect() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<PinballMode>('normal')
  // 選択内容はモードを切り替えても保持する（'normal' に戻したときに選び直しにならないように）。
  const [selected, setSelected] = useState<string[]>([])
  const complete = isSelectionComplete(selected)
  const remaining = remainingCount(selected)
  // 全射出モードは選ぶ必要がないため常に押せる。通常モードは3個そろうまで押せない。
  const canPlay = mode === 'allFlags' || complete

  const toggle = (flagId: string) => {
    setSelected((prev) => toggleSelection(prev, flagId))
  }

  const play = () => {
    if (!canPlay) return
    // iOS はユーザー操作イベントの中で AudioContext を用意しないと、以降の効果音が鳴らない。
    primeAudio()
    // 全射出モードのボール順は PINBALL_FLAG_IDS をそのまま使う（別名の一覧を新設すると
    // 国旗が増減したときに二重管理になるため、常にここから作る）。
    const flagIds = mode === 'allFlags' ? [...PINBALL_FLAG_IDS] : selected
    navigate('/games/flag-pinball/play', { state: { mode, flagIds } })
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>こっきピンボール</h1>

        <div className={styles.modeToggle} role="group" aria-label="あそびかた">
          <button
            type="button"
            className={[styles.modeButton, mode === 'normal' ? styles.modeButtonActive : ''].filter(Boolean).join(' ')}
            aria-pressed={mode === 'normal'}
            onClick={() => setMode('normal')}
          >
            3こ えらぶ
          </button>
          <button
            type="button"
            className={[styles.modeButton, mode === 'allFlags' ? styles.modeButtonActive : ''].filter(Boolean).join(' ')}
            aria-pressed={mode === 'allFlags'}
            onClick={() => setMode('allFlags')}
          >
            ぜんぶ ながす
          </button>
        </div>

        {mode === 'normal' ? (
          <>
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
          </>
        ) : (
          <p className={styles.instruction}>{pinballFlags.length}この こっきが じゅんばんに おちてくるよ！</p>
        )}
      </header>

      {mode === 'normal' && (
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
      )}

      <div className={styles.actions}>
        <BigButton variant="primary" disabled={!canPlay} onClick={play}>
          あそぶ！
        </BigButton>
        <BigButton variant="secondary" onClick={() => navigate('/')}>
          もどる
        </BigButton>
      </div>
    </main>
  )
}
