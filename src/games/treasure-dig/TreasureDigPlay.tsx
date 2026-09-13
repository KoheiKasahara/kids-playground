import { useCallback, useRef, useState } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { STAGES } from './stages'
import { readDigProgress, saveDigProgress, type DigProgress } from './digProgress'
import { useTreasureDig } from './useTreasureDig'
import type { Tool } from './treasureWorld'
import styles from './TreasureDigPlay.module.css'

const TOOLS: { id: Tool; name: string; icon: string; hint: string }[] = [
  { id: 'dig', name: 'ほる', icon: '⛏️', hint: 'すなと つちを なぞって ほろう。いわは ほれないよ' },
  { id: 'sand', name: 'すな', icon: '🏖️', hint: 'すなを つんで、たからの みちを かえよう' },
  { id: 'stone', name: 'いし', icon: '🧱', hint: 'いしは かべにも すべりだいにも なるよ' },
  { id: 'water', name: 'みず', icon: '💧', hint: 'みずを かけると、たからが ながれていくよ' },
]

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
  const [tool, setTool] = useState(TOOLS[0])
  const [wide, setWide] = useState(false)
  const [paused, setPaused] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const onCleared = useCallback((perfect: boolean) => record(stage.id, perfect), [record, stage.id])
  const game = useTreasureDig(canvasRef, stage, { tool: tool.id, radius: wide ? 6 : 3 }, paused, onCleared)
  const percent = Math.min(100, Math.round(game.collected / stage.need * 100))
  const last = index === STAGES.length - 1

  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton onBack={back} />
      <h1>ざくざく たからほり</h1>
      <span className={styles.badge}>{index + 1} / {STAGES.length}</span>
    </header>
    <div className={styles.workspace}>
      <div className={styles.goal}>
        <p className={styles.stageName}>{stage.name}</p>
        <div className={styles.meter}>
          <span className={styles.meterFill} style={{ width: `${percent}%` }} aria-hidden="true" />
          <b>💎 {game.collected} / {stage.need}</b>
        </div>
      </div>
      <section className={styles.board} aria-label="すなの やま">
        <canvas ref={canvasRef} {...game.canvasProps} className={styles.canvas} tabIndex={0}
          aria-label="たからやま。なぞって ほったり おいたり できるよ。キーボードは やじるしで ばしょ、スペースで どうぐを つかうよ">
          すなを ほって、たからを たからばこへ おとそう。
        </canvas>
        <p className={styles.notice} role="status">
          {game.unavailable ? 'ばんめんを ひらけなかったよ。もういちど ひらいてね'
            : game.status === 'stuck' ? '💧 たからが たりないよ'
              : paused ? '⏸ とまっているよ。ほっても OK！'
                : game.idle ? '⛏️ すなが とまったよ。もっと ほってみよう' : ''}
        </p>
        {game.status === 'cleared' && <div className={styles.overlay}>
          <div className={styles.card}>
            <p className={styles.sparkles} aria-hidden="true">✨ 💎 ✨</p>
            <h2>たからを あつめた！</h2>
            <p>{game.collected >= game.world.total ? 'ぜんぶ あつめた！ かんぺき！' : `💎 ${game.collected}こ ゲット！`}</p>
            <div className={styles.cardButtons}>
              <button onClick={game.retry}>↻ もういちど</button>
              <button autoFocus onClick={last ? select : next}>{last ? 'ステージを えらぶ' : 'つぎへ →'}</button>
            </div>
          </div>
        </div>}
        {game.status === 'stuck' && <div className={styles.retry}>
          <button onClick={game.retry}>↻ さいしょから やってみる</button>
        </div>}
      </section>
      <aside className={styles.tools} aria-label="どうぐ">
        <div className={styles.toolRow} role="group" aria-label="どうぐを えらぶ">
          {TOOLS.map(item => <button key={item.id} aria-label={item.name} aria-pressed={item.id === tool.id}
            onClick={() => { primeAudio(); game.stop(); setTool(item) }}>
            <span aria-hidden="true">{item.icon}</span><b>{item.id === tool.id ? '✓ ' : ''}{item.name}</b>
          </button>)}
        </div>
        <div className={styles.sizes} role="group" aria-label="ふとさ">
          <button aria-pressed={!wide} onClick={() => { game.stop(); setWide(false) }}>● ほそく</button>
          <button aria-pressed={wide} onClick={() => { game.stop(); setWide(true) }}>⬤ ふとく</button>
        </div>
        <p className={styles.hint}>{game.status === 'playing' ? stage.hint : tool.hint}</p>
      </aside>
      <div className={styles.actions}>
        <button onClick={() => { game.stop(); game.retry() }}>↻ もういちど</button>
        <button aria-pressed={paused} onClick={() => { game.stop(); setPaused(value => !value) }}>{paused ? '▶ うごかす' : '⏸ とめる'}</button>
        <button aria-label={`ステージを えらぶ。クリア ${cleared} / ${STAGES.length}`} onClick={select}>≡ ステージ</button>
      </div>
    </div>
  </main>
}

export default function TreasureDigPlay() {
  const [index, setIndex] = useState<number | null>(null)
  const [progress, setProgress] = useState<DigProgress>(() => readDigProgress())
  const record = useCallback((id: string, perfect: boolean) => {
    setProgress(current => {
      const level = perfect ? 2 : 1
      if ((current[id] ?? 0) >= level) return current
      const next = { ...current, [id]: level }
      saveDigProgress(next)
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
        <span>⛏️</span>
        <div><i>💎</i><i>✨</i><i>💎</i></div>
        <footer>・ ・ ・ 💰 ・ ・ ・</footer>
      </div>
      <p className={styles.eyebrow}>ざくざく ほって、きらきら あつめよう</p>
      <h1>ざくざく たからほり</h1>
      <p>すなを ほると たからが ころころ。<br />みずで ながしても いいよ</p>
    </div>
    <div className={styles.stageGrid}>
      {STAGES.map((stage, i) => {
        const level = progress[stage.id] ?? 0
        return <button key={stage.id} aria-label={`${i + 1} ${stage.name}${level === 2 ? ' ぜんぶ あつめた' : level ? ' クリア' : ''}`}
          onClick={() => { primeAudio(); setIndex(i) }}>
          <span className={styles.stageNumber}>{i + 1}</span>
          <b>{stage.name}</b>
          <em className={styles.stageMark} aria-hidden="true">{level === 2 ? '💎' : level ? '✓' : ''}</em>
        </button>
      })}
    </div>
    <p className={styles.legend}>
      <span>⛏️ ほる</span><span>💧 みずで ながす</span><span>🧱 いしで みちを つくる</span>
    </p>
  </main>
}
