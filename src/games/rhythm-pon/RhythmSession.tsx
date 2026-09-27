import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { findPianoNote } from '../shared/music/notes'
import type { PianoAudioEngine } from '../shared/music/pianoAudio'
import {
  MODE_RULES,
  buildRhythmChart,
  findExpiredTargets,
  findTapTarget,
  judgeOffset,
  rhythmAccuracy,
  starsForAccuracy,
  tallyJudgements,
  type Judgement,
  type RhythmMode,
  type RhythmTally,
} from './rhythmChart'
import { melodyForRhythmSong, type RhythmSongDefinition } from './rhythmSongs'
import {
  createStageEffects,
  drawStage,
  emitAutoSparkle,
  emitHitEffects,
  laneAtX,
  laneColors,
  markLanePressed,
  stageGeometry,
  type StageGeometry,
} from './stageRenderer'
import {
  audioNow,
  playComboChime,
  playEmptyTap,
  playFanfare,
  playSparkle,
  scheduleCountTick,
  scheduleDrum,
} from './sounds'
import SoundToggle from './SoundToggle'
import styles from './RhythmPlay.module.css'

const LANE_NAMES = ['ピンク', 'きいろ', 'みずいろ'] as const
/** キーボードで遊ぶときのキー。1レーンではどれを押しても同じ太鼓になる。 */
const LANE_KEYS: Readonly<Record<string, number>> = {
  ArrowLeft: 0, a: 0, A: 0, f: 0, F: 0,
  ArrowDown: 1, ArrowUp: 1, s: 1, S: 1, ' ': 1, Enter: 1, g: 1, G: 1, j: 1, J: 1,
  ArrowRight: 2, d: 2, D: 2, k: 2, K: 2,
}

const RESULT_MESSAGES: Readonly<Record<1 | 2 | 3, string>> = {
  1: 'さいごまで できたね！',
  2: 'じょうずに できたね！',
  3: 'さいこうの えんそう！',
}

export type RhythmResult = { tally: RhythmTally; stars: 1 | 2 | 3 }

type Props = {
  song: RhythmSongDefinition
  mode: RhythmMode
  engine: RefObject<PianoAudioEngine | null>
  sound: boolean
  onToggleSound: () => void
  onBack: () => void
  onRetry: () => void
  onComplete: (result: RhythmResult) => void
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
}

function countLabelAt(songMs: number, beatMs: number): string | null {
  if (songMs < -3 * beatMs) return 'よーい'
  if (songMs < -2 * beatMs) return '3'
  if (songMs < -beatMs) return '2'
  if (songMs < 0) return '1'
  if (songMs < beatMs * 0.9) return 'ぽん！'
  return null
}

