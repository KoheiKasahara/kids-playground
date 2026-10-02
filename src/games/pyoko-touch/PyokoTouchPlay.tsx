import { useEffect, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import {
  DIFFICULTY_SETTINGS,
  HOLE_COUNT,
  advance,
  createInitialState,
  isFinished,
  judge,
  remainingSeconds,
  touchHole,
  type Pop,
  type PyokoDifficulty,
  type PyokoState,
} from './pyokoGame'
import { playCatchSound, playFinishSound, playOopsSound } from './sounds'
import StageClearBadge from '../../components/StageClearBadge'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import styles from './PyokoTouchPlay.module.css'

const DIFFICULTY_LABELS: Record<PyokoDifficulty, { name: string; hint: string }> = {
  easy: { name: 'やさしい', hint: 'ゆっくり でてくる' },
  fast: { name: 'はやい', hint: 'はちも でてくる' },
}

/** むずかしさごとの いちばん よい ★（Issue #784 A6）。judge() と同じ目安で★をつける。 */
const pyokoProgress = createStageProgressStore('pyoko-touch-progress-v1', (id) => Object.hasOwn(DIFFICULTY_LABELS, id))

function scoreStars(score: number): 1 | 2 | 3 {
  return score >= 20 ? 3 : score >= 10 ? 2 : 1
}

/** 進行の刻み[ms]。のこり時間・顔を出す・引っこむの判定を、この間隔でまとめて進める。 */
const TICK_MS = 100

/** 顔を出したあとの結果を、絵柄でも見せるための記号。 */
const RESULT_ICONS: Record<Exclude<Pop['status'], 'up'>, string> = {
  caught: '✨',
  oops: '💦',
  gone: '💨',
}

export default function PyokoTouchPlay() {
  const [started, setStarted] = useState(false)
  const [difficulty, setDifficulty] = useState<PyokoDifficulty>('easy')
  const [soundOn, setSoundOn] = useState(true)
  const [progress, setProgress] = useState(pyokoProgress.read)
  // 描画用のstateと、進行の正となるrefを同じ初期値から持つ。
  // 100msごとの進行とタップが同じrefを読み書きするため、描画を待つあいだの
  // 取りこぼし（タップの直前に進んだぶんの巻き戻り）が起きない。
  const [play, setPlay] = useState<PyokoState>(createInitialState)
  const playRef = useRef<PyokoState>(play)

  // 結果画面は「じかんが来た」ことそのものなので、別のstateを持たずに導出する。
  const finished = started && isFinished(play, difficulty)

  useGameIntroPlaying(started)

  useEffect(() => {
    if (!started || finished) return
    // soundOnを切り替えると作り直されるが、経過時間はrefが持っているため進行は巻き戻らない。
    const timerId = setInterval(() => {
      const current = playRef.current
      if (isFinished(current, difficulty)) return
      const next = advance(current, difficulty, TICK_MS)
      playRef.current = next
      setPlay(next)
      // じかん切れをまたいだ刻みでだけ鳴らす（そのあとの刻みは上のreturnで止まる）。
      if (isFinished(next, difficulty)) {
        setProgress(pyokoProgress.record(difficulty, scoreStars(next.score)))
        vibrate('celebrate')
        if (soundOn) playFinishSound()
      }
    }, TICK_MS)
    return () => clearInterval(timerId)
  }, [started, finished, difficulty, soundOn])

  const commit = (next: PyokoState) => {
    playRef.current = next
    setPlay(next)
  }

  const startGame = (nextDifficulty: PyokoDifficulty) => {
    primeAudio()
    setDifficulty(nextDifficulty)
    commit(createInitialState())
    setStarted(true)
  }

  const backToSelect = () => {
    commit(createInitialState())
    setStarted(false)
  }

  const handleTouchHole = (holeIndex: number) => {
    if (!started || finished) return
    primeAudio()
    const { state, result } = touchHole(playRef.current, holeIndex)
    if (result === 'none') return
    commit(state)
    vibrate(result === 'friend' ? 'tap' : 'error')
    if (!soundOn) return
    if (result === 'friend') playCatchSound()
    else playOopsSound()
  }

  const popByHole = new Map<number, Pop>(play.pops.map((pop) => [pop.holeIndex, pop]))
  const restSeconds = remainingSeconds(play, difficulty)
  const restRatio = restSeconds / (DIFFICULTY_SETTINGS[difficulty].durationMs / 1000)
  const verdict = judge(play.score)

  const page = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🐹</span> ぴょこぴょこタッチ
        </h1>
      </header>

      {!started ? (
        <>
          <p id="pyoko-touch-instruction" className={styles.instruction}>
            むずかしさを えらんでね
          </p>
          <div className={styles.difficultyGrid} role="group" aria-labelledby="pyoko-touch-instruction">
            {(Object.keys(DIFFICULTY_LABELS) as PyokoDifficulty[]).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.difficultyButton}
                aria-label={`${DIFFICULTY_LABELS[option].name} ${DIFFICULTY_LABELS[option].hint}`}
                onClick={() => startGame(option)}
              >
                <span className={styles.difficultyName}>{DIFFICULTY_LABELS[option].name}</span>
                <span className={styles.difficultyHint}>{DIFFICULTY_LABELS[option].hint}</span>
                <StageClearBadge stars={progress[option] ?? 0} />
              </button>
            ))}
          </div>
        </>
      ) : null}

      {started && !finished ? (
        <>
          {/* 1秒ごとに変わる表示をaria-liveで読み上げると操作の邪魔になるため、
              ここは読み上げさせず、結果だけをrole="status"で伝える。 */}
          <p className={styles.status}>
            <span className={styles.score}>てん：{play.score}</span>
            <span className={styles.timer}>のこり {restSeconds}びょう</span>
          </p>
          <div className={styles.timerTrack} aria-hidden="true">
            <div className={styles.timerFill} style={{ width: `${restRatio * 100}%` }} />
          </div>

          <div className={styles.board}>
            {Array.from({ length: HOLE_COUNT }, (_, holeIndex) => {
              const pop = popByHole.get(holeIndex)
              const isUp = pop?.status === 'up'
              return (
                <button
                  key={holeIndex}
                  type="button"
                  data-hole-index={holeIndex}
                  className={[styles.hole, isUp ? styles.holeUp : ''].filter(Boolean).join(' ')}
                  aria-label={isUp ? pop.creature.name : 'あな'}
                  onClick={() => handleTouchHole(holeIndex)}
                >
                  <span className={styles.creature} aria-hidden="true">
                    {pop ? (pop.status === 'up' ? pop.creature.emoji : RESULT_ICONS[pop.status]) : ''}
                  </span>
                </button>
              )
            })}
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
          <p className={styles.resultEmoji} aria-hidden="true">
            {verdict.emoji}
          </p>
          <p className={styles.resultMessage} role="status">
            {play.score}てん！ {verdict.message}
          </p>
          <div className={styles.actions}>
            <button type="button" className={`${styles.button} ${styles.start}`} onClick={() => startGame(difficulty)}>
              もういちど
            </button>
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={backToSelect}>
              むずかしさをかえる
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
