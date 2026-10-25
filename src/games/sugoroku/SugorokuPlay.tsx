import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { COURSES, MAX_PLAYERS, PIECES, courseById, goalIndex, type CourseId, type PieceId } from './courses'
import DiceFace from './DiceFace'
import { PieceIcon } from './PieceArt'
import SugorokuBoard, { type BoardMover } from './SugorokuBoard'
import { playSugorokuSound } from './sounds'
import { createGame, createPlayers, drawRoute, mustRest, playTurn, ranking, remainingSquares, rollDice, routeChoices, skipRest, type GameState } from './sugorokuGame'
import { turnTimeline } from './turnTimeline'
import styles from './SugorokuPlay.module.css'

/** コンピュータが サイコロを ふるまで まつ じかん。 */
export const COMPUTER_DELAY_MS = 900
/** 「おやすみ」を みせてから つぎの ひとへ まわすまで。 */
export const REST_MS = 1400
/** ゴールの よろこびを みせてから けっかを だすまで。 */
export const RESULT_DELAY_MS = 1300

const HUMAN_LABELS = ['ひとり', 'ふたり', 'さんにん', 'よにん'] as const

const pieceOf = (id: PieceId) => PIECES.find((piece) => piece.id === id)!
const nameOf = (game: GameState, player: number) => `${pieceOf(game.players[player]!.piece).name}さん`

type View = {
  positions: readonly number[]
  dice: readonly number[]
  rolling: boolean
  mover: BoardMover | null
  message: string | null
}

const freshView = (game: GameState): View => ({ positions: game.positions, dice: [1], rolling: false, mover: null, message: null })

function placeText(game: GameState, player: number): string {
  const course = courseById(game.course)
  const position = game.positions[player]!
  if (position === 0) return 'スタート'
  if (position === goalIndex(course)) return 'ゴール'
  if (course.forks[position]) return 'わかれみち'
  const route = course.routeOf[position]
  return route ? `${route}の マス` : `${position}ばんめの マス`
}

