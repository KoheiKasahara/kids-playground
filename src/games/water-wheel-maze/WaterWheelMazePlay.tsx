import { useCallback, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { STAGES } from './stages'
import { TOTAL_RIDERS } from './wheelDrive'
import { readMazeProgress, saveMazeProgress, type MazeProgress } from './mazeProgress'
import { useWaterWheelMaze, type Spin } from './useWaterWheelMaze'
import styles from './WaterWheelMazePlay.module.css'

function Board({ index, back, select, next, record, cleared }: {
  index: number
  back: () => void
  select: () => void
  next: () => void
  record: (id: string, perfect: boolean) => void
  cleared: number
}) {
  useGameIntroPlaying(true)
  const stage = STAGES[index]
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // ポインタで おした ぶんを click が くりかえさないようにする めじるし。
  const pressed = useRef(false)
  const onCleared = useCallback((perfect: boolean) => record(stage.id, perfect), [record, stage.id])
  const game = useWaterWheelMaze(canvasRef, stage, onCleared)
  const last = index === STAGES.length - 1
  const percent = Math.round(Math.min(1, game.caught / stage.need) * 100)

  const spinProps = (direction: Spin) => ({
    onPointerDown: () => { primeAudio(); pressed.current = true; game.nudge(direction); game.hold(direction) },
    onPointerUp: game.stop,
    onPointerLeave: game.stop,
    onPointerCancel: game.stop,
    onClick: () => { if (!pressed.current) game.nudge(direction); pressed.current = false },
  })

  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton onBack={back} />
      <h1>ぐるぐる すいしゃ</h1>
      <span className={styles.badge}>{index + 1} / {STAGES.length}</span>
    </header>
    <div className={styles.workspace}>
      <div className={styles.goal}>
        <p className={styles.stageName}>{stage.name}</p>
        <div className={styles.meter} role="progressbar" aria-valuemin={0} aria-valuemax={TOTAL_RIDERS}
          aria-valuenow={game.riders} aria-label={`かんらんしゃに のった どうぶつ ${game.riders} / ${TOTAL_RIDERS}`}>
          <span className={styles.meterFill} style={{ width: `${percent}%` }} aria-hidden="true" />
          <b aria-hidden="true">🎡 {'⭐'.repeat(game.riders)}{'☆'.repeat(TOTAL_RIDERS - game.riders)}</b>
        </div>
      </div>
      <section className={styles.board} aria-label="まるい めいろ">
        <canvas ref={canvasRef} {...game.canvasProps} className={styles.canvas} tabIndex={0}
          aria-label="まるい めいろ。ゆびで まわすと みずが おちるよ。キーボードは ひだり・みぎの やじるしで まわせるよ">
          めいろを まわして、まんなかの みずを すいしゃへ おとそう。
        </canvas>
        <p className={styles.notice} role="status">
          {game.unavailable ? 'ばんめんを ひらけなかったよ。もういちど ひらいてね'
            : game.cleared ? ''
              : game.reachedGoal ? '⭐ ぜんいん のれたよ！ のこりの みずも とどけてみよう'
                : game.settled ? '💧 みずが とまったよ。めいろを まわしてみよう'
                  : game.started ? '' : stage.hint}
        </p>
        {game.cleared && <div className={styles.overlay}>
          <div className={styles.card}>
            <p className={styles.sparkles} aria-hidden="true">✨ 🎡 ✨</p>
            <h2>かんらんしゃが まわった！</h2>
            <p>{game.maze.remaining === 0
              ? 'みずを のこさず とどけた！ かんぺき！'
              : `どうぶつ ${TOTAL_RIDERS}とう みんな のれたよ！`}</p>
            <div className={styles.cardButtons}>
              <button onClick={game.retry}>↻ もういちど</button>
              <button autoFocus onClick={last ? select : next}>{last ? 'ステージを えらぶ' : 'つぎへ →'}</button>
            </div>
          </div>
        </div>}
      </section>
      <div className={styles.controls} role="group" aria-label="めいろを まわす">
        <button aria-label="ひだりへ まわす" {...spinProps(-1)}><span aria-hidden="true">↺</span> ひだり</button>
        <button aria-label="みぎへ まわす" {...spinProps(1)}>みぎ <span aria-hidden="true">↻</span></button>
      </div>
      <div className={styles.actions}>
        <button onClick={() => { game.stop(); game.retry() }}>↻ もういちど</button>
        <button aria-label={`ステージを えらぶ。クリア ${cleared} / ${STAGES.length}`} onClick={select}>≡ ステージ</button>
      </div>
    </div>
  </main>
}

export default function WaterWheelMazePlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [progress, setProgress] = useState<MazeProgress>(() => readMazeProgress())
  const record = useCallback((id: string, perfect: boolean) => {
    setProgress(current => {
      const level = perfect ? 2 : 1
      if ((current[id] ?? 0) >= level) return current
      const next = { ...current, [id]: level }
      saveMazeProgress(next)
      return next
    })
  }, [])
  const cleared = STAGES.filter(stage => progress[stage.id]).length

  if (index !== null) return <GamePlaySurface>
    <Board key={STAGES[index].id} index={index} cleared={cleared} record={record}
      back={() => setIndex(null)} select={() => setIndex(null)}
      next={() => setIndex(value => (value ?? 0) + 1 < STAGES.length ? (value ?? 0) + 1 : null)} />
  </GamePlaySurface>

  return <main className={styles.select}>
    <header className={styles.selectHeader}><GameBackButton to="/" /></header>
    <div className={styles.intro}>
      <div className={styles.illustration} aria-hidden="true">
        <span className={styles.disc}>🌀</span>
        <div className={styles.drops}><i>💧</i><i>💧</i><i>💧</i></div>
        <footer>⚙️ ——— 🎡</footer>
      </div>
      <p className={styles.eyebrow}>まわして、おとして、まわして</p>
      <h1>ぐるぐる すいしゃ</h1>
      <p>まんなかの みずを したへ おとそう。<br />すいしゃが まわって かんらんしゃが うごくよ</p>
    </div>
    <div className={styles.stageGrid}>
      {STAGES.map((stage, i) => {
        const level = progress[stage.id] ?? 0
        return <button key={stage.id} onClick={() => { primeAudio(); setIndex(i) }}
          aria-label={`${i + 1} ${stage.name}${level === 2 ? ' みずを のこさず とどけた' : level ? ' クリア' : ''}`}>
          <span className={styles.stageNumber}>{i + 1}</span>
          <b>{stage.name}</b>
          <em className={styles.stageMark} aria-hidden="true">{level === 2 ? '💧' : level ? '✓' : ''}</em>
        </button>
      })}
    </div>
    <p className={styles.legend}>
      <span>🌀 めいろを まわす</span><span>💧 みずを おとす</span><span>🎡 どうぶつを のせる</span>
    </p>
  </main>
}
