import { useEffect, useReducer, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { vibrate } from '../../utils/haptics'
import FishArt from './FishArt'
import { FISH, fishingReducer, initialFishingState, type Fish } from './fishingGame'
import { playFishingSound } from './sounds'
import styles from './FishingPondPlay.module.css'

export default function FishingPondPlay() {
  const [game, dispatch] = useReducer(fishingReducer, undefined, initialFishingState)
  const [soundOn, setSoundOn] = useState(true)
  const soundOnRef = useRef(true)
  const actionRef = useRef<HTMLButtonElement>(null)
  const firstFishRef = useRef<HTMLButtonElement>(null)
  const selected = FISH.find((fish) => fish.id === game.selectedId)
  const available = FISH.filter((fish) => !game.caught.includes(fish.id))
  const playing = game.phase !== 'title'
  const landed = game.phase === 'caught' || game.phase === 'complete'
  const hasLine = game.phase === 'waiting' || game.phase === 'bite'
  useGameIntroPlaying(playing)

  useEffect(() => {
    if (game.phase !== 'waiting' || !selected) return
    const timer = window.setTimeout(() => {
      dispatch({ type: 'bite', fishId: selected.id })
      if (document.visibilityState !== 'hidden') {
        if (soundOnRef.current) playFishingSound('bite')
        vibrate('tap')
      }
    }, selected.waitMs)
    return () => window.clearTimeout(timer)
  }, [game.phase, selected])

  // 魚ボタンが消えたあとも、キーボードで次の操作へ進める。
  useEffect(() => {
    if (game.phase === 'choosing') firstFishRef.current?.focus({ preventScroll: true })
    else if (game.phase !== 'waiting') actionRef.current?.focus({ preventScroll: true })
  }, [game.phase])

  function chooseFish(fish: Fish) {
    if (game.phase !== 'choosing') return
    primeAudio()
    dispatch({ type: 'choose', fishId: fish.id })
    if (soundOn) playFishingSound('cast')
    vibrate('tap')
  }

  function handleAction() {
    primeAudio()
    if (game.phase === 'title' || game.phase === 'complete') {
      dispatch({ type: 'start' })
    } else if (game.phase === 'bite') {
      dispatch({ type: 'reel' })
      const complete = game.caught.length === FISH.length - 1
      if (soundOn) playFishingSound(complete ? 'complete' : 'catch')
      vibrate(complete ? 'celebrate' : 'success')
    } else if (game.phase === 'caught') {
      dispatch({ type: 'next' })
    }
  }

  const message = {
    title: 'どの おさかなが つれるかな？',
    choosing: 'おさかなを タップしてね',
    waiting: 'うきを みていてね…',
    bite: 'いまだ！ つりあげよう！',
    caught: `${selected?.name ?? ''}が つれた！`,
    complete: 'ぜんぶ つれた！ おめでとう！',
  }[game.phase]
  const actionLabel = {
    title: 'つりを はじめる',
    choosing: 'おさかなを えらぼう',
    waiting: 'まってね…',
    bite: 'つる！',
    caught: 'つぎの おさかな',
    complete: 'もういちど',
  }[game.phase]

  const content = (
    <main className={styles.page}>
      <header className={styles.header}>
        <GameBackButton to="/" onBack={playing ? () => dispatch({ type: 'back' }) : undefined} />
        <h1 className={styles.title}>のんびり さかなつり</h1>
        <button
          type="button"
          className={styles.soundButton}
          aria-label={soundOn ? 'おとを けす' : 'おとを だす'}
          aria-pressed={soundOn}
          onClick={() => {
            primeAudio()
            soundOnRef.current = !soundOn
            setSoundOn(!soundOn)
          }}
        >
          <span aria-hidden="true">{soundOn ? '🔊' : '🔇'}</span>
        </button>
      </header>

      <div className={styles.layout}>
        <div className={styles.sea} role="group" aria-label="おさかなの うみ">
          <div className={styles.sun} aria-hidden="true" />
          <div className={styles.cloud} aria-hidden="true" />
          <div className={styles.island} aria-hidden="true">🌴</div>
          <svg className={styles.boat} viewBox="0 0 180 100" aria-hidden="true" focusable="false">
            <path d="M16 58 H162 L140 87 H45Z" fill="#e99551" stroke="#885434" strokeWidth="4" strokeLinejoin="round" />
            <path d="M26 65 H154" stroke="#ffe7a9" strokeWidth="6" />
            <path d="M87 58 V15 Q128 12 148 38" fill="none" stroke="#936e49" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="62" cy="49" rx="18" ry="19" fill="#fff0c4" />
            <circle cx="50" cy="32" r="7" fill="#fff0c4" /><circle cx="73" cy="32" r="7" fill="#fff0c4" />
            <circle cx="57" cy="44" r="2.5" fill="#644b3d" /><circle cx="68" cy="44" r="2.5" fill="#644b3d" />
            <path d="M59 52 Q63 56 67 52" fill="none" stroke="#644b3d" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <div className={styles.waterline} aria-hidden="true" />
          <div className={styles.seabed} aria-hidden="true"><span>🪸</span><span>🐚</span><span>🌿</span></div>
          {hasLine && selected ? (
            <>
              <svg className={styles.line} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <path d={`M51 18 Q${selected.x} 9 ${selected.x} 28 V${selected.y - 3}`} fill="none" stroke="#fffdf0" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className={`${styles.float} ${game.phase === 'bite' ? styles.biting : ''}`} style={{ left: `${selected.x}%` }} aria-hidden="true">
                <span className={styles.ripple} />
                <span className={styles.bobber} />
                {game.phase === 'bite' ? <strong className={styles.biteMark}>！</strong> : <span className={styles.waitDots}>…</span>}
              </div>
            </>
          ) : null}
          {available.map((fish, index) => {
            const fishStyle = { left: `${fish.x}%`, top: `${fish.y}%`, '--delay': `${index * -0.7}s` } as CSSProperties
            const art = <span className={styles.swimmer}><FishArt fish={fish} /></span>
            return playing ? (
              <button
                key={fish.id}
                ref={index === 0 ? firstFishRef : undefined}
                type="button"
                className={`${styles.fish} ${selected?.id === fish.id ? styles.selectedFish : ''}`}
                style={fishStyle}
                aria-label={`${fish.name}を つる`}
                disabled={game.phase !== 'choosing'}
                onClick={() => chooseFish(fish)}
              >{art}</button>
            ) : <span key={fish.id} className={styles.fish} style={fishStyle} aria-hidden="true">{art}</span>
          })}
          {landed && selected ? (
            <div className={styles.catchShow} aria-hidden="true">
              <span className={styles.sparkles}>✦ ✧ ✦</span>
              <div className={styles.prize}><FishArt fish={selected} /></div>
              <span className={styles.catchWord}>{game.phase === 'complete' ? 'だいせいこう！' : 'つれた！'}</span>
            </div>
          ) : null}
        </div>

        <section className={styles.panel} aria-label="つりの そうさ">
          <p className={styles.message} role="status" aria-live="polite" aria-atomic="true">{message}</p>
          <button
            ref={actionRef}
            type="button"
            className={`${styles.action} ${game.phase === 'bite' ? styles.reel : ''}`}
            disabled={game.phase === 'choosing' || game.phase === 'waiting'}
            onClick={handleAction}
          >
            <span aria-hidden="true">{game.phase === 'waiting' ? '🫧' : game.phase === 'complete' ? '↻' : '🎣'}</span>
            {actionLabel}
          </button>
          <div className={styles.collection}>
            <p className={styles.count}>つれた おさかな <strong>{game.caught.length} / {FISH.length}</strong></p>
            <ol className={styles.album} aria-label="つれた おさかな">
              {FISH.map((fish) => {
                const caught = game.caught.includes(fish.id)
                return (
                  <li key={fish.id} className={caught ? styles.collected : styles.empty} aria-label={`${fish.name} ${caught ? 'つれた' : 'まだ'}`}>
                    <FishArt fish={fish} />
                    <span aria-hidden="true">{caught ? '✓' : '？'}</span>
                  </li>
                )
              })}
            </ol>
          </div>
        </section>
      </div>
    </main>
  )

  return playing && game.phase !== 'complete' ? <GamePlaySurface>{content}</GamePlaySurface> : content
}
