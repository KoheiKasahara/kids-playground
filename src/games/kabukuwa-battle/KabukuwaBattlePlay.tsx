import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import GameBackButton from '../../components/GameBackButton'
import GamePlaySurface from '../../components/GamePlaySurface'
import { useGameIntroPlaying } from '../../components/gameIntroState'
import { primeAudio } from '../../audio/sound'
import { useSoundToggle } from '../../audio/useSoundToggle'
import { vibrate } from '../../utils/haptics'
import { createBattle, drainEvents, DT, stepBattle, type Battle, type BattleEvent, type EndReason } from './battle'
import { ambient, createFx, spawnFx, updateFx } from './fx'
import { makeCanvas } from './pixel'
import { portraitSprite, Scene, stageDots, TEAM_COLORS, viewSize, warmSprites, type ViewSize } from './render'
import {
  GROUP_LABEL, SPECIES, STAT_KEYS, STAT_LABEL, STAT_MAX, speciesById, speciesOfGroup,
  type BeetleGroup, type Species,
} from './species'
import { setSpriteBudget } from './sprite'
import { resultText, STAGES, stageById, type Stage } from './stages'
import * as sound from './sounds'
import styles from './KabukuwaBattlePlay.module.css'

const TITLE = 'カブクワ バトル'
const GROUPS: readonly BeetleGroup[] = ['kabuto', 'kuwagata']

type Screen =
  | { kind: 'pick'; step: 'mine' | 'foe' }
  | { kind: 'stage' }
  | { kind: 'battle'; stage: Stage; seed: number }

function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31)
}

// ---------------- ドット絵の 小さな 絵 ----------------

/** むしの 絵（ななめ まえから）。dot は 1ドットの 大きさ（CSS px）。なければ わくに あわせる。 */
function BeetlePicture({ sp, dot, className }: { sp: Species; dot?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null)
  useEffect(() => {
    const canvas = ref.current
    const sprite = portraitSprite(sp)
    const ctx = canvas?.getContext('2d')
    if (!canvas || !sprite?.canvas || !ctx) return
    canvas.width = sprite.w
    canvas.height = sprite.h
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(sprite.canvas, 0, 0)
    setBox({ w: sprite.w, h: sprite.h })
  }, [sp])
  // はばだけ きめて、たかさは 絵の わりあいの まま（せまい がめんでは ちぢむ）。
  const style = dot && box ? { width: box.w * dot } : undefined
  return <canvas ref={ref} className={`${styles.pixel} ${className ?? ''}`} style={style} aria-hidden="true" />
}

function StatBars({ sp }: { sp: Species }) {
  return <ul className={styles.stats} aria-label="つよさ">
    {STAT_KEYS.map(key => {
      const value = sp.stats[key]
      return <li key={key} className={styles.stat} data-stat={key} aria-label={`${STAT_LABEL[key]} ${value}（${STAT_MAX}の うち）`}>
        <span className={styles.statName} aria-hidden="true">{STAT_LABEL[key]}</span>
        <span className={styles.statCells} aria-hidden="true">
          {Array.from({ length: STAT_MAX }, (_, i) => <span key={i} className={i < value ? styles.cellOn : styles.cellOff} />)}
        </span>
        <span className={styles.statValue} aria-hidden="true">{value}</span>
      </li>
    })}
  </ul>
}

function SoundButton({ sound: on, onToggle }: { sound: boolean; onToggle: () => void }) {
  return <button type="button" className={`${styles.window} ${styles.soundButton}`} onClick={onToggle} aria-pressed={on} aria-label={on ? 'おとを けす' : 'おとを だす'}>
    <span aria-hidden="true">{on ? '🔊' : '🔇'}</span>
  </button>
}

// ---------------- むしを えらぶ ----------------

