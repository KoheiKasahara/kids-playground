import { useCallback, useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { SPEAKER_NAMES, STORY, type Speaker } from './story'
import { STORY_H, STORY_W, drawStory } from './storyArt'
import type { RideColor } from './stages'
import { playSelect, playTalk } from './sounds'
import { reducedMotion } from './view'
import styles from './DotBomb.module.css'

const PITCH: Partial<Record<Speaker, number>> = { pon: 1.25, elder: .8, king: .6, pyonta: 1.7, puni: 1.1, worm: .55, penguin: .9, dragon: .5 }

export default function StoryScreen({ sceneId, onDone, onExit }: { sceneId: string; onDone: () => void; onExit: () => void }) {
  useGameIntroPlaying(true)
  const scene = STORY[sceneId]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [line, setLine] = useState(0)
  const [shown, setShown] = useState(0)
  const current = scene.lines[Math.min(line, scene.lines.length - 1)]
  const text = current.text
  const done = shown >= text.length
  const lineRef = useRef({ line, shown, text })
  useEffect(() => { lineRef.current = { line, shown, text } }, [line, shown, text])
  const color: RideColor = current.color ?? scene.lines.find(l => l.color)?.color ?? 'green'

  // もじを ひとつずつ だす
  useEffect(() => {
    if (shown >= text.length) return undefined
    const still = reducedMotion()
    const timer = setTimeout(() => {
      setShown(n => Math.min(text.length, still ? text.length : n + 1))
      if (shown % 2 === 0 && current.who !== 'narrator') playTalk(PITCH[current.who] ?? 1)
    }, 34)
    return () => clearTimeout(timer)
  }, [shown, text, current.who])

  // ぶたいの え
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    if (!canvas || !ctx) return undefined
    canvas.width = STORY_W
    canvas.height = STORY_H
    ctx.imageSmoothingEnabled = false
    let frame = 0
    const start = performance.now()
    const still = reducedMotion()
    const draw = (now: number) => {
      const t = still ? 0 : (now - start) / 1000
      const { line: l, shown: s, text: tx } = lineRef.current
      const who = scene.lines[l]?.who ?? null
      try { drawStory(ctx, scene.bg, scene.cast, s < tx.length && who !== 'narrator' ? who : null, color, t, false) } catch { /* え なしで つづける */ }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [scene, color])

  const advance = useCallback(() => {
    primeAudio()
    const { line: l, shown: s, text: tx } = lineRef.current
    if (s < tx.length) { setShown(tx.length); return }
    if (l + 1 < scene.lines.length) {
      playSelect()
      setLine(l + 1)
      setShown(0)
      return
    }
    onDone()
  }, [scene, onDone])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, a')) return
      if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'z') { e.preventDefault(); if (!e.repeat) advance() }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [advance])

  const name = SPEAKER_NAMES[current.who]
  return <GamePlaySurface><main className={styles.story} data-bg={scene.bg} onClick={advance}>
    <h1 className={styles.srOnly}>ドットの ボンボンぼうけん おはなし</h1>
    <div className={styles.storyStage}>
      <canvas ref={canvasRef} className={styles.storyCanvas} aria-hidden="true" />
    </div>
    <GameBackButton onBack={onExit} />
    <button type="button" className={`${styles.window} ${styles.skip}`} onClick={e => { e.stopPropagation(); onDone() }}>スキップ ▶▶</button>
    <section className={`${styles.window} ${styles.talk}`} aria-live="polite" data-who={current.who}>
      {name && <span className={styles.talkName}>{name}</span>}
      <p className={current.who === 'narrator' ? styles.narration : undefined}>
        <span>{text.slice(0, shown)}</span><span className={styles.talkRest} aria-hidden="true">{text.slice(shown)}</span>
      </p>
      <button type="button" className={styles.talkNext} onClick={e => { e.stopPropagation(); advance() }} aria-label={done ? (line + 1 < scene.lines.length ? 'つぎへ' : 'おわり') : 'ぜんぶ ひょうじ'}>
        {done ? (line + 1 < scene.lines.length ? '▼' : 'OK') : '…'}
      </button>
    </section>
  </main></GamePlaySurface>
}
