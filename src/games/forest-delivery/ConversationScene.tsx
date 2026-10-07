import { useEffect, useEffectEvent, useRef, useState } from 'react'
import type { Season } from './art'
import { moodsAt, SPEAKER_NAMES, type Conversation } from './dialogue'
import { drawConversation, SCENE_HEIGHT, SCENE_WIDTH } from './portraits'
import styles from './ForestDeliveryPlay.module.css'

const LETTERS_PER_SECOND = 18

/**
 * The map gives way to a picture-book conversation. Words type out one by one; a tap
 * shows the whole line, the next tap turns the page, and the last one returns to the map.
 */
export default function ConversationScene({ conversation, season, onLine, onDone }: {
  conversation: Conversation; season: Season; onLine: () => void; onDone: () => void
}) {
  const [index, setIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)
  const advanceButton = useRef<HTMLButtonElement>(null)
  const started = useRef<number | null>(null)
  const line = conversation.lines[index]
  const last = index === conversation.lines.length - 1
  const typed = shown >= line.text.length
  const name = SPEAKER_NAMES[line.speaker]

  const tick = useEffectEvent((now: number) => {
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    started.current ??= now
    const count = reducedMotion ? line.text.length : Math.min(line.text.length, Math.floor((now - started.current) / 1000 * LETTERS_PER_SECOND))
    if (count > shown) setShown(count)
    const ctx = canvas.current?.getContext('2d')
    if (ctx) drawConversation(ctx, {
      season, partner: conversation.partner, speaker: line.speaker, moods: moodsAt(conversation, index),
      time: now / 1000, talking: count < line.text.length, reducedMotion,
    })
  })

  useEffect(() => {
    advanceButton.current?.focus()
    let frame = requestAnimationFrame(function loop(now) {
      frame = requestAnimationFrame(loop)
      if (!document.hidden) tick(now)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  const advance = () => {
    if (!typed) { setShown(line.text.length); return }
    if (last) { onDone(); return }
    started.current = null
    setShown(0)
    setIndex(index + 1)
    onLine()
  }

  return <div className={styles.talk} role="group" aria-label={`${SPEAKER_NAMES[conversation.partner]}と おはなし`} data-testid="conversation">
    <canvas ref={canvas} width={SCENE_WIDTH} height={SCENE_HEIGHT} className={styles.talkScene} aria-hidden="true" />
    <div className={styles.talkBox} aria-hidden="true">
      <span className={`${styles.talkName} ${line.speaker === 'fox' ? '' : styles.talkNamePartner}`}>{name}</span>
      {/* The untyped rest keeps its space so the box never jumps while letters appear. */}
      <p><span>{line.text.slice(0, shown)}</span><span className={styles.talkRest}>{line.text.slice(shown)}</span></p>
      {typed && <span className={styles.talkNext}>{last ? '■' : '▼'}</span>}
    </div>
    <p className={styles.srOnly} aria-live="polite">{name}「{line.text}」</p>
    <button ref={advanceButton} className={styles.talkAdvance} aria-label={last && typed ? 'おわる' : 'つぎへ'} onClick={advance} />
    {!last && <button className={styles.talkSkip} onClick={onDone}>とばす <span aria-hidden="true">≫</span></button>}
  </div>
}
