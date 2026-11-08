import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
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
  DIFFICULTY_SETTINGS,
  MAX_COUNT,
  PARADE_ANIMALS,
  PLAYERS,
  advance,
  changeCount,
  confirmAnswer,
  cpuTappedWithin,
  createInitialState,
  isExact,
  marcherX,
  nextRound,
  rankOf,
  resultStars,
  revealedCount,
  roundCount,
  standings,
  type Difficulty,
  type GameEvent,
  type GameState,
  type PlayerDef,
  type PlayerId,
} from './kazoeteParadeGame'
import { playParadeSound } from './sounds'
import styles from './KazoeteParadePlay.module.css'

const TITLE = 'かぞえて！どうぶつパレード'
/** 進行の刻み[ms]。 */
const TICK_MS = 33
/** あいてが かぞえたとき ぴょこっと うごく長さ[ms]。 */
const TAP_BUMP_MS = 260

const DIFFICULTY_LABELS: Record<Difficulty, { emoji: string; name: string }> = {
  easy: { emoji: '🐢', name: 'ゆっくり' },
  hard: { emoji: '🐆', name: 'はやい' },
}

const progressStore = createStageProgressStore('kazoete-parade-progress-v1', (id) => Object.hasOwn(DIFFICULTY_SETTINGS, id))

const PLAYER_DEFS = Object.fromEntries(PLAYERS.map((def) => [def.id, def])) as Record<PlayerId, PlayerDef>

/** みちの たての いち（ステージの たかさに たいする%）。みちの かずごと。 */
const LANE_TOPS: Readonly<Record<number, readonly number[]>> = { 1: [66], 2: [50, 84] }

const MEDALS = ['🥇', '🥈', '🥉', '🎈']

function rosterLabel(state: GameState, def: PlayerDef): string {
  const parts = [`${def.name} メダル ${state.medals[def.id]}こ`]
  const answer = state.answers?.[def.id]
  if (answer !== undefined) parts.push(`こたえ ${answer}`)
  if (state.judged && isExact(state, def.id)) parts.push('ぴったり')
  return parts.join('、')
}

