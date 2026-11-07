import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { useGameInterval } from '../../utils/useGameInterval'
import { vibrate } from '../../utils/haptics'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import {
  COUNT_STEP_MS,
  DEFAULT_BOARD,
  DIFFICULTY_SETTINGS,
  RUNNERS,
  YUKA_COLORS,
  advance,
  boardFor,
  callRemaining,
  createInitialState,
  isAlive,
  player,
  rankOf,
  rankStars,
  setPlayerTarget,
  shownColor,
  standings,
  stepPlayerTarget,
  type Board,
  type Difficulty,
  type GameEvent,
  type GameState,
  type Runner,
} from './iroNoYukaGame'
import { playIroSound } from './sounds'
import styles from './IroNoYukaPlay.module.css'

const TITLE = 'のこれ！いろのゆか'
/** 進行の刻み[ms]。 */
const TICK_MS = 33
/** フィールドの水の ふち[px]。CSS の --pad と そろえる。 */
const ARENA_PAD_PX = 6

const DIFFICULTY_LABELS: Record<Difficulty, { emoji: string; name: string }> = {
  easy: { emoji: '🐢', name: 'ゆっくり' },
  hard: { emoji: '🐇', name: 'はやい' },
}

const progressStore = createStageProgressStore('iro-no-yuka-progress-v1', (id) => Object.hasOwn(DIFFICULTY_SETTINGS, id))

const RUNNER_DEFS = Object.fromEntries(RUNNERS.map((def) => [def.id, def])) as Record<Runner['id'], (typeof RUNNERS)[number]>

/** おなじ ゆかに ならんでも かさならないよう、なかまごとに すこし ずらす（ゆか1つぶんの割合）。 */
const RUNNER_OFFSETS: Record<Runner['id'], [number, number]> = {
  me: [-0.13, 0.1],
  inu: [0.15, -0.1],
  neko: [-0.15, -0.13],
  kuma: [0.13, 0.13],
}

const MEDALS = ['🥇', '🥈', '🥉', '💦']
const ARROWS: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }

function Hearts({ runner, max }: { runner: Runner; max: number }) {
  return (
    <span className={styles.hearts} aria-hidden="true">
      {Array.from({ length: max }, (_, i) => (
        <b key={i} className={i < runner.lives ? styles.heartOn : styles.heartOff}>♥</b>
      ))}
    </span>
  )
}

