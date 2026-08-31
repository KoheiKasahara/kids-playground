import { TRAIN_TYPES, type TrainType } from './railFleetModel'
import TrainThumbnail from './TrainThumbnail'
import styles from './TrainTypePicker.module.css'

export type TrainTypePickerProps = {
  title: string
  ariaLabel: string
  /** 変更モードで、いま選ばれている車両タイプ。追加モードではnull(強調なし)。 */
  selectedType: TrainType | null
  onSelect: (trainType: TrainType) => void
  onClose: () => void
}

/**
 * 電車追加時・配置済み電車のデザイン変更時に共通で使う、見た目だけで選べる
 * 車両選択パネル。タップした瞬間に選択が確定して閉じるため、幼児が
 * 「選ぶ→決定」の2段階操作に迷わない(FlagPickerDialogと同じ考え方)。
 */
export default function TrainTypePicker({ title, ariaLabel, selectedType, onSelect, onClose }: TrainTypePickerProps) {
  return (
    <div className={styles.backdrop} role="presentation">
      <section className={styles.dialog} role="dialog" aria-modal="true" aria-label={ariaLabel}>
        <header className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="でんしゃえらびを とじる">
            とじる
          </button>
        </header>
        <div className={styles.grid} role="group" aria-label="でんしゃの みため">
          {TRAIN_TYPES.map((trainType, index) => {
            const selected = trainType === selectedType
            return (
              <button
                key={trainType}
                type="button"
                className={`${styles.cell} ${selected ? styles.selected : ''}`}
                aria-pressed={selected}
                aria-label={`でんしゃの みため ${index + 1}`}
                onClick={() => onSelect(trainType)}
              >
                <span className={styles.iconWrap}>
                  <TrainThumbnail trainType={trainType} />
                  {selected && <span className={styles.check} aria-hidden="true">✓</span>}
                </span>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
