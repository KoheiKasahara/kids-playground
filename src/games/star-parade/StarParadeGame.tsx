import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { useSoundToggle } from '../../audio/useSoundToggle'
import GameBackButton from '../../components/GameBackButton'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import GamePlaySurface from '../../components/GamePlaySurface'
import { GOAL_COUNT, METERS_PER_STAR, upgradeCost } from './progression'
import { Icon } from './ParadeIcons'
import { useStarParade } from './useStarParade'
import { trackHalfWidth } from './world'
import styles from './StarParadeGame.module.css'

const laneNames = ['ひだり', 'まんなか', 'みぎ']

export default function StarParadeGame() {
  const { progress, result, upgrade, canvasRef, course, phase, paused, setPaused, hud, start, backToStart, steer, hold, nudge, jump } = useStarParade()
  const [sound, toggleSound] = useSoundToggle()
  const [full, setFull] = useState(false)
  const page = useRef<HTMLElement>(null)
  const field = useRef<HTMLDivElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const pointer = useRef<number | null>(null)
  const nextGate = course[hud.passed]
  useGameIntroPlaying(phase !== 'ready')

  useEffect(() => {
    if (phase === 'running' && !paused) field.current?.focus({ preventScroll: true })
    if (phase === 'finished' || (phase === 'ready' && result) || paused) action.current?.focus({ preventScroll: true })
    pointer.current = null
  }, [phase, paused, result])

  useEffect(() => {
    const update = () => setFull(document.fullscreenElement === page.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [])

  function toggleFullscreen() {
    const change = full ? document.exitFullscreen() : page.current?.requestFullscreen()
    // Embedded browsers can expose fullscreen and still deny a request.
    change?.catch(() => {})
  }

  function steerAt(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = trackHalfWidth(rect.width, rect.height)
    if (radius > 0) steer((event.clientX - rect.left - rect.width / 2) / radius)
  }

  const directionButton = (side: -1 | 1) => <button type="button" className={styles.direction}
    onPointerDown={event => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      hold(side, true)
    }}
    onPointerUp={() => hold(side, false)} onLostPointerCapture={() => hold(side, false)}
    onKeyDown={event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hold(side, true) }
    }}
    onKeyUp={event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); hold(side, false) }
    }}
    onBlur={() => hold(side, false)}
    onClick={event => { if (event.detail === 0) nudge(side) }}
    aria-label={side > 0 ? 'みぎへ' : 'ひだりへ'}>
    <Icon name={side > 0 ? 'right' : 'left'} />
  </button>

  return <main className={styles.page} ref={page} onKeyDown={event => {
    if (phase !== 'running' || paused || event.altKey || event.ctrlKey || event.metaKey) return
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      hold(event.key === 'ArrowLeft' ? -1 : 1, true)
    } else if (event.key === 'ArrowUp' || (event.key === ' ' && event.target === field.current)) {
      event.preventDefault()
      if (!event.repeat) jump()
    }
  }} onKeyUp={event => {
    if (event.key === 'ArrowLeft') hold(-1, false)
    if (event.key === 'ArrowRight') hold(1, false)
  }}>
    <header className={styles.header}>
      <GameBackButton to="/" onBack={phase === 'ready' ? undefined : backToStart} />
      <h1><Icon name="comet" />ほしぞらパレード</h1>
      <div className={styles.tools}>
        <button type="button" className={styles.tool} onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
          <Icon name={sound ? 'sound' : 'mute'} /><span>おと</span>
        </button>
        {document.fullscreenEnabled && <button type="button" className={styles.tool} onClick={toggleFullscreen}
          aria-label={full ? 'ぜんがめんを とじる' : 'ぜんがめん'} title={full ? 'ぜんがめんを とじる' : 'ぜんがめん'}>
          <Icon name={full ? 'collapse' : 'expand'} />
        </button>}
      </div>
    </header>

    <div className={styles.stage}>
      <canvas className={styles.canvas} aria-hidden="true" ref={canvasRef} />
      <div className={styles.hud}>
        <div className={styles.score} aria-label={`ほしの なかま ${hud.count}こ`}>
          <span className={styles.coin}><Icon name="star" /></span>
          <div><span className={styles.label}>ほしの なかま</span>
            <strong>{hud.count}<small>こ</small></strong></div>
          {phase === 'running' && hud.delta !== 0 && <b key={hud.passed} aria-hidden="true"
            className={styles.delta} data-loss={hud.delta < 0}>{hud.delta > 0 ? '+' : '−'}{Math.abs(hud.delta)}</b>}
        </div>
        <div className={styles.progress} role="progressbar" aria-label="コース" aria-valuemin={0}
          aria-valuemax={course.length} aria-valuenow={hud.passed}>
          <div className={styles.progressText}><span className={styles.label}>コース</span>
            <span><b>{hud.passed}</b> / {course.length}</span></div>
          <div className={styles.meter} aria-hidden="true">
            {course.map((gate, i) => <i key={gate.distance} data-filled={i < hud.passed} />)}
            <Icon name="flag" />
          </div>
        </div>
      </div>

      {phase === 'running' && !paused && <GamePlaySurface>
        {hud.hit && <span key={hud.passed} className={styles.impact} aria-hidden="true" />}
        <div className={styles.field} ref={field} tabIndex={0} role="group" aria-label="ほしを うごかす"
          aria-describedby="parade-controls"
          onPointerDown={event => {
            if (!event.isPrimary || event.button !== 0) return
            pointer.current = event.pointerId
            event.currentTarget.setPointerCapture(event.pointerId)
            steerAt(event)
          }}
          onPointerMove={event => { if (pointer.current === event.pointerId) steerAt(event) }}
          onLostPointerCapture={() => { pointer.current = null }} />
        <div className={styles.steering}>
          <div className={styles.directions}>{directionButton(-1)}{directionButton(1)}</div>
          <button className={styles.pause} type="button" aria-label="ひとやすみ" onClick={() => setPaused(true)}>
            <Icon name="pause" />
          </button>
          <button className={styles.jump} type="button"
            onPointerDown={event => {
              if (event.button !== 0) return
              // A second thumb can jump while the first one is still steering.
              if (event.pointerType === 'touch') event.preventDefault()
              jump()
            }}
            onClick={event => { if (event.detail === 0) jump() }}>
            <Icon name="jump" />ジャンプ
          </button>
        </div>
      </GamePlaySurface>}

      {(phase === 'ready' || phase === 'finished' || paused) && <div className={styles.actionArea}>
        {phase === 'ready' && <div className={styles.shop}>
          <strong>☾ つきまで {GOAL_COUNT * METERS_PER_STAR} m</strong>
          <span>{result ? `${result.count * METERS_PER_STAR} m に とうちゃく！ ＋${result.points} pt` : `ほし ${GOAL_COUNT}こで とどくよ`}</span>
          <button type="button" disabled={progress.points < upgradeCost(progress.level) || progress.level >= GOAL_COUNT}
            onClick={upgrade}>さいしょの ★ ＋1 {upgradeCost(progress.level)} pt</button>
          <small>もっている ポイント {progress.points} pt</small>
        </div>}
        {phase === 'finished' && <p className={styles.result} role="status">☾ つきに とどいた！ {hud.count * METERS_PER_STAR} m ＋{result?.points} pt</p>}
        <button ref={action} type="button" className={styles.start} onClick={paused ? () => setPaused(false) : start}>
          <Icon name={phase === 'finished' ? 'replay' : 'play'} />
          {paused ? 'つづける' : phase === 'finished' ? 'もういちど' : 'スタート'}
        </button>
      </div>}
      <div className={styles.srOnly} role="status" aria-live="polite" aria-atomic="true">
        {phase === 'launching' && `ほし ${hud.count}こで うちあげ！${hud.count * METERS_PER_STAR}メートルへ`}
        {phase === 'running' && `ほし ${hud.count}こ。${nextGate ? nextGate.lanes.map((label, i) =>
          laneNames[i] + ' ' + (nextGate.meteor?.to === i - 1 ? 'いんせき ' + (label ?? '') : label ?? 'あき')).join('、') : 'つぎは ゴール'}`}
      </div>
    </div>

    <div className={styles.hint} id="parade-controls">
      <span><Icon name="hand" />タッチで いどう</span>
      <span className={styles.keyboard}><kbd>←</kbd><kbd>→</kbd> ながおし</span>
      <span className={styles.keyboard}><kbd>↑</kbd> ジャンプ</span>
    </div>
  </main>
}
