import type { CSSProperties } from 'react'
import type { NumberedPrefecture } from './data/regions'
import { columnsForCount, tightColumnsForCount } from './numberPadLayout'
import styles from './PrefectureNumberPad.module.css'

type Props = {
  items: readonly NumberedPrefecture[]
  answerId: string
  selectedId: string | null
  onSelect: (id: string) => void
  /** 呼び出し元のCSSからレイアウトを調整するための追加クラス（属性セレクタ依存を避けるため）。 */
  className?: string
}

/** 地図が読み取りにくくても、地方内の固定番号がわかれば確実に答えられる数字ボタン列。 */
export default function PrefectureNumberPad({ items, answerId, selectedId, onSelect, className }: Props) {
  const answered = selectedId !== null
  const ordered = items.slice().sort((a, b) => a.number - b.number)
  const gridStyle = {
    '--pad-columns': columnsForCount(ordered.length),
    '--pad-columns-tight': tightColumnsForCount(ordered.length),
  } as CSSProperties

  return (
    <div role="group" aria-label="ばんごうで こたえる" className={[styles.pad, className].filter(Boolean).join(' ')} style={gridStyle}>
      {ordered.map(({ prefecture, number }) => {
        const isAnswer = prefecture.id === answerId
        const isSelected = prefecture.id === selectedId
        const state = !answered ? 'primary' : isAnswer ? 'correct' : isSelected ? 'wrong' : 'muted'
        return (
          <button
            key={prefecture.id}
            type="button"
            className={`${styles.button} ${styles[state]}`}
            disabled={answered}
            aria-label={answered ? `${number}ばん ${prefecture.nameHiragana}` : `${number}ばん`}
            onClick={() => onSelect(prefecture.id)}
          >
            {number}
            <span aria-hidden="true" className={styles.mark}>{answered && isAnswer ? '◯' : answered && isSelected ? '✕' : ''}</span>
          </button>
        )
      })}
    </div>
  )
}
