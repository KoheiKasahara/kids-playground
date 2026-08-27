import type { SolarSystemMode } from '../types'
import styles from './ModeToggle.module.css'

type ModeToggleProps = {
  mode: SolarSystemMode
  onChange: (mode: SolarSystemMode) => void
}

/**
 * 「ひとつずつ」(個別観察)と「ぜんぶみる」(太陽系全体表示)の切り替え。
 * 幼児向けなので小さな文字タブにはせず、アイコン+短い文字の大きなボタン2つにする。
 */
export default function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className={styles.group} role="group" aria-label="みかたを えらぶ">
      <button
        type="button"
        className={mode === 'single' ? `${styles.button} ${styles.selected}` : styles.button}
        aria-pressed={mode === 'single'}
        onClick={() => onChange('single')}
      >
        <span aria-hidden="true">🔭</span> ひとつずつ
      </button>
      <button
        type="button"
        className={mode === 'overview' ? `${styles.button} ${styles.selected}` : styles.button}
        aria-pressed={mode === 'overview'}
        onClick={() => onChange('overview')}
      >
        <span aria-hidden="true">🪐</span> ぜんぶみる
      </button>
    </div>
  )
}