const Dex = forwardRef<HTMLElement, { sp: Species }>(function Dex({ sp }, ref) {
  return <section ref={ref} className={`${styles.window} ${styles.dex}`} aria-labelledby="kabukuwa-dex-name" data-group={sp.group}>
    <div className={styles.dexPicture}>
      <BeetlePicture key={sp.id} sp={sp} dot={2} className={styles.dexCanvas} />
    </div>
    <div className={styles.dexBody}>
      <p className={styles.dexGroup}>{GROUP_LABEL[sp.group]}</p>
      <h2 id="kabukuwa-dex-name" className={styles.dexName}>{sp.name}</h2>
      <dl className={styles.dexFacts}>
        <div><dt>すんでいる ところ</dt><dd>{sp.home}</dd></div>
        <div><dt>からだの ながさ（オス）</dt><dd>{sp.lengthMm[0]}〜{sp.lengthMm[1]}mm</dd></div>
        <div><dt>とくいわざ</dt><dd>{sp.move.name}</dd></div>
      </dl>
      <StatBars sp={sp} />
      <p className={styles.dexFact}>{sp.fact}</p>
    </div>
  </section>
})

function PickScreen({ step, mine, focus, onFocus, onPick, onRandom, onBack, soundOn, onSound }: {
  step: 'mine' | 'foe'; mine: Species | null; focus: Species; onFocus: (sp: Species) => void; onPick: (sp: Species) => void
  onRandom: () => void; onBack: (() => void) | null; soundOn: boolean; onSound: () => void
}) {
  const dexRef = useRef<HTMLElement>(null)
  const focusOn = (sp: Species) => {
    onFocus(sp)
    // したの ほうで えらんだときは、ずかんカードが みえる ところまで もどる。
    const dex = dexRef.current
    if (dex && dex.getBoundingClientRect().top < 0) dex.scrollIntoView?.({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }
  return <main className={styles.page}>
    <header className={styles.header}>
      {onBack ? <GameBackButton onBack={onBack} /> : <GameBackButton to="/" />}
      <h1 className={styles.title}><span aria-hidden="true">🪲</span> {TITLE}</h1>
      <SoundButton sound={soundOn} onToggle={onSound} />
    </header>
    <ol className={styles.steps} aria-label="じゅんばん">
      <li aria-current={step === 'mine' ? 'step' : undefined} data-done={step !== 'mine'}>じぶん</li>
      <li aria-current={step === 'foe' ? 'step' : undefined}>あいて</li>
      <li>ばしょ</li>
    </ol>
    <p className={styles.lead}>
      {step === 'mine' ? 'たたかわせる むしを えらぼう' : <>{mine?.short}と たたかう <strong>あいて</strong>を えらぼう</>}
    </p>
    <Dex ref={dexRef} sp={focus} />
    {GROUPS.map(group => <section key={group} className={styles.group} aria-labelledby={`kabukuwa-group-${group}`}>
      <h2 id={`kabukuwa-group-${group}`} className={styles.groupTitle}>{GROUP_LABEL[group]}</h2>
      <ul className={styles.grid}>
        {speciesOfGroup(group).map(sp => <li key={sp.id}>
          <button type="button" className={styles.pickCard} aria-pressed={focus.id === sp.id} data-mine={step === 'foe' && mine?.id === sp.id}
            aria-label={`${sp.name}（${sp.home}）`} onClick={() => focusOn(sp)}>
            <span className={styles.pickPicture}><BeetlePicture sp={sp} className={styles.pickCanvas} /></span>
            <span className={styles.pickName}>{sp.short}</span>
            <span className={styles.pickSize}>〜{sp.lengthMm[1]}mm</span>
          </button>
        </li>)}
      </ul>
    </section>)}
    {/* けってい ボタンは いつも 画面の したに みえるように する。 */}
    <div className={styles.actionBar}>
      {step === 'foe' && <button type="button" className={`${styles.window} ${styles.randomButton}`} onClick={onRandom}>
        <span aria-hidden="true">🎲</span> おまかせ
      </button>}
      <button type="button" className={`${styles.window} ${styles.primary} ${styles.dexAction}`} onClick={() => onPick(focus)}>
        {step === 'mine' ? `${focus.short}に けってい！` : `${focus.short}と たたかう！`}
      </button>
    </div>
  </main>
}

// ---------------- ばしょを えらぶ ----------------

/** ステージの みほん（はじまる まえの すがた）を 1まい かく。 */
function stageThumbnail(stage: Stage, a: Species, b: Species): string | null {
  const size = stageDots(stage)
  const made = makeCanvas(size.w, size.h)
  if (!made) return null
  const battle = createBattle(a, b, stage.id, 7, stage.startU)
  const scene = new Scene(stage)
  setSpriteBudget(Infinity)
  try {
    scene.draw(made.ctx, battle, createFx(), 0, size.w, size.h, 1, false)
    return made.canvas.toDataURL()
  } catch {
    return null
  }
}

function StageScreen({ mine, foe, onPick, onBack, soundOn, onSound }: {
  mine: Species; foe: Species; onPick: (stage: Stage) => void; onBack: () => void; soundOn: boolean; onSound: () => void
}) {
  const [thumbs, setThumbs] = useState<Record<string, string>>({})
  useEffect(() => {
    let cancelled = false
    const timers = STAGES.map((stage, i) => setTimeout(() => {
      if (cancelled) return
      const url = stageThumbnail(stage, mine, foe)
      if (url) setThumbs(t => ({ ...t, [stage.id]: url }))
    }, 40 + i * 60))
    return () => { cancelled = true; timers.forEach(clearTimeout) }
  }, [mine, foe])

  return <main className={styles.page}>
    <header className={styles.header}>
      <GameBackButton onBack={onBack} />
      <h1 className={styles.title}><span aria-hidden="true">🪲</span> {TITLE}</h1>
      <SoundButton sound={soundOn} onToggle={onSound} />
    </header>
    <ol className={styles.steps} aria-label="じゅんばん">
      <li data-done>じぶん</li>
      <li data-done>あいて</li>
      <li aria-current="step">ばしょ</li>
    </ol>
    <div className={`${styles.window} ${styles.matchup}`} aria-label={`${mine.name} たい ${foe.name}`}>
      <span className={styles.matchSide} style={{ '--team': TEAM_COLORS[0] } as CSSProperties}>
        <BeetlePicture sp={mine} className={styles.matchCanvas} /><span>{mine.short}</span>
      </span>
      <strong className={styles.vs} aria-hidden="true">VS</strong>
      <span className={styles.matchSide} style={{ '--team': TEAM_COLORS[1] } as CSSProperties}>
        <BeetlePicture sp={foe} className={styles.matchCanvas} /><span>{foe.short}</span>
      </span>
    </div>
    <p className={styles.lead}>たたかう ばしょを えらぼう</p>
    <ul className={styles.stageList}>
      {STAGES.map(stage => <li key={stage.id}>
        <button type="button" className={`${styles.window} ${styles.stageCard}`} data-stage={stage.id} onClick={() => onPick(stage)}
          aria-label={`${stage.name}（${stage.view} みる）`}>
          <span className={styles.stageThumb} data-stage={stage.id}>
            {thumbs[stage.id] && <img src={thumbs[stage.id]} alt="" />}
            <span className={styles.viewBadge}>{stage.view}</span>
          </span>
          <span className={styles.stageName}>{stage.name}</span>
          <span className={styles.stageLead}>{stage.lead}</span>
        </button>
      </li>)}
    </ul>
  </main>
}

// ---------------- たたかい ----------------

type Hud = { st: [number, number] }
type Banner = 'ready' | 'go' | 'end' | null
type Result = { winner: 0 | 1; reason: EndReason }
/** わざが きまった ときの「ドカーン！」などの もじ。x・y は キャンバスに たいする %。 */
type Pop = { id: number; text: string; x: number; y: number; big: boolean; tone: 'hit' | 'clash' | 'special' | 'soft' }

/**
 * canvas を 画面の 大きさに あわせる。たてむきの ときは たたかいの 画面ごと 90° まわして いるので、
 * getBoundingClientRect（まわした あとの 大きさ）ではなく、まわす まえの 大きさ（clientWidth）を つかう。
 */
function fitCanvas(canvas: HTMLCanvasElement, minW: number, minH: number): ViewSize {
  const dpr = Math.min(3, window.devicePixelRatio || 1)
  const view = viewSize(canvas.clientWidth || 640, canvas.clientHeight || 360, dpr, minW, minH)
  if (canvas.width !== view.dw) canvas.width = view.dw
  if (canvas.height !== view.dh) canvas.height = view.dh
  return view
}

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

function BattleScreen({ mine, foe, stage, seed, soundOn, onSound, onQuit, onRetry, onChangeFoe, onChangeStage }: {
  mine: Species; foe: Species; stage: Stage; seed: number; soundOn: boolean; onSound: () => void
  onQuit: () => void; onRetry: () => void; onChangeFoe: () => void; onChangeStage: () => void
}) {
  useGameIntroPlaying(true)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hud, setHud] = useState<Hud>({ st: [100, 100] })
  const [banner, setBanner] = useState<Banner>('ready')
  const [message, setMessage] = useState('はっけよい…')
  const [result, setResult] = useState<Result | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [pops, setPops] = useState<Pop[]>([])
  const mirror = mine.id === foe.id

  useEffect(() => {
    const battle = createBattle(mine, foe, stage.id, seed, stage.startU)
    if (import.meta.env.DEV) (window as unknown as { __kabukuwaBattle?: Battle }).__kabukuwaBattle = battle
    const scene = new Scene(stage)
    const still = reducedMotion()
    const fx = createFx(seed, still)
    const name = (side: 0 | 1) => (mirror ? (side === 0 ? 'じぶんの ' : 'あいての ') : '') + battle.f[side].sp.short
    const timers: ReturnType<typeof setTimeout>[] = []
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d') ?? null
    const buffer = { canvas: null as HTMLCanvasElement | null, g: null as CanvasRenderingContext2D | null, w: 0, h: 0 }
    const dots = stageDots(stage)
    let view: ViewSize = canvas ? fitCanvas(canvas, dots.w, dots.h) : viewSize(640, 360, 1, dots.w, dots.h)
    const measure = () => { if (canvas) view = fitCanvas(canvas, dots.w, dots.h) }
    const observer = typeof ResizeObserver === 'function' && canvas ? new ResizeObserver(measure) : null
    if (canvas) observer?.observe(canvas)
    window.addEventListener('resize', measure)
    sound.playReady()
    /** わざが きまった ときの ひとやすみ（ヒットストップ）と、しょうぶが ついた ときの スロー。 */
    let stop = 0, slow = 0, popId = 0
    const pop = (text: string, u: number, v: number, z: number, big: boolean, tone: Pop['tone']) => {
      const at = scene.toScreen(u, v, z)
      if (!at) return
      const id = ++popId
      setPops(list => [...list.slice(-3), { id, text, x: Math.max(8, Math.min(92, at[0] * 100)), y: Math.max(14, Math.min(90, at[1] * 100)), big, tone }])
      timers.push(setTimeout(() => setPops(list => list.filter(p => p.id !== id)), 900))
    }
    const at = (side: 0 | 1, up = 30) => [battle.f[side].u, battle.f[side].v, battle.f[side].z + up] as const

    const onEvent = (e: BattleEvent) => {
      spawnFx(fx, e, battle)
      switch (e.type) {
        case 'go': sound.playGo(); setBanner('go'); setMessage('のこった！'); timers.push(setTimeout(() => setBanner(b => (b === 'go' ? null : b)), 900)); break
        case 'clash': sound.playClash(); vibrate('tap'); setMessage('ガシッ！ くみあった！'); pop('ガシッ！', e.u, e.v, 34, false, 'clash'); break
        case 'windup':
          sound.playWindup(e.move === 'utchari')
          setMessage(e.move === 'utchari' ? `${name(e.side)}、うっちゃりを ねらう！` : `${name(e.side)}の ${battle.f[e.side].sp.move.name}！`)
          break
        case 'hit': {
          sound.playHit(e.big)
          vibrate('impact')
          const def = name((1 - e.side) as 0 | 1)
          const special = e.move === 'utchari'
          setMessage(special ? 'うっちゃり！ ぎゃくてんの なげ！' : e.move === 'pinch' ? `${def}を はさんだ！` : e.move === 'charge' ? `${def}を ふっとばした！` : `${def}を なげた！`)
          const word = special ? 'うっちゃり！' : e.move === 'pinch' ? 'ギリギリッ！' : e.move === 'charge' ? 'ドスーン！' : e.big ? 'ドカーン！' : 'ブンッ！'
          pop(word, e.u, e.v, 40, e.big || special, special ? 'special' : 'hit')
          if ((e.big || special) && !still) stop = .16
          break
        }
        case 'block': sound.playBlock(); setMessage(`${name(e.side)}は ふんばった！`); pop('ガッ！', ...at(e.side), false, 'soft'); break
        case 'dodge': sound.playBlock(); setMessage(`${name(e.side)}は ひらりと かわした！`); pop('ひらり', ...at(e.side), false, 'soft'); break
        case 'land': sound.playLand(); if (e.flipped) { setMessage(`${name(e.side)}が ひっくりかえった！`); pop('ドサッ！', e.u, e.v, 20, false, 'soft') } break
        case 'recover': setMessage(`${name(e.side)}は おきあがった！`); break
        case 'cling': sound.playCling(); setMessage(`${name(e.side)}は えだに しがみついた！`); pop('ぎゅっ！', ...at(e.side, -10), false, 'soft'); break
        case 'climb': setMessage(`${name(e.side)}は えだに もどった！`); break
        case 'slip': setMessage(`${name(e.side)}の あしが すべった！`); break
        case 'edge': setMessage(`${name(e.side)}、あぶない！ はしっこだ！`); break
        case 'push': setMessage(`${name(e.side)}が ぐいぐい おしている！`); break
        case 'fall': sound.playFall(); setMessage(`${name(e.side)}が おちた！`); pop('ひゅ〜', ...at(e.side, 10), true, 'soft'); break
        case 'flee': sound.playFall(); setMessage(`${name(e.side)}は にげだした！`); break
        case 'timeup': sound.playGo(); setMessage('じかんぎれ！'); break
        case 'end':
          if (!still) slow = 1.2
          setResult({ winner: e.winner, reason: e.reason })
          setBanner('end')
          timers.push(setTimeout(() => setMessage(`${name(e.winner)}の かち！`), 1400))
          timers.push(setTimeout(() => {
            if (e.winner === 0) { sound.playWin(); vibrate('celebrate') } else sound.playLose()
          }, 500))
          timers.push(setTimeout(() => setShowResult(true), 2600))
          break
        default: break
      }
    }

    let raf = 0, previous = 0, acc = 0, time = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = previous ? Math.min(.1, (now - previous) / 1000) : 0
      previous = now
      if (typeof document !== 'undefined' && document.hidden) return
      time += dt
      if (stop > 0) stop -= dt
      else acc += dt * (slow > 0 ? .35 : 1)
      slow = Math.max(0, slow - dt)
      let steps = 0
      while (acc >= DT && steps < 6) {
        stepBattle(battle)
        acc -= DT
        steps++
      }
      if (steps === 6) acc = 0
      for (const e of drainEvents(battle)) onEvent(e)
      if (!still) ambient(fx, stage.id, dt, scene.camU)
      updateFx(fx, dt)
      const pct = (side: 0 | 1) => Math.max(0, Math.round(battle.f[side].st / battle.f[side].maxSt * 100))
      setHud(prev => (prev.st[0] === pct(0) && prev.st[1] === pct(1) ? prev : { st: [pct(0), pct(1)] }))
      if (!ctx) return
      if (!buffer.canvas || buffer.w !== view.w || buffer.h !== view.h) {
        const made = makeCanvas(view.w, view.h)
        buffer.canvas = made?.canvas ?? null
        buffer.g = made?.ctx ?? null
        buffer.w = view.w; buffer.h = view.h
      }
      if (!buffer.g || !buffer.canvas) return
      if (battle.state === 'ready') {
        // はっけよい の あいだに よく つかう 絵を つくって おく。
        setSpriteBudget(8)
        warmSprites(stage, battle, 64)
      }
      // あたらしい むきの 絵は 1フレームに すこしずつ つくる（スマホでも カクカク しないように）。
      setSpriteBudget(2)
      scene.draw(buffer.g, battle, fx, time, view.w, view.h, dt)
      ctx.imageSmoothingEnabled = false
      ctx.drawImage(buffer.canvas, 0, 0, view.w * view.scale, view.h * view.scale)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      observer?.disconnect()
      window.removeEventListener('resize', measure)
      timers.forEach(clearTimeout)
      setSpriteBudget(Infinity)
      if (import.meta.env.DEV) delete (window as unknown as { __kabukuwaBattle?: Battle }).__kabukuwaBattle
    }
  }, [mine, foe, stage, seed, mirror])

  const label = (side: 0 | 1) => (mirror ? (side === 0 ? 'じぶんの ' : 'あいての ') : '') + (side === 0 ? mine : foe).short
  const winnerSp = result ? (result.winner === 0 ? mine : foe) : null
  const loserName = result ? label((1 - result.winner) as 0 | 1) : ''

  return <GamePlaySurface><main className={styles.battle} data-stage={stage.id}>
    <h1 className={styles.srOnly}>{TITLE} {stage.name}</h1>
    <div className={styles.arena}>
      <canvas ref={canvasRef} className={styles.arenaCanvas} aria-label={`${mine.name} たい ${foe.name}`} />
      <div className={styles.pops} aria-hidden="true">
        {pops.map(p => <span key={p.id} className={styles.pop} data-tone={p.tone} data-big={p.big} style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.text}</span>)}
      </div>
      {banner === 'ready' && <p className={styles.banner} aria-hidden="true">はっけよい…<small>{stage.view}・{stage.name}</small></p>}
      {banner === 'go' && <p className={`${styles.banner} ${styles.bannerGo}`} aria-hidden="true">のこった！</p>}
      {banner === 'end' && result && !showResult && <p className={`${styles.banner} ${styles.bannerEnd}`} style={{ '--team': TEAM_COLORS[result.winner] } as CSSProperties} aria-hidden="true">
        {label(result.winner)}の かち！
      </p>}
    </div>
    <header className={styles.battleHeader}>
      <GameBackButton onBack={onQuit} />
      <div className={styles.plates}>
        {([0, 1] as const).map(side => <div key={side} className={styles.plate} data-side={side} style={{ '--team': TEAM_COLORS[side] } as CSSProperties}>
          <span className={styles.plateTag}>{side === 0 ? 'じぶん' : 'あいて'}</span>
          <strong className={styles.plateName}>{(side === 0 ? mine : foe).short}</strong>
          <span className={styles.meter} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={hud.st[side]} aria-label={`${label(side)}の げんき`}>
            <span style={{ width: `${hud.st[side]}%` }} data-low={hud.st[side] < 30} />
          </span>
        </div>)}
      </div>
      <SoundButton sound={soundOn} onToggle={onSound} />
    </header>
    <p className={`${styles.window} ${styles.message}`} role="status" aria-live="polite">{message}</p>
    {result && showResult && winnerSp && <div className={styles.resultLayer}>
      <section className={`${styles.window} ${styles.result}`} aria-labelledby="kabukuwa-result" style={{ '--team': TEAM_COLORS[result.winner] } as CSSProperties}>
        <p className={styles.resultLabel}>{result.winner === 0 ? 'やったね！' : 'ざんねん…'}</p>
        <h2 id="kabukuwa-result" className={styles.resultTitle}>{label(result.winner)}の かち！</h2>
        <BeetlePicture sp={winnerSp} dot={1.6} className={styles.resultCanvas} />
        <p className={styles.resultReason}>{resultText(stage.id, loserName, result.reason)}</p>
        <div className={styles.resultButtons}>
          <button type="button" className={`${styles.window} ${styles.primary}`} autoFocus onClick={onRetry}>もういちど</button>
          <button type="button" className={styles.window} onClick={onChangeFoe}>あいてを かえる</button>
          <button type="button" className={styles.window} onClick={onChangeStage}>ばしょを かえる</button>
        </div>
      </section>
    </div>}
  </main>
  {/* たてむきの ときは たたかいを よこむきに まわして みせるので、さいしょに ひとこと しらせる。 */}
  <p className={styles.rotateHint} aria-hidden="true"><span>📱</span>よこむきに すると おおきく みられるよ</p>
  </GamePlaySurface>
}

