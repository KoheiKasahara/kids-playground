import { useState } from 'react'
import FlagBall from '../../components/flag-ball/FlagBall'
import { findFlagBall, flagBalls } from '../../components/flag-ball/flagBalls'
import styles from './FlagPickerDialog.module.css'

export type FlagPickerBall = {
  readonly id: string
  /** 複数ボールのときだけ 'A'/'B' などの短い目印を渡す。1球なら null。 */
  readonly label: string | null
  readonly flagId: string
}

type FlagPickerDialogProps = {
  /** 1〜2球ぶんの対象。1球ならかんたん・ふつうと同じ「選んだら閉じる」動きにする。 */
  balls: readonly FlagPickerBall[]
  onSelect: (ballId: string, flagId: string) => void
  onClose: () => void
}

const SINGLE_TITLE = 'こっきを えらぼう！'
const SINGLE_ARIA_LABEL = 'こっきを えらぶ'
const MULTI_TITLE = 'ボールの こっきを えらぼう！'
const MULTI_ARIA_LABEL = 'こっきを えらぶ'

/**
 * 盤面を離れずに国旗ボールを選び直すための一覧。
 *
 * ボールが1つのとき（かんたん・ふつう）は、選ぶと同時に閉じる。幼児が
 * 「えらぶ → 決定」と2回押す必要がないようにするため。
 * ボールが2つのとき（むずかしい）も、入口は同じ1つのボタン・同じダイアログに揃え、
 * ダイアログの中で「どのボールか」のタブを切り替えながら最大2個まで選べるようにする。
 */
export default function FlagPickerDialog({ balls, onSelect, onClose }: FlagPickerDialogProps) {
  const multi = balls.length > 1
  const [activeBallId, setActiveBallId] = useState(balls[0].id)
  const activeBall = balls.find((ball) => ball.id === activeBallId) ?? balls[0]

  const handleSelect = (flagId: string) => {
    onSelect(activeBall.id, flagId)
    if (!multi) {
      onClose()
      return
    }
    // 選んだら、もう一方のボールへ自動で切り替える。「A選ぶ→B選ぶ」と迷わず
    // 進められるようにするための誘導で、選び直しを妨げないようタブはいつでも押し直せる。
    const other = balls.find((ball) => ball.id !== activeBall.id)
    if (other) setActiveBallId(other.id)
  }

  return (
    <div className={styles.backdrop} role="presentation">
      <section
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label={multi ? MULTI_ARIA_LABEL : SINGLE_ARIA_LABEL}
      >
        <header className={styles.header}>
          <h2 className={styles.title}>{multi ? MULTI_TITLE : SINGLE_TITLE}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="こっきえらびを とじる">
            とじる
          </button>
        </header>
        {multi ? (
          <div className={styles.ballTabs} role="group" aria-label="どのボールの こっきか">
            {balls.map((ball) => {
              const flag = findFlagBall(ball.flagId)
              const active = ball.id === activeBall.id
              return (
                <button
                  key={ball.id}
                  type="button"
                  className={[styles.ballTab, active ? styles.ballTabActive : ''].filter(Boolean).join(' ')}
                  aria-pressed={active}
                  aria-label={`${ball.label}の こっきを えらぶ（${flag?.nameJa ?? ''}）`}
                  onClick={() => setActiveBallId(ball.id)}
                >
                  <span className={styles.ballTabLabel}>{ball.label}</span>
                  {flag ? <FlagBall flag={flag} size={26} /> : null}
                </button>
              )
            })}
          </div>
        ) : null}
        <div className={styles.grid} role="group" aria-label="こっき">
          {flagBalls.map((flag) => {
            const selected = flag.id === activeBall.flagId
            return (
              <button
                key={flag.id}
                type="button"
                className={[styles.cell, selected ? styles.selected : ''].filter(Boolean).join(' ')}
                aria-pressed={selected}
                aria-label={flag.nameJa}
                onClick={() => handleSelect(flag.id)}
              >
                <span className={styles.ballWrap}>
                  <FlagBall flag={flag} size={64} />
                  {selected ? <span className={styles.check} aria-hidden="true">✓</span> : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
