import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { AnimalFace, CardBack, CardFront } from './CardArt'
import {
  COLORS,
  STAGES,
  cardName,
  dealStage,
  drawStock,
  findStage,
  isCleared,
  isFree,
  isStuck,
  playSlot,
  playableSlots,
  remainingCount,
  starsFor,
  topCard,
  type AnimalId,
  type ColorId,
  type GameState,
  type Stage,
  type StageId,
} from './onajiPonGame'
import { playClearSound, playConnectSound, playDrawSound, playFreedSound, playNopeSound, playStuckSound } from './sounds'
import styles from './OnajiPonPlay.module.css'

/** ステージごとの いちばん よい ★。 */
const progressStore = createStageProgressStore('onaji-pon-progress-v1', (id) => findStage(id) !== undefined)

/** カードの よこの かんかく（カード1まいの はばを 1と する）。 */
const X_GAP = 1.12
/** カードの たて／よこ。 */
const CARD_RATIO = 1.4

/** さいごの 1まいを つないでから「できた！」を だすまで[ms]。カードが とどくのを みせる。 */
const CLEAR_DELAY_MS = 700
/** つなげなく なってから「おしい！」を だすまで[ms]。めくった カードを みる まを のこす。 */
const STUCK_DELAY_MS = 1200
/** なにも さわらないと、つなげられる カードを ぴょこっと おしえる[ms]。 */
const HINT_DELAY_MS = 7000
/** つなげられる カードが ないとき、やまを ひからせるまで[ms]。 */
const STOCK_HINT_DELAY_MS = 1600
/** つなげられない カードの ぷるぷる[ms]。 */
const NOPE_MS = 450

type Arrival = { dx: number; dy: number; scale: number; fromStock: boolean }
type Ending = 'clear' | 'stuck'
type Hint = number | 'stock' | null

function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ')
}

/** まんなかに つんだ カードを すこしずつ ななめに する（id から きめるので ちらつかない）。 */
function pileRotation(id: string): number {
  let hash = 0
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997
  return ((hash % 11) - 5) * 1.6
}

function boardSize(stage: Stage) {
  const maxX = Math.max(...stage.slots.map((slot) => slot.x))
  const maxY = Math.max(...stage.slots.map((slot) => slot.y))
  return { colsW: maxX * X_GAP + 1, rowsH: maxY + 1 }
}

/** 2つの ようその まんなかの ずれ。カードが どこから とんできたかを きめる。 */
function offsetBetween(from: Element | null, to: Element | null): Omit<Arrival, 'fromStock'> {
  if (!from || !to) return { dx: 0, dy: 0, scale: 1 }
  const a = from.getBoundingClientRect()
  const b = to.getBoundingClientRect()
  if (b.width === 0 || a.width === 0) return { dx: 0, dy: 0, scale: 1 }
  return {
    dx: a.left + a.width / 2 - (b.left + b.width / 2),
    dy: a.top + a.height / 2 - (b.top + b.height / 2),
    scale: a.width / b.width,
  }
}

/** ステージえらびの ちいさな みほん。ならびかたが ひとめで わかるようにする。 */
function LayoutPreview({ stage }: { stage: Stage }) {
  const { colsW, rowsH } = boardSize(stage)
  return (
    <span
      className={styles.preview}
      style={{ '--cols-w': colsW, '--rows-h': rowsH } as CSSProperties}
      aria-hidden="true"
    >
      {stage.slots.map((slot, index) => {
        const color = stage.colors[index % stage.colors.length]!
        return (
          <span
            key={index}
            className={styles.previewCard}
            style={
              {
                '--x': slot.x * X_GAP,
                '--y': slot.y,
                background: COLORS[color].fill,
                borderColor: COLORS[color].dark,
              } as CSSProperties
            }
          />
        )
      })}
    </span>
  )
}

function MiniCard({ color, animal }: { color: ColorId; animal: AnimalId }) {
  return (
    <span className={styles.miniCard}>
      <CardFront card={{ color, animal }} />
    </span>
  )
}

