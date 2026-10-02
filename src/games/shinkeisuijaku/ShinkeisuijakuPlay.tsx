import { useEffect, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import {
  DIFFICULTY_PAIR_COUNT,
  countMatchedPairs,
  createShuffledDeck,
  isDeckComplete,
  type MemoryCard,
  type ShinkeisuijakuDifficulty,
} from './cardDeck'
import { THEMES, THEME_ORDER, type CardFace, type ShinkeisuijakuTheme } from './cardFaces'
import { playAllMatchedSound, playCardFlipSound, playCardMatchSound, playCardMismatchSound } from './sounds'
import StageClearBadge from '../../components/StageClearBadge'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { vibrate } from '../../utils/haptics'
import styles from './ShinkeisuijakuPlay.module.css'

type GameState = 'select' | 'playing' | 'complete'

const DIFFICULTY_LABELS: Record<ShinkeisuijakuDifficulty, { name: string; hint: string }> = {
  easy: { name: 'かんたん', hint: '6ペア' },
  hard: { name: 'むずかしい', hint: '8ペア' },
}

/** むずかしさごとの いちばん よい ★（Issue #784 A6）。まちがえて めくった回数が すくないほど ★が ふえる。 */
const memoryProgress = createStageProgressStore('shinkeisuijaku-progress-v1', (id) => Object.hasOwn(DIFFICULTY_LABELS, id))

function memoryStars(misses: number, pairs: number): 1 | 2 | 3 {
  return misses <= pairs / 2 ? 3 : misses <= pairs ? 2 : 1
}

/** むずかしさごとの列数。カードの縦横比が極端にならない並びを選ぶ。 */
const GRID_COLUMNS: Record<ShinkeisuijakuDifficulty, number> = {
  easy: 3,
  hard: 4,
}

/** 不一致のカードを裏返すまでの待ち時間[ms]。絵柄を覚える間を少し残す。 */
const MISMATCH_DELAY_MS = 900
/** 一致したカードを確定表示にするまでの待ち時間[ms]。めくった瞬間の一致を目で確認できるようにする。 */
const MATCH_DELAY_MS = 450

/**
 * カードの表面。絵文字・すうじは文字のまま、はたらくくるま・こっきは画像で描く。
 * 名前は呼び出し側のボタンがaria-labelに持つため、ここは装飾として隠す。
 */
function CardFaceView({ face }: { face: CardFace }) {
  if ('image' in face) {
    return <img className={styles.faceImage} src={import.meta.env.BASE_URL + face.image} alt="" />
  }
  return (
    <span className={styles.faceSymbol} aria-hidden="true">
      {face.symbol}
    </span>
  )
}

export default function ShinkeisuijakuPlay() {
  const [gameState, setGameState] = useState<GameState>('select')
  const [theme, setTheme] = useState<ShinkeisuijakuTheme>('animal')
  const [difficulty, setDifficulty] = useState<ShinkeisuijakuDifficulty>('easy')
  const [cards, setCards] = useState<MemoryCard[]>([])
  const [revealedIds, setRevealedIds] = useState<string[]>([])
  const [locked, setLocked] = useState(false)
  const [soundOn, setSoundOn] = useState(true)
  const resolveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const missesRef = useRef(0)
  const [progress, setProgress] = useState(memoryProgress.read)

  useGameIntroPlaying(gameState !== 'select')

  useEffect(() => {
    return () => {
      if (resolveTimeoutRef.current !== null) clearTimeout(resolveTimeoutRef.current)
    }
  }, [])

  const startNewGame = (nextTheme: ShinkeisuijakuTheme, nextDifficulty: ShinkeisuijakuDifficulty) => {
    if (resolveTimeoutRef.current !== null) {
      clearTimeout(resolveTimeoutRef.current)
      resolveTimeoutRef.current = null
    }
    setTheme(nextTheme)
    setDifficulty(nextDifficulty)
    setCards(createShuffledDeck(nextTheme, nextDifficulty))
    setRevealedIds([])
    setLocked(false)
    missesRef.current = 0
    setGameState('playing')
  }

  const handleSelectDifficulty = (nextDifficulty: ShinkeisuijakuDifficulty) => {
    primeAudio()
    startNewGame(theme, nextDifficulty)
  }

  const handleRetry = () => {
    primeAudio()
    startNewGame(theme, difficulty)
  }

  const handleBackToSelect = () => {
    if (resolveTimeoutRef.current !== null) {
      clearTimeout(resolveTimeoutRef.current)
      resolveTimeoutRef.current = null
    }
    setGameState('select')
    setCards([])
    setRevealedIds([])
    setLocked(false)
  }

  const handleCardClick = (id: string) => {
    if (locked || gameState !== 'playing') return
    const card = cards.find((current) => current.id === id)
    if (!card || card.status !== 'hidden' || revealedIds.length >= 2) return

    primeAudio()
    if (soundOn) playCardFlipSound()
    const nextRevealedIds = [...revealedIds, id]
    const revealedCards = cards.map((current) =>
      current.id === id ? { ...current, status: 'revealed' as const } : current,
    )
    setCards(revealedCards)
    setRevealedIds(nextRevealedIds)

    if (nextRevealedIds.length < 2) return

    const [firstId, secondId] = nextRevealedIds
    const firstCard = revealedCards.find((current) => current.id === firstId)!
    const secondCard = revealedCards.find((current) => current.id === secondId)!
    const isMatch = firstCard.face.id === secondCard.face.id

    setLocked(true)
    // 判定確定後の最終状態をここで先に組み立てる。lockedがtrueの間は他の操作でcardsが
    // 変化しないため、revealedCards（クリック時点のスナップショット）を基にしても安全。
    const finalCards = revealedCards.map((cardItem) =>
      cardItem.id === firstId || cardItem.id === secondId
        ? { ...cardItem, status: isMatch ? ('matched' as const) : ('hidden' as const) }
        : cardItem,
    )
    resolveTimeoutRef.current = setTimeout(
      () => {
        resolveTimeoutRef.current = null
        setCards(finalCards)
        setRevealedIds([])
        setLocked(false)
        if (!isMatch) missesRef.current += 1
        const allMatched = isMatch && isDeckComplete(finalCards)
        vibrate(allMatched ? 'celebrate' : isMatch ? 'success' : 'tap')
        if (soundOn) {
          if (isMatch) playCardMatchSound()
          else playCardMismatchSound()
        }
        if (allMatched) {
          setProgress(memoryProgress.record(difficulty, memoryStars(missesRef.current, DIFFICULTY_PAIR_COUNT[difficulty])))
          setGameState('complete')
          if (soundOn) playAllMatchedSound()
        }
      },
      isMatch ? MATCH_DELAY_MS : MISMATCH_DELAY_MS,
    )
  }

  const matchedPairs = countMatchedPairs(cards)
  const totalPairs = DIFFICULTY_PAIR_COUNT[difficulty]

  const page = (
    <main className={`${styles.page} ${gameState === 'select' ? styles.pageSelect : ''}`}>
      <header className={styles.header}>
        <GameBackButton to="/" />
        <h1 className={styles.title}>
          <span aria-hidden="true">🃏</span> しんけいすいじゃく
        </h1>
      </header>

      {gameState === 'select' ? (
        <>
          <p id="shinkeisuijaku-theme-instruction" className={styles.instruction}>
            えがらを えらんでね
          </p>
          <div className={styles.themeGrid} role="group" aria-labelledby="shinkeisuijaku-theme-instruction">
            {THEME_ORDER.map((option) => {
              const selected = option === theme
              return (
                <button
                  key={option}
                  type="button"
                  className={[styles.themeButton, selected ? styles.themeButtonSelected : ''].filter(Boolean).join(' ')}
                  // 色だけでなく、押されている状態と「えらんだよ」の印でも選択中が分かるようにする。
                  aria-pressed={selected}
                  onClick={() => setTheme(option)}
                >
                  <span className={styles.themePreview}>
                    <CardFaceView face={THEMES[option].faces[0]!} />
                  </span>
                  <span className={styles.themeName}>{THEMES[option].label}</span>
                  <span className={styles.themeCheck} aria-hidden="true">
                    {selected ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>

          <p id="shinkeisuijaku-instruction" className={styles.instruction}>
            むずかしさを えらんでね
          </p>
          <div className={styles.difficultyGrid} role="group" aria-labelledby="shinkeisuijaku-instruction">
            {(Object.keys(DIFFICULTY_LABELS) as ShinkeisuijakuDifficulty[]).map((option) => (
              <button
                key={option}
                type="button"
                className={styles.difficultyButton}
                aria-label={`${DIFFICULTY_LABELS[option].name} ${DIFFICULTY_LABELS[option].hint}`}
                onClick={() => handleSelectDifficulty(option)}
              >
                <span className={styles.difficultyName}>{DIFFICULTY_LABELS[option].name}</span>
                <span className={styles.difficultyHint}>{DIFFICULTY_LABELS[option].hint}</span>
                <StageClearBadge stars={progress[option] ?? 0} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className={styles.status} role="status" aria-live="polite">
            {gameState === 'complete'
              ? `ぜんぶ そろったよ！ ${matchedPairs} / ${totalPairs} ペア`
              : `みつけた ペア：${matchedPairs} / ${totalPairs}`}
          </p>

          <div
            className={styles.grid}
            style={{ '--card-cols': GRID_COLUMNS[difficulty], '--wide-cols': totalPairs } as CSSProperties}
          >
            {cards.map((card) => {
              const faceUp = card.status !== 'hidden'
              return (
                <button
                  key={card.id}
                  type="button"
                  data-card-id={card.id}
                  className={[
                    styles.card,
                    faceUp ? styles.cardFaceUp : '',
                    card.status === 'matched' ? styles.cardMatched : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={faceUp ? card.face.name : 'カード'}
                  aria-pressed={faceUp}
                  disabled={card.status !== 'hidden'}
                  onClick={() => handleCardClick(card.id)}
                >
                  {faceUp ? (
                    <CardFaceView face={card.face} />
                  ) : (
                    <span className={styles.faceSymbol} aria-hidden="true">
                      ❓
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className={styles.actions}>
            {gameState === 'complete' && (
              <button type="button" className={`${styles.button} ${styles.start}`} onClick={handleRetry}>
                もういちど
              </button>
            )}
            <button type="button" className={`${styles.button} ${styles.retry}`} onClick={handleBackToSelect}>
              えらびなおす
            </button>
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
  return gameState === 'select' ? page : <GamePlaySurface>{page}</GamePlaySurface>
}
