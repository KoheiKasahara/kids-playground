import { useCallback, useEffect, useState } from 'react'
import { primeAudio, setSoundEnabled } from './sound'

/**
 * ゲーム画面の「おと」ボタン用。全体の音の ON/OFF（setSoundEnabled）を切り替えるが、
 * 画面を離れたら必ず ON に戻す。戻さないと、ほかのゲームまで音が出なくなってしまう。
 */
export function useSoundToggle(): [sound: boolean, toggleSound: () => void] {
  const [sound, setSound] = useState(true)
  useEffect(() => {
    setSoundEnabled(true)
    return () => setSoundEnabled(true)
  }, [])
  const toggleSound = useCallback(() => {
    const next = !sound
    setSoundEnabled(next)
    if (next) primeAudio()
    setSound(next)
  }, [sound])
  return [sound, toggleSound]
}