// ---------------- ぜんたい ----------------

export default function KabukuwaBattlePlay() {
  const [screen, setScreen] = useState<Screen>({ kind: 'pick', step: 'mine' })
  const [mineId, setMineId] = useState<string | null>(null)
  const [foeId, setFoeId] = useState<string | null>(null)
  const [focusId, setFocusId] = useState(SPECIES[0].id)
  const [soundOn, toggleSound] = useSoundToggle()
  const mine = speciesById(mineId) ?? null
  const foe = speciesById(foeId) ?? null
  const focus = speciesById(focusId) ?? SPECIES[0]

  useGameIntroPlaying(screen.kind !== 'pick' || screen.step !== 'mine')

  const tap = () => { primeAudio(); sound.playSelect() }
  const choose = (sp: Species) => { primeAudio(); sound.playBuzz(sp.voice); setFocusId(sp.id) }
  const pickMine = (sp: Species) => {
    tap()
    setMineId(sp.id)
    // あいては にている つよさの べつの むしを さいしょに みせる。
    const next = foeId && foeId !== sp.id ? foeId : SPECIES[(SPECIES.indexOf(sp) + 1) % SPECIES.length].id
    setFocusId(next)
    setScreen({ kind: 'pick', step: 'foe' })
  }
  const pickFoe = (sp: Species) => {
    primeAudio()
    sound.playDecide()
    setFoeId(sp.id)
    setScreen({ kind: 'stage' })
  }
  const randomFoe = () => {
    const pool = SPECIES.filter(sp => sp.id !== mineId)
    pickFoe(pool[Math.floor(Math.random() * pool.length)])
  }
  const startBattle = (stage: Stage) => {
    primeAudio()
    sound.playDecide()
    setScreen({ kind: 'battle', stage, seed: randomSeed() })
  }

  const soundProps = useMemo(() => ({ soundOn, onSound: toggleSound }), [soundOn, toggleSound])

  if (screen.kind === 'battle' && mine && foe) {
    return <BattleScreen key={screen.seed} mine={mine} foe={foe} stage={screen.stage} seed={screen.seed} {...soundProps}
      onQuit={() => { tap(); setScreen({ kind: 'stage' }) }}
      onRetry={() => startBattle(stageById(screen.stage.id) ?? screen.stage)}
      onChangeFoe={() => { tap(); setFocusId(foe.id); setScreen({ kind: 'pick', step: 'foe' }) }}
      onChangeStage={() => { tap(); setScreen({ kind: 'stage' }) }} />
  }
  if (screen.kind === 'stage' && mine && foe) {
    return <StageScreen mine={mine} foe={foe} onPick={startBattle} {...soundProps}
      onBack={() => { tap(); setFocusId(foe.id); setScreen({ kind: 'pick', step: 'foe' }) }} />
  }
  const step = screen.kind === 'pick' && mine ? screen.step : 'mine'
  return <PickScreen step={step} mine={mine} focus={focus} onFocus={choose} onRandom={randomFoe} {...soundProps}
    onPick={step === 'mine' ? pickMine : pickFoe}
    onBack={step === 'foe' ? () => { tap(); if (mine) setFocusId(mine.id); setScreen({ kind: 'pick', step: 'mine' }) } : null} />
}
