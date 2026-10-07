import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import StageClearBadge from '../../components/StageClearBadge'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import {
  GOAL_COUNT,
  MODE_KINDS,
  advance,
  createInitialState,
  isFinished,
  isTargetNoticeVisible,
  riseProgress,
  scoreStars,
  touchBubble,
  type ShabonKind,
  type ShabonMode,
  type ShabonState,
} from './shabonGame'
import { playBoingSound, playClearSound, playPopSound, playTargetChangeSound } from './sounds'
import styles from './ShabonPachinPlay.module.css'

const MODE_LABELS: Record<ShabonMode, { name: string; hint: string; emoji: string }> = {
  color: { name: 'いろ', hint: 'おなじ いろを わろう', emoji: '🎨' },
  shape: { name: 'かたち', hint: 'おなじ かたちを わろう', emoji: '🔺' },
}

/** モードごとの いちばん よい ★。 */
const shabonProgress = createStageProgressStore('shabon-pachin-progress-v1', (id) => Object.hasOwn(MODE_LABELS, id))

/** 進行の刻み[ms]。しゃぼんだまの上昇と出現を、この間隔でまとめて進める。 */
const TICK_MS = 50

function BubbleFace({ kind }: { kind: ShabonKind }) {
  return (
    <span className={styles.bubbleFace} style={{ '--bubble-color': kind.color } as CSSProperties} aria-hidden="true">
      {kind.symbol ? <span className={styles.symbol}>{kind.symbol}</span> : null}
    </span>
  )
}