/** ルールの え。まんなかの カードに「おなじ いろ」「おなじ どうぶつ」なら つながる。 */
function RuleExample() {
  return (
    <div className={styles.rule} role="img" aria-label="まんなかの カードと おなじ いろ か おなじ どうぶつ なら つながるよ">
      <span className={styles.ruleItem}>
        <MiniCard color="red" animal="cat" />
        <span className={styles.ruleLabel}>
          <span className={styles.ruleOk}>⭕</span>おなじ いろ
        </span>
      </span>
      <span className={styles.ruleArrow}>→</span>
      <span className={cx(styles.ruleItem, styles.ruleCenter)}>
        <MiniCard color="red" animal="dog" />
        <span className={styles.ruleLabel}>まんなか</span>
      </span>
      <span className={styles.ruleArrow}>←</span>
      <span className={styles.ruleItem}>
        <MiniCard color="blue" animal="dog" />
        <span className={styles.ruleLabel}>
          <span className={styles.ruleOk}>⭕</span>おなじ どうぶつ
        </span>
      </span>
    </div>
  )
}

const ANIMAL_VOICES: Record<AnimalId, string> = {
  dog: 'わん！',
  cat: 'にゃん！',
  rabbit: 'ぴょん！',
  bear: 'がおー！',
}

const PARADE: { color: ColorId; animal: AnimalId }[] = [
  { color: 'red', animal: 'dog' },
  { color: 'yellow', animal: 'cat' },
  { color: 'green', animal: 'rabbit' },
  { color: 'blue', animal: 'bear' },
]

const CONFETTI_COLORS = ['#ff6b6b', '#4dabf7', '#ffd43b', '#69db7c', '#f783ac', '#b197fc']

/** 0〜1 の ばらつき。かみふぶきの ならびを きめるだけなので、まいかい おなじで よい。 */
function scatter(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return value - Math.floor(value)
}

const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
  left: scatter(index) * 100,
  delay: scatter(index + 40) * 0.6,
  duration: 1.6 + scatter(index + 80) * 1.2,
  drift: (scatter(index + 120) - 0.5) * 80,
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length]!,
  round: index % 3 === 0,
}))

