import { useLocation, useNavigate } from 'react-router-dom'
import styles from './GameBackButton.module.css'
import { gameBackPath } from './gameBackPath'

type Props = {
  to?: string
  onBack?: () => void
  onClick?: () => void
  label?: string
  ariaLabel?: string
  reserveSpace?: boolean
}

/** 全ゲーム共通の固定戻るボタン。画面内状態へ戻す場合はコールバックを渡す。 */
export default function GameBackButton({ to, onBack, onClick, label, ariaLabel, reserveSpace = false }: Props = {}) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const backPath = to ?? gameBackPath(pathname)
  const handleBack = onBack ?? onClick

  if (!backPath && !handleBack) return null

  return (
    <>
      <button
        type="button"
        className={styles.back}
        onClick={handleBack ?? (() => navigate(backPath!))}
        aria-label={ariaLabel ?? label ?? 'もどる'}
        data-game-back-button
      >
        <span aria-hidden="true">←</span> もどる
      </button>
      <span
        className={`${styles.slot} ${reserveSpace ? styles.slotVisible : ''}`}
        aria-hidden="true"
        data-game-back-layout-slot
      />
    </>
  )
}
