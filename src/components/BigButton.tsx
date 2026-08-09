import type { ButtonHTMLAttributes, ReactNode } from 'react'
import styles from './BigButton.module.css'

type Variant = 'primary' | 'secondary' | 'correct' | 'wrong'

type BigButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode
  variant?: Variant
}

const variantClass: Record<Variant, string> = {
  primary: styles.primary,
  secondary: styles.secondary,
  correct: styles.correct,
  wrong: styles.wrong,
}

export default function BigButton({
  children,
  variant = 'primary',
  type = 'button',
  className,
  ...rest
}: BigButtonProps) {
  const classes = [styles.button, variantClass[variant], className]
    .filter(Boolean)
    .join(' ')

  return (
    <button type={type} className={classes} {...rest}>
      {children}
    </button>
  )
}
