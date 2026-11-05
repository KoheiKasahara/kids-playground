import { useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { STAGES, isComplete, moves, solution } from './model'
import { playBeeSound } from './sounds'
import styles from './BeeGardenPlay.module.css'

const progressStore = createStageProgressStore('bee-garden-progress-v1', id => STAGES.some((_, i) => String(i) === id))

export default function BeeGardenPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [path, setPath] = useState<number[]>([])
  const [progress, setProgress] = useState(progressStore.read)
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState<number | null>(null)
  const [sound, toggleSound] = useSoundToggle()
  useGameIntroPlaying(index !== null)
  const stage = STAGES[index ?? 0]
  const complete = index !== null && isComplete(stage, path)
  const available = index === null ? [] : moves(stage, path)
  const remaining = Math.max(0, stage.cells.length - path.length)

  function start(next: number) {
    primeAudio(); playBeeSound()
    setIndex(next); setPath([STAGES[next].cells[0]]); setMessage(''); setHint(null)
  }
  function move(cell: number) {
    if (complete) return
    if (!available.includes(cell)) {
      setMessage(cell === stage.cells[0] ? 'おはなを ぜんぶ めぐってから おうちへ' : path.includes(cell) ? '✓ の おはなは とおったよ' : 'となりの おはなへ とぼう')
      return
    }
    const next = [...path, cell]
    const won = isComplete(stage, next)
    setPath(next); setMessage(''); setHint(null); playBeeSound(won)
    if (won) setProgress(progressStore.record(index!, 3))
  }
  return <main className={`${styles.page} ${index !== null ? styles.playing : ''}`}>
    <header className={styles.header}>
      <GameBackButton to={index === null ? '/' : undefined} onBack={index === null ? undefined : () => setIndex(null)} />
      <h1>はちさんの はなめぐり</h1>
      <button onClick={toggleSound} aria-label={sound ? 'おとを けす' : 'おとを だす'}>{sound ? '🔊' : '🔇'}</button>
    </header>
    {index === null ? <section className={styles.selection}>
      <div className={styles.hero} aria-hidden="true">🌼 🐝 🌸</div>
      <h2>おはなを めぐって おうちへ！</h2>
      <p>おなじ おはなは １かいだけ。<br />どの みちで いこうかな？</p>
      <div className={styles.stages}>{STAGES.map((s, i) => <button key={s.name} onClick={() => start(i)}>
        <span>{i + 1}. {s.name}</span><small>🌼 {s.cells.length - 1}こ</small>
        <StageClearBadge stars={progress[String(i)] ?? 0} />
      </button>)}</div>
    </section> : <>
      <div className={styles.status}><strong>{index + 1}. {stage.name}</strong><span>🌼 あと {remaining}こ → {remaining ? '🔒' : '✨'} 🏠</span></div>
      <GamePlaySurface>
        <div className={styles.board} aria-label="おはなの おにわ">
          <svg className={styles.trail} viewBox="0 0 400 400" aria-hidden="true"><polyline points={path.map(cell => `${cell % 4 * 100 + 50},${Math.floor(cell / 4) * 100 + 50}`).join(' ')} /></svg>
          {Array.from({ length: 16 }, (_, cell) => {
            const active = stage.cells.includes(cell)
            const visited = path.includes(cell)
            const current = path.at(-1) === cell
            const hive = cell === stage.cells[0]
            return active ? <button key={cell} className={`${styles.cell} ${available.includes(cell) ? styles.available : ''} ${visited ? styles.visited : ''} ${hint === cell ? styles.hint : ''}`}
              aria-label={`${Math.floor(cell / 4) + 1}だん ${cell % 4 + 1}れつ ${hive ? 'おうち' : visited ? 'とおった おはな' : 'おはな'}${current ? ' はちさん' : ''}`}
              onClick={() => move(cell)} disabled={complete}>
              <span aria-hidden="true">{hive ? '🏠' : cell % 2 ? '🌼' : '🌸'}</span>
              {visited && !hive && <b className={styles.check} aria-hidden="true">✓</b>}
              {current && <span className={styles.bee} aria-hidden="true">🐝</span>}
              {available.includes(cell) && <b className={styles.arrow} aria-hidden="true">●</b>}
            </button> : <div key={cell} className={styles.grass} aria-hidden="true">🌱</div>
          })}
        </div>
      </GamePlaySurface>
      {complete ? <section className={styles.result} aria-label="クリア">
        <h2>🎉 おはなを ぜんぶ めぐれたね！</h2><p>🐝 みつが いっぱい！ ★★★</p>
        {index < STAGES.length - 1 && <button autoFocus onClick={() => start(index + 1)}>つぎの おにわ →</button>}
        <button onClick={() => start(index)}>もういちど</button><button onClick={() => setIndex(null)}>おにわを えらぶ</button>
      </section> : <>
        <p className={styles.message} role="status">{message || (available.length === 0 ? 'ひとつ もどって みよう ↶' : remaining === 0 ? 'おうちへ かえろう！ 🏠' : '● の おはなへ とぼう。ぜんぶ めぐれるかな？')}</p>
        <div className={styles.controls}>
          <button disabled={path.length < 2} onClick={() => { setPath(path.slice(0, -1)); setMessage(''); setHint(null); playBeeSound() }}>↶ ひとつ もどす</button>
          <button onClick={() => {
            const answer = solution(stage, path)
            if (answer) { setHint(answer[path.length]); setMessage('✨ の ほうへ いってみよう') }
            else setMessage('ひとつ もどって みよう ↶')
            playBeeSound()
          }}>💡 ヒント</button>
          <button onClick={() => start(index)}>↻ はじめから</button>
        </div>
      </>}
    </>}
  </main>
}
