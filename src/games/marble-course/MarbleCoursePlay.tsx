import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { getSharedAudioContext, isSoundEnabled, playTone, primeAudio } from '../../audio/sound'
import { appendPart, BOARD_LIMIT, GADGET_HINTS, hasConnectedInput, initialCourse, isGadget, MAX_PARTS, needsMoreHeight, PARTS, removePart, snapPart, type Course, type PartKind } from './marbleModel'
import type { RunStatus } from './marbleWorld'
import { useMarbleEngine } from './useMarbleEngine'
import PartIcon from './PartIcon'
import styles from './MarbleCoursePlay.module.css'

export default function MarbleCoursePlay() {
  useGameIntroPlaying(true)
  const [course, setCourse] = useState(initialCourse)
  const [history, setHistory] = useState<Course[]>([])
  const [selectedId, setSelectedId] = useState<string | null>('part-0')
  const [phase, setPhase] = useState<RunStatus>('ready')
  const [sound, setSound] = useState(true)
  const [hint, setHint] = useState('パーツを つないで みよう！')
  const [category, setCategory] = useState<'paths' | 'gadgets'>('paths')
  const [confirmingClear, setConfirmingClear] = useState(false)
  const seen = useRef(new Set<PartKind>())
  // Wiping the whole board asks twice, and forgets the question if the next tap goes elsewhere.
  useEffect(() => {
    if (!confirmingClear) return
    const timer = window.setTimeout(() => setConfirmingClear(false), 4000)
    return () => window.clearTimeout(timer)
  }, [confirmingClear])
  const play = useCallback((success: boolean) => {
    if (!sound || !isSoundEnabled()) return
    const ctx = getSharedAudioContext()
    if (!ctx) return
    for (const [i, note] of (success ? [660, 830, 990] : [750]).entries()) playTone(ctx, note, ctx.currentTime + i * 0.11, 0.15, 0.06, 'sine')
  }, [sound])
  const commit = useCallback((next: Course) => {
    if (next === course) return
    setHistory(previous => [...previous.slice(-49), course])
    setCourse(next)
    setPhase('ready')
    setConfirmingClear(false)
    setHint('つづきを つなごう！')
    const added = next.parts.find(part => !course.parts.some(previous => previous.id === part.id))
    if (added && isGadget(added.kind) && !seen.current.has(added.kind)) {
      seen.current.add(added.kind)
      setHint(GADGET_HINTS[added.kind])
    }
    // Against the committed course: joining a piece can also lift everything else to make room.
    if (added && course.parts.length && !hasConnectedInput(added, next.parts)) {
      setHint(needsMoreHeight(course, added.kind, selectedId) ? 'たかさが いっぱい！ べつの ところに おいたよ' : 'ここに おいたよ。みちを つなぎなおそう！')
    }
  }, [course, selectedId])
  const onPhase = useCallback((next: RunStatus) => {
    setPhase(next)
    if (next === 'goal') play(true)
    if (next === 'ready') setHint('みちを つないで また ころがそう！')
  }, [play])
  const onSnap = useCallback(() => { play(false) }, [play])
  const onEvent = useCallback(() => play(false), [play])
  const { registerContainer, status, roll, stop, palette, nextId, retry, zoom, overview } = useMarbleEngine({ course, selectedId, onCommit: commit, onSelect: setSelectedId, onPhase, onSnap, onHint: setHint, onEvent })
  const selected = course.parts.find(part => part.id === selectedId)
  const rolling = phase === 'rolling'
  const locked = status !== 'ready' || rolling
  const add = (kind: PartKind) => {
    const next = appendPart(course, kind, nextId(), selectedId)
    if (next === course) { setHint('あいている ところへ うごかそう！'); return }
    commit(next)
    setSelectedId(next.parts.at(-1)!.id)
    if (hasConnectedInput(next.parts.at(-1)!, next.parts)) onSnap()
  }
  const rotate = () => {
    if (!selected) return
    const turned = { ...selected, rotation: (selected.rotation + 1) % 4 }
    const result = snapPart(turned, course.parts)
    commit({ ...course, parts: course.parts.map(part => part.id === selectedId ? result.part : part) })
    if (result.snapped) onSnap()
  }
  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    stop()
    setCourse(previous)
    setHistory(items => items.slice(0, -1))
    setSelectedId(previous.parts.at(-1)?.id ?? null)
    setConfirmingClear(false)
  }
  /** One tap removes only the chosen piece, so the whole course is never lost by mistake. */
  const erase = () => {
    if (!selected) return
    stop()
    const index = course.parts.findIndex(part => part.id === selectedId)
    const next = removePart(course, selectedId)
    commit(next)
    setSelectedId(next.parts[Math.min(index, next.parts.length - 1)]?.id ?? null)
    setHint(next.parts.length ? 'けしたよ。もどすで もどせるよ！' : 'パーツを つないで みよう！')
  }
  const eraseAll = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      setHint('ぜんぶ けす？ もういちど おしてね')
      return
    }
    stop()
    commit({ parts: [], startId: null })
    setSelectedId(null)
    setHint('ぜんぶ けしたよ。もどすで もどせるよ！')
  }
  const keyboard = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!locked && selected && ['Delete', 'Backspace'].includes(event.key)) {
      event.preventDefault()
      erase()
      return
    }
    if (locked || !selected || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const position = { ...selected.position }
    if (event.key === 'ArrowUp') position.z -= 0.5
    if (event.key === 'ArrowDown') position.z += 0.5
    if (event.key === 'ArrowLeft') position.x -= 0.5
    if (event.key === 'ArrowRight') position.x += 0.5
    position.x = Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT, position.x))
    position.z = Math.max(-BOARD_LIMIT, Math.min(BOARD_LIMIT, position.z))
    // Arrow keys move freely; Enter finishes the connection below.
    commit({ ...course, parts: course.parts.map(part => part.id === selectedId ? { ...selected, position } : part) })
  }
  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton to="/" />
      <h1 aria-label="3Dビーだまコースづくり"><span className={styles.marbleIcon} aria-hidden="true" />ビーだまコース</h1>
      <button type="button" className={styles.sound} aria-label="おと" aria-pressed={sound} onClick={() => { if (!sound) primeAudio(); setSound(value => !value) }}>{sound ? '🔊' : '🔇'}</button>
    </header>
    <div className={styles.scene} ref={registerContainer} data-testid="marble-scene" role="application" aria-label="ビーだまの コース。パーツを ドラッグで うごかせるよ。なにもない ところを なぞると カメラが うごき、ゆび2ほんで おおきさが かわるよ" tabIndex={0} onKeyDown={event => {
      keyboard(event)
      if (event.key === 'Enter' && selected && !locked) {
        const result = snapPart(selected, course.parts)
        if (result.snapped) { commit({ ...course, parts: course.parts.map(part => part.id === selectedId ? result.part : part) }); onSnap() }
      }
    }}>
      <div className={styles.caption} role="status">{rolling ? '● ころころ…' : phase === 'goal' ? '⭐ ゴール！ やったね！' : hint}</div>
      {course.parts.length === 0 && <div className={styles.empty}><span aria-hidden="true">↓</span>したの パーツを<br />ここへ はこんでね</div>}
      <div className={styles.camera} aria-label="カメラ">
        <button type="button" aria-label="ちかづく" onClick={() => zoom(0.2)}>＋</button>
        <button type="button" aria-label="はなれる" onClick={() => zoom(-0.2)}>−</button>
        <button type="button" aria-label="ぜんたいを みる" onClick={overview}>▣</button>
      </div>
      {phase === 'goal' && <div className={styles.success} aria-hidden="true"><span>✦</span><strong>★</strong><span>✦</span></div>}
      {status !== 'ready' && <div className={styles.loading} role={status === 'error' ? 'alert' : 'status'}>
        <span className={styles.marbleIcon} aria-hidden="true" />
        <strong>{status === 'error' ? 'じゅんびを やりなおそう' : 'ビーだまを じゅんびちゅう…'}</strong>
        {status === 'error' && <button type="button" onClick={retry}>もういちど</button>}
      </div>}
      <div className={styles.sceneFooter}><span>🚩 ここから スタート</span><span>{course.parts.length} / {MAX_PARTS}</span></div>
    </div>
    <section className={styles.workbench} aria-label="コースを つくる">
      <div className={styles.tools}>
        <button type="button" disabled={locked || !selected} onClick={rotate}><span aria-hidden="true">↻</span>まわす</button>
        <button type="button" disabled={locked || !selected || selected.kind === 'goal'} aria-pressed={Boolean(selected && selectedId === course.startId)} onClick={() => { commit({ ...course, startId: selectedId }); setHint('ここから ころがすよ！') }}><span aria-hidden="true">🚩</span>スタート</button>
        <button type="button" disabled={locked || !history.length} onClick={undo}><span aria-hidden="true">↶</span>もどす</button>
        <button type="button" disabled={locked || !selected} onClick={erase}><span aria-hidden="true">🗑</span>けす</button>
        <button type="button" className={styles.eraseAll} data-confirming={confirmingClear || undefined} disabled={locked || !course.parts.length} onClick={eraseAll}><span aria-hidden="true">⌫</span>{confirmingClear ? 'ほんとに？' : 'ぜんぶけす'}</button>
      </div>
      <div className={styles.tabs} role="tablist" aria-label="パーツの しゅるい">
        {(['paths', 'gadgets'] as const).map(value => <button type="button" role="tab" id={`tab-${value}`} key={value} aria-controls="part-palette" aria-selected={category === value} tabIndex={category === value ? 0 : -1} onClick={() => setCategory(value)} onKeyDown={event => {
          if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
            event.preventDefault()
            const next = event.key === 'Home' ? 'paths' : event.key === 'End' ? 'gadgets' : category === 'paths' ? 'gadgets' : 'paths'
            setCategory(next)
            document.getElementById(`tab-${next}`)?.focus()
          }
        }}><span aria-hidden="true">{value === 'paths' ? '⌁' : '✦'}</span>{value === 'paths' ? 'みち' : 'しかけ'}</button>)}
      </div>
      <div className={styles.palette} id="part-palette" role="tabpanel" aria-labelledby={`tab-${category}`}>
        {PARTS.filter(part => isGadget(part.kind) === (category === 'gadgets')).map(part => <button type="button" key={part.kind} style={{ '--part-color': part.color } as CSSProperties} aria-label={`${part.label}を ついか`} disabled={locked || course.parts.length >= MAX_PARTS} onPointerDown={event => { if (sound) primeAudio(); event.currentTarget.setPointerCapture(event.pointerId); palette(part.kind, event.nativeEvent) }} onClick={event => { if (event.detail === 0) add(part.kind) }}>
          <PartIcon kind={part.kind} /><strong>{part.label}</strong>
        </button>)}
      </div>
      {selected?.kind === 'spinner' && <div className={styles.settings} aria-label="くるくるの せってい">
        <button type="button" disabled={locked} aria-label={`はやさ：${selected.settings.speed === 'slow' ? 'ゆっくり' : 'はやい'}`} onClick={() => commit({ ...course, parts: course.parts.map(part => part.id === selected.id ? { ...selected, settings: { ...selected.settings, speed: selected.settings.speed === 'slow' ? 'fast' : 'slow' } } : part) })}>はやさ：{selected.settings.speed === 'slow' ? 'ゆっくり' : 'はやい'}</button>
        <button type="button" disabled={locked} aria-pressed={selected.settings.reverse} onClick={() => commit({ ...course, parts: course.parts.map(part => part.id === selected.id ? { ...selected, settings: { ...selected.settings, reverse: !selected.settings.reverse } } : part) })}><span aria-hidden="true">↶</span> ぎゃくまわり</button>
      </div>}
      <div className={styles.playRow}>
        {rolling && <button type="button" className={styles.edit} onClick={stop} aria-label="つくるに もどる">✎ つくる</button>}
        <button type="button" className={styles.roll} disabled={status !== 'ready' || !course.startId} onClick={() => { if (sound) primeAudio(); roll() }}><span className={styles.marbleIcon} aria-hidden="true" />{rolling ? 'もういちど ころがす！' : 'ビーだま ころがす！'}<span aria-hidden="true">▶</span></button>
      </div>
    </section>
  </main>
}
