import FlagBall from '../../components/flag-ball/FlagBall'
import { flagBalls } from '../../components/flag-ball/flagBalls'
import styles from './FlagPickerDialog.module.css'

type FlagPickerDialogProps = {
  selectedFlagId: string
  /** 複数ボールのときは「どのボールか」が分かる文言に差し替える */
  title?: string
  ariaLabel?: string
  onSelect: (flagId: string) => void
  onClose: () => void
}

const DEFAULT_TITLE = 'こっきを えらぼう！'
const DEFAULT_ARIA_LABEL = 'こっきを えらぶ'

/**
 * 盤面を離れずに国旗ボールを1つ選び直すための一覧。
 * 選択と同時に閉じるため、幼児が「えらぶ → 決定」と2回押す必要はない。
 */
export default function FlagPickerDialog({
  selectedFlagId,
  title = DEFAULT_TITLE,
  ariaLabel = DEFAULT_ARIA_LABEL,
  onSelect,
  onClose,
}: FlagPickerDialogProps) {
  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="こっきえらびを とじる">
            とじる
          </button>
        </header>
        <div className={styles.grid} role="group" aria-label="こっき">
          {flagBalls.map((flag) => {
            const selected = flag.id === selectedFlagId
            return (
              <button
                key={flag.id}
                type="button"
                className={[styles.cell, selected ? styles.selected : ''].filter(Boolean).join(' ')}
                aria-pressed={selected}
                aria-label={flag.nameJa}
                onClick={() => onSelect(flag.id)}
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
