import FlagImage from './FlagImage'
import type { Country } from './types'
import styles from './FlagChoiceGrid.module.css'

type FlagChoiceGridProps = {
  choices: readonly Country[]
  answer: Country
  selectedId: string | null
  disabled: boolean
  onSelect: (countryId: string) => void
  className?: string
}

export default function FlagChoiceGrid({ choices, answer, selectedId, disabled, onSelect, className }: FlagChoiceGridProps) {
  const answered = selectedId !== null
  return (
    <div className={[styles.grid, className].filter(Boolean).join(' ')}>
      {choices.map((choice, index) => {
        const correct = choice.id === answer.id
        const wrong = answered && choice.id === selectedId && !correct
        const choiceClassName = [styles.choice, answered && correct ? styles.correct : '', wrong ? styles.wrong : '']
          .filter(Boolean)
          .join(' ')
        return (
          <button
            key={choice.id}
            type="button"
            className={choiceClassName}
            disabled={disabled}
            aria-label={`${index + 1}ばんめ の こっき`}
            onClick={() => onSelect(choice.id)}
          >
            <FlagImage country={choice} size="choice" />
            {answered && correct && <span className={`${styles.badge} ${styles.badgeCorrect}`} aria-hidden="true">◯</span>}
            {wrong && <span className={`${styles.badge} ${styles.badgeWrong}`} aria-hidden="true">✕</span>}
          </button>
        )
      })}
    </div>
  )
}
