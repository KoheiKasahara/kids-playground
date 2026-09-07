import { useState, type ReactNode } from 'react'
import { GameIntroState } from './gameIntroState'

export default function GameIntroProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false)
  return <GameIntroState.Provider value={{ playing, setPlaying }}>{children}</GameIntroState.Provider>
}
