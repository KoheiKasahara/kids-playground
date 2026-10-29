import { useCallback, useEffect, useRef, useState } from 'react'
import { observeGameActivity } from '../../utils/gameActivity'
import { vibrate } from '../../utils/haptics'
import { createJellyGame, planJellyDrop, type JellyFrame, type JellyGame, type JellyTurn } from './jellyGame'
import { playJellySound } from './sounds'

export function useJellyGame() {
  const [game, setGame] = useState(createJellyGame)
  const [frame, setFrame] = useState<JellyFrame | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const gameRef = useRef(game)
  const history = useRef<JellyGame | null>(null)
  const pending = useRef<{ turn: JellyTurn; index: number } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const active = useRef(true)
  const mounted = useRef(false)

  const advance = useCallback(function nextFrame() {
    const progress = pending.current
    if (!progress || !mounted.current || !active.current) return
    const next = progress.turn.frames[progress.index++]
    if (!next) {
      gameRef.current = progress.turn.result
      setGame(progress.turn.result)
      setFrame(null)
      pending.current = null
      setCanUndo(true)
      if (progress.turn.result.status !== 'playing') {
        playJellySound(progress.turn.result.status === 'won' ? 'win' : 'full')
        vibrate(progress.turn.result.status === 'won' ? 'celebrate' : 'error')
      }
      return
    }
    setFrame(next)
    if (next.kind === 'drop' || next.kind === 'land' || next.kind === 'merge') {
      playJellySound(next.kind, next.chain)
      if (next.kind !== 'drop') vibrate(next.kind === 'merge' ? 'success' : 'tap')
    }
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    timer.current = setTimeout(nextFrame, reduced ? 35 : next.duration)
  }, [])

  useEffect(() => {
    mounted.current = true
    const stop = observeGameActivity((visible) => {
      active.current = visible
      clearTimeout(timer.current)
      if (visible && pending.current) timer.current = setTimeout(advance, 100)
    })
    return () => {
      mounted.current = false
      clearTimeout(timer.current)
      pending.current = null
      stop()
    }
  }, [advance])

  function drop(col: number): boolean {
    if (pending.current || !active.current) return false
    const turn = planJellyDrop(gameRef.current, col)
    if (!turn) return false
    history.current = gameRef.current
    pending.current = { turn, index: 0 }
    setCanUndo(false)
    advance()
    return true
  }
  function undo() {
    if (!history.current || pending.current) return
    gameRef.current = history.current
    setGame(history.current)
    history.current = null
    setCanUndo(false)
    playJellySound('undo')
  }
  function restart() {
    clearTimeout(timer.current)
    pending.current = null
    history.current = null
    const fresh = createJellyGame()
    gameRef.current = fresh
    setGame(fresh)
    setFrame(null)
    setCanUndo(false)
  }
  return { game, frame, busy: frame !== null, canUndo, drop, undo, restart }
}