function Confetti() {
  return (
    <span className={styles.confetti} aria-hidden="true">
      {CONFETTI.map((piece, index) => (
        <span
          key={index}
          className={cx(styles.confettiPiece, piece.round && styles.confettiRound)}
          style={
            {
              left: `${piece.left}%`,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              '--drift': `${piece.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </span>
  )
}

export default function OnajiPonPlay() {
  const [stageId, setStageId] = useState<StageId | null>(null)
  const [game, setGame] = useState<GameState | null>(null)
  const [arrival, setArrival] = useState<Arrival | null>(null)
  const [freed, setFreed] = useState<number[]>([])
  const [nope, setNope] = useState<number | 'stock' | null>(null)
  const [ending, setEnding] = useState<Ending | null>(null)
  const [hint, setHint] = useState<Hint>(null)
  const [soundOn, setSoundOn] = useState(true)
  const [progress, setProgress] = useState(progressStore.read)

  // タップの はんていは 描画を またずに さいしんの じょうたいで おこなう。
  const gameRef = useRef<GameState | null>(null)
  const initialRef = useRef<GameState | null>(null)
  const pileRef = useRef<HTMLDivElement>(null)
  const stockRef = useRef<HTMLButtonElement>(null)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nopeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const playing = stageId !== null && game !== null
  const stage = stageId ? findStage(stageId)! : null

  useGameIntroPlaying(playing)

  const clearTimers = () => {
    if (endTimerRef.current !== null) clearTimeout(endTimerRef.current)
    if (nopeTimerRef.current !== null) clearTimeout(nopeTimerRef.current)
    endTimerRef.current = null
    nopeTimerRef.current = null
  }

  useEffect(() => {
    return () => {
      if (endTimerRef.current !== null) clearTimeout(endTimerRef.current)
      if (nopeTimerRef.current !== null) clearTimeout(nopeTimerRef.current)
    }
  }, [])

  // しばらく なにも さわらないときだけ、つぎに さわれる ところを そっと おしえる。
  useEffect(() => {
    if (!game || ending || isCleared(game)) return
    const playable = playableSlots(game)
    if (playable.length === 0 && game.stock.length === 0) return
    const timerId = setTimeout(
      () => setHint(playable.length > 0 ? playable[0]! : 'stock'),
      playable.length > 0 ? HINT_DELAY_MS : STOCK_HINT_DELAY_MS,
    )
    return () => clearTimeout(timerId)
  }, [game, ending])

  const commit = (next: GameState) => {
    gameRef.current = next
    setGame(next)
    setHint(null)
  }

  const resetPlay = (state: GameState) => {
    clearTimers()
    commit(state)
    setArrival(null)
    setFreed([])
    setNope(null)
    setEnding(null)
  }

  const startStage = (id: StageId) => {
    primeAudio()
    const deal = dealStage(id, Math.random)
    initialRef.current = deal
    resetPlay(deal)
    setStageId(id)
  }

  const retrySameDeal = () => {
    primeAudio()
    if (initialRef.current) resetPlay(initialRef.current)
  }

  const backToSelect = () => {
    clearTimers()
    gameRef.current = null
    setGame(null)
    setStageId(null)
    setEnding(null)
    setHint(null)
  }

  const showNope = (target: number | 'stock') => {
    if (nopeTimerRef.current !== null) clearTimeout(nopeTimerRef.current)
    setNope(target)
    nopeTimerRef.current = setTimeout(() => {
      nopeTimerRef.current = null
      setNope(null)
    }, NOPE_MS)
    vibrate('error')
    if (soundOn) playNopeSound()
  }

  /** つないだ・めくった あとに、クリアか おしまいかを しらべる。 */
  const afterMove = (next: GameState) => {
    if (isCleared(next)) {
      const stars = starsFor(next.stock.length, next.par)
      setProgress(progressStore.record(next.stageId, stars))
      endTimerRef.current = setTimeout(() => {
        endTimerRef.current = null
        setEnding('clear')
        vibrate('celebrate')
        if (soundOn) playClearSound()
      }, CLEAR_DELAY_MS)
    } else if (isStuck(next)) {
      endTimerRef.current = setTimeout(() => {
        endTimerRef.current = null
        setEnding('stuck')
        if (soundOn) playStuckSound()
      }, STUCK_DELAY_MS)
    }
  }

  const handleSlot = (slot: number, element: HTMLElement) => {
    const current = gameRef.current
    // さいごの 1まいを つないだ あとは、けっかが でるまで さわっても かわらない。
    if (!current || ending || isCleared(current)) return
    primeAudio()
    const result = playSlot(current, slot)
    if (!result.ok) {
      showNope(slot)
      return
    }
    setArrival({ ...offsetBetween(element, pileRef.current), fromStock: false })
    setFreed(result.freed)
    commit(result.state)
    vibrate('tap')
    if (soundOn) {
      playConnectSound(result.state.combo)
      if (result.freed.length > 0) playFreedSound()
    }
    afterMove(result.state)
  }

  const handleStock = () => {
    const current = gameRef.current
    if (!current || ending || isCleared(current)) return
    primeAudio()
    if (current.stock.length === 0) {
      showNope('stock')
      return
    }
    const next = drawStock(current)
    setArrival({ ...offsetBetween(stockRef.current, pileRef.current), fromStock: true })
    setFreed([])
    commit(next)
    vibrate('tap')
    if (soundOn) playDrawSound()
    afterMove(next)
  }

  const freedSet = new Set(freed)

  let playView: ReactNode = null
  if (stage && game) {
    const { colsW, rowsH } = boardSize(stage)
    const top = topCard(game)
    const remaining = remainingCount(game)
    const started = game.pile.length > 1
    const stockLeft = game.stock.length
    const stars = starsFor(stockLeft, game.par)
    // つないだ ときだけ、まんなかに きた どうぶつが ひとこと いう。
    const voice = arrival && !arrival.fromStock && game.combo > 0 ? ANIMAL_VOICES[top.animal] : null
    const resultMessage = stars === 3 ? 'パーフェクト！' : stars === 2 ? 'すごい！' : 'できた！'

    playView = (
      <>
        <section
          className={styles.table}
          style={{ '--cols-w': colsW, '--rows-h': rowsH, '--rows-hw': rowsH * CARD_RATIO } as CSSProperties}
          aria-label="カードの ば"
        >
          <div className={styles.board}>
            {stage.slots.map((slot, index) => {
              const card = game.tableau[index]
              if (!card) return null
              const free = isFree(game, index)
              return (
                <button
                  key={card.id}
                  type="button"
                  data-slot={index}
                  data-color={card.color}
                  data-animal={card.animal}
                  className={cx(
                    styles.slotCard,
                    !free && styles.covered,
                    freedSet.has(index) && styles.justFreed,
                    nope === index && styles.nope,
                    hint === index && styles.hint,
                  )}
                  style={{ '--x': slot.x * X_GAP, '--y': slot.y } as CSSProperties}
                  aria-label={free ? cardName(card) : `${cardName(card)}（したに ある）`}
                  // したに ある カードも さわれるように しておき、「まだ とれないよ」と ゆらして おしえる。
                  aria-disabled={!free}
                  disabled={ending !== null}
                  onClick={(event) => handleSlot(index, event.currentTarget)}
                >
                  <CardFront card={card} />
                </button>
              )
            })}
          </div>

          <div className={styles.side}>
          <p className={styles.message} aria-live="polite">
            {started ? (
              <>
                <span className={styles.remaining}>
                  のこり <strong>{remaining}</strong> まい
                </span>
                {/* いま クリアしたら もらえる ★。やまを めくりすぎると へっていくのが みえる。 */}
                <span className={styles.liveStars} role="img" aria-label={`いま クリアすると ほし ${stars}こ`}>
                  {Array.from({ length: 3 }, (_, i) => (
                    <span
                      key={i}
                      className={i < stars ? styles.liveStarOn : styles.liveStarOff}
                      aria-hidden="true"
                    >
                      ★
                    </span>
                  ))}
                </span>
              </>
            ) : (
              <span className={styles.ruleHint}>
                <span className={styles.ruleChip}>おなじ いろ</span>か
                <span className={styles.ruleChip}>おなじ どうぶつ</span>を タッチ！
              </span>
            )}
          </p>

          <div className={styles.dock}>
            <button
              ref={stockRef}
              type="button"
              className={cx(styles.stock, hint === 'stock' && styles.hint, nope === 'stock' && styles.nope)}
              aria-label={stockLeft > 0 ? `やまから めくる（のこり ${stockLeft}まい）` : 'やまは もう ない'}
              disabled={ending !== null}
              onClick={handleStock}
            >
              {stockLeft > 0 ? (
                Array.from({ length: Math.min(3, stockLeft) }, (_, layer) => (
                  <span key={layer} className={styles.stockLayer} style={{ '--layer': layer } as CSSProperties}>
                    <CardBack />
                  </span>
                ))
              ) : (
                <span className={styles.stockEmpty} aria-hidden="true">
                  なし
                </span>
              )}
              <span className={styles.stockCount} aria-hidden="true">
                {stockLeft}
              </span>
              {hint === 'stock' ? (
                <span className={styles.pointer} aria-hidden="true">
                  👆
                </span>
              ) : null}
            </button>

            <div className={styles.pileArea}>
              <div ref={pileRef} className={styles.pile} role="img" aria-label={`まんなかの カード ${cardName(top)}`}>
                {game.pile.slice(-4).map((card, index, shown) => {
                  const isTop = index === shown.length - 1
                  const style = {
                    '--rot': `${pileRotation(card.id)}deg`,
                    ...(isTop && arrival
                      ? { '--dx': `${arrival.dx}px`, '--dy': `${arrival.dy}px`, '--s': arrival.scale }
                      : {}),
                  } as CSSProperties
                  return (
                    <span
                      key={card.id}
                      className={cx(
                        styles.pileCard,
                        isTop && arrival && (arrival.fromStock ? styles.arriveFromStock : styles.arrive),
                      )}
                      style={style}
                    >
                      <CardFront card={card} />
                    </span>
                  )
                })}
              </div>
              {voice ? (
                <span key={`voice-${game.pile.length}`} className={styles.voice} aria-hidden="true">
                  {voice}
                </span>
              ) : null}
              {game.combo >= 2 ? (
                <span
                  key={`combo-${game.pile.length}`}
                  className={cx(styles.combo, game.combo >= 5 && styles.comboBig)}
                  aria-hidden="true"
                >
                  <span className={styles.comboNumber}>{game.combo}</span>
                  <span className={styles.comboLabel}>れんさ！</span>
                </span>
              ) : null}
            </div>
          </div>
          </div>
        </section>

        {ending === 'clear' ? (
          <div className={styles.overlay}>
            <Confetti />
            <div className={styles.resultPanel}>
              <div className={styles.parade} aria-hidden="true">
                {PARADE.map((face, index) => (
                  <span key={face.animal} className={styles.paradeFace} style={{ animationDelay: `${index * 0.12}s` }}>
                    <AnimalFace animal={face.animal} color={face.color} />
                  </span>
                ))}
              </div>
              <p className={styles.resultTitle} role="status">
                {resultMessage}
                <span className={styles.resultSub}>ぜんぶ つなげたね</span>
              </p>
              <p className={styles.resultStars} role="img" aria-label={`ほし ${stars}こ`}>
                {Array.from({ length: 3 }, (_, i) => (
                  <span key={i} className={i < stars ? styles.starOn : styles.starOff} aria-hidden="true">
                    ★
                  </span>
                ))}
              </p>
              <p className={styles.resultDetail}>
                やまを <strong>{stockLeft}</strong>まい のこしたよ
                {stockLeft < game.par ? (
                  <>
                    <br />
                    <span className={styles.resultTip}>{game.par}まい のこせる とりかたも あるよ</span>
                  </>
                ) : (
                  <>
                    <br />
                    <span className={styles.resultTip}>いちばん うまい とりかた！</span>
                  </>
                )}
              </p>
              <div className={styles.actions}>
                <button type="button" className={cx(styles.button, styles.primary)} onClick={() => startStage(stage.id)}>
                  つぎの カード
                </button>
                {stockLeft < game.par ? (
                  <button type="button" className={cx(styles.button, styles.secondary)} onClick={retrySameDeal}>
                    おなじ カードで もういちど
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {ending === 'stuck' ? (
          <div className={styles.overlay}>
            <div className={styles.resultPanel}>
              <div className={cx(styles.parade, styles.paradeSleepy)} aria-hidden="true">
                {PARADE.map((face, index) => (
                  <span key={face.animal} className={styles.paradeFace} style={{ animationDelay: `${index * 0.2}s` }}>
                    <AnimalFace animal={face.animal} color={face.color} />
                  </span>
                ))}
              </div>
              <p className={styles.resultTitle} role="status">
                おしい！ あと {remaining}まい
              </p>
              <p className={styles.resultDetail}>
                とる じゅんばんを かえると
                <br />
                ぜんぶ つなげられるよ
              </p>
              <div className={styles.actions}>
                <button type="button" className={cx(styles.button, styles.primary)} onClick={retrySameDeal}>
                  おなじ カードで もういちど
                </button>
                <button type="button" className={cx(styles.button, styles.secondary)} onClick={() => startStage(stage.id)}>
                  あたらしく くばる
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    )
  }

  const page = (
    <main className={cx(styles.page, playing && styles.pagePlay)}>
      <header className={styles.header}>
        {playing ? <GameBackButton onBack={backToSelect} /> : <GameBackButton to="/" />}
        <h1 className={styles.title}>
          <span className={styles.titleEmoji} aria-hidden="true">
            🎴{' '}
          </span>
          おなじで ポン！
        </h1>
      </header>

      {playView ?? (
        <>
          <RuleExample />
          <p id="onaji-pon-instruction" className={styles.instruction}>
            どれで あそぶ？
          </p>
          <div className={styles.stageGrid} role="group" aria-labelledby="onaji-pon-instruction">
            {STAGES.map((option) => (
              <button
                key={option.id}
                type="button"
                className={styles.stageButton}
                aria-label={`${option.name} ${option.hint}`}
                onClick={() => startStage(option.id)}
              >
                <LayoutPreview stage={option} />
                <span className={styles.stageName}>{option.name}</span>
                <span className={styles.stageHint}>{option.hint}</span>
                <StageClearBadge stars={progress[option.id] ?? 0} />
              </button>
            ))}
          </div>
        </>
      )}

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
  return playing ? <GamePlaySurface>{page}</GamePlaySurface> : page
}