export default function RhythmSession({ song, mode, engine, sound, onToggleSound, onBack, onRetry, onComplete }: Props) {
  const chart = useMemo(() => buildRhythmChart(melodyForRhythmSong(song), song.tempoBpm, mode), [song, mode])
  const colors = laneColors(chart.laneCount)
  const stageRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const progressRef = useRef<HTMLSpanElement>(null)
  const retryRef = useRef<HTMLButtonElement>(null)
  const geometryRef = useRef<StageGeometry>(stageGeometry(360, 560, chart.laneCount))
  const judgedRef = useRef(new Map<number, Judgement>())
  const effectsRef = useRef(createStageEffects(chart.laneCount))
  const comboRef = useRef(0)
  const soundRef = useRef(sound)
  const reducedMotion = useRef(prefersReducedMotion())
  const timing = useRef({
    startPerf: 0,
    audioOffset: undefined as number | undefined,
    nextDrumStep: 0,
    autoIndex: 0,
    pausedAt: null as number | null,
    finished: false,
    countLabel: 'よーい' as string | null,
  })
  const [countLabel, setCountLabel] = useState<string | null>('よーい')
  const [combo, setCombo] = useState(0)
  const [gauge, setGauge] = useState(0)
  const [paused, setPaused] = useState(false)
  const [result, setResult] = useState<RhythmResult | null>(null)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    soundRef.current = sound
    onCompleteRef.current = onComplete
  })

  const syncAudioClock = useCallback(() => {
    const now = audioNow()
    timing.current.audioOffset = now === undefined ? undefined : now - performance.now() / 1000
  }, [])

  /** 曲の時刻（ms）を共有AudioContextの時刻（秒）へ。 */
  const audioAt = useCallback((songMs: number) => {
    const offset = timing.current.audioOffset
    return offset === undefined ? undefined : (timing.current.startPerf + songMs) / 1000 + offset
  }, [])

  const playMelodyNote = useCallback((noteId: string, durationMs: number) => {
    if (!soundRef.current) return
    const note = findPianoNote(noteId)
    if (note) engine.current?.playNote(note, Math.min(1100, Math.max(240, durationMs)))
  }, [engine])

  const refreshHud = useCallback(() => {
    setCombo(comboRef.current)
    setGauge(rhythmAccuracy(tallyJudgements(judgedRef.current), chart.targetCount))
  }, [chart.targetCount])

  const finish = useCallback(() => {
    const t = timing.current
    if (t.finished) return
    t.finished = true
    const tally = tallyJudgements(judgedRef.current)
    const stars = starsForAccuracy(rhythmAccuracy(tally, chart.targetCount))
    const next = { tally, stars }
    setResult(next)
    onCompleteRef.current(next)
    vibrate('celebrate')
    if (soundRef.current) playFanfare(stars)
  }, [chart.targetCount])

  /** 1フレームぶん、時間で進む処理（カウント・伴奏・自動の音・見のがし・おわり）。 */
  const step = useCallback((songMs: number, clock: number) => {
    const t = timing.current
    const label = countLabelAt(songMs, chart.beatMs)
    if (label !== t.countLabel) {
      t.countLabel = label
      setCountLabel(label)
    }

    // 伴奏の打楽器は半拍ごとに、少し先まで共有AudioContextへ予約する。
    const halfBeat = chart.beatMs / 2
    while (t.nextDrumStep * halfBeat <= Math.min(songMs + 160, chart.durationMs + halfBeat)) {
      const stepMs = t.nextDrumStep * halfBeat
      const when = audioAt(stepMs)
      if (soundRef.current && when !== undefined && stepMs >= songMs - 40) {
        const beat = t.nextDrumStep / 2
        if (t.nextDrumStep % 2 === 1) scheduleDrum('shaker', when)
        else if (beat % 2 === 0) scheduleDrum('kick', when, beat % 4 === 0)
        else scheduleDrum('clap', when)
      }
      t.nextDrumStep += 1
    }

    while (t.autoIndex < chart.notes.length && chart.notes[t.autoIndex].timeMs <= songMs) {
      const note = chart.notes[t.autoIndex]
      if (!note.target) {
        playMelodyNote(note.noteId, note.durationMs)
        emitAutoSparkle(effectsRef.current, geometryRef.current, chart.laneCount, note.lane, clock)
      }
      t.autoIndex += 1
    }

    const expired = findExpiredTargets(chart, judgedRef.current, songMs)
    if (expired.length > 0) {
      for (const note of expired) {
        judgedRef.current.set(note.index, 'miss')
        emitHitEffects(effectsRef.current, geometryRef.current, chart.laneCount, note.lane, 'miss', clock, reducedMotion.current)
      }
      comboRef.current = 0
      refreshHud()
    }

    if (progressRef.current) {
      const progress = Math.max(0, Math.min(1, songMs / chart.durationMs))
      progressRef.current.style.transform = `scaleX(${progress})`
    }
    if (songMs > chart.durationMs + 900) finish()
  }, [audioAt, chart, finish, playMelodyNote, refreshHud])

  // ゲームの時計とアニメーションは、この画面が表示されているあいだだけ動かす。
  useEffect(() => {
    const t = timing.current
    const rule = MODE_RULES[mode]
    const leadIn = Math.max(rule.approachMs + 500, chart.beatMs * 4.2)
    t.startPerf = performance.now() + leadIn
    syncAudioClock()
    if (soundRef.current) {
      for (let beat = 3; beat >= 1; beat -= 1) {
        const when = audioAt(-beat * chart.beatMs)
        if (when !== undefined) scheduleCountTick(when, beat === 1)
      }
    }

    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvasRef.current?.getContext('2d') ?? null
    } catch {
      context = null
    }

    let frame = 0
    const loop = () => {
      frame = requestAnimationFrame(loop)
      const perf = performance.now()
      const clock = perf / 1000
      const songMs = (t.pausedAt ?? perf) - t.startPerf
      if (t.pausedAt === null && !t.finished) step(songMs, clock)
      if (context) {
        drawStage(context, geometryRef.current, {
          chart,
          judged: judgedRef.current,
          songMs,
          clock,
          theme: song.theme,
          effects: effectsRef.current,
          reducedMotion: reducedMotion.current,
        })
      }
    }
    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [audioAt, chart, mode, song.theme, step, syncAudioClock])

  // 画面の大きさに合わせて、Canvasを高精細に描きなおす。
  useEffect(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const resize = () => {
      const rect = stage.getBoundingClientRect()
      const width = Math.max(1, rect.width)
      const height = Math.max(1, rect.height)
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      try {
        canvas.getContext('2d')?.setTransform(ratio, 0, 0, ratio, 0, 0)
      } catch {
        // Canvas非対応の環境でも、操作と判定は続けられる。
      }
      geometryRef.current = stageGeometry(width, height, chart.laneCount)
    }
    resize()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize)
      return () => window.removeEventListener('resize', resize)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [chart.laneCount])

  const pause = useCallback(() => {
    const t = timing.current
    if (t.pausedAt !== null || t.finished) return
    t.pausedAt = performance.now()
    setPaused(true)
  }, [])

  const resume = () => {
    const t = timing.current
    if (t.pausedAt === null) return
    primeAudio()
    engine.current?.activate()
    t.startPerf += performance.now() - t.pausedAt
    t.pausedAt = null
    syncAudioClock()
    setPaused(false)
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') pause()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [pause])

  const tap = useCallback((lane: number) => {
    const t = timing.current
    if (t.pausedAt !== null || t.finished) return
    const perf = performance.now()
    const songMs = perf - t.startPerf
    const clock = perf / 1000
    markLanePressed(effectsRef.current, lane, clock)
    const note = findTapTarget(chart, judgedRef.current, lane, songMs)
    const judgement = note ? judgeOffset(note.timeMs - songMs, mode) : null
    if (!note || !judgement) {
      if (soundRef.current && songMs > -chart.beatMs) playEmptyTap()
      return
    }
    judgedRef.current.set(note.index, judgement)
    playMelodyNote(note.noteId, note.durationMs)
    if (soundRef.current) playSparkle(judgement === 'perfect')
    emitHitEffects(effectsRef.current, geometryRef.current, chart.laneCount, lane, judgement, clock, reducedMotion.current)
    vibrate('tap')
    comboRef.current += 1
    if (soundRef.current && comboRef.current % 10 === 0) playComboChime()
    refreshHud()
  }, [chart, mode, playMelodyNote, refreshHud])

  // キーボード（Enter・Space・矢印）は押した瞬間に反応させたいので、クリックではなくkeydownで処理する。
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return
      const lane = LANE_KEYS[event.key]
      if (lane === undefined) return
      const target = event.target instanceof Element ? event.target : null
      // もどる・おと・結果画面のボタンでは、ふつうのボタン操作を優先する。
      if (target?.closest('button, a, input, select') && !target.closest('[data-rhythm-pad]')) return
      if (timing.current.finished || timing.current.pausedAt !== null) return
      event.preventDefault()
      tap(chart.laneCount === 1 ? 0 : Math.min(chart.laneCount - 1, lane))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [chart.laneCount, tap])

  useEffect(() => {
    if (result) retryRef.current?.focus({ preventScroll: true })
  }, [result])

  const gaugeStars = [0, 0.45, 0.75]

  return <GamePlaySurface><main className={`${styles.page} ${styles.playPage}`} style={{ '--sky': song.theme.sky, '--glow': song.theme.glow } as CSSProperties}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} />
      <h1 className={styles.playTitle}><span aria-hidden="true">{song.emoji}</span> {song.title}</h1>
      <SoundToggle sound={sound} onToggle={onToggleSound} />
    </header>
    <div className={styles.hud}>
      <div className={styles.songProgress} aria-hidden="true"><span ref={progressRef} /></div>
      <div className={styles.gauge} role="meter" aria-label="きらきら ゲージ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(gauge * 100)}>
        <span className={styles.gaugeFill} style={{ transform: `scaleX(${gauge})` }} />
        {gaugeStars.map((threshold, index) => <b key={index} aria-hidden="true" className={gauge >= threshold ? styles.gaugeStarOn : ''}
          style={{ left: `${Math.max(4, threshold * 100)}%` }}>★</b>)}
      </div>
    </div>
    <div ref={stageRef} className={styles.stage} onPointerDown={(event) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return
      const rect = stageRef.current?.getBoundingClientRect()
      if (!rect) return
      tap(laneAtX(event.clientX - rect.left, geometryRef.current, chart.laneCount))
    }}>
      <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
      {countLabel && !paused && <p key={countLabel} className={`${styles.count} ${countLabel === 'ぽん！' ? styles.countGo : ''}`} aria-live="polite">{countLabel}</p>}
      {combo >= 3 && <p key={combo} className={styles.combo}><b>{combo}</b> れんぞく！</p>}
    </div>
    <div className={`${styles.pads} ${chart.laneCount === 1 ? styles.singlePad : ''}`}>
      {colors.map((color, lane) => <button key={lane} type="button" data-rhythm-pad className={styles.pad}
        aria-label={chart.laneCount === 1 ? 'たいこ' : `${LANE_NAMES[lane]}の たいこ`}
        style={{ '--pad': color.main, '--pad-light': color.light, '--pad-dark': color.dark } as CSSProperties}
        onPointerDown={(event) => {
          event.stopPropagation()
          if (event.button !== 0 && event.pointerType === 'mouse') return
          tap(lane)
        }}>
        <span className={styles.padFace} aria-hidden="true">{chart.laneCount === 1 ? 'ぽん！' : '♪'}</span>
      </button>)}
    </div>
    <p className={styles.playHint} aria-hidden="true">{chart.laneCount === 1 ? '♪が まるに きたら たいこを ぽん！' : 'おなじ いろの たいこを ぽん！'}</p>

    {paused && !result && <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="おやすみちゅう">
      <div className={styles.panel}>
        <p className={styles.panelIcon} aria-hidden="true">⏸</p>
        <h2>ひとやすみ</h2>
        <button type="button" className={styles.primary} autoFocus onClick={resume}>つづける <span aria-hidden="true">▶</span></button>
        <button type="button" className={styles.secondary} onClick={onBack}>きょくを えらぶ</button>
      </div>
    </div>}

    {result && <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="rhythm-result-title">
      <div className={`${styles.panel} ${styles.resultPanel}`}>
        <div className={styles.confetti} aria-hidden="true">{Array.from({ length: 18 }, (_, index) =>
          <i key={index} style={{ '--piece': index, '--confetti': [colors[index % colors.length].main, '#ffe066', '#ffffff'][index % 3] } as CSSProperties} />)}</div>
        <p className={styles.resultStars} role="img" aria-label={`ほし ${result.stars}こ`} data-rhythm-stars={result.stars}>
          {[0, 1, 2].map((index) => <span key={index} aria-hidden="true" className={index < result.stars ? styles.starOn : styles.starOff}
            style={{ animationDelay: `${0.25 + index * 0.25}s` }}>★</span>)}
        </p>
        <h2 id="rhythm-result-title">{RESULT_MESSAGES[result.stars]}</h2>
        <p className={styles.resultSong}>{song.emoji} {song.title}</p>
        <dl className={styles.tally}>
          <div className={styles.tallyPerfect}><dt>すごい</dt><dd>{result.tally.perfect}</dd></div>
          <div className={styles.tallyGood}><dt>いいね</dt><dd>{result.tally.good}</dd></div>
          <div className={styles.tallyMiss}><dt>おしい</dt><dd>{result.tally.miss}</dd></div>
        </dl>
        <button ref={retryRef} type="button" className={styles.primary} onClick={onRetry}>もういちど <span aria-hidden="true">↻</span></button>
        <button type="button" className={styles.secondary} onClick={onBack}>ほかの きょく</button>
      </div>
    </div>}
  </main></GamePlaySurface>
}