export default function IroNoYukaPlay() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [play, setPlay] = useState<GameState>(() => createInitialState('easy', Math.random))
  // 刻みごとの進行とタップが同じrefを読み書きし、描画待ちのあいだの巻き戻りを防ぐ。
  const playRef = useRef<GameState>(play)
  const [sound, toggleSound] = useSoundToggle()
  const [progress, setProgress] = useState(progressStore.read)
  const [persisted, setPersisted] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  /** 画面の形から きめた ゆかの ならび。あそんでいる間は かえず、つぎに はじめるときに つかう。 */
  const boardRef = useRef<Board>(DEFAULT_BOARD)

  const started = difficulty !== null
  const over = play.phase === 'over'
  useGameIntroPlaying(started)

  const commit = (next: GameState) => {
    playRef.current = next
    setPlay(next)
  }

  // フィールドに つかえる大きさを はかり、たて長なら たてに、よこ長なら よこに ゆかを ふやす。
  // えらぶ画面では すぐ見た目に反映し、プレイ中は つぎの ゲームから つかう。
  // プレイ開始で フィールドが つけかわるので、started を依存に入れて はかりなおす。
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const update = () => {
      const next = boardFor(box.clientWidth - ARENA_PAD_PX * 2, box.clientHeight - ARENA_PAD_PX * 2)
      const changed = next.cols !== boardRef.current.cols || next.rows !== boardRef.current.rows
      boardRef.current = next
      if (!started && changed) commit(createInitialState(playRef.current.difficulty, Math.random, next))
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [started])

  const react = (events: readonly GameEvent[], state: GameState) => {
    for (const event of events) {
      switch (event) {
        case 'count':
          playIroSound('count')
          break
        case 'go':
          playIroSound('go')
          break
        case 'switch':
          playIroSound('switch')
          vibrate('impact')
          break
        case 'drop':
          playIroSound('drop')
          break
        case 'safe':
          playIroSound('safe')
          vibrate('success')
          break
        case 'fall':
          playIroSound('fall')
          vibrate('error')
          break
        case 'win':
        case 'lose': {
          playIroSound(event)
          if (event === 'win') vibrate('celebrate')
          const stars = rankStars(rankOf(state, 'me'))
          if (stars > 0) {
            const saved = progressStore.recordWithStatus(state.difficulty, stars)
            setProgress(saved.progress)
            setPersisted(saved.persisted)
          }
          break
        }
      }
    }
  }

  useGameInterval(() => {
    const { state, events } = advance(playRef.current, TICK_MS, Math.random)
    commit(state)
    react(events, state)
  }, started && !over ? TICK_MS : null)

  const start = (next: Difficulty) => {
    primeAudio()
    playIroSound('count')
    setPersisted(true)
    commit(createInitialState(next, Math.random, boardRef.current))
    setDifficulty(next)
  }

  const quit = () => {
    commit(createInitialState(difficulty ?? 'easy', Math.random, boardRef.current))
    setDifficulty(null)
  }

  const aim = (next: GameState) => {
    if (next === playRef.current) return
    commit(next)
    playIroSound('step')
    vibrate('tap')
  }

  const handleKey = (event: KeyboardEvent) => {
    const arrow = ARROWS[event.key]
    if (!arrow || !started) return
    event.preventDefault()
    aim(stepPlayerTarget(playRef.current, arrow[0], arrow[1]))
  }

  const settings = DIFFICULTY_SETTINGS[play.difficulty]
  const me = player(play)
  const calling = play.phase === 'call'
  const signColor = calling || play.phase === 'drop' ? YUKA_COLORS[shownColor(play)]! : null
  const switched = calling && play.switchAt !== null && play.phaseMs >= play.switchAt
  const countdown = play.phase === 'countdown' && started ? 3 - Math.floor(play.phaseMs / COUNT_STEP_MS) : null
  const myRank = rankOf(play, 'me')
  const stars = rankStars(myRank)

  const { cols, rows } = play.board
  const arena = (
    <div ref={boxRef} className={styles.arenaBox}>
      <div
        className={`${styles.arena} ${play.phase === 'drop' ? styles.shaking : ''}`}
        style={{ '--cols': cols, '--rows': rows } as CSSProperties}
        data-board={`${cols}x${rows}`}
        onKeyDown={handleKey}
      >
        <div className={styles.field} role="group" aria-label="いろの ゆか">
        {play.tiles.map((colorIndex, tile) => {
          const color = YUKA_COLORS[colorIndex]!
          const sinking = play.phase === 'drop' && colorIndex !== play.callColor
          return (
            <button
              // つぎのラウンドで うきあがる演出を やりなおすため、ラウンドを key に ふくめる。
              key={`${play.round}-${tile}`}
              type="button"
              data-tile={tile}
              data-color={color.id}
              className={[
                styles.tile,
                sinking ? styles.sink : '',
                play.phase === 'rise' ? styles.rise : '',
                me.target === tile && calling ? styles.aim : '',
              ].filter(Boolean).join(' ')}
              style={{ '--tile-color': color.color } as CSSProperties}
              aria-label={`${color.name}の ゆか`}
              disabled={!started || over}
              // 指を置いた瞬間に はしりだしたいので、clickより早いpointerdownで判定する。
              onPointerDown={(event) => {
                event.preventDefault()
                aim(setPlayerTarget(playRef.current, tile))
              }}
              onClick={(event) => {
                // キーボード（Enter・Space）でも えらべるようにする。
                if (event.detail === 0) aim(setPlayerTarget(playRef.current, tile))
              }}
            >
              <span className={styles.symbol} aria-hidden="true">{color.symbol}</span>
            </button>
          )
        })}

        {play.runners.map((runner) => {
          const visible = isAlive(runner) || (runner.status === 'fell' && play.phase === 'drop')
          if (!visible) return null
          const [ox, oy] = RUNNER_OFFSETS[runner.id]
          const def = RUNNER_DEFS[runner.id]
          return (
            <span
              key={runner.id}
              data-runner={runner.id}
              data-status={runner.status}
              className={[
                styles.runner,
                runner.id === 'me' ? styles.me : '',
                runner.status === 'fell' ? styles.falling : '',
                runner.status === 'back' ? styles.back : '',
                runner.status === 'safe' ? styles.safe : '',
              ].filter(Boolean).join(' ')}
              style={{
                left: `${((runner.x + 0.5 + ox) / cols) * 100}%`,
                top: `${((runner.y + 0.5 + oy) / rows) * 100}%`,
              }}
              aria-hidden="true"
            >
              <span className={styles.body}>{def.emoji}</span>
              {runner.id === 'me' && runner.status !== 'safe' ? <span className={styles.marker}>▼</span> : null}
              {runner.status === 'fell' ? <span className={styles.splash}>💦</span> : null}
              {runner.status === 'safe' && runner.id === 'me' ? <span className={styles.okBubble}>⭕</span> : null}
            </span>
          )
        })}
        </div>

        {countdown !== null ? (
          <div key={countdown} className={styles.countdown} aria-live="assertive">{countdown}</div>
        ) : null}

        {!started ? (
          <div className={styles.overlay}>
            <p className={styles.lead}>
              <span aria-hidden="true">🪧 ➜ 🟥🟦🟨🟩 ➜ 🐥</span>
              <br />おなじ いろへ にげろ！
            </p>
            <div className={styles.choices}>
              {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((option) => (
                <button key={option} type="button" className={styles.choice} onClick={() => start(option)}>
                  <span className={styles.choiceEmoji} aria-hidden="true">{DIFFICULTY_LABELS[option].emoji}</span>
                  <span>{DIFFICULTY_LABELS[option].name}</span>
                  <StageClearBadge stars={progress[option] ?? 0} />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {started && over ? (
          <section className={styles.overlay} aria-label="けっか">
            <p className={styles.medal} aria-hidden="true">{MEDALS[myRank - 1]}</p>
            <p className={styles.resultText} role="status">{myRank === 1 ? 'やったね！ 1い！' : `${myRank}い`}</p>
            <ol className={styles.standings}>
              {standings(play).map(({ id, rank }) => (
                <li key={id} className={id === 'me' ? styles.standingMe : undefined}>
                  <b>{rank}</b>
                  <span aria-hidden="true">{RUNNER_DEFS[id].emoji}</span>
                  <span className={styles.srOnly}>{RUNNER_DEFS[id].name}</span>
                </li>
              ))}
            </ol>
            {stars > 0 ? (
              <p className={styles.stars} role="img" aria-label={`ほし ${stars}こ`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={i < stars ? styles.starOn : styles.starOff} aria-hidden="true">★</span>
                ))}
              </p>
            ) : null}
            {!persisted ? <p className={styles.note}>きろくを ほぞんできませんでした</p> : null}
            <div className={styles.choices}>
              <button type="button" className={styles.choice} autoFocus onClick={() => start(play.difficulty)}>
                <span className={styles.choiceEmoji} aria-hidden="true">↻</span>
                <span>もういちど</span>
              </button>
              <button type="button" className={styles.choice} onClick={quit}>
                <span className={styles.choiceEmoji} aria-hidden="true">🐢🐇</span>
                <span>えらびなおす</span>
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to={started ? undefined : '/'} onBack={started ? quit : undefined} />
        <h1 className={styles.title}>{TITLE}</h1>
        <button type="button" className={styles.soundToggle} aria-label={sound ? 'おとを けす' : 'おとを だす'} onClick={toggleSound}>
          <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        </button>
      </header>

      <div className={styles.main}>
        <div className={styles.hud}>
          <div
            key={switched ? 'switched' : 'first'}
            className={[styles.sign, signColor ? '' : styles.signWaiting, switched ? styles.signSwitched : ''].filter(Boolean).join(' ')}
            style={signColor ? ({ '--tile-color': signColor.color } as CSSProperties) : undefined}
            aria-live="polite"
          >
            {signColor ? (
              <>
                <span className={styles.signSymbol} aria-hidden="true">{signColor.symbol}</span>
                <span className={styles.signName}>{signColor.name}</span>
                {switched ? <span className={styles.signAlert} aria-hidden="true">!</span> : null}
              </>
            ) : (
              <span className={styles.signSymbol} aria-hidden="true">？</span>
            )}
            {started ? <span className={styles.round} aria-hidden="true">🚩{play.round}</span> : null}
            <span className={styles.timer} aria-hidden="true">
              <span style={{ width: `${callRemaining(play) * 100}%` }} />
            </span>
          </div>
          <ul className={styles.roster} aria-label="のこりの ハート">
            {play.runners.map((runner) => (
              <li
                key={runner.id}
                className={[styles.rosterItem, runner.id === 'me' ? styles.rosterMe : '', isAlive(runner) ? '' : styles.rosterOut]
                  .filter(Boolean)
                  .join(' ')}
                aria-label={`${RUNNER_DEFS[runner.id].name} ${isAlive(runner) ? `ハート ${runner.lives}こ` : 'おしまい'}`}
              >
                <span className={styles.rosterEmoji} aria-hidden="true">{RUNNER_DEFS[runner.id].emoji}</span>
                <Hearts runner={runner} max={settings.lives} />
              </li>
            ))}
          </ul>
        </div>

        {started ? <GamePlaySurface>{arena}</GamePlaySurface> : arena}
      </div>
    </main>
  )
}
