import { useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { primeAudio } from '../../audio/sound'
import { createStageProgressStore } from '../shared/progress/stageProgress'
import { STAGES, col, isComplete, moves, row, solution, type Stage, type Tile } from './model'
import { playBeeSound } from './sounds'
import styles from './BeeGardenPlay.module.css'

const progressStore = createStageProgressStore('bee-garden-progress-v1', id => STAGES.some((_, i) => String(i) === id))
const SCENERY: Partial<Record<Tile, string>> = { '#': '🌱', '~': '💧', '^': '🪨' }
const DIRECTIONS: Record<string, [number, string]> = { '0,1': [0, 'みぎ'], '1,0': [90, 'した'], '0,-1': [180, 'ひだり'], '-1,0': [270, 'うえ'] }

/** Centre of a cell (or a point between two cells) as a percentage of the board. */
function spot(stage: Stage, r: number, c: number): CSSProperties {
  return { left: `${(c + 0.5) / stage.cols * 100}%`, top: `${(r + 0.5) / stage.rows * 100}%` }
}

function direction(stage: Stage, from: number, to: number) {
  return DIRECTIONS[`${row(stage, to) - row(stage, from)},${col(stage, to) - col(stage, from)}`]
}

export default function BeeGardenPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [path, setPath] = useState<number[]>([])
  const [progress, setProgress] = useState(progressStore.read)
  const [message, setMessage] = useState('')
  const [hint, setHint] = useState<number | null>(null)
  const [shake, setShake] = useState<{ cell: number; key: number } | null>(null)
  const [sound, toggleSound] = useSoundToggle()
  useGameIntroPlaying(index !== null)
  const stage = STAGES[index ?? 0]
  const hive = stage.cells[0]
  const head = path.at(-1) ?? hive
  const complete = index !== null && isComplete(stage, path)
  const available = index === null ? [] : moves(stage, path)
  const remaining = Math.max(0, stage.cells.length - path.length)
  const stuck = index !== null && !complete && available.length === 0

  function reset(next: number[]) { setPath(next); setMessage(''); setHint(null); setShake(null) }

  function start(next: number) {
    primeAudio(); playBeeSound()
    setIndex(next); reset([STAGES[next].cells[0]])
  }

  function move(cell: number) {
    if (complete) return
    if (!available.includes(cell)) {
      setShake(prev => ({ cell, key: (prev?.key ?? 0) + 1 }))
      setMessage(cell === hive ? '🌼を ぜんぶ まわってから 🏠へ' : path.includes(cell) ? '✓ の おはなは もう いったよ' : 'やじるしの おはなへ とぼう')
      return
    }
    const next = [...path, cell]
    const won = isComplete(stage, next)
    reset(next); playBeeSound(won)
    if (won) setProgress(progressStore.record(index!, 3))
  }

  function showHint() {
    const answer = solution(stage, path)
    if (answer) { setHint(answer[path.length]); setMessage('✨ の ところへ とんで みよう') }
    else setMessage('いきどまり！ ↶ で もどろう')
    playBeeSound()
  }

  const status = complete ? '🎉 🌼 → 🏠' : remaining ? `🌼 あと ${remaining}こ → 🔒🏠` : '🌼 ✓ → 🏠 かえろう！'
  const guide = message || (stuck ? 'いきどまり！ ↶ で もどろう' : remaining === 0 ? 'やじるしで 🏠へ かえろう' : 'やじるしの おはなを タップ！')

  return <main className={`${styles.page} ${index !== null ? styles.playing : ''}`}>
    <header className={styles.header}>
      <GameBackButton to={index === null ? '/' : undefined} onBack={index === null ? undefined : () => setIndex(null)} />
      <h1>はちさんの はなめぐり</h1>
      <button onClick={toggleSound} aria-label={sound ? 'おとを けす' : 'おとを だす'}>{sound ? '🔊' : '🔇'}</button>
    </header>
    {index === null ? <section className={styles.selection}>
      <div className={styles.hero} aria-hidden="true">🏠 ➜ 🌼 ➜ 🌸 ➜ 🏠</div>
      <h2>🐝 おはなを ぜんぶ めぐって おうちへ！</h2>
      <div className={styles.stages}>{STAGES.map((s, i) => <button key={s.name} onClick={() => start(i)}>
        <span>{i + 1}. {s.name}</span><small>🌼 {s.cells.length - 1}こ</small>
        <StageClearBadge stars={progress[String(i)] ?? 0} />
      </button>)}</div>
    </section> : <>
      <div className={styles.status}><strong>{index + 1}. {stage.name}</strong><span aria-live="polite">{status}</span></div>
      <GamePlaySurface>
        <div className={styles.board} style={{ '--cols': stage.cols, '--rows': stage.rows } as CSSProperties}>
          <div className={styles.grid} aria-label="おはなの おにわ">
            {stage.tiles.map((tile, cell) => {
              const r = row(stage, cell), c = col(stage, cell)
              const scenery = SCENERY[tile]
              if (scenery) return <div key={cell} className={`${styles.scenery} ${tile === '~' ? styles.pond : ''}`} aria-hidden="true">{scenery}</div>
              const isHive = cell === hive
              const visited = path.includes(cell) && !isHive
              const open = available.includes(cell)
              const dir = open ? direction(stage, head, cell) : undefined
              return <button key={shake?.cell === cell ? `${cell}-${shake.key}` : cell}
                className={[styles.cell, isHive && styles.hive, open && styles.available, visited && styles.visited, hint === cell && styles.hint, shake?.cell === cell && styles.shake].filter(Boolean).join(' ')}
                aria-label={`${r + 1}だん ${c + 1}れつ ${isHive ? 'おうち' : visited ? 'とおった おはな' : 'おはな'}${head === cell ? ' はちさん' : ''}${dir ? ` ${dir[1]}へ とべる` : ''}${hint === cell ? ' ヒント' : ''}`}
                onClick={() => move(cell)} disabled={complete}>
                <span className={styles.icon} aria-hidden="true">{isHive ? '🏠' : (r + c) % 2 ? '🌼' : '🌸'}</span>
                {visited && <b className={styles.check} aria-hidden="true">✓</b>}
                {isHive && remaining > 0 && <b className={styles.lock} aria-hidden="true">🔒</b>}
              </button>
            })}
            <svg className={styles.trail} viewBox={`0 0 ${stage.cols * 100} ${stage.rows * 100}`} preserveAspectRatio="none" aria-hidden="true">
              <polyline points={path.map(cell => `${col(stage, cell) * 100 + 50},${row(stage, cell) * 100 + 50}`).join(' ')} />
            </svg>
            {available.map(cell => {
              const [angle] = direction(stage, head, cell)
              const r = (row(stage, head) * 0.4 + row(stage, cell) * 0.6), c = (col(stage, head) * 0.4 + col(stage, cell) * 0.6)
              return <span key={cell} className={styles.arrow} style={{ ...spot(stage, r, c), '--angle': `${angle}deg` } as CSSProperties} aria-hidden="true">
                <svg viewBox="0 0 40 40"><path d="M6 14h16V5l14 15-14 15v-9H6z" /></svg>
              </span>
            })}
            <span className={`${styles.bee} ${complete ? styles.home : ''}`} style={spot(stage, row(stage, head), col(stage, head))} aria-hidden="true">🐝</span>
          </div>
        </div>
      </GamePlaySurface>
      {complete ? <section className={styles.result} aria-label="クリア">
        <h2>🎉 おはなを ぜんぶ めぐれたね！</h2><p>🐝 みつが いっぱい！ ★★★</p>
        {index < STAGES.length - 1 && <button autoFocus onClick={() => start(index + 1)}>つぎの おにわ →</button>}
        <button onClick={() => start(index)}>もういちど</button><button onClick={() => setIndex(null)}>おにわを えらぶ</button>
      </section> : <>
        <p className={styles.message} role="status">{guide}</p>
        <div className={styles.controls}>
          <button className={stuck ? styles.nudge : undefined} disabled={path.length < 2} onClick={() => { reset(path.slice(0, -1)); playBeeSound() }}>
            <span aria-hidden="true">↶</span>ひとつ もどす
          </button>
          <button onClick={showHint}><span aria-hidden="true">💡</span>ヒント</button>
          <button onClick={() => start(index)}><span aria-hidden="true">↻</span>はじめから</button>
        </div>
      </>}
    </>}
  </main>
}
