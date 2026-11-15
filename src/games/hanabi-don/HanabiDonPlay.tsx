import { useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { useGameInterval } from '../../utils/useGameInterval'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import StageClearBadge from '../../components/StageClearBadge'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import {
  FLIGHT_MS,
  STAGES,
  advance,
  createInitialState,
  findStage,
  flightProgress,
  isCompleted,
  isFinished,
  launch,
  scoreStars,
  type HanabiShell,
  type HanabiStage,
  type HanabiStar,
  type HanabiState,
} from './hanabiGame'
import { playBurst, playClear, playLaunch, playSelect, playStarLit, startBgm } from './sounds'
import styles from './HanabiDonPlay.module.css'

/** よぞらごとの いちばん よい ★。 */
const hanabiProgress = createStageProgressStore('hanabi-don-progress-v1', (id) => findStage(id) !== undefined)

/** 進行の刻み[ms]。 */
const TICK_MS = 50

/** はなびの いろ。いろだけに たよらないよう、ほしを ともしたかは きごうと もじでも しめす。 */
const COLORS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#da77f2', '#ffa94d']
const SPARK_COUNT = 16
const INNER_SPARK_COUNT = 8

function Burst({ shell }: { shell: HanabiShell }) {
  return (
    <div
      className={`${styles.burst} ${shell.caught > 0 ? styles.burstBig : ''}`}
      style={{ left: `${shell.x * 100}%`, top: `${shell.y * 100}%`, '--hanabi-color': COLORS[shell.colorIndex] } as CSSProperties}
      aria-hidden="true"
    >
      <span className={styles.flash} />
      <span className={styles.ring} />
      {Array.from({ length: SPARK_COUNT }, (_, i) => (
        <span key={i} className={styles.spark} style={{ '--angle': `${(360 / SPARK_COUNT) * i}deg` } as CSSProperties} />
      ))}
      {Array.from({ length: INNER_SPARK_COUNT }, (_, i) => (
        <span
          key={`inner-${i}`}
          className={`${styles.spark} ${styles.sparkInner}`}
          style={{ '--angle': `${(360 / INNER_SPARK_COUNT) * (i + 0.5)}deg` } as CSSProperties}
        />
      ))}
      {shell.caught >= 2 ? <span className={styles.combo}>{shell.caught}こ いっぺん！</span> : null}
    </div>
  )
}

export default function HanabiDonPlay() {
  const [stage, setStage] = useState<HanabiStage | null>(null)
  const [sound, toggleSound] = useSoundToggle()
  const [progress, setProgress] = useState(hanabiProgress.read)
  const [persisted, setPersisted] = useState(true)
  // 描画用のstateと、進行の正となるrefを同じ初期値から持つ（刻みとタッチが同じrefを読み書きする）。
  const [play, setPlay] = useState<HanabiState>(() => createInitialState(STAGES[0]!))
  const playRef = useRef<HanabiState>(play)

  const started = stage !== null
  const finished = started && isFinished(play)
  const playing = started && !finished

  useGameIntroPlaying(started)

  const commit = (next: HanabiState) => {
    playRef.current = next
    setPlay(next)
  }

  useGameInterval(() => {
    if (!stage || isFinished(playRef.current)) return
    const { state, bursts } = advance(playRef.current, TICK_MS)
    commit(state)
    for (const burst of bursts) {
      playBurst(burst.caught)
      if (burst.caught > 0) playStarLit(state.lit, burst.caught)
      vibrate(burst.caught > 0 ? 'success' : 'impact')
    }
    if (isFinished(state)) {
      const saved = hanabiProgress.recordWithStatus(stage.id, scoreStars(stage, state.shots))
      setProgress(saved.progress)
      setPersisted(saved.persisted)
      vibrate('celebrate')
      playClear()
    }
  }, playing ? TICK_MS : null)

  // あそんでいる あいだだけ BGM。けっかでは とめて、ファンファーレを きかせる。
  useEffect(() => {
    if (!sound || !playing) return undefined
    return startBgm()
  }, [sound, playing])

  const startGame = (next: HanabiStage) => {
    primeAudio()
    playSelect()
    commit(createInitialState(next))
    setStage(next)
  }

  const backToSelect = () => {
    playSelect()
    setStage(null)
  }

  const launchAt = (x: number, y: number) => {
    if (!playing) return
    primeAudio()
    const { state, launched } = launch(playRef.current, x, y)
    if (!launched) return
    commit(state)
    vibrate('tap')
    playLaunch()
  }

  const handleSkyPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    event.preventDefault()
    launchAt((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height)
  }

  /** キーボードで ほしを えらんだとき。うごく ほしは、ひらく ころに いる ところを ねらう。 */
  const launchAtStar = (star: HanabiStar) => {
    const lead = FLIGHT_MS / 1000
    launchAt(star.x + star.vx * lead, star.y + star.vy * lead)
  }

  const total = stage?.starCount ?? 0
  const stars = stage ? scoreStars(stage, play.shots) : 1

  const page = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🎆</span> どーん！はなび
        </h1>
      </header>

      {!stage ? (
        <>
          <p id="hanabi-don-instruction" className={styles.instruction}>
            よぞらを えらんでね
          </p>
          <div className={styles.stageGrid} role="group" aria-labelledby="hanabi-don-instruction">
            {STAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.stageButton}
                aria-label={`${option.name} ${option.hint}`}
                onClick={() => startGame(option)}
              >
                <span className={styles.stageEmoji} aria-hidden="true">{option.emoji}</span>
                <span className={styles.stageText}>
                  <span className={styles.stageName}>{option.name}</span>
                  <span className={styles.stageHint}>{option.hint}</span>
                </span>
                <StageClearBadge stars={progress[option.id] ?? 0} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {stage && !finished ? (
        <>
          <div className={styles.hud}>
            <ol className={styles.meter} aria-label={`${play.lit}こ ともした（ぜんぶで ${total}こ）`}>
              {Array.from({ length: total }, (_, i) => (
                <li key={i} className={i < play.lit ? styles.meterOn : styles.meterOff} aria-hidden="true">
                  {i < play.lit ? '★' : '☆'}
                </li>
              ))}
            </ol>
            <p className={styles.shots} aria-label={`はなび ${play.shots}ぱつ`}>
              <span aria-hidden="true">🎇</span> {play.shots}
            </p>
          </div>

          <div className={styles.skyBox}>
            <div className={styles.sky} data-stage={stage.id} onPointerDown={handleSkyPointerDown}>
              <span className={styles.moon} aria-hidden="true" />
              {play.stars.map((star) => {
                const lit = star.litAt !== null
                return (
                  <button
                    key={star.id}
                    type="button"
                    data-star-id={star.id}
                    className={`${styles.star} ${lit ? styles.starLit : ''}`}
                    style={{ left: `${star.x * 100}%`, top: `${star.y * 100}%` }}
                    aria-label={lit ? 'あかりが ついた ほし' : 'ほし'}
                    disabled={lit}
                    onClick={(event) => {
                      // タッチは よぞらの pointerdown で うけるので、ここは キーボード操作（Enter・Space）だけ。
                      if (event.detail === 0) launchAtStar(star)
                    }}
                  >
                    <span className={styles.starFace} aria-hidden="true">{lit ? '🌟' : '⭐'}</span>
                  </button>
                )
              })}
              {play.shells.map((shell) =>
                shell.burst ? (
                  <Burst key={shell.id} shell={shell} />
                ) : (
                  <span
                    key={shell.id}
                    className={styles.shell}
                    style={{
                      left: `${shell.x * 100}%`,
                      top: `${(1 - flightProgress(shell, play.elapsedMs) * (1 - shell.y)) * 100}%`,
                      '--hanabi-color': COLORS[shell.colorIndex],
                    } as CSSProperties}
                    aria-hidden="true"
                  />
                ),
              )}
              <span className={styles.ground} aria-hidden="true" />
              {isCompleted(play) ? (
                <p className={styles.finale} role="status">ぜんぶ ともった！</p>
              ) : play.shots === 0 ? (
                <p className={styles.hint} aria-hidden="true">👆 ほしを タッチ！</p>
              ) : null}
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={backToSelect}>
              やめる
            </button>
          </div>
        </>
      ) : null}

      {stage && finished ? (
        <>
          <p className={styles.resultEmoji} aria-hidden="true">🎆🎉</p>
          <p className={styles.resultMessage} role="status">
            ぜんぶ ともせたね！ きれい！
          </p>
          <p className={styles.resultShots}>はなび {play.shots}ぱつで ともせたよ</p>
          {!persisted && <p role="status">きろくを ほぞんできませんでした。いまは このまま あそべるよ。</p>}
          <p className={styles.resultStars} role="img" aria-label={`ほし ${stars}こ`}>
            {Array.from({ length: 3 }, (_, i) => (
              <span key={i} className={i < stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>
            ))}
          </p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.start}`} onClick={() => startGame(stage)}>
              もういちど
            </button>
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={backToSelect}>
              よぞらを かえる
            </button>
          </div>
        </>
      ) : null}

      <button
        type="button"
        className={styles.soundToggle}
        aria-label={sound ? 'おとを けす' : 'おとを だす'}
        onClick={toggleSound}
      >
        <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
      </button>
    </main>
  )

  // 選択画面には長押しメニュー抑制をかけず、プレイ中・結果表示だけをGamePlaySurfaceで包む。
  return started ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