export default function SugorokuPlay() {
  const [setup, setSetup] = useState<{ course: CourseId; humans: number }>({ course: COURSES[0]!.id, humans: 1 })
  const [game, setGame] = useState<GameState | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState(false)
  const [resultReady, setResultReady] = useState(false)
  /** ばんめん ぜんたいを みせる。はじめは ぜんたいを みせ、サイコロを ふると コマへ ちかづく。 */
  const [overview, setOverview] = useState(true)
  const [sound, toggleSound] = useSoundToggle()
  const timersRef = useRef<number[]>([])
  const busyRef = useRef(false)
  const diceRef = useRef<HTMLButtonElement>(null)
  const replayRef = useRef<HTMLButtonElement>(null)
  const routeRef = useRef<HTMLButtonElement>(null)
  const started = game !== null
  useGameIntroPlaying(started)

  const later = useCallback((ms: number, run: () => void) => {
    const id = window.setTimeout(() => {
      timersRef.current = timersRef.current.filter((timer) => timer !== id)
      run()
    }, ms)
    timersRef.current.push(id)
  }, [])

  const stopTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer)
    timersRef.current = []
    busyRef.current = false
  }, [])
  useEffect(() => stopTimers, [stopTimers])

  /** サイコロを ふって、すすむ・しかけ・つぎの ばん までを じゅんばんに みせる。わかれみちでは route の みちへ。 */
  const takeTurn = useCallback((state: GameState, route = 0) => {
    if (busyRef.current || state.winner !== null || mustRest(state)) return
    busyRef.current = true
    setBusy(true)
    setOverview(false)
    primeAudio()
    const plan = playTurn(state, rollDice(state), undefined, undefined, route)
    const { frames, duration } = turnTimeline(plan, state)
    for (const frame of frames) {
      const show = () => {
        setView((previous) => previous && {
          positions: frame.positions ?? previous.positions,
          dice: frame.dice ?? previous.dice,
          rolling: frame.rolling ?? previous.rolling,
          mover: frame.mover === undefined ? previous.mover : frame.mover,
          message: frame.message ?? previous.message,
        })
        if (frame.sound) playSugorokuSound(frame.sound.kind, frame.sound.step)
        if (frame.haptic) vibrate(frame.haptic)
      }
      // さいしょの「ころころ」は おした その ときに みせて ならす（iOS は そうさ ちゅうの おとしか ださない）。
      if (frame.at === 0) show()
      else later(frame.at, show)
    }
    later(duration, () => {
      busyRef.current = false
      setBusy(false)
      setGame(plan.next)
      setView((previous) => previous && { ...previous, positions: plan.next.positions, mover: null, message: null })
      if (plan.next.winner !== null) {
        playSugorokuSound('goal')
        vibrate('celebrate')
        later(RESULT_DELAY_MS, () => setResultReady(true))
      }
    })
  }, [later])

  /** いま ふっている、または つぎに ふる ひと。ゴールしたら いない。 */
  const active = game && game.winner === null ? game.turn : null
  const waiting = active !== null && !busy
  const resting = waiting && mustRest(game!)
  const computerTurn = waiting && !resting && game!.players[active]!.computer
  /** いまの ひとが わかれみちで えらべる みち。 */
  const routes = waiting && !resting ? routeChoices(game!) : null
  const doubleTurn = waiting && !resting && Boolean(game!.doubles[active])

  // おやすみの ひとは しばらく まってから とばす。
  useEffect(() => {
    if (!game || busy || !mustRest(game)) return undefined
    playSugorokuSound('rest')
    const timer = window.setTimeout(() => setGame(skipRest(game)), REST_MS)
    return () => window.clearTimeout(timer)
  }, [game, busy])

  // コンピュータの ばんは すこし まってから じぶんで ふる。
  useEffect(() => {
    if (!game || !computerTurn) return undefined
    const timer = window.setTimeout(() => {
      const choices = routeChoices(game)
      takeTurn(game, choices ? drawRoute(choices.length) : 0)
    }, COMPUTER_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [game, computerTurn, takeTurn])

  const choosing = routes !== null && !computerTurn
  useEffect(() => {
    if (resultReady) replayRef.current?.focus()
    else if (choosing) routeRef.current?.focus()
    else if (started) diceRef.current?.focus()
  }, [started, resultReady, choosing])

  const start = () => {
    stopTimers()
    primeAudio()
    const fresh = createGame(setup.course, setup.humans)
    setGame(fresh)
    setView(freshView(fresh))
    setBusy(false)
    setResultReady(false)
    setOverview(true)
    playSugorokuSound('start')
    vibrate('tap')
  }

  const backToSetup = () => {
    stopTimers()
    setGame(null)
    setView(null)
    setBusy(false)
    setResultReady(false)
  }

  const choose = (next: Partial<typeof setup>) => {
    primeAudio()
    playSugorokuSound('select')
    setSetup((previous) => ({ ...previous, ...next }))
  }

  const canRoll = waiting && !resting && !computerTurn && !choosing
  const roll = () => {
    if (game && canRoll) takeTurn(game)
  }
  const chooseRoute = (route: number) => {
    if (game && choosing) takeTurn(game, route)
  }
  // まって いる あいだは、つぎに ふる サイコロの かずだけ ならべる。
  const shownDice = busy || !view ? view?.dice ?? [1] : Array.from({ length: doubleTurn ? 2 : 1 }, (_, die) => view.dice[die] ?? view.dice[0] ?? 1)

  const course = courseById(game?.course ?? setup.course)
  // カメラは うごいている コマ、いなければ いまの ばんの ひと（ゴールしたら かった ひと）を おいかける。
  const focusPlayer = view?.mover?.player ?? active ?? game?.winner ?? 0
  const toggleOverview = () => {
    primeAudio()
    playSugorokuSound('select')
    setOverview((previous) => !previous)
  }
  const status = !game ? '' : game.winner !== null && !busy ? `${nameOf(game, game.winner)}が ゴール！`
    : busy && view?.message ? view.message
      : resting ? `${nameOf(game, game.turn)}は おやすみ`
        : computerTurn ? `${nameOf(game, game.turn)}の ばん`
          : choosing ? `${nameOf(game, game.turn)}の ばん！ どっちの みちに する？`
            : doubleTurn ? `${nameOf(game, game.turn)}の ばん！ サイコロ 2こで ふってね`
              : `${nameOf(game, game.turn)}の ばん！ サイコロを ふってね`

  const page = (
    <main className={styles.page} data-course={course.id}>
      <header className={styles.header}>
        {started ? <GameBackButton onBack={backToSetup} /> : <GameBackButton to="/" />}
        <h1>わくわく すごろく</h1>
        <button type="button" className={styles.sound} onClick={toggleSound} aria-label={sound ? 'おとを けす' : 'おとを だす'}>
          <span aria-hidden="true">{sound ? '♪' : '♫'}</span><small>おと {sound ? 'あり' : 'なし'}</small>
        </button>
      </header>

      {!game || !view ? (
        <div className={styles.setup}>
          <div className={styles.caption}>
            <span className={styles.eyebrow}>サイコロで すすもう</span>
            <h2>ゴールを めざそう！</h2>
          </div>

          <section className={styles.choice} aria-labelledby="sugoroku-course">
            <h3 id="sugoroku-course">コースを えらぶ</h3>
            <div className={styles.courses} role="group" aria-labelledby="sugoroku-course">
              {COURSES.map((option) => (
                <button key={option.id} type="button" className={styles.courseCard} data-course={option.id}
                  aria-pressed={setup.course === option.id} aria-label={`${option.name}（${option.path.length}マス）`}
                  onClick={() => choose({ course: option.id })}>
                  <span className={styles.coursePreview} aria-hidden="true">
                    <SugorokuBoard course={option} label="" compact />
                  </span>
                  <strong>{option.name}</strong>
                  <small>{option.tagline}</small>
                  <small className={styles.courseLength}>{option.path.length}マス</small>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.choice} aria-labelledby="sugoroku-players">
            <h3 id="sugoroku-players">なんにんで あそぶ？</h3>
            <div className={styles.humans} role="group" aria-labelledby="sugoroku-players">
              {Array.from({ length: MAX_PLAYERS }, (_, index) => index + 1).map((humans) => (
                <button key={humans} type="button" aria-pressed={setup.humans === humans}
                  aria-label={humans === 1 ? 'ひとり（コンピュータの くまさんと）' : HUMAN_LABELS[humans - 1]}
                  onClick={() => choose({ humans })}>
                  <span className={styles.humanIcons} aria-hidden="true">
                    {createPlayers(humans).map((player) => (
                      <PieceIcon key={player.piece} id={player.piece} color={pieceOf(player.piece).color}
                        className={player.computer ? styles.computerIcon : undefined} />
                    ))}
                  </span>
                  <strong>{HUMAN_LABELS[humans - 1]}</strong>
                  <small>{humans === 1 ? 'くまさんと' : 'みんなで'}</small>
                </button>
              ))}
            </div>
          </section>

          <button type="button" className={styles.startButton} onClick={start}>はじめる！</button>
        </div>
      ) : (
        <div className={styles.play}>
          <p className={styles.status} role="status">{status}</p>
          <div className={styles.boardWrap}>
            <SugorokuBoard course={course} className={styles.board}
              pieces={game.players.map((player) => player.piece)} positions={view.positions}
              turn={active} mover={view.mover} focus={view.positions[focusPlayer] ?? 0} overview={overview}
              routeHints={routes?.map((route) => ({ square: route.first, label: route.label })) ?? []}
              label={`${course.name}。${game.players.map((_, player) => `${nameOf(game, player)}は ${placeText({ ...game, positions: view.positions }, player)}`).join('、')}`} />
            <button type="button" className={styles.mapButton} aria-pressed={overview} onClick={toggleOverview}>
              {overview ? 'ちかくで みる' : 'ぜんたいを みる'}
            </button>
          </div>

          <section className={styles.panel} aria-label="サイコロと じゅんばん">
            <ul className={styles.players} aria-label="じゅんばん">
              {game.players.map((player, index) => {
                const piece = pieceOf(player.piece)
                const left = remainingSquares({ ...game, positions: view.positions }, index)
                return (
                  <li key={player.piece} className={styles.playerChip} aria-current={active === index ? 'true' : undefined}
                    style={{ '--player': piece.color } as CSSProperties}>
                    <PieceIcon id={player.piece} color={piece.color} className={styles.chipIcon} />
                    <span className={styles.chipName}>
                      {piece.name}{player.computer && <small className={styles.cpuTag}>コンピュータ</small>}
                    </span>
                    <span className={styles.chipLeft}>
                      {left === 0 ? 'ゴール！' : game.resting[index] ? 'おやすみ' : game.doubles[index] ? 'サイコロ2こ' : `のこり ${left}`}
                    </span>
                  </li>
                )
              })}
            </ul>
            {choosing ? (
              <div className={styles.routes} role="group" aria-label="どっちの みちに する？"
                style={{ '--player': pieceOf(game.players[active!]!.piece).color } as CSSProperties}>
                {routes.map((route, index) => (
                  <button key={route.first} ref={index === 0 ? routeRef : undefined} type="button" className={styles.routeButton}
                    aria-label={`${route.label}へ すすむ（${route.hint}）`} onClick={() => chooseRoute(index)}>
                    <strong>{route.label}</strong>
                    <small>{route.hint}</small>
                  </button>
                ))}
              </div>
            ) : (
              <button ref={diceRef} type="button" className={`${styles.diceButton} ${view.rolling ? styles.rolling : ''}`}
                aria-label="サイコロを ふる" aria-disabled={!canRoll} onClick={roll} data-dice-count={shownDice.length}
                style={{ '--player': pieceOf(game.players[active ?? game.winner ?? 0]!.piece).color } as CSSProperties}>
                <span className={styles.diceRow}>
                  {shownDice.map((value, die) => <DiceFace key={die} value={value} className={styles.dice} />)}
                </span>
                <span aria-hidden="true">{canRoll ? 'ふる！' : 'まってね'}</span>
              </button>
            )}
          </section>

          {resultReady && game.winner !== null && (
            <section className={styles.result} aria-labelledby="sugoroku-result">
              <div className={styles.confetti} aria-hidden="true">
                {Array.from({ length: 14 }, (_, index) => <i key={index} style={{ '--i': index } as CSSProperties} />)}
              </div>
              <PieceIcon id={game.players[game.winner]!.piece} color={pieceOf(game.players[game.winner]!.piece).color} className={styles.winnerIcon} />
              <h2 id="sugoroku-result">{nameOf(game, game.winner)}の かち！</h2>
              <ol className={styles.ranking}>
                {ranking(game).map(({ player, place }) => {
                  const left = remainingSquares(game, player)
                  return (
                    <li key={player}>
                      <span className={styles.place}>{place}い</span>
                      <PieceIcon id={game.players[player]!.piece} color={pieceOf(game.players[player]!.piece).color} className={styles.rankIcon} />
                      <span>{nameOf(game, player)}</span>
                      <small>{left === 0 ? 'ゴール！' : `のこり ${left}マス`}</small>
                    </li>
                  )
                })}
              </ol>
              <div className={styles.resultButtons}>
                <button ref={replayRef} type="button" className={styles.startButton} onClick={start}>もういちど</button>
                <button type="button" className={styles.secondary} onClick={backToSetup}>えらびなおす</button>
              </div>
            </section>
          )}
        </div>
      )}
    </main>
  )
  return started ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
