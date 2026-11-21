import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useSoundToggle } from '../../audio/useSoundToggle'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import StageClearBadge from '../../components/StageClearBadge'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { chartHeight, chartWidth, charts, type Chart } from './charts'
import { paintStamp } from './coast'
import { useFleet } from './useFleet'
import styles from './FleetGame.module.css'

function Stamp({ chart }: { chart: Chart }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const ctx = ref.current?.getContext('2d')
    if (ctx) paintStamp(ctx, chart.kind)
  }, [chart])
  return <canvas ref={ref} className={styles.stamp} width={72} height={46} aria-hidden="true" />
}

function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  return <div className={styles.gauge} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
    <span>{label}</span>
    <div className={styles.segments} aria-hidden="true">{Array.from({ length: max }, (_, i) =>
      <i key={i} data-lit={i < value} />)}</div>
  </div>
}

export default function FleetGame() {
  const { hud, canvasRef, paused, records, enter, hold, release, chartTap, chooseTarget, fire, setPaused } = useFleet()
  const [sound, toggleSound] = useSoundToggle()
  const action = useRef<HTMLButtonElement>(null)
  const stageButtons = useRef<(HTMLButtonElement | null)[]>([])
  const restoreChartFocus = useRef(false)
  const stageIndex = charts.indexOf(hud.chart)
  const ready = hud.phase === 'ready', sailing = hud.phase === 'sailing', won = hud.phase === 'won'
  const over = !ready && !sailing
  useGameIntroPlaying(!ready)
  useEffect(() => {
    if (ready && restoreChartFocus.current) {
      restoreChartFocus.current = false
      stageButtons.current[stageIndex]?.focus({ preventScroll: true })
    } else if (sailing && !paused) canvasRef.current?.focus({ preventScroll: true })
    else if (over || paused) action.current?.focus({ preventScroll: true })
  }, [canvasRef, over, sailing, paused, ready, stageIndex])

  function returnToChart() {
    restoreChartFocus.current = true
    enter(hud.chart)
  }
  function keyDown(e: KeyboardEvent<HTMLElement>) {
    if (!sailing || paused || e.ctrlKey || e.metaKey || e.altKey) return
    const atSea = e.target === canvasRef.current
    if (e.key.startsWith('Arrow') || (atSea && e.key === ' ')) {
      e.preventDefault()
      hold(e.key, true)
      if (!e.repeat && e.key === ' ') fire()
    } else if (!e.repeat && (e.key.toLowerCase() === 'x' || (atSea && e.key === 'Enter'))) {
      e.preventDefault()
      chooseTarget()
    } else if (e.key === 'Escape') {
      setPaused(true)
    }
  }

  return <main className={styles.page} onKeyDown={keyDown} onKeyUp={e => hold(e.key, false)}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget)) release() }}>
    <div className={styles.content}>
      <header className={styles.header}>
        <GameBackButton to="/" onBack={ready ? undefined : returnToChart} />
        <h1><span className={styles.crest} aria-hidden="true">⚓︎</span>しおかぜせんたい</h1>
        <div className={styles.tools}>
          {sailing && !paused && <button type="button" className={styles.tool} aria-label="ひとやすみ" onClick={() => setPaused(true)}>Ⅱ</button>}
          <button type="button" className={styles.tool} onClick={toggleSound} aria-label="おと" aria-pressed={sound}>
            <span aria-hidden="true">{sound ? '♫' : '×'}</span><span className={styles.soundLabel}>おと</span>
          </button>
        </div>
      </header>
      <section className={styles.bridge} aria-label="こうかい">
        <div className={styles.brief}>
          <div className={styles.location}><span aria-hidden="true">⚑</span><h2>{hud.chart.name}</h2></div>
          <p>{hud.chart.mission}</p>
        </div>
        <GamePlaySurface>
          <div className={styles.sea}>
            <canvas className={styles.field} ref={canvasRef} tabIndex={sailing && !paused ? 0 : -1}
              aria-label={ready ? 'しゅっぱつまえの うみ' : 'ふねを うごかす うみ'} aria-describedby={sailing ? 'fleet-guide' : undefined}
              onPointerDown={e => {
                if (!sailing || paused || e.button !== 0) return
                const rect = e.currentTarget.getBoundingClientRect()
                e.currentTarget.focus({ preventScroll: true })
                chartTap({ x: (e.clientX - rect.left) / rect.width * chartWidth, y: (e.clientY - rect.top) / rect.height * chartHeight })
              }} />
            <div className={styles.compass} aria-hidden="true"><span>N</span><i /></div>
            {sailing && !paused && (hud.closingIn || (hud.mail !== undefined && hud.target === 0)) &&
              <span className={styles.signal}>{hud.closingIn ? 'ふねに ちかづくよ' : 'ゆうびんせんが みなとへ！'}</span>}
            {(over || paused) && <div className={styles.shade}>
              <div className={styles.report}>
                <div className={styles.medal} aria-hidden="true">{paused ? 'Ⅱ' : won ? '⚑' : '⚓︎'}</div>
                <h2 role="status">{paused ? 'ひとやすみ' : won ? 'うみを まもった！' : 'みなとで ひとやすみ'}</h2>
                {won && <p className={styles.stars} aria-label={`ほし ${hud.stars}こ`}>{'★'.repeat(hud.stars)}{'☆'.repeat(3 - hud.stars)}</p>}
                {hud.phase === 'lost' && <p>つぎは オレンジの わを よけよう</p>}
                <button ref={action} type="button" className={styles.gold} onClick={() => {
                  if (paused) setPaused(false)
                  else if (won && stageIndex < charts.length - 1) enter(charts[stageIndex + 1], true)
                  else enter(hud.chart, true)
                }}>{paused ? 'つづける' : won && stageIndex < charts.length - 1 ? 'つぎの うみへ' : 'もういちど'}</button>
                <button type="button" className={styles.secondary} onClick={returnToChart}>うみを えらぶ</button>
              </div>
            </div>}
          </div>
          <div className={styles.deck}>
            <div className={styles.gauges}>
              <Meter value={hud.hull} max={5} label="ふねの げんき" />
              {hud.mail !== undefined ? <Meter value={hud.mail} max={4} label="ゆうびんせん" /> :
                <div className={styles.gauge}><span>おいかえした ふね</span><strong>{hud.cleared}<small> / {hud.total} せき</small></strong></div>}
            </div>
            {ready ? <button className={styles.gold} type="button" onClick={() => enter(hud.chart, true)}>
              <span aria-hidden="true">▶</span> しゅっぱつ</button> :
              <div className={styles.helm}>
                <button className={styles.target} type="button" disabled={!sailing || paused} onClick={chooseTarget}>
                  <b aria-hidden="true">◎</b> まとを かえる</button>
                <button className={styles.gold} type="button" aria-label="みずでっぽう" disabled={!sailing || paused}
                  onPointerDown={e => {
                    if (e.button !== 0) return
                    e.currentTarget.setPointerCapture(e.pointerId)
                    hold('spray', true)
                    fire()
                  }} onLostPointerCapture={() => hold('spray', false)} onPointerUp={() => hold('spray', false)}
                  onPointerCancel={() => hold('spray', false)}
                  onClick={e => { if (e.detail === 0) fire() }}>
                  <span aria-hidden="true">◈</span> みずでっぽう
                  <i className={styles.reload} style={{ width: `${20 * hud.charge}%` }} />
                </button>
              </div>}
          </div>
        </GamePlaySurface>
      </section>

      {ready ? <section className={styles.chartPicker} aria-label="うみを えらぶ">
        <h2>うみを えらぶ</h2>
        <div className={styles.choices}>{charts.map((chart, i) =>
          <button type="button" key={chart.id} ref={el => { stageButtons.current[i] = el }} aria-pressed={chart === hud.chart}
            onClick={() => enter(chart)} className={styles.choice}>
            <Stamp chart={chart} />
            <span className={styles.chartName}>{chart.name}<StageClearBadge stars={records[chart.id] ?? 0} /></span>
            <span className={styles.radio} aria-hidden="true">{chart === hud.chart && '✓'}</span>
          </button>)}</div>
      </section> : <div className={styles.guide} id="fleet-guide">
        <p>うみを タッチで いどう<span>・</span>かいぞくせんを タッチで はっしゃ</p>
        <p className={styles.keys}><kbd>↑↓←→</kbd> いどう <kbd>Space</kbd> はっしゃ <kbd>X</kbd> まとを かえる</p>
        <span className={styles.sr} aria-live="polite">{sailing && (hud.target
          ? `まとは ${hud.target}ばんの ふね。のこり ${hud.total - hud.cleared}せき。` : 'ゆうびんせんが みなとへ むかっているよ')}</span>
      </div>}
    </div>
  </main>
}
