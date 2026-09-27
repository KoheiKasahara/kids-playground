import styles from './RhythmPlay.module.css'

export default function SoundToggle({ sound, onToggle }: { sound: boolean; onToggle: () => void }) {
  return <button className={styles.sound} type="button" aria-label="おと" aria-pressed={sound} onClick={onToggle}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9H8L13 5V19L8 15H4Z" />{sound
      ? <path d="M16 8Q20 12 16 16M19 5Q25 12 19 19" />
      : <path d="M17 10L22 15M22 10L17 15" />}</svg>
  </button>
}
