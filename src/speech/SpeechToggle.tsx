import { useState } from 'react'
import { isSpeechSupported } from './speechEngine'
import { setSpeechEnabled, useSpeechEnabled } from './speechSettingsStore'
import styles from './SpeechToggle.module.css'

type SpeechToggleProps = {
  className?: string
}

/**
 * 問題文よみあげの ON/OFF を切り替える小さなトグルボタン。
 * 各クイズのヘッダに置かれる想定なので、見た目は既存のヘッダ高さを絶対に超えないサイズに
 * 抑えつつ（詳細は SpeechToggle.module.css）、タップ領域は疑似要素で広げてある。
 */
export default function SpeechToggle({ className }: SpeechToggleProps) {
  // 対応状況はマウント後に変わるものではないため、初回に一度だけ判定して固定する
  // （レンダーのたびに isSpeechSupported() を呼び直して結果がちらつくのを防ぐ）。
  const [supported] = useState(() => isSpeechSupported())
  const enabled = useSpeechEnabled()

  const label = !supported
    ? 'よみあげは この きかいでは つかえません'
    : enabled
      ? 'よみあげ ON。おすと よみあげを OFF にします'
      : 'よみあげ OFF。おすと よみあげを ON にします'

  const classes = [styles.toggle, enabled && styles.toggleOn, !supported && styles.toggleUnsupported, className]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type="button"
      className={classes}
      disabled={!supported}
      aria-pressed={supported ? enabled : undefined}
      aria-label={label}
      onClick={() => setSpeechEnabled(!enabled)}
    >
      <span className={styles.icon} aria-hidden="true">
        {enabled ? '🔊' : '🔇'}
      </span>
      <span className={styles.label}>よみあげ</span>
    </button>
  )
}