export default function ShabonPachinPlay() {
  const [mode, setMode] = useState<ShabonMode | null>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [progress, setProgress] = useState(shabonProgress.read)
  // 描画用のstateと、進行の正となるrefを同じ初期値から持つ。
  // 刻みごとの進行とタップが同じrefを読み書きするため、描画待ちのあいだの巻き戻りが起きない。
  const [play, setPlay] = useState<ShabonState>(() => createInitialState('color'))
  const playRef = useRef<ShabonState>(play)

  const started = mode !== null
  const finished = started && isFinished(play)

  useGameIntroPlaying(started)

  useEffect(() => {
    if (!mode || finished) return
    const timerId = setInterval(() => {
      const next = advance(playRef.current, mode, TICK_MS)
      playRef.current = next
      setPlay(next)
    }, TICK_MS)
    return () => clearInterval(timerId)
  }, [mode, finished])

  const commit = (next: ShabonState) => {
    playRef.current = next
    setPlay(next)
  }

  const startGame = (nextMode: ShabonMode) => {
    primeAudio()
    commit(createInitialState(nextMode))
    setMode(nextMode)
  }

  const backToSelect = () => {
    setMode(null)
  }

  const handleTouch = (bubbleId: number) => {
    if (!mode || finished) return
    primeAudio()
    const previousTarget = playRef.current.targetIndex
    const { state, result } = touchBubble(playRef.current, mode, bubbleId)
    if (result === 'none') return
    commit(state)
    if (result === 'wrong') {
      vibrate('error')
      if (soundOn) playBoingSound()
      return
    }
    if (isFinished(state)) {
      setProgress(shabonProgress.record(mode, scoreStars(state.mistakes)))
      vibrate('celebrate')
      if (soundOn) playClearSound()
      return
    }
    vibrate('tap')
    if (!soundOn) return
    // おだいが かわったときは ぱちんの かわりに きらりんを鳴らし、耳でも気づけるようにする。
    if (state.targetIndex !== previousTarget) playTargetChangeSound()
    else playPopSound()
  }

  const kinds = mode ? MODE_KINDS[mode] : MODE_KINDS.color
  const target = kinds[play.targetIndex]!
  const stars = scoreStars(play.mistakes)

  const page = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🫧</span> しゃぼんだま パチン
        </h1>
      </header>

      {!mode ? (
        <>
          <p id="shabon-pachin-instruction" className={styles.instruction}>
            あそびかたを えらんでね
          </p>
          <div className={styles.modeGrid} role="group" aria-labelledby="shabon-pachin-instruction">
            {(Object.keys(MODE_LABELS) as ShabonMode[]).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.modeButton}
                aria-label={`${MODE_LABELS[option].name} ${MODE_LABELS[option].hint}`}
                onClick={() => startGame(option)}
              >
                <span className={styles.modeEmoji} aria-hidden="true">{MODE_LABELS[option].emoji}</span>
                <span className={styles.modeName}>{MODE_LABELS[option].name}</span>
                <span className={styles.modeHint}>{MODE_LABELS[option].hint}</span>
                <StageClearBadge stars={progress[option] ?? 0} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {started && !finished ? (
        <>
          {/* おだいが かわるたびに key を かえて、ぽよんと はずむ アニメーションを やりなおす。 */}
          <p key={play.targetIndex} className={styles.target} aria-live="polite">
            <BubbleFace kind={target} />
            <span>
              <strong className={styles.targetName}>{target.name}</strong> を わろう！
            </span>
          </p>
          <ol className={styles.meter} aria-label={`${play.popped}こ わった（ぜんぶで ${GOAL_COUNT}こ）`}>
            {Array.from({ length: GOAL_COUNT }, (_, i) => (
              <li key={i} className={i < play.popped ? styles.meterOn : styles.meterOff} aria-hidden="true" />
            ))}
          </ol>

          <div className={styles.sky}>
            {play.bubbles.map((bubble) => {
              const kind = kinds[bubble.kindIndex]!
              const rise = riseProgress(bubble, play.elapsedMs)
              const popped = bubble.poppedAt !== null
              const wobbling = play.elapsedMs < bubble.wobbleUntil
              return (
                <button
                  key={bubble.id}
                  type="button"
                  data-bubble-id={bubble.id}
                  data-kind={kind.id}
                  className={[styles.bubble, popped ? styles.popped : '', wobbling ? styles.wobble : '']
                    .filter(Boolean)
                    .join(' ')}
                  style={{ left: `${bubble.x * 100}%`, top: `${(1 - rise) * 115 - 15}%` }}
                  aria-label={popped ? 'われた' : `${kind.name}の しゃぼんだま`}
                  disabled={popped}
                  // 指を置いた瞬間に わりたいので、clickより早いpointerdownで判定する。
                  onPointerDown={(event) => {
                    event.preventDefault()
                    handleTouch(bubble.id)
                  }}
                  onClick={(event) => {
                    // pointerdownが無いキーボード操作（Enter・Space）でも われるようにする。
                    if (event.detail === 0) handleTouch(bubble.id)
                  }}
                >
                  {popped ? (
                    <span className={styles.burst} aria-hidden="true">✨</span>
                  ) : (
                    <span className={styles.sway} style={{ animationDelay: `${-(bubble.id % 5) * 0.4}s` }}>
                      <BubbleFace kind={kind} />
                    </span>
                  )}
                </button>
              )
            })}
            {isTargetNoticeVisible(play) ? (
              // 子どもの目は空を追っているので、空のまんなかに うっすら出す。
              // あそびは とめず、タッチは 下の しゃぼんだまに とおす。
              <div key={play.targetChangedAt} className={styles.targetNotice} aria-hidden="true">
                <BubbleFace kind={target} />
                <span className={styles.targetNoticeText}>つぎは {target.name}！</span>
              </div>
            ) : null}
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={backToSelect}>
              やめる
            </button>
          </div>
        </>
      ) : null}

      {finished ? (
        <>
          <p className={styles.resultEmoji} aria-hidden="true">🫧🎉</p>
          <p className={styles.resultMessage} role="status">
            ぜんぶ われたね！ すごい！
          </p>
          <p className={styles.resultStars} role="img" aria-label={`ほし ${stars}こ`}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>
            ))}
          </p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.start}`} onClick={() => mode && startGame(mode)}>
              もういちど
            </button>
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={backToSelect}>
              あそびかたを かえる
            </button>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={styles.soundToggle}
        aria-label={soundOn ? 'おとを けす' : 'おとを だす'}
        onClick={() => setSoundOn((current) => !current)}
      >
        <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
      </button>
    </main>
  )

  // 選択画面には長押しメニュー抑制をかけず、プレイ中・結果表示だけをGamePlaySurfaceで包む（Issue #166）。
  return started ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