export default function KazoeteParadePlay() {
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null)
  const [play, setPlay] = useState<GameState>(() => createInitialState('easy', Math.random))
  // 刻みごとの進行とタップが同じrefを読み書きし、描画待ちのあいだの巻き戻りを防ぐ。
  const playRef = useRef<GameState>(play)
  const [sound, toggleSound] = useSoundToggle()
  const [progress, setProgress] = useState(progressStore.read)
  const [persisted, setPersisted] = useState(true)

  const started = difficulty !== null
  const { phase } = play
  const over = phase === 'over'
  useGameIntroPlaying(started)

  const commit = (next: GameState) => {
    playRef.current = next
    setPlay(next)
  }

  const react = (events: readonly GameEvent[], state: GameState) => {
    for (const event of events) {
      switch (event) {
        case 'show':
          playParadeSound('show')
          break
        case 'go':
          playParadeSound('go')
          break
        case 'stop':
          playParadeSound('stop')
          vibrate('impact')
          break
        case 'count':
          playParadeSound('count', revealedCount(state) - 1)
          break
        case 'correct':
          playParadeSound('correct')
          vibrate('success')
          break
        case 'miss':
          playParadeSound('miss')
          vibrate('error')
          break
        case 'win':
        case 'lose': {
          playParadeSound(event)
          if (event === 'win') vibrate('celebrate')
          const stars = resultStars(state)
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

  // こたえを きめる あいだと けっかでは 時間を すすめない（じぶんの ペースで えらべる）。
  const ticking = started && (phase === 'show' || phase === 'parade' || (phase === 'reveal' && !play.judged))
  useGameInterval(() => {
    const { state, events } = advance(playRef.current, TICK_MS)
    if (state !== playRef.current) commit(state)
    react(events, state)
  }, ticking ? TICK_MS : null)

  const start = (next: Difficulty) => {
    primeAudio()
    playParadeSound('show')
    setPersisted(true)
    commit(createInitialState(next, Math.random))
    setDifficulty(next)
  }

  const quit = () => {
    commit(createInitialState(difficulty ?? 'easy', Math.random))
    setDifficulty(null)
  }

  const count = (delta: number) => {
    const next = changeCount(playRef.current, delta)
    if (next === playRef.current) return
    commit(next)
    playParadeSound(delta > 0 ? 'tap' : 'untap')
    vibrate('tap')
  }

  const confirm = () => {
    const next = confirmAnswer(playRef.current)
    if (next === playRef.current) return
    commit(next)
    playParadeSound('ok')
    vibrate('tap')
  }

  const proceed = () => {
    const { state, events } = nextRound(playRef.current, Math.random)
    if (state === playRef.current) return
    commit(state)
    react(events, state)
  }

  const settings = DIFFICULTY_SETTINGS[play.difficulty]
  const laneTops = LANE_TOPS[settings.lanes] ?? LANE_TOPS[1]!
  const target = PARADE_ANIMALS[play.parade.target]!
  const targetCount = play.parade.targetCount
  const rounds = roundCount(play.difficulty)
  const revealed = revealedCount(play)
  const myRank = rankOf(play, 'me')
  const stars = resultStars(play)
  const playing = started && !over

  const stage = (
    <div
      className={styles.stage}
      data-phase={started ? phase : 'select'}
      data-lanes={settings.lanes}
    >
      <div className={styles.scenery} aria-hidden="true">
        <span className={styles.tent}>🎪</span>
        <span className={styles.balloons}>🎈</span>
        <span className={styles.tree} style={{ left: '8%' }}>🌳</span>
        <span className={styles.tree} style={{ left: '78%' }}>🌳</span>
      </div>
      {playing ? (
        <span className={styles.round} aria-label={`${play.round}かいめ`}>
          🚩{play.round}/{rounds}
        </span>
      ) : null}
      {laneTops.map((top, lane) => (
        <div key={lane} className={styles.road} style={{ '--lane-top': `${top}%` } as CSSProperties} aria-hidden="true" />
      ))}

      {playing && phase === 'parade' ? (
        <div className={styles.parade} aria-hidden="true">
          {play.parade.marchers.map((marcher) => {
            const x = marcherX(marcher, play.phaseMs)
            if (x === null) return null
            const animal = PARADE_ANIMALS[marcher.animal]!
            return (
              <span
                key={marcher.key}
                className={styles.marcher}
                data-animal={animal.id}
                style={{ left: `${x}%`, top: `${laneTops[marcher.lane]}%` }}
              >
                <span className={marcher.dir === 1 ? styles.flip : undefined}>
                  <span className={styles.walker} style={{ animationDelay: `${-(marcher.key % 4) * 90}ms` }}>
                    {animal.emoji}
                  </span>
                </span>
              </span>
            )
          })}
        </div>
      ) : null}

      {playing && phase === 'show' ? (
        <div className={styles.showcase}>
          <span className={styles.showEmoji} aria-hidden="true">{target.emoji}</span>
          <span className={styles.showText}>この こを かぞえてね</span>
        </div>
      ) : null}

      {playing && phase === 'answer' ? (
        <div className={styles.showcase}>
          <span className={styles.questionEmoji} aria-hidden="true">{target.emoji}❓</span>
          <span className={styles.showText}>
            {target.name}は <span className={styles.nowrap}>なんびき いた？</span>
          </span>
        </div>
      ) : null}

      {playing && phase === 'reveal' ? (
        <div className={styles.reveal}>
          <ol className={styles.revealList} aria-label="こたえあわせ">
            {Array.from({ length: targetCount }, (_, i) => (
              <li key={i} className={i < revealed ? styles.revealOn : styles.revealOff}>
                {i < revealed ? (
                  <>
                    <span className={styles.revealEmoji} aria-hidden="true">{target.emoji}</span>
                    <b className={styles.revealNumber}>{i + 1}</b>
                  </>
                ) : null}
              </li>
            ))}
          </ol>
          {play.judged ? (
            <p className={`${styles.answerText} ${isExact(play, 'me') ? styles.answerExact : ''}`} role="status">
              {isExact(play, 'me') ? `ぴったり！ ${targetCount}ひき` : `こたえは ${targetCount}ひき`}
            </p>
          ) : null}
        </div>
      ) : null}

      {!started ? (
        <div className={styles.overlay}>
          <p className={styles.lead}>
            <span aria-hidden="true">🐇🐖🐇🐇 ➜ 👆3</span>
            <br />おだいの どうぶつを
            <br />かぞえよう！
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
            {standings(play).map(({ id, rank, medals }) => (
              <li key={id} className={id === 'me' ? styles.standingMe : undefined}>
                <b>{rank}い</b>
                <span aria-hidden="true">{PLAYER_DEFS[id].emoji}</span>
                <span className={styles.srOnly}>{PLAYER_DEFS[id].name}</span>
                <span className={styles.standingMedals}>🏅{medals}</span>
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
              <span className={styles.choiceEmoji} aria-hidden="true">🐢🐆</span>
              <span>えらびなおす</span>
            </button>
          </div>
        </section>
      ) : null}
    </div>
  )

  let controls: ReactNode = null
  if (playing && phase === 'answer') {
    controls = (
      <div className={styles.answerPanel}>
        <button type="button" className={styles.step} aria-label="1 へらす" disabled={play.myCount <= 0} onClick={() => count(-1)}>
          −
        </button>
        <output className={styles.answerValue} aria-label="きみの こたえ">{play.myCount}</output>
        <button type="button" className={styles.step} aria-label="1 ふやす" disabled={play.myCount >= MAX_COUNT} onClick={() => count(1)}>
          ＋
        </button>
        <button type="button" className={styles.ok} autoFocus onClick={confirm}>
          これで OK
        </button>
      </div>
    )
  } else if (playing && phase === 'reveal') {
    controls = play.judged ? (
      <button type="button" className={styles.next} autoFocus onClick={proceed}>
        {play.round < rounds ? 'つぎへ ▶' : 'けっかへ ▶'}
      </button>
    ) : (
      <p className={styles.wait}>いっしょに かぞえよう</p>
    )
  } else if (!over) {
    controls = (
      <button
        type="button"
        className={styles.clicker}
        aria-label={`かぞえる いま ${play.myCount}`}
        disabled={!started || phase !== 'parade'}
        // れんだ しても おくれないよう、clickより早いpointerdownで かぞえる。
        onPointerDown={(event) => {
          event.preventDefault()
          count(1)
        }}
        onClick={(event) => {
          // キーボード（Enter・Space）でも かぞえられるようにする。
          if (event.detail === 0) count(1)
        }}
      >
        <span key={play.myCount} className={styles.clickerCount} aria-hidden="true">{play.myCount}</span>
        <span className={styles.clickerLabel} aria-hidden="true">👆 かぞえる</span>
      </button>
    )
  }

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
          <div className={styles.sign} aria-live="polite">
            {playing ? (
              <>
                <span className={styles.signEmoji} aria-hidden="true">{target.emoji}</span>
                <span className={styles.signText}>
                  <b>{target.name}</b> <span className={styles.nowrap}>を かぞえよう</span>
                </span>
              </>
            ) : (
              <span className={styles.signText}>どうぶつ パレード</span>
            )}
          </div>
          <ul className={styles.roster} aria-label="メダルの かず">
            {PLAYERS.map((def) => {
              const answer = play.answers?.[def.id]
              const exact = play.judged && isExact(play, def.id)
              const tapping = def.id !== 'me' && cpuTappedWithin(play, def.id, TAP_BUMP_MS)
              let bubble: string | null = null
              if (playing && phase === 'answer' && def.id !== 'me') bubble = '？'
              else if (playing && answer !== undefined) bubble = String(answer)
              else if (tapping) bubble = '👆'
              return (
                <li
                  key={def.id}
                  data-player={def.id}
                  className={[styles.rosterItem, def.id === 'me' ? styles.rosterMe : '', tapping ? styles.tapping : '']
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={rosterLabel(play, def)}
                >
                  <span className={styles.rosterEmoji} aria-hidden="true">{def.emoji}</span>
                  <span className={styles.rosterMedals} aria-hidden="true">🏅{play.medals[def.id]}</span>
                  {bubble !== null ? (
                    <span
                      className={[styles.bubble, play.judged ? (exact ? styles.bubbleExact : styles.bubbleOff) : '']
                        .filter(Boolean)
                        .join(' ')}
                      aria-hidden="true"
                    >
                      {bubble}
                      {play.judged ? <i>{exact ? '⭕' : '✕'}</i> : null}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </div>

        {started ? <GamePlaySurface>{stage}</GamePlaySurface> : stage}

        <div className={styles.controls}>{controls}</div>
      </div>
    </main>
  )
}
